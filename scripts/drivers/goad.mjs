import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — goad vía spell real (§3.6 fila "Vigilance, goad, 'ataca cada combate'"):
// Disrupt Decorum ({2}{R}{R}, sorcery C17) — "Goad all creatures you don't
// control. Until your next turn, those creatures attack each combat if able
// and attack a player other than you if able." (GoadAllEffect, Duration
// UntilYourNextTurn, Layer RulesEffects). No elige objetivo: al resolver,
// recorre todas las criaturas que no controlas y les añade
// PermanentImpl.addGoadingPlayer(controllerId).
//
// Evidencia en el view (documentada en INTERACTION_COVERAGE.md): el motor NO
// serializa `goadingPlayers` en PermanentView, pero PermanentImpl.getRules(game)
// añade la restricción "Goaded by <jugador> (must attack)" con
// HintUtils.HINT_ICON_REQUIRE ("ICON_REQUIRE") a `rules` y, por el camino de
// CardView.generateCardIconsForPermanent (CardView.java:758-773), un
// cardIcon OTHER_HAS_RESTRICTIONS cuyo `hint` es ese mismo texto. El cliente
// web lo pinta como badge (CardIcons.tsx). La captura busca exactamente eso en
// el Grizzly Bears del SIM.
//
// Secuencia T1 (tras la tierra, regla P1): cheatSetup con 4 Mountains al campo
// propio + Disrupt Decorum a la mano (el cheat no puede adjuntar auras, pero
// una sorcery en mano es válida; patrón de energy.mjs); 800 ms después un
// Grizzly Bears (vanilla, sin decisión al entrar) al campo del SIM. Con ambos
// cheats ok se lanza el hechizo y el pago {2}{R}{R} lo hace el onPlayMana por
// defecto girando Mountains. El goad queda activo hasta nuestro próximo turno.
const SORCERY = 'Disrupt Decorum'

function makeGoadDriver() {
  return {
    name: 'goad',
    outFile: 'goad.json',
    deck: {
      name: 'Mage Web goad rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _cast: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
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
        ctx.log('onSelect: cheatSetup (4 Mountains + Disrupt Decorum en mano)')
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        void ctx
          .cheatSetup({
            battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
            hand: [SORCERY],
          })
          .then(
            (r1) =>
              new Promise((r) => setTimeout(r, 800)).then(() =>
                r1?.ok && rid ? ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid) : null,
              ),
          )
          .then(() => {
            this._bothCheated = true
            ctx.log('onSelect: ambos cheats listos')
          })
        return
      }
      // Solo lanzar cuando el SIM ya tiene la criatura (si no, no habría nada
      // que goadear). El cast responde al SELECT aparcado y el pago lo cubre
      // el onPlayMana por defecto (Mountains sin girar).
      if (this._bothCheated && !this._cast && ctx.cardInHand(SORCERY)) {
        this._cast = true
        ctx.log('onSelect: lanzo', SORCERY)
        ctx.playCardByName(SORCERY)
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        return first ?? false
      }
      return undefined
    },
    captureWhen(gv) {
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      for (const c of Object.values(rival?.battlefield ?? {})) {
        const icons = Array.isArray(c?.cardIcons) ? c.cardIcons : []
        const hasGoadIcon = icons.some((i) => /goaded by/i.test(String(i?.hint ?? i?.text ?? '')))
        const hasGoadRule = (c?.rules ?? []).some((r) => /goaded by/i.test(String(r)))
        if (hasGoadIcon || hasGoadRule) return true
      }
      return false
    },
  }
}

export const drivers = { goad: makeGoadDriver }

export const meta = {
  mechanic: 'goad',
  kind: 'game',
  assert: 'hasGoad',
  note: 'Disrupt Decorum ({2}{R}{R}: "Goad all creatures you don\'t control", GoadAllEffect Duration.UntilYourNextTurn) lanzado de verdad con cheatSetup (4 Mountains al campo propio + la sorcery a la mano; 800 ms después Grizzly Bears al campo del SIM, patrón must-block/energy) contra el SIM pasivo. El view NO trae `goadingPlayers` (gap aceptado), pero PermanentImpl.getRules(game) añade "Goaded by <jugador> (must attack)" (HintUtils ICON_REQUIRE) a `rules` y CardView lo vuelca además como cardIcon OTHER_HAS_RESTRICTIONS (hint "Goaded by <jugador> (must attack)", CardView.java:758-773); la captura es el GAME_UPDATE tras resolver el hechizo con el Grizzly del SIM mostrando ese texto en `rules`/`cardIcons`. Driver goad con spell real vía cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeGoadDriver())
}
