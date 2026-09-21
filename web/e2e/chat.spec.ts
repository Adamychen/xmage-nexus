import { fakeOnly } from './support/fake-mode'
import { test, expect } from './fixtures'
import { cleanupUser } from './cleanup'
import { login } from './support/start-game'
import { openDrawerTab } from './support/game-screen'
import { FakeServer } from '../fixtures/fake'
import { chatScenario } from '../fixtures/scenarios/chat'
import { FAKE_MODE } from './dual'
import { getFakePort, setFakePort } from './support/fake-port'

// Override the default fixture to use the chat scenario
const chatTest = test.extend<{ chatServer: FakeServer | null }>({
  chatServer: [
    async ({}, use) => {
      if (!FAKE_MODE) {
        await use(null)
        return
      }
      const server = await FakeServer.start(0, () => chatScenario())
      const previousPort = getFakePort()
      setFakePort(server.port)
      try {
        await use(server)
      } finally {
        try {
          await server.stop()
        } finally {
          setFakePort(previousPort)
        }
      }
    },
    { scope: 'test' },
  ],
})

chatTest(
  'lobby chat: send and receive messages',
  { tag: '@chat' },
  async ({ page, chatServer }) => {
    void chatServer
    const username = `chat-${String(Date.now()).slice(-9)}`
    cleanupUser(username)

    await login(page, username)

    // lobby visible
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })

    // el chat global vive en el panel flotante (cerrado por defecto): abrirlo vía FAB
    await page.locator('.floating-chat-fab').click()

    // el chat global vive en el panel lateral derecho del lobby (o en la pestaña Comunidad)
    const communityTab = page.getByRole('button', { name: /Comunidad & Chat/i })
    if (await communityTab.count() > 0 && await communityTab.isVisible()) {
      await communityTab.click()
    }

    // find the chat input in the lobby
    const chatInput = page.locator('.chat-input input')
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // send a message
    await chatInput.fill('Hello from lobby!')
    await page.locator('.chat-input button[type="submit"]').click()

    // the message should appear in the chat list
    await expect(page.locator('.chat-list')).toContainText('Hello from lobby!', { timeout: 5_000 })
    if (FAKE_MODE) {
      // el eco de otro usuario solo existe en el escenario chatScenario
      await expect(page.locator('.chat-list')).toContainText('player-1:', { timeout: 5_000 })
    }
    // U5-2: cada mensaje muestra su hora tenue
    await expect(page.locator('.chat-list .chat-time').first()).toContainText(/\d{1,2}:\d{2}/, { timeout: 5_000 })
  },
)

chatTest(
  'lobby chat: opening the floating panel does not squeeze the tables view',
  { tag: '@chat' },
  async ({ page, chatServer }) => {
    void chatServer
    const username = `chatlay-${String(Date.now()).slice(-6)}`
    cleanupUser(username)

    await login(page, username)
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })

    const mainBox = () => page.evaluate(() => {
      const el = document.querySelector('.lobby-main')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { width: r.width, marginRight: getComputedStyle(el).marginRight }
    })
    const before = await mainBox()
    expect(before).not.toBeNull()

    await page.locator('.floating-chat-fab').click()
    await expect(page.locator('.lobby-aside.floating-chat')).toBeVisible({ timeout: 10_000 })

    const after = await mainBox()
    expect(after?.marginRight).toBe('0px')
    expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThanOrEqual(1)
  },
)

chatTest(
  'game chat: send and receive messages while watching a game',
  { tag: '@chat' },
  async ({ page, chatServer }) => {
fakeOnly()
    void chatServer
    const username = `gc-${String(Date.now()).slice(-10)}`
    cleanupUser(username)

    await login(page, username)

    // lobby visible
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })

    // watch the demo game — the table row has a "Ver" button
    const tableRow = page.locator('.table-row', { hasText: 'Chat Test' })
    await expect(tableRow).toBeVisible({ timeout: 15_000 })
    await tableRow.getByRole('button', { name: /Ver|Espectar/i }).click()

    // game screen visible
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 20_000 })

    await openDrawerTab(page, 'chat')

    // find the game chat input
    const chatInput = page.locator('.game-chat-input input')
    await expect(chatInput).toBeVisible({ timeout: 10_000 })

    // send a message
    await chatInput.fill('Hello from game!')
    await page.locator('.game-chat-input button[type="submit"]').click()

    // the message should appear in the game chat
    await expect(page.locator('.game-chat-messages')).toContainText('Hello from game!', {
      timeout: 5_000,
    })
    await expect(page.locator('.game-chat-player').first()).toContainText('player-1', { timeout: 5_000 })

    // The chat and quick reactions stay inside the drawer, which sits above the action button
    const layout = await page.evaluate(() => {
      const drawer = document.querySelector('.game-drawer')
      const reactions = document.querySelector('.quick-reactions')
      const action = document.querySelector('.action-button-container')
      if (!drawer || !reactions || !action) return null
      const drawerBottom = drawer.getBoundingClientRect().bottom
      return {
        reactionsInsideDrawer: reactions.getBoundingClientRect().bottom <= drawerBottom + 1,
        drawerAboveAction: drawerBottom <= action.getBoundingClientRect().top,
      }
    })
    expect(layout).toEqual({ reactionsInsideDrawer: true, drawerAboveAction: true })
  },
)

chatTest(
  'game chat: quick reaction appears in chat',
  { tag: '@chat' },
  async ({ page, chatServer }) => {
fakeOnly()
    void chatServer
    const username = `qr-${String(Date.now()).slice(-10)}`
    cleanupUser(username)

    await login(page, username)

    // lobby visible
    await expect(page.getByRole('heading', { name: /Lobby|XMage Nexus/i })).toBeVisible({ timeout: 15_000 })

    // watch the demo game — the table row has a "Ver" button
    const tableRow = page.locator('.table-row', { hasText: 'Chat Test' })
    await expect(tableRow).toBeVisible({ timeout: 15_000 })
    await tableRow.getByRole('button', { name: /Ver|Espectar/i }).click()

    // game screen visible
    await expect(page.getByTestId('game-status')).toBeVisible({ timeout: 20_000 })

    await openDrawerTab(page, 'chat')

    // click a quick reaction button
    const thumbsUp = page.locator('.quick-reaction-btn', { hasText: '👍' })
    await expect(thumbsUp).toBeVisible({ timeout: 10_000 })
    await thumbsUp.click()

    // the emoji should appear in the game chat
    await expect(page.locator('.game-chat-messages')).toContainText('👍', { timeout: 5_000 })
  },
)
