# Mana payment

Prefix: `MNA`

Paying a cost is a server loop: the engine sends `GAME_PLAY_MANA` once per payment step, the
client answers with one source (a permanent UUID, a pool colour, the special action or cancel)
and the engine asks again with the remaining cost. The prompt renders as
`web/src/game/feedbackModes/ManaBar.tsx`; the pool is `web/src/game/ManaPoolView.tsx`; the
optional auto-tap solver is `web/src/game/smartManaPayment.ts`. That the payment is in-board and
never blocks the board is PRM-1 (`prompts.md`). The guiding principle: **the server decides what
pays; the client sends what the player clicked, and only taps on its own when it is sure.**

### MNA-1 · You pay by clicking your sources; the bar names the cost
The mana bar shows the remaining cost (localised) and a hint naming what can be clicked: mana
sources, creatures for Convoke, artifacts for Improvise. The hint is announced to screen readers.
The bar has no colour buttons of its own: the player taps lands, rocks and creatures on the board.

- Why: `GAME_PLAY_MANA` carries only `queryType: PLAY_MANA`, never the colours that would pay, so
  the bar has nothing to build colour buttons from; the official client also pays by clicking
  the sources.
- Guard: `src/game/feedback.test.ts` · `src/game/feedbackModes/promptBars.test.tsx`

### MNA-2 · During a payment every permanent you click reaches the server
While a mana prompt is open, a click on any permanent is sent to the server even when the server
did not list it as playable, and the server accepts or rejects it. Combat, target and playable
clicks keep priority over this fallback; outside a payment an unlisted permanent stays inert.

- Why: in the "pay {2} to attack" loop (Propaganda) `canPlayObjects` arrives empty although
  untapped lands and Treasures are on the board, so a player reported that nothing could be
  clicked to pay; the desktop client never gates the click on `isPlayable` (`4acbbb2160`,
  `docs/lessons.md`).
- Guard: `src/board/useBoardPresenter.test.ts`

### MNA-3 · Floating mana is spent by clicking its symbol
Your own pool symbols are buttons: a click spends one mana of that colour. Outside a payment the
pool shows only the colours holding mana (a dash when it is empty); during a payment your pool
shows all six, zeros included. An opponent's pool is never clickable.

- Why: with "Pool mana needs manual use" on (the default, MNA-4) mana already floating is only
  spent when its symbol is clicked, as in the desktop's per-colour pool buttons (`723b17b98e`).
  Six permanent zeros were noise outside a payment, while "I have no blue" is actionable during
  one (`1539207e13`).
- Guard: `src/game/ManaPoolView.test.tsx` · `src/game/ResourceBar.test.tsx` · `src/game/manaPayment.test.ts` · `e2e/mana-payment.spec.ts`

### MNA-4 · Payment preferences are the server's and are re-sent at every game start
The game menu's *Mana payment* section holds the server's three toggles: pay automatically (on),
pool mana needs manual use (on) and use the first mana ability when tapping (off). Each change is
sent at once, every value is stored locally, and all of them are sent again when a game starts
with a seat the player controls.

- Why: they are the same toggles as the desktop's play-area menu and only the engine applies them,
  so the stored choice must reach each new game before its first payment (`723b17b98e`).
- Guard: `src/game/manaPayment.test.ts` · `e2e/mana-payment.spec.ts`

### MNA-5 · The "mana will be lost" warning comes from the server only
"Confirm passing with mana in pool" is a server preference (`confirmEmptyManaPool`). When it is on,
the server asks before priority passes with mana floating and the client renders that ask with
the server's Yes/No; the client never shows a warning of its own, so with the option off a pass
goes straight through.

- Why: a local confirmation dialog duplicated the server's ask; it was removed so the server's
  `GAME_ASK` is the single source of truth (`88e82ae6cf`).
- Guard: `src/game/feedback.test.ts` · `e2e/mana-payment.spec.ts`

### MNA-6 · Special and Cancel are always on the mana bar
The bar always offers *Special Action* (asks the server for a special payment such as Convoke,
Improvise or Delve) and *Cancel*, which abandons the payment: the engine stops the payment loop
on any yes/no answer and the spell or ability is not cast.

- Why: special payments are not mana abilities, so the server only offers them on request
  (`sendPlayerString('special')`); without a cancel a player who started a cast they cannot
  afford has no way out.
- Guard: none yet (no test clicks either button on the mana bar or asserts what it sends;
  `e2e/complex-costs.spec.ts` clicks Special during Convoke without asserting the answer)

### MNA-7 · Smart payment is opt-in and steps aside when it is not sure
*Smart mana payment* is off by default (the Simple and Balanced presets turn it on). When on, it
taps one source per mana prompt and re-solves at the next one. It does nothing while an answer is
in flight, when the cost holds a symbol it cannot model or cannot be paid from known sources. If
the next prompt's cost did not drop by exactly one (the player clicked a source, or the engine
did something else) it stops for the rest of that payment, and the player finishes by hand; a
failed send also stops it and shows the error.

- Why: the server asks once per tap, so the solver must re-plan at every prompt, and a guess
  that taps the wrong land cannot be undone; the player clicking a source is the way to take
  over (`d92e29804f`, `docs/lessons.md`).
- Guard: `src/game/feedbackModes/ManaBar.smart.test.tsx` · `src/game/smartManaPayment.test.ts` · `e2e/smart-mana-real.spec.ts`

### MNA-8 · Smart payment taps like a careful player, from public information
The solver reads sources from your battlefield's mana abilities (untapped, not summoning-sick
creatures, not phased out; no sacrifice, restricted or multi-mana abilities) and spends floating
mana first. It matches every coloured and hybrid pip exactly, reassigning sources when a greedy
pick would strand a later pip; colourless sources pay generic before coloured ones and any-colour
sources are kept for last. Among equal choices it keeps open the last producer of a colour an
instant or flash card in your hand needs, weighted by the mana your opponents have untapped, but
that reserve never makes a payable cost unpayable. It uses only your hand, your board and the
opponents' visible untapped mana.

- Why: `canPlayObjects` is empty in non-cast payments, so sources come from the battlefield
  `rules`; a client-side helper must not use hidden information (`d92e29804f`,
  `docs/lessons.md`).
- Guard: `src/game/smartManaPayment.test.ts`

### MNA-9 · Smart payment never spends a pain land on generic while a painless source is open
A source whose tap-for-mana rules deal damage to you or make you lose life (`tapPainOf`; an
enters-the-battlefield "pay life" does not count) pays generic mana only when no painless source
is left. For a coloured pip it is used as usual: that damage is the price of the colour.

- Why: tapping sends only the permanent's UUID, and for a generic remainder the engine fires the
  first usable mana ability without asking, so a Llanowar Wastes tapped for generic could deal
  damage for nothing (`b4f7cd72b9`, `docs/lessons.md`).
- Guard: `src/game/smartManaPayment.test.ts`

### MNA-10 · X is announced as a number, and only a value in range is sent
The value of X is asked before the payment as an amount prompt (`GAME_GET_AMOUNT`). Confirm is
disabled and the allowed range is flagged while the typed value is outside `[min, max]`, so an
out-of-range answer is never sent. `GAME_PLAY_XMANA` is kept as a Confirm/Cancel prompt, the
desktop's shape, although the 1.4.62 engine never sends it (nothing calls `firePlayXManaEvent`).

- Why: the engine silently re-asks on an out-of-range value (`HumanPlayer.announceX`), so the
  button would look broken; amounts were range-checked in `8fbb005e7b`.
- Guard: `src/game/feedbackModes/GenericDialog.test.tsx` · `src/game/feedback.test.ts`
