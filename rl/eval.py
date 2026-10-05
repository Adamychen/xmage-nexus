"""Head-to-head evaluation of a saved policy vs baselines.

Usage: uv run eval.py --games 400 --ckpt data/model.pt
"""
from __future__ import annotations

import argparse
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.card_features import CardTable  # noqa: E402
from rl_bot.model import Net  # noqa: E402
from rl_bot.policies import act_by  # noqa: E402
from rl_bot.runner import Runner, start_workers  # noqa: E402
from train import policy_action  # noqa: E402

ROOT = Path(__file__).parent
JAR = ROOT / "env-runner/target/rl-runner.jar"
DECK = ROOT / "env-runner/MonoRedBurn.dck"
DATA = ROOT / "data"
# Games run to natural end (life loss or decking); 300 is a safety net only.
TURNS = 300


def eval_vs(net: Net, workers: list[Runner], opponent: str, n_games: int,
            deck: str | None = None, seed: int = 7) -> dict:
    import random
    rng = random.Random(seed)
    wins = {"A": 0, "B": 0, "": 0}
    lock = threading.Lock()
    counter = {"next": 0, "turns": 0}

    def act(obs: dict) -> dict:
        if obs["seat"] == "A":
            return policy_action(obs, net)
        return act_by(opponent, obs, rng)

    def job(worker: Runner):
        while True:
            with lock:
                i = counter["next"]
                if i >= n_games:
                    break
                counter["next"] = i + 1
            res = worker.play_game("AB"[i % 2], TURNS, act, deck_a=deck, deck_b=deck)
            with lock:
                wins[res.get("winner", "")] += 1
                counter["turns"] += res.get("turns", 0)

    with ThreadPoolExecutor(max_workers=len(workers)) as ex:
        list(ex.map(job, workers))
    played = wins["A"] + wins["B"] + wins[""]
    return {"winrate": wins["A"] / max(1, played), "wins": wins,
            "avg_turns": counter["turns"] / max(1, played), "games": played}


NATIVE_OPPONENTS = {"mad", "ai"}


def eval_native(net: Net, workers: list[Runner], opp_type: str, n_games: int) -> dict:
    """Policy (seat A, python) vs a Java-native AI opponent (seat B)."""
    wins = {"A": 0, "B": 0, "": 0}
    lock = threading.Lock()
    counter = {"next": 0, "turns": 0}

    def act(obs: dict) -> dict:
        return policy_action(obs, net)

    def job(worker: Runner):
        while True:
            with lock:
                i = counter["next"]
                if i >= n_games:
                    break
                counter["next"] = i + 1
            res = worker.play_game("AB"[i % 2], TURNS, act, opp="B", opp_type=opp_type)
            with lock:
                wins[res.get("winner", "")] += 1
                counter["turns"] += res.get("turns", 0)

    with ThreadPoolExecutor(max_workers=len(workers)) as ex:
        list(ex.map(job, workers))
    played = wins["A"] + wins["B"] + wins[""]
    return {"winrate": wins["A"] / max(1, played), "wins": wins,
            "avg_turns": counter["turns"] / max(1, played), "games": played}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default=str(DATA / "model.pt"))
    ap.add_argument("--games", type=int, default=400)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--vs", default="random,heuristic",
                    help="comma list: random,heuristic,mad,ai")
    ap.add_argument("--pool", action="store_true",
                    help="rotate over rl/decks/*.dck; --games is per deck")
    args = ap.parse_args()

    torch.set_num_threads(1)
    table = CardTable(DATA / "card_emb.npz")
    deck_names = [p.stem for p in sorted((ROOT / "decks").glob("*.dck"))]
    net = Net(table, deck_names)
    net.load_state_dict(torch.load(args.ckpt, map_location="cpu"))
    net.eval()
    workers = start_workers(args.workers, str(JAR), str(DECK), str(DATA), prefix="eval")
    decks = sorted((ROOT / "decks").glob("*.dck")) if args.pool else [None]
    try:
        total_wins = {"A": 0, "B": 0, "": 0}
        total_games = 0
        for deck in decks:
            agg = {"A": 0, "B": 0, "": 0}
            games = 0
            for opp in [o.strip() for o in args.vs.split(",") if o.strip()]:
                if opp in NATIVE_OPPONENTS:
                    r = eval_native(net, workers, opp, args.games)
                else:
                    r = eval_vs(net, workers, opp, args.games, deck=str(deck) if deck else None)
                games += r["games"]
                for k in agg:
                    agg[k] += r["wins"][k]
                total_games += r["games"]
                for k in total_wins:
                    total_wins[k] += r["wins"][k]
                if not args.pool:
                    ci = 1.96 * (r["winrate"] * (1 - r["winrate"]) / max(1, r["games"])) ** 0.5
                    print(f"vs {opp}: winrate={r['winrate']:.1%} ±{ci:.1%} {r['wins']} "
                          f"avg_turns={r['avg_turns']:.1f} ({r['games']} games)", flush=True)
            if args.pool:
                wr = agg["A"] / max(1, games)
                print(f"{deck.name[:38]:40s} winrate={wr:.1%} {agg} ({games} games)", flush=True)
        if args.pool:
            wr = total_wins["A"] / max(1, total_games)
            print(f"{'TOTAL':40s} winrate={wr:.1%} {total_wins} ({total_games} games)", flush=True)
    finally:
        for w in workers:
            w.close()


if __name__ == "__main__":
    main()
