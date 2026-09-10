import { beforeEach } from 'vitest'
import { setLanguage } from './i18n'

// La suite histórica aserta textos de UI en español. El default de la app es
// inglés (getInitialLanguage), así que los tests parten de español salvo que
// el propio spec cambie de idioma con setLanguage().
beforeEach(() => {
  setLanguage('es')
})
