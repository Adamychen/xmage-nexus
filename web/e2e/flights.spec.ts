import { fakeOnly } from './support/fake-mode'
import { TABLE } from '../fixtures/table-names'
import { DECK } from '../fixtures/deck-names'
import { test, expect } from './fixtures'
fakeOnly()
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { spellsScenario } from '../fixtures/scenarios/spells'

interface DiagEntry {
  t: number
  kind: string
  reason?: string
  cardId: string
  detail?: string
}

import type { Page } from '@playwright/test'

async function flightLog(page: Page): Promise<DiagEntry[]> {
  return page.evaluate(() => {
    const w = window as unknown as { __mageFlights?: { log: () => DiagEntry[] } }
    return w.__mageFlights?.log() ?? []
  })
}

test('animaciones de movimiento: diagnóstico de vuelos por transición @flights', async ({ page }) => {
  await withFakeServer(
    () => spellsScenario('blaze'),
    async () => {
      const { pageErrors } = await startGame(page, {
        prefix: 'fl',
        tableName: TABLE.spellsBlaze,
        deck: DECK.advanced,
        skipAsks: true,
      })
      await expect(page.locator('.game-board')).toBeVisible({ timeout: 20_000 })

      const setup = await page.evaluate(() => {
        const s = (
          window as unknown as {
            __mageStore?: { getState: () => { game: any; gameId: string } }
            __mageFlights?: { clear: () => void }
          }
        ).__mageStore?.getState()
        const game = s?.game
        const me = game?.players?.find((p: any) => p.controlled)
        const handIds: string[] = Object.keys(game?.myHand ?? {})
        const blazeId = handIds.find((id) => String(game.myHand[id]?.name ?? '').toLowerCase().includes('blaze'))
        const landId = Object.keys(me?.battlefield ?? {})[0]
        return { gameId: s?.gameId ?? null, handCount: handIds.length, blazeId: blazeId ?? null, landId: landId ?? null }
      })
      expect(setup.gameId, 'gameId vivo').toBeTruthy()
      expect(setup.blazeId, 'Blaze en mano inicial').toBeTruthy()
      expect(setup.landId, 'tierra en campo').toBeTruthy()

      const report: string[] = []
      const push = async (label: string, mutate: string, waitMs = 700): Promise<DiagEntry[]> => {
        const before = (await flightLog(page)).length
        await page.evaluate(
          ({ gameId, fn }) => {
            const w = window as unknown as {
              __mageStore?: { getState: () => any; handleMessage: (m: any) => void }
            }
            const st = w.__mageStore
            if (!st) throw new Error('sin __mageStore')
            const cur = st.getState().game
            const next = structuredClone(cur)
            // eslint-disable-next-line @typescript-eslint/no-implied-eval
            const apply = new Function('view', `return (${fn})(view)`) as (v: any) => void
            apply(next)
            st.handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: Date.now(), objectId: gameId, data: { gameView: next } })
          },
          { gameId: setup.gameId, fn: mutate },
        )
        await page.waitForTimeout(waitMs)
        const entries = (await flightLog(page)).slice(before)
        report.push(`--- ${label} (${entries.length} entradas) ---\n` + entries.map((e) => `${e.kind}${e.reason ? `:${e.reason}` : ''} ${e.cardId} ${e.detail ?? ''}`).join('\n'))
        return entries
      }

      const hasStart = (entries: DiagEntry[], id: string | null) =>
        !!id && entries.some((e) => e.kind === 'start' && e.cardId === id)

      // A) Robo: carta nueva en mano -> vuelo biblioteca->mano (rama B-draw).
      const drawEntries = await push(
        'A robo',
        `view => {
          const src = Object.values(view.myHand)[0];
          view.myHand['draw-probe-1'] = { ...src, id: 'draw-probe-1', name: 'Probe Draw' };
        }`,
      )
      expect(hasStart(drawEntries, 'draw-probe-1'), 'A: el robo debería iniciar un vuelo').toBeTruthy()

      // B) Casteo: Blaze mano->stack (rama B-stack o camino A).
      const castEntries = await push(
        'B casteo',
        `view => {
          const me = view.players.find(p => p.controlled);
          const id = Object.keys(view.myHand).find(k => String(view.myHand[k]?.name ?? '').toLowerCase().includes('blaze'));
          const card = view.myHand[id];
          delete view.myHand[id];
          view.stack = { ...(view.stack ?? {}), [id]: { ...card, controllerId: me.playerId, controllerName: me.name } };
        }`,
      )
      expect(hasStart(castEntries, setup.blazeId), 'B: el casteo debería iniciar un vuelo').toBeTruthy()

      // C) Ráfaga: resolución stack->campo + tierra->cementerio en el MISMO
      // update, y 60ms después el permanente->cementerio (como un counter).
      const burstEntries = await push(
        'C rafaga x2 en un update',
        `view => {
          const me = view.players.find(p => p.controlled);
          const stackIds = Object.keys(view.stack ?? {});
          const bfIds = Object.keys(me.battlefield ?? {});
          const spellId = stackIds[0];
          const landId = bfIds[0];
          const spell = view.stack[spellId];
          delete view.stack[spellId];
          me.battlefield[spellId] = { ...me.battlefield[landId], ...spell };
          const [doomed] = Object.keys(me.battlefield).filter(k => k !== spellId);
          if (doomed) {
            const perm = me.battlefield[doomed];
            delete me.battlefield[doomed];
            me.graveyard = { ...(me.graveyard ?? {}), [doomed]: perm };
          }
        }`,
      )
      const counterEntries = await push(
        'C2 counter 60ms despues (misma carta)',
        `view => {
          const me = view.players.find(p => p.controlled);
          const ids = Object.keys(me.battlefield ?? {});
          if (ids.length > 0) {
            const perm = me.battlefield[ids[0]];
            delete me.battlefield[ids[0]];
            me.graveyard = { ...(me.graveyard ?? {}), [ids[0]]: perm };
          }
        }`,
        900,
      )
      report.push(`C: starts=${burstEntries.filter((e) => e.kind === 'start').length} cancels=${burstEntries.filter((e) => e.kind === 'cancel').length}`)
      report.push(`C2: starts=${counterEntries.filter((e) => e.kind === 'start').length} cancels=${counterEntries.filter((e) => e.kind === 'cancel').length}`)

      // D) Bounce (campo->mano): hoy sin rama en B, depende del camino A.
      const bounceEntries = await push(
        'D bounce campo->mano',
        `view => {
          const me = view.players.find(p => p.controlled);
          const ids = Object.keys(me.battlefield ?? {});
          if (ids.length > 0) {
            const perm = me.battlefield[ids[0]];
            delete me.battlefield[ids[0]];
            view.myHand[ids[0]] = perm;
          }
        }`,
      )
      report.push(`D: starts=${bounceEntries.filter((e) => e.kind === 'start').length} ids=${[...new Set(bounceEntries.map((e) => e.cardId))].join(',')}`)

      // E) Descarte (mano->cementerio): hoy sin rama en B.
      const myHandBefore = await page.evaluate(() => {
        const w = window as unknown as { __mageStore?: { getState: () => any } }
        return Object.keys(w.__mageStore?.getState().game?.myHand ?? {})
      })
      const discardEntries = await push(
        'E descarte mano->cementerio',
        `view => {
          const me = view.players.find(p => p.controlled);
          const ids = Object.keys(view.myHand ?? {});
          if (ids.length > 0) {
            const card = view.myHand[ids[0]];
            delete view.myHand[ids[0]];
            me.graveyard = { ...(me.graveyard ?? {}), [ids[0]]: card };
          }
        }`,
      )
      const arrived = await page.evaluate((id) => {
        const w = window as unknown as { __mageStore?: { getState: () => any } }
        const game = w.__mageStore?.getState().game
        const me = game?.players?.find((p: any) => p.controlled)
        return { inGrave: !!(id && me?.graveyard?.[id]), graveCount: Object.keys(me?.graveyard ?? {}).length }
      }, myHandBefore[0] ?? null)
      report.push(`E: starts=${discardEntries.filter((e) => e.kind === 'start').length} arrived=${JSON.stringify(arrived)}`)
      expect(arrived.inGrave, 'E: la carta descartada debe llegar al cementerio').toBe(true)
      expect(
        discardEntries.some((e) => e.kind === 'start'),
        'E: el descarte debe iniciar un vuelo (rama G del engine)',
      ).toBeTruthy()

      // F) Ráfaga real: la misma carta cambia de zona 3 veces con 50ms
      // entre updates (como una ráfaga del servidor real). Observa cancels.
      const burstId = await page.evaluate(() => {
        const w = window as unknown as { __mageStore?: { getState: () => any } }
        return Object.keys(w.__mageStore?.getState().game?.myHand ?? {})[0] ?? null
      })
      if (burstId) {
        const b0 = (await flightLog(page)).length
        const burstPush = (fn: string) =>
          page.evaluate(
            ({ gameId, fn: code }) => {
              const w = window as unknown as {
                __mageStore?: { getState: () => any; handleMessage: (m: any) => void }
              }
              const st = w.__mageStore
              if (!st) throw new Error('sin __mageStore')
              const next = structuredClone(st.getState().game)
              const apply = new Function('view', `return (${code})(view)`) as (v: any) => void
              apply(next)
              st.handleMessage({ type: 'event', method: 'GAME_UPDATE', messageId: Date.now(), objectId: gameId, data: { gameView: next } })
            },
            { gameId: setup.gameId, fn },
          )
        await burstPush(`view => {
          const me = view.players.find(p => p.controlled);
          const card = view.myHand['${burstId}'];
          delete view.myHand['${burstId}'];
          view.stack = { ...(view.stack ?? {}), ['${burstId}']: { ...card, controllerId: me.playerId, controllerName: me.name } };
        }`)
        await page.waitForTimeout(50)
        await burstPush(`view => {
          const me = view.players.find(p => p.controlled);
          const spell = (view.stack ?? {})['${burstId}'];
          if (spell) {
            delete view.stack['${burstId}'];
            me.battlefield['${burstId}'] = { ...spell, tapped: false };
          }
        }`)
        await page.waitForTimeout(50)
        await burstPush(`view => {
          const me = view.players.find(p => p.controlled);
          const perm = (me.battlefield ?? {})['${burstId}'];
          if (perm) {
            delete me.battlefield['${burstId}'];
            me.graveyard = { ...(me.graveyard ?? {}), ['${burstId}']: perm };
          }
        }`)
        await page.waitForTimeout(900)
        const burstEntries = (await flightLog(page)).slice(b0)
        const burstForCard = burstEntries.filter((e) => e.cardId === burstId)
        report.push(
          `--- F rafaga real 50ms (misma carta x3) ---\n` +
            burstEntries.map((e) => `${e.kind}${e.reason ? `:${e.reason}` : ''} ${e.cardId} ${e.detail ?? ''}`).join('\n'),
        )
        // La ráfaga debe encadenar UN fantasma continuo: sin cancels y con
        // al menos un chain; el destino final es el cementerio.
        expect(
          burstForCard.some((e) => e.kind === 'cancel'),
          'F: la ráfaga no debe cancelar vuelos en curso',
        ).toBe(false)
        expect(
          burstForCard.some((e) => e.kind === 'chain'),
          'F: la ráfaga debe encadenar el fantasma al nuevo destino',
        ).toBeTruthy()
        const finalPlace = await page.evaluate((id) => {
          const w = window as unknown as { __mageStore?: { getState: () => any } }
          const game = w.__mageStore?.getState().game
          const me = game?.players?.find((p: any) => p.controlled)
          return {
            inGrave: !!me?.graveyard?.[id],
            inHand: !!game?.myHand?.[id],
            inStack: !!game?.stack?.[id],
            inBf: !!me?.battlefield?.[id],
          }
        }, burstId)
        expect(finalPlace, 'F: la carta debe terminar en el cementerio').toEqual({
          inGrave: true,
          inHand: false,
          inStack: false,
          inBf: false,
        })
      }

      await test.info().attach('flights-diag', { body: report.join('\n'), contentType: 'text/plain' })
      console.log(report.join('\n'))
      expect(pageErrors, `pageerrors: ${pageErrors.map(String).join(' | ')}`).toEqual([])
    },
  )
})
