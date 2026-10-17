import { pathToFileURL } from 'node:url'
import { runRecorder, getMe } from '../rec-lib.mjs'

const isUntapped = (gv, name) =>
  Object.values(getMe(gv)?.battlefield ?? {}).some((c) => c?.name === name && c?.tapped !== true)

function makeManaRocksDriver() {
  return {
    name: 'mana-rocks',
    outFile: 'mana-rocks.json',
    deck: {
      name: 'Mage Web mana-rocks rec',
      cards: [{ cardName: 'Island', setCode: 'LEA', cardNumber: '288', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 180_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const gv = ctx.gv
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Sol Ring + Cascade Bluffs al campo)')
        void ctx.cheatSetup({ battlefield: ['Sol Ring', 'Cascade Bluffs'] })
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = getMe(gv)
      if (!me || me.hasPriority !== true) return false
      return isUntapped(gv, 'Sol Ring') && isUntapped(gv, 'Cascade Bluffs')
    },
  }
}

export const drivers = { 'mana-rocks': makeManaRocksDriver }

export const meta = {
  mechanic: 'mana-rocks',
  kind: 'game',
  assert: 'hasManaRocks',
  note: 'Untapped Sol Ring ({T}: Add {C}{C}) and a filter land (Cascade Bluffs) on the controlled battlefield with priority: records which canPlayObjects bucket the engine puts non-basic mana abilities in, so smart stops know whether they count as a playable window.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeManaRocksDriver())
}
