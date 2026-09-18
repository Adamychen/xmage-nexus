import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Mirar la mano del rival (§3.8/G12-2): Gitaxian Probe ({U/P} sorcery,
// "Look at target player's hand. Draw a card.") con 1 Isla en el campo tras
// cheatear la carta a la mano. Al resolver, la mano del SIM queda expuesta en
// GameView.lookedAt (RevealedView) — el visor temporal (InfoWindows) que cierra
// el gap G12-2.
function makeGitaxianProbeDriver() {
  return {
    name: 'gitaxian-probe',
    outFile: 'gitaxian-probe.json',
    deck: {
      name: 'Mage Web probe rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim probe',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Grizzly Bears', setCode: 'LEA', cardNumber: '195', amount: 4 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 52 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _cast: false,
    // El coste phyrexiano {U/P} pregunta "Pay 2 life instead of {U}?" → NO:
    // se paga con la Isla (onPlayMana la gira).
    onAsk(q) {
      if (/phyrexian/i.test(String(q ?? ''))) return false
      return undefined
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
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Gitaxian Probe en mano)')
        void ctx.cheatSetup({ hand: ['Gitaxian Probe'] })
        return
      }
      if (!this._cast && ctx.cardInHand('Gitaxian Probe') && ctx.untappedMana() >= 1) {
        this._cast = true
        ctx.log('onSelect: lanzo Gitaxian Probe')
        ctx.playCardByName('Gitaxian Probe')
        return
      }
      ctx.pass()
    },
    onPlayMana(ctx) {
      const island = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (island) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: island.id })
        ctx.log('onPlayMana: giro', island.name)
      }
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (/player/i.test(q) && id) {
        ctx.log('onTarget: jugador rival (mano a la vista)')
        return id
      }
      const raw = data?.targets ?? data?.options?.possibleTargets
      return Array.isArray(raw) ? raw[0] : Object.keys(raw ?? {})[0]
    },
    captureWhen(gv) {
      return (gv?.lookedAt ?? []).some((v) => Object.keys(v?.cards ?? {}).length > 0)
    },
  }
}

export const drivers = { 'gitaxian-probe': makeGitaxianProbeDriver }

export const meta = {
  mechanic: 'gitaxian-probe',
  kind: 'game',
  assert: 'hasLookedAt',
  note: 'Mirar la mano del rival (G12-2): Gitaxian Probe ({U/P}, "Look at target player\'s hand. Draw a card.") cheateada a la mano + 1 Isla propia; el GAME_TARGET de jugador se responde con el playerId del SIM. Captura: GameView.lookedAt poblado (RevealedView con la mano del rival) — la señal que alimenta el visor temporal (InfoWindows) tras la corrección G12-2.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeGitaxianProbeDriver())
}
