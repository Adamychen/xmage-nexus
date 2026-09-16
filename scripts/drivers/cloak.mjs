import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — boca abajo §3.8: CLOAK (MKM, mecánica de "cloak a card from your hand").
// Carta: Vannifar, Evolved Enigma ({2}{G}{U}, MKM; .../cards/v/VannifarEvolvedEnigma.java),
// la única del fork con cloak (grep CloakAbility|cloak). Al inicio del combate
// en tu turno: modal "Choose one — * Cloak a card from your hand. * Put a +1/+1
// counter on each colorless creature you control."
//
// Motor (../xmage-fork): VannifarCloakAbility → TargetCardInHand (elegir carta
// de la mano) → ManifestEffect.doManifestCards(..., cloakNotManifest=true) →
// BecomesFaceDownCreatureEffect(..., FaceDownType.CLOAKED): el permanente queda
// 2/2 anónimo con PermanentImpl.cloaked=true (view: `cloaked:true`; morph usa
// `morphed:true`, manifest `manifested:true`, disguise `disguised:true`) y
// recibe la MISMA WardAbility({2}) real + dos InfoEffect que disguise ("Turn
// it face up any time for its disguise/cloaked cost." + recordatorio de ward).
//
// HALLAZGO de protocolo: la elección de MODO de una habilidad modal disparada
// no llega como GAME_CHOOSE_CHOICE sino como GAME_CHOOSE_ABILITY con el
// AbilityPickerView de los modos (GameController.chooseMode →
// AbilityPickerView(gameView, modes, message); choices = {modoUUID: "1. Cloak
// a card from your hand"}); se responde sendPlayerUUID con el UUID del modo.
// La carta de la mano llega como GAME_TARGET normal (TargetCardInHand).
//
// Secuencia: mazo Bant (60 tierras); T1 tierra + UN cheatSetup (Vannifar al
// campo —criatura sin decisión as-enters— + 2 criaturas a la mano; la carta a
// cloakear va a la mano, nunca directa al campo). Se pasa al combate, el
// trigger pide modo (cloak), luego la carta de la mano; al resolver, Grizzly
// Bears entra boca abajo 2/2 con cloaked:true y ward {2} en `rules`.
function makeCloakDriver() {
  return {
    name: 'cloak',
    outFile: 'cloak.json',
    deck: {
      name: 'Mage Web cloak rec',
      cards: [
        { cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 20 },
        { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 20 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 20 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (y "≥1 acción normal" de la regla P1 del cheat).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Vannifar al campo + Grizzly Bears/Elite Vanguard a la mano)')
        void ctx.cheatSetup({
          battlefield: ['Vannifar, Evolved Enigma'],
          hand: ['Grizzly Bears', 'Elite Vanguard'],
        }).then((r) => {
          if (!r?.ok) this._cheated = false
        })
        return
      }
      // Nada más: pasar al combate dispara el trigger modal de Vannifar.
      ctx.pass()
    },
    // Modo del trigger modal = GAME_CHOOSE_ABILITY (AbilityPickerView), no
    // GAME_CHOOSE_CHOICE. Se responde el UUID del modo "1. Cloak a card from
    // your hand" (sendPlayerUUID lo hace rec-lib).
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility cloak:', JSON.stringify(opts).slice(0, 400))
      const cloak = (opts ?? []).find((o) => /cloak/i.test(String(o?.label ?? '')))
      if (cloak) {
        ctx.log('onChooseAbility: elijo modo cloak')
        return cloak.value ?? cloak.id
      }
      return (opts ?? [])[0]?.value
    },
    // Salvaguarda (igual que disguise/manifest): "Look at …" → false.
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) return false
      return undefined
    },
    // TargetCardInHand del cloak: elegir la criatura de la mano por nombre; si
    // el mensaje no casara, cae al primer id de la mano presente en
    // data.targets (nunca a un permanente del campo). El descarte de limpieza
    // se responde con una carta de la mano.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
      const handIds = Object.keys(hand)
      if (/discard/i.test(q)) {
        if (handIds.length > 0) return handIds[0]
        return false
      }
      const grizzly = ctx.cardInHand('Grizzly Bears')
      if (grizzly) return grizzly
      const ids = Array.isArray(data?.targets) ? data.targets : Object.keys(data?.targets ?? {})
      const fromHand = ids.find((id) => handIds.includes(String(id)))
      if (fromHand) return fromHand
      return undefined
    },
    // Invariante: permanente propio boca abajo con el flag específico de cloak
    // (`cloaked:true`, name "Cloak: …", imageFileName "Cloak") y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const cloaked = Object.values(me?.battlefield ?? {}).some(
        (c) => c?.faceDown === true && c?.cloaked === true,
      )
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return cloaked && stackEmpty
    },
  }
}

export const drivers = { cloak: makeCloakDriver }

export const meta = {
  mechanic: 'cloak',
  file: 'cloak.json',
  kind: 'game',
  assert: 'hasCloak',
  note: 'Vannifar, Evolved Enigma ({2}{G}{U}, MKM; cheatSetup al campo + Grizzly Bears/Elite Vanguard a la mano): al inicio del combate su trigger modal pide modo — HALLAZGO: llega como GAME_CHOOSE_ABILITY (AbilityPickerView de GameController.chooseMode: choices {uuid:"1. Cloak a card from your hand."} / "2. Put a +1/+1 counter on each colorless creature you control." / "Cancel"), NO como GAME_CHOOSE_CHOICE; se responde sendPlayerUUID — y luego la carta de la mano como GAME_TARGET con message "Select a card", options.targetZone HAND y secondMessage "Vannifar, Evolved Enigma" (TargetCardInHand). Al resolver, ManifestEffect.doManifestCards(cloakNotManifest=true) aplica BecomesFaceDownCreatureEffect/FaceDownType.CLOAKED: el permanente entra 2/2 anónimo con `cloaked:true` (morph usa morphed:true, disguise disguised:true, manifest manifested:true), name "Cloak: Grizzly Bears", imageFileName "Cloak", manaValue 0 y ward {2} solo en `rules` ("A face-down creature that was cloaked or cast with disguise has ward {2}…"), cardIcons vacío. Captura: permanente propio faceDown+cloaked (turn 1 COMBAT) y pila vacía. Driver cloak con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCloakDriver())
}
