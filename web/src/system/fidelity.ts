import { addLog, getState } from '../state/state'
import type { CardsView, GameView, PermanentView } from '../net/types'

export type FidelityCode =
  | 'battlefield-missing'
  | 'painted-unknown'
  | 'stack-order'
  | 'turn-mismatch'
  | 'phase-ambiguous'
  | 'pt-mismatch'
  | 'tapped-mismatch'
  | 'counters-mismatch'
  | 'damage-mismatch'
  | 'life-mismatch'
  | 'controller-side'
  | 'prompt-missing'
  | 'attachments-mismatch'
  | 'hand-mismatch'
  | 'library-mismatch'
  | 'graveyard-mismatch'
  | 'exile-mismatch'

export interface FidelityDiscrepancy {
  code: FidelityCode
  detail: string
}

export interface PaintedCardState {
  ownerId: string | null
  tapped: string | null
  pt: string | null
  damage: string | null
  counters: string | null
  attacking: boolean
  isAttachment: boolean
}

export interface PaintedAttachmentGroup {
  hostId: string
  ids: string[]
  ownerId: string | null
}

export interface PaintedZoneCounts {
  hand: number | null
  library: number | null
  graveyard: number | null
  exile: number | null
}

export interface PaintedSnapshot {
  cardIdsInPaintOrder: string[]
  cardStates: Record<string, PaintedCardState>
  players: { playerId: string; life: string | null }[]
  hasPromptMarker: boolean
  gameStatusText: string | null
  activePhasePills: number
  attachmentGroups: PaintedAttachmentGroup[]
  zoneCounts: Record<string, PaintedZoneCounts>
  myHandCount: number | null
}

export function collectPainted(doc: Document = document): PaintedSnapshot {
  const cardIdsInPaintOrder: string[] = []
  const cardStates: Record<string, PaintedCardState> = {}
  doc.querySelectorAll('[data-card-id]').forEach((node) => {
    const id = node.getAttribute('data-card-id')
    if (!id) return
    cardIdsInPaintOrder.push(id)
    // La última ocurrencia manda: en la pila de mutate las partes (sin badges)
    // se pintan antes que el permanente fusionado, que es el estado canónico.
    const el = node as HTMLElement
    cardStates[id] = {
      ownerId: el.closest('[data-player-id]')?.getAttribute('data-player-id') ?? null,
      tapped: node.getAttribute('data-tapped'),
      pt: node.getAttribute('data-pt'),
      damage: node.getAttribute('data-damage'),
      counters: node.getAttribute('data-counters'),
      attacking: el.classList.contains('attacking'),
      isAttachment: el.classList.contains('attachment-subcard'),
    }
  })
  const players: { playerId: string; life: string | null }[] = []
  doc.querySelectorAll('[data-player-id][data-life]').forEach((node) => {
    const playerId = node.getAttribute('data-player-id')
    if (playerId) players.push({ playerId, life: node.getAttribute('data-life') })
  })

  const zoneCounts: Record<string, PaintedZoneCounts> = {}
  const ensureZone = (playerId: string): PaintedZoneCounts =>
    (zoneCounts[playerId] ??= { hand: null, library: null, graveyard: null, exile: null })
  const numberAttr = (node: Element, attr: string): number | null => {
    const raw = node.getAttribute(attr)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }

  doc.querySelectorAll('.hand-zone[data-hand-count]').forEach((node) => {
    const zone = node.closest('[data-player-id]')
    const playerId = zone?.getAttribute('data-player-id')
    if (!zone || !playerId) return
    if (zone.querySelector('[data-testid="hand-switch-btn"][data-switched]')) return
    const hand = numberAttr(node, 'data-hand-count')
    if (hand != null) ensureZone(playerId).hand = hand
  })
  const handBar = doc.querySelector('[data-testid="hand-bar"][data-hand-count]')
  const myHandCount = handBar ? numberAttr(handBar, 'data-hand-count') : null
  const countAttrs: [string, keyof PaintedZoneCounts][] = [
    ['data-library-count', 'library'],
    ['data-graveyard-count', 'graveyard'],
    ['data-exile-count', 'exile'],
  ]
  for (const [attr, key] of countAttrs) {
    doc.querySelectorAll(`[${attr}]`).forEach((node) => {
      const playerId = node.closest('[data-player-id]')?.getAttribute('data-player-id')
      if (!playerId) return
      const n = numberAttr(node, attr)
      if (n != null) ensureZone(playerId)[key] = n
    })
  }

  const attachmentGroups: PaintedAttachmentGroup[] = []
  doc.querySelectorAll('[data-attachment-host]').forEach((node) => {
    const hostId = node.getAttribute('data-attachment-host')
    if (!hostId) return
    const ids: string[] = []
    node.querySelectorAll('.attachment-subcard[data-card-id]').forEach((el) => {
      const id = el.getAttribute('data-card-id')
      if (id) ids.push(id)
    })
    attachmentGroups.push({
      hostId,
      ids,
      ownerId: node.closest('[data-player-id]')?.getAttribute('data-player-id') ?? null,
    })
  })

  const status = doc.querySelector('[data-testid="game-status"]')
  return {
    cardIdsInPaintOrder,
    cardStates,
    players,
    hasPromptMarker: doc.querySelector('[data-prompt-method]') != null,
    gameStatusText: status?.textContent ?? null,
    activePhasePills: doc.querySelectorAll('.phase-badge.active').length,
    attachmentGroups,
    zoneCounts,
    myHandCount,
  }
}

function keysOf(cv: CardsView | undefined | null): string[] {
  return Object.keys(cv ?? {})
}

function isCreatureLike(perm: PermanentView): boolean {
  const types = (perm.cardTypes ?? []).map((t) => String(t).toLowerCase())
  return types.includes('creature') || String(perm.mageObjectType ?? '').toUpperCase().includes('CREATURE')
}

function countersSignature(perm: PermanentView): string {
  return (perm.counters ?? []).map((c) => `${c.name}:${c.count}`).join('|')
}

function checkPermanent(
  playerId: string,
  id: string,
  perm: PermanentView,
  state: PaintedCardState | undefined,
  out: FidelityDiscrepancy[],
): void {
  if (!state) return
  if (state.isAttachment) {
    if (state.ownerId && state.ownerId !== playerId) {
      out.push({ code: 'controller-side', detail: `${id}: servidor lo asigna a ${playerId} y se pinta en la zona de ${state.ownerId}` })
    }
    return
  }
  if (perm.power != null && perm.toughness != null && isCreatureLike(perm)) {
    const expected = `${perm.power}/${perm.toughness}`
    if (state.pt == null) {
      out.push({ code: 'pt-mismatch', detail: `${id}: sin pastilla P/T (servidor ${expected})` })
    } else if (state.pt !== expected) {
      out.push({ code: 'pt-mismatch', detail: `${id}: servidor ${expected} vs pintado ${state.pt}` })
    }
  }
  if (!state.attacking && state.tapped != null && (state.tapped === '1') !== (perm.tapped === true)) {
    out.push({
      code: 'tapped-mismatch',
      detail: `${id}: servidor ${perm.tapped === true ? 'girado' : 'enderezado'} vs pintado ${state.tapped === '1' ? 'girado' : 'enderezado'}`,
    })
  }
  const expectedCounters = countersSignature(perm)
  if ((state.counters ?? '') !== expectedCounters) {
    out.push({
      code: 'counters-mismatch',
      detail: `${id}: contadores servidor [${expectedCounters}] vs pintado [${state.counters ?? ''}]`,
    })
  }
  const damage = perm.damage ?? 0
  if ((state.damage != null && String(damage) !== state.damage) || (damage > 0 && state.damage == null && isCreatureLike(perm))) {
    out.push({
      code: 'damage-mismatch',
      detail: `${id}: daño servidor ${damage} vs pintado ${state.damage ?? '—'}`,
    })
  }
  if (state.ownerId && state.ownerId !== playerId) {
    out.push({ code: 'controller-side', detail: `${id}: servidor lo asigna a ${playerId} y se pinta en la zona de ${state.ownerId}` })
  }
}

export function checkFidelity(game: GameView, painted: PaintedSnapshot, pendingPrompt = false): FidelityDiscrepancy[] {
  const out: FidelityDiscrepancy[] = []
  const paintedSet = new Set(painted.cardIdsInPaintOrder)

  const expectedBattlefield: { id: string; owner: string }[] = []
  const known = new Set<string>()
  for (const p of game.players ?? []) {
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
      known.add(id)
      if (perm.phasedIn !== false) {
        expectedBattlefield.push({ id, owner: p.name })
        checkPermanent(p.playerId, id, perm, painted.cardStates[id], out)
      }
    }
    for (const cv of [p.graveyard, p.exile, p.sideboard, p.helperCards]) {
      for (const id of keysOf(cv)) known.add(id)
    }
  }
  for (const id of keysOf(game.stack)) known.add(id)
  for (const id of keysOf(game.myHand)) known.add(id)
  for (const id of keysOf(game.myHelperEmblems)) known.add(id)
  for (const hands of [game.opponentHands, game.watchedHands]) {
    for (const hand of Object.values(hands ?? {})) {
      for (const id of keysOf(hand as CardsView)) known.add(id)
    }
  }
  for (const pile of [...(game.exiles ?? []), ...(game.revealed ?? []), ...(game.lookedAt ?? []), ...(game.companion ?? [])]) {
    for (const id of keysOf(pile?.cards)) known.add(id)
  }

  const missing = expectedBattlefield.filter((c) => !paintedSet.has(c.id))
  if (missing.length > 0) {
    out.push({
      code: 'battlefield-missing',
      detail: `servidor lista ${missing.length} permanente(s) sin pintar: ${missing.slice(0, 5).map((c) => `${c.id} (${c.owner})`).join(', ')}`,
    })
  }
  const unknown = painted.cardIdsInPaintOrder.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    out.push({
      code: 'painted-unknown',
      detail: `${unknown.length} carta(s) pintada(s) que el GameView no contiene: ${[...new Set(unknown)].slice(0, 5).join(', ')}`,
    })
  }

  const expectedAttachments = new Map<string, string[]>()
  for (const p of game.players ?? []) {
    for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
      if (perm.phasedIn !== false && (perm.attachments?.length ?? 0) > 0) {
        expectedAttachments.set(id, perm.attachments as string[])
      }
    }
  }
  for (const [hostId, ids] of expectedAttachments) {
    const group = painted.attachmentGroups.find((g) => g.hostId === hostId)
    if (!group) {
      out.push({
        code: 'attachments-mismatch',
        detail: `${hostId}: servidor adjunta [${ids.join(',')}] y no se pinta grupo de adjuntos`,
      })
    } else if (group.ids.join('|') !== ids.join('|')) {
      out.push({
        code: 'attachments-mismatch',
        detail: `${hostId}: adjuntos servidor [${ids.join(',')}] vs pintados [${group.ids.join(',')}]`,
      })
    }
  }
  for (const group of painted.attachmentGroups) {
    if (!expectedAttachments.has(group.hostId)) {
      out.push({
        code: 'attachments-mismatch',
        detail: `${group.hostId}: grupo de adjuntos pintado [${group.ids.join(',')}] sin adjuntos en el servidor`,
      })
    }
  }

  const zonePlayerIds = new Set(Object.keys(painted.zoneCounts))
  if (game.myPlayerId && painted.myHandCount != null) zonePlayerIds.add(game.myPlayerId)
  for (const playerId of zonePlayerIds) {
    const player = (game.players ?? []).find((p) => p.playerId === playerId)
    if (!player) continue
    const counts = painted.zoneCounts[playerId]
    const hand = playerId === game.myPlayerId && painted.myHandCount != null ? painted.myHandCount : counts?.hand ?? null
    if (hand != null && player.handCount != null && hand !== player.handCount) {
      out.push({ code: 'hand-mismatch', detail: `${player.name}: mano servidor ${player.handCount} vs pintada ${hand}` })
    }
    if (counts?.library != null && player.libraryCount != null && counts.library !== player.libraryCount) {
      out.push({ code: 'library-mismatch', detail: `${player.name}: biblioteca servidor ${player.libraryCount} vs pintada ${counts.library}` })
    }
    const graveyardCount = keysOf(player.graveyard).length
    if (counts?.graveyard != null && counts.graveyard !== graveyardCount) {
      out.push({ code: 'graveyard-mismatch', detail: `${player.name}: cementerio servidor ${graveyardCount} vs pintado ${counts.graveyard}` })
    }
    const exileCount = keysOf(player.exile).length
    if (counts?.exile != null && counts.exile !== exileCount) {
      out.push({ code: 'exile-mismatch', detail: `${player.name}: exilio servidor ${exileCount} vs pintado ${counts.exile}` })
    }
  }

  const stackKeys = keysOf(game.stack)
  if (stackKeys.length >= 2) {
    const paintedStack = painted.cardIdsInPaintOrder.filter((id) => stackKeys.includes(id))
    if (paintedStack.join('|') !== stackKeys.join('|')) {
      out.push({
        code: 'stack-order',
        detail: `orden de pila distinto: servidor [${stackKeys.join(',')}] vs pintado [${paintedStack.join(',')}]`,
      })
    }
  }

  for (const row of painted.players) {
    const player = (game.players ?? []).find((p) => p.playerId === row.playerId || p.name === row.playerId)
    if (!player || player.life == null || row.life == null) continue
    if (String(player.life) !== row.life) {
      out.push({ code: 'life-mismatch', detail: `${player.name}: vida servidor ${player.life} vs pintada ${row.life}` })
    }
  }

  if (pendingPrompt && !painted.hasPromptMarker) {
    out.push({ code: 'prompt-missing', detail: 'hay un prompt pendiente y no se pinta diálogo/barra' })
  }

  if (painted.gameStatusText != null && !new RegExp(`\\b${game.turn}\\b`).test(painted.gameStatusText)) {
    out.push({ code: 'turn-mismatch', detail: `game-status no muestra el turno ${game.turn}` })
  }
  if (painted.activePhasePills !== 1) {
    out.push({ code: 'phase-ambiguous', detail: `${painted.activePhasePills} pastillas de fase activas (esperada 1)` })
  }
  return out
}

const FIDELITY_FLAG = 'mage-web-fidelity'

declare global {
  interface Window {
    __mageFidelityRuns?: number
  }
}

export function fidelityRunCount(): number {
  return typeof window !== 'undefined' ? (window.__mageFidelityRuns ?? 0) : 0
}
let reportedSignatures = new Set<string>()
let reportedGameId: string | null = null

export function isFidelityEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(FIDELITY_FLAG) === '1'
  } catch {
    return false
  }
}

function signatureOf(d: FidelityDiscrepancy): string {
  return `${d.code}:${d.detail}`
}

export function maybeRunFidelityCheck(gameId: string | null): void {
  if (!isFidelityEnabled()) return
  const game = getState().game
  if (!game || (gameId && getState().gameId !== gameId)) return
  setTimeout(() => {
    try {
      const st = getState()
      const current = st.game
      if (!current) return
      if (typeof window !== 'undefined') window.__mageFidelityRuns = (window.__mageFidelityRuns ?? 0) + 1
      if (reportedGameId !== st.gameId) {
        reportedGameId = st.gameId
        reportedSignatures = new Set()
      }
      const pendingPrompt = st.phase === 'game' && st.feedback != null
      const fresh = checkFidelity(current, collectPainted(), pendingPrompt)
      const unseen = fresh.filter((d) => !reportedSignatures.has(signatureOf(d)))
      for (const d of unseen) {
        reportedSignatures.add(signatureOf(d))
        addLog('fidelidad', `${d.code}: ${d.detail}`)
      }
    } catch {}
  }, 400)
}
