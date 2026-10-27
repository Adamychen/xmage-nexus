import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './ui/ErrorBoundary'
import { preloadInitialLocale } from './i18n'
import { installErrorCapture } from './system/errorLog'
import './styles.css'

installErrorCapture()

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
