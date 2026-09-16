import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Sagas, clases, casos (§3.9) via cheatSetup: Wizard Class ({U},
// enchantment Class) al campo y subida de nivel REAL activando la habilidad
// "Gain a level" del propio permanente (clic en el permanente, que responde
// GAME_CHOOSE_ABILITY cuando hay varias habilidades jugables y, con una sola,
// dispara la activación directa). Las ClassLevelAbility(2, "{2}{U}") y
// ClassLevelAbility(3, "{4}{U}") solo son activables cuando el nivel actual es
// exactamente level-1 (canActivate exige permanent.getClassLevel() == level-1)
// y son SORCERY (solo en main propia con la pila vacía).
//
// Maná: 8 Islas cheateadas al campo + la Isla jugada como acción normal previa
// al cheat (regla P1) = 9 maná desgirado: {U} (lanzar) + {2}{U} (nivel 2) +
// {4}{U} (nivel 3) = 9 exacto. El pago se hace girando Islas una a una
// (sendPlayerUUID de la fuente en GAME_PLAY_MANA; los flags de la vista no son
// fiables durante el pago).
//
// El nivel actual NO está en counters/classLevel: la vista lo expone SOLO como
// hint en rules ("Class level: N", HintUtils.HINT_START_MARK + clase
// ClassLevelHint adjunta en ClassReminderAbility; CardView/CardUtil lo vuelca
// en la lista rules). El web lo parsea a un badge (board/designations.ts,
// CLASS_LEVEL_RE = /^class level:\s*(\d+)\s*\.?$/i). El driver lo parsea igual
// para decidir el siguiente clic y el invariante.
//
// Al subir a 2, el trigger BecomesClassLevelTriggeredAbility roba 2 cartas: la
// pila no queda vacía, así que el clic para nivel 3 espera a pila vacía (la
// activación es sorcery). Wizard Class no tiene trigger al nivel 3, así que la
// captura llega en el GAME_UPDATE de la resolución del nivel 3.
function makeClassLevelDriver() {
  return {
    name: 'class-level',
    outFile: 'class-level.json',
    deck: {
      name: 'Mage Web class-level rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheatStarted: false,
    _cast: false,
    _clickedForLevel: 0,
    _clickedAt: 0,
    _clickAttempts: 0,
    // Nivel de clase desde el hint de rules ("Class level: N"); null si no está.
    classLevel(card) {
      for (const r of card?.rules ?? []) {
        const m = /class level:\s*(\d+)/i.exec(String(r).replace(/<[^>]+>/g, ''))
        if (m) return Number(m[1])
      }
      return null
    },
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
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheatStarted) {
        this._cheatStarted = true
        ctx.log('onSelect: cheatSetup (Wizard Class en mano + 8 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Wizard Class'],
          battlefield: ['Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      const wc = Object.values(me.battlefield ?? {}).find((c) => /wizard class/i.test(c?.name ?? ''))
      if (!wc) {
        if (!this._cast && ctx.cardInHand('Wizard Class')) {
          this._cast = true
          ctx.log('onSelect: lanzo Wizard Class')
          ctx.playCardByName('Wizard Class')
          return
        }
        ctx.pass()
        return
      }
      const level = this.classLevel(wc)
      if (level == null || level >= 3) {
        ctx.pass()
        return
      }
      // Level-up = sorcery: la pila (trigger de robo del nivel 2) debe estar vacía.
      if (Object.keys(gv.stack ?? {}).length > 0) {
        ctx.pass()
        return
      }
      const stale = this._clickedForLevel === level && Date.now() - this._clickedAt > 4_000
      if (this._clickedForLevel !== level || stale) {
        if (stale && this._clickAttempts >= 3) {
          ctx.pass()
          return
        }
        this._clickedForLevel = level
        this._clickedAt = Date.now()
        this._clickAttempts += 1
        ctx.log('onSelect: clic en Wizard Class para subir a nivel', level + 1)
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: wc.id })
        return
      }
      ctx.pass()
    },
    // Si el clic abre GAME_CHOOSE_ABILITY (varias habilidades jugables), elegir
    // la del nivel siguiente al clicado; con una sola habilidad el servidor
    // activa directo y este hook no llega.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility:', JSON.stringify(opts).slice(0, 250))
      const want = this._clickedForLevel === 1 ? /level\s*2/i : /level\s*3/i
      const hit = (opts ?? []).find((o) => want.test(String(o?.label ?? '')))
      return (hit ?? (opts ?? [])[0])?.value
    },
    // Pago {U}/{2}{U}/{4}{U} girando Islas sin desgirar (los flags de la vista
    // no son fiables durante el pago: pago manual, patrón energy/trample).
    onPlayMana(ctx) {
      const island = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /^island$/i.test(c?.name ?? ''))
      if (island) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: island.id })
        ctx.log('onPlayMana: giro', island.name)
      }
    },
    // Descarte de limpieza (si la captura no llegara antes): una carta de mano
    // distinta por prompt para no repetir UUID (mismo UUID = rechazo en bucle).
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const pick = Object.entries(hand).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: descarte limpieza', pick[1]?.name)
          return pick[0]
        }
        return false
      }
      return undefined
    },
    // Invariante: Wizard Class propia en el campo con nivel 3 visible en rules
    // ("Class level: 3").
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const wc = Object.values(me?.battlefield ?? {}).find((c) => /wizard class/i.test(c?.name ?? ''))
      return this.classLevel(wc) === 3
    },
  }
}

export const drivers = { 'class-level': makeClassLevelDriver }

export const meta = {
  mechanic: 'class-level',
  kind: 'game',
  assert: 'hasClassLevel',
  note: 'Wizard Class ({U}, enchantment Class) vía cheatSetup (T1: tierra + Wizard Class a la mano + 8 Islas al campo, 9 maná exacto para {U}+{2}{U}+{4}{U}) y subida de nivel REAL: clic en el permanente (sendPlayerUUID) → activación de la ClassLevelAbility (GAME_CHOOSE_ABILITY si hay varias; GAME_PLAY_MANA por cada maná, las Islas se giran una a una) → nivel 2 (trigger de robo: se espera a pila vacía) → clic de nuevo → nivel 3. El nivel NO vive en counters ni en un campo classLevel de la vista: llega como hint en rules ("Class level: N", ClassLevelHint adjunta en ClassReminderAbility y volcada por CardUtil.getCardRulesWithAdditionalInfo; el web lo parsea a badge con CLASS_LEVEL_RE), y el driver lo parsea igual. Captura: Wizard Class propia con rules conteniendo "Class level: 3". Driver class-level con cheatSetup + activación real.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeClassLevelDriver())
}
