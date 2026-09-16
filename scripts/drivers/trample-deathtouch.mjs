import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — trample + deathtouch (§3.6) vía cheatSetup + Lure real (reintento del
// driver que falló en la 4ª tanda: la IA no bloquea VOLUNTARIAMENTE a un
// atacante con deathtouch; Lure lo fuerza por regla, igual que must-block).
//
// Montaje: tierra → cheats RAW (ctx.send, sin auto-pass; patrón must-block) —
// Elvish Warrior 2/3 al campo + 8 Bosques + Lure/Rancor/Basilisk Collar en
// mano; 800 ms después el Grizzly Bears 2/2 del SIM → casts Lure→Rancor→Collar
// ({1}{G}{G}+{G}+{2}), equipo del Collar (equip {2}) → atacar en la primera
// ventana con todo adjunto y el Grizzly fresco. HALLAZGO de timing (bisecado
// 2026-09-16): el retardo de 800 ms entre cheats es de reloj real, pero el
// juego avanza turnos de tierras a toda velocidad (ambos pasan al instante),
// así que el segundo cheat aterriza varios turnos después del primero (en la
// run capturada, el ataque fue en T11) y no en "la misma ventana" como en
// must-block. Resultado: Elvish Warrior 4/3 con trample (Rancor +2/+0),
// deathtouch y lifelink (Collar); el Grizzly bloquea obligado por Lure y el
// reparto de daño (GAME_GET_MULTI_AMOUNT, default del servidor) asigna 1 letal
// (deathtouch rebaja el letal de 2 a 1 contra un 2/2) + 3 de trample al
// jugador: SIM 20→17, nosotros 20→24 (lifelink 4).
//
// HALLAZGO (corrige el plan original): con el Grizzly 2/2 + Rancor (4/2) del
// plan, el bloqueador devuelve sus 2 de daño SIMULTÁNEAMENTE (deathtouch no
// "pega antes") y el atacante 4/2 moriría. Se usa Elvish Warrior (2/3 por {G})
// para que el atacante 4/3 sobreviva con 2 daños marcados: mismo 17/24 y mismo
// reparto 1+3.
//
// El bloqueador debe montarse en el MISMO turno del ataque (regla bisecada en
// first-strike: el SIM ataca con todo en su turno y un Grizzly cheateado antes
// quedaría girado) y los cheats van encadenados con 800 ms (dos casi
// simultáneos → ConcurrentModificationException en el servidor).
function makeTrampleDeathtouchDriver() {
  return {
    name: 'trample-deathtouch',
    outFile: 'trample-deathtouch.json',
    deck: {
      name: 'Mage Web trample-deathtouch rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _chainStarted: false,
    _chain2Done: false,
    _chain2At: 0,
    _cheat2Turn: -1,
    _castLure: false,
    _attackedTurn: -1,
    // Adjunto real (attachedTo del aura/equipo = uuid de la criatura, o el
    // uuid del adjunto en creature.attachments; ver must-block).
    attachedTo(ctx, name, creatureRe) {
      const me = ctx.me
      const att = Object.entries(me?.battlefield ?? {}).find(([, c]) => new RegExp(`^${name}$`, 'i').test(c?.name ?? ''))
      const cre = Object.entries(me?.battlefield ?? {}).find(([, c]) => creatureRe.test(c?.name ?? ''))
      if (!att || !cre) return null
      const on = att[1].attachedTo === cre[0] || (cre[1].attachments ?? []).includes(att[0])
      return on ? { attId: att[0], att: att[1], creId: cre[0], cre: cre[1] } : null
    },
    freshGrizzly(ctx) {
      const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      return Object.values(rival?.battlefield ?? {}).find(
        (c) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
      )
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Declarar atacantes: solo con Lure+Rancor+Collar adjuntos y un Grizzly
      // rival sin girar (el bloqueo lo fuerza Lure por regla). Confirmar como
      // en combat/menace: sendPlayerUUID + 'special' a los 300 ms.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const lure = this.attachedTo(ctx, 'Lure', /elvish warrior/i)
        const collar = this.attachedTo(ctx, 'Basilisk Collar', /elvish warrior/i)
        const rancor = this.attachedTo(ctx, 'Rancor', /elvish warrior/i)
        const grizzly = this.freshGrizzly(ctx)
        if (!lure || !rancor || !collar || !grizzly || lure.cre.tapped) {
          ctx.log('onSelect: sin Lure+Rancor+Collar+Grizzly fresco, paso',
            JSON.stringify({ lure: !!lure, rancor: !!rancor, collar: !!collar, grizzly: !!grizzly }))
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: lure.creId })
        ctx.log('onSelect: ataco con', lure.cre.name, '4/3 trample+deathtouch+lifelink (Lure adjunta)')
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
      // HALLAZGO (bisecado 2026-09-16, 2ª run): con Lure en la pila, intentar
      // lanzar Rancor (velocidad de conjuro) es ilegal; el servidor rechaza el
      // UUID y re-pregunta el MISMO GAME_SELECT en bucle (~5 ms). Hay que PASAR
      // para dejar resolver el hechizo anterior y castear en la ventana
      // siguiente: si la pila no está vacía, solo se pasa.
      if (Object.keys(gv.stack ?? {}).length > 0) {
        ctx.log('onSelect: pila ocupada, paso para dejar resolver')
        ctx.pass()
        return
      }
      // Tierra por turno (mazo todo Bosques): acción normal previa al cheat y
      // evita el descarte de limpieza si el combo tarda varios turnos.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra). Cheats RAW
      // (ctx.send, patrón must-block): sin auto-pass; en la práctica el
      // servidor resuelve el prompt aparcado tras el cheat (el juego pasa a
      // combate) y los casts caen en la main de ese turno o del siguiente. El
      // ataque se difiere hasta tener Lure+Rancor+Collar adjuntos y un Grizzly
      // fresco (el cheat del bloqueador aterriza ~800 ms después).
      if (!this._chainStarted) {
        this._chainStarted = true
        const myId = gv.myPlayerId ?? me.playerId ?? me.id
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheats raw (Warrior + 8 Bosques + Lure/Rancor/Collar en mano, luego Grizzly rival)')
        void ctx
          .send('cheatSetup', {
            gameId: ctx.gameId,
            playerId: myId,
            zones: {
              battlefield: [
                'Elvish Warrior',
                'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest',
              ],
              hand: ['Lure', 'Rancor', 'Basilisk Collar'],
            },
          })
          .then((r1) =>
            new Promise((r) => setTimeout(r, 800)).then(() =>
              r1?.ok && rid
                ? ctx.send('cheatSetup', {
                    gameId: ctx.gameId,
                    playerId: rid,
                    zones: { battlefield: ['Grizzly Bears'] },
                  })
                : null,
            ),
          )
          .then((r2) => {
            this._chain2Done = true
            this._chain2At = Date.now()
            ctx.log('onSelect: cheats →', JSON.stringify({ r2: r2?.ok === true }))
            if (!ctx.findOnBattlefield('Elvish Warrior')) {
              // Cheat propio falló (carrera conocida): reintentar la cadena.
              this._chainStarted = false
              ctx.pass()
              return
            }
            // Cast del Lure en cuanto la cadena termina (patrón must-block: el
            // UUID responde al prompt pendiente). Si el cheat del Grizzly
            // falló, no pasa nada: el fallback de refuerzo lo reintenta en la
            // siguiente ventana de main.
            setTimeout(() => {
              if (!this._castLure && ctx.cardInHand('Lure')) {
                this._castLure = true
                ctx.log('onSelect: lanzo Lure (respuesta al SELECT aparcado) sobre el Warrior')
                ctx.playCardByName('Lure')
              }
            }, 250)
          })
        return
      }
      // Fallback (solo si el cheat del Grizzly falló o el bloqueador se giró en
      // un turno anterior): cheatear un Grizzly fresco, uno por turno. OJO
      // (bisecado 2026-09-16, 3ª run): tras el r2 de la cadena la vista tarda
      // un instante en mostrar el Grizzly cheateado; un fallback inmediato crea
      // DOS Grizzlies y con Lure ambos bloquean (el Warrior 4/3 muere por 4 de
      // daño). Ventana de gracia de 3 s desde el r2 para que la vista llegue.
      if (
        this._chain2Done &&
        !this.freshGrizzly(ctx) &&
        this._cheat2Turn !== turn &&
        Date.now() - this._chain2At > 3000
      ) {
        this._cheat2Turn = turn
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        if (rid) {
          ctx.log('onSelect: cheatSetup de refuerzo (Grizzly fresco al rival)')
          void ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid)
          return
        }
      }
      const warriorBf = ctx.findOnBattlefield('Elvish Warrior')
      // Casts en el orden del plan: Lure → Rancor → Collar → equipar.
      if (warriorBf && !this.attachedTo(ctx, 'Lure', /elvish warrior/i) && ctx.cardInHand('Lure')) {
        ctx.log('onSelect: lanzo Lure sobre el Warrior')
        ctx.playCardByName('Lure')
        return
      }
      if (warriorBf && !this.attachedTo(ctx, 'Rancor', /elvish warrior/i) && ctx.cardInHand('Rancor')) {
        ctx.log('onSelect: lanzo Rancor sobre el Warrior')
        ctx.playCardByName('Rancor')
        return
      }
      if (!this.attachedTo(ctx, 'Basilisk Collar', /elvish warrior/i) && ctx.cardInHand('Basilisk Collar')) {
        ctx.log('onSelect: lanzo Basilisk Collar')
        ctx.playCardByName('Basilisk Collar')
        return
      }
      const collarBf = ctx.findOnBattlefield('Basilisk Collar')
      if (warriorBf && collarBf && !this.attachedTo(ctx, 'Basilisk Collar', /elvish warrior/i) && ctx.untappedMana() >= 1) {
        ctx.log('onSelect: activo equipar (click en Basilisk Collar)')
        ctx.playAbility('Basilisk Collar', ['other', 'basicPlayAbilities'], /equip/i)
        return
      }
      ctx.pass()
    },
    // Equip llega como GAME_CHOOSE_ABILITY si el objeto tiene varias
    // habilidades jugables: elegir la de texto "Equip".
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility:', JSON.stringify(opts).slice(0, 250))
      const eq = (opts ?? []).find((o) => /equip/i.test(String(o?.label ?? o?.value ?? '')))
      if (eq) return eq.value ?? eq.id
      return (opts ?? [])[0]?.value
    },
    // Pagar con Bosques sin girar (los 8 cheateados + la tierra del turno).
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    // Objetivos: Lure/Rancor/equipar → nuestro Warrior. El descarte de
    // limpieza ("Select a card to discard") no se responde nunca con un
    // permanente del campo (rechazo en bucle) y hay que ir gastando cartas
    // distintas: entre prompts seguidos no llega GAME_UPDATE y la vista repite
    // la mano, así que devolver siempre el primer Bosque = mismo UUID =
    // rechazo en bucle (bisecado en trample-deathtouch 1ª run).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const pick = Object.entries(hand).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: descarte limpieza', pick[1]?.name)
          return pick[0]
        }
        ctx.log('onTarget: descarte sin cartas nuevas, declino')
        return false
      }
      const warrior = ctx.findOnBattlefield('Elvish Warrior')
      if (warrior) {
        ctx.log('onTarget: → Warrior')
        return warrior
      }
      return undefined
    },
    // Reparto de daño de combate (trample con un bloqueador): items[min/max/
    // defaultValue]. El default del servidor ya respeta deathtouch (letal 1),
    // así que se devuelve el default: 1 al Grizzly y el trample (3) al jugador
    // lo calcula el motor (damage - suma asignada).
    onMultiAmount(items, ctx) {
      const vals = (items ?? []).map((it) => Number(it?.defaultValue ?? it?.min ?? 0))
      ctx.log('onMultiAmount items=', JSON.stringify(items).slice(0, 400), '→', vals.join(' '))
      return vals
    },
    // Invariante: Grizzly del SIM en el cementerio (deathtouch), SIM 17 (1
    // letal + 3 de trample) y nuestro Warrior 4/3 vivo con 2 daños marcados
    // (el bloqueador devolvió su daño) y vida con lifelink aplicado: 24 si el
    // SIM no llegó a pegar y 22 si su Grizzly (cheateado para bloquear) atacó
    // una vez antes en su turno (2 daños), como ocurre cuando el cheat del
    // bloqueador aterriza un turno antes del ataque. Sin lifelink la vida
    // sería 18 en ese caso, así que 22 también prueba los +4.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      if (!me || !sim) return false
      const warrior = Object.values(me.battlefield ?? {}).find((c) => /elvish warrior/i.test(c?.name ?? ''))
      const simGy = Object.values(sim.graveyard ?? {})
      const sim17 = Number(sim.life) === 17
      const lifelink = Number(me.life) === 24 || Number(me.life) === 22
      const deadBlocker = simGy.some((c) => /grizzly bears/i.test(c?.name ?? ''))
      const survived = Boolean(warrior) && Number(warrior?.damage ?? 0) === 2
      return sim17 && lifelink && deadBlocker && survived
    },
  }
}

export const drivers = { 'trample-deathtouch': makeTrampleDeathtouchDriver }

export const meta = {
  mechanic: 'trample-deathtouch',
  kind: 'game',
  assert: 'hasTrampleDeathtouch',
  note: 'Trample + deathtouch forzado con Lure real (el SIM no bloquea voluntariamente a un atacante con deathtouch; Lure lo obliga por regla, como must-block): tierra + cheats RAW (sin auto-pass) — Elvish Warrior 2/3 al campo + 8 Bosques + Lure/Rancor/Basilisk Collar en mano; 800 ms después Grizzly Bears 2/2 al campo rival — + casts Lure→Rancor→Collar ({1}{G}{G}+{G}+{2}, giro de Bosques) + equipar el Collar (equip {2}) + atacar con el Warrior 4/3 (Rancor +2/+0 da trample; Collar da deathtouch+lifelink) confirmando con el botón special. Hallazgo de timing: el retardo de 800 ms entre cheats es de reloj real y el juego avanza turnos de tierras al instante, así que el segundo cheat aterriza varios turnos después del primero (el ataque no cae en la misma ventana que en must-block; en la captura fue T11) — el driver ataca en cuanto Lure+Rancor+Collar están adjuntos y hay un Grizzly fresco, con fallback de refuerzo si el bloqueador se giró. Hallazgo que corrige el plan: un atacante 4/2 (Grizzly+Rancor) muere al daño de bloqueo, que es simultáneo (deathtouch no "pega antes"); con Elvish Warrior 2/3 el atacante es 4/3 y sobrevive con 2 daños. El reparto de daño llega como GAME_GET_MULTI_AMOUNT (items[min/max/defaultValue]; el defaultValue del servidor ya rebaja el letal a 1 por deathtouch) y se responde el default (1 al bloqueador): el motor calcula el exceso de trample (damage - asignado = 3) y lo manda al jugador. Captura: Grizzly del SIM en el cementerio (letal de deathtouch), vida del SIM 20→17 (1 letal + 3 de trample), nuestra vida 20→24 (lifelink 4 de los 4 daños; el driver también acepta 22 si el SIM llegó a pegar una vez antes) y Elvish Warrior 4/3 vivo en el campo con damage=2, rules ["Trample","Deathtouch","Lifelink"], Lure+Rancor+Collar adjuntos. Driver trample-deathtouch con cheatSetup + Lure real.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTrampleDeathtouchDriver())
}
