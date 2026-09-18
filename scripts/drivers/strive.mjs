import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Strive (§3.2): Launch the Fleet {W} (StriveAbility "{1}" — cuesta {1}
// más por cada objetivo más allá del primero; los objetivos GANAN la habilidad
// "Whenever this creature attacks, create a 1/1 white Soldier creature token
// that's tapped and attacking" hasta el final del turno). Con DOS criaturas
// propias cheateadas se lanzan 2 objetivos: coste final {1}{W}.
function makeStriveDriver() {
  return {
    name: 'strive',
    outFile: 'strive.json',
    deck: {
      name: 'Mage Web strive rec',
      cards: [{ cardName: 'Plains', setCode: 'iko', cardNumber: '262', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
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
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Launch the Fleet + 2 Grizzlies + 3 Llanuras)')
        void ctx.cheatSetup({
          hand: ['Launch the Fleet'],
          battlefield: ['Grizzly Bears', 'Grizzly Bears', 'Plains', 'Plains', 'Plains'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Launch the Fleet') && ctx.untappedMana() >= 2) {
        this._cast = true
        ctx.log('onSelect: lanzo Launch the Fleet (2 objetivos)')
        ctx.playCardByName('Launch the Fleet')
        return
      }
      ctx.pass()
    },
    onPlayMana(ctx) {
      const plains = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /plains/i.test(c?.name ?? ''))
      if (plains) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: plains.id })
        ctx.log('onPlayMana: giro', plains.name)
      }
    },
    // Objetivos de strive: los dos Grizzlies propios, uno por prompt (el
    // engine RE-PREGUNTA si se repite un objetivo ya elegido; `chosenTargets`
    // no siempre viaja, así que la memoria es del driver); al llevar 2 se
    // declina (false) para cerrar la elección.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      // Descarte de limpieza: es `flag:true` (obligatorio) — declinarlo
      // re-pregunta en bucle (mismo patrón del hallazgo §5.1 del plan4).
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const raw = data?.targets ?? data?.options?.possibleTargets
        const legal = Array.isArray(raw) ? raw.map(String) : Object.keys(raw ?? {})
        const id = legal.find((x) => Object.prototype.hasOwnProperty.call(hand, x)) ?? Object.keys(hand)[0]
        ctx.log('onTarget: descarte de limpieza →', id, 'legal=', legal.length, 'mano=', Object.keys(hand).length)
        return id
      }
      const me = ctx.me
      const grizzlies = Object.entries(me?.battlefield ?? {})
        .filter(([, c]) => /grizzly bears/i.test(c?.name ?? ''))
        .map(([id]) => id)
      const chosen = Array.isArray(this._chosen) ? this._chosen : (this._chosen = [])
      if (chosen.length >= 2) {
        ctx.log('onTarget: strive completo (2 objetivos) → declino')
        return false
      }
      const next = grizzlies.find((id) => !chosen.includes(id))
      if (next) {
        chosen.push(next)
        ctx.log('onTarget: strive → Grizzly', chosen.length)
        return next
      }
      ctx.log('onTarget: sin más Grizzlies (declino)')
      return false
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const grizzlies = Object.values(me?.battlefield ?? {}).filter((c) =>
        /grizzly bears/i.test(String(c?.name ?? '')),
      )
      // Launch the Fleet NO da +1/+1: sus objetivos GANAN la habilidad
      // disparada "Whenever this creature attacks, create a 1/1 white Soldier
      // creature token that's tapped and attacking" hasta el final del turno
      // (GainAbilityTargetEffect + AttacksTriggeredAbility). La prueba del
      // strive es la habilidad concedida a AMBOS Grizzlies + el hechizo en el
      // cementerio (coste {1}{W} pagado con 2 Llanuras).
      const granted = (c) =>
        (c?.rules ?? []).some((r) => /Soldier creature token/i.test(String(r)))
      const gy = Object.values(me?.graveyard ?? {}).some((c) =>
        /launch the fleet/i.test(String(c?.name ?? '')),
      )
      return grizzlies.length === 2 && grizzlies.every(granted) && gy && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { strive: makeStriveDriver }

export const meta = {
  mechanic: 'strive',
  kind: 'game',
  assert: 'hasStrive',
  note: 'Strive (Launch the Fleet {W}, StriveAbility "{1}"): dos Grizzly Bears propios cheateados + 3 Llanuras; los objetivos llegan como GAME_TARGET repetido (se declina con false al acabar) y el coste final es {1}{W} (se paga con 2 Llanuras). Captura: los DOS Grizzlies 2/2 → 3/3 hasta el final del turno, Launch the Fleet en el cementerio y pila vacía.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeStriveDriver())
}
