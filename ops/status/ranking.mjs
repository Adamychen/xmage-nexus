import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

const cfg = {
  proxyWs: env.RANK_PROXY_WS || 'ws://127.0.0.1:8787',
  xmageHost: env.RANK_XMAGE_HOST || 'beta.xmage.today',
  xmagePort: Number(env.RANK_XMAGE_PORT || 17171),
  username: env.RANK_USERNAME || 'nxrank',
  db: env.RANK_DB || path.join(here, 'data', 'ranking.db'),
  out: env.RANK_OUT || path.join(here, 'public', 'ranking.json'),
  minMatches: Number(env.RANK_MIN_MATCHES || 20),
  windowDays: Number(env.RANK_WINDOW_DAYS || 30),
  lobbyFrames: Number(env.RANK_LOBBY_FRAMES || 2),
  timeoutMs: Number(env.RANK_TIMEOUT_MS || 60000),
};

const DAY = 86400000;

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS ratings(
  user TEXT PRIMARY KEY,
  constructed INTEGER, limited INTEGER, general INTEGER,
  matches INTEGER,
  first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, samples INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS history(
  ts INTEGER NOT NULL, user TEXT NOT NULL,
  constructed INTEGER, limited INTEGER, general INTEGER, matches INTEGER,
  PRIMARY KEY(ts, user));
CREATE INDEX IF NOT EXISTS history_user ON history(user, ts);
CREATE TABLE IF NOT EXISTS runs(ts INTEGER PRIMARY KEY, users INTEGER NOT NULL, rated INTEGER NOT NULL);
`);
  return db;
}

function matchCount(u) {
  const m = String(u.matchHistory ?? '0').match(/^\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function collectUsers(node, into) {
  if (Array.isArray(node)) {
    node.forEach(n => collectUsers(n, into));
  } else if (node && typeof node === 'object') {
    if (typeof node.userName === 'string' && 'constructedRating' in node) {
      into.set(node.userName, node);
    }
    Object.values(node).forEach(v => collectUsers(v, into));
  }
}

function sampleLobby() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(cfg.proxyWs);
    const users = new Map();
    let frames = 0;
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.send(JSON.stringify({ requestId: 'bye', action: 'disconnect', args: {} })); } catch { /* socket may be closed */ }
      setTimeout(() => {
        try { ws.close(); } catch { /* already closed */ }
        if (err) reject(err); else resolve([...users.values()]);
      }, 300);
    };
    const timer = setTimeout(() => finish(new Error('lobby sample timed out')), cfg.timeoutMs);
    ws.onopen = () => ws.send(JSON.stringify({
      requestId: 'connect',
      action: 'connect',
      args: { host: cfg.xmageHost, port: cfg.xmagePort, username: cfg.username, password: '' },
    }));
    ws.onerror = () => finish(new Error('proxy websocket error'));
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.requestId === 'connect' && m.ok === false) {
        finish(new Error(`connect refused: ${m.errorCode || 'unknown'} ${m.error || ''}`.trim()));
      } else if (m.type === 'lobby') {
        frames++;
        collectUsers(m.users, users);
        if (frames >= cfg.lobbyFrames) finish();
      }
    };
  });
}

function record(db, users, now) {
  const upsert = db.prepare(`
INSERT INTO ratings(user, constructed, limited, general, matches, first_seen, last_seen, samples)
VALUES (?, ?, ?, ?, ?, ?, ?, 1)
ON CONFLICT(user) DO UPDATE SET
  constructed = excluded.constructed, limited = excluded.limited, general = excluded.general,
  matches = excluded.matches, last_seen = excluded.last_seen, samples = samples + 1`);
  const insertHistory = db.prepare(`
INSERT INTO history(ts, user, constructed, limited, general, matches) VALUES (?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    for (const u of users) {
      if (u.userName.toLowerCase() === cfg.username.toLowerCase()) continue;
      const values = [u.constructedRating ?? 0, u.limitedRating ?? 0, u.generalRating ?? 0, matchCount(u)];
      upsert.run(u.userName, ...values, now, now);
      insertHistory.run(now, u.userName, ...values);
    }
    const rated = users.filter(u => (u.constructedRating ?? 0) > 0).length;
    db.prepare('INSERT OR REPLACE INTO runs(ts, users, rated) VALUES (?, ?, ?)').run(now, users.length, rated);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function percentile(sorted, q) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

function percentiles(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9), p95: percentile(sorted, 0.95),
    p98: percentile(sorted, 0.98), p99: percentile(sorted, 0.99),
    max: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

function summarize(db, now) {
  const since = now - cfg.windowDays * DAY;
  const players = db.prepare(`
SELECT r.user, r.constructed, r.limited, r.general, r.matches, r.first_seen, r.last_seen, r.samples,
  (SELECT MAX(constructed) FROM history h WHERE h.user = r.user) AS max_constructed,
  (SELECT MAX(limited) FROM history h WHERE h.user = r.user) AS max_limited
FROM ratings r ORDER BY r.constructed DESC, r.user`).all().map(p => ({
    user: p.user,
    constructed: p.constructed,
    maxConstructed: p.max_constructed,
    limited: p.limited,
    maxLimited: p.max_limited,
    general: p.general,
    matches: p.matches,
    firstSeen: new Date(p.first_seen).toISOString(),
    lastSeen: new Date(p.last_seen).toISOString(),
    samples: p.samples,
    inPopulation: p.matches >= cfg.minMatches && p.last_seen >= since,
  }));
  const population = players.filter(p => p.inPopulation);
  const runs = db.prepare('SELECT COUNT(*) AS n, MIN(ts) AS first, MAX(ts) AS last FROM runs').get();
  return {
    generatedAt: new Date(now).toISOString(),
    windowDays: cfg.windowDays,
    minMatches: cfg.minMatches,
    coverage: {
      distinctPlayersSeen: players.length,
      samplingRuns: runs.n,
      firstRun: runs.first ? new Date(runs.first).toISOString() : null,
      lastRun: runs.last ? new Date(runs.last).toISOString() : null,
      population: population.length,
    },
    percentiles: {
      constructed: percentiles(population.filter(p => p.constructed > 0).map(p => p.constructed)),
      limited: percentiles(population.filter(p => p.limited > 0).map(p => p.limited)),
    },
    players,
  };
}

function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

async function main() {
  const db = openDb(cfg.db);
  const now = Date.now();
  const users = await sampleLobby();
  record(db, users, now);
  const summary = summarize(db, now);
  writeAtomic(cfg.out, summary);
  const rated = users.filter(u => (u.constructedRating ?? 0) > 0).length;
  log(`sampled ${users.length} users (${rated} rated); population=${summary.coverage.population}`);
  db.close();
}

main().catch((err) => {
  log('ranking sample failed:', err.message);
  process.exitCode = 1;
});
