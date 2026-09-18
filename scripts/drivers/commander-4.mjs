import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Commander de 4 jugadores (§3.11 "Commander 4 jugadores | Daño de
// comandante, anillo de turnos, impuesto"): mesa real "Commander Free For All"
// (1 humano + 3 SIM) con mazo legal de Commander (99 Montañas + Krenko, Mob
// Boss de comandante; los SIM llevan un mazo igual).
//
// QUÉ VIAJA DEL DAÑO DE COMANDANTE (sonda de contrato 2026-09-17): NO hay
// campo `commanderDamage` en PlayerView/GameView (ni en `CommanderView`, que
// es solo `CardView + mageObjectType`). El daño vive en el motor en
// `CommanderInfoWatcher.damageToPlayer` (game-state, sin proyección al view) y
// sale al cliente SOLO como info del cardState volcada en `rules`:
// `CommanderInfoWatcher.addCardInfoToCommander` hace `addInfo("Commander<targetId>",
// "<b>Commander</b> did N combat damage to player <nombre>.")` sobre la carta
// Y el permanente, y `CardUtil.getCardRulesWithAdditionalInfo` añade
// `cardState.getInfo().values()` a `rules`. El web lo parsea en
// CommanderDamageMatrix (`extractDamage` → regex "did N combat damage to player X").
//
// El driver lanza a Krenko DESDE LA ZONA DE MANDO (no se puede cheatear: una
// copia nueva tendría otro id y el watcher del comandante real no la vería) con
// 8 Montañas cheateadas y lo ataca al ÚLTIMO SIM con `attackOption: MULTIPLE`
// (el default LEFT deja 1 solo defensor y no hay GAME_TARGET; hallazgo de
// pod-combat). La captura exige la traza completa: `rules` del comandante con
// la línea de daño + la vida del SIM rebajada exactamente en N (40 − N).
const MOUNTAIN = { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 99 }
const KRENKO = { cardName: 'Krenko, Mob Boss', setCode: 'M13', cardNumber: '138', amount: 1 }

function commanderDeck(name) {
  return {
    name,
    cards: [{ ...MOUNTAIN }],
    sideboard: [],
    commanders: [{ ...KRENKO }],
  }
}

function commandZoneEntry(me) {
  const cl = me?.commandList
  const items = Array.isArray(cl) ? cl : Object.values(cl ?? {})
  return items.find((c) => /krenko, mob boss/i.test(c?.name ?? ''))
}

function krenkoOnBattlefield(me) {
  return Object.entries(me?.battlefield ?? {}).find(
    ([, c]) => /krenko, mob boss/i.test(c?.name ?? '') && c?.summoningSickness !== true,
  )
}

// Línea "Commander did N combat damage to player <nombre>." en el rules de la
// carta/permanente del comandante. Devuelve { dmg, playerName } o null.
function commanderDamageLine(cards) {
  const krenko = (cards ?? []).find((c) => /krenko, mob boss/i.test(String(c?.name ?? '')))
  const rules = (krenko?.rules ?? []).map((r) => String(r).replace(/<[^>]*>/g, ' ')).join(' ')
  const m = rules.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
  if (!m) return null
  return { dmg: Number(m[1]), playerName: m[2].trim() }
}

function commandZoneCards(me) {
  return Array.isArray(me?.commandList) ? me.commandList : Object.values(me?.commandList ?? {})
}

function makeCommander4Driver() {
  return {
    name: 'commander-4',
    outFile: 'commander-4.json',
    deck: commanderDeck('Mage Web commander-4 rec'),
    playerTypes: ['HUMAN', 'SIM', 'SIM', 'SIM'],
    simDecks: [
      commanderDeck('Mage Sim commander-4 rec A'),
      commanderDeck('Mage Sim commander-4 rec B'),
      commanderDeck('Mage Sim commander-4 rec C'),
    ],
    gameType: 'Variant Magic - Commander',
    tableGameType: 'Commander Free For All',
    // Con el default LEFT los 3 SIM no entran en getDefenders() (ver pod-combat).
    attackOption: 'MULTIPLE',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    _bolted: false,
    _attackSentTurn: -1,
    _targetSim: null,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Tras conectar, se manda el comandante de vuelta a la zona de mando con
      // un Bolt propio: la matriz del web enumera los comandantes desde
      // `commandList` (no desde el battlefield), así que el frame que prueba el
      // daño de comandante en la UI es el de la carta en la zona de mando con
      // la línea "did N combat damage..." en rules.
      const bfLine = commanderDamageLine(Object.values(me.battlefield ?? {}))
      if (!this._bolted && bfLine && ctx.cardInHand('Lightning Bolt') && krenkoOnBattlefield(me)) {
        this._bolted = true
        ctx.log('onSelect: Bolt a mi Krenko → vuelve a la zona de mando')
        ctx.playCardByName('Lightning Bolt')
        return
      }

      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true) {
        const krenko = krenkoOnBattlefield(me)
        if (!krenko) {
          ctx.pass()
          return
        }
        const chosen = this._targetSim
        const declared =
          chosen !== null &&
          (gv.combat ?? []).some(
            (g) =>
              g.defenderId === chosen &&
              Object.values(g?.attackers ?? {}).some((c) => /krenko, mob boss/i.test(c?.name ?? '')),
          )
        if (declared) {
          ctx.log('onSelect: ataque a comandante declarado, confirmo (false)')
          ctx.pass()
          return
        }
        if (this._attackSentTurn !== gv.turn) {
          this._attackSentTurn = gv.turn
          ctx.log('onSelect: ataco con Krenko; el defensor se elige en el GAME_TARGET')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: krenko[0] })
          return
        }
        ctx.pass()
        return
      }

      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del turno).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (8 Montañas al campo + Lightning Bolt)')
        void ctx.cheatSetup({ hand: ['Lightning Bolt'], battlefield: Array(8).fill('Mountain') })
        return
      }
      // Krenko se LANZA desde la zona de mando ({2}{R}{R}); cheatearlo crearía
      // otra copia (id distinto) y el watcher de daño de comandante no la vería.
      const cmd = commandZoneEntry(me)
      if (!this._cast && cmd && ctx.untappedMana() >= 4) {
        this._cast = true
        ctx.log('onSelect: Krenko desde la zona de mando ({2}{R}{R})')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: cmd.id })
        return
      }
      ctx.pass()
    },
    // Al morir un comandante, el reemplazo de zona pregunta "Move <cmd> to the
    // command zone?" (GAME_ASK sin default de motor): SÍ.
    onAsk(question, ctx) {
      if (/command zone/i.test(String(question ?? ''))) {
        ctx.log('onAsk: comandante → zona de mando SÍ')
        return true
      }
      return undefined
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const candidates = Array.isArray(pt) ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean) : Object.keys(pt ?? {})
      if (/attack/i.test(q)) {        const sims = (ctx.gv?.players ?? []).filter((p) => !p?.controlled)
        // El ÚLTIMO SIM (no el primero): el caso que el preview del overlay no
        // cubre en pod.
        const chosen = sims[sims.length - 1]
        const id = chosen?.playerId ?? chosen?.id
        if (id) {
          this._targetSim = String(id)
          ctx.log('onTarget: defensor → último SIM', chosen?.name, '(cands=', candidates.length, ')')
          return String(id)
        }
      }
      // El Bolt de salida apunta a nuestro propio Krenko (3/3 → cementerio →
      // zona de mando).
      if (this._bolted) {
        const krenko = Object.entries(ctx.me?.battlefield ?? {}).find(([, c]) =>
          /krenko, mob boss/i.test(c?.name ?? ''),
        )
        if (krenko) {
          ctx.log('onTarget: Bolt → mi Krenko')
          return krenko[0]
        }
      }
      return candidates[0] ?? undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      // Solo cuenta la línea en la ZONA DE MANDO (es la que pinta la matriz).
      const line = commanderDamageLine(commandZoneCards(me))
      if (!line) return false
      const sims = (gv.players ?? []).filter((p) => !p?.controlled)
      const lastSim = sims[sims.length - 1]
      if (!lastSim) return false
      if (String(lastSim.name ?? '').toLowerCase() !== line.playerName.toLowerCase()) return false
      return Number(lastSim.life) === 40 - line.dmg
    },
  }
}

export const drivers = { 'commander-4': makeCommander4Driver }

export const meta = {
  mechanic: 'commander-4',
  kind: 'game',
  assert: 'hasPodCommander',
  note: 'Commander FFA de 4 (1 humano + 3 SIM) con mazo legal (99 Montañas + Krenko, Mob Boss). SONDA DE CONTRATO 2026-09-17: el daño de comandante NO tiene campo en el view (`PlayerView`/`GameView`/`CommanderView` no lo exponen; vive en `CommanderInfoWatcher.damageToPlayer` del motor) — viaja SOLO como info del cardState en `rules` de la carta/permanente del comandante ("Commander did N combat damage to player <nombre>."), que el web parsea en `CommanderDamageMatrix.extractDamage`. Krenko se lanza DESDE LA ZONA DE MANDO (cheatearlo crearía otra copia con id distinto que el watcher no ve) con 8 Montañas cheateadas y ataca al ÚLTIMO SIM con `attackOption: MULTIPLE` (el default LEFT no genera GAME_TARGET, ver pod-combat); después un Lightning Bolt propio lo manda de vuelta a la zona de mando, que es donde el CardView conserva la línea de daño (la matriz enumera comandantes desde commandList, no desde el battlefield). Captura: Krenko en commandList con la línea de daño y la vida del último SIM 40−N.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCommander4Driver())
}
