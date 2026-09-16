import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — atacar a un planeswalker (§3.6 fila "Atacar a planeswalker o batalla"):
// Grizzly Bears (2/2 vanilla) propio cheateado al campo ataca a un
// planeswalker del SIM (Tibalt, Rakish Instigator {2}{R}, starting loyalty 5)
// también cheateado al campo rival (~800 ms después). El SIM no tiene
// criaturas, así que el ataque queda sin bloqueador y el daño de combate (2) se
// resta de la lealtad del PW: 5 → 3.
//
// Elección de defensor (descubierta en el código, HumanPlayer.java:2010-2050 y
// Combat.java): al declarar el atacante con >1 defensor posible (jugador + PW)
// el motor construye un TargetDefender ("player, planeswalker, or battle to
// attack", FilterDefender) y hace chooseTarget → GAME_TARGET; se responde con
// sendPlayerUUID del id del PW (elegir el defensor ES el "clic" en el PW, no
// hay campo aparte). Después el servidor re-pregunta "Select attackers" y se
// confirma con sendPlayerBoolean(false) (botón ok; `false` entra por
// checkIfAttackersValid, sin disparar el "All attack" del string 'special').
//
// Chevron: el cheat directo al campo no dispara decisiones "as it enters" en un
// PW (PermanentImpl.entersBattlefield añade los contadores de lealtad por
// startingLoyalty, verificado en el fuente) — Tibalt no tiene elección al
// entrar. Sin ETB triggers (el cheat no los ejecuta).
//
// Evidencia: el view del PW del SIM con `loyalty` reducida ("3") y el grupo de
// combate en gv.combat[] con defenderId = UUID del PW y el Grizzly como
// attacker. El campo de lealtad es `loyalty` (string, derivado del contador
// LOYALTY; CardView.java) y además va en counters [{name:"loyalty",count:3}].
function makeAttackPwDriver() {
  return {
    name: 'attack-pw',
    outFile: 'attack-pw.json',
    deck: {
      name: 'Mage Web attack-pw rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _attackSentTurn: -1,
    rivalPw(ctx) {
      const gv = ctx.gv
      const rival = (gv?.players ?? []).find((p) => !p?.controlled)
      for (const [id, c] of Object.entries(rival?.battlefield ?? {})) {
        if ((c?.cardTypes ?? []).includes('PLANESWALKER')) return { id, name: c.name }
      }
      return null
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true) {
        const pw = this.rivalPw(ctx)
        const grizzly = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
        )
        const attackingPw =
          pw !== null &&
          (gv.combat ?? []).some(
            (g) =>
              g?.defenderId === pw.id &&
              Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
          )
        // Ya está declarado el ataque al PW: confirmar la declaración con el
        // botón ok (boolean false). NUNCA 'special' aquí: con >1 defensor ese
        // camino abre otro GAME_TARGET de "all attack" (HumanPlayer:1855).
        if (attackingPw) {
          ctx.log('onSelect: ataque al PW declarado, confirmo (false)')
          ctx.pass()
          return
        }
        if (grizzly && pw && this._attackSentTurn !== gv.turn) {
          this._attackSentTurn = gv.turn
          ctx.log('onSelect: ataco con Grizzly; el defensor se elige en el GAME_TARGET')
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
        ctx.log('onSelect: cheatSetup (Grizzly Bears propio; luego Tibalt al SIM)')
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        void ctx
          .cheatSetup({ battlefield: ['Grizzly Bears'] })
          .then(
            (r1) =>
              new Promise((r) => setTimeout(r, 800)).then(() =>
                r1?.ok && rid ? ctx.cheatSetup({ battlefield: ['Tibalt, Rakish Instigator'] }, rid) : null,
              ),
          )
          .then(() => {
            this._bothCheated = true
            ctx.log('onSelect: ambos cheats listos')
          })
        return
      }
      ctx.pass()
    },
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
      const pw = this.rivalPw(ctx)
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ptIds = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      ctx.log(
        'onTarget: q=',
        q,
        '| keys=',
        Object.keys(data ?? {}).join(','),
        '| possibleTargets=',
        ptIds.length,
        '| pw=',
        pw?.name,
      )
      // El defensor del ataque: TargetDefender (FilterDefender) pregunta
      // "Select a player, planeswalker, or battle to attack" y las opciones
      // traen el id del jugador y el del PW (options.possibleTargets en los
      // notTarget). Se responde con el UUID del PW: eso ES el clic en el PW.
      if (pw && (/attack/i.test(q) || ptIds.includes(pw.id))) {
        ctx.log('onTarget: defensor → PW', pw.name)
        return pw.id
      }
      return undefined
    },
    captureWhen(gv) {
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      let pwId = null
      let pw = null
      for (const [id, c] of Object.entries(rival?.battlefield ?? {})) {
        if ((c?.cardTypes ?? []).includes('PLANESWALKER')) {
          pwId = id
          pw = c
        }
      }
      if (!pwId || !pw) return false
      const loyalty = Number(pw.loyalty)
      if (!Number.isFinite(loyalty) || loyalty >= 5) return false
      return (gv.combat ?? []).some(
        (g) =>
          g?.defenderId === pwId &&
          Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
      )
    },
  }
}

export const drivers = { 'attack-pw': makeAttackPwDriver }

export const meta = {
  mechanic: 'attack-pw',
  kind: 'game',
  assert: 'hasAttackPlaneswalker',
  note: 'Grizzly Bears (2/2 vanilla) propio vía cheatSetup ataca al planeswalker del SIM Tibalt, Rakish Instigator ({2}{R}, starting loyalty 5) también cheateado (~800 ms después) al campo rival; sin criaturas en el SIM el ataque queda sin bloquear y el daño resta lealtad 5→3. Método de elección de defensor: al enviar el UUID del atacante con >1 defensor (jugador + PW) HumanPlayer.selectDefender (HumanPlayer.java:2020) lanza un TargetDefender "player, planeswalker, or battle to attack" → GAME_TARGET cuyas opciones (options.possibleTargets, notTarget) incluyen el UUID del PW; se responde sendPlayerUUID(pwId) — ese es el clic en el PW — y la declaración se cierra con sendPlayerBoolean(false) (botón ok; NO usar special con >1 defensor: abre un segundo target de "all attack", HumanPlayer.java:1855). Evidencia en el view: el permanente del SIM con cardTypes PLANESWALKER y `loyalty` "3" (string derivado del contador LOYALTY, también en counters [{name:"loyalty",count:3}]) y gv.combat[] con defenderId = UUID del PW y el Grizzly en attackers. Driver attack-pw con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeAttackPwDriver())
}
