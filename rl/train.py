"""Self-play PPO training loop for the XMage mirror env.

Usage: uv run train.py --minutes 30 [--workers 8] [--episodes-per-update 16]
"""
from __future__ import annotations

import argparse
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.card_features import CardTable  # noqa: E402
from rl_bot.model import Net, action_dist, action_logprob, to_protocol  # noqa: E402
from rl_bot.policies import act_by  # noqa: E402
from rl_bot.ppo import annotate_returns, ppo_update  # noqa: E402
from rl_bot.runner import Runner, start_workers  # noqa: E402

ROOT = Path(__file__).parent
JAR = ROOT / "env-runner/target/rl-runner.jar"
DECK = ROOT / "env-runner/MonoRedBurn.dck"
DATA = ROOT / "data"
CKPT = DATA / "model.pt"
RNG = random.Random(1234)
DECK_POOL = sorted((ROOT / "decks").glob("*.dck"))
DECK_NAMES = [p.stem for p in DECK_POOL]  # archetype-label vocabulary (aux head)
# No artificial game length cap: games end by life loss or decking (a player
# drawing from an empty library loses). 300 is a safety net only.
TURNS = 300


def make_workers(n: int) -> list[Runner]:
    return start_workers(n, str(JAR), str(DECK), str(DATA))


def _sample_action(net: Net, obs: dict):
    """Sample one action from net; returns (protocol_action, stored, logp, value)."""
    with torch.no_grad():
        out = net(obs)
        dist = action_dist(out)
        action = dist.sample()
        logp = action_logprob(out, action)
        value = float(out["v"])
    head = out["head"]
    if head == "priority":
        stored = int(action)
    elif head == "attackers":
        stored = action.long()
    else:
        stored = [int(a) for a in action]
    return to_protocol(obs, out, stored), stored, logp.detach(), value


def sample_game(net: Net, runner: Runner, first: str, opponent: str | None = None,
                opp_net: Net | None = None, turns: int = TURNS) -> list[dict]:
    """One game; returns annotated transitions.

    opponent=None -> current-policy self-play (both seats, both contribute data).
    opponent="snapshot" -> past-policy checkpoint plays seat B (opp_net);
      only seat A (current policy) contributes transitions.
    opponent="heuristic"|"random" -> fixed baseline plays seat B; seat A only.
    """
    episode = []

    def act(obs: dict) -> dict:
        if opponent is not None and obs["seat"] == "B":
            if opponent == "snapshot" and opp_net is not None:
                proto, _, _, _ = _sample_action(opp_net, obs)
                return proto
            return act_by(opponent, obs, RNG)
        proto, stored, logp, value = _sample_action(net, obs)
        episode.append({"obs": obs, "action": stored, "old_logp": logp,
                        "value": value, "seat": obs["seat"]})
        return proto

    deck = str(RNG.choice(DECK_POOL)) if DECK_POOL else None
    res = runner.play_game(first, turns, act, deck_a=deck, deck_b=deck)
    winner = res.get("winner", "")
    seats = ("A",) if opponent is not None else ("A", "B")
    transitions = []
    for seat in seats:
        traj = [t for t in episode if t["seat"] == seat]
        terminal = 0.0
        if winner == seat:
            terminal = 1.0
        elif winner and winner != seat:
            terminal = -1.0
        if traj:
            annotate_returns(traj, terminal)
            transitions.extend(traj)
    return transitions


def opponent_mix(i: int, has_snapshots: bool) -> str | None:
    """30% self-play, 30% vs snapshot (if any), 30% heuristic, 10% random."""
    m = i % 10
    if m < 3:
        return None
    if m < 6:
        return "snapshot" if has_snapshots else "heuristic"
    if m < 9:
        return "heuristic"
    return "random"


class SnapshotPool:
    """Past policy checkpoints for non-mirror self-play."""

    def __init__(self, keep: int = 10):
        self.keep = keep
        self.snapshots: list[dict] = []

    def maybe_add(self, net: Net, update: int, every: int):
        if every > 0 and update % every == 0:
            self.snapshots.append({k: v.detach().cpu().clone()
                                   for k, v in net.state_dict().items()})
            if len(self.snapshots) > self.keep:
                self.snapshots.pop(0)

    def random(self) -> dict | None:
        if not self.snapshots:
            return None
        return RNG.choice(self.snapshots)


def collect(net: Net, workers: list[Runner], n_games: int,
            snapshots: SnapshotPool | None = None) -> list[list[dict]]:
    lock = threading.Lock()
    counter = {"next": 0}
    out: list[list[dict]] = []
    opp_nets = [Net(net.table, net.deck_names) for _ in workers]  # one per thread: snapshot seat B

    def job(worker: Runner, opp_net: Net):
        local = []
        while True:
            with lock:
                i = counter["next"]
                if i >= n_games:
                    break
                counter["next"] = i + 1
            opponent = opponent_mix(i, snapshots is not None and snapshots.snapshots)
            if opponent == "snapshot":
                opp_net.load_state_dict(snapshots.random())
            local.append(sample_game(net, worker, "AB"[i % 2], opponent, opp_net))
        return local

    with ThreadPoolExecutor(max_workers=len(workers)) as ex:
        for chunk in ex.map(job, workers, opp_nets):
            out.extend(chunk)
    return out


def policy_action(obs: dict, net: Net) -> dict:
    with torch.no_grad():
        out = net(obs)
        action = action_dist(out).sample()
        head = out["head"]
        if head == "priority":
            stored = int(action)
        elif head == "attackers":
            stored = action.long()
        else:
            stored = [int(a) for a in action]
        return to_protocol(obs, out, stored)


def eval_vs(net: Net, workers: list[Runner], opponent: str, n_games: int) -> dict:
    def act(obs: dict) -> dict:
        if obs["seat"] == "A":
            return policy_action(obs, net)
        return act_by(opponent, obs, RNG)

    wins = {"A": 0, "B": 0, "": 0}
    lock = threading.Lock()
    counter = {"next": 0, "turns": 0}

    def job(worker: Runner):
        while True:
            with lock:
                i = counter["next"]
                if i >= n_games:
                    break
                counter["next"] = i + 1
            res = worker.play_game("AB"[i % 2], TURNS, act)
            with lock:
                wins[res.get("winner", "")] += 1
                counter["turns"] += res.get("turns", 0)

    with ThreadPoolExecutor(max_workers=len(workers)) as ex:
        list(ex.map(job, workers))
    played = wins["A"] + wins["B"] + wins[""]
    return {"winrate": wins["A"] / max(1, played), "wins": wins, "avg_turns": counter["turns"] / max(1, played)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=30)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--episodes-per-update", type=int, default=16)
    ap.add_argument("--eval-every", type=int, default=10)
    ap.add_argument("--eval-games", type=int, default=100)
    ap.add_argument("--max-updates", type=int, default=10**9)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--init", type=str, default="")
    ap.add_argument("--snapshot-every", type=int, default=10,
                    help="updates between opponent snapshots (self-play pool)")
    ap.add_argument("--device", type=str, default="auto",
                    help="update device: auto|cpu|mps (collection is always CPU). "
                         "auto=cpu: measured, even batched MPS is ~35x slower than CPU "
                         "for this 157k-param model (dispatch overhead dominates)")
    args = ap.parse_args()

    torch.manual_seed(0)
    torch.set_num_threads(1)
    table = CardTable(DATA / "card_emb.npz")
    if args.device == "auto":
        device = "cpu"
    else:
        device = args.device
    net = Net(table, DECK_NAMES).to(device)
    if args.init:
        net.load_state_dict(torch.load(args.init, map_location=device))
    # collect_net runs inference on CPU (2.5x faster per decision than MPS at
    # batch=1); refreshed from net after every update.
    collect_net = Net(table, DECK_NAMES)
    collect_net.load_state_dict(net.state_dict())
    collect_net.eval()
    n_params = sum(p.numel() for p in net.parameters())
    print(f"net params={n_params} workers={args.workers} minutes={args.minutes} update-device={device}", flush=True)
    optim = torch.optim.Adam(net.parameters(), lr=args.lr)
    workers = make_workers(args.workers)
    snapshots = SnapshotPool(keep=10)
    snapshots.maybe_add(net, 0, args.snapshot_every)

    t0 = time.time()
    games = 0
    updates = 0
    paused = 0.0
    try:
        buffer = collect(collect_net, workers, args.episodes_per_update, snapshots)
        games += len(buffer)
        while time.time() - t0 < args.minutes * 60 and updates < args.max_updates:
            t_up = time.time()
            ex = ThreadPoolExecutor(max_workers=1)
            fut = ex.submit(ppo_update, net, optim,
                            [t for ep in buffer for t in ep], 256, device)
            # collect the next batch while the update runs (staleness = 1 update)
            next_buffer = collect(collect_net, workers, args.episodes_per_update, snapshots)
            stats = fut.result()
            ex.shutdown()
            paused += time.time() - t_up  # approx overlap accounting
            buffer = next_buffer
            games += len(buffer)
            updates += 1
            collect_net.load_state_dict(net.state_dict())
            snapshots.maybe_add(net, updates, args.snapshot_every)
            if updates % 5 == 0 or updates == 1:
                transitions = [t for ep in buffer for t in ep]
                rew = sum(t["return"] for t in transitions) / max(1, len(transitions))
                dt = time.time() - t0
                print(f"upd {updates} games={games} gps={games / dt:.2f} "
                      f"steps={len(transitions)} pg={stats['pg']:.3f} v={stats['v']:.3f} "
                      f"ent={stats['ent']:.2f} hand={stats['hand']:.3f} arch={stats['arch']:.3f} "
                      f"meanR={rew:.3f}", flush=True)
            if updates % args.eval_every == 0:
                h = eval_vs(collect_net, workers, "heuristic", args.eval_games)
                r = eval_vs(collect_net, workers, "random", args.eval_games)
                print(f"  EVAL upd {updates}: vs heuristic {h['winrate']:.2%} {h['wins']} "
                      f"(turns {h['avg_turns']:.1f}) | vs random {r['winrate']:.2%} {r['wins']}", flush=True)
                torch.save({k: v.cpu() for k, v in net.state_dict().items()}, CKPT)
    finally:
        for w in workers:
            w.close()
    torch.save({k: v.cpu() for k, v in net.state_dict().items()}, CKPT)
    print(f"saved {CKPT} after {updates} updates / {games} games / {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
