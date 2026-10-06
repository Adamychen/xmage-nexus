/**
 * LEARN contra el STACK REAL (proxy 8787 + XMage local 17171; test-mode para el
 * cheatSetup). Ejecutar: E2E_BACKEND=real E2E_SERVER_HOST=localhost npx
 * playwright test learn-real.spec.ts
 *
 * Cadena completa que el informe del tester dio por rota ("no podía elegir
 * Lessons del sideboard al aprender"), verificada de punta a punta:
 *   1. Mesa con mazo de Swamps + 4 Eyetwitch (main) y Environmental Sciences
 *      en el SIDEBOARD (inyectado por localStorage, como un mazo de usuario).
 *   2. cheatSetup (test-mode): Eyetwitch + tierras en campo, Bolt en mano.
 *   3. Bolt → Eyetwitch muere → GAME_ASK del learn → SÍ en la AskBar.
 *   4. El CardGrid "Select a Lesson card" muestra la Lesson del sideboard y el
 *      clic envía sendPlayerUUID(<lesson-id>) → la Lesson llega a la mano.
 *
 * El lado fake (mismo payload wire) vive en learn.spec.ts; el parser contra el
 * frame real capturado, en feedback.learnReal.test.ts.
 */
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { startGame } from './support/start-game'
import { parseFrames, parseSent, sentOf } from './support/frames'
import { payMana } from './support/game-screen'
import type { HumanHelper } from './wshelper'

const LESSON = 'Environmental Sciences'
const WITCH = 'Eyetwitch'
const BOLT = 'Lightning Bolt'

const LEARN_DECK = {
  name: 'Mage Web learn real',
  cards: [
    { cardName: WITCH, setCode: 'STX', cardNumber: '70', amount: 4 },
    { cardName: 'Swamp', setCode: 'LEA', cardNumber: '290', amount: 56 },
  ],
  sideboard: [{ cardName: LESSON, setCode: 'STX', cardNumber: '1', amount: 1 }],
}

test.skip(FAKE_MODE, 'solo stack real (proxy + XMage local)')

test('LEARN real: Eyetwitch muere → learn → elegir Lesson del sideboard en el CardGrid', async ({ page }) => {
  // mazo del usuario vía localStorage (los precons solo existen en dev)
  await page.addInitScript((deck) => {
    localStorage.setItem('mage_decks_v2', JSON.stringify([deck]))
  }, LEARN_DECK)

  const { helper, frames, sent, username } = await startGame(page, {
    prefix: 'lrn',
    tableName: `learn-real-${Date.now().toString().slice(-6)}`,
    deck: LEARN_DECK.name,
    skipAsks: true, // el SÍ del learn lo da el test por UI
  })
  test.setTimeout(180_000)

  // 1) cheat: Eyetwitch + tierras en campo, Bolt en mano. Debe correr en MI
  //    turno con ≥1 acción previa (cheatear antes congela el loop del juego,
  //    mismo contrato que el recorder en scripts/rec-lib.mjs).
  await helper.waitGameId(20_000)
  await waitMyMain(frames)
  // el cheat necesita ≥1 acción previa en el juego (rec-lib: "solo turno propio
  // tras ≥1 acción"); esperar al desarrollo de tierra del helper en turno 1.
  await waitLandDropped(frames)
  const { gameId, playerId } = await myIds(frames)
  expect(gameId, 'gameId desde frames').toBeTruthy()
  const cheat = await helper.raw('cheatSetup', {
    gameId,
    playerId,
    zones: {
      battlefield: [WITCH, 'Swamp', 'Swamp', 'Mountain'],
      hand: [BOLT],
    },
  })
  expect(cheat, 'cheatSetup aceptado (servidor test-mode)').toBeTruthy()

  // 2) lanzar el Bolt sobre la Eyetwitch (WS, patrón defeat.spec). Con el
  //    helper en pausa el juego SOLO avanza con los pases explícitos del test:
  //    cada ventana queda abierta y no hay carreras con el auto-pilot.
  helper.paused = true
  let manaPaid = false
  for (let attempt = 0; attempt < 10 && !manaPaid; attempt++) {
    const boltId = await playableBoltId(frames, 4_000)
    if (boltId) {
      const witchId = await battlefieldIdOf(frames, WITCH, 2_000)
      if (witchId) {
        await helper.playCard(boltId)
        await helper.playCard(witchId)
        try {
          await payMana(page, helper)
          manaPaid = true
          break
        } catch {
          // el cast llegó tarde: reintentar con ids frescos
        }
      }
    }
    await helper.passPriority()
  }
  expect(manaPaid, 'Bolt lanzado y pagado').toBe(true)

  // 2b) con el helper en pausa, el trigger de muerte solo resuelve si YO paso:
  //     pasar hasta que el GAME_ASK del learn llegue (el SIM pasa solo).
  const learnAskSeen = () => parseFrames(frames).some(
    (f) => f.method === 'GAME_ASK' && /lesson/i.test(String(f.data?.question ?? f.data?.message ?? '')),
  )
  for (let i = 0; i < 8 && !learnAskSeen(); i++) {
    await helper.passPriority()
    await page.waitForTimeout(800)
  }

  // 3) GAME_ASK del learn → SÍ en la AskBar (flujo del tester: "while learning")
  const askBar = page.locator('.ask-prompt-bar').filter({ hasText: /Lesson/i })
  await expect(askBar, 'AskBar del learn visible').toBeVisible({ timeout: 20_000 })
  await askBar.getByRole('button', { name: /sí|yes/i }).click()

  // 4) CardGrid "Select a Lesson card": la Lesson del sideboard debe ser
  //    visible y clicable, y el clic debe enviar su UUID.
  const grid = page.locator('.card-grid-dialog')
  await expect(grid, 'CardGrid del wish visible').toBeVisible({ timeout: 15_000 })
  await expect(grid).toContainText(LESSON)
  await grid.locator('.card-grid-cell', { hasText: LESSON }).click()

  await expect
    .poll(() => parseSent(sentOf(page)).some((s) => s.action === 'sendPlayerUUID' && typeof s.args?.value === 'string' && s.args.value.length === 36), { timeout: 10_000 })
    .toBe(true)
  // el UUID enviado debe ser el de la Lesson (el id real que ofrece possibleTargets)
  const picked = parseSent(sentOf(page))
    .filter((s) => s.action === 'sendPlayerUUID')
    .map((s) => String(s.args?.value))
  const lessonId = await lessonIdFromFrames(frames)
  expect(lessonId, 'possibleTargets de la Lesson en el wire').toBeTruthy()
  expect(picked, `sendPlayerUUID con la Lesson (${lessonId})`).toContain(lessonId!)

  // 5) la Lesson llega a la mano (estado real del servidor, vía gameView)
  await expect
    .poll(() => latestHandHas(frames, LESSON), { timeout: 20_000 })
    .toBe(true)

  console.log(`[learn-real] OK user=${username} lesson=${lessonId}`)
})

// ── helpers locales ──────────────────────────────────────────────────────────

interface GameViewLike {
  myPlayerId?: string | null
  players?: Array<{ controlled?: boolean; playerId?: string; battlefield?: Record<string, unknown> }>
  myHand?: Record<string, unknown>
}

function lastGameView(frames: Array<Record<string, unknown> | null>): GameViewLike | null {
  for (let i = frames.length - 1; i >= 0; i--) {
    const gv = (frames[i] as { data?: { gameView?: GameViewLike } } | null)?.data?.gameView
    if (gv) return gv
  }
  return null
}

async function myIds(frames: Array<Record<string, unknown> | null>): Promise<{ gameId: string; playerId: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    for (const f of frames) {
      const ev = f as { method?: string; objectId?: string } | null
      if (ev?.method?.startsWith('GAME_') && ev.objectId) {
        const gv = lastGameView(frames)
        const playerId = gv?.myPlayerId ?? gv?.players?.find((p) => p.controlled)?.playerId
        if (playerId) return { gameId: ev.objectId, playerId }
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('no encontré gameId/playerId en los frames')
}

/** id de un permanente en el campo propio, leído de los frames capturados */
async function battlefieldIdOf(frames: Array<Record<string, unknown> | null>, cardName: string, timeoutMs = 6_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const gv = lastGameView(frames)
    const me = gv?.players?.find((p) => p.controlled)
    for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
      if ((c as { name?: string }).name === cardName) return id
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

/** id de la Lesson desde options.possibleTargets del GAME_TARGET del learn */
async function lessonIdFromFrames(frames: Array<Record<string, unknown> | null>): Promise<string | null> {
  for (const f of frames) {
    const ev = f as { method?: string; data?: { message?: string; options?: { possibleTargets?: string[] } } } | null
    if (ev?.method === 'GAME_TARGET' && /lesson/i.test(ev.data?.message ?? '')) {
      const ids = ev.data?.options?.possibleTargets
      if (Array.isArray(ids) && ids.length > 0) return ids[0]
    }
  }
  return null
}

/** Espera a que el helper haya desarrollado una tierra (≥1 acción previa al cheat). */
async function waitLandDropped(frames: Array<Record<string, unknown> | null>, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const gv = lastGameView(frames)
    const me = gv?.players?.find((p) => p.controlled)
    const lands = Object.values(me?.battlefield ?? {}).filter((c) => String((c as { cardTypes?: string[] }).cardTypes ?? []).includes('LAND'))
    if (lands.length > 0) return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('el helper no desarrolló tierra a tiempo')
}

/** Espera a que sea mi precombate principal (turno propio, fase main). */
async function waitMyMain(frames: Array<Record<string, unknown> | null>, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const gv = lastGameView(frames)
    const me = gv?.players?.find((p) => p.controlled)
    if (me?.isActive === true && gv?.phase === 'PRECOMBAT_MAIN') return
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('no llegó mi PRECOMBAT_MAIN')
}

/** id del Bolt jugable: carta de mano nombrada BOLT cuya id es clave de
 *  canPlayObjects.objects (mismo criterio que playableInView). */
async function playableBoltId(frames: Array<Record<string, unknown> | null>, timeoutMs = 45_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const gv = lastGameView(frames) as { canPlayObjects?: { objects?: Record<string, unknown> }; myHand?: Record<string, { name?: string }> } | null
    const objects = gv?.canPlayObjects?.objects ?? {}
    for (const [id, card] of Object.entries(gv?.myHand ?? {})) {
      if (objects[id] && (card?.name === BOLT || (card as { displayName?: string })?.displayName === BOLT)) return id
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return null
}

function latestHandHas(frames: Array<Record<string, unknown> | null>, cardName: string): boolean {
  const gv = lastGameView(frames)
  if (!gv) return false
  for (const c of Object.values(gv.myHand ?? {})) {
    if ((c as { name?: string }).name === cardName) return true
  }
  return false
}