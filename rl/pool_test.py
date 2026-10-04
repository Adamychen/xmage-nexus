"""Sanity: every deck in rl/decks loads and plays a mirror game (heuristic vs random)."""
import random, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from rl_bot.policies import act_by
from rl_bot.runner import Runner

ROOT = Path(__file__).parent
decks = sorted((ROOT / "decks").glob("*.dck"))
r = Runner(str(ROOT / "env-runner/target/rl-runner.jar"), str(decks[0]),
           str(ROOT / "data"), err_log="pooltest.err.log")
r.wait_ready()
rng = random.Random(0)
bad = 0
t0 = time.time()
for deck in decks:
    try:
        res = r.play_game("A", 30, lambda obs: act_by("heuristic" if obs["seat"] == "A" else "random", obs, rng),
                          deck_a=str(deck), deck_b=str(deck))
        tag = "ERR" if res.get("error") else f"{res['winner'] or 'draw'} t{res.get('turns', '?')}"
        if res.get("error"):
            bad += 1
        print(f"{deck.name[:40]:42s} {tag}")
    except Exception as e:
        bad += 1
        print(f"{deck.name[:40]:42s} EXC {e}")
r.close()
print(f"{len(decks)} decks in {time.time()-t0:.1f}s, bad={bad}")
