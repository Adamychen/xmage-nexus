import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — intercambio de control (§3.10) vía cheatSetup: Switcheroo (M19 78,
// {4}{U} sorcery: "Exchange control of two target creatures";
// TargetCreaturePermanent(2) + ExchangeControlTargetEffect(Duration.EndOfGame)
// en capa 2 de control). Montaje: mazo de 60 Islas, T1 tierra (acción normal
// previa al cheat) + primer cheatSetup con Switcheroo a la MANO, 4 Islas y un
// Grizzly Bears al campo propio (5 manás exactos: la Isla del T1 + las 4 del
// cheat); el Grizzly entra por cheat (sin coste, sin mareo). ~800 ms después,
// segundo cheatSetup con Elvish Mystic al campo del SIM (cheats a jugadores
// distintos encadenados; el retardo es la regla anti-ConcurrentModification).
// Después se lanza Switcheroo de verdad (clic en la carta), se paga {4}{U} con
// las 5 Islas (onPlayMana, una fuente por prompt) y el efecto voltea los
// controladores: mi Grizzly pasa al campo del SIM y su Mystic al mío.
//
// Objetivos: el motor los autoelige (no hay GAME_TARGET) porque con exactamente
// min=max=2 objetivos legales TargetImpl.tryToAutoChoose (autoTargetLevel por
// defecto > 0) completa la selección sin preguntar al humano; onTarget queda
// como red de seguridad (y para documentar el payload si el prompt apareciera o
// se encadenara en dos GAME_TARGET secuenciales).
function simPlayer(gv) {
  return (gv?.players ?? []).find((p) => !p?.controlled)
}

function nameOf(c) {
  return String(c?.name ?? c?.displayName ?? '')
}

function findInBattlefield(player, re) {
  for (const [id, c] of Object.entries(player?.battlefield ?? {})) {
    if (re.test(nameOf(c))) return id
  }
  return null
}

function makeSwitcherooDriver() {
  return {
    name: 'switcheroo',
    outFile: 'switcheroo.json',
    deck: {
      name: 'Mage Web switcheroo rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _chainStarted: false,
    _cast: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno: acción normal previa al cheat y evita el descarte de
      // limpieza mientras se completa el montaje.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1); el del
      // SIM se encadena ~800 ms después (anti-ConcurrentModification).
      if (!this._chainStarted) {
        this._chainStarted = true
        const sim = simPlayer(gv)
        const simId = sim?.playerId ?? sim?.id
        ctx.log('onSelect: cheatSetup 1 (Switcheroo a la mano, 4 Islas + Grizzly Bears propios)')
        void ctx
          .cheatSetup({
            hand: ['Switcheroo'],
            battlefield: ['Island', 'Island', 'Island', 'Island', 'Grizzly Bears'],
          })
          .then((r1) =>
            new Promise((r) => setTimeout(r, 800)).then(() =>
              r1?.ok && simId ? ctx.cheatSetup({ battlefield: ['Elvish Mystic'] }, simId) : null,
            ),
          )
          .then((r2) => {
            ctx.log('onSelect: cheats →', JSON.stringify({ r1: true, r2: r2?.ok === true }))
          })
        return
      }
      const grizzly = ctx.findOnBattlefield('Grizzly Bears')
      const elf = findInBattlefield(simPlayer(gv), /elvish mystic/i)
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      if (!this._cast && grizzly && elf && stackEmpty && ctx.cardInHand('Switcheroo') && ctx.untappedMana() >= 5) {
        this._cast = true
        ctx.log('onSelect: lanzo Switcheroo')
        ctx.playCardByName('Switcheroo')
        return
      }
      ctx.pass()
    },
    // Red de seguridad: si el motor NO autoelige (o parte la elección en dos
    // GAME_TARGET), se elige primero MI Grizzly y después el Mystic del SIM.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const idsOf = (src) =>
        Array.isArray(src)
          ? src.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(src ?? {})
      if (/discard/i.test(q)) {
        const hand = Object.keys(ctx.gv?.myHand ?? ctx.gv?.hand ?? {})
        if (hand[0]) return hand[0]
        const ids = idsOf(data?.options?.possibleTargets ?? data?.targets)
        return ids[0]
      }
      const grizzly = ctx.findOnBattlefield('Grizzly Bears')
      const elf = findInBattlefield(simPlayer(ctx.gv), /elvish mystic/i)
      const chosen = idsOf(data?.options?.chosenTargets)
      ctx.log('onTarget:', q.slice(0, 80), 'chosen=', JSON.stringify(chosen))
      if (grizzly && !chosen.includes(grizzly)) return grizzly
      if (elf) return elf
      return undefined
    },
    // Pago {4}{U}: cinco Islas sin girar, una por GAME_PLAY_MANA.
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped)
      const island = bf.find((c) => /island/i.test(nameOf(c)))
      const pick = island ?? bf.find((c) => (c.cardTypes ?? []).includes('LAND'))
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', nameOf(pick), String(m?.data?.message ?? '').slice(0, 40))
      }
    },
    // Invariante: el intercambio YA resolvió — el Mystic del SIM está en MI
    // campo y mi Grizzly en el del SIM (la zona del view es del controlador
    // real), con Switcheroo en mi cementerio y la pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      if (!me || !sim) return false
      const iHaveElf = findInBattlefield(me, /elvish mystic/i) !== null
      const simHasGrizzly = findInBattlefield(sim, /grizzly bears/i) !== null
      const iLostGrizzly = findInBattlefield(me, /grizzly bears/i) === null
      const simLostElf = findInBattlefield(sim, /elvish mystic/i) === null
      const gy = Object.values(me.graveyard ?? {})
      const switcherooGy = gy.some((c) => /switcheroo/i.test(nameOf(c)))
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      return iHaveElf && simHasGrizzly && iLostGrizzly && simLostElf && switcherooGy && stackEmpty
    },
  }
}

export const drivers = { switcheroo: makeSwitcherooDriver }

export const meta = {
  mechanic: 'switcheroo',
  kind: 'game',
  assert: 'hasSwitcheroo',
  note: 'Switcheroo (M19 78, {4}{U} sorcery "Exchange control of two target creatures"; TargetCreaturePermanent(2) + ExchangeControlTargetEffect Duration.EndOfGame, capa 2) lanzado de verdad: cheatSetup pone Switcheroo en mano, 4 Islas + Grizzly Bears propios al campo y (800 ms después, segundo cheat al playerId del SIM) Elvish Mystic al campo rival; se paga {4}{U} con 5 Islas (T1 + 4 cheateadas) y el intercambio voltea los controladores. HALLAZGO de targeting: con exactamente min=max=2 objetivos legales NO hay GAME_TARGET del hechizo — TargetImpl.tryToAutoChoose (autoTargetLevel por defecto > 0) autoelige ambos (possibleTargets==min−elegidos); el ÚNICO GAME_TARGET de la run es el descarte de limpieza del T2 ("Select a card to discard", flag=true, min=max=0, targets=8 UUIDs de la mano, options={chosenTargets:[],targetZone:"HAND",queryType:"PICK_TARGET"}). Invariante del frame: Elvish Mystic en MI battlefield, Grizzly Bears en el del SIM (la zona del view sigue al controlador), Switcheroo en mi cementerio y pila vacía. Driver switcheroo con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeSwitcherooDriver())
}
