import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — boca abajo §3.8: manifest (Soul Summons, FRF {1}{W}) + GIRAR BOCA
// ARRIBA, que es la parte que morph.json no cubre (allí solo se capturó el
// permanente boca abajo).
//
// Motor (grep ../xmage-fork): ManifestEffect.doManifestCards añade un
// BecomesFaceDownCreatureEffect(manaCosts del side real, FaceDownType.MANIFESTED);
// el efecto agrega al permanente un TurnFaceUpAbility (SpecialAction con el
// coste de maná de la carta: {W} para Elite Vanguard) y
// makeFaceDownObject lo deja 2/2 anónimo con manifested=true. El giro boca
// arriba (701.34b) es una acción especial que NO usa la pila ni aparece en
// GameState.specialActions (solo se pueblan ahí las de maná tipo convoke/delve
// y las de CreateSpecialActionEffect), así que sendPlayerString('special') no
// tiene nada que activar: el camino es CLICAR el permanente boca abajo
// (sendPlayerUUID) → HumanPlayer.getPlayableActivatedAbilities recoge su
// TurnFaceUpAbility → GAME_CHOOSE_ABILITY si hay picker, o activación directa
// → GAME_PLAY_MANA del {W}.
//
// Secuencia: mazo 60 Plains; T1 tierra + UN cheatSetup (Soul Summons a la
// mano, 2 Plains al campo — el hechizo cuesta {1}{W} y el giro {W}, total 3 —
// y Elite Vanguard arriba de la biblioteca: el último nombre de library queda
// ARRIBA). Se lanza Soul Summons → Elite Vanguard 2/1 entra boca abajo como
// 2/2 anónimo (faceDown:true, manifested:true) → clic en él → pago {W} → giro.
// Frame preferido: DESPUÉS del giro (Elite Vanguard 2/1 boca arriba + Soul
// Summons en el cementerio).
function makeManifestDriver() {
  return {
    name: 'manifest',
    // NO usar 'manifest.json': ese nombre es el ÍNDICE de fixtures
    // (web/fixtures/recorded/manifest.json, lo leen recorded.test.ts y
    // recorded.spec.ts). meta.file deja el frame en un nombre libre.
    outFile: 'manifest-mechanic.json',
    deck: {
      name: 'Mage Web manifest rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _clicked: 0,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (también sirve de "≥1 acción normal" para la regla P1
      // del cheat, aunque el cheat ya va detrás de la tierra del T1).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: cheat tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Soul Summons en mano, 2 Plains al campo, Elite Vanguard arriba)')
        void ctx.cheatSetup({
          hand: ['Soul Summons'],
          battlefield: ['Plains', 'Plains'],
          library: ['Elite Vanguard'],
        })
        return
      }
      // Soul Summons {1}{W}: manifest de la de arriba (Elite Vanguard).
      if (ctx.cardInHand('Soul Summons') && ctx.untappedMana() >= 2) {
        ctx.log('onSelect: lanzo Soul Summons ({1}{W})')
        ctx.playCardByName('Soul Summons')
        return
      }
      // Giro boca arriba: clic en el permanente manifestado. Se reintenta en
      // cada ventana de prioridad (los clics que no activan nada no consumen
      // nada; el servidor solo responde con el prompt del giro).
      const faceDown = Object.values(me.battlefield ?? {}).find(
        (c) => c?.faceDown === true && c?.manifested === true,
      )
      if (faceDown && this._clicked < 4) {
        this._clicked += 1
        ctx.log('onSelect: clic en el manifestado para girarlo boca arriba (intento', this._clicked, ')')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: faceDown.id })
        return
      }
      ctx.pass()
    },
    // Si el clic abre el picker de "Choose spell or ability to play", la
    // opción útil es el TurnFaceUpAbility ("Turn this face-down permanent
    // face up", TurnFaceUpEffect.staticText).
    onChooseAbility(opts, ctx) {
      const up = (opts ?? []).find((o) => /turn this face-down|face up/i.test(String(o?.label ?? '')))
      if (up) {
        ctx.log('onChooseAbility: turn face up')
        return up.value ?? up.id
      }
      return (opts ?? [])[0]?.value
    },
    // Salvaguarda: si el clic cae en lookAtFaceDownCard (solo pasa con un
    // asThough LOOK_AT_FACE_DOWN, p.ej. foretell), false continúa hacia la
    // activación de la habilidad. El resto de ASKs (mulligan) al default.
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) {
        ctx.log('onAsk: "Look at …" → NO (activar el giro)')
        return false
      }
      return undefined
    },
    // Pago {1}{W} del Soul Summons y {W} del giro: Plains sin voltear. El
    // flag isActive/hasPriority no es fiable durante el pago.
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
    // Invariante preferido: Elite Vanguard boca ARRIBA (2/1) + Soul Summons en
    // el cementerio. Si el giro no se alcanzara, el fallback (documentado en
    // meta.note) captura el frame del manifest: faceDown:true con
    // manifested:true y Soul Summons ya en el cementerio.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const gy = Object.values(me.graveyard ?? {})
      if (!gy.some((c) => /soul summons/i.test(String(c?.name ?? '')))) return false
      const bf = Object.values(me.battlefield ?? {})
      const vanguard = bf.find((c) => /elite vanguard/i.test(String(c?.name ?? '')))
      return Boolean(vanguard) && vanguard.faceDown !== true
    },
  }
}

export const drivers = { manifest: makeManifestDriver }

export const meta = {
  mechanic: 'manifest',
  file: 'manifest-mechanic.json',
  kind: 'game',
  assert: 'hasManifest',
  note: 'Soul Summons (FRF {1}{W}) lanzado vía cheatSetup (carta a la mano + 2 Plains al campo) manifiesta la de arriba (Elite Vanguard, puesta con cheatSetup.library: el último nombre queda arriba): el permanente entra boca abajo 2/2 anónimo con faceDown:true y manifested:true. El giro boca arriba (regla 701.34b) se ejecuta clicando el permanente (sendPlayerUUID): el TurnFaceUpAbility que añade BecomesFaceDownCreatureEffect/MANIFESTED NO está en GameState.specialActions (sendPlayerString("special") no activa nada), pero sí entre las habilidades jugables del objeto; se paga su coste de maná ({W}) y Elite Vanguard queda 2/1 boca arriba. Captura: Elite Vanguard boca arriba en el campo propio + Soul Summons en el cementerio. Driver manifest con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeManifestDriver())
}
