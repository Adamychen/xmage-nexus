import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ui/ErrorBoundary'
import { preloadInitialLocale } from './i18n'
import { installErrorCapture } from './system/errorLog'
import { installFlagEmojiFont } from './system/flagEmoji'
import { publishDigitShift } from './ui/digitShift'
import './system/webFonts.css'
import './styles.css'

installErrorCapture()
installFlagEmojiFont()

// BRD-55: the badges centre their numbers on the ink, which depends on the font that ends up
// loading, so it is measured here and again once the web fonts are in.
publishDigitShift()
document.fonts?.ready.then(() => publishDigitShift()).catch(() => {})

// The nine locales are separate chunks; only the one this player reads is fetched, and the
// render below starts immediately in English if it has not arrived yet.
preloadInitialLocale()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
