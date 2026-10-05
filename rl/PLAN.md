# RL bot — roadmap & session handoff

> Written 2026-10-05 after implementing Phase 1b (rival belief, v3 model).
> Purpose: pick up the next session exactly where this left off. Read together
> with `rl/README.md` (what exists and why) — this file is only the plan.

## Current state (verified)

- **v3 "rival belief" model implemented and tested end-to-end** (226k params,
  was 157k):
  - worker sends free training labels: `opHand` (opponent's real hand) and
    `deck`/`opDeck` (deck file stems) — labels only, never policy inputs;
  - belief conditioning: mean frozen text embedding of the opponent's revealed
    cards (bf+gy) + 10 type counts, projected into the trunk;
  - aux heads: hand regression (MSE on mean embedding) + archetype
    classification over `DECK_NAMES` vocab; weights HAND_COEF=0.3 /
    ARCH_COEF=0.2, small-init + clamp(max=10) anti-runaway guard;
  - offline regression test `rl/test_belief.py` (fake obs, no Java): all heads
    forward, belief sanity, PPO step, overfit proof (arch 18/18, hand MSE
    0.028 → 0.0001).
- v2 checkpoints do NOT load into v3 (new modules + wider trunk input).
  `data/model.pt` currently holds a ~90 s throwaway training run.
- Design decisions taken (do not relitigate without new evidence):
  - ONE model for all 1v1 (any format); separate models only for structurally
    different problems (multiplayer, draft), sharing the card-representation
    layer.
  - Belief/conditioning must derive from observation only (nothing that
    requires knowing the opponent's true deck at production time).
  - Deckbuilding via population methods (GA/CEM + surrogate evaluator), NOT
    sequential RL. MoE is a scale decision (phase 5), not a design fix.
  - Training stays on CPU while the model is ~1M params or less (measured:
    MPS 35× slower; same expected for consumer GPUs at this size).

## Pending work (priority order)

### P0 — validate v3 (compute only, no code)
- [ ] Set up the Ryzen machine (JDK 17 + Maven + uv; Linux preferred; install
      ROCm 7.x for later even if unused now).
- [ ] Scaling check: `train.py --minutes 3 --workers 8` vs `--workers 16`
      (and 24 if RAM allows); pick worker count from gps scaling.
- [ ] Long run: `train.py --minutes 180 --workers N --episodes-per-update 32
      --eval-every 25 --eval-games 200`.
- [ ] Success criteria: `arch` aux loss trending well below ln(10)≈2.3
      (ideally <1.0), winrate vs heuristic ≥90% pool aggregate, and the known
      weak spot — mono-red burn mirror (31.5% in v2 training eval) —
      measurably improved. Record numbers here.

### P1 — decision surface (breaks the real strength ceiling)
The engine AI still answers every prompt we don't intercept; no amount of
training fixes that. Each item follows the existing pattern (intercept prompt
in `RlPlayer.java` → serialize in `RlRunner.buildObs` → new head in
`model.py`).
- [ ] Mulligan (easiest; one prompt/game, small space) — do first, it
      establishes the pattern for the rest.
- [ ] Targeting (biggest EV jump; also unlocks counterspell/burn decisions).
- [ ] Modal / X-cost spell choices.
- [ ] Combat damage assignment + activation ordering.

### P2 — deckbuilding (breaks the generalization ceiling)
- [ ] Seeded population: scrape/consume human decks (EDHREC integration
      already exists in `web/`) → supervised generator for viable starters
      (~2-3 d).
- [ ] GA/CEM loop: population of decks evaluated against the frozen policy,
      successive tournament (20 games for all, more only for survivors);
      each generation feeds the training deck pool (~1 wk). Reuses `Runner` /
      `start_workers` as-is.
- [ ] Surrogate winrate evaluator (multiset of card embeddings → predicted
      winrate); its learned synergy embeddings feed smarter mutations
      (~3-4 d).
- [ ] Exploiter decks: optimize against the current policy; >60% winrate for
      an exploiter = automatic "gap here" signal → upweight that archetype in
      training. This is the cheap AlphaStar-exploiter equivalent (~1 wk).
- [ ] Guard rails: evaluate vs a MIX of opponents (never one, or exploit-y
      decks like turbo-fog overfit the evaluator); keep archetype niches /
      hall-of-fame to avoid population collapse.

### P3 — league & scale
- [ ] Decide exploiters-as-agents vs exploiters-as-decks (P2) or both.
- [ ] Model scale-up: 2-10M params, 2-3 attention blocks, card embedding
      64-128. Re-benchmark CPU vs ROCm GPU at that size (breakpoint somewhere
      between 1M and 10M).
- [ ] Potential-based reward shaping (life/card differential) for early
      training speed.
- [ ] Sideboard / best-of-3 (runner already loads sideboards; game 2-3 logic
      missing), singleton 1v1 coverage.

### P4 — only if diagnostics demand it
- [ ] Deep memory: transformer over last K trunk summaries `z` (cheaper than
      GRU with the current shape-grouped buffer). Trigger: belief aux losses
      plateau while opponent-reading mistakes persist.
- [ ] MoE in the trunk (router conditioned on the INFERRED archetype, never
      the true deck). Trigger: capacity ceiling at the scaled model size.
- [ ] Multiplayer / draft: separate models sharing the card layer.

### P5 — deployment (independent)
- [ ] ONNX export → ONNX Runtime Java inside `Mage.Proxy`, answering SIM-seat
      prompts; or a Python bot-service driving the SIM seat over the proxy WS.

## Environment notes (Ryzen / RX 9070)

- RX 9070 is RDNA4 (gfx1201): needs ROCm ≥6.4.3 (7.x recommended) and a
  matching PyTorch wheel (`--index-url .../whl/rocm7.x`). ROCm = Linux only
  (native Ubuntu ideal; WSL2 limited). 16 GB VRAM is plenty for 10M-100M
  models.
- Today (226k model): run `--device cpu` there too; the win is 16-24 JVM
  workers on many cores + 32 GB RAM. Re-measure GPU when the model passes
  ~1M params.
- Gotchas already solved (see README "gotchas"): sequential worker start with
  RL_READY probe, `Deck.load(list, false, false)`, no `testMode`, fake `Match`
  for MAD opponents.

## Next session starters

1. If P0 done → start P1 mulligan (pattern-setter), then targeting.
2. If P0 not possible → P2 seeding (EDHREC decks) runs on any machine and
   doesn't compete with training for GPU.
3. Either way, keep `test_belief.py` green before touching `model.py`.