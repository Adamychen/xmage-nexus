// Manual play against the FixtureServer: starts Vite (5173) plus a fake proxy
// on 8789 running the Commander playground (SCENARIO=manaStack|abilityCancel|tergrid for others;
// PORT/FAKE_PORT move the two ports). No Java, proxy or XMage server.
// Usage: npm run play:fake  (from web/)
import { createServer } from 'vite'

const FAKE_PORT = Number(process.env.FAKE_PORT || 8789)
const WEB_PORT = Number(process.env.PORT || 5173)

const vite = await createServer({ server: { port: WEB_PORT, strictPort: true } })
const { FakeServer } = await vite.ssrLoadModule('/fixtures/fake.ts')
const SCENARIOS = {
  commander: ['/fixtures/scenarios/commanderPlayground.ts', 'commanderPlaygroundScenario', 'Commander playground'],
  manaStack: ['/fixtures/scenarios/manaStack.ts', 'manaStackScenario', 'mana-stack-test'],
  abilityCancel: ['/fixtures/scenarios/abilityCancel.ts', 'abilityCancelScenario', 'ability-cancel-test'],
  tergrid: ['/fixtures/scenarios/triggerOrder.ts', 'triggerOrderTergridScenario', 'trigger-order-test'],
}
const [scenarioFile, scenarioExport, scenarioTable] = SCENARIOS[process.env.SCENARIO || 'commander']
const scenario = (await vite.ssrLoadModule(scenarioFile))[scenarioExport]

const fake = await FakeServer.start(FAKE_PORT, scenario)
await vite.listen()

const url = `http://localhost:${WEB_PORT}/?proxyPort=${fake.port}`
console.log('')
console.log(`  ${scenarioTable} (fake server, no XMage needed)`)
console.log(`  Open:   ${url}`)
console.log('  Login:  any username (3-14 chars), Proxy WS = localhost, then Connect')
console.log(`  Lobby:  press Start on "${scenarioTable}"`)
console.log('  Stop:   Ctrl+C')
console.log('')

const shutdown = async () => {
  await fake.stop()
  await vite.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
