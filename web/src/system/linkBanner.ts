import type { LinkStatus } from '../state/slices/session'

export type LinkBannerKey = 'reconnecting' | 'relogging' | 'relogin_retry' | 'server_link_lost'

/** Banner shown while the session is not healthy (null when it is). */
export function linkBanner(s: {
  connecting: boolean
  wsAlive: boolean
  link: LinkStatus
  linkAttempt: number
}): { key: LinkBannerKey; n: number } | null {
  if ((s.connecting && !s.wsAlive) || s.link === 'ws-down') return { key: 'reconnecting', n: 0 }
  if (s.link === 'relogging') return { key: 'relogging', n: 0 }
  if (s.link === 'relogin-retry') return { key: 'relogin_retry', n: s.linkAttempt }
  if (s.link === 'server-lost') return { key: 'server_link_lost', n: s.linkAttempt }
  return null
}
