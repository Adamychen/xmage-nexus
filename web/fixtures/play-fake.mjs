// Manual play against the FixtureServer: starts Vite (5173) plus a fake proxy
// on 8789 running the Commander playground. No Java, proxy or XMage server.
// Usage: npm run play:fake  (from web/)
import { createServer } from 'vite'

const FAKE_PORT = Number(process.env.FAKE_PORT || 8789)

const vite = await createServer({ server: { port: 5173, strictPort: true } })
const { FakeServer } = await vite.ssrLoadModule('/fixtures/fake.ts')
const { commanderPlaygroundScenario } = await vite.ssrLoadModule('/fixtures/scenarios/commanderPlayground.ts')

const fake = await FakeServer.start(FAKE_PORT, commanderPlaygroundScenario)
await vite.listen()

const url = `http://localhost:5173/?proxyPort=${fake.port}`
console.log('')
console.log('  Commander playground (fake server, no XMage needed)')
console.log(`  Open:   ${url}`)
console.log('  Login:  any username (3-14 chars), Proxy WS = localhost, then Connect')
console.log('  Lobby:  press Start on "Commander playground"')
console.log('  Stop:   Ctrl+C')
console.log('')

const shutdown = async () => {
  await fake.stop()
  await vite.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
