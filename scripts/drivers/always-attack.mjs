import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — "ataca cada combate si puede" (§3.6 fila "Vigilance, goad, 'ataca cada
// combate'"): Rubblebelt Recluse ({4}{R} 6/5 Ogre Berserker, "Rubblebelt
// Recluse attacks each combat if able." — AttacksEachCombatStaticAbility →
// AttacksIfAbleSourceEffect(Duration.WhileOnBattlefield, eachCombat=true))
// cheateada al campo del SIM en cuanto hay ≥1 acción normal (en la run: tierra
// en nuestro T2, porque arrancó el SIM). El SIM del proxy ataca con TODO en su
// turno (SimPlayer envía el botón especial "All attack" en DECLARE_ATTACKERS),
// así que la criatura ataca en el siguiente turno del SIM tras el cheat (T3 en
// la run).
//
// Cómo llega la restricción al view (misma vía que goad/cant-block):
// PermanentImpl.getRules(game) recoge el requirement como "Must attack (nombre
// de la fuente)" con el marcador HintUtils.HINT_ICON_REQUIRE y CardView.java
// :758-773 lo vuelca a cardIcons como {cardIconType:"OTHER_HAS_RESTRICTIONS",
// text:"", hint:"Must attack (Rubblebelt Recluse)"}; el CardView.rules incluye
// además "{this} attacks each combat if able." (staticText del efecto). El
// requirement aplica mientras el permanente esté en el campo (attacked o no),
// así que el icono está presente en el mismo frame del ataque.
//
// Invariante: la Recluse del SIM en gv.combat[].attackers (tapped:true) con su
// cardIcon OTHER_HAS_RESTRICTIONS de "must attack" en el CardView del campo.
function makeAlwaysAttackDriver() {
  return {
    name: 'always-attack',
    outFile: 'always-attack.json',
    deck: {
      name: 'Mage Web always-attack rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheatSetup (Rubblebelt Recluse al SIM)')
        void ctx.cheatSetup({ battlefield: ['Rubblebelt Recluse'] }, rid).then((r) => {
          ctx.log('onSelect: cheat →', JSON.stringify({ ok: r?.ok === true }))
        })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        return Object.keys(hand)[0] ?? false
      }
      return undefined
    },
    captureWhen(gv) {
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      let recluse = null
      for (const [, c] of Object.entries(rival?.battlefield ?? {})) {
        if (/rubblebelt recluse/i.test(c?.name ?? '')) recluse = c
      }
      if (!recluse) return false
      const mustAttack = (recluse.cardIcons ?? []).some(
        (i) => i?.cardIconType === 'OTHER_HAS_RESTRICTIONS' && /must attack/i.test(i?.hint ?? ''),
      )
      if (!mustAttack) return false
      return (gv.combat ?? []).some((g) =>
        Object.values(g?.attackers ?? {}).some((c) => /rubblebelt recluse/i.test(c?.name ?? '')),
      )
    },
  }
}

export const drivers = { 'always-attack': makeAlwaysAttackDriver }

export const meta = {
  mechanic: 'always-attack',
  kind: 'game',
  assert: 'hasAlwaysAttack',
  note: 'Restricción "attacks each combat if able" (Rubblebelt Recluse, {4}{R} 6/5 Ogre Berserker, AttacksEachCombatStaticAbility → AttacksIfAbleSourceEffect eachCombat=true, texto "...attacks each combat if able.") cheateada al campo del SIM en cuanto hay ≥1 acción normal (en la run: tierra en nuestro T2, arrancó el SIM) y el SIM ataca con TODO en su turno (SimPlayer envía el botón especial "All attack" en DECLARE_ATTACKERS), así que la criatura ataca en su siguiente turno tras el cheat (T3 en la run). Cómo llega la restricción al view: PermanentImpl.getRules(game) recoge el requirement ("Must attack" + " (Rubblebelt Recluse)") marcado con HintUtils.HINT_ICON_REQUIRE y CardView.java:758-773 lo convierte en cardIcons [{cardIconType:"OTHER_HAS_RESTRICTIONS", text:"", hint:"Must attack (Rubblebelt Recluse [b22])"}] (el sufijo [b22] es el getIdName de la fuente); el CardView.rules incluye "{this} attacks each combat if able.", "<br/><hintstart/>" y el marcador crudo "ICON_REQUIREMust attack (...)". El requirement aplica mientras el permanente esté en el campo (atacando o no), por lo que el icono está en el mismo frame del ataque. Evidencia en el frame: la Recluse del SIM en gv.combat[].attackers (tapped:true) y su cardIcon de restricción en el CardView del campo. Driver always-attack con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeAlwaysAttackDriver())
}
