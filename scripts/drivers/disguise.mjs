import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — boca abajo §3.8: DISGUISE (MKM). Unyielding Gatekeeper ({1}{W},
// Disguise {1}{W}; ../xmage-fork/.../u/UnyieldingGatekeeper.java) se lanza
// boca abajo por {3} como 2/2 anónimo con ward {2}.
//
// Motor (grep ../xmage-fork): DisguiseAbility (SpellAbilityType.BASE_ALTERNATE,
// como morph) añade BecomesFaceDownCreatureEffect(..., FaceDownType.DISGUISED):
// el permanente queda 2/2 sin nombre/subtipos con PermanentImpl.disguised=true
// (view: `disguised:true`, frente a `morphed:true` de morph y `manifested:true`
// de manifest) y el efecto añade una WardAbility({2}) REAL con
// withFaceDownUsage() + dos InfoEffect (giro y recordatorio de ward). Medido en
// el frame capturado: el ward {2} del 2/2 boca abajo aparece SOLO en `rules`
// ("A face-down creature that was cloaked or cast with disguise has ward {2}…"),
// no en `cardIcons` (vacío, pese al addIcon ABILITY_HEXPROOF de WardAbility).
//
// Secuencia: mazo 60 Plains; T1 tierra + UN cheatSetup (Unyielding Gatekeeper
// a la mano + 4 Plains al campo: {3} del lanzamiento boca abajo y {1}{W} del
// giro — mismo camino de giro que manifest: clic en el permanente → pay). El
// frame preferido es el 2/2 boca abajo con `disguised:true` (el ward solo
// existe mientras está boca abajo), por eso se captura ANTES de girarlo.
function makeDisguiseDriver() {
  return {
    name: 'disguise',
    outFile: 'disguise.json',
    deck: {
      name: 'Mage Web disguise rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
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
        ctx.log('onSelect: cheatSetup (Unyielding Gatekeeper en mano, 4 Plains al campo)')
        void ctx.cheatSetup({
          hand: ['Unyielding Gatekeeper'],
          battlefield: ['Plains', 'Plains', 'Plains', 'Plains'],
        })
        return
      }
      // Boca abajo: clic en la carta en mano → GAME_CHOOSE_ABILITY (como morph)
      // → elegir Disguise por texto.
      if (!this._cast && ctx.cardInHand('Unyielding Gatekeeper') && ctx.untappedMana() >= 3) {
        const id = ctx.playAbility('Unyielding Gatekeeper', ['other', 'basicCastAbilities'], /disguise|face down/i)
        if (id) {
          this._cast = true
          ctx.log('onSelect: clic para lanzar boca abajo (disguise)')
          return
        }
        ctx.log('onSelect: habilidad disguise no encontrada en canPlayObjects, espero')
      }
      ctx.pass()
    },
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility disguise:', JSON.stringify(opts).slice(0, 300))
      const disguise = (opts ?? []).find((o) => /disguise|face down/i.test(String(o?.label ?? '')))
      if (disguise) {
        ctx.log('onChooseAbility: disguise')
        return disguise.value
      }
      return (opts ?? [])[1]?.value ?? (opts ?? [])[0]?.value
    },
    // Salvaguarda (igual que manifest): "Look at …" → false; el resto al
    // default (mulligan: keep).
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) {
        ctx.log('onAsk: "Look at …" → NO')
        return false
      }
      return undefined
    },
    // Pago {3} del lanzamiento boca abajo: Plains sin voltear.
    onPlayMana(ctx) {
      const plains = Object.values(ctx.me?.battlefield ?? {}).find(
        (c) => !c.tapped && /plains/i.test(c?.name ?? ''),
      )
      if (plains) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: plains.id })
        ctx.log('onPlayMana: giro', plains.name)
      }
    },
    // Descarte de limpieza, si llegara: una carta de la mano.
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
      }
      return undefined
    },
    // 2/2 boca abajo propio con el flag específico de disguise.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some(
        (c) => c?.faceDown === true && c?.disguised === true,
      )
    },
  }
}

export const drivers = { disguise: makeDisguiseDriver }

export const meta = {
  mechanic: 'disguise',
  file: 'disguise.json',
  kind: 'game',
  assert: 'hasDisguise',
  note: 'Unyielding Gatekeeper ({1}{W}, Disguise {1}{W}) lanzado boca abajo por {3} vía cheatSetup (carta a la mano + 4 Plains al campo): entra como 2/2 anónimo con faceDown:true, disguised:true (morph usa morphed:true y manifest manifested:true), ward {2} visible en rules ("A face-down creature that was cloaked or cast with disguise has ward {2}…") y NO en cardIcons (vacío, medido). Giro boca arriba verificado aparte (run exploratorio, JSON no conservado): clic → GAME_PLAY_MANA "Pay {1}{W}… face down creature" → Unyielding Gatekeeper 3/2 boca arriba y su trigger "turn face up" se desvanece sin objetivo legal (no hay otro permanente no-tierra); mismo camino TurnFaceUpAbility que manifest.json, que no se ejecuta en la captura porque el frame del ward solo existe boca abajo. Captura: permanente propio faceDown+disguised en un GAME_UPDATE_AND_INFORM.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDisguiseDriver())
}
