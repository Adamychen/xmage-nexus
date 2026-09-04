import { setState, addLog } from '../state'
import type { DraftClientMessage } from '../../net/types.generated'

export function handleStartDraft(data: unknown): void {
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Draft iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
}

export function handleDraftUpdate(method: string, objectId: string | null, data: unknown): void {
  const msg = data as DraftClientMessage | null
  if (!msg?.draftView) return
  const draftId = objectId ?? 'draft'
  setState({ draft: { draftId, message: msg } })
  if (method === 'DRAFT_INIT') addLog('torneo', `Draft: booster ${msg.draftView.boosterNum} carta ${msg.draftView.cardNum} — ${msg.draftView.setCodes.join(', ')}`)
  else if (method === 'DRAFT_PICK' && msg.draftPickView?.picking) addLog('torneo', `Tu turno de draftear — timeout ${msg.draftPickView.timeout}s`)
}

export function handleDraftOver(objectId: string | null): void {
  const draftId = objectId ?? ''
  addLog('torneo', 'Draft terminado — pasa a construcción')
  setState({ draft: null })
  void draftId
}

export function handleConstruct(data: unknown, objectId: string | null): void {
  const d = data as { deck?: { name?: string; cards?: Record<string, unknown>; sideboard?: Record<string, unknown> }; currentTableId?: string; parentTableId?: string; time?: number } | null
  const tableId = d?.currentTableId ?? objectId ?? ''
  if (!tableId) return
  const deckName = d?.deck?.name ?? 'Pool'
  const pool = (d?.deck?.cards ?? {}) as Record<string, unknown>
  const time = d?.time ?? 600
  setState({ construct: { deckName, pool, tableId, parentTableId: d?.parentTableId ?? null, timeLeft: time } })
  setState({ draft: null })
  addLog('torneo', `Construcción: pool ${Object.keys(pool).length} cartas — ${time}s`)
}
