import * as cmds from '../../net/commands'
import { parseFeedback } from '../../game/feedback'
import { findAutoAnswer } from '../../game/autoAnswers'
import { isMulliganAsk, isStartingPlayerMessage, isVotingAsk } from '../../game/feedback/detect'
import { setState, addLog } from '../state'
import { targetFirstId } from '../gameUtils'
import type { Snapshot } from './context'

export function handleGameTarget(method: string, data: unknown, objectId: string | null, s: Snapshot): void {
  const d = data as { message?: string; options?: { targets?: unknown }; gameId?: string } | null
  const question = d?.message ?? ''
  const currentGameId = objectId ?? d?.gameId ?? s.gameId
  const isSpectator = !((s.game?.players ?? []) as { controlled?: boolean }[]).some((p) => p.controlled)
  if ((s.settings.autoKeepMulligan || isSpectator) && /starting player/i.test(question) && currentGameId) {
    const first = targetFirstId(data)
    if (first) {
      void cmds.sendPlayerUUID(first, currentGameId)
      addLog('tú', 'sorteo: elegir jugador inicial (auto)')
      return
    }
  }
  const feedback = parseFeedback(method, currentGameId, data)
  if (feedback) setState({ feedback })
}

export function handleGameAsk(method: string, data: unknown, objectId: string | null, s: Snapshot): void {
  const d = data as { question?: string; message?: string; options?: unknown[]; gameId?: string } | null
  const question = d?.question ?? d?.message ?? ''
  const currentGameId = objectId ?? d?.gameId ?? s.gameId
  const isSpectator = !((s.game?.players ?? []) as { controlled?: boolean }[]).some((p) => p.controlled)
  if ((s.settings.autoKeepMulligan || isSpectator) && /mulligan|keep your hand|keep hand/i.test(question)) {
    if (currentGameId) void cmds.sendPlayerBoolean(false, currentGameId)
    setState({ feedback: null })
    addLog('tú', 'mulligan: mantener (auto)')
  } else if (
    method === 'GAME_ASK' &&
    currentGameId &&
    !isMulliganAsk(question) &&
    !isVotingAsk(question) &&
    !isStartingPlayerMessage(question)
  ) {
    const rule = findAutoAnswer(s.settings.autoAnswers ?? [], question)
    if (rule) {
      void cmds.sendPlayerBoolean(rule.answer, currentGameId)
      setState({ feedback: null })
      addLog('tú', `auto: ${rule.answer ? 'Sí' : 'No'} → ${question}`)
      return
    }
    const feedback = parseFeedback(method, currentGameId, data)
    if (feedback) setState({ feedback })
    addLog('partida', `¿${question || 'pregunta'}?`)
  } else {
    const feedback = parseFeedback(method, currentGameId, data)
    if (feedback) setState({ feedback })
    addLog('partida', `¿${question || 'pregunta'}?`)
  }
}

export function handleUserRequestDialog(data: unknown, objectId: string | null, s: Snapshot): void {
  const d = data as {
    title?: string
    message?: string
    gameId?: string
    relatedUserId?: string
    button1Text?: string
    button1Action?: string
    button2Text?: string
    button2Action?: string
    button3Text?: string
    button3Action?: string
  } | null
  const gameId = objectId ?? d?.gameId ?? s.gameId ?? undefined
  const buttons: { text: string; action: string }[] = []
  if (d?.button1Text && d?.button1Action) buttons.push({ text: d.button1Text, action: d.button1Action })
  if (d?.button2Text && d?.button2Action) buttons.push({ text: d.button2Text, action: d.button2Action })
  if (d?.button3Text && d?.button3Action) buttons.push({ text: d.button3Text, action: d.button3Action })
  const relatedUserId = typeof d?.relatedUserId === 'string' && d.relatedUserId !== '' ? d.relatedUserId : undefined
  setState({ userRequest: { title: d?.title ?? 'Solicitud', message: d?.message ?? '', gameId, relatedUserId, buttons } })
  addLog('partida', `Solicitud del servidor: ${d?.title ?? ''}`)
}
