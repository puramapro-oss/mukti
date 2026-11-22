// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// PostgreSQL WASM executes the real migration SQL. Auth claims/roles are local fixtures.
// This does NOT qualify a deployed Supabase instance or multi-process concurrency.
let db: PGlite
let owner: string
let other: string
const authA = '10000000-0000-4000-8000-000000000001'
const authB = '10000000-0000-4000-8000-000000000002'
const sources = ['0013_wellbeing_continuity.sql','0014_journal_reflection.sql','0015_rewards_integrity.sql','0016_minimal_ritual_integrity.sql','0017_profile_and_aurora_integrity.sql']
const file = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
const phase = [{ phase: 'armement', duration_sec: 8, breaths_counted: 2, coherence: 1 }]
const protectedTables = [
  'profiles', 'aurora_sessions', 'aurora_streaks', 'mental_journal_entries',
  'minimal_ritual_ticks', 'mystery_rewards', 'daily_recognitions',
  'wellbeing_checkins', 'aurora_feedback', 'wellbeing_suggestion_pauses',
]
const ordinaryProfileSettings = [
  'full_name', 'avatar_url', 'theme', 'preferred_locale', 'notifications_enabled',
  'onboarding_completed', 'onboarded', 'tutorial_completed', 'disclaimer_accepted_at',
]

async function role(name: 'postgres' | 'authenticated' | 'anon' | 'service_role', authId = authA) {
  await db.exec('RESET ROLE')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [authId])
  if (name !== 'postgres') await db.exec(`SET ROLE ${name}`)
}
async function session(userId = owner, variant = 'calm', completedHoursAgo?: number) {
  await role('service_role')
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO mukti.aurora_sessions(user_id,variant,started_at,completed_at) VALUES($1,$2,now()-interval '1 day',CASE WHEN $3::numeric IS NULL THEN NULL ELSE now()-$3*interval '1 hour' END) RETURNING id",
    [userId, variant, completedHoursAgo ?? null])
  return rows[0].id
}
async function complete(id: string, userId = owner, phases = phase, duration = 8, reason = 'user_stop') {
  return db.query<{ result: { ok: boolean; already: boolean; level_reached: string } }>(
    'SELECT mukti.complete_aurora_session($1,$2,$3::jsonb,$4,$5) AS result', [userId, id, JSON.stringify(phases), duration, reason])
}

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;`)
  await db.exec(await file('schema.sql'))
  // These CREATE TABLE statements are extracted verbatim from the existing migrations.
  for (const [source, tables] of [
    ['migrations/0007_g5_aurora_reprogramming.sql', ['aurora_sessions','aurora_streaks']],
    ['migrations/0008_g6_core_events_modes_16_20.sql', ['mystery_rewards','minimal_ritual_ticks','mental_journal_entries']],
  ] as const) {
    const sql = await file(source)
    for (const table of tables) {
      const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS mukti.${table} (`)
      const end = sql.indexOf('\n);', start)
      if (start < 0 || end < 0) throw new Error(`Fixture source missing: ${table}`)
      await db.exec(sql.slice(start, end + 3))
      await db.exec(`ALTER TABLE mukti.${table} ENABLE ROW LEVEL SECURITY;
        CREATE POLICY fixture_old_policy ON mukti.${table} FOR ALL USING(user_id=mukti.current_profile_id()) WITH CHECK(user_id=mukti.current_profile_id());
        GRANT SELECT,INSERT,UPDATE,DELETE ON mukti.${table} TO anon,authenticated,service_role;`)
    }
  }
  await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2),($3,$4)', [authA,'a@example.test',authB,'b@example.test'])
  owner = (await db.query<{ id: string }>('SELECT id FROM mukti.profiles WHERE auth_user_id=$1',[authA])).rows[0].id
  other = (await db.query<{ id: string }>('SELECT id FROM mukti.profiles WHERE auth_user_id=$1',[authB])).rows[0].id
  await db.query("INSERT INTO mukti.mental_journal_entries(user_id,transcript,relapse_risk,mood_score) VALUES($1,'Historical writing',0.8,4)",[owner])
  await db.query("INSERT INTO mukti.mystery_rewards(user_id,tier,reward_type,reward_amount) VALUES($1,'rare','coupon',100)",[owner])
  await db.query("INSERT INTO mukti.minimal_ritual_ticks(user_id,habit_slug,tick_date) VALUES($1,'pause_ecran','2026-01-01')",[owner])
  for (const source of sources) {
    if (source === '0017_profile_and_aurora_integrity.sql') {
      // New tables now exist. Seed old column ACLs to verify that the migration's
      // table-level REVOKE clears them before restoring only the intended rights.
      await db.exec(`DO $$ DECLARE t text; c text; BEGIN
        FOREACH t IN ARRAY ARRAY['${protectedTables.join("','")}'] LOOP
          FOR c IN SELECT column_name FROM information_schema.columns
            WHERE table_schema='mukti' AND table_name=t
          LOOP
            EXECUTE format('GRANT ALL PRIVILEGES (%I) ON TABLE mukti.%I TO PUBLIC,anon,authenticated',c,t);
          END LOOP;
        END LOOP;
      END $$;`)
    }
    await db.exec(await file(`migrations/${source}`))
  }
}, 30_000)
afterAll(async () => { if (db) await db.close() })

it('applies every new migration twice without destroying legacy rows or provenance', async () => {
  await role('postgres')
  for (const source of sources) await db.exec(await file(`migrations/${source}`))
  const journal = (await db.query<{ transcript: string; entry_source: string; relapse_risk: string }>('SELECT transcript,entry_source,relapse_risk FROM mukti.mental_journal_entries')).rows[0]
  expect(journal.transcript).toBe('Historical writing'); expect(journal.entry_source).toBe('legacy'); expect(Number(journal.relapse_risk)).toBe(0.8)
  expect((await db.query<{ reward_amount: number }>('SELECT reward_amount FROM mukti.mystery_rewards')).rows[0].reward_amount).toBe(100)
  expect((await db.query<{ time_zone: string }>('SELECT time_zone FROM mukti.minimal_ritual_ticks')).rows[0].time_zone).toBe('UTC')
})

it('protects privileged profile columns while preserving ordinary user settings', async () => {
  await role('authenticated')
  await expect(db.query("UPDATE mukti.profiles SET role='super_admin' WHERE id=$1",[owner])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query('UPDATE mukti.profiles SET purama_points=10000 WHERE id=$1',[owner])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query('UPDATE mukti.profiles SET wallet_balance_cents=10000 WHERE id=$1',[owner])).rejects.toMatchObject({ code: '42501' })
  await db.query("UPDATE mukti.profiles SET full_name='Allowed setting' WHERE id=$1",[owner])
  const rows = (await db.query('SELECT id FROM mukti.profiles')).rows
  expect(rows).toEqual([{ id: owner }])
})

it('removes old column ACLs on every protected table and grants only the profile settings whitelist', async () => {
  await role('postgres')
  const privileges = await db.query<{
    table_name: string; column_name: string; role_name: string;
    can_select: boolean; can_insert: boolean; can_update: boolean; can_reference: boolean;
  }>(`SELECT c.relname AS table_name, a.attname AS column_name, r.name AS role_name,
    has_column_privilege(r.name,c.oid,a.attnum,'SELECT') AS can_select,
    has_column_privilege(r.name,c.oid,a.attnum,'INSERT') AS can_insert,
    has_column_privilege(r.name,c.oid,a.attnum,'UPDATE') AS can_update,
    has_column_privilege(r.name,c.oid,a.attnum,'REFERENCES') AS can_reference
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
    CROSS JOIN (VALUES ('anon'::text),('authenticated'::text)) AS r(name)
    WHERE n.nspname='mukti'`)
  const rows = privileges.rows.filter(row => protectedTables.includes(row.table_name))
  expect(new Set(rows.map(row => row.table_name)).size).toBe(protectedTables.length)
  for (const row of rows) {
    expect({ ...row, can_select: undefined, can_update: undefined }).toMatchObject({ can_insert: false, can_reference: false })
    expect(row.can_select).toBe(row.role_name === 'authenticated')
    expect(row.can_update).toBe(row.role_name === 'authenticated' && row.table_name === 'profiles'
      && ordinaryProfileSettings.includes(row.column_name))
  }
})

it('rejects client writes and anonymous column reads despite the deliberately seeded old grants', async () => {
  await role('authenticated')
  await expect(db.query("UPDATE mukti.mystery_rewards SET reward_amount=999 WHERE user_id=$1",[owner])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query("INSERT INTO mukti.mental_journal_entries(user_id,transcript) VALUES($1,'Forged client write')",[owner])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query('INSERT INTO mukti.daily_recognitions(user_id) VALUES($1)',[owner])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query("UPDATE mukti.minimal_ritual_ticks SET participation_mode='rest' WHERE user_id=$1",[owner])).rejects.toMatchObject({ code: '42501' })
  await role('anon')
  for (const table of protectedTables) {
    await expect(db.exec(`SELECT ${table === 'profiles' ? 'id' : 'user_id'} FROM mukti.${table}`)).rejects.toMatchObject({ code: '42501' })
  }
})

it('blocks direct client writes to rewards, session summaries, declarations and journal', async () => {
  await role('authenticated')
  for (const table of ['daily_recognitions','mystery_rewards','aurora_sessions','aurora_streaks','wellbeing_checkins','aurora_feedback','wellbeing_suggestion_pauses','mental_journal_entries','minimal_ritual_ticks']) {
    await expect(db.exec(`DELETE FROM mukti.${table}`)).rejects.toMatchObject({ code: '42501' })
  }
  await expect(db.query('SELECT mukti.record_daily_recognition($1)',[other])).rejects.toMatchObject({ code: '42501' })
  await expect(db.query("SELECT mukti.record_aurora_feedback($1,$2,'immediate','better',false)",[owner,authA])).rejects.toMatchObject({ code: '42501' })
})

it('records a daily recognition idempotently without touching historical receipts or balances', async () => {
  await role('service_role')
  const first = (await db.query<{ r: { recognition: { id: string }; already_recorded: boolean } }>('SELECT mukti.record_daily_recognition($1) r',[owner])).rows[0].r
  const next = (await db.query<{ r: { recognition: { id: string }; already_recorded: boolean } }>('SELECT mukti.record_daily_recognition($1) r',[owner])).rows[0].r
  expect(first.already_recorded).toBe(false); expect(next.already_recorded).toBe(true); expect(next.recognition.id).toBe(first.recognition.id)
  expect((await db.query<{ purama_points: number; wallet_balance_cents: number }>('SELECT purama_points,wallet_balance_cents FROM mukti.profiles WHERE id=$1',[owner])).rows[0]).toEqual({ purama_points: 0, wallet_balance_cents: 0 })
  await db.query('SELECT mukti.record_daily_recognition($1)',[other])
  await role('authenticated')
  expect((await db.query('SELECT user_id FROM mukti.daily_recognitions')).rows).toEqual([{ user_id: owner }])
  await role('anon')
  await expect(db.exec('SELECT * FROM mukti.daily_recognitions')).rejects.toMatchObject({ code: '42501' })
})

it('keeps rest separate from practice and aggregates histories longer than 500 rows', async () => {
  await role('service_role')
  await db.query("INSERT INTO mukti.minimal_ritual_ticks(user_id,habit_slug,tick_date,participation_mode) SELECT $1,'respiration_consciente',DATE '2026-11-10'-n,'standard' FROM generate_series(1,600) n",[owner])
  await db.query("INSERT INTO mukti.minimal_ritual_ticks(user_id,habit_slug,tick_date,participation_mode) VALUES($1,'respiration_consciente','2026-11-10','rest')",[owner])
  const result = await db.query<{ recorded_today: boolean; ticked_today: boolean; mode_today: string; progress_days: number; practice_days: number; rest_days: number }>("SELECT * FROM mukti.minimal_ritual_summary($1,'2026-11-10') WHERE habit_slug='respiration_consciente'",[owner])
  expect(result.rows[0]).toMatchObject({ recorded_today: true, ticked_today: false, mode_today: 'rest', progress_days: 601, practice_days: 600, rest_days: 1 })
  expect((await db.query("SELECT * FROM mukti.minimal_ritual_summary($1,'2026-11-10')",[other])).rows).toEqual([])
})

it('rejects new inferred risk scores and audio without transcription consent', async () => {
  await role('service_role')
  await expect(db.query("INSERT INTO mukti.mental_journal_entries(user_id,entry_source,transcript,relapse_risk) VALUES($1,'text','A new note',0.9)",[owner])).rejects.toMatchObject({ code: '23514' })
  await expect(db.query("INSERT INTO mukti.mental_journal_entries(user_id,entry_source,transcript,audio_duration_sec) VALUES($1,'audio','A new note',12)",[owner])).rejects.toMatchObject({ code: '23514' })
  await expect(db.query("INSERT INTO mukti.mental_journal_entries(user_id,entry_source,transcript,transcription_consent_version,transcription_consented_at,audio_duration_sec) VALUES($1,'audio','A new note','2026-11-10',now(),NULL)",[owner])).rejects.toMatchObject({ code: '23514' })
  await db.query("INSERT INTO mukti.mental_journal_entries(user_id,entry_source,transcript) VALUES($1,'text','A new note')",[owner])
})

it('completes a session once and never stores the old coherence score', async () => {
  const id = await session()
  const first = (await complete(id)).rows[0].result
  const second = (await complete(id)).rows[0].result
  expect(first).toMatchObject({ ok: true, already: false }); expect(second).toMatchObject({ ok: true, already: true })
  expect((await db.query<{ total_sessions: number }>('SELECT total_sessions FROM mukti.aurora_streaks WHERE user_id=$1',[owner])).rows[0].total_sessions).toBe(1)
  expect((await db.query<{ coherence_score: null; phases_completed: Array<{ coherence: null }> }>('SELECT coherence_score,phases_completed FROM mukti.aurora_sessions WHERE id=$1',[id])).rows[0]).toMatchObject({ coherence_score: null, phases_completed: [{ coherence: null }] })
})

it('rejects another user, malformed ordering and a fabricated duration', async () => {
  const id = await session()
  await expect(complete(id, other)).rejects.toMatchObject({ code: 'P0002' })
  await expect(complete(id, owner, [{ ...phase[0], phase: 'glide_out' }])).rejects.toMatchObject({ code: '22023' })
  await expect(complete(id, owner, phase, 100)).rejects.toMatchObject({ code: '22023' })
  expect((await db.query<{ completed_at: null }>('SELECT completed_at FROM mukti.aurora_sessions WHERE id=$1',[id])).rows[0].completed_at).toBeNull()
})

it('rolls back the completion and discomfort pause when updating the participation summary fails', async () => {
  const id = await session(owner, 'sleep')
  await role('postgres')
  await db.exec("CREATE FUNCTION mukti.fixture_fail_summary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected storage failure'; END $$; CREATE TRIGGER fixture_fail BEFORE UPDATE ON mukti.aurora_streaks FOR EACH ROW EXECUTE FUNCTION mukti.fixture_fail_summary();")
  await role('service_role')
  await expect(complete(id,owner,phase,8,'dizzy')).rejects.toThrow('injected storage failure')
  expect((await db.query<{ completed_at: null }>('SELECT completed_at FROM mukti.aurora_sessions WHERE id=$1',[id])).rows[0].completed_at).toBeNull()
  expect((await db.query("SELECT variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1 AND variant='sleep'",[owner])).rows).toEqual([])
  await role('postgres'); await db.exec('DROP TRIGGER fixture_fail ON mukti.aurora_streaks; DROP FUNCTION mukti.fixture_fail_summary();')
})

it('preserves an acquired milestone while deriving counts from actual session rows', async () => {
  const id = await session(other)
  await db.query("INSERT INTO mukti.aurora_streaks(user_id,current_level,last_session_date,current_days,total_sessions,total_minutes) VALUES($1,'aura','2020-01-01',20,999,999) ON CONFLICT(user_id) DO UPDATE SET current_level='aura',total_sessions=999,total_minutes=999",[other])
  expect((await complete(id,other)).rows[0].result.level_reached).toBe('aura')
  expect((await db.query('SELECT current_level,total_sessions,total_minutes FROM mukti.aurora_streaks WHERE user_id=$1',[other])).rows[0])
    .toEqual({ current_level: 'aura', total_sessions: 1, total_minutes: 0 })
  expect((await db.query('SELECT id FROM mukti.aurora_sessions WHERE user_id=$1',[other])).rows).toEqual([{ id }])
})

it('pauses suggestions after an explicit dizzy stop and preserves voluntary resumption on replay', async () => {
  const id = await session(other, 'ignite')
  await complete(id,other,phase,8,'dizzy')
  await complete(id,other,phase,8,'dizzy')
  expect((await db.query('SELECT user_id,variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1',[other])).rows)
    .toEqual([{ user_id: other, variant: 'ignite' }])
  expect((await db.query('SELECT stopped_reason FROM mukti.aurora_sessions WHERE id=$1',[id])).rows[0]).toEqual({ stopped_reason: 'dizzy' })
  await db.query("DELETE FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1 AND variant='ignite'",[other])
  const replay = (await complete(id,other,phase,8,'dizzy')).rows[0].result
  expect(replay.already).toBe(true)
  expect((await db.query('SELECT variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1',[other])).rows).toEqual([])
})

it('atomically saves feedback and removes the variant from suggestions until explicit resumption', async () => {
  const id = await session(owner, 'focus', 1)
  const record = () => db.query("SELECT mukti.record_aurora_feedback($1,$2,'immediate','worse',false) r",[owner,id])
  await record(); await record()
  expect((await db.query('SELECT id FROM mukti.aurora_feedback WHERE session_id=$1',[id])).rows).toHaveLength(1)
  expect((await db.query('SELECT variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1',[owner])).rows).toEqual([{ variant: 'focus' }])
  await expect(db.query("SELECT mukti.record_aurora_feedback($1,$2,'later','same',false)",[owner,id])).rejects.toMatchObject({ code: '22023' })
  await db.query('DELETE FROM mukti.aurora_feedback WHERE user_id=$1',[owner])
  expect((await db.query('SELECT variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1',[owner])).rows).toHaveLength(1)
  await db.query("DELETE FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1 AND variant='focus'",[owner])
  expect((await db.query('SELECT variant FROM mukti.wellbeing_suggestion_pauses WHERE user_id=$1',[owner])).rows).toHaveLength(0)
})

it('accepts a delayed report only for its owner and keeps non-response unknown', async () => {
  const id = await session(owner, 'sleep', 6)
  await expect(db.query("SELECT mukti.record_aurora_feedback($1,$2,'later','better',false)",[other,id])).rejects.toMatchObject({ code: 'P0002' })
  await expect(db.query("SELECT mukti.record_aurora_feedback($1,$2,'immediate','better',false)",[owner,id])).rejects.toMatchObject({ code: '22023' })
  await db.query("SELECT mukti.record_aurora_feedback($1,$2,'later','unsure',false)",[owner,id])
  expect((await db.query('SELECT stage,feeling FROM mukti.aurora_feedback WHERE session_id=$1',[id])).rows).toEqual([{ stage: 'later', feeling: 'unsure' }])
  await role('authenticated',authB)
  expect((await db.query('SELECT id FROM mukti.aurora_feedback')).rows).toEqual([])
})
