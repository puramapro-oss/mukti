// MUKTI — G6 C.O.R.E. Events types
import type { CoreFormat, CoreCategory, CorePhase, CoreSessionKind, CoreProtocolId } from './constants'

export interface CoreEvent {
  id: string
  format: CoreFormat
  category: CoreCategory
  severity: number
  title_fr: string
  title_en: string
  intention_fr: string
  intention_en: string
  region: string | null
  moment_z_at: string
  ar_protocol_id: string | null
  source: 'community' | 'world_radar' | 'super_admin'
  confidence: number | null
  status: 'draft' | 'scheduled' | 'live' | 'finished' | 'rejected'
  created_by: string | null
  ai_pack: Record<string, unknown> | null
  auto_published: boolean
  moderated_at: string | null
  moderated_by: string | null
  participants_count: number
  created_at: string
  updated_at: string
}

export interface CoreEventSession {
  id: string
  event_id: string
  kind: CoreSessionKind
  current_phase: CorePhase | 'finished'
  phase_started_at: string
  scheduled_at: string
  finished_at: string | null
  protocol_id: string | null
  created_at: string
  updated_at: string
}

export interface CoreEventParticipant {
  event_id: string
  user_id: string
  joined_at: string
  left_at: string | null
  ar_synced: boolean
  pulse_count: number
}

export interface CreateEventInput {
  format: CoreFormat
  category: CoreCategory
  severity: number
  title_fr: string
  title_en: string
  intention_fr: string
  intention_en: string
  region?: string | null
  moment_z_at: string
  ar_protocol_id?: CoreProtocolId | null
}
