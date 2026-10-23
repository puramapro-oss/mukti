"""Regression on a throwaway PostgreSQL database; refuses any non-loopback host.
Only the two real AURORA table definitions are loaded; this is not a full
Supabase/PostgREST/auth integration test. No production credentials are used.
"""
import concurrent.futures
import json
import os
import pathlib
import re
import subprocess
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATION = ROOT / 'migrations/20261023_aurora_atomic_completion.sql'
ROLE = 'service_role'


def sql(text: str, *, role: str | None = None, error: bool = False) -> str:
    assert os.environ.get('PGHOST') in ('127.0.0.1', 'localhost', '::1'), 'Only an isolated loopback PostgreSQL server is allowed'
    assert os.environ.get('PGDATABASE') == 'mukti_regression', 'Refusing an unknown database'
    prefix = f'SET ROLE {role};\n' if role in ('service_role', 'anon', 'authenticated') else ''
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input=prefix + text,
                            text=True, capture_output=True, timeout=30)
    if error:
        if result.returncode == 0:
            raise AssertionError('Expected the database to reject this request')
        return result.stderr
    if result.returncode:
        raise AssertionError(result.stderr)
    return result.stdout.strip()


def literal(value) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def phases(duration: float = 120):
    left = duration
    out = []
    for name, maximum in [('armement', 8), ('double_sigh', 40), ('resonance_core', 240), ('omega_lock', 120), ('glide_out', 60)]:
        length = min(left, maximum)
        out.append({'phase': name, 'duration_sec': length, 'breaths_counted': 1, 'coherence': None})
        left -= length
        if left <= 0:
            break
    assert left <= 0
    return out


def call(session: str, owner: str, duration=120, payload=None, coherence='0.9', reason='user_stop', role=ROLE, error=False):
    data = phases(duration if isinstance(duration, (int, float)) and 0 <= duration <= 468 else 120) if payload is None else payload
    query = f"SELECT mukti.aurora_complete_session_atomic_v1({literal(session)}::uuid,{literal(owner)}::uuid,{literal(json.dumps(data))}::jsonb,{coherence}::double precision,{literal(reason)},{duration}::double precision);"
    output = sql(query, role=role, error=error)
    return output if error else json.loads(output)


class AtomicCompletion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema = (ROOT / 'migrations/0007_g5_aurora_reprogramming.sql').read_text()
        definitions = re.findall(r'CREATE TABLE IF NOT EXISTS mukti\.aurora_(?:sessions|streaks) \(.*?\n\);', schema, re.S)
        assert len(definitions) == 2
        sql("""CREATE SCHEMA IF NOT EXISTS mukti;
          CREATE TABLE IF NOT EXISTS mukti.profiles(id uuid PRIMARY KEY);
          DO $$ BEGIN
            IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role BYPASSRLS; END IF;
            IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
            IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
          END $$;""" + '\n'.join(definitions) + """
          GRANT USAGE ON SCHEMA mukti TO service_role,anon,authenticated;
          GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA mukti TO service_role;
          ALTER TABLE mukti.aurora_sessions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE mukti.aurora_streaks ENABLE ROW LEVEL SECURITY;
          """)
        sql(MIGRATION.read_text())
        sql(MIGRATION.read_text())  # Reapplication must be safe.
        print('PostgreSQL version:', sql('SELECT version();'))

    def setUp(self):
        self.user = str(uuid.uuid4())
        sql(f'INSERT INTO mukti.profiles VALUES ({literal(self.user)});')
        self.session = self.new_session()

    def new_session(self):
        sid = str(uuid.uuid4())
        sql(f"INSERT INTO mukti.aurora_sessions(id,user_id,variant) VALUES ({literal(sid)},{literal(self.user)},'calm');")
        return sid

    def progression(self):
        result = sql(f'SELECT row_to_json(s) FROM mukti.aurora_streaks s WHERE user_id={literal(self.user)};')
        return json.loads(result) if result else None

    def completed(self, sid=None):
        return sql(f'SELECT completed_at IS NOT NULL FROM mukti.aurora_sessions WHERE id={literal(sid or self.session)};') == 't'

    def test_success_updates_both_tables(self):
        result = call(self.session, self.user)
        self.assertTrue(result['ok'])
        self.assertTrue(self.completed())
        state = self.progression()
        self.assertEqual((state['total_sessions'], state['total_minutes'], state['current_days']), (1, 2, 1))
        self.assertEqual(result['level_reached'], 'brume')

    def test_missing_progression_is_created_only_for_owned_session(self):
        self.assertIsNone(self.progression())
        self.assertFalse(call(self.session, str(uuid.uuid4()))['ok'])
        self.assertIsNone(self.progression())
        self.assertFalse(self.completed())
        self.assertTrue(call(self.session, self.user)['ok'])

    def test_unknown_session_does_not_create_progression(self):
        self.assertFalse(call(str(uuid.uuid4()), self.user)['ok'])
        self.assertIsNone(self.progression())

    def test_duplicate_completion_does_not_increment(self):
        self.assertTrue(call(self.session, self.user)['ok'])
        self.assertFalse(call(self.session, self.user)['ok'])
        self.assertEqual(self.progression()['total_sessions'], 1)

    def test_concurrent_completion_of_same_session_is_counted_once(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: call(self.session, self.user), range(8)))
        self.assertEqual(sum(r['ok'] for r in results), 1)
        self.assertEqual(self.progression()['total_sessions'], 1)

    def test_concurrent_distinct_sessions_preserve_every_increment(self):
        ids = [self.session] + [self.new_session() for _ in range(15)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda sid: call(sid, self.user), ids))
        self.assertTrue(all(r['ok'] for r in results))
        state = self.progression()
        self.assertEqual(state['total_sessions'], 16)
        self.assertEqual(state['total_minutes'], 32)

    def test_failed_progression_write_rolls_back_session_update(self):
        sql(f"INSERT INTO mukti.aurora_streaks(user_id,total_sessions,total_minutes) VALUES ({literal(self.user)},7,14);")
        sql("""CREATE FUNCTION mukti.ci_reject_progression() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'Injected progression failure'; END $$;
          CREATE TRIGGER ci_reject_progression BEFORE UPDATE ON mukti.aurora_streaks
          FOR EACH ROW EXECUTE FUNCTION mukti.ci_reject_progression();""")
        try:
            call(self.session, self.user, error=True)
            self.assertFalse(self.completed())
            self.assertEqual(self.progression()['total_sessions'], 7)
        finally:
            sql('DROP TRIGGER ci_reject_progression ON mukti.aurora_streaks; DROP FUNCTION mukti.ci_reject_progression();')
        self.assertTrue(call(self.session, self.user)['ok'])
        self.assertEqual(self.progression()['total_sessions'], 8)

    def test_existing_history_is_preserved_and_levels_match_thresholds(self):
        constants = (ROOT / 'src/lib/constants/aurora.ts').read_text()
        levels = re.findall(r"id: '([^']+)',\s+name: '[^']+',\s+min_days: (\d+),\s+min_sessions: (\d+)", constants)
        self.assertEqual(len(levels), 4)
        for expected, days_value, count_value in levels[1:]:
            days, count = int(days_value) - 1, int(count_value) - 1
            with self.subTest(level=expected):
                sid = self.new_session()
                sql(f"""INSERT INTO mukti.aurora_streaks(user_id,current_days,best_days,last_session_date,total_sessions,total_minutes)
                    VALUES ({literal(self.user)},{days},{days},(now() AT TIME ZONE 'UTC')::date-1,{count},100)
                    ON CONFLICT(user_id) DO UPDATE SET current_days={days},best_days={days},last_session_date=(now() AT TIME ZONE 'UTC')::date-1,total_sessions={count},total_minutes=100;""")
                result = call(sid, self.user)
                self.assertEqual(result['level_reached'], expected)
                self.assertEqual(self.progression()['total_minutes'], 102)
                self.assertEqual(result['streak_days'], days + 1)

    def test_invalid_inputs_leave_both_tables_unchanged(self):
        cases = [
            {'duration': -1}, {'duration': 1801}, {'duration': 'NULL'}, {'duration': "'NaN'"}, {'duration': "'Infinity'"},
            {'coherence': '-0.1'}, {'coherence': '1.1'}, {'coherence': "'NaN'"}, {'coherence': 'NULL'},
            {'reason': 'invented'}, {'payload': []}, {'payload': {}}, {'payload': [None]},
            {'payload': [dict(phases(120)[0], duration_sec=-1)]},
            {'payload': [dict(phases(120)[0], breaths_counted=1.5)]},
            {'payload': [dict(phases(120)[0], coherence=2)]},
            {'payload': phases(120) + [phases(120)[0]]}, {'payload': phases(100)},
        ]
        for params in cases:
            with self.subTest(params=params):
                call(self.session, self.user, error=True, **params)
                self.assertFalse(self.completed())
                self.assertIsNone(self.progression())

    def test_public_and_authenticated_roles_cannot_execute(self):
        for role in ['anon', 'authenticated']:
            with self.subTest(role=role):
                message = call(self.session, self.user, role=role, error=True)
                self.assertIn('permission denied', message)
        self.assertFalse(self.completed())

    def test_zero_duration_and_rounding_follow_existing_counter_policy(self):
        self.assertTrue(call(self.session, self.user, duration=0)['ok'])
        self.assertEqual(self.progression()['total_minutes'], 0)
        self.assertEqual(self.progression()['total_sessions'], 1)
        sid = self.new_session()
        self.assertTrue(call(sid, self.user, duration=30)['ok'])
        self.assertEqual(self.progression()['total_minutes'], 1)

    def test_future_progression_date_is_not_silently_reset(self):
        sql(f"INSERT INTO mukti.aurora_streaks(user_id,last_session_date,total_sessions) VALUES ({literal(self.user)},(now() AT TIME ZONE 'UTC')::date+1,9);")
        call(self.session, self.user, error=True)
        self.assertFalse(self.completed())
        self.assertEqual(self.progression()['total_sessions'], 9)

    def test_function_does_not_elevate_privileges_or_use_public_search_path(self):
        result = json.loads(sql("SELECT json_build_object('definer',p.prosecdef,'config',p.proconfig) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='mukti' AND p.proname='aurora_complete_session_atomic_v1';"))
        self.assertFalse(result['definer'])
        self.assertIn('search_path=""', result['config'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
