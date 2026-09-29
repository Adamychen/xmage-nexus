import { useState } from 'react'
import CardGrid from './CardGrid'
import LibraryOrderDialog from './LibraryOrderDialog'
import MulliganDialog from './MulliganDialog'
import PileDialog from './PileDialog'
import TriggerOrderDialog from './TriggerOrderDialog'
import VotingDialog from './VotingDialog'
import PlaneswalkerAbilityDialog from './PlaneswalkerAbilityDialog'
import { useFeedbackForm, type UseFeedbackForm } from './useFeedbackForm'
import { useStore } from '../state/store'
import { handPickIds, isPlainBooleanAsk } from './handPick'
import type { FeedbackPrompt } from './feedback'
import StartingPlayerDialog from './feedbackModes/StartingPlayerDialog'
import TargetBar from './feedbackModes/TargetBar'
import ManaBar from './feedbackModes/ManaBar'
import CombatBar from './feedbackModes/CombatBar'
import AskBar from './feedbackModes/AskBar'
import GenericDialog from './feedbackModes/GenericDialog'

export default function FeedbackDialog() {
  const form = useFeedbackForm()
  const { prompt } = form
  const myHand = useStore((s) => s.game?.myHand)
  const [expandedPrompt, setExpandedPrompt] = useState<FeedbackPrompt | null>(null)

  if (!prompt) return null

  const forceGrid = expandedPrompt === prompt
  const handPick = !forceGrid && myHand ? handPickIds(prompt, new Set(Object.keys(myHand))) : null

  return (
    <>
      {/* P2: marcador para el comprobador de fidelidad (prompt pendiente pintado). */}
      <span data-prompt-method={prompt.method} data-prompt-mode={prompt.mode} hidden aria-hidden="true" />
      {renderPrompt(form, handPick !== null, () => setExpandedPrompt(prompt))}
    </>
  )
}

function renderPrompt(form: UseFeedbackForm, handPick: boolean, onExpandHandPick: () => void) {
  const { prompt, selected, setSelected, send, sendNow, cancel, busy } = form

  if (!prompt) return null

  // ── Scry / Surveil / Reorder dialog (GAME_CHOOSE_CARDS_ORDER or mode === 'order')
  if (prompt.mode === 'order' || prompt.method === 'GAME_CHOOSE_CARDS_ORDER') {
    return <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={busy} />
  }

  // ── Mulligan: diálogo dedicado (Keep/Mulligan y London-bottom)
  if (prompt.isMulligan || prompt.isMulliganLondon) {
    return <MulliganDialog prompt={prompt} send={send} cancel={cancel} busy={busy} />
  }

  // ── Voting: diálogo dedicado
  if (prompt.isVoting) {
    return <VotingDialog prompt={prompt} send={send} busy={busy} />
  }

  // ── Planeswalker: diálogo dedicado
  if (prompt.isPlaneswalkerAbility) {
    return <PlaneswalkerAbilityDialog prompt={prompt} send={send} busy={busy} />
  }

  // ── Decisión de quién empieza: diálogo dedicado
  if (prompt.isStartingPlayer && prompt.method !== 'GAME_TARGET') {
    return <StartingPlayerDialog form={form} />
  }

  // ── Trigger order: diálogo dedicado (GAME_TARGET PICK_ABILITY)
  if (prompt.isTriggerOrder) {
    return <TriggerOrderDialog prompt={prompt} send={send} sendNow={sendNow} busy={busy} />
  }

  // ── GAME_TARGET con cardsView1: grid de cartas (tutores, scry, descarte, etc.)
  const hasCardGrid = prompt.cards && prompt.cards.length > 0
  if (prompt.method === 'GAME_TARGET' && hasCardGrid) {
    // Pick de cartas de la propia mano (p. ej. descarte): la mano ya está
    // pintada y es clickable, así que se resuelve en la barra sin tapar el
    // tablero; el grid queda como salida explícita (botón ampliar).
    if (handPick) {
      return <TargetBar form={form} onExpand={onExpandHandPick} />
    }
    return <CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} busy={busy} />
  }

  // ── Selección de cartas (tutores, buscar en biblioteca, revelar mano): grid HD
  if ((prompt.method === 'GAME_CHOOSE_CARDS' || prompt.method === 'GAME_SELECT_CARDS' || prompt.method === 'GAME_SELECT_TARGETS') && hasCardGrid) {
    return <CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} busy={busy} />
  }

  // ── GAME_TARGET sin cardsView1: barra flotante no-modal
  if (prompt.method === 'GAME_TARGET') {
    return <TargetBar form={form} />
  }

  // ── GAME_PLAY_MANA: barra flotante no-modal (el tablero maneja los clicks a las tierras)
  if (prompt.mode === 'mana') {
    return <ManaBar form={form} />
  }

  // ── Declaración de combate: barra flotante no-modal
  if (prompt.mode === 'combat') {
    return <CombatBar form={form} />
  }

  // ── GAME_CHOOSE_PILE con cartas: dos piles visuales lado a lado
  if (prompt.method === 'GAME_CHOOSE_PILE' && prompt.pileCards) {
    return <PileDialog prompt={prompt} send={send} busy={busy} />
  }

  // ── Preguntas Sí/No (pagar vidas, costes opcionales, ward…): barra no-modal
  if (isPlainBooleanAsk(prompt)) {
    return <AskBar form={form} />
  }

  return <GenericDialog form={form} />
}
