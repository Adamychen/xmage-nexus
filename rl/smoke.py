import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.policies import act_by  # noqa: E402
from rl_bot.runner import Runner  # noqa: E402

ROOT = Path(__file__).parent
JAR = ROOT / "env-runner/target/rl-runner.jar"
DECK = ROOT / "env-runner/MonoRedBurn.dck"
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

n_games = int(sys.argv[1]) if len(sys.argv) > 1 else 10
r = Runner(str(JAR), str(DECK), str(DATA))
r.wait_ready()
rng = random.Random(0)
wins = {"A": 0, "B": 0, "": 0}
t0 = time.time()
for g in range(n_games):
    r.new_game(first="AB"[g % 2], turns=30)
    while True:
        msg = r.recv()
        if msg["type"] == "result":
            wins[msg.get("winner", "")] += 1
            if (g + 1) % 5 == 0 or g == n_games - 1:
                print(f"game {g + 1}: {wins} turns={msg.get('turns', '?')} err={msg.get('error', 0)}")
            break
        r.send(act_by("heuristic" if msg["seat"] == "A" else "random", msg, rng))
dt = time.time() - t0
print(f"{n_games} games in {dt:.1f}s = {n_games / dt:.2f} games/s single worker")
r.close()
