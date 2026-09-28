import { beforeEach } from 'vitest'
import { ensureLocaleLoaded, setLanguage } from './i18n'
import { resetScryfallClient, setScryfallPacing } from './cards/scryfallClient'

// La suite histórica aserta textos de UI en español. El default de la app es
// inglés (getInitialLanguage), así que los tests parten de español salvo que
// el propio spec cambie de idioma con setLanguage().
//
// Cada locale es su propio chunk desde que se cargan bajo demanda, así que fijar
// el idioma no basta: hay que esperar a que su schema esté en memoria antes de
// renderizar, o el `t()` cae al inglés y el spec falla por el texto equivocado.
beforeEach(async () => {
  setLanguage('es')
  await ensureLocaleLoaded('es')
  resetScryfallClient()
  setScryfallPacing({ spacingMs: 0 })
})
