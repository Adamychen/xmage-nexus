import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PlayerView } from '../net/types'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { cardNodesIn } from './cardNodes'
import { boardWipeDelay } from './boardWipe'

export const DISSOLVE_MS = 300
export const DISSOLVE_GHOST_TAIL_MS = 100
export const DISSOLVE_CLASS = 'card-dissolve-ghost'

const GHOST_DROP_ATTRIBUTES = ['id', 'role', 'tabindex', 'aria-label', 'data-card-id', 'data-card-name', 'data-pt', 'data-tapped']
const GHOST_DROP_CLASSES = ['entering', 'flight-hidden', 'flight-land', 'clickable']

interface Box {
  cx: number
  cy: number
  width: number
  height: number
  transform: string
}

export interface DissolveContext {
  players?: ReadonlyArray<PlayerView>
  gameCycle?: number
}

interface Snapshot {
  gameId: string | null
  playerId: string
  host: HTMLElement | null
  gameCycle: number | undefined
  cards: Map<string, { node: HTMLElement; box: Box }>
}

type Ghosts = Map<HTMLElement, ReturnType<typeof setTimeout>>

function captureBox(node: HTMLElement): Box {
  const rect = node.getBoundingClientRect()
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
    width: node.offsetWidth,
    height: node.offsetHeight,
    transform: node.dataset.tapped === '1' ? getComputedStyle(node).transform : 'none',
  }
}

function hostOf(scopes: ReadonlyArray<HTMLElement | null>): HTMLElement | null {
  for (const scope of scopes) {
    const shell = scope?.closest<HTMLElement>('.board-shell')
    if (shell) return shell
  }
  return null
}

function spawnGhost(node: HTMLElement, box: Box, host: HTMLElement | null, ghosts: Ghosts, delayMs = 0): void {
  const ghost = node.cloneNode(true) as HTMLElement
  for (const attr of GHOST_DROP_ATTRIBUTES) ghost.removeAttribute(attr)
  ghost.classList.remove(...GHOST_DROP_CLASSES)
  ghost.classList.add(DISSOLVE_CLASS)
  ghost.setAttribute('aria-hidden', 'true')
  ghost.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    img.alt = ''
  })
  ghost.querySelectorAll('.kw-aura-flare').forEach((flare) => flare.remove())
  ghost.querySelectorAll('.kw-gained').forEach((coin) => coin.classList.remove('kw-gained'))

  const inHost = host?.isConnected === true
  const origin = inHost ? host.getBoundingClientRect() : null
  const left = inHost && origin && host
    ? box.cx - box.width / 2 - origin.left - host.clientLeft + host.scrollLeft
    : box.cx - box.width / 2
  const top = inHost && origin && host
    ? box.cy - box.height / 2 - origin.top - host.clientTop + host.scrollTop
    : box.cy - box.height / 2
  ghost.style.position = inHost ? 'absolute' : 'fixed'
  ghost.style.left = `${left}px`
  ghost.style.top = `${top}px`
  ghost.style.width = `${box.width}px`
  ghost.style.height = `${box.height}px`
  ghost.style.setProperty('--card-w', `${box.width}px`)
  ghost.style.transform = box.transform
  if (delayMs > 0) ghost.style.animationDelay = `${delayMs}ms`
  ;(inHost && host ? host : document.body).appendChild(ghost)

  const remove = () => {
    const timer = ghosts.get(ghost)
    if (timer !== undefined) clearTimeout(timer)
    ghosts.delete(ghost)
    ghost.remove()
  }
  ghost.addEventListener('animationend', (event) => {
    if (event.target === ghost) remove()
  })
  ghosts.set(ghost, setTimeout(remove, delayMs + fxMotionDuration(DISSOLVE_MS) + DISSOLVE_GHOST_TAIL_MS))
}

export function useBattlefieldDissolve(
  scopes: ReadonlyArray<HTMLElement | null>,
  gameId: string | null,
  player: PlayerView | undefined,
  context?: DissolveContext,
): void {
  const snapshotRef = useRef<Snapshot | null>(null)
  const ghostsRef = useRef<Ghosts>(new Map())
  const players = context?.players
  const gameCycle = context?.gameCycle

  useEffect(() => {
    const ghosts = ghostsRef.current
    return () => {
      ghosts.forEach((timer, ghost) => {
        clearTimeout(timer)
        ghost.remove()
      })
      ghosts.clear()
    }
  }, [])

  useLayoutEffect(() => {
    if (!player) {
      snapshotRef.current = null
      return
    }
    const allowed = fxMotionAllowed()
    const prev = snapshotRef.current
    const battlefield = player.battlefield ?? {}
    const onField = new Set(Object.keys(battlefield))

    const rolledBack = prev?.gameCycle !== undefined && gameCycle !== undefined && gameCycle < prev.gameCycle
    if (prev && allowed && !rolledBack && prev.gameId === gameId && prev.playerId === player.playerId) {
      const zonePlayers = players ?? [player]
      const toZone = new Set(zonePlayers.flatMap((p) => [...Object.keys(p.graveyard ?? {}), ...Object.keys(p.exile ?? {})]))
      for (const [id, entry] of prev.cards) {
        if (!onField.has(id) && toZone.has(id)) spawnGhost(entry.node, entry.box, prev.host, ghostsRef.current, boardWipeDelay(id))
      }
    }

    if (!allowed) {
      snapshotRef.current = null
      return
    }
    const cards = new Map<string, { node: HTMLElement; box: Box }>()
    for (const [id, node] of cardNodesIn(scopes)) {
      if (onField.has(id)) cards.set(id, { node, box: captureBox(node) })
    }
    snapshotRef.current = { gameId, playerId: player.playerId, host: hostOf(scopes), gameCycle, cards }
  }, [player, gameId, players, gameCycle, scopes])
}
