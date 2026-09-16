import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — daño primero vía cheatSetup (§3.6): Precinct Captain ({W}{W} 2/2 con
// daño primero) ataca y un Grizzly Bears (2/2 vanilla) lo bloquea. En el paso
// de daño primero el bloqueador muere (SBAs antes de la prioridad) y el
// atacante queda intacto: el frame se captura con gv.step === 'FIRST_COMBAT_DAMAGE'
// (nombre del enum real, ver PhaseStep.java; el host web comprueba por error
// 'FIRST_STRIKE_DAMAGE', que no se emite), el Grizzly en el cementerio rival y
// el Captain en gv.combat[].attackers con damage 0.
//
// HALLAZGO (2026-09-16): el bloqueo debe ocurrir en el MISMO turno del cheat.
// El SIM del proxy ataca con todo en su turno (SimPlayer manda el botón
// especial "All attack"), así que un Grizzly cheateado en T1 ataca en T2, se
// gira, y en nuestro T3 ya no puede bloquear (queda girado cada turno). El
// permanente cheateado entra con summoningSickness:false (puede atacar/bloquear
// ya) y el SIM declara bloqueadores con el primer "possible blocker" de la
// lista (determinista, no decide la IA), así que basta con atacar en T1.
//
// Los cheats van con ctx.send crudo (NO ctx.cheatSetup) a propósito:
// ctx.cheatSetup auto-pasa el SELECT pendiente cuando la respuesta llega sin
// re-prompt, y con la main abierta eso cerraría la fase antes de que el
// Grizzly exista. Con send crudo la main queda abierta (sin responder) hasta
// que llegan los dos cheats (~800 ms entre ellos por el
// ConcurrentModificationException del servidor), y entonces pasamos y atacamos.
function makeFirstStrikeDriver() {
  return {
    name: 'first-strike',
    outFile: 'first-strike.json',
    deck: {
      name: 'Mage Web first strike rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 150_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Ataque: solo cuando el Grizzly (sin girar) y el Captain ya están en el
      // campo. El Grizzly debe estar SIN girar: en el turno del SIM ataca y se
      // gira, así que el bloqueo solo es posible en el mismo turno del cheat.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        if (!this._bothCheated) {
          ctx.log('onSelect: sin cheats listos en declarar atacantes, paso')
          ctx.pass()
          return
        }
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const captain = Object.values(me.battlefield ?? {}).find((c) => /precinct captain/i.test(c?.name ?? '') && !c.tapped)
        const bear = Object.values(rival?.battlefield ?? {}).find((c) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped)
        if (!captain || !bear) {
          ctx.log('onSelect: falta Captain o Grizzly sin girar, paso')
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: captain.id })
        ctx.log('onSelect: ataco con', captain.name)
        setTimeout(() => {
          ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
          ctx.log('onSelect: confirmar ataque (special)')
        }, 300)
        return
      }
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (aquí, la tierra del T1).
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
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        const myId = gv?.myPlayerId ?? me?.playerId ?? me?.id
        ctx.log('onSelect: cheats raw (Captain propio, Grizzly rival) con la main abierta')
        // La main NO se responde hasta que ambos cheats estén aplicados: al
        // llegar el 2º se pasa y se declara el ataque en el mismo turno.
        void ctx
          .send('cheatSetup', { gameId: ctx.gameId, playerId: myId, zones: { battlefield: ['Precinct Captain'] } })
          .then((r1) =>
            new Promise((r) => setTimeout(r, 800)).then(() =>
              r1?.ok && rid
                ? ctx.send('cheatSetup', { gameId: ctx.gameId, playerId: rid, zones: { battlefield: ['Grizzly Bears'] } })
                : null,
            ),
          )
          .then((r2) => {
            ctx.log('onSelect: cheats → ', JSON.stringify(r2)?.slice(0, 120))
            this._bothCheated = r2?.ok === true
            ctx.pass()
          })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) return false
      return undefined
    },
    captureWhen(gv) {
      // Solo el paso de daño primero: el bloqueador ya está muerto (SBA antes
      // de la prioridad) y el atacante intacto (damage 0).
      if (gv.step !== 'FIRST_COMBAT_DAMAGE') return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const captain = Object.values(me?.battlefield ?? {}).find((c) => /precinct captain/i.test(c?.name ?? ''))
      if (!captain || (captain.damage ?? 0) !== 0) return false
      const attacking = (gv.combat ?? []).some((group) =>
        Object.values(group?.attackers ?? {}).some((c) => /precinct captain/i.test(c?.name ?? '')),
      )
      if (!attacking) return false
      const bearAlive = Object.values(rival?.battlefield ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
      const bearDead = Object.values(rival?.graveyard ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
      return !bearAlive && bearDead
    },
  }
}

export const drivers = { 'first-strike': makeFirstStrikeDriver }

export const meta = {
  mechanic: 'first-strike',
  kind: 'game',
  assert: 'hasFirstStrike',
  note: 'Precinct Captain ({W}{W} 2/2 con daño primero) propio ataca en su T1 y el Grizzly Bears (2/2 vanilla) del rival lo bloquea. Cheats con send crudo y la main abierta hasta que ambos están aplicados: Captain propio + Grizzly rival (800 ms entre cheats por el CME del servidor); el ataque debe salir en el MISMO turno del cheat porque el SIM del proxy ataca con todo en su turno (el Grizzly quedaría girado y no podría bloquear en T3+). El permanente cheateado entra con summoningSickness:false y el SIM bloquea con el primer possible blocker (determinista). Captura en el GAME_UPDATE del paso FIRST_COMBAT_DAMAGE (enum real; el host web comprueba por error FIRST_STRIKE_DAMAGE): el Grizzly está en el cementerio rival, el Captain sigue en gv.combat[].attackers con tapped:true y damage 0. Driver first-strike con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeFirstStrikeDriver())
}
