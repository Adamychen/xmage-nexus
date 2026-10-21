# Board animations

Catalogue of every animation the game board plays, and the backlog of the ones it could still
play. Every animation that ships gets a `#/gallery` entry (group `Animaciones`) with a **Replay**
action, so it can be watched without a live game, and its id goes in the `withAction` list of
`web/src/dev/galleryFixtures.test.ts`.

## How it works

- **Diff engine**: `web/src/board/gameTransitionEngine.ts` `detectAndAnimateTransitions(prev, next)`
  compares two consecutive `GameView`s and starts every flight, impact and number. Cards fly through
  `FlyingCardOverlay` (`flightManager.ts`), using `cardPositionRegistry.ts` to know where a card that
  just unmounted was drawn.
- **Overlays and stores**: `impactFx.ts` → `ImpactOverlay` (rings, sparks, shards, sigils…),
  `projectileFx.ts` → `ProjectileOverlay`, `feedbackFx.ts` → `FeedbackOverlay` (floating numbers,
  turn banner), `coinFlipFx.ts`, `diceRollFx.ts`, `shuffleFx.ts`, `designationFx.ts`, each with its
  own overlay component.
- **Game log**: what never reaches the `GameView` is read from the log lines (`gameLogFx.ts`
  `sniffGameLogFx`, `diceRollFx.ts` `sniffDiceRoll`, `shuffleFx.ts` `sniffShuffle`): a flicker keeps
  the permanent's id, a sacrifice looks like a destroy, a die roll and a shuffle never appear in the
  view, and an opponent's mulligan leaves their hand count unchanged.
- **Sequencing**: spells that leave the stack in one update resolve one by one (`stackHold.ts`);
  their targets' hits wait for the projectile to land, and combat damage plays as sequential strikes
  (`combatStrikes.ts`, `damageHold.ts`) before deaths fly to the graveyard.
- **Preferences**: `fx.ts` (effects on/off, speed 0.5×/1×/1.5×, `prefers-reduced-motion`). Motion
  is dropped under reduced motion, opacity fades are capped at 150 ms.
- **Slot flights**: a slot that mounts where a card lands flies the card in itself (`CardSlot` path A,
  from `cardPositionRegistry.ts`) and hides at once (`flight-hidden`, no opacity transition) until its
  clone lands. Moves the registry cannot see are primed while the update renders, before the screen
  changes (`controlFx.ts`, `commandFx.ts`).
- **Stack ids**: the server keys a spell on the stack by its spell ability id, not its card id, and the
  stack `CardView` carries no `sourceCard` or `parentId` (verified on recorded local-server frames,
  2026-10-20: Elvish Mystic is `a4a1784a…` in the hand and on the battlefield but `23dc62a1…` on the
  stack; Lightning Bolt is `c927fa19…` in the hand and the graveyard, `ccd21b07…` on the stack). So
  `stackLinks.ts` links every spell to its card by name or printing: `stackDepartures` (the permanent a
  spell resolved into, the graveyard/exile card it fell into), `castCard` (the hand/graveyard/exile
  card it was cast from), and `primeStackEntries` records the spell's stack position under the
  permanent's id while the update renders, so the permanent's slot flies in from the stack. Ids still
  win when they match (the FakeServer and older fixtures reuse the card id on the stack).
- **Sound**: `audio/gameSoundDispatcher.ts` (view diff) plus direct `soundManager.play` calls from
  the fx modules; keys in `audio/types.ts`, synthesized in `audio/soundSynthesizer.ts`.

## Shipped animations

### Cards moving between zones

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Draw**: the card slides from the library to the hand (up to 3, 70 ms stagger); an opponent's draw flies face down | New id in `myHand`; opponent `handCount` grows (minus bounces and returns) | engine §A, `useDrawSlide.ts` | `anim:draw-slide` |
| **Return to hand** (Regrowth, Eternal Witness): the card flies out of the graveyard or exile pile into the hand, not from the library; an opponent's flies face up from their pile to their hand (badge on the new table) | New `myHand` id that was in my `graveyard` / `exile`; an opponent pile card that went nowhere visible while their `handCount` grew (net of bounces) | engine §A `myHandReturns` / `opponentHandReturns`; the hand's draw slide leaves the same pile (`drawSlide.ts` `primeHandReturns`) | `anim:regrowth`, `anim:opp-regrowth` |
| **Land play**: lifts to the centre, holds and drops onto the battlefield | A land enters without having been on the stack | engine §B (`land` flight) | `anim:land-slide` |
| **Spell cast**: lifts to the centre, holds, then flies to the stack with a gold trail (mine and the opponent's) | New stack object | engine §1, `CAST_FLIGHT_MS` | `anim:spell-cast-own`, `anim:spell-cast-opp`, `anim:stack-trail` |
| **Cast from graveyard / exile** (flashback, escape, foretell, adventure, plot): the spell lifts out of that pile instead of the hand | New stack object whose id (or `sourceCard` id) was in its controller's `graveyard` / `exile` | engine §1 `castFromPile` | `anim:flashback`, `anim:cast-from-exile` |
| **Commander cast**: a column of gold light and a crown rise from the command zone and the commander lifts out of it, not out of the hand | A new stack spell while a commander left its controller's command zone (same id, or the same name: a spell has an id of its own) | engine §1 `castFromCommand` (`commandFx.ts`), impact `command` | `anim:commander-cast` |
| **Commander to the command zone**: a column of gold light and a crown lift off where it was, it flies in a gold-and-violet glow into its command-zone slot (classic and new table, pod seats) and a gold ring spreads as it lands | A commander (`commandZoneCommanders`) is in `commandList` and was not, coming from a battlefield, its owner's graveyard or exile, or my hand (the server's "move to the command zone?" answer moves it out of the graveyard) | `commandFx.ts` `commanderReturns` / `primeCommandReturns` (the command-zone slot flies itself from where the commander was, `CardSlot` path A), engine §O `sendToCommand`, flight variant `command`, impacts `command` / `enter-ring` | `anim:commander-to-command`, `anim:commander-to-command-v2`, `anim:commander-grave-to-command`, `anim:commander-to-command-pod` |
| **Put on the library** (tuck, Chaos Warp, Brainstorm): a permanent sinks into a cool vortex and flies to its library; my hand cards fly there one after another; each turns face down halfway. An opponent's hand cards fly face down from their hand | The player's `libraryCount` grows while their permanents or my hand cards went to no visible zone (at most as many as it grew); an opponent's `handCount` shrinks with nothing of theirs reaching a graveyard, exile, the stack or a battlefield. Never in a view with no phase (mulligan) | engine §P `libraryTucks`, `tuckToLibrary`, flight option `conceal` (`flightConcealFace` / `flightConcealBack`), flight variant `tuck`, impact `tuck` | `anim:tuck`, `anim:tuck-classic`, `anim:hand-to-library`, `anim:opp-hand-to-library` |
| **Ability on the stack**: its source permanent pulses | New stack ability with a `sourceCard` | engine `pulseStackSource` | `anim:ability-source` |
| **Permanent enters**: lift, hold and drop from the stack | Stack spell resolves onto the battlefield (its permanent has the card's id, not the stack id: linked by `stackLinks.ts`) | engine §B (`enter` flight), `stackLinks.ts` `primeStackEntries` | `anim:creature-enter`, `anim:opp-creature-enter` |
| **Legendary / mythic enter**: gold foil sheen; mythic adds ember border, gold ring and heavy impact | Entering card's supertype / rarity | `FlyingCardOverlay.css` `flightFoilSheen`, impact `enter-ring` | `anim:legend-enter`, `anim:mythic-enter` |
| **Spell weight slam**: board dim, flash, ring and quake when a heavy spell resolves | `spellWeight()` > 0 (mana value / rarity) | `impactFx.ts` `slamSpell` | `anim:spell-slam` |
| **Token pop**: spring scale plus a burst of six dots; a vanishing token fades (`token-fade`) | Token enters / leaves to nowhere | engine §B/§C, `useTokenPop.ts`, `tokenBurst.ts` | `anim:token-pop`, `anim:token-fade` |
| **Reanimate / from exile**: an entering permanent flies from the graveyard or exile pile (stack or chip) | Id was in the player's graveyard / exile | engine §B | `anim:reanimate` |
| **Destroy**: ember burn and scorch on the way to the graveyard | Permanent leaves the battlefield into a graveyard | engine §C (`destroy` flight + impact) | `anim:destroy` |
| **Graveyard dissolve**: a ghost copy fades where the card stood | Same, on the slot itself | `useBattlefieldDissolve.ts` | `anim:dissolve` |
| **Board wipe** (Wrath of God, Damnation): the board darkens and shakes while one wave of white-gold light sweeps it left to right; each permanent (and its dissolve ghost) dies as the wave reaches it, so the Wrath reads as one event. The wash follows the board while it plays (the stack panel closes and the board widens under it) | ≥ 4 non-token permanents, across all players, leave a battlefield for a graveyard or exile in one view (tokens ride along; combatants never count) | `boardWipe.ts` `boardWipeIds` / `primeBoardWipe` / `boardWipeDelay`, `impactFx.ts` `slamBoardWipe` (impact `wipe`), engine `deathDelay` | `anim:board-wipe`, `anim:board-wipe-pod` |
| **Exile**: white flash and a flight to the exile pile (classic stack or new-table chip) | Permanent leaves the battlefield into exile | engine §C (`exile` flight + impact) | `anim:exile`, `anim:exile-v2` |
| **Exile from hand, graveyard or library** (delve, escape, cascade, impulse draw, Rest in Peace): white flash at the origin, then a pale flight to the exile pile (up to 3, 70 ms stagger); a card leaving the library or an opponent's hand starts face down and turns face up halfway | New id in a player's `exile` that was neither on a battlefield nor on the stack | engine §K `exileArrivals`, flight option `reveal` (`FlyingCardOverlay.css` `flightRevealBack` / `flightRevealFace`) | `anim:exile-from-hand`, `anim:exile-from-graveyard`, `anim:exile-from-library` |
| **Bounce**: blue swirl, then the card flies to its owner's hand (opponents included) | Permanent leaves into `myHand`, or the opponent's `handCount` grows by it | engine §C, `opponentBounceIds` | `anim:bounce`, `anim:opp-bounce` |
| **Sacrifice**: blood-red sigil, the card drains from the top, drops fall (a token gets the sigil instead of the puff) | Log `<player> sacrificed <permanent>`, consumed by the death | `gameLogFx.ts` `parseSacrifice`, impact `sacrifice` | `anim:sacrifice` |
| **Flicker**: collapses to a sliver of light and snaps back | Log `<player> puts <permanent> from exile onto the Battlefield` for a permanent still there | `gameLogFx.ts` `parseFlicker` | `anim:flicker` |
| **Discard**: flight from the hand to the graveyard | New graveyard id that was in the hand | engine §G | `anim:discard` |
| **Mill**: flight from the library to the graveyard | New graveyard id not from hand, battlefield or stack | engine §G | `anim:mill` |
| **Equipment re-attach**: the equipment flies with a gold trail to its new host | `attachedTo` changes host | engine `flyReattached` | `anim:equip-move` |
| **Aura attach** (an Aura resolving, a bestow): after its drop lands in its slot under the host, a thread of light in the aura's colour binds them, a ring closes round the host and both glow | A new permanent with `attachedTo` set to a permanent still on a battlefield | engine §B `auraAttachments`, `linkAura`, impact `attach`, `CardSlot.css` `attachGlow` | `anim:aura-attach`, `anim:aura-attach-classic` |
| **Mulligan**: my hand turns face down and flies to the library, then the new hand is dealt; an opponent's sends four face-down cards back and forth | Mine: hand ids change in a view with no phase. Opponent: log `<name> decides to take mulligan` | engine `playMulligan`, `gameLogFx.ts` `animateOpponentMulligan` | `anim:mulligan`, `anim:mulligan-opp` |
| **Library shuffle**: the classic pile riffles in place; the new table pops a mini deck out of the library chip | Log `<name>'s library is shuffled` / `… shuffles N cards into their library` | `shuffleFx.ts` | `anim:shuffle`, `anim:shuffle-opp`, `anim:shuffle-classic` |
| **Scry / surveil**: the top cards lift in the player's sleeve from the library (pile or chip), fan out, hold and settle back; cards surveilled into the graveyard then fly there through the ordinary zone diff | Log `<name> scries N` / `<name> surveils N` (`PlayerImpl.scry` / `doSurveil`) | `gameLogFx.ts` `parseLibraryPeek`, `libraryPeekFx.ts`, `LibraryPeekOverlay` | `anim:scry`, `anim:surveil-opp` |
| **Revealed / looked-at**: cards flip face up one after another as the viewer opens | `revealed` / `lookedAt` group opens (not companions) | `revealedCards.ts`, `PileOverlay` | `anim:revealed-flip` |
| **Hand revealed** (a watched hand, Mindslaver, Telepathy): the opponent's revealed cards leave their hand face down, fan out beside it and turn face up one after another (90 ms stagger), hold, then fold back into the hand (classic hand zone, or the portrait's hand badge on the new table) | An opponent's `watchedHands` / `opponentHands` entry, or a `revealed` group named "Cards in <name>'s hand", has cards it did not have (appears or grows). Thoughtseize-style reveals keep the revealed viewer | `handRevealFx.ts` `handReveals` / `spawnHandReveal`, `HandRevealOverlay`, engine §T `fanRevealedHands` | `anim:hand-revealed`, `anim:hand-revealed-v2` |

### Stack

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Mana spent**: one orb per mana (up to 8, 70 ms stagger) leaves the player's mana pool display in its colour and flies to the new stack object. A pool that empties with nothing new on the stack (end of step) plays nothing, and the pool only changes in a view that also adds to the stack, so mana paid by auto-pay without a visible pool plays nothing | A player's `manaPool` drops in the view that adds a spell or ability to the stack | `manaSpentFx.ts` `manaSpends` / `flySpentMana`, `manaParticle.ts` `flyManaOrb`, engine §U | `anim:mana-spent` |
| **Projectile**: an orb in the spell's colours flies from the stack to each target (260–480 ms by distance); the hit waits for it | A targeted spell leaves the stack | `projectileFx.ts`, engine §C | `anim:projectile`, `anim:spell-hit-creature`, `anim:spell-hit-player` |
| **Sequential resolution**: several spells leaving in one update resolve one at a time, 220 ms apart | Several stack objects gone at once | `stackHold.ts` | `anim:stack-sequence` |
| **Top-card countdown**: the top spell pulses and a 2 px bar fills over 3 s | Two or more objects on the stack | `StackZone.css` `stackTopPulse` / `stackTopFill` | `anim:stack-countdown` |
| **Countered**: the spell shudders, drains of colour, cracks and bursts into blue shards | Leaves for a graveyard/exile with another departed object that targeted it | engine `counteredSpellIds`, impact `countered` | `anim:countered` |
| **Fizzle**: a spell whose targets all became illegal fires no projectile; it goes grey and drifts apart like smoke on the stack, then falls to the graveyard | Log `<card name> has been fizzled.` (`Spell.java`; no object id, matched by name against the stack) before the view that removes it | `fizzleFx.ts`, engine §C `consumeFizzled`, `CardSlot.css` `fizzleSmoke` | `anim:fizzle` |
| **Copy**: blue echoes ripple from the original and the pale copy peels off it | New stack spell named like one already there, no card left a hand | engine `copiedSpellId`, impact `copy` | `anim:spell-copy` |
| **Mutate**: the mutating spell flies from the stack down onto its host instead of the generic exit; organic ripples in its colours wobble out and the host squashes and swells as they merge (over or under) | A spell leaves the stack without entering on its own while a host that stayed is `mutated` and its `mutateView.cards` gained that card (same id, or the same name) | engine `mutateMerges`, `mergeIntoHost`, flight variant `mutate`, impact `mutate`, `CardSlot.css` `mutateMerge` | `anim:mutate`, `anim:mutate-under` |

### Permanents changing in place

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Mana tap**: ring in the land's colour and a particle to the mana pool | A land taps | `CardSlot.css` `manaTapPulse`, `manaParticle.ts`, `useTapFlip.ts` | `anim:mana-tap` |
| **Card icon gained** (goad, restrictions, keywords): the badge pops onto the card; goad lands with a red ring and glow. Only on gain between views, never on a card's first render | A permanent's `cardIcons` has an icon (type, text, hint) it did not have; goad is the `OTHER_HAS_RESTRICTIONS` icon whose hint says "Goaded by …" | `cardIconFx.ts` `gainedIconKeys` / `isGoadIcon`, `CardIcons.tsx`, `CardSlot.css` `iconGainedPop` / `goadPulse` | `anim:goad`, `anim:card-icon-gain` |
| **Behold**: the shown card lifts and catches a white flash | Log `<player> chooses to behold <permanent>` (the single-permanent form, the only one with an object id) | `beholdFx.ts`, `CardSlot.css` `beholdLift` | `anim:behold` |
| **Designation gained** (monstrous, renowned, suspected, class level up, case solved, harnessed, evidence, prepared, protector, paired): the badge pops in and glows in its own colour; suspected also jolts; a card that becomes monstrous or renowned swells once in gold. Never on a card's first render | `cardDesignations(rules)` gains a designation between views, or the class level rises (the hints live in `rules`: `ICON_GOOD{this} is monstrous`, …) | `designations.ts` `gainedDesignations`, `CardSlot.tsx`, `CardSlot.css` `designationGlow` / `designationJolt` / `designationSwell` | `anim:designation-monstrous`, `anim:designation-renowned`, `anim:designation-suspected`, `anim:designation-classlevel`, `anim:designation-casesolved` |
| **Untap wave**: my tapped permanents untap with a 40 ms stagger | Several untap at once | `useUntapWave.ts` | `anim:untap-wave` |
| **Summoning sickness / entered glow**: floating badge and gold glow (looping) | `summoningSickness` / entered this turn | `CardSlot.css` `sicknessFloat`, `enteredGlow` | `anim:sickness`, `anim:entered-glow` |
| **Keyword aura** (looping status effect): a battlefield permanent shows one aura for its main keyword, in priority order indestructible (metal ring, static armour brackets in the corners and a sheen sweeping the card; grey alone vanished into the card's own grey border), hexproof (dashed green ward line, breathing), deathtouch (two purple wisps rising), flying (wind streaks), lifelink (gold ring and a heartbeat glow), trample (green stomp at the base), haste (ember flames); every aura has a 2px ring in its colour so it reads over card art. One aura per card so a full board stays readable; only transform / opacity animate. Setting *Keyword effects* off / subtle (default) / vivid; reduced motion and effects off keep the static ring | Its keyword badges (`cardIcons` + keyword lines in `rules`) contain an aura keyword; battlefield hosts only (`BoardZone` passes `keywordAura`), never face down | `keywordAura.ts` `dominantAuraKeyword`, `KeywordAura.css` `kwAura<Keyword>`, `CardSlot.tsx`, setting `keywordAura` (`cardOverlays.ts`); guard `KeywordAura.css.test.ts` | `anim:keyword-auras` |
| **Keyword gained** (an Aura grants flying, a pump grants trample): the new coin pops in with a ring in its colour; if it is the aura keyword the aura flares once. Never on a card's first render | A card's keyword badge ids gain an id between renders | `keywordAura.ts` `gainedKeywordIds`, `CardSlot.tsx`, `KeywordCoin.css` `kwCoinGained`, `KeywordAura.css` `kwAuraFlare` | `anim:keyword-gain` |
| **Counters**: badge pulse with gold flash and ring, `+1` rises, the number ticks | A permanent's `counters` change | `useCounterPulse.ts` | `anim:counter-change` |
| **P/T change**: the P/T box pops and flashes green (pump), red (shrink) or gold (mixed) and a boxed `+3/+3` / `-2/-2` / `+2/-1` floats up from it | A creature that stays has another `power` / `toughness`, net of its P/T counters' change in the same view (not on entering, transform, turning face up or a name change) | engine §L `ptChanges`, `CardSlot.css` `ptPop` / `ptFlash`, boxed `spawnFloater` | `anim:pt-pump`, `anim:pt-shrink`, `anim:pt-mixed` |
| **Loyalty**: purple pulse, the cost falls, the number ticks | `loyalty` changes | `useCounterPulse.ts` | `anim:loyalty-change` |
| **Planeswalker ultimate**: purple rays, shockwave, sparks, board shake, epic impact | Loyalty drops by ≥ 6, or it dies paying for its own ability | engine `ultimatePlaneswalkerIds`, `slamUltimate` | `anim:pw-ultimate` |
| **Transform**: edge-on 3D flip to the other face, flash, light sweep and ring | `transformed` toggles | engine `flipTransformed`, impact `transform` | `anim:transform` |
| **Turn face up** (morph, manifest, disguise, cloak): a dark shroud closes over the card as it turns edge-on in the dark, then its face comes round lit, with a burst, ring and motes in its own colours | `faceDown` turns false on a permanent that stays (the kind read from `morphed` / `manifested` / `disguised` / `cloaked`) | engine §E2 `turnedFaceUp`, `revealFaceUp`, `CardSlot.css` `faceUpReveal`, impact `face-up` | `anim:morph-face-up`, `anim:manifest-face-up` |
| **Gain control** (Threaten, Control Magic, the effect ending): a tether in the new controller's seat colour seizes the permanent, a ring marks its new slot and the tether reels it across, glowing that colour, instead of the ordinary enter; control returning plays the same in the owner's colour | The same id leaves one player's battlefield and is on another's | `controlFx.ts` `controlChanges` / `primeControlChanges` (the slot flies itself as `control`), engine §N `pullControlled`, impact `control`, flight variant `control` | `anim:gain-control`, `anim:control-return`, `anim:gain-control-pod` |
| **Becomes a creature** (an animated land, a crewed vehicle, Gideon): a column of light in its colour (the mana a land makes) lifts it where it stood, it flies up into the creature band glowing that colour and lands lit; when the effect ends it flies back down, quicker, and dims for a moment. A creature that is also a land sits with the creatures, as on the desktop client | `cardTypes` gains or loses `CREATURE` on a permanent that stays (not on a transform or turning face up) | `creatureShiftFx.ts` `creatureShifts` / `primeCreatureShifts` (the slot remounting in the other band flies itself, `CardSlot` path A, flight variant `animate`), engine §Q `shiftCreature`, impact `animate`, `CardSlot.css` `animateRise` / `animateSettle`, `bandWeights.ts` `permanentKind` | `anim:land-animate`, `anim:land-animate-v2`, `anim:land-unanimate`, `anim:vehicle-crew` |
| **Flip card** (Kamigawa): the card lifts, turns a half circle on its face with a white flash and an arc of light, and settles the other way up | `flipped` toggles on a permanent that stays | engine §R `flippedChanges` / `turnFlipCard`, `CardSlot.css` `flipCardTurn` / `flipCardLift`, impact `flip` | `anim:flip-card` |
| **Phasing**: a ghost jitters and fades through blue scan lines; phasing in fades it back up | `phasedIn` toggles | engine `phaseOut` / `phaseIn`, impact `phase` | `anim:phase-out`, `anim:phase-in` |
| **Creature damage**: shake, sparks and a floating `-N` | `damage` grows | engine §D, `DamageNumber.tsx` | `anim:creature-damage`, `anim:target-damage` |
| **Indestructible holds**: a shield closes over the permanent, cracks and reforms with a flash | An indestructible permanent's `damage` grows to its toughness or more and it stays | engine §D, `keywordStrikeFx.ts` `survivesLethal`, impact `indestructible` | `anim:kw-indestructible` |

### Combat

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Attack lunge**: an attacker springs towards the opponent | Creature becomes an attacker | `CardSlot.css` `attackLungeUp` / `attackLungeDown` | `anim:attack-lunge` |
| **Blocker lunge**: a declared blocker steps towards its attacker (up from the bottom zone, down from the top zone, pods included), shorter than the attack lunge, with a cyan flash; a creature only selected as a blocker (`.chosen`) stays put | Creature in a `combat` group's `blockers` (the `blocking` class) | `CardSlot.css` `blockLungeUp` / `blockLungeDown` | `anim:block-lunge`, `anim:block-lunge-opp` |
| **Combat arrows**: flowing attack, block and target arrows | `combat` groups, targeting | `CombatArrowsOverlay.tsx` | (`prompt:combat-attack`, `prompt:combat-block`) |
| **Sequential strikes**: each attacker strikes its blocker or player in turn, first strike before regular damage; deaths wait for the last strike | Combat damage step crossed | `combatStrikes.ts`, `useCombatHeld.ts` | `anim:combat-strikes` |
| **Keyword strikes**: as an attacker's strike lands, first / double strike cuts a bright slash across its target; deathtouch bursts a purple skull on the blocker it killed; lifelink sends gold motes from the attacker to its controller, whose `+N` waits for them; trample sends a green wave from the blocker to the defending player, whose damage number waits for it (it showed nothing before) | A planned strike whose attacker has the keyword (`cardIcons` or keyword lines): first strike / double strike; deathtouch and the blocker left every battlefield; lifelink and its controller's `life` went up; trample, blocked, and the defending player's `life` went down | `keywordStrikeFx.ts` `planKeywordStrikes` / `playKeywordStrikes` (timed from `StrikeSchedule.impactAt`), impacts `first-strike` / `deathtouch` / `lifelink` / `trample` | `anim:kw-first-strike`, `anim:kw-deathtouch`, `anim:kw-lifelink`, `anim:kw-trample` |

### Players

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Player damage**: info bar shakes, sparks and one `-N` (none for plain life loss) | `life` drops with a damage spell or combat strike | engine §D | `anim:player-damage`, `anim:player-life-loss` |
| **Life gain**: green glow, green-gold motes rise, `+N` floats up | `life` goes up | engine §D, impact `heal` | `anim:life-gain` |
| **Life total pop** | `life` changes | `PlayerInfoBar.css` `lifePop` | (`anim:life-gain`, `anim:player-damage`) |
| **Low-life vignette**: pulses at ≤ 5, critical at ≤ 2 | My `life` | `LowLifeVignette.tsx`, `lowLife.ts` | `anim:life-5`, `anim:life-2`, `anim:life-6` |
| **Priority**: gold orb flies to the new holder; gold glowing frame around the seat holding it | `hasPriority` moves | `PriorityOrbLayer`, `PlayerInfoBar.css` `priorityPulse` | `anim:priority-orb` |
| **Count flash**: `+N` / `-N` above hand, library, graveyard and exile counts | Those counts change | `useCountFlash.tsx` | `anim:count-flash` |
| **Library running out**: the pile or chip glows red and breathes at 3 cards or fewer (steady), is outlined red at 0, and shakes and cracks with a red flash when it empties. A game that opens at 0 does not crack | `libraryCount` | `libraryRunOut.ts` `libraryLevel` / `libraryRanOut` / `useLibraryRunOut`, `ResourceBar.css` `libraryLowBreath` / `libraryCrackFlash` | `anim:library-low`, `anim:library-empty`, `anim:library-empty-classic` |
| **Player counters**: the badge pops, flashes in its colour, rings and ticks, and a boxed change floats up. Poison is toxic green and drips (`poison` floater tone); the tenth bursts a toxic cloud over the seat, shakes the board and keeps the badge glowing. Energy cracks a yellow bolt; experience, rad, tickets and speed (the portrait's speed chip) get the generic pulse | A player's `counters` change (a missing counter counts as 0; infect/toxic waits for its strike) | `usePlayerCounters.ts` (`useCounterPulse` with `fromZero`), engine §M `playerCounterChanges` / `animatePlayerCounter`, `slamLethalPoison`, impacts `poison` / `poison-lethal` / `energy`, `PlayerInfoBar.css` | `anim:poison`, `anim:poison-lethal`, `anim:poison-pod`, `anim:energy`, `anim:player-counter`, `anim:speed` |
| **Timer**: tick, then shake when time runs low | Priority timer | `PlayerInfoBar.css` `timerTick` / `timerShake` | `anim:timer-low` |
| **Emblem**: it pops into the command zone with a violet flash, two rings (violet, gold) and gold sparks | A new emblem in a player's `commandList` (an `EmblemView`: no type, a name starting "Emblem") | `commandObjectsFx.ts` `commandArrivals`, engine §S, `CardSlot.css` `emblemPop`, impact `emblem` | `anim:emblem` |
| **Dungeon**: the dungeon badge flares like a torch, a ring and embers rise from it and the room's name (the dungeon's, on the first venture) floats up; the dungeon map in the mechanics panel lights the new room | A dungeon appears in `commandList`, or its current room ("(Currently in Goblin Lair)" in its rules) changes | `commandObjectsFx.ts` `dungeonOf`, engine §S, `PlayerInfoBar.css` `badgeDungeonAdvance`, `DungeonMap.tsx` / `MechanicsTray.css` `dungeonRoomEntered`, impact `dungeon` | `anim:dungeon` |
| **Dungeon completed**: the badge flares gold and bursts, embers rise and the dungeon's name floats up | Log `<player> has completed <dungeon>` (`GameImpl.java`) | `playerLogFx.ts` `animateDungeonCompleted`, `PlayerInfoBar.css` `badgeDungeonComplete` | `anim:dungeon-complete` |
| **Planeswalk** (Planechase): a planar portal swirls open over my command zone and the new plane rolls down into it. Planes are drawn in my command zone (every player's list carries the universal plane; only my side draws it) | A new plane (`PlaneView`, name "Plane - …") in `commandList`, reported once (no recorded Planechase frame: the shape is the fork's `PlaneView`; emblems and dungeons are checked against `emblem.json` / `dungeon.json`) | `commandObjectsFx.ts`, `CommandZone.tsx` (`plane-slot`), engine §S, `CardSlot.css` `planeRoll`, impact `planeswalk` | `anim:planeswalk` |
| **Monarch / initiative**: crown or ember token arcs from the old holder to the new one, badge pops; from nobody it drops from above | `monarch` / `initiative` moves | `designationFx.ts` | `anim:monarch-pass`, `anim:initiative-take` |
| **Pay to prevent**: paying sweeps a gold ring out of the portrait; declining dims it and shakes it like a head | Log `<player> chooses to pay … / chooses not to pay … to prevent the counter/sacrifice effect`, `<player> pays the cost to prevent the effect` | `playerLogFx.ts` `animatePayChoice`, `PlayerInfoBar.css` `payPaid` / `payDeclined` | `anim:pay-paid`, `anim:pay-declined-opp` |
| **Choice announced**: the chosen value (colour, creature type, player…) floats up in a gold box from the source card, or from the player's portrait when the source carries no id | Log `[<source>: ]<player> has chosen[ the color][:] <choice>` (not the Ring-bearer or companion lines) | `playerLogFx.ts` `animateChosen` | `anim:chosen-card`, `anim:chosen-player` |
| **Player eliminated**: the seat jolts, cracks red and white, sheds shards and drains to grey | `hasLeft` turns true | engine `eliminateSeat`, `DefeatedSeat.css` | `anim:player-eliminated` |
| **Player conceded**: no crack and no shards; the seat bows out under a white wash and drains to grey | Log `<player> has conceded.` within 10 s before `hasLeft` turns true | `concedeFx.ts`, engine `eliminateSeat`, impact `conceded`, `DefeatedSeat.css` `seatConcede` | `anim:player-conceded` |
| **Commander damage lethal**: the matrix cell pulses red | ≥ 21 from one commander | `CommanderDamageMatrix.css` `cdmLethalPulse` | `anim:commander-lethal` |
| **Targetable player**: pill beacon (required) or static border (optional) | `GAME_TARGET` on a player | `PlayerInfoBar.css` `playerTargetPulse` | `anim:chosen-target`, `anim:opp-pill-required`, `anim:opp-pill-optional` |

### Game flow

| Animation | Trigger | Where | Gallery |
|---|---|---|---|
| **Coin flip**: a coin spins at the centre and lands on the player who goes first | First turn-1 view with a phase | `coinFlipFx.ts`, `CoinFlipOverlay` | `anim:coin-flip` |
| **Turn banner**: centred banner with the turn number and active player | First phased view of a new turn | engine §0, `feedbackFx.ts` `announceBanner` | `anim:turn-banner` |
| **Phase wipe**: the active phase badge wipes in and its name fades in | `phase` / `step` change | `PhaseBar.css` `phaseWipe`, `phaseNameIn` | `anim:phase-wipe` |
| **Dice roll**: dice in the roller's seat colour tumble in, bounce and show the result (dN hexagon, d6 square, planar symbol) | Log `[Roll a die] … rolled …` / `[Roll a planar die] …` | `diceRollFx.ts`, `DiceRollOverlay` | `anim:dice-roll`, `anim:dice-roll-multi`, `anim:dice-planar` |
| **Day / night**: dawn or dusk sky washes the top bar and the sun or moon rises into its chip; classic badge spins in | Day/night hint changes | `dayNight.ts`, `GameTopBar.css`, `PlayerInfoBar.css` `badgeDayNightTurn` | `anim:day-night`, `anim:day-night-classic` |
| **Turn recap strip** slides in with what happened last turn | `observeTurnRecap` produces a recap on a turn change | `TurnRecapStrip.tsx`, `TurnRecapStrip.css` `turnRecapIn` | `anim:turn-recap` |
| **Cinematic end screen**: panel, spinning rays, title and rising (win) or falling (loss) particles | Game / match end | `GameEndDialog.css` | `anim:end-victory`, `anim:end-defeat` |

## Backlog

Verified against the engine and the game log on 2026-10-21: every animation the view or the log allows now plays. What is left
is in "Blocked: not in the view" below.

### Gallery coverage

Every shipped animation has a `#/gallery` entry with an action. The engine finds every pile on
both tables (`:is(.graveyard-stack, .graveyard-chip)`, `:is(.exile-stack, .exile-chip)`); a card
leaving a chip starts as a small upright card (`pileSize`), not as the chip's wide box read as a
tapped card.

`web/e2e/animations-play.spec.ts` replays the entries whose effect is a CSS class (countered,
fizzle, designations, scry / surveil, pay, choice, behold, dungeon completed, goad, conceded,
eliminated) with motion on and asserts `getComputedStyle(el).animationName`, so a stylesheet that
overrides an FX class fails there; `gallery.spec.ts` only checks that entries mount (reduced motion).

### Blocked: not in the view

Player targeting is engine state the `mage.view.*` DTOs never copy (`engineViewCoverage.test.ts`
baseline), so no client can animate it without a fork patch. `monstrous`, `renowned` and `harnessed`
are in that baseline too, but only as fields: their `ConditionHint` text reaches every card's `rules`,
so they animate (see "Designation gained"). Regeneration, prevented damage and "crime committed" have
neither view fields nor stable log lines; fight, proliferate, cascade, discover and explore have no
log line of their own (explore's reveal plays through the revealed-card flip).
