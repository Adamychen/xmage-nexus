# RL spike: learning to play XMage

Throwaway research spike: can a small model learn to play Magic locally,
against the real XMage engine, and beat the built-in baselines?

> **Next steps / pending work live in [`rl/PLAN.md`](PLAN.md)** — session
> handoff doc: current state, design decisions taken, priority-ordered
> backlog (decision surface, deckbuilding, league, scale, deployment) and
> environment notes.

## Phase 1: mono-red mirror (specialized)

A 70k-param Set Transformer (card-name embeddings) trained with PPO for ~2.5 h
on an M5 (CPU only, 8 workers), over 400 games each (first player alternates):

| opponent               | winrate        |
|------------------------|----------------|
| random policy          | 96.8% ±1.7%    |
| greedy heuristic       | 71.5% ±4.4%    |
| MAD (native AI, skill 1)| 47.8% ±4.9%   |

Calibration: the greedy heuristic itself scores 25.0% vs MAD (100 games), so
the policy is near parity with XMage's flagship simulation AI.

## Phase 2: all cards (generalization)

The policy was then generalized from 6 hardcoded card names to **any card in
the engine** (32,059 cards):

- **Card representation**: frozen MiniLM text embedding of name + oracle text,
  fine-tuned *supervised* on the card DB (predict types, colors, mana value,
  subtypes — labels are free; ~8 min on the M5). The policy learns a projection
  of this vector (384->32) plus structured features (mv, colors, types),
  runtime features (tapped, P/T, damage, counters) and a hash embedding for
  unknown names (tokens). 157k params total.
  Sanity of the fine-tuned embeddings: `Lightning Bolt -> Lightning Strike,
  Fire Ambush, Twin Bolt`; `Counterspell -> Reject, Make Disappear...`;
  `Wrath of God -> Extinction, Catastrophe...`
- **Observation v2**: permanents now carry mana value, type/color bitmasks,
  damage, counters, runtime P/T; playable actions carry card types.
- **Deck pool**: `rl/decks/*.dck` (6 decks from the fork's `AI/` folder + 4
  intro packs), per-seat deck override in the runner, deck-agnostic heuristic
  baseline.
- **Trained** 3 h (121 updates / 2,928 games, natural endings, γ=0.999).
  Opponent mix: 30% current self-play, 30% vs past snapshots (snapshot pool,
  last 10 checkpoints every 10 updates), 30% vs deck-agnostic heuristic, 10%
  vs random. PPO update is shape-grouped batched (0.052 ms/forward CPU vs
  1.24 ms per-transition loop — even batched MPS is 35× slower than CPU for
  this 157k-param model, so updates stay on CPU). Collection and update are
  pipelined (frozen `collect_net` snapshots for the next batch while the
  previous updates).
- **Result** over 800 games across the 10 pool decks (40 per deck vs each of
  heuristic + random, first alternates, games run to life loss or decking):

| opponent  | winrate (pool aggregate)      |
|-----------|-------------------------------|
| heuristic | **94.5%** (378-22-0, 400 g)   |
| random    | **87.5%** (350-50-0, 400 g)   |
| both      | **91.0%** (728-72-0, 800 g)   |

  Per deck vs heuristic: 80%–100%, four decks at 100%, zero draws overall.
  (Previous run, before the mix fix / natural endings / batching: 80.8% vs
  heuristic with 17% artificial draws.) The mono-red burn mirror is now
  out-of-distribution and remains hard (31.5% in the last training eval) — the
  deck-agnostic heuristic plays mono-red aggro nearly optimally, while on
  generic decks it never blocks and loses.

Everything here is throwaway spike code: it only *consumes* the engine through
the public `Player`/`ComputerPlayer` plugin API. It does not touch the fork,
the proxy, `web/`, or any CI guard.

## Phase 1b: rival belief (v3 model, incompatible checkpoints)

The v2 policy was Markov on the public state: it could not infer anything about
the opponent's hidden information (hand, deck). v3 adds a belief layer trained
on free engine labels — no change to the RL reward:

- **Belief conditioning**: every obs already carries the opponent's public
  record (battlefield + graveyard names). `belief_from_obs` folds it into a
  fixed vector (mean frozen text embedding of revealed cards + 10 type counts)
  that conditions the trunk. The policy now sees *what kind of deck it is
  facing*, derived from observation only (works against unseen opponents).
- **Hand aux head**: the worker now sends the opponent's real hand (`opHand`)
  as a training label — never a policy input. The model regresses the mean
  frozen embedding of that hand, forcing the trunk to encode "what does the
  opponent probably hold" from public evidence.
- **Archetype aux head**: the worker sends each seat's deck name (`deck` /
  `opDeck`); the model classifies the opponent's archetype over the deck-pool
  vocabulary (`train.py` `DECK_NAMES`). A small-init + clamp guard keeps the CE
  from running away early (trunk z can be large-magnitude at init).
- Aux weights: `HAND_COEF=0.3`, `ARCH_COEF=0.2` (in `model.py`, shared by
  `ppo.py`). Both losses are logged per update (`hand=`, `arch=` in the train
  line).
- `test_belief.py` is an offline regression check (fake obs, no Java): forward
  on all 3 heads, belief-vector sanity, PPO step with aux losses, and an
  overfit proof that both aux heads learn (arch accuracy, hand MSE).

Note: state_dicts from v2 checkpoints do **not** load into v3 (new modules:
`belief_proj`, `hand_head`, `arch_head`, wider trunk input). Retrain or delete
`data/model.pt`.

## Layout

- `env-runner/` — Java worker. Runs a headless `TwoPlayerDuel` in-process
  (no server, no proxy) with two `RlPlayer` (extends `ComputerPlayer`).
  `priority()` / `selectAttackers()` / `selectBlockers()` are forwarded over
  stdin/stdout as JSONL; every other prompt (mana, targeting, mulligan) falls
  back to the engine AI defaults. ~2.4 games/s per worker.
- `rl_bot/runner.py` — Python subprocess driver for one worker.
- `rl_bot/card_features.py` — frozen card table lookup (`data/card_emb.npz`).
- `rl_bot/model.py` — Set Transformer actor-critic: text-embedding projection
  + structured/runtime features + hash fallback + rival-belief conditioning;
  one action head per prompt (priority categorical over playable abilities +
  pass; attackers Bernoulli; blockers one categorical per creature over
  blockable attackers); aux heads for opponent hand (regression) and archetype
  (classification).
- `rl_bot/ppo.py` — minimal PPO (sparse terminal reward ±1, γ=0.997, MC returns).
- `rl_bot/policies.py` — baselines: `random`, `heuristic` (deck-agnostic greedy).
- `train.py` — self-play + fixed-opponent mixed PPO loop over the deck pool.
- `eval.py` — head-to-head eval (`--pool` rotates `rl/decks/*.dck`).
- `dump`: `DumpCards.java` (engine -> `data/cards.jsonl`) ->
  `train_card_encoder.py` (supervised MiniLM fine-tune) ->
  `build_card_embeddings.py` (-> `data/card_emb.npz`).
- `smoke.py`, `diag.py` — env sanity check and action-statistics debugger.
- `build.sh` — rebuild the worker jar (`mvn clean package`; always `clean`,
  maven incremental compilation lies here).

## Run it

```bash
bash rl/build.sh                       # build the java worker jar
cd rl
uv run smoke.py 20                     # env sanity: heuristic vs random, expect ~19-1
uv run train.py --minutes 120 --workers 8 --episodes-per-update 24 --eval-every 25 --eval-games 200
uv run eval.py --games 400             # head-to-head vs random/heuristic (default deck)
uv run eval.py --games 40 --pool --vs heuristic   # rotate the whole deck pool
uv run eval.py --games 400 --vs mad    # vs the native MAD AI (java-side seat)
```

Rebuild the card table from scratch:

```bash
cd rl/data && java -cp ../env-runner/target/rl-runner.jar org.mage.rl.DumpCards cards.jsonl
cd .. && uv run train_card_encoder.py --epochs 6
uv run build_card_embeddings.py --encoder data/card_encoder.pt
```

Environment variables: `RL_GAMELOG=1` enables the engine game log on stderr
(useful to see why a game ended). Native opponents need a fake `Match` attached
to each player (`FreeForAllMatch` + `MatchOptions`), otherwise MAD's internal
simulation NPEs on `player.getMatchPlayer()`.

## What made the difference

- **Opponent mix** (30% current self-play, 30% vs past snapshots, 30% vs
  heuristic, 10% vs random). Pure current-vs-current self-play converged to
  mutual passivity: with shared weights the mirror has no gradient towards
  aggression. Snapshots (past checkpoints as opponent) fix the mirror
  degeneracy without leaving the self-play paradigm.
- **Sampled eval**, not argmax: a stochastic policy's argmax (esp. with entropy
  still high) plays nothing and reads as a fake collapse.
- **Batched PPO update** (shape-grouped, no padding): 23× faster than the
  per-transition Python loop on CPU. MPS is not used: even batched it is 35×
  slower for this model size (kernel dispatch dominates).
- **Async pipeline**: collect the next batch with a frozen snapshot while the
  previous batch updates — hides the whole update.
- **Preencode caching**: obs → raw tensors once per PPO batch, parameter math
  per epoch.
- **Supervised card-encoder adaptation**: RL rewards alone are too sparse to
  train a 22M text encoder; predicting free structured labels from the card DB
  gives dense signal and strong card neighborhoods.
- **Natural game endings** (no artificial turn cap): draws were 17-27% of the
  capped games and carried zero learning signal; with decking/life endings the
  policy learns to actually close.

## Engine/tooling gotchas found (worth remembering)

- `mvn install` with incremental compilation had produced `.m2` jars mixing
  classes from two builds (`NoSuchMethodError` in `AkuDjinn.<clinit>`); a
  `clean install` of `Mage`/`Mage.Sets` fixed every consumer.
- `Deck.load(list)` defaults to `mockCards=true` (GUI-only): cards silently get
  `MockAbility`. Use `Deck.load(list, false, false)`.
- `GameOptions.testMode=true` also skips the opening draw — do not use it for
  real games; cap turn count via `stopOnTurn` instead.
- 8 JVMs opening the H2 card db concurrently race on first init; the runner
  retries the scan.
- MAD's simulation needs `player.getMatchPlayer()` non-null (attach a fake
  `Match`), and `Permanent.getCounters(game)` (not the no-arg accessor).
- The runner's `opp` command field takes a **seat** ("A"/"B") for its native AI;
  Python baselines must be driven by the Python side on their own seat, not by
  passing `opp="heuristic"` (that NPEs every game and silently trains on
  nothing).
- 8 JVMs opening the H2 card db concurrently race on first init; worse, a JVM
  whose `CardRepository.<clinit>` fails is **poisoned for its whole lifetime**
  (retrying the scan throws `NoClassDefFoundError` forever and every game
  fails). Fix: workers print `RL_READY` after a repository probe and Python
  starts them sequentially, relaunching any that die before READY.

## Integration path (not part of the spike)

The policy is a Python process today. For XMage Nexus the cheap paths are:
bot service driving a SIM seat over the proxy WS (what `SimPlayer` already
does), or export to ONNX and embed in the proxy via ONNX Runtime Java. Either
way the protocol surface is the same GameView-based seat the proxy already owns.
