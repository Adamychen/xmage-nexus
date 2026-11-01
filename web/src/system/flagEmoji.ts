import { polyfillCountryFlagEmojis } from 'country-flag-emoji-polyfill'
import flagFontUrl from 'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2?url'

export const FLAG_FONT = 'Twemoji Country Flags'

/**
 * Windows has no glyphs for flag emoji, so 🇪🇸 shows as the letters "ES". When the browser cannot
 * draw them, this loads a font with only the flags, served by the app (no CDN, so the desktop app
 * and offline play get it too); `--font-ui` and `--font-display` list it first, and its
 * unicode-range keeps every other character on the usual fonts.
 */
export function installFlagEmojiFont(): boolean {
  return polyfillCountryFlagEmojis(FLAG_FONT, flagFontUrl)
}
