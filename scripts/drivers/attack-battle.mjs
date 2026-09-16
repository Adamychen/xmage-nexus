import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — atacar a una batalla (§3.6 fila "Atacar a planeswalker o batalla"):
// Grizzly Bears (2/2 vanilla) propio cheateado al campo ataca a Invasion of
// Gobakhan ({1}{W}, Battle — Siege, startingDefense 3), también cheateada al
// campo PROPIO en el mismo cheatSetup (mismo jugador: un solo cheat).
//
// HALLAZGO (bisecado en el fuente): la batalla debe quedar en NUESTRO campo, no
// en el del SIM. Combat.setDefenders (Combat.java:1389-1393) añade batallas con
// FilterBattlePermanent + ProtectedByOpponentPredicate: una batalla es defensor
// legal para el atacante P solo si su protector ∈ oponentes(P). Con la batalla
// del SIM el protector es SIEMPRE el humano (PermanentImpl.chooseProtector elige
// al único oponente sin preguntar en duelo) y el humano no puede atacarla
// (ProtectedByOpponentPredicate false); con la batalla propia el protector es el
// SIM y sí se puede — el recordatorio de Siege lo dice: "You and others can
// attack it".
//
// El cheat directo al campo no dispara ETB triggers (CardUtil
// putCardOntoBattlefieldWithEffects "without ETB") pero SÍ pasa por
// PermanentImpl.entersBattlefield: añade los contadores DEFENSE
// (startingDefense=3) y llama a chooseProtector (automático en duelo, sin
// prompt de "as it enters").
//
// Elección de defensor: al enviar el UUID del Grizzly con 2 defensores posibles
// (jugador SIM + batalla) HumanPlayer.selectDefender (HumanPlayer.java:2020-2050)
// abre un TargetDefender (FilterDefender "player, planeswalker, or battle to
// attack") → GAME_TARGET; se responde sendPlayerUUID del id de la batalla —
// eso ES el clic en la batalla — y la declaración se cierra con
// sendPlayerBoolean(false) (botón ok; NUNCA 'special' con 2+ defensores: abre
// otro target de "all attack", HumanPlayer:1855).
//
// Invariante: step COMBAT_DAMAGE, la batalla propia con defense "1" (contadores
// DEFENSE 3→1 por los 2 de daño; PermanentImpl.damage 1192-1199 quita
// contadores DEFENSE al recibir daño) y gv.combat[] con defenderId = UUID de la
// batalla, defenderName "Invasion of Gobakhan" y el Grizzly en attackers; pila
// vacía.
function makeAttackBattleDriver() {
  return {
    name: 'attack-battle',
    outFile: 'attack-battle.json',
    deck: {
      name: 'Mage Web attack-battle rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _attackSentTurn: -1,
    myBattle(ctx) {
      const me = ctx.me
      for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
        if ((c?.cardTypes ?? []).includes('BATTLE')) return { id, name: c.name, defense: c.defense }
      }
      return null
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true) {
        const battle = this.myBattle(ctx)
        const grizzly = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
        )
        const attackingBattle =
          battle !== null &&
          (gv.combat ?? []).some(
            (g) =>
              g?.defenderId === battle.id &&
              Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
          )
        // Ya está declarado el ataque a la batalla: confirmar con el botón ok
        // (boolean false). NUNCA 'special' aquí: con >1 defensor ese camino
        // abre otro GAME_TARGET de "all attack" (HumanPlayer:1855).
        if (attackingBattle) {
          ctx.log('onSelect: ataque a la batalla declarado, confirmo (false)')
          ctx.pass()
          return
        }
        if (grizzly && battle && this._attackSentTurn !== gv.turn) {
          this._attackSentTurn = gv.turn
          ctx.log('onSelect: ataco con Grizzly; la batalla se elige en el GAME_TARGET')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: grizzly[0] })
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
      // Regla P1: el primer cheat va tras ≥1 acción normal (la tierra del T1).
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
        ctx.log('onSelect: cheatSetup (Grizzly Bears + Invasion of Gobakhan propios)')
        void ctx.cheatSetup({ battlefield: ['Grizzly Bears', 'Invasion of Gobakhan'] }).then((r) => {
          ctx.log('onSelect: cheat →', JSON.stringify({ ok: r?.ok === true }))
        })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        return Object.keys(hand)[0] ?? false
      }
      // El defensor del ataque: TargetDefender (FilterDefender) pregunta
      // "Select a player, planeswalker, or battle to attack" y las opciones
      // incluyen el id de la batalla. Se responde con el UUID de la batalla:
      // eso ES el clic en la batalla.
      const battle = this.myBattle(ctx)
      if (battle && /attack/i.test(q)) {
        ctx.log('onTarget: defensor → batalla', battle.name)
        return battle.id
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      let battleId = null
      let battle = null
      for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
        if ((c?.cardTypes ?? []).includes('BATTLE')) {
          battleId = id
          battle = c
        }
      }
      if (!battleId || !battle) return false
      const defense = Number(battle.defense)
      if (!Number.isFinite(defense) || defense >= 3) return false
      if (Object.keys(gv.stack ?? {}).length > 0) return false
      return (gv.combat ?? []).some(
        (g) =>
          g?.defenderId === battleId &&
          Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
      )
    },
  }
}

export const drivers = { 'attack-battle': makeAttackBattleDriver }

export const meta = {
  mechanic: 'attack-battle',
  kind: 'game',
  assert: 'hasAttackBattle',
  note: 'Batalla Invasion of Gobakhan ({1}{W}, Battle — Siege, startingDefense 3) cheateada al campo PROPIO junto a Grizzly Bears 2/2 en un único cheatSetup (mismo jugador) y atacada por el Grizzly en el mismo turno del cheat (T1 si arranca el humano, T2 si arranca el SIM; en la captura final T2). Hallazgo: la batalla debe ser PROPIA, no del SIM — Combat.setDefenders (Combat.java:1389-1393) usa FilterBattlePermanent + ProtectedByOpponentPredicate (defensor legal para P solo si su protector ∈ oponentes(P)); con la batalla del SIM el protector es el humano y el humano no puede atacarla, con la propia el protector es el SIM (PermanentImpl.chooseProtector, automático en duelo) y sí puede ("You and others can attack it"). El cheat directo al campo no dispara ETB (CardUtil.putCardOntoBattlefieldWithEffects "without ETB") pero pasa por PermanentImpl.entersBattlefield: añade los contadores DEFENSE (3) y elige protector. Elección de defensor: al declarar el Grizzly con 2 defensores (jugador SIM + batalla) llega GAME_TARGET "Select a player, planeswalker, or battle to attack" (HumanPlayer.selectDefender, TargetDefender/FilterDefender) cuyo payload observado es data.targets=[UUID del jugador SIM, UUID de la batalla] (2 opciones), min/max 0 y options.queryType "PICK_TARGET"; se responde sendPlayerUUID(battleId) + sendPlayerBoolean(false) para confirmar (nunca special con 2+ defensores). Evidencia en el view: step COMBAT_DAMAGE, el permanente propio con cardTypes BATTLE y `defense` "1" (3→1 por los 2 del Grizzly; también counters [{name:"defense",count:1}], PermanentImpl.damage 1192-1199) y gv.combat[] con defenderId = UUID de la batalla, defenderName "Invasion of Gobakhan" y el Grizzly en attackers, pila vacía; el rules de la batalla incluye "Protected by <sim>" (addInfo del protector). Driver attack-battle con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeAttackBattleDriver())
}
