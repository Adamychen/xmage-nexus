import { saveConn, clearActiveGame, clearActiveDraft } from '../state/persistence'
import { markSetupDone } from '../setup/setupFlag'
import { addStarterDecks } from '../decks/starterDecks'
import { getDeckStorage } from '../decks/storage'
import { DEMO_USERNAME } from './data'

export async function seedDemoSession(): Promise<void> {
  markSetupDone()
  clearActiveGame()
  clearActiveDraft()
  saveConn({
    wsHost: 'demo',
    proxyPort: 0,
    serverHost: 'demo.xmage.nexus',
    port: 17171,
    username: DEMO_USERNAME,
    password: '',
    flagName: 'ar',
    avatarId: 12,
  })
  try {
    const existing = await getDeckStorage().list()
    if (existing.length === 0) await addStarterDecks()
  } catch {}
}
