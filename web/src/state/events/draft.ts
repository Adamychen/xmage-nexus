import { getState, setState, addLog } from '../state'
import * as cmds from '../../net/commands'
import { translateError } from '../../i18n'
import type { DraftClientMessage } from '../../net/types.generated'
import type { DraftState } from '../slices'

export function handleStartDraft(objectId: string | null, data: unknown): void {
  setState({ draftOverAt: null, lastDraftEventAt: Date.now() })
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Draft iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
  const draftId = objectId
  if (!draftId) return
  const s = getState()
  const username = s.conn?.username?.toLowerCase()
  if (!username) return
  const seated = (s.lobby?.tables ?? []).some(
    (tb) =>
      (!d?.currentTableId || tb.tableId === d.currentTableId) &&
      (tb.seats ?? []).some(
        (seat) => (seat.playerName ?? '').toLowerCase() === username && (!seat.playerType || seat.playerType === 'HUMAN'),
      ),
  )
  if (!seated) return
  addLog('torneo', 'Uniéndose al draft…')
  void (cmds.joinDraft(draftId) as Promise<{ ok?: boolean; error?: string; errorCode?: string }>).then(
    (res) => {
      if (!res?.ok) {
        setState({ error: translateError(res?.error || res?.errorCode || 'FAILED', 'joinDraft', res?.errorCode) })
      }
    },
    () => {
      setState({ error: translateError('FAILED', 'joinDraft') })
    },
  )
}

type LoosePickView = {
  booster?: Record<string, unknown>
  picks?: Record<string, unknown>
}

/** El CONSTRUCT llega segundos después del DRAFT_OVER; si no, el torneo se cuñó en el servidor. */
export const DRAFT_OVER_WATCHDOG_MS = 30000

/** En draft activo siempre hay un pick pendiente (timeout ≤113s+buffer): sin eventos, cuña. */
export const DRAFT_STALL_MS = 150000

export function isDraftStalled(
  lastEventAt: number | null | undefined,
  hasActiveDraft: boolean,
  now: number = Date.now(),
): boolean {
  return hasActiveDraft && lastEventAt != null && now - lastEventAt >= DRAFT_STALL_MS
}

export function isConstructStalled(
  draftOverAt: number | null | undefined,
  hasConstruct: boolean,
  now: number = Date.now(),
): boolean {
  return draftOverAt != null && !hasConstruct && now - draftOverAt >= DRAFT_OVER_WATCHDOG_MS
}

export function mergeDraftMessage(
  prev: { draftId: string; message: DraftClientMessage } | null,
  objectId: string | null,
  msg: DraftClientMessage,
  method?: string,
): { draftId: string; message: DraftClientMessage } {
  const draftId = objectId ?? prev?.draftId ?? 'draft'
  const sameDraft = !prev || prev.draftId === draftId
  const prevPick = (sameDraft ? prev?.message.draftPickView : undefined) as LoosePickView | undefined
  const prevBoosterNum = sameDraft ? prev?.message.draftView?.boosterNum : undefined
  const incoming = msg.draftPickView as LoosePickView | undefined
  const incomingBooster = incoming?.booster
  const incomingPicks = incoming?.picks
  const packChanged = prevBoosterNum !== undefined && msg.draftView.boosterNum !== prevBoosterNum
  const hasFreshBooster = incomingBooster != null && Object.keys(incomingBooster).length > 0
  const booster =
    hasFreshBooster || packChanged || !prevPick ? (incomingBooster ?? {}) : (prevPick.booster ?? {})
  const picks = { ...(prevPick?.picks ?? {}), ...(incomingPicks ?? {}) }
  const merged = incoming
    ? { ...incoming, booster, picks }
    : prevPick
      ? { ...prevPick, booster, picks }
      : undefined
  // DRAFT_UPDATE sin pickView = el sobre ya rotó/pasó: ese jugador no está
  // eligiendo. Sin esto, un `picking` viejo (p.ej. de un autopick, que no
  // genera respuesta) deja la UI en "tu turno" con el contador corriendo.
  const draftPickView =
    merged && method === 'DRAFT_UPDATE' && !incoming ? { ...merged, picking: false } : merged
  return {
    draftId,
    message: {
      ...msg,
      draftPickView,
    } as DraftClientMessage,
  }
}

/**
 * Aplica la respuesta de `sendCardPick` (el proxy devuelve el `DraftPickView`
 * de después del pick: `{booster, picks, picking:false, timeout:0}`), igual que
 * hace el cliente de escritorio. Solo si el pick sigue vigente —mismo draft y
 * mismo sobre/carta que al enviarlo—: si durante el round-trip llegó el
 * siguiente DRAFT_PICK, la respuesta es obsoleta y se descarta para no pisarlo.
 */
export function mergePickAck(
  prev: DraftState | null,
  draftId: string,
  pickView: unknown,
  sent: { boosterNum: number; cardNum: number },
): DraftState | null {
  if (!prev || prev.draftId !== draftId) return null
  if (prev.message.draftView.boosterNum !== sent.boosterNum) return null
  if (prev.message.draftView.cardNum !== sent.cardNum) return null
  const incoming = pickView as (LoosePickView & { picking?: unknown; timeout?: unknown }) | null | undefined
  if (!incoming || typeof incoming.picking !== 'boolean') return null
  const prevPick = prev.message.draftPickView as
    | (LoosePickView & { picking?: boolean; timeout?: number })
    | undefined
  const booster = incoming.booster != null ? incoming.booster : (prevPick?.booster ?? {})
  const picks =
    incoming.picks != null ? { ...(prevPick?.picks ?? {}), ...incoming.picks } : (prevPick?.picks ?? {})
  return {
    ...prev,
    message: {
      ...prev.message,
      draftPickView: {
        booster,
        picks,
        picking: incoming.picking,
        timeout: typeof incoming.timeout === 'number' ? incoming.timeout : 0,
      },
    } as DraftClientMessage,
  }
}

export function handleDraftUpdate(method: string, objectId: string | null, data: unknown): void {
  const msg = data as DraftClientMessage | null
  if (!msg?.draftView) return
  setState({ draft: mergeDraftMessage(getState().draft, objectId, msg, method), lastDraftEventAt: Date.now(), lastDraftMethod: method })
  if (method === 'DRAFT_INIT') addLog('torneo', `Draft: booster ${msg.draftView.boosterNum} carta ${msg.draftView.cardNum} — ${msg.draftView.setCodes.join(', ')}`)
  else if (method === 'DRAFT_PICK' && msg.draftPickView?.picking) addLog('torneo', `Tu turno de draftear — timeout ${msg.draftPickView.timeout}s`)
}

export function handleDraftOver(objectId: string | null): void {
  const picks = (getState().draft?.message.draftPickView as { picks?: Record<string, unknown> } | undefined)?.picks
  const n = picks ? Object.keys(picks).length : 0
  addLog('torneo', n > 0 ? `Draft terminado con ${n} cartas — construye tu mazo de 40+` : 'Draft terminado — pasa a construcción')
  setState({ draft: null, draftOverAt: Date.now(), lastDraftEventAt: null, lastDraftMethod: null })
  void objectId
}

export function handleConstruct(data: unknown, objectId: string | null): void {
  const d = data as { deck?: { name?: string; cards?: Record<string, unknown>; sideboard?: Record<string, unknown> }; currentTableId?: string; parentTableId?: string; time?: number } | null
  const tableId = d?.currentTableId ?? objectId ?? ''
  if (!tableId) return
  const deckName = d?.deck?.name ?? 'Pool'
  // El servidor manda lo drafteado en `sideboard` (cards vacío): el pool es la unión.
  const pool = { ...(d?.deck?.sideboard ?? {}), ...(d?.deck?.cards ?? {}) } as Record<string, unknown>
  const time = d?.time ?? 600
  setState({ construct: { deckName, pool, tableId, parentTableId: d?.parentTableId ?? null, timeLeft: time } })
  setState({ draft: null, draftOverAt: null, lastDraftEventAt: null, lastDraftMethod: null })
  addLog('torneo', `Construcción: pool ${Object.keys(pool).length} cartas — ${time}s`)
}
