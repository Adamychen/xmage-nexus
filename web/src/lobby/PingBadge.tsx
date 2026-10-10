import './PingBadge.css'
import { useTranslation } from '../i18n'

export interface PingBadgeProps {
  infoPing?: string | null
  compact?: boolean
  showText?: boolean
  className?: string
}

export type PingStatus = 'good' | 'medium' | 'slow' | 'disconnected' | 'unknown'

export interface PingInfo {
  /** Round trip of the last probe of that player's client, null when unmeasured. */
  ms: number | null
  /** Moving average over the last probes of that client, null when unmeasured. */
  avg: number | null
  status: PingStatus
  label: string
}

function readMs(re: RegExp, text: string): number | null {
  const match = text.match(re)
  return match ? parseInt(match[1], 10) : null
}

/**
 * Reads the `infoPing` of a `UsersView`, which the server builds as
 * `User.getPingInfo()` = `pingInfo + " " + connectionDuration`, e.g.
 * `"42ms (avg: 40ms)  (online: 3:02; seen: 9 sec ago)"`, `" (discon. 2m)"` or
 * `" Offline"`.
 *
 * Both numbers are self-reported: `pingInfo` is whatever that player's own
 * client measured and sent through `MageServer.ping(sessionId, pingInfo)`. A
 * client that sends nothing (the proxy path probes with `null`, which
 * `User.updateLastActivity` ignores) leaves it empty for its whole session, so
 * an absent number means "nobody measured", never "0 ms". Measured on
 * beta.xmage.today: 82 of 84 users carried real ms, the two that did not were
 * connections of this shape.
 */
export function parsePing(infoPing?: string | null, disconnectedLabel = 'Disconnected'): PingInfo {
  const unknown: PingInfo = { ms: null, avg: null, status: 'unknown', label: '—' }
  if (!infoPing || infoPing === '<no ping>') return unknown

  const lower = infoPing.toLowerCase()
  if (lower.includes('discon') || lower.includes('offline')) {
    return { ms: null, avg: null, status: 'disconnected', label: disconnectedLabel }
  }

  // The latency lives in the head, before the first `(`; reading the whole
  // string would take `(avg: …)` for the reading and `(online: …)` for a
  // connection duration.
  const ms = readMs(/(\d+)\s*ms/i, infoPing.split('(')[0])
  if (ms === null) return unknown

  const avg = readMs(/\(avg:\s*<?(\d+)\s*ms/i, infoPing)
  const status: PingStatus = ms < 80 ? 'good' : ms < 200 ? 'medium' : 'slow'
  return { ms, avg, status, label: `${ms}ms` }
}

export default function PingBadge({
  infoPing,
  compact = false,
  showText = true,
  className = '',
}: PingBadgeProps) {
  const { t } = useTranslation()
  const { status, label, avg } = parsePing(infoPing, t('lobby', 'ping_disconnected'))

  // Nothing measured means nothing to say. A dash here reads as "0 ms" or as a
  // broken badge, and it is all our own connection could ever show: nobody
  // measures the latency of a browser, only of the proxy that fronts it.
  if (status === 'unknown') return null

  const tooltip =
    status === 'disconnected'
      ? label
      : avg !== null
        ? t('lobby', 'ping_tooltip_avg', { label, avg: `${avg}ms` })
        : t('lobby', 'ping_tooltip', { label })

  return (
    <div
      className={`ping-badge ping-${status} ${compact ? 'ping-compact' : ''} ${className}`}
      title={tooltip}
    >
      <span className="ping-dot" />
      {showText && <span className="ping-text">{label}</span>}
    </div>
  )
}