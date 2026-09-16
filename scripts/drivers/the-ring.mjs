import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — The Ring tempts you (§3.10: "Monarch, initiative/dungeon, the ring,
// emblemas | Indicadores"): Uruk-hai Berserker (LTR 112, {2}{B}, 3/2 Orco
// Berserker; EntersBattlefieldTriggeredAbility → TheRingTemptsYouEffect →
// GameImpl.temptWithTheRing) + 2×Ranger's Firebrand (LTR 143, {R} sorcery:
// 2 daño a cualquier objetivo y después "the Ring tempts you"). Mazo
// Swamp/Mountain: T1 tierra (acción normal previa al cheat) + cheatSetup
// (Berserker + 2 Firebrands a la MANO, 2 Swamps + 2 Mountains al campo = 5
// manás) y se lanzan encadenados: nivel 1 (Berserker), 2 y 3 (Firebrands).
//
// SONDA DE CONTRATO (§3.10): el Anillo NO tiene campo numérico de nivel.
// temptWithTheRing → getOrCreateTheRing añade un TheRingEmblem (Emblem) al
// command zone y por cada tentación TheRingEmblem.addNextAbility añade UNA
// habilidad (nivel 1 = estática legendary+evasión; 2 = trigger de ataque y
// robo; 3 = trigger de bloqueo/ sacrificio; 4 = trigger de daño/lose 3).
// PlayerView lo proyecta en players[].commandList como EmblemView
// (PlayerView.java:117-121) con `rules = emblem.getAbilities().getRules()`,
// así que el nivel se DERIVA de rules.length (el web hace exactamente eso:
// MechanicsTray.tsx "level = min(4, max(1, rules.length))").
// El portador (Ring-bearer) tampoco tiene booleano propio en el view:
// PermanentView NO expone isRingBearer/ringBearer; CardView.java:754 lo
// comunica SOLO como icono: cardIcons [{cardIconType:"RINGBEARER",
// hint:"Ring-bearer"}]. HALLAZGO: el findRingBearer de MechanicsTray busca
// `p.isRingBearer || p.ringBearer` en el permanente — campos que el servidor
// NUNCA envía; la evidencia real es cardIcons[].cardIconType === RINGBEARER.
//
// Con UNA sola criatura (el Berserker) PlayerImpl.chooseRingBearer toma la
// rama `ids.size()==1` y NO abre prompt en ninguna de las 3 tentaciones: la 1ª
// fija al Berserker como portador ("has chosen ... as Ring-bearer") y las
// siguientes lo mantienen ("did not choose a new Ring-bearer", 0 GAME_ASK en la
// run). El hook onAsk cubre el caso con ≥2 criaturas (chooseUse "Choose a new
// Ring-bearer?" → false = mantener). Invariante del frame: commandList con
// The Ring (rules.length>=3, nivel 3), el Berserker con cardIcons RINGBEARER,
// los 2 Firebrands en el cementerio y pila vacía.
function makeTheRingDriver() {
  return {
    name: 'the-ring',
    outFile: 'the-ring.json',
    deck: {
      name: 'Mage Web the ring rec',
      cards: [
        { cardName: 'Swamp', setCode: 'iko', cardNumber: '266', amount: 40 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _castBerserker: false,
    _firebrands: 0,
    _ringAsks: 0,
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
        ctx.log("onSelect: cheatSetup (Berserker + 2 Firebrands a la mano, 2 Swamps + 2 Mountains al campo)")
        void ctx.cheatSetup({
          hand: ['Uruk-hai Berserker', "Ranger's Firebrand", "Ranger's Firebrand"],
          battlefield: ['Swamp', 'Swamp', 'Mountain', 'Mountain'],
        })
        return
      }
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      // El Berserker primero: su ETB es la 1ª tentación y, al ser la única
      // criatura, queda Ring-bearer sin prompt (nivel 1).
      if (!this._castBerserker && ctx.cardInHand('Uruk-hai Berserker') && ctx.untappedMana() >= 3 && stackEmpty) {
        this._castBerserker = true
        ctx.log('onSelect: lanzo Uruk-hai Berserker')
        ctx.playCardByName('Uruk-hai Berserker')
        return
      }
      // Firebrands a continuación ({R} cada uno, quedan 2 Montañas sin girar):
      // tentaciones 2ª y 3ª → nivel 3.
      if (this._castBerserker && this._firebrands < 2 && ctx.cardInHand("Ranger's Firebrand") && stackEmpty) {
        this._firebrands += 1
        ctx.log('onSelect: lanzo Ranger\'s Firebrand #' + this._firebrands)
        ctx.playCardByName("Ranger's Firebrand")
        return
      }
      ctx.pass()
    },
    // Defensivo (no se dispara en esta run): con ≥2 criaturas elegibles
    // PlayerImpl.chooseRingBearer abre chooseUse "Choose a new Ring-bearer?"
    // (Yes/No) → false = mantener al portador; no abre target. Con 1 criatura
    // la rama ids.size()==1 evita el prompt. undefined deja actuar al default
    // (mulligan).
    onAsk(question) {
      const q = String(question ?? '')
      if (/ring-bearer/i.test(q)) {
        this._ringAsks += 1
        return false
      }
      return undefined
    },
    // "2 daño a cualquier objetivo": TargetAnyTarget → se elige al jugador del
    // SIM (si está entre los objetivos legales) para no dañar al portador.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
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
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      const sim = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      if (sim?.playerId && ids.includes(sim.playerId)) {
        ctx.log('onTarget: 2 daño al jugador del SIM')
        return sim.playerId
      }
      if (ids[0]) {
        ctx.log('onTarget: objetivo por defecto', String(q).slice(0, 40))
        return ids[0]
      }
      return undefined
    },
    // Pago con el color pedido en el prompt ("{2}{B}" / "{R}"): se gira la
    // tierra del color del primer símbolo del texto sin pagar; genérico =
    // cualquier tierra sin girar.
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const colors = [
        ['W', 'Plains'],
        ['U', 'Island'],
        ['B', 'Swamp'],
        ['R', 'Mountain'],
        ['G', 'Forest'],
      ]
      const need = colors.find(([c]) => msg.includes('{' + c + '}'))?.[1]
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped)
      const pick = need
        ? bf.find((c) => new RegExp(need, 'i').test(String(c?.name ?? c?.displayName ?? '')))
        : null
      const land = pick ?? bf.find((c) => (c.cardTypes ?? []).includes('LAND'))
      if (land) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: land.id })
        ctx.log('onPlayMana: giro', land.name, msg.slice(0, 30))
      }
    },
    // Invariante: The Ring en players[].commandList con >=3 reglas (nivel 3
    // derivado de rules.length), el Berserker con cardIcons RINGBEARER (la
    // ÚNICA vía del portador), los 2 Firebrands en el cementerio y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const list = Array.isArray(me.commandList) ? me.commandList : Object.values(me.commandList ?? {})
      const ring = list.find((c) => /^the ring/i.test(String(c?.name ?? '')))
      if (!ring) return false
      const rules = Array.isArray(ring.rules) ? ring.rules : []
      const bearer = Object.values(me.battlefield ?? {}).some((c) =>
        (c?.cardIcons ?? []).some((ic) => String(ic?.cardIconType ?? '').toUpperCase() === 'RINGBEARER'),
      )
      const firebrands = Object.values(me.graveyard ?? {}).filter((c) =>
        /ranger'?s firebrand/i.test(String(c?.name ?? c?.displayName ?? '')),
      ).length
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      return rules.length >= 3 && bearer && firebrands >= 2 && stackEmpty
    },
  }
}

export const drivers = { 'the-ring': makeTheRingDriver }

export const meta = {
  mechanic: 'the-ring',
  kind: 'game',
  assert: 'hasTheRing',
  note: 'Uruk-hai Berserker (LTR 112, {2}{B} 3/2; ETB "the Ring tempts you") + 2×Ranger\'s Firebrand (LTR 143, {R} sorcery: 2 daño a cualquier objetivo — GAME_TARGET "Select any target" con 3 UUIDs legales, se elige el del SIM — y "the Ring tempts you") lanzados de verdad vía cheatSetup (cartas a la mano + 2 Swamps/2 Mountains al campo; maná pagado con el color pedido en GAME_PLAY_MANA: {2}{B}→Swamp, {R}→Mountain) contra el SIM pasivo: nivel 1 → 2 → 3 en el T1. Con UNA criatura PlayerImpl.chooseRingBearer toma ids.size()==1 y NO abre prompt en ninguna tentación (0 GAME_ASK en la run): la 1ª fija al Berserker como portador y las siguientes informan "did not choose a new Ring-bearer"; el hook onAsk cubre el caso ≥2 criaturas (chooseUse "Choose a new Ring-bearer?" → false). CONTRATO (hallazgo): el Anillo NO tiene nivel ni portador como campos propios. El nivel se DERIVA de players[].commandList → EmblemView "The Ring" con `rules` (una línea por habilidad añadida por TheRingEmblem.addNextAbility: nivel 1 = estática legendary+evasión en UNA regla, niveles 2/3/4 = triggers; el web hace level = min(4, max(1, rules.length)), MechanicsTray.tsx). El Ring-bearer NO está en el view como booleano: PermanentView no expone isRingBearer/ringBearer; CardView.java:754 lo pinta SOLO como icono cardIcons [{cardIconType:"RINGBEARER", hint:"Ring-bearer"}] (el findRingBearer de MechanicsTray busca isRingBearer/ringBearer, campos inexistentes — bug latente del cliente; la vía real es cardIcons). Invariante del frame: The Ring en commandList con rules.length=3, cardIcons RINGBEARER en el Berserker, 2 Firebrands en el cementerio y pila vacía. Driver the-ring con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTheRingDriver())
}
