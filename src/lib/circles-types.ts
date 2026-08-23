import type { CircleCategoryId, CircleGuidanceMode, CircleRotationMode } from './constants'

export type CircleStatus = 'open' | 'live' | 'finished' | 'cancelled'
export type CircleAudioMode = 'mesh' | 'sfu' | 'auto'
export type CircleParticipantRole = 'participant' | 'creator' | 'moderator'

export interface Circle {
  id: string
  creator_id: string
  category: CircleCategoryId
  title: string
  description: string | null
  max_participants: number
  duration_per_person_sec: number
  rotation_mode: CircleRotationMode
  guidance_mode: CircleGuidanceMode
  audio_mode: CircleAudioMode
  selected_phrase_ids: string[]
  livekit_room_name: string | null
  recording_enabled: boolean
  auto_start_when_full: boolean
  scheduled_at: string | null
  started_at: string | null
  finished_at: string | null
  status: CircleStatus
  created_at: string
  updated_at: string
}

export interface CircleParticipant {
  id: string
  circle_id: string
  user_id: string
  role: CircleParticipantRole
  rotation_position: number
  received_focus: boolean
  mic_muted: boolean
  cam_enabled: boolean
  joined_at: string
  left_at: string | null
}

export interface CircleRotation {
  id: string
  circle_id: string
  round_number: number
  focused_user_id: string
  started_at: string
  ended_at: string | null
  planned_duration_sec: number
  actual_duration_sec: number | null
}

export interface CreateCircleInput {
  category: CircleCategoryId
  title: string
  description?: string
  max_participants: number
  duration_per_person_sec?: number
  rotation_mode?: CircleRotationMode
  guidance_mode?: CircleGuidanceMode
  selected_phrase_ids?: string[]
  recording_enabled?: boolean
  auto_start_when_full?: boolean
  scheduled_at?: string | null
}
