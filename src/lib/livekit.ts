// MUKTI — G3 LiveKit SFU (server-side token generation)
// Cloud : cloud.livekit.io — env LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET
// Utilisé quand circle.audio_mode = 'sfu' (max_participants > 8).

import { AccessToken } from 'livekit-server-sdk'
import { livekitRoomName } from './circles'

export interface LiveKitCredentials {
  url: string
  apiKey: string
  apiSecret: string
}

export function getLiveKitCredentials(): LiveKitCredentials | null {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) return null
  return { url, apiKey, apiSecret }
}

export function isLiveKitConfigured(): boolean {
  return getLiveKitCredentials() !== null
}

export interface LiveKitTokenInput {
  circleId: string
  userId: string
  userName: string
  canPublish?: boolean
  canSubscribe?: boolean
  ttlSeconds?: number
}

/**
 * Génère un JWT LiveKit pour un participant d'un cercle.
 * TTL par défaut 2h (suffisant pour la plus longue session prévue).
 */
export async function generateLiveKitToken(input: LiveKitTokenInput): Promise<{ token: string; url: string; roomName: string }> {
  const creds = getLiveKitCredentials()
  if (!creds) {
    throw new Error('MUKTI_LIVEKIT_NOT_CONFIGURED')
  }

  const roomName = livekitRoomName(input.circleId)
  const ttl = input.ttlSeconds ?? 2 * 60 * 60

  const at = new AccessToken(creds.apiKey, creds.apiSecret, {
    identity: input.userId,
    name: input.userName,
    ttl,
  })

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: input.canPublish ?? true,
    canSubscribe: input.canSubscribe ?? true,
    canPublishData: true,
  })

  const token = await at.toJwt()
  return { token, url: creds.url, roomName }
}
