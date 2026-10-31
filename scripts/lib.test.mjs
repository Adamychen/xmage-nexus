import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  awaitChildListening,
  cmdlineMatches,
  ensureStartable,
  isTableOwnedBy,
  lastLines,
  mageArtifactsPresent,
  parseSsOwner,
  parseStackCommand,
  procCmdline,
  ownsPid,
  quoteWinArg,
  readLastLines,
  run,
  sanitizeLineCount,
  terminateProcess,
  XMAGE_VERSION,
} from "./lib.mjs";

function fakeClock() {
  let t = 0;
  return { now: () => t, sleep: async (ms) => { t += ms; } };
}

test("ensureStartable lets a free port through without asking for an owner", async () => {
  let asked = false;
  await ensureStartable({ port: 8787, label: "proxy", probe: async () => false, owner: () => { asked = true; return 1; } });
  assert.equal(asked, false);
});

test("ensureStartable refuses a busy port and names the owning pid", async () => {
  await assert.rejects(
    ensureStartable({ port: 8787, label: "proxy", probe: async () => true, owner: () => 4242, describe: () => "java org.mage.proxy.Main" }),
    (e) => /8787/.test(e.message) && /4242/.test(e.message) && /proxy/.test(e.message),
  );
});

test("ensureStartable refuses a busy port with no visible owner", async () => {
  await assert.rejects(
    ensureStartable({ port: 17171, label: "servidor XMage", probe: async () => true, owner: () => null }),
    (e) => /17171/.test(e.message) && !/pid/.test(e.message),
  );
});

test("awaitChildListening resolves once the port answers while the child is alive", async () => {
  const clock = fakeClock();
  let probes = 0;
  await awaitChildListening({
    pid: 10, port: 8787, label: "proxy", timeoutMs: 10000,
    alive: () => true, probe: async () => ++probes >= 3, sleep: clock.sleep, now: clock.now,
  });
  assert.equal(probes, 3);
});

test("awaitChildListening fails as soon as the child is dead, even if another process answers the port", async () => {
  const clock = fakeClock();
  let probes = 0;
  await assert.rejects(
    awaitChildListening({
      pid: 10, port: 8787, label: "proxy", timeoutMs: 60000,
      alive: () => false, probe: async () => { probes++; return true; }, sleep: clock.sleep, now: clock.now,
    }),
    (e) => /exited before listening on port 8787/.test(e.message),
  );
  assert.equal(probes, 0);
  assert.equal(clock.now(), 0);
});

test("awaitChildListening times out when the child is alive but never listens", async () => {
  const clock = fakeClock();
  await assert.rejects(
    awaitChildListening({
      pid: 10, port: 5173, label: "Vite", timeoutMs: 5000,
      alive: () => true, probe: async () => false, sleep: clock.sleep, now: clock.now,
    }),
    (e) => /5173/.test(e.message),
  );
});

test("cmdlineMatches recognises each component by its main class or jar", () => {
  const server = "java --add-opens=java.base/java.io=ALL-UNNAMED -cp /x/classes mage.server.Main -testMode";
  const proxy = "java --add-opens=java.base/java.io=ALL-UNNAMED -cp /x/Mage.Proxy/target/mage-proxy-1.4.63.jar org.mage.proxy.Main --sim on";
  const vite = "node /x/web/node_modules/vite/bin/vite.js dev";
  assert.equal(cmdlineMatches("server", server), true);
  assert.equal(cmdlineMatches("proxy", proxy), true);
  assert.equal(cmdlineMatches("vite", vite), true);
  assert.equal(cmdlineMatches("server", proxy), false);
  assert.equal(cmdlineMatches("proxy", server), false);
  assert.equal(cmdlineMatches("vite", server), false);
  assert.equal(cmdlineMatches("server", "sleep 1000"), false);
  assert.equal(cmdlineMatches("server", ""), false);
  assert.equal(cmdlineMatches("unknown", server), false);
});

test("ownsPid trusts any live pid where /proc is unavailable (macOS, Windows)", () => {
  let read = false;
  assert.equal(ownsPid("server", 99, { hasProc: false, readCmdline: () => { read = true; return null; } }), true);
  assert.equal(read, false);
});

test("ownsPid treats a pid with no /proc entry or a reused pid as not ours", () => {
  assert.equal(ownsPid("server", 99, { hasProc: true, readCmdline: () => null }), false);
  assert.equal(ownsPid("server", 99, { hasProc: true, readCmdline: () => "firefox --new-window" }), false);
  assert.equal(ownsPid("server", 99, { hasProc: true, readCmdline: () => "java mage.server.Main" }), true);
});

test("procCmdline reads the NUL-separated /proc cmdline as a spaced string", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "proc-test-"));
  fs.mkdirSync(path.join(root, "77"));
  fs.writeFileSync(path.join(root, "77", "cmdline"), "java\0-cp\0a b\0mage.server.Main\0");
  assert.equal(procCmdline(77, root), "java -cp a b mage.server.Main ");
  assert.equal(procCmdline(78, root), null);
});

test("terminateProcess sends SIGTERM and does not escalate when the process exits", async () => {
  const clock = fakeClock();
  const signals = [];
  let polls = 0;
  const result = await terminateProcess(5, {
    kill: (pid, sig) => signals.push(sig),
    alive: () => ++polls <= 3,
    sleep: clock.sleep,
    now: clock.now,
    graceMs: 5000,
    pollMs: 200,
  });
  assert.equal(result, "terminated");
  assert.deepEqual(signals, ["SIGTERM"]);
});

test("terminateProcess escalates to SIGKILL only after the grace period", async () => {
  const clock = fakeClock();
  const signals = [];
  const result = await terminateProcess(5, {
    kill: (pid, sig) => signals.push(sig),
    alive: () => true,
    sleep: clock.sleep,
    now: clock.now,
    graceMs: 5000,
    pollMs: 200,
  });
  assert.equal(result, "killed");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
  assert.ok(clock.now() >= 5000);
});

test("terminateProcess reports a pid that is already gone", async () => {
  const kill = () => {
    throw Object.assign(new Error("gone"), { code: "ESRCH" });
  };
  assert.equal(await terminateProcess(5, { kill, alive: () => false }), "gone");
});

test("parseSsOwner extracts the pid from ss -ltnp output", () => {
  const line = 'LISTEN 0 4096 127.0.0.1:8787 0.0.0.0:* users:(("java",pid=4242,fd=12))';
  assert.equal(parseSsOwner(line), 4242);
  assert.equal(parseSsOwner(""), null);
});

test("parseStackCommand accepts the allowed actions and targets", () => {
  assert.deepEqual(parseStackCommand(["restart", "proxy"]), { ok: true, action: "restart", target: "proxy" });
  assert.deepEqual(parseStackCommand(["start"]), { ok: true, action: "start", target: "all" });
  assert.deepEqual(parseStackCommand(["status", "all"]), { ok: true, action: "status", target: "all" });
});

test("parseStackCommand rejects unknown actions, targets and extra arguments", () => {
  for (const argv of [[], ["foo"], ["restart", "foo"], ["restart", "proxy", "x"], ["start", "server;rm"]]) {
    const res = parseStackCommand(argv);
    assert.equal(res.ok, false, JSON.stringify(argv));
    assert.match(res.error, /start\|stop\|restart\|status/);
  }
});

test("sanitizeLineCount keeps positive integers and falls back otherwise", () => {
  assert.equal(sanitizeLineCount("40"), 40);
  assert.equal(sanitizeLineCount(7), 7);
  assert.equal(sanitizeLineCount("abc"), 100);
  assert.equal(sanitizeLineCount("0"), 100);
  assert.equal(sanitizeLineCount("-5"), 100);
  assert.equal(sanitizeLineCount(undefined), 100);
  assert.equal(sanitizeLineCount("abc", 25), 25);
});

test("lastLines returns the trailing lines of a text", () => {
  assert.equal(lastLines("a\nb\nc\n", 2), "b\nc");
  assert.equal(lastLines("a\nb", 10), "a\nb");
  assert.equal(lastLines("", 5), "");
});

test("readLastLines reads only the tail of a large file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tail-test-"));
  const file = path.join(dir, "big.log");
  const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
  fs.writeFileSync(file, lines.join("\n") + "\n");
  assert.deepEqual(readLastLines(file, 3, { windowBytes: 64 }), ["line 998", "line 999", "line 1000"]);
  assert.equal(readLastLines(file, 5000, { windowBytes: 64 }).length, 1000);
  assert.equal(readLastLines(file, 2).join("|"), "line 999|line 1000");
});

test("readLastLines handles CRLF files and an invalid count", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tail-test-"));
  const file = path.join(dir, "crlf.log");
  fs.writeFileSync(file, "one\r\ntwo\r\nthree\r\n");
  assert.deepEqual(readLastLines(file, 2, { windowBytes: 4 }), ["two", "three"]);
  assert.deepEqual(readLastLines(file, Number.NaN, { windowBytes: 4 }), ["one", "two", "three"]);
});

test("quoteWinArg leaves plain arguments alone and quotes ones with spaces", () => {
  assert.equal(quoteWinArg("plain"), "plain");
  assert.equal(quoteWinArg("C:\\Users\\Mi Carpeta\\deps.txt"), '"C:\\Users\\Mi Carpeta\\deps.txt"');
  assert.equal(quoteWinArg("a&b"), '"a&b"');
});

test("run passes arguments without a shell, so spaces and $ are not interpreted", () => {
  const res = run(process.execPath, ["-e", "process.stdout.write(process.argv[1])", "a b $HOME"], { quiet: true });
  assert.equal(res.code, 0);
  assert.equal(res.stdout, "a b $HOME");
});

test("run reports a missing executable as a failure", () => {
  const res = run("definitely-not-a-real-binary-xyz", [], { quiet: true });
  assert.notEqual(res.code, 0);
  assert.ok(res.stderr.length > 0);
});

test("isTableOwnedBy matches the owner exactly, not by name prefix", () => {
  assert.equal(isTableOwnedBy({ controllerName: "human, Bob" }, "human"), true);
  assert.equal(isTableOwnedBy({ controllerName: " human , Bob" }, "human"), true);
  assert.equal(isTableOwnedBy({ controllerName: "human-1234567, Bob" }, "human"), false);
  assert.equal(isTableOwnedBy({ controllerName: "Bob, human" }, "human"), false);
  assert.equal(isTableOwnedBy({ tableName: "human-42" }, "human"), false);
  assert.equal(isTableOwnedBy(null, "human"), false);
});

test("mageArtifactsPresent needs the deck-constructed jar the proxy depends on", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "m2-test-"));
  const dir = (id) => path.join(home, ".m2", "repository", "org", "mage", id, XMAGE_VERSION);
  const jar = (id) => path.join(dir(id), `${id}-${XMAGE_VERSION}.jar`);
  for (const id of ["mage", "mage-common", "mage-sets"]) {
    fs.mkdirSync(dir(id), { recursive: true });
    fs.writeFileSync(jar(id), "");
  }
  assert.equal(mageArtifactsPresent(home), false);
  fs.mkdirSync(dir("mage-deck-constructed"), { recursive: true });
  fs.writeFileSync(jar("mage-deck-constructed"), "");
  assert.equal(mageArtifactsPresent(home), true);
});
