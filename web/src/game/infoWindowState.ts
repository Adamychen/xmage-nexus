import { useEffect, useSyncExternalStore } from 'react'
import { getState, listeners } from '../state/state'
import type { CardView, RevealedView } from '../net/types'

/** The `t(category, key, params)` overload, so this module needs no runtime import of i18n. */
type Translate = (category: string, key: string, params?: Record<string, string | number>) => string

export type InfoWindowKind = 'lookedAt' | 'revealed' | 'companion'

export interface InfoWindow {
  key: string
  kind: InfoWindowKind
  name: string
  cards: Record<string, CardView>
}

export interface InfoWindowState {
  open: InfoWindow[]
  /** Signature of each entry present in the previous view (absent = not in view). */
  seen: Record<string, string>
  /** Companion windows the user closed, by signature. */
  dismissed: Record<string, string>
}

export interface InfoWindowViews {
  lookedAt?: RevealedView[] | null
  revealed?: RevealedView[] | null
  companion?: RevealedView[] | null
}

export const INFO_WINDOW_TITLE_KEY: Record<InfoWindowKind, 'looked_at_window' | 'revealed_window' | 'companion_window'> = {
  lookedAt: 'looked_at_window',
  revealed: 'revealed_window',
  companion: 'companion_window',
}

/** Used when the server sends the group without a name: "Revealed cards", not "Revealed (undefined)". */
const INFO_WINDOW_TITLE_KEY_PLAIN: Record<InfoWindowKind, 'looked_at_window_plain' | 'revealed_window_plain' | 'companion_window_plain'> = {
  lookedAt: 'looked_at_window_plain',
  revealed: 'revealed_window_plain',
  companion: 'companion_window_plain',
}

/**
 * Title of a looked-at / revealed / companion viewer.
 *
 * <p>`RevealedView.name` is not always filled: a group the engine publishes without a name (the
 * mechanics scenario's single revealed card, and the XMage classes themselves declare it
 * nullable) used to render "Reveladas (undefined)" right in the dialog header.
 */
export function infoWindowTitle(t: Translate, kind: InfoWindowKind, name?: string | null): string {
  return name ? t('game', INFO_WINDOW_TITLE_KEY[kind], { name }) : t('game', INFO_WINDOW_TITLE_KEY_PLAIN[kind])
}
export const EMPTY_INFO_WINDOWS: InfoWindowState = { open: [], seen: {}, dismissed: {} }

function sig(cards: Record<string, unknown>): string {
  return Object.keys(cards).sort().join(',')
}

function entries(views: InfoWindowViews): InfoWindow[] {
  const collect = (list: RevealedView[] | null | undefined, kind: InfoWindowKind) =>
    (list ?? []).flatMap((v) => {
      const cards = (v.cards ?? {}) as Record<string, CardView>
      if (Object.keys(cards).length === 0) return []
      return [{ key: `${kind}:${v.name}`, kind, name: v.name, cards }]
    })
  return [
    ...collect(views.lookedAt, 'lookedAt'),
    ...collect(views.revealed, 'revealed'),
    ...collect(views.companion, 'companion'),
  ]
}

/** Folds a new game view into the open info windows. The engine clears
 *  `lookedAt`/`revealed` right after the update that carries them
 *  (`GameImpl.fireUpdatePlayersEvent`), so the prompt that follows (e.g. Jace,
 *  the Mind Sculptor's "Put that card on the bottom?") arrives with them empty:
 *  like the desktop `CardInfoWindowDialog`, those windows open when an entry
 *  appears or changes and stay until the user closes them. Companion windows
 *  mirror the view (the desktop closes them once the companion leaves).
 *
 *  `becamePlayable` carries the ids that just entered `canPlayObjects`: a
 *  companion the user dismissed at game start must resurface when its {3}
 *  becomes payable (the desktop window cannot be closed at all), but closing
 *  it again while it stays playable is respected until the next transition. */
export function foldInfoWindows(
  prev: InfoWindowState,
  views: InfoWindowViews,
  becamePlayable?: ReadonlySet<string>,
): InfoWindowState {
  const current = entries(views)
  const seen: Record<string, string> = {}
  for (const w of current) seen[w.key] = sig(w.cards)

  let open = prev.open.filter((w) => w.kind !== 'companion')
  const dismissed: Record<string, string> = {}
  for (const w of current) {
    const s = seen[w.key]
    if (w.kind === 'companion') {
      const playableAgain = becamePlayable != null
        && Object.keys(w.cards).some((id) => becamePlayable.has(id))
      if (!playableAgain && prev.dismissed[w.key] === s) dismissed[w.key] = s
      else open = [...open, w]
      continue
    }
    if (prev.seen[w.key] === s) {
      open = open.map((o) => (o.key === w.key ? w : o))
      continue
    }
    open = [...open.filter((o) => o.key !== w.key), w]
  }
  return { open, seen, dismissed }
}

export function closeInfoWindow(prev: InfoWindowState, key: string): InfoWindowState {
  const win = prev.open.find((w) => w.key === key)
  if (!win) return prev
  return {
    open: prev.open.filter((w) => w.key !== key),
    seen: prev.seen,
    dismissed: win.kind === 'companion' ? { ...prev.dismissed, [key]: sig(win.cards) } : prev.dismissed,
  }
}

export interface InfoWindowsSnapshot {
  windows: InfoWindowState
  /** A prompt dialog is showing the looked-at/revealed cards inline. */
  claimed: boolean
}

let snapshot: InfoWindowsSnapshot = { windows: EMPTY_INFO_WINDOWS, claimed: false }
let lastGame: unknown
let lastGameId: string | null | undefined
let lastPlayableIds: ReadonlySet<string> = new Set()
let claims = 0
const subscribers = new Set<() => void>()

function sameIds(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}

function publish(next: InfoWindowsSnapshot) {
  snapshot = next
  subscribers.forEach((fn) => fn())
}

function sync() {
  const { game, gameId, playableIds } = getState()
  const currentPlayable = new Set(playableIds ?? [])
  if (game === lastGame && gameId === lastGameId && sameIds(currentPlayable, lastPlayableIds)) return
  const reset = !game || gameId !== lastGameId
  const becamePlayable = new Set<string>()
  for (const id of currentPlayable) if (!lastPlayableIds.has(id)) becamePlayable.add(id)
  lastGame = game
  lastGameId = gameId
  lastPlayableIds = currentPlayable
  publish({
    ...snapshot,
    windows: foldInfoWindows(reset ? EMPTY_INFO_WINDOWS : snapshot.windows, game ?? {}, becamePlayable),
  })
}

listeners.add(sync)

function subscribe(fn: () => void) {
  sync()
  subscribers.add(fn)
  return () => {
    subscribers.delete(fn)
  }
}

export function useInfoWindows(): InfoWindowsSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot)
}

export function dismissInfoWindow(key: string) {
  publish({ ...snapshot, windows: closeInfoWindow(snapshot.windows, key) })
}

/** Shows the looked-at/revealed windows inside the calling prompt dialog
 *  instead of as overlays; they are dismissed once no dialog claims them
 *  (the decision they informed was answered). */
export function useClaimedInfoWindows(): InfoWindow[] {
  const { windows } = useInfoWindows()
  useEffect(() => {
    claims += 1
    if (claims === 1) publish({ ...snapshot, claimed: true })
    return () => {
      claims -= 1
      // Deferred so a StrictMode remount (cleanup + effect) keeps the windows.
      setTimeout(() => {
        if (claims > 0) return
        publish({
          claimed: false,
          windows: { ...snapshot.windows, open: snapshot.windows.open.filter((w) => w.kind === 'companion') },
        })
      }, 0)
    }
  }, [])
  return windows.open.filter((w) => w.kind !== 'companion')
}
