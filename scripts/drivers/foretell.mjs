import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — foretell vía cheatSetup (§3.3 lanzar desde otras zonas / exilio boca
// abajo): Saw It Coming ({1}{U}{U}, instantáneo, "Counter target spell") en
// mano + Isla al campo → 2 manás: justo el {2} del foretell, mientras el
// hardcast de 3 NO es pagable, así que la SpecialAction de foretell es la
// única acción jugable de la carta (mismo patrón que el suspend de Rift Bolt:
// se clica la carta en mano, sin picker). Primer turno propio: foretell → la
// carta va a una zona de exilio especial boca abajo: me.exile la trae con
// faceDown:true (el dueño ve el nombre real en la vista, los rivales no;
// CardView.fillEmptyWithImageInfo). En el turno propio siguiente
// (ForetellCostAbility.canActivate prohíbe lanzarla el mismo turno; el turno
// del SIM en medio es obligatorio): Saw It Coming exige "target spell" para
// poder lanzarse, así que se monta Opt como cebo con prioridad propia: se
// lanza Opt ({U}), y en la ventana de prioridad siguiente se lanza Saw It
// Coming desde el exilio por {1}{U} apuntando al Opt de la pila. Captura:
// ambos hechizos en la pila — el ciclo completo (exilio boca abajo →
// lanzamiento desde el exilio).
function faceDownInExile(me) {
  const ex = me?.exile ?? {}
  const entries = Array.isArray(ex) ? ex.map((c) => [c?.id, c]) : Object.entries(ex)
  const named = entries.find(([, c]) => c?.faceDown === true && /saw it coming/i.test(String(c?.name ?? '')))
  const any = entries.find(([, c]) => c?.faceDown === true)
  const hit = named ?? any
  return hit ? { id: hit[0], card: hit[1] } : null
}

function makeForetellDriver() {
  return {
    name: 'foretell',
    outFile: 'foretell.json',
    deck: {
      name: 'Mage Web foretell rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _foretellTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (ver counterspell). Se
      // cheatea también Opt: hará de "target spell" del counter en T2 (Saw It
      // Coming no puede lanzarse sin un hechizo al que apuntar).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Saw It Coming + Opt en mano, Isla al campo)')
        void ctx.cheatSetup({ hand: ['Saw It Coming', 'Opt'], battlefield: ['Island'] })
        return
      }
      const exiled = faceDownInExile(me)
      // Foretell: clic en la carta en mano con solo {2} disponible (el
      // hardcast no es pagable → única acción). Reintenta si el clic no dejó
      // la carta en el exilio boca abajo.
      if (!exiled && ctx.cardInHand('Saw It Coming') && ctx.untappedMana() >= 2) {
        this._foretellTurn = turn
        ctx.log('onSelect: foretell Saw It Coming ({2})')
        ctx.playCardByName('Saw It Coming')
        return
      }
      // Lanzamiento desde el exilio: solo en un turno POSTERIOR al del
      // foretell (canActivate lo prohíbe el mismo turno).
      if (exiled && turn > this._foretellTurn) {
        const stackNames = Object.values(gv.stack ?? {}).map((s) => String(s?.name ?? ''))
        if (stackNames.some((n) => /saw it coming/i.test(n))) {
          ctx.pass()
          return
        }
        const optOnStack = stackNames.some((n) => /^opt$/i.test(n))
        if (optOnStack) {
          ctx.log('onSelect: lanzo Saw It Coming desde el exilio (foretell {1}{U})')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: exiled.id })
          return
        }
        // Cebo: Opt primero (1 maná + 2 para el counter = 3 Islas).
        if (ctx.cardInHand('Opt') && ctx.untappedMana() >= 3) {
          ctx.log('onSelect: lanzo Opt (cebo para el counter)')
          ctx.playCardByName('Opt')
          return
        }
      }
      ctx.pass()
    },
    // Por si el picker de la carta en mano / exiliada ofrece varias acciones.
    onChooseAbility(opts, ctx) {
      const f = (opts ?? []).find((o) => /foretell/i.test(String(o?.label ?? '')))
      if (f) {
        ctx.log('onChooseAbility: foretell')
        return f.value ?? f.id
      }
      return (opts ?? [])[0]?.value
    },
    // HALLAZGO (2026-09-16): clicar la carta boca abajo en el exilio dispara
    // PlayerImpl.lookAtFaceDownCard → GAME_ASK "Look at <carta>" (chooseUse:
    // "Yes, look at the card" / "No, play/activate the card/ability", sobre
    // ForetellLookAtCardEffect). Sin responder, la corrida se queda muda.
    // false = no mirar → HumanPlayer.activateAbility con la habilidad
    // "Foretell {1}{U}" (visible en canPlayObjects del exiliado como
    // basicCastAbilities). El resto de ASKs (mulligan) caen al default.
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) {
        ctx.log('onAsk: "Look at …" → NO (activar el foretell)')
        return false
      }
      return undefined
    },
    // Objetivo del counter: el Opt propio en la pila (ids de la propia
    // pregunta). Y descarte de limpieza (mano 8 tras predecir: 7 Islas + Opt)
    // — la primera corrida se quedó muda esperando este GAME_TARGET. Se
    // descarta una Isla del propio prompt, nunca Opt (cebo del counter).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
      if (/discard/i.test(q)) {
        const isle = ids.find((id) => /island/i.test(hand[id]?.name ?? '')) ?? ids[0]
        if (isle) {
          ctx.log('onTarget: descarte de limpieza (Isla)')
          return isle
        }
        return undefined
      }
      const opt = Object.entries(ctx.gv?.stack ?? {}).find(([, s]) => /^opt$/i.test(s?.name ?? ''))
      if (opt && ids.includes(opt[0])) return opt[0]
      if (ids[0]) return ids[0]
      return undefined
    },
    // Pago {2} del foretell y {1}{U} del lanzamiento desde el exilio con
    // Islas sin voltear (el flag isActive/hasPriority no es fiable durante el
    // pago).
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    captureWhen(gv) {
      const names = Object.values(gv?.stack ?? {}).map((s) => String(s?.name ?? ''))
      return names.some((n) => /saw it coming/i.test(n)) && names.some((n) => /^opt$/i.test(n))
    },
  }
}

export const drivers = { foretell: makeForetellDriver }

export const meta = {
  mechanic: 'foretell',
  kind: 'game',
  assert: 'hasForetell',
  note: 'Saw It Coming predicha en el primer turno propio ({2}; con 2 manás el hardcast {1}{U}{U} no es pagable y el clic en la carta basta — la SpecialAction aparece en canPlayObjects del objeto como "other": "Foretell {1}{U}…") → exiliada boca abajo (me.exile con faceDown:true) → lanzada en el turno propio siguiente desde el exilio por {1}{U} apuntando a un Opt propio en la pila (la carta exige "target spell"; el turno del SIM en medio es obligatorio: ForetellCostAbility prohíbe lanzarla el mismo turno; el exiliado expone "Foretell {1}{U}" como basicCastAbilities). Captura: Saw It Coming + Opt en la pila y me.exile vacío, prueba del ciclo completo. Driver foretell con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeForetellDriver())
}
