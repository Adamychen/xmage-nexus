# Appearance

Prefix: `APR`

Which colour appearance the client shows: light or dark, who chooses it, and which surfaces stay dark
regardless. The tokens are defined once in `web/src/ui/tokens.css`; this file says which set applies
where.

### APR-1 · The interface is dark by default and the player can choose Light or System
The client renders the dark appearance unless the player chooses otherwise. Settings › Interface offers
Dark (the default), System and Light. System renders the light appearance when the operating system asks
for light and the dark appearance otherwise. The choice is the `appearance` field of the
`mage-web-appearance` settings object, which also holds the board's other appearance settings, so saving
it never drops them. An unknown or missing value reads as Dark. It is applied as a `data-appearance`
attribute on `<html>`; System removes the attribute and follows the operating system. Both appearances are
defined in `web/src/ui/tokens.css` as the same semantic tokens, once per token value, and no component
picks a colour by appearance itself.

- Why: Apple's Dark Mode guidance asks an app to look right in both appearances, and it discourages an
  app-specific appearance setting because it doubles the settings a person must keep in sync. The
  client was forced to dark with `color-scheme: dark` in `web/src/styles.css`, which the 2026-10-25
  review flagged. The player then asked for a way to choose, and then for Dark as the default
  (2026-10-25); System and Light stay on offer, so the app opens dark for anyone who has not chosen.
- Guard: `src/appearance/appearanceTheme.test.ts` · `src/settings/appearanceSetting.test.tsx` · `e2e/appearance.spec.ts`

### APR-2 · The game screen stays dark in both appearances
The game screen keeps the dark token set whatever the system appearance: the battlefield (zones, hand,
stack, the turn ring and the play mat), the overlays drawn over it (piles, the card inspector, the
cross-zone overlay) and the in-game chrome around it (phase bar, player bars, priority dock, log). The
game screen is the root element that carries the `board-surface` class. Dialogs and panels drawn inside
that tree (the question dialogs, the sideboard, the tournament and side panels) carry the
`chrome-surface` class, which re-applies the appearance-dependent tokens, so they follow APR-1 even
though they sit in the game's tree.

- Why: the cards are read against the table, and the game screen is the immersive surface of the game.
  Apple's Dark Mode guidance allows a permanently dark appearance in that case ("consider using only a
  dark appearance … for immersive media"). The lobby, login, deck builder and dialogs are chrome and are
  not exempt.
- Guard: `src/appearance/appearanceTheme.test.ts` · `e2e/appearance.spec.ts`

### APR-3 · Text and controls keep WCAG AA contrast in both appearances
In each appearance, every text token on its surface token reaches 4.5:1, and large text reaches 3:1. A
boundary that identifies an interactive control (an input, a button, a toggle, a tab) reaches 3:1 against
its surface. Decorative hairline dividers and panel borders are exempt, as WCAG 1.4.11 exempts them: they
reach 3:1 only under Increase Contrast (ACC-2). The test computes the ratio from the token values, so a
token change that drops below the minimum fails the unit run.

- Why: Apple's Accessibility guidance uses WCAG AA as the minimum and asks for it in light and dark.
  The base hairline borders in the dark palette sit at 1.2 to 1.9:1 on `--ink-2` and were kept as they
  were reviewed; requiring 3:1 on every divider would change the look of the whole app for a need that
  WCAG does not place on decorative lines. The light appearance did not exist at review time.
- Guard: `src/appearance/appearanceContrast.test.ts`
