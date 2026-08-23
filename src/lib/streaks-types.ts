import type { MilestoneId } from './constants'

export interface Streak {
  id: string
  addiction_id: string
  user_id: string
  started_at: string
  last_checkin_at: string | null
  ended_at: string | null
  current_days: number
  best_days: number
  is_active: boolean
  end_reason: 'relapse' | 'paused' | 'liberated' | null
  created_at: string
}

export interface Relapse {
  id: string
  addiction_id: string
  user_id: string
  streak_id: string | null
  relapsed_at: string
  trigger_note: string | null
  mood_before: number | null
  context_tags: string[]
  streak_reset_from_days: number
  generated_insight: string | null
  insight_model: string | null
  created_at: string
}

export interface StreakState {
  streak: Streak | null
  addiction_id: string
  days_since_declaration: number
  next_milestone: MilestoneId | null
  next_milestone_days_away: number | null
  milestones_achieved: MilestoneId[]
}

export interface MilestoneRow {
  id: string
  user_id: string
  addiction_id: string
  streak_id: string | null
  milestone: MilestoneId
  amount_cents: number
  status: 'pending' | 'credited' | 'locked' | 'unlocked' | 'denied_fraud' | 'denied_score'
  credited_at: string | null
  locked_until: string | null
  unlocked_at: string | null
  trust_score_at_grant: number | null
  fraud_check_passed: boolean | null
}
