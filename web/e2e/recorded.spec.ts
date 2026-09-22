import { DECK } from '../fixtures/deck-names'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures'
import { fakeOnly } from './support/fake-mode'
import { startGame } from './support/start-game'
import { withFakeServer } from './support/fake-backend'
import { playableInSceneByName } from './support/scene'
import { expectStackCount, openDrawerTab } from './support/game-screen'
import { replayRecordedScenario, REPLAY_TABLE_NAME } from '../fixtures/scenarios/replay-recorded'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'recorded', 'manifest.json'), 'utf8'),
) as Array<{ file: string; mechanic: string; assert: string; kind?: 'game' | 'construct' | 'tournament' }>

// Solo los frames de partida (kind 'game' o sin kind) se reemiten como
// GAME_INIT en el FakeServer. Los frames de torneo (CONSTRUCT pool,
// tournament Finished) se validan en fixtures/recorded.test.ts (forma real
// del protocolo); su replay en el FakeServer (ConstructScreen con pool real,
// panel de torneo Finished) queda como trabajo futuro — ver plan2 D.20.
const replayable = manifest.filter((e) => (e.kind ?? 'game') === 'game')

// Smoke test anti-deriva: cada frame real grabado se reemite en el FakeServer y
// el web debe pintarlo sin errores. No depende del servidor real ni de beta.
fakeOnly()
test.describe('Recorded real frames (anti-drift smoke)', { tag: '@recorded' }, () => {
  for (const entry of replayable) {
    test(`${entry.mechanic} (${entry.file}) renderiza sin errores`, async ({ page }) => {
      await withFakeServer(() => replayRecordedScenario(entry.file), async () => {
        const { pageErrors } = await startGame(page, {
          prefix: `rec-${entry.mechanic}`,
          tableName: REPLAY_TABLE_NAME,
          deck: DECK.advanced,
        })

        expect(pageErrors).toEqual([])

        // El tablero pinta al menos una carta del humano (salvo fin de partida
        // en mulligan: sin mano/campo, solo el estado de la partida).
        if (entry.assert === 'hasConcedeMulligan' || entry.assert === 'hasTimeoutLoss') {
          // Fin de partida sin concesión explícita de cartas: el jugador
          // controlado ya salió (conceder en mulligan / reloj agotado) y su
          // zona queda vacía.
          await expect(page.locator('[data-testid="game-status"]')).toBeVisible()
          await expect(page.locator('.player-zone .card-slot')).toHaveCount(0)
        } else if (entry.assert === 'firstMulliganFreeSecondCostsCard') {
          // Justo tras el mulligan (turno 1): mano final de 6 (dos mulligans
          // con el primero gratis: 7 − 1 carta al fondo) y el comandante en
          // la zona de mando (el único card-slot del player-zone).
          await expect(page.locator('[data-testid="game-status"]')).toBeVisible()
          await expect(page.getByTestId('hand-bar')).toHaveAttribute('data-hand-count', '6')
          await expect(page.locator('.player-zone .card-slot[data-card-name="Krenko, Mob Boss"]')).toHaveCount(1)
        } else if (entry.assert === 'hasKarnRestart') {
          // Reinicio de Karn: mesa vacía pero mano nueva (7 cartas).
          await expect(page.locator('.hand-zone .card-slot').first()).toBeVisible()
        } else {
          const myCard = page.locator('.player-zone .card-slot').first()
          await expect(myCard).toBeVisible()
        }

        // Sin grupos de attachment heredados (el render de mutate/pila es distinto).
        // Los frames con adjunto propio (aura, Lure forzando bloqueo) se asertan aparte.
        if (entry.assert === 'hasAttachedAura' || entry.assert === 'hasMustBlock' || entry.assert === 'hasTrampleDeathtouch') {
          await expect(page.locator('.card-attachment-group')).not.toHaveCount(0)
        } else {
          await expect(page.locator('.card-attachment-group')).toHaveCount(0)
        }

        if (entry.assert === 'hasMutatedPermanent') {
          await expect(page.locator('.player-zone .card-mutate-pile')).toBeVisible()
          await expect(page.locator('.player-zone .card-mutate-pile .mutate-part')).toHaveCount(2)
        }
        if (entry.assert === 'hasNonMutatedCreature') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toBeVisible()
        }
        if (entry.assert === 'hasCounterOnStack') {
          await expectStackCount(page, 2)
          await page.locator('.stack-zone .stack-tl-entry').first().hover()
          const preview = page.locator('.stack-zone .floating-card-preview')
          await expect(preview).toBeVisible({ timeout: 10_000 })
          const box = await preview.boundingBox()
          const viewport = page.viewportSize()
          expect(box, 'el preview de la pila tiene caja').not.toBeNull()
          expect(box!.x).toBeGreaterThanOrEqual(0)
          expect(box!.y).toBeGreaterThanOrEqual(0)
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
        }
        if (entry.assert === 'hasPlaneswalker') {
          const marquee = page.locator('.pz-marquee')
          await expect(marquee).toBeVisible()
          const stackPanel = page.locator('[data-testid="game-drawer"] .stack-zone')
          await expect(stackPanel).toBeVisible()
          const pw = await marquee.boundingBox()
          const stack = await stackPanel.boundingBox()
          expect(pw).not.toBeNull()
          expect(stack).not.toBeNull()
          const overlaps =
            pw!.x < stack!.x + stack!.width &&
            stack!.x < pw!.x + pw!.width &&
            pw!.y < stack!.y + stack!.height &&
            stack!.y < pw!.y + pw!.height
          expect(overlaps, 'la pila no tapa el planeswalker').toBe(false)
        }
        if (entry.assert === 'hasTokens') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Goblin Token"]')).toHaveCount(2)
        }
        if (entry.assert === 'hasModalOnStack') {
          await expectStackCount(page, 1)
        }
        if (entry.assert === 'hasXCostCounters') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Walking Ballista"]')).toBeVisible()
        }
        if (entry.assert === 'hasStackResponse') {
          await expectStackCount(page, 2)
        }
        if (entry.assert === 'hasDoubleTrigger') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Soul Warden"]')).toHaveCount(2)
        }
        if (entry.assert === 'hasSolemn') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Solemn Simulacrum"]')).toBeVisible()
        }
        if (entry.assert === 'hasConvoke') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toHaveCount(4)
        }
        if (entry.assert === 'hasOverload') {
          await expectStackCount(page, 1)
        }
        if (entry.assert === 'hasKicker') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Goblin Bushwhacker"]')).toBeVisible()
        }
        if (entry.assert === 'hasClone') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Elvish Mystic"]')).toBeVisible()
        }
        if (entry.assert === 'hasTransform') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Insectile Aberration"]')).toBeVisible()
        }
        if (entry.assert === 'hasAdventure') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Bonecrusher Giant"]')).toBeVisible()
        }
        if (entry.assert === 'hasSplit') {
          await expectStackCount(page, 1)
        }
        if (entry.assert === 'hasSnowFight') {
          await expectStackCount(page, 1)
        }
        if (entry.assert === 'hasSplitSecond') {
          await expectStackCount(page, 1)
          // Split second con prioridad nuestra: el servidor solo ofrece
          // habilidades de maná (las tierras) y nunca el Bolt de la mano. La
          // UI debe marcar la fuente de maná como jugable y NO el Bolt
          // (plan4 §3.5).
          await expect(page.locator('.player-zone .card-slot.playable').first()).toBeVisible()
          const bolt = page.locator('.hand-bar .card-slot[data-card-name="Lightning Bolt"]')
          await expect(bolt).toHaveCount(1)
          await expect(bolt).not.toHaveClass(/playable/)
          expect(await playableInSceneByName(page, 'Lightning Bolt')).toBeNull()
        }
        if (entry.assert === 'hasCompanion') {
          // El compañero propio está en la mano (se pagó {3}); el del SIM
          // sigue en su zona de compañero.
          await expect(page.locator('.hand-bar .card-slot[data-card-name="Lurrus of the Dream-Den"]')).toHaveCount(1)
        }
        if (entry.assert === 'hasLookedAt') {
          // Mirar la mano del rival abre el visor temporal (G12-2).
          await expect(page.locator('.pile-overlay')).toBeVisible()
        }
        if (entry.assert === 'hasMultikicker') {
          // Chalice con 2 contadores de carga (2 kicks pagados).
          const chalice = page.locator('.player-zone .card-slot[data-card-name="Everflowing Chalice"]')
          await expect(chalice).toHaveCount(1)
          await expect(chalice).toHaveAttribute('data-counters', /charge:2/)
        }
        if (entry.assert === 'hasStrive') {
          // Dos objetivos: ambos Grizzlies con la habilidad concedida.
          await expect(page.locator('.player-zone .card-slot[data-card-name="Grizzly Bears"]')).toHaveCount(2)
        }
        if (entry.assert === 'hasCombatTrick') {
          // Giant Growth en la ventana de bloqueadores: 2/2 → 5/5.
          await expect(page.locator('.player-zone .card-slot[data-card-name="Grizzly Bears"][data-pt="5/5"]')).toHaveCount(1)
        }
        if (entry.assert === 'hasPodCombat') {
          // La flecha REAL del overlay apunta al defensor del frame (el último
          // SIM), no al primer no-activo (atajo del preview en pod).
          const raw = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'recorded', entry.file), 'utf8'),
          ) as { gameView?: { combat?: Array<{ defenderId?: string }> } }
          const defenderId = raw.gameView?.combat?.[0]?.defenderId ?? ''
          expect(defenderId).not.toBe('')
          await expect(
            page.locator(`.arrow-group.arrow-attack[data-arrow-to="${defenderId}"]`),
          ).toHaveCount(1)
        }
        if (entry.assert === 'hasPodCommander') {
          // El daño de comandante no tiene campo en el view: solo viaja como
          // texto en `rules` del comandante ("Commander did N combat damage to
          // player X."). La matriz del sidebar debe parsearlo y pintar N.
          const raw = JSON.parse(
            fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'recorded', entry.file), 'utf8'),
          ) as {
            gameView?: {
              players?: Array<{
                playerId?: string
                name?: string
                controlled?: boolean
                commandList?: Array<{ id?: string; name?: string; rules?: string[] }>
              }>
            }
          }
          const players = raw.gameView?.players ?? []
          const me = players.find((p) => p?.controlled)
          const cmd = (me?.commandList ?? []).find((c) => /krenko, mob boss/i.test(String(c?.name ?? '')))
          const rules = (cmd?.rules ?? []).map((r) => String(r).replace(/<[^>]*>/g, ' ')).join(' ')
          const m = rules.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
          expect(m, 'rules del comandante con la línea de daño').not.toBeNull()
          const dmg = Number(m?.[1] ?? 0)
          const target = players.find(
            (p) => String(p?.name ?? '').toLowerCase() === String(m?.[2] ?? '').trim().toLowerCase(),
          )
          expect(target, 'el rival dañado existe en el frame').toBeTruthy()
          await openDrawerTab(page, 'commander')
          await expect(page.locator('[data-testid="commander-damage-matrix"]')).toBeVisible()
          await expect(
            page.locator(`[data-testid="cdm-cell-${target?.playerId}-${cmd?.id}"][data-damage="${dmg}"]`),
          ).toHaveCount(1)
        }
        if (entry.assert === 'hasFfaSix') {
          // 5+ jugadores (decisión §9.1): standard con switcher, NO pod (que
          // recorta a MAX_BOARD_PLAYERS=4).
          await expect(page.locator('[data-testid="game-board"]')).toBeVisible()
          await expect(page.locator('[data-testid="pod-board"]')).toHaveCount(0)
          const bar = page.locator('.opponent-switcher-bar')
          await expect(bar).toBeVisible()
          await expect(bar.locator('.opp-pill')).toHaveCount(6)
        }
        if (entry.assert === 'hasCascade') {
          await expect(page.locator('.player-zone .card-slot[data-card-name="Bloodbraid Elf"]')).toBeVisible()
        }
      })
    })
  }
})
