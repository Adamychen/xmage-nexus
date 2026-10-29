import type { ChatMessageEvent } from '../net/types'

export interface ReadyMarker {
  ready: boolean
  user?: string
}

export function parseReadyMarker(text: string): ReadyMarker | null {
  const match = /^\s*\[\s*NEXUS_(NOT_)?READY\s*\]\s*(.*)$/i.exec(text)
  if (!match) return null
  const user = match[2].trim()
  return { ready: !match[1], user: user || undefined }
}

function readyMarkerOf(m: ChatMessageEvent): ReadyMarker | null {
  const marker = parseReadyMarker(m.message ?? '')
  if (!marker) return null
  if (marker.user && m.username && marker.user.toLowerCase() !== m.username.toLowerCase()) return null
  return marker
}

export function isSystemMessage(m: ChatMessageEvent): boolean {
  if (!m.username || m.username === 'server' || m.messageType === 'SYSTEM' || m.messageType === 'STATUS') return true
  return !!readyMarkerOf(m)
}
