# Animation backlog

Animations the board does not have yet, ranked by impact and by whether the data already reaches the
client. Every animation that ships gets a `#/gallery` entry (group `Animaciones`) with a **Replay**
action, so it can be watched without a live game.

Already shipped (for reference, see the `anim:*` gallery entries): draw slide, land slide, mana tap,
untap wave, token pop, projectiles, spell cast lift, stack sequence and countdown, damage and life
numbers, counters, loyalty, equip move, mill, legendary/mythic enter, coin flip, priority orb, spell
weight slam, sequential combat strikes, destroy/exile/token deaths, low-life vignette, cinematic end
screen.

## High priority (data already in the `GameView` diff)

| # | Animation | Trigger in the diff | State |
|---|---|---|---|
| 1 | **Countered spell**: the spell cracks and shatters on the stack instead of quietly leaving | A spell leaves the stack for a graveyard/exile in the same update as another departed stack object that targeted it | Done 2026-10-20 (`anim:countered`) |
| 2 | **Transform / double-faced flip**: a 3D flip of the card when it changes face | `transformed` toggles on a permanent that stays on the battlefield | Done 2026-10-20 (`anim:transform`) |
| 3 | **Bounce to hand**: blue swirl, then the card flies to its owner's hand (opponents included) | A permanent leaves the battlefield and lands in my hand, or the opponent's `handCount` grows | Done 2026-10-20 (`anim:bounce`, `anim:opp-bounce`) |
| 4 | **Life gain**: green-gold motes rise over the portrait, symmetric to damage | A player's `life` goes up | Done 2026-10-20 (`anim:life-gain`) |
| 5 | **Library shuffle**: the classic table riffles its library pile in place; the new table (and pod/arena chips) pops a mini deck in the player's sleeve out past the portrait, riffles it and drops it back into the chip | No `GameView` change: the game-log line `<name>'s library is shuffled` / `<name> shuffles N cards into their library` (`board/shuffleFx.ts` `sniffShuffle`) | Done 2026-10-20 (`anim:shuffle`, `anim:shuffle-opp`, `anim:shuffle-classic`) |

## Medium priority

| # | Animation | Notes |
|---|---|---|
| 6 | **Flicker** (exile and return): one in/out flash instead of a death plus an enter | A permanent leaves and a new id with the same card enters in the same update |
| 7 | **Monarch / Initiative passing**: the crown or token flies from one portrait to another | The `monarch`/`initiative` flags move between players |
| 8 | **Player eliminated** in multiplayer: the seat dims or cracks | `DefeatedSeat` exists but has no keyframes |
| 9 | **Dice roll**: like the coin flip, reusing `coinFlipFx` | Check whether the roll reaches the client as data or only in the log |
| 10 | **Phasing**: a translucency transition when phasing in or out | The phased state exists but switches instantly |
| 11 | **Mulligan**: the hand goes back to the library and a new one is dealt | Today the hand is replaced in place |
| 12 | **Day / night**: a sky transition in the top bar when it switches | `dayNight` is shown but changes without motion |

## Polish

| # | Animation | Notes |
|---|---|---|
| 13 | Distinct **sacrifice** death (different colour or particle shape than destroy) | Needs a cause: the log, since the diff looks like a destroy |
| 14 | **Spell copies** (storm, copy effects): the card clones itself on the stack with an echo | A new stack object with the same card as an existing one |
| 15 | **Planeswalker ultimate**: a special slam when loyalty drops by a large amount at once | Builds on the loyalty pulse |
| 16 | **Revealed / looked-at cards** (scry, surveil, reveal): the cards flip in when the viewer opens | `revealed` / `lookedAt` groups |
