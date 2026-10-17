import { pathToFileURL } from 'node:url'
import { runRecorder, getMe } from '../rec-lib.mjs'

function makeLandDropDriver() {
  return {
    name: 'land-drop',
    outFile: 'land-drop.json',
    deck: {
      name: 'Mage Web land-drop rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 120_000,
    onSelect(ctx) {
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      ctx.pass()
    },
    captureWhen(gv) {
      const me = getMe(gv)
      if (!me || me.hasPriority !== true || me.isActive !== true) return false
      if (gv.step !== 'PRECOMBAT_MAIN') return false
      const lands = Object.values(me.battlefield ?? {}).filter((c) => (c?.cardTypes ?? []).includes('LAND'))
      if (lands.length > 0) return false
      return Object.values(gv.myHand ?? {}).some((c) => c?.name === 'Mountain')
    },
  }
}

export const drivers = { 'land-drop': makeLandDropDriver }

export const meta = {
  mechanic: 'land-drop',
  kind: 'game',
  assert: 'hasLandDropWindow',
  note: 'First own PRECOMBAT_MAIN priority window with a land in hand and no land on the battlefield: records whether the engine lists the land drop in canPlayObjects.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeLandDropDriver())
}
