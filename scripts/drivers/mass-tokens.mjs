import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.9 fichas masivas (50+): Krenko, Mob Boss (M13 {2}{R}{R}, 3/3
// legendario Goblin Warrior) con "{T}: Create X 1/1 red Goblin creature
// tokens, where X is the number of Goblins you control"
// (SimpleActivatedAbility + TapSourceCost + CreateTokenEffect + GoblinToken,
// "Goblin Token" 1/1 rojo isToken:true).
//
// Secuencia: mazo 60 Mountains; T1 tierra + UN cheatSetup con Krenko y 50 ×
// 'Raging Goblin' (el cheat crea una Card nueva por cada nombre repetido en la
// lista: GameController.createCheatCard → info.createCard(), y
// game.cheat(...) mueve cada una con putCardOntoBattlefieldWithEffects; los
// permanentes cheateados entran sin mareo, hallazgo ya bisecado). Con 51
// Goblins en el campo (Krenko cuenta: PermanentsOnBattlefieldCount(SubType.GOBLIN)
// sobre FilterControlledPermanent) la habilidad crea 51 fichas Goblin Token →
// 102 permanentes, de sobra para el umbral 50+ de la fila.
//
// Activación: clic en Krenko (ctx.playAbility); la habilidad es un
// SimpleActivatedAbility sin objetivo ni coste de maná (solo {T}), así que no
// hay prompts extra: la resolución deja las 51 fichas en el mismo turno.
function makeMassTokensDriver() {
  return {
    name: 'mass-tokens',
    outFile: 'mass-tokens.json',
    deck: {
      name: 'Mage Web mass tokens rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _activated: false,
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
      // Regla P1: cheat tras ≥1 acción normal (la tierra del T1). Duplicados
      // del MISMO nombre en battlefield funcionan (una Card nueva por entrada).
      if (!this._cheated) {
        this._cheated = true
        const goblins = Array.from({ length: 50 }, () => 'Raging Goblin')
        ctx.log('onSelect: cheatSetup (Krenko + 50 Raging Goblin al campo)')
        void ctx.cheatSetup({ battlefield: ['Krenko, Mob Boss', ...goblins] })
        return
      }
      // Activar la habilidad de Krenko: clic en el permanente (los cheateados
      // entran sin mareo). Sin coste de maná: {T} y a crear fichas.
      const krenko = Object.values(me.battlefield ?? {}).find(
        (c) => /krenko/i.test(String(c?.name ?? '')) && c?.tapped !== true,
      )
      if (krenko && !this._activated) {
        this._activated = true
        ctx.log('onSelect: activo la habilidad de Krenko (clic)')
        ctx.playAbility('Krenko, Mob Boss', ['other', 'basicPlayAbilities'])
        return
      }
      ctx.pass()
    },
    // Si el clic abre el picker (p.ej. junto a alguna habilidad añadida), la
    // opción útil es la que crea las fichas.
    onChooseAbility(opts, ctx) {
      const k = (opts ?? []).find((o) => /goblin/i.test(String(o?.label ?? '')))
      if (k) {
        ctx.log('onChooseAbility: habilidad de Krenko')
        return k.value ?? k.id
      }
      return (opts ?? [])[0]?.value
    },
    // Descarte de limpieza, si la partida se alargara: una Montaña.
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
    // Invariante: ≥40 fichas Goblin (isToken:true, name "Goblin Token") en el
    // campo propio — con X=51 el frame las trae todas.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const tokens = Object.values(me?.battlefield ?? {}).filter(
        (c) => c?.isToken === true && /goblin/i.test(String(c?.name ?? '')),
      )
      return tokens.length >= 40
    },
  }
}

export const drivers = { 'mass-tokens': makeMassTokensDriver }

export const meta = {
  mechanic: 'mass-tokens',
  file: 'mass-tokens.json',
  kind: 'game',
  assert: 'hasMassTokens',
  note: 'Krenko, Mob Boss + 50 × Raging Goblin al campo propio en un único cheatSetup (los duplicados del mismo nombre sí funcionan: una Card nueva por entrada de la lista; los permanentes cheateados entran sin mareo) contra el SIM pasivo. Se clica Krenko para activar "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control" (PermanentsOnBattlefieldCount(SubType.GOBLIN): Krenko también cuenta) sin coste de maná ni objetivo; resuelve 51 Goblin Token (isToken:true, "Goblin Token" 1/1 rojo) → 102 permanentes en el campo propio, frame de agrupación/rendimiento para la fila §3.9 (fichas masivas 50+). Captura: battlefield propio con ≥40 fichas cuyo nombre contiene "goblin". Driver mass-tokens con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeMassTokensDriver())
}
