import { createCustomImageStore } from './customImage'

export { coverCrop } from './customImage'

export const CUSTOM_SLEEVE_KEY = 'mage-web-custom-sleeve'
export const CUSTOM_SLEEVE_WIDTH = 372
export const CUSTOM_SLEEVE_HEIGHT = 520

export const customSleeveStore = createCustomImageStore(
  CUSTOM_SLEEVE_KEY,
  { mode: 'cover', width: CUSTOM_SLEEVE_WIDTH, height: CUSTOM_SLEEVE_HEIGHT },
  0.85,
)

export const getCustomSleeve = customSleeveStore.get
export const setCustomSleeve = customSleeveStore.set
export const clearCustomSleeve = customSleeveStore.clear
export const useCustomSleeve = customSleeveStore.use
export const fileToSleeveDataUrl = customSleeveStore.fromFile
