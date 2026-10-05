import { createCustomImageStore } from './customImage'

export const CUSTOM_PLAYMAT_KEY = 'mage-web-custom-playmat'

export const customPlaymatStore = createCustomImageStore(
  CUSTOM_PLAYMAT_KEY,
  { mode: 'contain', maxWidth: 1920, maxHeight: 1080 },
  0.82,
)

export const useCustomPlaymat = customPlaymatStore.use
