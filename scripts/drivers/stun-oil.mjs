import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — contadores exóticos en un único frame (§3.9 "Stun, shield, oil, etc."):
// Rime Chill (Lorwyn Eclipsed 64; HALLAZGO: en el fork 1.4.61 NO es "Tap target
// creature. Put a stun counter on it." sino un instant {6}{U} con Vivid — "Tap
// up to two target creatures. Put a stun counter on each of them. Draw a card."
// y coste reducido {1} por cada COLOR entre tus permanentes) + Incubation Sac
// ({G} artefacto, EntersBattlefieldWithCountersAbility: 3 contadores oil).
// Mazo todo Islas: el G se paga con un Forest cheateado (onPlayMana explícito,
// un Island no puede pagar {G}). HALLAZGO: las tierras básicas de XMage solo
// llevan frameColor (Island.java: this.frameColor.setBlue(true)), su `color`
// sigue vacío — el Vivid solo cuenta el verde de Incubation Sac ⇒ reduce 1:
// el prompt real es "Pay {5}{U}" (6 manás, 6 Islas giradas), NO {4}{U}.
// Objetivo "up to two" de Rime Chill (TargetCreaturePermanent(0,2)): el
// GAME_TARGET real llega con min 0/max 0 y message "Select creatures (selected
// 0 of 2)" con UN único objetivo legal (possibleTargets=[Grizzly]); un solo
// UUID (el Grizzly) cierra la selección y el hechizo sigue (no hubo segundo
// prompt "Done"; el fallback false queda por si apareciera).
// Captura (un solo frame): mi Incubation Sac con counters oil:3 + el Grizzly
// Bears del SIM (cheateado, patrón 800 ms) girado con counters stun:1.
function makeStunOilDriver() {
  return {
    name: 'stun-oil',
    outFile: 'stun-oil.json',
    deck: {
      name: 'Mage Web stun-oil rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _sacCast: false,
    _chillCast: false,
    _stunTargeted: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del turno).
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
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheatSetup (Rime Chill + Incubation Sac a la mano; Forest + 5 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Rime Chill', 'Incubation Sac'],
          battlefield: ['Forest', 'Island', 'Island', 'Island', 'Island', 'Island'],
        })
          .then(() => new Promise((r) => setTimeout(r, 800)))
          .then(() => (rid ? ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid) : null))
          .then(() => {
            this._bothCheated = true
            ctx.log('onSelect: ambos cheats listos')
          })
        return
      }
      if (!this._sacCast && ctx.cardInHand('Incubation Sac')) {
        this._sacCast = true
        ctx.log('onSelect: lanzo Incubation Sac ({G}; entró con 3 contadores oil)')
        ctx.playCardByName('Incubation Sac')
        return
      }
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const grizzly = Object.values(rival?.battlefield ?? {}).find((c) => /grizzly bears/i.test(c?.name ?? ''))
      const sacOnBf = !!ctx.findOnBattlefield('Incubation Sac')
      if (!this._chillCast && sacOnBf && grizzly && ctx.cardInHand('Rime Chill') && ctx.untappedMana() >= 6) {
        this._chillCast = true
        ctx.log('onSelect: lanzo Rime Chill ({6}{U} Vivid -1 ⇒ {5}{U}) al Grizzly del SIM')
        ctx.playCardByName('Rime Chill')
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const ids = Object.keys(hand)
        const land = ids.find((id) => (hand[id]?.cardTypes ?? []).includes('LAND'))
        ctx.log('onTarget: descarte de limpieza')
        return land ?? ids[0]
      }
      // Rime Chill: "Tap up to two target creatures..." (min 0) ⇒ 1er prompt
      // elige al Grizzly, 2º prompt cierra con Done (false).
      const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const grizzly = Object.values(rival?.battlefield ?? {}).find((c) => /grizzly bears/i.test(c?.name ?? ''))
      if (grizzly && !this._stunTargeted) {
        this._stunTargeted = true
        ctx.log('onTarget: Rime Chill → Grizzly Bears del SIM')
        return grizzly.id
      }
      if (this._stunTargeted) {
        ctx.log('onTarget: fin de selección "up to two" (Done = false)')
        return false
      }
      return undefined
    },
    // El pago depende del prompt: {G} solo lo paga el Forest; el resto de
    // trozos ({4}, {U}, {6}...) los pagan las Islas (todas producen {C}/{U} y
    // cualquier land paga genéricos). UUID explícito por prompt.
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const wantGreen = /\{G\}/.test(msg) && !/\{U\}/.test(msg)
      const src = wantGreen
        ? bf.find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
        : bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (src) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: src.id })
        ctx.log('onPlayMana:', JSON.stringify(msg), '→ giro', src.name)
      } else {
        ctx.log('onPlayMana: SIN fuente para', JSON.stringify(msg))
      }
    },
    // Invariante: artefacto propio con oil ≥1 (3) Y Grizzly del SIM girado con
    // stun ≥1, en el mismo frame y con la pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const sac = Object.values(me?.battlefield ?? {}).find((c) => /incubation sac/i.test(c?.name ?? ''))
      const oil = (sac?.counters ?? []).find((c) => /^oil$/i.test(String(c?.name ?? '')))
      const grizzly = Object.values(rival?.battlefield ?? {}).find((c) => /grizzly bears/i.test(c?.name ?? ''))
      const stun = (grizzly?.counters ?? []).find((c) => /^stun$/i.test(String(c?.name ?? '')))
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return (
        !!sac &&
        Number(oil?.count ?? 0) >= 1 &&
        !!grizzly &&
        grizzly.tapped === true &&
        Number(stun?.count ?? 0) >= 1 &&
        stackEmpty
      )
    },
  }
}

export const drivers = { 'stun-oil': makeStunOilDriver }

export const meta = {
  mechanic: 'stun-oil',
  kind: 'game',
  assert: 'hasStunOil',
  note: 'Stun + oil en un mismo frame vía cheatSetup (§3.9): Rime Chill (ECL 64) al Grizzly Bears del SIM e Incubation Sac ({G} artefacto con EntersBattlefieldWithCountersAbility de 3 aceite) propios. HALLAZGO: en el fork 1.4.61 Rime Chill NO es "Tap target creature. Put a stun counter on it." sino un instant {6}{U} con Vivid ("Tap up to two target creatures. Put a stun counter on each of them. Draw a card.", TargetCreaturePermanent(0,2)); el Vivid reduce {1} por color entre tus permanentes pero las básicas de XMage solo llevan frameColor (Island.java: frameColor.setBlue) y su color queda vacío ⇒ solo cuenta el verde de Incubation Sac y el prompt real es "Pay {5}{U}" (6 Islas). El GAME_TARGET llega como "Select creatures (selected 0 of 2)" con min 0/max 0 y possibleTargets=[Grizzly]; un solo UUID (Grizzly) cierra la selección (sin prompt Done). Captura: PermanentView.counters (CounterView {name,count}) — Incubation Sac con [{name:"oil",count:3}] y el Grizzly del SIM con tapped:true y [{name:"stun",count:1}] (mismo campo que +1/+1 o loyalty), pila vacía; el stun sustituye el próximo despertar. Driver stun-oil con cheatSetup (G pagado con Forest explícito en onPlayMana; los 800 ms entre cheats son de reloj real y el juego avanzó ~10 turnos de tierras hasta el Grizzly, como en cant-block).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeStunOilDriver())
}
