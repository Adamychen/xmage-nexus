# Accessibility

Prefix: `ACC`

How the client answers the system accessibility settings and the reach of its controls: translucency,
contrast, text size, touch targets, fixed chrome, and the login screen on a phone. The light and dark
appearances themselves live in `appearance.md`.

### ACC-1 · Translucency gives way to solid fills under Reduce Transparency
When `prefers-reduced-transparency: reduce` is set, no element uses `backdrop-filter`. A translucent
surface that carries text or controls gets an opaque fill from the same token family
(`web/src/ui/tokens.css`) instead. Every stylesheet that sets `backdrop-filter` has a
`prefers-reduced-transparency` block that removes it, including the dialog scrim.

- Why: a blur over the content is the first thing a person with a vestibular or contrast sensitivity
  turns off. Apple's Materials guidance requires the material to respond to the Reduce Transparency
  setting; 49 `backdrop-filter` rules had no response when the client was reviewed (2026-10-25).
- Guard: `src/a11yStyle.test.ts`

### ACC-2 · Increase Contrast raises the lines and secondary text
With `prefers-contrast: more`, the border tokens (`--line-*`) reach at least 3:1 against the surface
they sit on, and the secondary text tokens (`--fg-2`, `--fg-3`) reach at least 7:1 on `--ink-2`. The
rule is one `prefers-contrast: more` block in `web/src/ui/tokens.css`, redefined for each appearance
(see `appearance.md`).

- Why: the default text palette already meets AA and the default hairline borders are decorative
  (APR-3), but a person who asked for more contrast gets the system's signal ignored. Apple's Color
  guidance asks for an increased-contrast option.
- Guard: `src/a11yStyle.test.ts` · `src/appearance/appearanceContrast.test.ts`

### ACC-3 · No text is set below 10 px
The smallest text token is `--fs-3xs` (10 px, the macOS minimum). `--fs-4xs` (9 px) is retired: its
uses move to `--fs-3xs`. No stylesheet sets a literal `font-size` below 10 px, and the token file
defines none below 10 px.

- Why: Apple's Accessibility guidance sets the minimum at 10 pt on macOS and 11 pt on iOS; 9 px is below
  both. The review counted 26 uses of the 9 px token, and two decorative `8px` literals in the lobby and
  login stylesheets.
- Guard: `src/a11yStyle.test.ts` · `e2e/game-chrome-phone.spec.ts`

### ACC-4 · No new 10 px text outside the battlefield
Text that is not on the battlefield (`web/src/board/`, `web/src/game/`) is 11 px (`--fs-2xs`) or larger.
The existing uses of `--fs-3xs` outside those folders are listed in a baseline (`src/a11yStyle.test.ts`)
and may only shrink: a component moved to 11 px when it is next touched leaves the baseline, and no new
one is added.

- Why: the iOS minimum is 11 pt, and the 10 px attribution and labels were the text people could not read
  on the phone login. A ratchet lets the sweep happen one component at a time without a risky
  layout change across the lobby in one commit.
- Guard: `src/a11yStyle.test.ts`

### ACC-5 · Icon buttons keep a 28 px hit area on touch screens
On a coarse pointer (`(pointer: coarse)`), every `.ui-icon-btn` has a hit area of at least 28 × 28 CSS
px, while its visual size may stay smaller. The extra area comes from padding or a pseudo-element so the
layout does not move. A primary icon button (`variant="primary"`) reaches 44 × 44 px.

- Why: Apple's Accessibility guidance sets the default control size at 44 pt and the minimum at 28 pt on
  iOS. The review found 12 uses of the `xs` and `sm` sizes (20 and 24 px) on screens that also run on
  phones.
- Guard: `src/a11yStyle.test.ts` · `e2e/game-chrome-phone.spec.ts`

### ACC-6 · Fixed chrome on a screen edge clears the safe area
A `position: fixed` element pinned to a screen edge (the app attribution footer, toasts, the chat button)
adds `env(safe-area-inset-<edge>, 0px)` to its offset from that edge. On a device that reports no inset
the offset is unchanged.

- Why: Apple's Layout guidance makes the safe area essential, so system UI and hardware never cover
  controls. The attribution footer is fixed at `bottom: 4px` with no inset (`styles.css`).
- Guard: `src/a11yStyle.test.ts`

### ACC-7 · The login screen at phone width shows one attribution, no overlap, no truncated labels
At 390 px wide the login screen shows its attribution once. The footer does not overlap any login control.
A label such as the network label wraps to a second line instead of ending in an ellipsis. The check is
made on element boxes and computed text overflow, never on pixels.

- Why: the review screenshot at 390 px showed the fixed Scryfall pill (`.app-attribution`) over the
  login's own footer, the attribution rendered twice (`App.tsx` and `LoginScreen.tsx`), and the label
  "CONFIGURACIÓN DE RED (AVA…" truncated. Apple's Typography guidance: keep truncation to a minimum.
- Guard: `e2e/login-narrow.spec.ts`

### ACC-8 · The app declares its home-screen icon and theme colors
`web/index.html` declares an `apple-touch-icon` (a 180 × 180 px PNG made from the logo), a `theme-color`
for each appearance (`media="(prefers-color-scheme: light)"` and `dark`), and a web app manifest
(`web/public/manifest.webmanifest`) with the app name and the icons. These are present in the built
`dist/` output.

- Why: when someone adds the app to the home screen the system falls back to a screenshot without them;
  the theme color keeps the browser chrome in step with the appearance (APR-1).
- Guard: `src/a11yStyle.test.ts`

### ACC-9 · Information shown on hover is also reachable without a pointer
Information that appears only on hover (the card previews in the deck builder, the hand, the piles, the
hand viewer and the stack) is also reachable without a pointer. Where the element is already focusable,
keyboard focus shows the preview and blur hides it. Every deck-builder preview is reachable by a tap on a
touch screen: a touch press opens the preview itself through its pointer event, and does not wait for the
browser's emulated mouse events, whose order relative to the click is not fixed. A preview opened by a touch
stays until the next touch press: the emulated mouse-leave that follows the tap does not close it, and a real
mouse movement releases it again. Battlefield
permanents are reached by tap; they are not made keyboard-focusable here, because that would add a tab
stop to every permanent and is a change to the board's focus model, not to its previews (known gap,
see the Why).

- Why: a hover needs a pointer, and a phone user never produces one. Apple's Accessibility guidance asks
  for alternatives to gestures and to pointer-only actions. Non-clickable stack entries and pile cards are
  not focusable today; giving them a tab stop is a separate decision for the board's keyboard model.
  The first version relied on the emulated mouse events alone; in CI one tap changed the count but never
  opened the preview (the review of 2026-10-26). A press through the pointer event opened it, but the
  emulated mouse-leave that followed the tap closed it again on the CI runner, so a touch-opened preview is
  now pinned until the next touch press.
- Guard: `e2e/touch-equivalents.spec.ts` · `src/decks/ArenaCardStrip.test.tsx`

### ACC-10 · Blur never sits on battlefield content
The battlefield's own layers (zones, cards, the stack, piles and the turn ring) use no `backdrop-filter`.
Blur is used only on floating controls and modal scrims, which are chrome, not content. The guard test
lists the stylesheets allowed to keep one; a new one must be added to that list on purpose.

- Why: Apple's Materials guidance keeps the blur on the functional layer above the content so the
  content stays legible. `board/BoardZone.css` blurs a zone overlay (line 573) over the board.
- Guard: `src/board/boardBlur.test.ts`
