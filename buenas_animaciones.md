# Animation backlog

Animations the board did not have, ranked by impact and by whether the data already reaches the
client. Every animation that ships gets a `#/gallery` entry (group `Animaciones`) with a **Replay**
action, so it can be watched without a live game.

Already shipped before this list (see the `anim:*` gallery entries): draw slide, land slide, mana
tap, untap wave, token pop, projectiles, spell cast lift, stack sequence and countdown, damage and
life numbers, counters, loyalty, equip move, mill, legendary/mythic enter, coin flip, priority orb,
spell weight slam, sequential combat strikes, destroy/exile/token deaths, low-life vignette,
cinematic end screen.

Every item below is done. Three of them have no trace in the `GameView` and are read from the game
log (`board/gameLogFx.ts`, `board/diceRollFx.ts`): a flicker keeps the permanent's id, a sacrifice
looks like a destroy, and a die roll is never in the view.

## High priority (data already in the `GameView` diff)

| # | Animation | Trigger | State |
|---|---|---|---|
| 1 | **Countered spell**: the spell cracks and shatters on the stack instead of quietly leaving | A spell leaves the stack for a graveyard/exile in the same update as another departed stack object that targeted it | Done 2026-10-20 (`anim:countered`) |
| 2 | **Transform / double-faced flip**: a 3D flip of the card when it changes face | `transformed` toggles on a permanent that stays on the battlefield | Done 2026-10-20 (`anim:transform`) |
| 3 | **Bounce to hand**: blue swirl, then the card flies to its owner's hand (opponents included) | A permanent leaves the battlefield and lands in my hand, or the opponent's `handCount` grows | Done 2026-10-20 (`anim:bounce`, `anim:opp-bounce`) |
| 4 | **Life gain**: green-gold motes rise over the portrait, symmetric to damage | A player's `life` goes up | Done 2026-10-20 (`anim:life-gain`) |
| 5 | **Library shuffle**: the classic table riffles its library pile in place; the new table (and pod/arena chips) pops a mini deck in the player's sleeve out past the portrait, riffles it and drops it back into the chip | No `GameView` change: the game-log line `<name>'s library is shuffled` / `<name> shuffles N cards into their library` (`board/shuffleFx.ts` `sniffShuffle`) | Done 2026-10-20 (`anim:shuffle`, `anim:shuffle-opp`, `anim:shuffle-classic`) |

## Medium priority

| # | Animation | Trigger | State |
|---|---|---|---|
| 6 | **Flicker** (exile and return): the card collapses to a sliver of light and snaps back, instead of nothing | The permanent keeps its id, so the view shows no change: the log line `<player> puts <permanent> from exile onto the Battlefield` for a permanent that was on the battlefield (`gameLogFx.ts` `parseFlicker`). A card returning after a later update now flies in from the exile pile, not from the hand | Done 2026-10-20 (`anim:flicker`) |
| 7 | **Monarch / Initiative passing**: a gold crown (or ember initiative) token flies on an arc from the old holder's portrait to the new one, and the badge pops | `monarch` / `initiative` moves between players (`designationFx.ts` `passedDesignations`); taken from nobody, it drops from above | Done 2026-10-20 (`anim:monarch-pass`, `anim:initiative-take`) |
| 8 | **Player eliminated**: the seat jolts, cracks in red and white, sheds shards and drains to grey while the defeated overlay fades in | `hasLeft` turns true | Done 2026-10-20 (`anim:player-eliminated`) |
| 9 | **Dice roll**: dice in the roller's seat colour tumble in, bounce and show the result (hexagon for dN, square for d6, symbol for the planar die); new `dice_roll` sound | Log only: `[Roll a die] <name> rolled a d20, result: 17`, `… rolled 2d6, results: [4, 6]`, `[Roll a planar die] <name> rolled Chaos Roll` | Done 2026-10-20 (`anim:dice-roll`, `anim:dice-roll-multi`, `anim:dice-planar`) |
| 10 | **Phasing**: a phased-out permanent leaves a ghost that jitters and fades through blue scan lines; phasing in fades it back up | `phasedIn` toggles (phased-out permanents are not drawn) | Done 2026-10-20 (`anim:phase-out`, `anim:phase-in`) |
| 11 | **Mulligan**: my hand turns face down and flies back to the library, then the new hand is dealt card by card; an opponent's mulligan sends four face-down cards to their library and back | Mine: hand ids change in a view with no phase. Opponent: the log line `<name> decides to take mulligan` (their hand count does not change) | Done 2026-10-20 (`anim:mulligan`, `anim:mulligan-opp`) |
| 12 | **Day / night**: a dawn or dusk sky washes across the top bar and the sun or moon rises into its chip; on the classic table the info-bar badge spins in | The day/night hint changes | Done 2026-10-20 (`anim:day-night`, `anim:day-night-classic`) |

## Polish

| # | Animation | Trigger | State |
|---|---|---|---|
| 13 | Distinct **sacrifice** death: a blood-red sigil closes in, the card drains from the top and drops fall as it darkens on its way to the graveyard (a sacrificed token gets the sigil instead of the puff) | The log line `<player> sacrificed <permanent>`, noted for a few seconds and consumed by the death | Done 2026-10-20 (`anim:sacrifice`) |
| 14 | **Spell copies**: blue echoes ripple out of the original and the copy peels off it, pale, onto the stack | A new stack spell with the name of one already there, while no card of that name left its controller's hand | Done 2026-10-20 (`anim:spell-copy`) |
| 15 | **Planeswalker ultimate**: purple rays and a shockwave from the planeswalker, sparks across the board, a board shake and the epic impact | Loyalty drops by 6 or more at once, or the planeswalker dies paying for a new ability of its own | Done 2026-10-20 (`anim:pw-ultimate`) |
| 16 | **Revealed / looked-at cards**: the cards flip face up one after another as the viewer opens | The `revealed` / `lookedAt` viewer opens (not companions) | Done 2026-10-20 (`anim:revealed-flip`) |
