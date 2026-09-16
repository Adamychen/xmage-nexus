import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Emblemas de planeswalker (§3.10: "Monarch, initiative/dungeon, the ring,
// emblemas | Indicadores"): Gideon of the Trials (AKH 14, {1}{W}{W}, lealtad
// inicial 3) tiene una habilidad de lealtad 0 que NO pide objetivos y crea un
// emblema: "You get an emblem with 'As long as you control a Gideon
// planeswalker, you can't lose the game and your opponents can't win the
// game.'" (GetEmblemEffect(new GideonOfTheTrialsEmblem()); el nombre del
// emblema es "Emblem Gideon", GideonOfTheTrialsEmblem.java).
//
// Mazo de 60 Llanuras: T1 tierra (acción normal previa al cheat) + cheatSetup
// (Gideon a la MANO + 3 Llanuras al campo = 4 manás) → se lanza por {1}{W}{W}
// (el default de rec-lib gira una Llanura por cada GAME_PLAY_MANA) → con el
// hechizo resuelto y pila vacía se hace CLIC en Gideon (sendPlayerUUID de su id
// de battlefield = activar habilidad, regla de playAbility en rec-lib: enviar
// el UUID de la habilidad NO activa nada) → el servidor abre
// GAME_CHOOSE_ABILITY con las 3 habilidades de lealtad y se elige por texto la
// que contiene "emblem" (el payload es AbilityPickerView: Map<UUID,String> con
// etiquetas "1. +1: ...", "2. 0: ...", "3. 0: You get an emblem with ...").
//
// SONDA DE CONTRATO (§3.10): los emblemas de planeswalker NO viajan por
// `myHelperEmblems` — ese campo de GameView (GameView.java:84-88) es SOLO para
// los helper emblems del motor (Radiation, storm counter, day/night,
// XmageHelperEmblem), que se filtran por `state.getHelperEmblems()`. El emblema
// de una carta entra por GameImpl.addEmblem → state.addCommandObject (zona de
// mando) y PlayerView lo proyecta en `players[].commandList` como EmblemView
// (PlayerView.java:117-121, solo si emblem.getControllerId() == playerId del
// dueño), igual que Dungeon/Plane/Commander. EmblemView = {id, name,
// cardNumber, imageFileName, imageNumber, expansionSetCode, rules,
// playableStats}; NO trae mageObjectType en el view de commandList, así que el
// web detecta el emblema por NOMBRE: CommandZone.parseCommandList marca
// isEmblem con `nameLower.startsWith('emblem ')` ("emblem gideon") o
// mageObjectType === 'EMBLEM' (que aquí no está) y lo pinta en `.emblem-slot`
// (CommandZone.tsx:213-234), exactamente el selector que asertea
// mechanics.spec.ts:142.
//
// Invariante del frame: players[].commandList (controlado) con el EmblemView
// "Emblem Gideon" y rules no vacías, Gideon en el campo, pila vacía.
function makeEmblemDriver() {
  return {
    name: 'emblem',
    outFile: 'emblem.json',
    deck: {
      name: 'Mage Web emblem rec',
      cards: [
        { cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 },
        { cardName: 'Gideon of the Trials', setCode: 'AKH', cardNumber: '14', amount: 1 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    _abilityPicked: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno: acción normal previa al cheat (regla P1) y evita el
      // descarte de limpieza.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Gideon a la mano + 3 Llanuras al campo)')
        void ctx.cheatSetup({
          hand: ['Gideon of the Trials'],
          battlefield: ['Plains', 'Plains', 'Plains'],
        })
        return
      }
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      if (!this._cast && ctx.cardInHand('Gideon of the Trials') && ctx.untappedMana() >= 3 && stackEmpty) {
        this._cast = true
        ctx.log('onSelect: lanzo Gideon of the Trials ({1}{W}{W})')
        ctx.playCardByName('Gideon of the Trials')
        return
      }
      // Gideon ya en el campo y pila vacía: clic en él = picker de habilidades
      // (las 3 son jugables con lealtad 3: +1, 0 y 0).
      const gideonId = Object.entries(me.battlefield ?? {}).find(([, c]) =>
        /gideon of the trials/i.test(String(c?.name ?? c?.displayName ?? '')),
      )?.[0]
      if (this._cast && !this._abilityPicked && gideonId && stackEmpty) {
        ctx.log('onSelect: clic en Gideon → GAME_CHOOSE_ABILITY')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: gideonId })
        return
      }
      ctx.pass()
    },
    // AbilityPickerView.choices = Map<UUID, "<n>. <regla>">; la habilidad del
    // emblema es la única cuyo texto contiene "emblem". Las otras dos son el +1
    // (con objetivo) y el 0 que convierte a Gideon en criatura.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility:', JSON.stringify(opts).slice(0, 500))
      const emblem = opts.find((o) => /emblem/i.test(String(o?.label ?? '')))
      if (emblem) {
        this._abilityPicked = true
        ctx.log('onChooseAbility: habilidad del emblema (0)')
        return emblem.value
      }
      return opts[0]?.value
    },
    // Defensivo (no debería dispararse): si por error se eligiera el +1, su
    // TargetPermanent es obligatorio; se apunta al primer permanente del SIM.
    onTarget(ctx, question, data) {
      ctx.log('onTarget inesperado:', String(question ?? '').slice(0, 60))
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        return Object.keys(hand)[0] ?? false
      }
      const sim = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const first = Object.keys(sim?.battlefield ?? sim?.graveyard ?? {})[0]
      return first ?? ctx.untappedMana()
    },
    // Invariante: el EmblemView en players[].commandList del jugador
    // controlado, con rules no vacías y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const list = Array.isArray(me.commandList) ? me.commandList : Object.values(me.commandList ?? {})
      const emblem = list.find((c) => /^emblem/i.test(String(c?.name ?? c?.displayName ?? '')))
      if (!emblem) return false
      if (!Array.isArray(emblem.rules) || emblem.rules.length === 0) return false
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      return stackEmpty
    },
  }
}

export const drivers = { emblem: makeEmblemDriver }

export const meta = {
  mechanic: 'emblem',
  kind: 'game',
  assert: 'hasEmblem',
  note: 'Gideon of the Trials (AKH 14, {1}{W}{W}, lealtad 3; AKH de Amonkhet.java "AKH") lanzado de verdad vía cheatSetup (a la mano + 3 Llanuras al campo; maná pagado con GAME_PLAY_MANA girando una Llanura por símbolo) y su habilidad de lealtad 0 que crea un emblema activada con un CLIC en el permanente (sendPlayerUUID de su id de battlefield, NO el UUID de la habilidad — HumanPlayer.activateAbility resuelve el picker: GAME_CHOOSE_ABILITY con AbilityPickerView.choices = Map<UUID,String> "1. +1: ...", "2. 0: ...", "3. 0: You get an emblem with ..."; se elige la etiqueta con "emblem"). CONTRATO (hallazgo): los emblemas de PLANESWALKER NO viajan por myHelperEmblems (ese campo de GameView.java:84-88 es solo para los helper emblems del motor: Radiation/storm/day-night/XmageHelperEmblem vía state.getHelperEmblems()); el emblema de carta entra por GameImpl.addEmblem → state.addCommandObject y PlayerView.java:117-121 lo proyecta en players[].commandList como EmblemView {id,name,cardNumber,imageFileName,imageNumber,expansionSetCode,rules,playableStats} (sin mageObjectType), igual que Dungeon/Plane/Commander. El web lo detecta por nombre ("Emblem Gideon" cumple nameLower.startsWith("emblem ")) y lo pinta en .emblem-slot (CommandZone.tsx; el selector que aserta mechanics.spec.ts:142). Invariante del frame: commandList del controlado con EmblemView name="Emblem Gideon" y rules.length>=1, Gideon en el campo y pila vacía. Driver emblem con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeEmblemDriver())
}
