import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Commander desde la zona de mando + impuesto (§3.3): mazo legal de
// Commander (99 Montañas + Krenko, Mob Boss como comandante) en una mesa de
// variant "Commander Two Player Duel".
//
// HALLAZGO DE HARNESS (2026-09-16): rec-lib.mjs creaba la mesa con gameType
// 'Two Player Duel' hardcodeado (solo `driver.gameType` se usa como deckType).
// Con el variant de duelo normal el motor NO instancia GameCommanderImpl, así
// que NO hay zona de mando ni impuesto: la carta del banquillo (donde el proxy
// mueve los `commanders`) se queda fuera de juego. **Integrado**: rec-lib
// acepta `driver.tableGameType` (passthrough a createTable) → este driver pide
// el variant 'Commander Two Player Duel' sin shims.

// Impresión M13 138 (verificada en el set del fork: Mage.Sets Magic2013).
const KRENKO = { cardName: 'Krenko, Mob Boss', setCode: 'M13', cardNumber: '138', amount: 1 }
const MOUNTAIN = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 99 }

function commandZoneEntry(me) {
  const cl = me?.commandList
  const items = Array.isArray(cl) ? cl : Object.values(cl ?? {})
  return items.find((c) => /krenko, mob boss/i.test(c?.name ?? ''))
}

function commanderOnBattlefield(me) {
  return Object.values(me?.battlefield ?? {}).find((c) => /krenko, mob boss/i.test(c?.name ?? ''))
}

function makeCommanderZoneDriver() {
  return {
    name: 'commander-zone',
    outFile: 'commander-zone.json',
    deck: {
      name: 'Mage Web commander rec',
      cards: [MOUNTAIN],
      sideboard: [],
      commanders: [KRENKO],
    },
    // El asiento SIM también necesita mazo legal de Commander (98+ main y el
    // comandante en el banquillo) o su joinTable falla y la mesa no arranca.
    simDeck: {
      name: 'Mage Sim commander rec',
      cards: [{ ...MOUNTAIN }],
      sideboard: [],
      commanders: [{ ...KRENKO }],
    },
    // rec-lib usa este campo como deckType de la mesa → 'Variant Magic -
    // Commander' es el nombre registrado en DeckValidatorFactory (config.xml).
    gameType: 'Variant Magic - Commander',
    // Variant real de la mesa (passthrough a createTable) → GameCommanderImpl.
    tableGameType: 'Commander Two Player Duel',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: 0,
    _boltsFired: 0,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (tierra del turno).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Un único cheatSetup: 12 Montañas al campo (sin decisión "as it enters")
      // + 2 Lightning Bolt a la mano. Krenko NO se cheatea: ya está en la zona
      // de mando por el variant Commander.
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (12 Montañas al campo, 2 Lightning Bolt a la mano)')
        void ctx.cheatSetup({
          hand: ['Lightning Bolt', 'Lightning Bolt'],
          battlefield: Array(12).fill('Mountain'),
        })
        return
      }

      const cmd = commandZoneEntry(me)
      const krenkoBf = commanderOnBattlefield(me)
      const bolt = ctx.cardInHand('Lightning Bolt')

      // 1er lanzamiento desde la zona de mando: {2}{R}{R} = 4 manás.
      if (this._cast === 0 && cmd && ctx.untappedMana() >= 4) {
        this._cast = 1
        ctx.log('onSelect: Krenko 1er lanzamiento desde la zona de mando ({2}{R}{R})')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: cmd.id })
        return
      }

      // Con Krenko en el campo: Bolt propio (3/3 muere con 3 de daño).
      if (krenkoBf && bolt && this._cast === 1 && this._boltsFired < 1) {
        this._boltsFired = 1
        ctx.log('onSelect: Lightning Bolt a mi Krenko (1er retorno)')
        ctx.playCardByName('Lightning Bolt')
        return
      }

      // Tras el primer retorno: 2º lanzamiento, ahora con impuesto +{2}
      // ({4}{R}{R} = 6 manás).
      if (this._cast === 1 && this._boltsFired === 1 && cmd && !krenkoBf && ctx.untappedMana() >= 6) {
        this._cast = 2
        ctx.log('onSelect: Krenko 2º lanzamiento con impuesto ({4}{R}{R} = 6 manás)')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: cmd.id })
        return
      }

      // Segundo Bolt y retorno definitivo (el frame capturado).
      if (krenkoBf && bolt && this._cast === 2 && this._boltsFired < 2) {
        this._boltsFired = 2
        ctx.log('onSelect: segundo Lightning Bolt a mi Krenko')
        ctx.playCardByName('Lightning Bolt')
        return
      }

      ctx.pass()
    },
    // El Bolt apunta a nuestro Krenko; el descarte de limpieza (si llega)
    // coge una Montaña. Cualquier otro target no nos compete.
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        this._dspent = this._dspent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const mtn = Object.entries(hand).find(([id, c]) => /mountain/i.test(c?.name ?? '') && !this._dspent.includes(id))
        if (mtn) {
          this._dspent.push(mtn[0])
          ctx.log('onTarget: descarto Montaña')
          return mtn[0]
        }
        return undefined
      }
      const krenko = commanderOnBattlefield(ctx.me)
      if (krenko) {
        ctx.log('onTarget: Bolt → mi Krenko')
        return krenko.id
      }
      return undefined
    },
    // Prompt de retorno a la zona de mando (GameImpl SBA → chooseUse):
    // "Move Krenko, Mob Boss to the command zone or leave it in current zone
    // (GRAVEYARD)?" → SÍ. El mulligan lo resuelve el default de la librería.
    onAsk(question, ctx) {
      if (/command zone/i.test(String(question ?? ''))) {
        ctx.log('onAsk: retorno a la zona de mando → SÍ')
        return true
      }
      return undefined
    },
    // El frame vale cuando Krenko está de vuelta en la zona de mando tras el
    // segundo ciclo (2 Bolts en el cementerio): el view lo expone en
    // players[].commandList y la carta ya no está ni en el campo ni en el
    // cementerio.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const bolts = Object.values(me.graveyard ?? {}).filter((c) => /lightning bolt/i.test(c?.name ?? '')).length
      return Boolean(commandZoneEntry(me)) && bolts >= 2
    },
  }
}

export const drivers = { 'commander-zone': makeCommanderZoneDriver }

export const meta = {
  mechanic: 'commander-zone',
  kind: 'game',
  assert: 'hasCommanderZone',
  note: 'Commander legal (99 Montañas + Krenko, Mob Boss) en mesa de variant "Commander Two Player Duel": el comandante arranca en la zona de mando, se lanza con {2}{R}{R} (impuesto +{2} en el 2º lanzamiento = {4}{R}{R}), muere con Lightning Bolt propio y el SBA de GameImpl pregunta por GAME_ASK ("Move Krenko, Mob Boss to the command zone or leave it in current zone (GRAVEYARD)?", botones "Move to command"/"Leave in current zone (GRAVEYARD)"); al responder SÍ vuelve a players[].commandList. Invariante: Krenko en commandList con 2 Lightning Bolt en el cementerio. OJO: el harness hardcodea gameType Two Player Duel, este driver parchea su propio createTable a Commander Two Player Duel (shim pendiente de passthrough en rec-lib).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCommanderZoneDriver())
}
