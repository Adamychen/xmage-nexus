import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Initiative/Dungeon (§3.10: "Monarch, initiative/dungeon, the ring,
// emblemas | Indicadores"): Cloister Gargoyle (AFR 7, {2}{W}, 0/4
// artefacto-criatura; EntersBattlefieldTriggeredAbility → VentureIntoTheDungeonEffect
// SIN objetivos). Mazo de 60 Llanuras: T1 tierra (acción normal previa al cheat) +
// cheatSetup (2 Gargoyles a la MANO + 4 Llanuras al campo = 5 manás) y se lanza el
// primero; T2 se lanza el segundo (mismo camino, ya con la mazmorra activa) para
// disparar la rama de elección de sala.
//
// SONDA DE CONTRATO (§3.10): la mazmorra SÍ viaja estructurada en el view. Es un
// CommandObject (GameImpl.addDungeon → state.addCommandObject) y PlayerView lo
// proyecta en `players[].commandList` como DungeonView (PlayerView.java:122-126:
// "commandList.add(new DungeonView(dungeon))" solo si el dungeon es del jugador).
// DungeonView = {id, name, imageFileName, imageNumber, expansionSetCode, rules,
// playableStats}; NO hay campo currentRoom ni el grafo de salas: el estado actual
// se deduce de `rules[0]` = "<i>(Currently in <sala>)</i>" (Dungeon.getRules) y el
// grafo es estático (web/src/game/dungeons.ts, transcrito 1:1 del servidor).
// El web ADEMÁS hace tracking propio por dos vías: (a) el prompt de rama
// "Choose which room to go to in" + secondMessage "dungeon: <nombre>" (GAME_ASK
// de DungeonRoom.chooseNextRoom → chooseUse con botones UI.left/right.btn.text =
// salas; el web lo sniffa en useFeedbackForm.ts → recordDungeonRoom) y (b) el
// broadcast GAME_UPDATE_AND_INFORM/GAME_INFORM_PERSONAL "X has entered <sala>
// (dungeon: <nombre>)" de Dungeon.moveToNextRoom → sniffDungeonEntry.
//
// Flujo del frame capturado: 1ª aventura → selectDungeon abre GAME_CHOOSE_CHOICE
// en modo string ("Choose a dungeon to venture into", choice.choices = los 3
// nombres; se responde el texto EXACTO "Lost Mine of Phandelver") y la primera
// sala (Cave Entrance) entra automática (su Scry 1 llega como GAME_TARGET
// opcional y se declina). 2ª aventura → Cave Entrance tiene 2 salidas →
// GAME_ASK "Choose which room to go to in" (true = Goblin Lair, false = Mine
// Tunnels) y se entra en Goblin Lair (crea un Goblin 1/1). Invariante del frame:
// commandList con la Lost Mine y rules "Currently in Goblin Lair", pila vacía y
// los 2 Gargoyles en el campo.
function makeDungeonDriver() {
  return {
    name: 'dungeon',
    outFile: 'dungeon.json',
    deck: {
      name: 'Mage Web dungeon rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _casts: 0,
    _dungeonChosen: false,
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
        ctx.log('onSelect: cheatSetup (2 Cloister Gargoyle a la mano + 4 Llanuras al campo)')
        void ctx.cheatSetup({
          hand: ['Cloister Gargoyle', 'Cloister Gargoyle'],
          battlefield: ['Plains', 'Plains', 'Plains', 'Plains'],
        })
        return
      }
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      // El 1º se lanza en T1 (5 Llanuras sin girar) y el 2º en T2 tras el untap,
      // para que la segunda aventura encuentre la mazmorra ya activa y abra la
      // rama de sala.
      if (this._casts < 2 && ctx.cardInHand('Cloister Gargoyle') && ctx.untappedMana() >= 3 && stackEmpty) {
        this._casts += 1
        ctx.log('onSelect: lanzo Cloister Gargoyle #' + this._casts)
        ctx.playCardByName('Cloister Gargoyle')
        return
      }
      ctx.pass()
    },
    // La rama "Choose which room to go to in" de DungeonRoom.chooseNextRoom llega
    // como GAME_ASK (chooseUse con trueText=primera salida, falseText=segunda);
    // true = Goblin Lair (la rama que queremos). undefined deja actuar al default
    // de la librería (mulligan, etc.).
    onAsk(question) {
      const q = String(question ?? '')
      if (/choose which room/i.test(q)) return true
      return undefined
    },
    // selectDungeon ("Choose a dungeon to venture into") es un GAME_CHOOSE_CHOICE
    // con ChoiceImpl(required=true, hintType=CARD_DUNGEON) en modo string (la
    // lista entera va en choice.choices, keyChoices vacío) → se responde el texto
    // EXACTO. Lost Mine of Phandelver garantiza rama binaria en la 1ª sala.
    onChooseChoice(opts, ctx) {
      if (this._dungeonChosen) return undefined
      this._dungeonChosen = true
      ctx.log('onChooseChoice: elijo mazmorra "Lost Mine of Phandelver"')
      return 'Lost Mine of Phandelver'
    },
    // Scry 1 de Cave Entrance: TargetCard(0..1) opcional ("Select up to one card
    // to PUT on the BOTTOM (Scry)") → declinar con false. Descarte de limpieza:
    // primera carta de la mano (obligatorio).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/scry|put on the bottom/i.test(q)) {
        ctx.log('onTarget: scry de Cave Entrance → declino')
        return false
      }
      if (/discard/i.test(q)) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        ctx.log('onTarget: descarte de limpieza')
        return first ?? false
      }
      return undefined
    },
    // Pago {2}{W}: Llanuras sin girar (las 5 son Llanuras).
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped)
      const plains = bf.find((c) => /plains/i.test(String(c?.name ?? c?.displayName ?? '')))
      const pick = plains ?? bf.find((c) => (c.cardTypes ?? []).includes('LAND'))
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, String(m?.data?.message ?? '').slice(0, 40))
      }
    },
    // Invariante: la Lost Mine está en players[].commandList (DungeonView) con
    // rules[0] "(Currently in Goblin Lair)", pila vacía y los 2 Gargoyles en el
    // campo (prueba de que la 2ª aventura resolvió).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const list = Array.isArray(me.commandList) ? me.commandList : Object.values(me.commandList ?? {})
      const dungeon = list.find((c) => /lost mine of phandelver/i.test(String(c?.name ?? '')))
      if (!dungeon) return false
      const rules = Array.isArray(dungeon.rules) ? dungeon.rules : []
      const inGoblinLair = rules.some((r) => /currently in goblin lair/i.test(String(r)))
      const gargoyles = Object.values(me.battlefield ?? {}).filter((c) =>
        /cloister gargoyle/i.test(String(c?.name ?? c?.displayName ?? '')),
      ).length
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      return inGoblinLair && gargoyles === 2 && stackEmpty
    },
  }
}

export const drivers = { dungeon: makeDungeonDriver }

export const meta = {
  mechanic: 'dungeon',
  kind: 'game',
  assert: 'hasDungeon',
  note: 'Cloister Gargoyle (AFR 7, {2}{W}: ETB "venture into the dungeon", sin objetivos) lanzado de verdad x2 vía cheatSetup (2 a la mano + 4 Llanuras al campo; {2}{W} pagado con Llanuras UUID en GAME_PLAY_MANA) contra el SIM pasivo. 1ª aventura: selectDungeon abre GAME_CHOOSE_CHOICE en modo string ("Choose a dungeon to venture into", choice.choices = los 3 nombres, keyChoices vacío) y se responde el texto EXACTO "Lost Mine of Phandelver"; la 1ª sala (Cave Entrance) entra automática y su Scry 1 llega como GAME_TARGET opcional (TargetCard 0..1 "to PUT on the BOTTOM (Scry)") que se declina con sendPlayerBoolean(false). 2ª aventura: DungeonRoom.chooseNextRoom abre GAME_ASK "Choose which room to go to in" (chooseUse con UI.left/right.btn.text = Goblin Lair / Mine Tunnels) y true entra en Goblin Lair (Goblin 1/1). CONTRATO: la mazmorra SÍ viaja estructurada — es un CommandObject y PlayerView la proyecta en players[].commandList como DungeonView {id,name,imageFileName,imageNumber,expansionSetCode,rules,playableStats} (PlayerView.java:122-126); NO hay campo currentRoom ni grafo: la sala actual es rules[0]="<i>(Currently in <sala>)</i>" (Dungeon.getRules) y el grafo es estático en el cliente (web/src/game/dungeons.ts). Además el servidor informa "X has entered <sala> (dungeon: <nombre>)" (GAME_UPDATE_AND_INFORM) y el prompt de rama es la vía que el web sniffa (recordDungeonRoom). Invariante del frame: commandList con Lost Mine of Phandelver, rules con "Currently in Goblin Lair", 2 Cloister Gargoyle en mi campo y pila vacía. Driver dungeon con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDungeonDriver())
}
