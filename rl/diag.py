import collections
import random
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch

sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.card_features import CardTable  # noqa: E402
from rl_bot.model import Net, action_dist, to_protocol  # noqa: E402
from rl_bot.policies import act_by  # noqa: E402
from rl_bot.runner import Runner, start_workers  # noqa: E402

ROOT = Path(__file__).parent
JAR = ROOT / "env-runner/target/rl-runner.jar"
DECK = ROOT / "env-runner/MonoRedBurn.dck"
DATA = ROOT / "data"


def diag(net, workers, opponent, n_games=12, sample=True, label=""):
    stats = collections.Counter()
    wins = collections.Counter()
    lock = threading.Lock()
    rng = random.Random(3)

    def act(obs):
        if obs["seat"] == "B":
            return act_by(opponent, obs, rng)
        with torch.no_grad():
            out = net(obs)
            head = out["head"]
            if sample:
                a = action_dist(out).sample()
            else:
                if head == "priority":
                    a = int(torch.argmax(out["logits"]))
                elif head == "attackers":
                    a = (out["logits"] > 0).long()
                else:
                    a = [int(torch.argmax(r)) for r in out["logits"]]
            stats[head] += 1
            if head == "priority":
                n = len(obs.get("acts", []))
                val = a if isinstance(a, int) else int(a)
                stats["play" if val < n else "pass"] += 1
            elif head == "attackers":
                lst = a.tolist() if hasattr(a, "tolist") else a
                stats["atk_declared"] += sum(1 for x in lst if x == 1)
                stats["atk_cands"] += len(lst)
            else:
                stats["block_pairs"] += sum(1 for x in a if int(x) > 0)
                stats["block_cands"] += len(a)
            if head == "priority":
                stored = int(a)
            elif head == "attackers":
                stored = a.long()
            else:
                stored = [int(x) for x in a]
        return to_protocol(obs, out, stored)

    def job(w):
        for i in range(n_games):
            res = w.play_game("AB"[i % 2], 30, act)
            with lock:
                wins[res.get("winner", "")] += 1

    with ThreadPoolExecutor(max_workers=len(workers)) as ex:
        list(ex.map(job, workers))
    print(f"[{label}] wins={dict(wins)} priority: play={stats['play']} pass={stats['pass']} "
          f"attackers={stats['atk_declared']}/{stats['atk_cands']} blocks={stats['block_pairs']}/{stats['block_cands']}",
          flush=True)


def main():
    workers = start_workers(4, str(JAR), str(DECK), str(DATA), prefix="diag")
    table = CardTable(DATA / "card_emb.npz")
    deck_names = [p.stem for p in sorted((ROOT / "decks").glob("*.dck"))]
    try:
        for ckpt, label in [("", "untrained"), ("data/model.pt", "trained")]:
            net = Net(table, deck_names)
            if ckpt:
                net.load_state_dict(torch.load(ROOT / ckpt, map_location="cpu"))
            net.eval()
            diag(net, workers, "random", n_games=12, sample=True, label=f"{label}/sample")
            diag(net, workers, "random", n_games=12, sample=False, label=f"{label}/argmax")
    finally:
        for w in workers:
            w.close()


if __name__ == "__main__":
    main()
