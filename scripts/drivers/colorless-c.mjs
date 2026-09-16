import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — incoloro específico {C} (§3.2; nieve ya tiene frame propio): Spatial
// Contortion (OGW 8, instant "{1}{C}", "Target creature gets +3/-3 until end of
// turn.") lanzado contra un Craw Wurm (6/4 vanilla) propio. Mazo 60 Wastes
// (OGW 183, básica incolora con ColorlessManaAbility {T}: Add {C}) y 4 Wastes +
// el Wurm cheateados al campo (el Wurm no tiene ETB: seguro con la regla
// anti-"as it enters" del cheat). HALLAZGO de prompts: el pago trocea el coste
// como "Pay {1}{C}" (la 1ª Wastes produce {C}, que cubre la parte {C}) y luego
// "Pay {1}" (2ª Wastes); el UUID de Wastes se envía en cada GAME_PLAY_MANA
// desde onPlayMana. HALLAZGO de objetivo: con un único objetivo legal
// (Craw Wurm) y min==max==1 el motor autoelige (TargetImpl.tryToAutoChoose) y
// NO llega GAME_TARGET — onTarget queda de red. Captura: Spatial Contortion en
// mi cementerio, Craw Wurm 9/1 en el campo (prueba del +3/-3) y ≥2 Wastes
// giradas, pila vacía.
function makeColorlessCDriver() {
  return {
    name: 'colorless-c',
    outFile: 'colorless-c.json',
    deck: {
      name: 'Mage Web colorless-c rec',
      cards: [{ cardName: 'Wastes', setCode: 'ogw', cardNumber: '183', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    _wurmTargeted: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la Wastes del turno).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: Wastes T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Spatial Contortion a la mano; 4 Wastes + Craw Wurm al campo)')
        void ctx.cheatSetup({
          hand: ['Spatial Contortion'],
          battlefield: ['Wastes', 'Wastes', 'Wastes', 'Wastes', 'Craw Wurm'],
        })
        return
      }
      const wurm = ctx.findOnBattlefield('Craw Wurm')
      if (!this._cast && wurm && ctx.cardInHand('Spatial Contortion') && ctx.untappedMana() >= 2) {
        this._cast = true
        ctx.log('onSelect: lanzo Spatial Contortion ({1}{C}) al Craw Wurm propio')
        ctx.playCardByName('Spatial Contortion')
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const ids = Object.keys(hand)
        const land = ids.find((id) => (hand[id]?.cardTypes ?? []).includes('LAND'))
        ctx.log('onTarget: descarte de limpieza')
        return land ?? ids[0]
      }
      if (!this._wurmTargeted) {
        const wurm = ctx.findOnBattlefield('Craw Wurm')
        if (wurm) {
          this._wurmTargeted = true
          ctx.log('onTarget: Spatial Contortion → Craw Wurm (min=max=1, sin Done)')
          return wurm
        }
      }
      return undefined
    },
    // Pago explícito con Wastes: cada GAME_PLAY_MANA (trozo del coste) se
    // responde con el UUID de una Wastes sin girar; el prompt se loguea para
    // documentar el troceo de {1}{C}.
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const waste = bf.find((c) => !c.tapped && /^wastes$/i.test(String(c?.name ?? '')))
      if (waste) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: waste.id })
        ctx.log('onPlayMana:', JSON.stringify(msg), '→ giro Wastes')
      } else {
        ctx.log('onPlayMana: SIN Wastes para', JSON.stringify(msg))
      }
    },
    // Invariante: hechizo en cementerio + efecto visible (Craw Wurm 6/4 → 9/1)
    // + las Wastes del pago giradas (≥2) y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const contortionGy = Object.values(me?.graveyard ?? {}).some((c) => /spatial contortion/i.test(c?.name ?? ''))
      const wurm = Object.values(me?.battlefield ?? {}).find((c) => /craw wurm/i.test(c?.name ?? ''))
      const tappedWastes = Object.values(me?.battlefield ?? {}).filter(
        (c) => /^wastes$/i.test(String(c?.name ?? '')) && c.tapped === true,
      ).length
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return contortionGy && !!wurm && String(wurm.power) === '9' && String(wurm.toughness) === '1' && tappedWastes >= 2 && stackEmpty
    },
  }
}

export const drivers = { 'colorless-c': makeColorlessCDriver }

export const meta = {
  mechanic: 'colorless-c',
  kind: 'game',
  assert: 'hasColorlessC',
  note: 'Incoloro específico {C} (§3.2): Spatial Contortion ({1}{C}, OGW 8) lanzado con 5 Wastes (OGW 183, básica incolora; {T}: Add {C}) contra un Craw Wurm 6/4 propio, todo vía cheatSetup (4 Wastes + el Wurm al campo entran sin decisión). Prompts reales del pago: GAME_PLAY_MANA "Pay {1}{C}" (se responde con UUID de Wastes: su {C} cubre la parte {C}) y después "Pay {1}" (2ª Wastes); el pago sale de onPlayMana explícito. HALLAZGO: con un único objetivo legal (el Wurm) y min==max==1 el motor autoelige el objetivo (TargetImpl.tryToAutoChoose, mismo patrón que switcheroo) y NO llega GAME_TARGET. Captura: Spatial Contortion en mi cementerio, Craw Wurm 9/1 en el campo (PermanentView.power/toughness son strings con el +3/-3 aplicado, como en discover/planeswalker) y 2 Wastes giradas, pila vacía. Driver colorless-c con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeColorlessCDriver())
}
