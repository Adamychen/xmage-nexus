import json
import subprocess

JAVA = "/opt/homebrew/opt/openjdk/bin/java"


class Runner:
    """Drives one java env worker over stdin/stdout JSONL."""

    def __init__(self, jar: str, deck: str, cwd: str, err_log: str = "worker.err.log"):
        self.err = open(f"{cwd}/{err_log}", "ab")
        self.p = subprocess.Popen(
            [JAVA, "-Xss4m", "-jar", jar, deck],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=self.err,
            cwd=cwd,
            text=True,
            bufsize=1,
        )

    def wait_ready(self, timeout: int = 300):
        """Block until the worker prints RL_READY (card DB initialized)."""
        import time
        deadline = time.time() + timeout
        while time.time() < deadline:
            line = self.p.stdout.readline()
            if not line:
                raise EOFError(f"worker died before READY (rc={self.p.poll()})")
            line = line.strip()
            if line == "RL_READY":
                return
            if line.startswith("{"):
                raise RuntimeError(f"unexpected protocol line before READY: {line[:120]}")
        raise TimeoutError("worker READY timeout")

    def new_game(self, first: str = "A", turns: int = 30, opp: str | None = None,
                 opp_type: str | None = None, deck_a: str | None = None,
                 deck_b: str | None = None):
        cmd = {"cmd": "new", "first": first, "turns": turns}
        if opp:
            cmd["opp"] = opp
            cmd["oppType"] = opp_type or "mad"
        if deck_a:
            cmd["deckA"] = deck_a
        if deck_b:
            cmd["deckB"] = deck_b
        self._write(cmd)

    def send(self, action: dict):
        self._write(action)

    def recv(self) -> dict:
        for line in self.p.stdout:
            line = line.strip()
            if line.startswith("{"):
                return json.loads(line)
        raise EOFError("worker stdout closed")

    def play_game(self, first: str, turns: int, act_fn, opp: str | None = None,
                  opp_type: str | None = None, deck_a: str | None = None,
                  deck_b: str | None = None) -> dict:
        """Run one game to completion; act_fn(obs) answers every prompt."""
        self.new_game(first=first, turns=turns, opp=opp, opp_type=opp_type,
                      deck_a=deck_a, deck_b=deck_b)
        while True:
            msg = self.recv()
            if msg.get("type") == "result":
                return msg
            self.send(act_fn(msg))

    def close(self):
        try:
            self.p.stdin.close()
        except Exception:
            pass
        try:
            self.p.wait(timeout=15)
        except Exception:
            self.p.kill()
        self.err.close()

    def _write(self, obj: dict):
        try:
            self.p.stdin.write(json.dumps(obj) + "\n")
            self.p.stdin.flush()
        except BrokenPipeError:
            pass


def start_workers(n: int, jar: str, deck: str, cwd: str, prefix: str = "worker",
                  retries: int = 3) -> list[Runner]:
    """Start n workers sequentially, waiting for each one's RL_READY.

    The H2 card db cannot be opened by many JVMs at once on first init; a JVM
    whose CardRepository <clinit> fails is poisoned for its whole lifetime.
    """
    workers = []
    for w in range(n):
        for attempt in range(retries):
            runner = Runner(jar, deck, cwd, err_log=f"{prefix}{w}.err.log")
            try:
                runner.wait_ready()
                break
            except Exception as e:
                print(f"{prefix}{w} failed to start ({e}), retry {attempt + 1}", flush=True)
                runner.close()
        else:
            raise RuntimeError(f"{prefix}{w} could not start")
        workers.append(runner)
    return workers
