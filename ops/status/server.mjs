import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { spawn, execFile } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;

const cfg = {
  port: Number(env.STATUS_PORT || 8790),
  bind: env.STATUS_BIND || '0.0.0.0',
  allow: parseCidrs(env.STATUS_ALLOW || '192.168.0.0/16,10.0.0.0/8,172.16.0.0/12'),
  db: env.STATUS_DB || path.join(here, 'data', 'status.db'),
  proxyUnit: env.PROXY_UNIT || 'xmage-proxy',
  playitUnit: env.PLAYIT_UNIT || 'playit',
  playitLog: env.PLAYIT_LOG || '/var/log/playit/playit.log',
  xmageHost: env.XMAGE_HOST || 'beta.xmage.today',
  xmagePort: Number(env.XMAGE_PORT || 17171),
  proxyHttp: env.PROXY_HTTP || 'http://127.0.0.1:8788/',
  journalFile: env.STATUS_JOURNAL_FILE || '',
  sampleSecs: Number(env.STATUS_SAMPLE_SECS || 30),
  retentionDays: Number(env.STATUS_SAMPLE_RETENTION_DAYS || 180),
};

const QUIET = new Set(['validateDeck', 'updatePreferences', 'getTournamentTypes', 'getPlayerTypes', 'getGameTypes',
  'getDraftCubes', 'getDeckTypes', 'getExpansionsWithBoosters', 'getTournament', 'getTournamentChatId']);
const STALE_MS = 15 * 60000;

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

function ipv4ToInt(ip) {
  const p = ip.split('.');
  if (p.length !== 4) return null;
  let n = 0;
  for (const part of p) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    n = n * 256 + Number(part);
  }
  return n;
}

function parseCidrs(s) {
  return s.split(',').map(x => x.trim()).filter(Boolean).map(c => {
    const [ip, bits = '32'] = c.split('/');
    const b = Number(bits);
    const base = ipv4ToInt(ip);
    if (base == null || !Number.isInteger(b) || b < 0 || b > 32) throw new Error(`invalid STATUS_ALLOW entry: ${c}`);
    const size = 2 ** (32 - b);
    return { from: Math.floor(base / size) * size, size, text: c };
  });
}

function clientAllowed(addr) {
  if (!addr) return false;
  const ip = addr.startsWith('::ffff:') ? addr.slice(7) : addr;
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  return cfg.allow.some(c => n >= c.from && n < c.from + c.size);
}

fs.mkdirSync(path.dirname(cfg.db), { recursive: true });
const db = new DatabaseSync(cfg.db);
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, type TEXT NOT NULL, user TEXT, ip TEXT, action TEXT, kv TEXT);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS events_type_ts ON events(type, ts);
CREATE INDEX IF NOT EXISTS events_user ON events(user);
CREATE TABLE IF NOT EXISTS lifecycle(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, kind TEXT NOT NULL, message TEXT);
CREATE INDEX IF NOT EXISTS lifecycle_ts ON lifecycle(ts);
CREATE TABLE IF NOT EXISTS problems(id INTEGER PRIMARY KEY, ts INTEGER NOT NULL, source TEXT, level TEXT, origin TEXT, message TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS problems_ts ON problems(ts);
CREATE TABLE IF NOT EXISTS concurrency(ts INTEGER NOT NULL, online INTEGER, conns INTEGER);
CREATE INDEX IF NOT EXISTS concurrency_ts ON concurrency(ts);
CREATE TABLE IF NOT EXISTS samples(ts INTEGER PRIMARY KEY, cpu REAL, mem_used INTEGER, mem_total INTEGER, disk_used INTEGER,
  disk_total INTEGER, load1 REAL, proxy_rss INTEGER, proxy_cpu REAL, xmage_ms INTEGER, web_ms INTEGER, online INTEGER, conns INTEGER);
CREATE TABLE IF NOT EXISTS visits(ts INTEGER NOT NULL, port INTEGER, peer TEXT, UNIQUE(ts, peer));
CREATE INDEX IF NOT EXISTS visits_ts ON visits(ts);
`);

const q = {
  getMeta: db.prepare('SELECT v FROM meta WHERE k = ?'),
  setMeta: db.prepare('INSERT INTO meta(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'),
  insEvent: db.prepare('INSERT INTO events(ts, type, user, ip, action, kv) VALUES(?, ?, ?, ?, ?, ?)'),
  insLife: db.prepare('INSERT INTO lifecycle(ts, kind, message) VALUES(?, ?, ?)'),
  insProblem: db.prepare('INSERT INTO problems(ts, source, level, origin, message, detail) VALUES(?, ?, ?, ?, ?, ?)'),
  setProblemDetail: db.prepare('UPDATE problems SET detail = ? WHERE id = ?'),
  insConc: db.prepare('INSERT INTO concurrency(ts, online, conns) VALUES(?, ?, ?)'),
  insSample: db.prepare(`INSERT OR REPLACE INTO samples(ts, cpu, mem_used, mem_total, disk_used, disk_total, load1, proxy_rss,
    proxy_cpu, xmage_ms, web_ms, online, conns) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
  insVisit: db.prepare('INSERT OR IGNORE INTO visits(ts, port, peer) VALUES(?, ?, ?)'),
};

const meta = {
  get: k => q.getMeta.get(k)?.v ?? null,
  set: (k, v) => q.setMeta.run(k, String(v)),
};

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function one(sql, ...params) {
  return db.prepare(sql).get(...params);
}

class Live {
  constructor() {
    this.reset(0, false);
  }

  reset(ts, running) {
    this.bootTs = ts;
    this.running = running;
    this.conns = 0;
    this.users = new Map();
  }

  visible(now = Date.now()) {
    return [...this.users.values()].filter(u => u.windows > 0 || !u.awaySince || now - u.awaySince < STALE_MS);
  }

  counts() {
    let online = 0;
    let grace = 0;
    for (const u of this.visible()) {
      if (u.windows > 0) online++;
      else grace++;
    }
    return { online, grace, conns: this.conns };
  }

  apply(ev) {
    const { ts, type, user, ip, action, kv } = ev;
    switch (type) {
      case 'ws_open':
        this.conns++;
        break;
      case 'ws_close': {
        this.conns = Math.max(0, this.conns - 1);
        const u = user && this.users.get(user);
        if (u) {
          u.windows = Math.max(0, u.windows - 1);
          if (u.windows === 0) u.awaySince = ts;
        }
        break;
      }
      case 'login_ok':
        this.users.set(user, {
          user, ip, server: kv.server || '', since: ts, windows: 1, actions: 0,
          lastAction: '', lastActionTs: 0, place: 'lobby', awaySince: 0,
        });
        break;
      case 'login_attach': {
        let u = this.users.get(user);
        if (!u) {
          u = { user, ip, server: kv.server || '', since: ts, windows: 0, actions: 0, lastAction: '', lastActionTs: 0, place: 'lobby', awaySince: 0 };
          this.users.set(user, u);
        }
        u.windows++;
        u.awaySince = 0;
        break;
      }
      case 'action': {
        const u = this.users.get(user);
        if (!u) break;
        u.actions++;
        u.lastAction = action;
        u.lastActionTs = ts;
        if (action === 'createTable' || action === 'joinTable' || action === 'createTournamentTable' || action === 'joinTournamentTable' || action === 'submitDeck') u.place = 'table';
        else if (action === 'joinGame' || action === 'joinDraft') u.place = 'playing';
        else if (action === 'watchGame' || action === 'watchTable' || action === 'watchTournamentTable') u.place = 'watching';
        else if (action === 'leaveTable' || action === 'quitMatch' || action === 'removeTable' || action === 'stopWatching') u.place = 'lobby';
        break;
      }
      case 'session_end':
        this.users.delete(user);
        break;
    }
  }
}

const live = new Live();
let lastConc = { online: -1, conns: -1 };

function recordConcurrency(ts) {
  const c = live.counts();
  if (c.online !== lastConc.online || c.conns !== lastConc.conns) {
    q.insConc.run(ts, c.online, c.conns);
    lastConc = { online: c.online, conns: c.conns };
  }
}

function rebuildLive() {
  const boot = one("SELECT ts FROM lifecycle WHERE kind = 'boot' ORDER BY ts DESC LIMIT 1");
  const stop = one("SELECT ts FROM lifecycle WHERE kind IN ('stopped', 'exited') ORDER BY ts DESC LIMIT 1");
  if (!boot) return;
  live.reset(boot.ts, !stop || stop.ts < boot.ts);
  for (const r of all('SELECT ts, type, user, ip, action, kv FROM events WHERE ts >= ? ORDER BY ts, id', boot.ts)) {
    live.apply({ ...r, kv: r.kv ? JSON.parse(r.kv) : {} });
  }
  const c = live.counts();
  lastConc = { online: c.online, conns: c.conns };
}

function parseKv(s) {
  const out = {};
  if (!s) return out;
  const re = /(\w+)=(?:"([^"]*)"|(.*?))(?=\s\w+=|$)/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
}

function isoMs(iso) {
  const t = Date.parse(iso.replace(/(\.\d{3})\d+Z$/, '$1Z'));
  return Number.isFinite(t) ? t : null;
}

const JUL_HEAD = /^\S+\s\d{1,2},\s\d{4}\s\d{1,2}:\d{2}:\d{2}(?:\s[AaPp]\.?\s?[Mm]\.?)?\s(\S+)\s(\S+)$/u;
const JUL_LINE = /^(GRAVE|SEVERE|ADVERTENCIA|WARNING|INFORMACI[ÓO]N|INFO|CONFIG|FINE|FINER|FINEST|DEPURACI[ÓO]N): (.*)$/s;
const LOG4J = /^(ERROR|WARN|INFO|DEBUG|FATAL|TRACE)\s+\d{2}:\d{2}:\d{2},\d{3} (.*?)(?:\s+\[([^\]]+)\]\s+(\S+))?$/s;
const KNOWN_SYMPTOMS = [/^Can't receive server state before other data/];
const EXCEPTION = /^(?:Caused by: )?[\w$.]+(?:Exception|Error|Throwable)\b/;
const ACTIVITY = /^\[activity\] (\S+) (\S+)(?: (.*))?$/s;

function levelOf(word) {
  const w = word.toUpperCase();
  if (w === 'GRAVE' || w === 'SEVERE' || w === 'ERROR' || w === 'FATAL') return 'error';
  if (w === 'ADVERTENCIA' || w === 'WARNING' || w === 'WARN') return 'warn';
  if (w.startsWith('INFO')) return 'info';
  return 'debug';
}

function classify(msg) {
  let m;
  if ((m = ACTIVITY.exec(msg))) return { kind: 'activity', iso: m[1], event: m[2], rest: m[3] || '' };
  if ((m = JUL_HEAD.exec(msg))) return { kind: 'head', origin: `${m[1].replace(/^org\.mage\.proxy\./, '')}.${m[2]}` };
  if ((m = JUL_LINE.exec(msg))) return { kind: 'jul', level: levelOf(m[1]), text: m[2] };
  if ((m = LOG4J.exec(msg))) return { kind: 'log4j', level: levelOf(m[1]), text: m[2], origin: m[4] || m[3] || '' };
  if (msg.startsWith('\t') || msg.startsWith('    at ') || /^\s*\.\.\. \d+ more/.test(msg)) return { kind: 'trace', text: msg };
  if (EXCEPTION.test(msg)) return { kind: 'exception', text: msg };
  if (msg.startsWith('[proxy]')) return { kind: 'proxy', text: msg.slice(7).trim() };
  return { kind: 'plain', text: msg };
}

function messageOf(e) {
  const m = e.MESSAGE;
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return Buffer.from(m).toString('utf8');
  return null;
}

const ingest = { head: null, lastProblemId: null, lastTs: 0, entries: 0, catchingUp: true, startedAt: Date.now() };

function handleEntry(e) {
  const msg = messageOf(e);
  if (msg == null) return;
  const ts = Math.floor(Number(e.__REALTIME_TIMESTAMP) / 1000);
  ingest.lastTs = ts;
  ingest.entries++;
  if (e.SYSLOG_IDENTIFIER === 'systemd' || e._PID === '1') {
    handleSystemd(ts, msg);
    return;
  }
  const c = classify(msg);
  if (c.kind !== 'exception' && c.kind !== 'trace') ingest.lastProblemId = c.kind === 'head' ? ingest.lastProblemId : null;
  switch (c.kind) {
    case 'activity': {
      const evTs = isoMs(c.iso) ?? ts;
      const kv = parseKv(c.rest);
      const user = kv.user || null;
      const ip = kv.ip || null;
      const action = c.event === 'action' ? kv.action || null : null;
      delete kv.user;
      delete kv.ip;
      if (action) delete kv.action;
      q.insEvent.run(evTs, c.event, user, ip, action, Object.keys(kv).length ? JSON.stringify(kv) : null);
      live.apply({ ts: evTs, type: c.event, user, ip, action, kv });
      recordConcurrency(evTs);
      break;
    }
    case 'proxy':
      if (c.text === 'XMage proxy started') {
        q.insLife.run(ts, 'boot', 'Proxy started');
        live.reset(ts, true);
        recordConcurrency(ts);
      }
      break;
    case 'head':
      ingest.head = { origin: c.origin, ts };
      break;
    case 'jul':
    case 'log4j': {
      const origin = c.kind === 'jul' ? ingest.head?.origin || '' : c.origin;
      if (c.kind === 'jul') ingest.head = null;
      if ((c.level === 'error' || c.level === 'warn') && !KNOWN_SYMPTOMS.some(re => re.test(c.text))) {
        const r = q.insProblem.run(ts, 'proxy', c.level, origin, c.text.slice(0, 2000), null);
        ingest.lastProblemId = Number(r.lastInsertRowid);
      }
      break;
    }
    case 'exception':
      if (ingest.lastProblemId) {
        q.setProblemDetail.run(msg.slice(0, 2000), ingest.lastProblemId);
        ingest.lastProblemId = null;
      }
      break;
  }
}

function handleSystemd(ts, msg) {
  let kind = null;
  if (/^Started /.test(msg)) kind = 'started';
  else if (/^Stopping /.test(msg)) kind = 'stopping';
  else if (/^Stopped /.test(msg)) kind = 'stopped';
  else if (/Main process exited/.test(msg)) kind = 'exited';
  else if (/Failed with result/.test(msg)) kind = 'failed';
  else if (/Scheduled restart job/.test(msg)) kind = 'restart';
  else if (/Consumed .* memory peak/.test(msg)) kind = 'consumed';
  if (!kind) return;
  q.insLife.run(ts, kind, msg.replace(/^[\w.-]+\.service: /, ''));
  if (kind === 'stopped' || kind === 'exited') {
    live.reset(ts, false);
    recordConcurrency(ts);
  }
}

let tx = { open: false, count: 0, cursor: null, timer: null };

function txAdd(entry) {
  if (!tx.open) {
    db.exec('BEGIN');
    tx.open = true;
    tx.timer = setTimeout(txCommit, 250);
  }
  try {
    handleEntry(entry);
  } catch (err) {
    log('ingest error', err.message);
  }
  if (entry.__CURSOR) tx.cursor = entry.__CURSOR;
  if (++tx.count >= 5000) txCommit();
}

function txCommit() {
  if (!tx.open) return;
  clearTimeout(tx.timer);
  if (tx.cursor) meta.set('cursor', tx.cursor);
  db.exec('COMMIT');
  tx = { open: false, count: 0, cursor: null, timer: null };
}

function startJournal() {
  if (cfg.journalFile) {
    const rl = readline.createInterface({ input: fs.createReadStream(cfg.journalFile) });
    rl.on('line', line => {
      try {
        txAdd(JSON.parse(line));
      } catch {
      }
    });
    rl.on('close', () => {
      txCommit();
      ingest.catchingUp = false;
      log('journal file ingested', ingest.entries, 'entries');
    });
    return;
  }
  const cursor = meta.get('cursor');
  const args = ['-u', cfg.proxyUnit, '-o', 'json', '--no-pager', '-f', '--no-tail',
    '--output-fields=MESSAGE,SYSLOG_IDENTIFIER,_PID'];
  if (cursor) args.push(`--after-cursor=${cursor}`);
  log('journal follow', cursor ? 'from cursor' : 'from the beginning');
  const child = spawn('journalctl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const rl = readline.createInterface({ input: child.stdout });
  let quietTimer = null;
  const armQuiet = () => {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(() => {
      if (ingest.catchingUp) log('journal caught up', ingest.entries, 'entries');
      ingest.catchingUp = false;
    }, 2000);
  };
  armQuiet();
  rl.on('line', line => {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      return;
    }
    txAdd(e);
    if (ingest.catchingUp) armQuiet();
  });
  child.stderr.on('data', d => log('journalctl:', String(d).trim()));
  child.on('exit', code => {
    txCommit();
    log('journalctl exited', code, '- restarting in 5 s');
    setTimeout(startJournal, 5000);
  });
}

const ANSI = /\x1b\[[0-9;]*m/g;
const PLAYIT_LINE = /^(\d{4}-\d{2}-\d{2}T\S+Z)\s+(\w+)\s+([\w:]+):\s?(.*)$/;
const PLAYIT_NOISE = /failed to (?:read|write) data error=Os \{ code: \d+, kind: (?:ConnectionReset|TimedOut|BrokenPipe|ConnectionAborted|UnexpectedEof)/;
const PLAYIT_CLIENT = /connect_addr: (?:\[[^\]]+\]|[\d.]+):(\d+), peer_addr: (\[[^\]]+\]|[\d.]+):\d+/;

function readPlayitFile(file) {
  try {
    const buf = fs.readFileSync(file);
    return (file.endsWith('.gz') ? zlib.gunzipSync(buf) : buf).toString('utf8');
  } catch {
    return '';
  }
}

function parsePlayit(text) {
  const out = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(ANSI, '');
    const m = PLAYIT_LINE.exec(line);
    if (!m) continue;
    const ts = isoMs(m[1]);
    if (ts == null) continue;
    out.push({ ts, level: levelOf(m[2]), module: m[3].replace(/^playit_agent_core::/, ''), text: m[4] });
  }
  return out;
}

function ingestPlayit() {
  const since = Number(meta.get('playit_ts') || 0);
  const files = [cfg.playitLog];
  if (!since) {
    for (let i = 9; i >= 1; i--) files.unshift(`${cfg.playitLog}.${i}.gz`);
  }
  let max = since;
  db.exec('BEGIN');
  try {
    for (const f of files) {
      for (const r of parsePlayit(readPlayitFile(f))) {
        if (r.ts <= since) continue;
        max = Math.max(max, r.ts);
        const m = PLAYIT_CLIENT.exec(r.text);
        if (m) q.insVisit.run(r.ts, Number(m[1]), m[2].replace(/^\[|\]$/g, ''));
        else if ((r.level === 'error' || r.level === 'warn') && !PLAYIT_NOISE.test(r.text)) q.insProblem.run(r.ts, 'playit', r.level, r.module, r.text.slice(0, 2000), null);
      }
    }
    if (max > since) meta.set('playit_ts', max);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    log('playit ingest error', err.message);
  }
}

function run(cmd, args) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout: 5000 }, (err, stdout) => resolve(err ? '' : String(stdout)));
  });
}

async function unitInfo(unit) {
  const out = await run('systemctl', ['show', unit, '--property=ActiveState,SubState,MainPID,ActiveEnterTimestamp,NRestarts,MemoryCurrent']);
  const info = {};
  for (const line of out.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) info[line.slice(0, i)] = line.slice(i + 1);
  }
  const since = info.ActiveEnterTimestamp ? Date.parse(info.ActiveEnterTimestamp.replace(/ [A-Z]{3,5}$/, '')) : NaN;
  return {
    unit,
    state: info.ActiveState || 'unknown',
    sub: info.SubState || '',
    pid: Number(info.MainPID || 0),
    since: Number.isFinite(since) ? since : null,
    restarts: Number(info.NRestarts || 0),
    memory: /^\d+$/.test(info.MemoryCurrent || '') ? Number(info.MemoryCurrent) : null,
  };
}

function tcpLatency(host, port) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const s = net.connect({ host, port, timeout: 5000 });
    const done = v => {
      s.destroy();
      resolve(v);
    };
    s.once('connect', () => done(Math.round(performance.now() - t0)));
    s.once('timeout', () => done(null));
    s.once('error', () => done(null));
  });
}

function httpLatency(url) {
  return new Promise(resolve => {
    const t0 = performance.now();
    const req = http.get(url, { timeout: 5000 }, res => {
      res.resume();
      res.on('end', () => resolve(res.statusCode && res.statusCode < 500 ? Math.round(performance.now() - t0) : null));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

let prevCpu = null;
let prevProc = null;
const host = { latest: null, proxy: null, playit: null, cpus: 1 };

async function sample() {
  const now = Date.now();
  const stat = readText('/proc/stat').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  let cpu = null;
  if (stat.length >= 4) {
    const idle = stat[3] + (stat[4] || 0);
    const total = stat.reduce((a, b) => a + b, 0);
    if (prevCpu && total > prevCpu.total) cpu = 100 * (1 - (idle - prevCpu.idle) / (total - prevCpu.total));
    prevCpu = { idle, total };
  }
  host.cpus = (readText('/proc/cpuinfo').match(/^processor\s*:/gm) || [1]).length;
  const mi = {};
  for (const line of readText('/proc/meminfo').split('\n')) {
    const m = /^(\w+):\s+(\d+)/.exec(line);
    if (m) mi[m[1]] = Number(m[2]) * 1024;
  }
  const memTotal = mi.MemTotal ?? null;
  const memUsed = memTotal != null && mi.MemAvailable != null ? memTotal - mi.MemAvailable : null;
  let diskUsed = null;
  let diskTotal = null;
  try {
    const s = fs.statfsSync('/');
    diskTotal = s.blocks * s.bsize;
    diskUsed = (s.blocks - s.bavail) * s.bsize;
  } catch {
  }
  const load = readText('/proc/loadavg').split(' ').map(Number);
  const uptime = Number(readText('/proc/uptime').split(' ')[0]) || null;
  const [proxy, playit, xmageMs, webMs] = await Promise.all([
    unitInfo(cfg.proxyUnit), unitInfo(cfg.playitUnit), tcpLatency(cfg.xmageHost, cfg.xmagePort), httpLatency(cfg.proxyHttp),
  ]);
  let proxyRss = null;
  let proxyCpu = null;
  if (proxy.pid) {
    const st = /VmRSS:\s+(\d+)/.exec(readText(`/proc/${proxy.pid}/status`));
    if (st) proxyRss = Number(st[1]) * 1024;
    const f = readText(`/proc/${proxy.pid}/stat`).split(') ')[1]?.split(' ');
    if (f) {
      const ticks = Number(f[11]) + Number(f[12]);
      if (prevProc && prevProc.pid === proxy.pid && now > prevProc.t) proxyCpu = ((ticks - prevProc.ticks) / 100) / ((now - prevProc.t) / 1000) * 100;
      prevProc = { pid: proxy.pid, ticks, t: now };
    }
  }
  const c = live.counts();
  host.proxy = proxy;
  host.playit = playit;
  host.latest = {
    ts: now, cpu, memUsed, memTotal, diskUsed, diskTotal, load1: load[0] ?? null, load5: load[1] ?? null, load15: load[2] ?? null,
    uptime, proxyRss, proxyCpu, xmageMs, webMs,
  };
  if (cpu != null) {
    q.insSample.run(now, round1(cpu), memUsed, memTotal, diskUsed, diskTotal, load[0] ?? null, proxyRss,
      proxyCpu == null ? null : round1(proxyCpu), xmageMs, webMs, c.online, c.conns);
  }
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function prune() {
  const cutoff = Date.now() - cfg.retentionDays * 86400000;
  db.prepare('DELETE FROM samples WHERE ts < ?').run(cutoff);
}

const RANGES = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };

function rangeOf(name) {
  const now = Date.now();
  if (RANGES[name]) return { name, from: now - RANGES[name], to: now, span: RANGES[name] };
  const first = one('SELECT MIN(ts) AS t FROM events')?.t ?? now - RANGES['30d'];
  const from = startOfDay(first);
  return { name: 'all', from, to: now, span: now - from };
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function bucketKey(t, hourly) {
  const d = new Date(t);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return hourly ? `${day} ${pad(d.getHours())}` : day;
}

function buckets(r) {
  const hourly = r.span <= 2 * 86400000;
  const keys = [];
  const first = one('SELECT MIN(ts) AS t FROM events')?.t;
  const d = new Date(first && first > r.from ? first : r.from);
  if (hourly) d.setMinutes(0, 0, 0);
  else d.setHours(0, 0, 0, 0);
  while (d.getTime() <= r.to) {
    keys.push({ key: bucketKey(d.getTime(), hourly), ts: d.getTime() });
    if (hourly) d.setHours(d.getHours() + 1);
    else d.setDate(d.getDate() + 1);
  }
  return { hourly, keys, fmt: hourly ? "'%Y-%m-%d %H'" : "'%Y-%m-%d'" };
}

function series(b, rows) {
  const map = new Map(rows.map(r => [r.k, r.v]));
  return b.keys.map(k => map.get(k.key) ?? 0);
}

function bucketExpr(fmt, col = 'ts') {
  return `strftime(${fmt}, ${col} / 1000, 'unixepoch', 'localtime')`;
}

function kpis(from, to) {
  const n = (sql, ...p) => one(sql, ...p)?.n ?? 0;
  const users = n("SELECT COUNT(DISTINCT user) AS n FROM events WHERE type IN ('login_ok', 'login_attach') AND ts >= ? AND ts < ?", from, to);
  const newUsers = n("SELECT COUNT(*) AS n FROM (SELECT MIN(ts) AS f FROM events WHERE type = 'login_ok' GROUP BY user) WHERE f >= ? AND f < ?", from, to);
  const logins = n("SELECT COUNT(*) AS n FROM events WHERE type = 'login_ok' AND ts >= ? AND ts < ?", from, to);
  const fails = n("SELECT COUNT(*) AS n FROM events WHERE type = 'login_fail' AND ts >= ? AND ts < ?", from, to);
  const games = n("SELECT COUNT(DISTINCT json_extract(kv, '$.gameId')) AS n FROM events WHERE action = 'joinGame' AND ts >= ? AND ts < ?", from, to);
  const tables = n(`SELECT COUNT(*) AS n FROM events WHERE action IN ('createTable', 'createTournamentTable') AND ts >= ? AND ts < ?`, from, to);
  const tournaments = n("SELECT COUNT(*) AS n FROM events WHERE action = 'createTournamentTable' AND ts >= ? AND ts < ?", from, to);
  const durations = all("SELECT CAST(json_extract(kv, '$.duration_s') AS INTEGER) AS d FROM events WHERE type = 'session_end' AND ts >= ? AND ts < ?", from, to)
    .map(r => r.d).filter(d => Number.isFinite(d)).sort((a, b) => a - b);
  const playSeconds = durations.reduce((a, b) => a + b, 0);
  const medianSession = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  const peak = n('SELECT MAX(online) AS n FROM concurrency WHERE ts >= ? AND ts < ?', from, to);
  const visitors = n('SELECT COUNT(DISTINCT peer) AS n FROM visits WHERE ts >= ? AND ts < ?', from, to);
  const loginRate = logins + fails ? Math.round(1000 * logins / (logins + fails)) / 10 : null;
  return { users, newUsers, logins, fails, loginRate, games, tables, tournaments, playSeconds, medianSession, peak, visitors };
}

function statsPayload(rangeName) {
  const r = rangeOf(rangeName);
  const b = buckets(r);
  const k = bucketExpr(b.fmt);
  const cur = kpis(r.from, r.to);
  const firstEvent = one('SELECT MIN(ts) AS t FROM events')?.t ?? r.from;
  const prev = r.name === 'all' || firstEvent >= r.from ? null : kpis(r.from - r.span, r.from);
  const active = all(`SELECT ${k} AS k, COUNT(DISTINCT user) AS v FROM events WHERE user IS NOT NULL AND type <> 'login_fail' AND ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const loginsOk = all(`SELECT ${k} AS k, COUNT(*) AS v FROM events WHERE type = 'login_ok' AND ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const loginsFail = all(`SELECT ${k} AS k, COUNT(*) AS v FROM events WHERE type = 'login_fail' AND ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const games = all(`SELECT ${k} AS k, COUNT(DISTINCT json_extract(kv, '$.gameId')) AS v FROM events WHERE action = 'joinGame' AND ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const peak = all(`SELECT ${k} AS k, MAX(online) AS v FROM concurrency WHERE ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const visitors = all(`SELECT ${k} AS k, COUNT(DISTINCT peer) AS v FROM visits WHERE ts >= ? AND ts < ? GROUP BY k`, r.from, r.to);
  const newUsers = all(`SELECT ${bucketExpr(b.fmt, 'f')} AS k, COUNT(*) AS v FROM (SELECT MIN(ts) AS f FROM events WHERE type = 'login_ok' GROUP BY user) WHERE f >= ? AND f < ? GROUP BY k`, r.from, r.to);
  const heat = all(`SELECT CAST(strftime('%w', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS dow,
      CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS hour, COUNT(DISTINCT user || '|' || strftime('%Y-%m-%d', ts / 1000, 'unixepoch', 'localtime')) AS v
    FROM events WHERE user IS NOT NULL AND type <> 'login_fail' AND ts >= ? AND ts < ? GROUP BY dow, hour`, r.from, r.to);
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const h of heat) heatmap[(h.dow + 6) % 7][h.hour] = h.v;
  const gameTypes = all(`SELECT COALESCE(json_extract(kv, '$.gameType'), '?') AS label, COUNT(*) AS v FROM events
    WHERE action IN ('createTable', 'createTournamentTable') AND ts >= ? AND ts < ? GROUP BY label ORDER BY v DESC LIMIT 10`, r.from, r.to);
  const reasons = new Map();
  for (const row of all("SELECT json_extract(kv, '$.reason') AS reason FROM events WHERE type = 'login_fail' AND ts >= ? AND ts < ?", r.from, r.to)) {
    const label = normalizeReason(row.reason || '');
    reasons.set(label, (reasons.get(label) || 0) + 1);
  }
  const failReasons = [...reasons.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v).slice(0, 8);
  const endReasons = all(`SELECT COALESCE(json_extract(kv, '$.reason'), '?') AS label, COUNT(*) AS v FROM events WHERE type = 'session_end' AND ts >= ? AND ts < ? GROUP BY label ORDER BY v DESC`, r.from, r.to);
  const actions = all(`SELECT action AS label, COUNT(*) AS v FROM events WHERE type = 'action' AND action NOT LIKE 'get%' AND ts >= ? AND ts < ? GROUP BY action ORDER BY v DESC LIMIT 12`, r.from, r.to);
  const gameOutcomes = all(`SELECT CASE WHEN json_extract(kv, '$.result') = 'unfinished'
        THEN 'unfinished:' || COALESCE(json_extract(kv, '$.reason'), '?')
        ELSE COALESCE(json_extract(kv, '$.result'), '?') END AS label, COUNT(*) AS v
    FROM events WHERE type = 'game_end' AND json_extract(kv, '$.role') = 'player' AND ts >= ? AND ts < ?
    GROUP BY label ORDER BY v DESC`, r.from, r.to);
  const ended = gameOutcomes.reduce((a, o) => a + o.v, 0);
  const finished = gameOutcomes.filter(o => ['won', 'lost', 'draw'].includes(o.label)).reduce((a, o) => a + o.v, 0);
  const finishRate = ended ? Math.round(1000 * finished / ended) / 10 : null;
  return {
    range: { name: r.name, from: r.from, to: r.to, hourly: b.hourly },
    kpis: cur,
    prev,
    buckets: b.keys.map(x => x.ts),
    series: {
      active: series(b, active),
      newUsers: series(b, newUsers),
      loginsOk: series(b, loginsOk),
      loginsFail: series(b, loginsFail),
      games: series(b, games),
      peak: series(b, peak),
      visitors: series(b, visitors),
    },
    heatmap,
    gameTypes,
    failReasons,
    endReasons,
    actions,
    gameOutcomes,
    finishRate,
  };
}

function normalizeReason(s) {
  return s.replace(/^Error while connecting to server\s*/i, '')
    .replace(/\bUser \S+ already/i, 'User already')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || '?';
}

function playersPayload(rangeName) {
  const r = rangeOf(rangeName);
  const rows = all(`SELECT e.user AS user, MIN(e.ts) AS firstInRange, MAX(e.ts) AS lastSeen,
      SUM(e.type = 'login_ok') AS sessions,
      SUM(e.type = 'login_fail') AS fails,
      SUM(CASE WHEN e.type = 'session_end' THEN CAST(json_extract(e.kv, '$.duration_s') AS INTEGER) ELSE 0 END) AS seconds,
      COUNT(DISTINCT CASE WHEN e.action = 'joinGame' THEN json_extract(e.kv, '$.gameId') END) AS games,
      SUM(e.action IN ('createTable', 'createTournamentTable')) AS tables,
      SUM(e.action IN ('watchGame', 'watchTable', 'watchTournamentTable')) AS watched,
      f.first AS firstSeen
    FROM events e LEFT JOIN (SELECT user, MIN(ts) AS first FROM events WHERE type = 'login_ok' GROUP BY user) f ON f.user = e.user
    WHERE e.user IS NOT NULL AND e.user <> '' AND e.ts >= ? AND e.ts < ?
    GROUP BY e.user HAVING SUM(e.type <> 'login_fail') > 0 ORDER BY seconds DESC, sessions DESC LIMIT 500`, r.from, r.to);
  const onlineNow = new Set([...live.users.values()].filter(u => u.windows > 0).map(u => u.user));
  return { range: { name: r.name, from: r.from, to: r.to }, players: rows.map(p => ({ ...p, online: onlineNow.has(p.user) })) };
}

function versionMismatch(target) {
  const ok = one("SELECT MAX(ts) AS ts FROM events WHERE type = 'login_ok' AND json_extract(kv, '$.server') = ?", target)?.ts ?? 0;
  const fail = one(`SELECT ts, json_extract(kv, '$.reason') AS reason FROM events
    WHERE type = 'login_fail' AND ts > ? AND json_extract(kv, '$.server') = ? AND json_extract(kv, '$.reason') LIKE '%Wrong client version%'
    ORDER BY ts ASC LIMIT 1`, ok, target);
  if (!fail) return null;
  const pick = re => re.exec(fail.reason || '')?.[1] ?? null;
  return { since: fail.ts, server: pick(/Server version:\s*([^\s<(]+)/i), proxy: pick(/Your version:\s*([^\s<(]+)/i) };
}

function livePayload() {
  const now = Date.now();
  const c = live.counts();
  const users = live.visible(now).map(u => ({
    user: u.user, server: u.server, since: u.since, windows: u.windows, actions: u.actions, lastAction: u.lastAction,
    lastActionTs: u.lastActionTs, place: u.place, awaySince: u.awaySince,
  })).sort((a, b) => (b.windows > 0) - (a.windows > 0) || a.since - b.since);
  const recent = all(`SELECT ts, type, user, action, kv FROM events
    WHERE type IN ('login_ok', 'login_fail', 'session_end', 'ws_rejected') OR (type = 'action' AND action NOT IN (${[...QUIET].map(() => '?').join(',')}))
    ORDER BY ts DESC, id DESC LIMIT 60`, ...QUIET).map(r => ({ ...r, kv: r.kv ? JSON.parse(r.kv) : {} }));
  const problems = all('SELECT id, ts, source, level, origin, message, detail FROM problems ORDER BY ts DESC LIMIT 12');
  const dayAgo = now - 86400000;
  const onlineSeries = concurrencySeries(dayAgo, now);
  const games24 = one("SELECT COUNT(DISTINCT json_extract(kv, '$.gameId')) AS n FROM events WHERE action = 'joinGame' AND ts >= ?", dayAgo)?.n ?? 0;
  const users24 = one("SELECT COUNT(DISTINCT user) AS n FROM events WHERE type IN ('login_ok', 'login_attach') AND ts >= ?", dayAgo)?.n ?? 0;
  const visitors24 = one('SELECT COUNT(DISTINCT peer) AS n FROM visits WHERE ts >= ?', dayAgo)?.n ?? 0;
  const problems24 = one('SELECT SUM(level = \'error\') AS e, SUM(level = \'warn\') AS w FROM problems WHERE ts >= ?', dayAgo);
  const peak24 = one('SELECT MAX(online) AS n FROM concurrency WHERE ts >= ?', dayAgo)?.n ?? c.online;
  const peakAll = one('SELECT MAX(online) AS n, ts FROM concurrency')?.n ?? c.online;
  return {
    now,
    proxy: { ...(host.proxy || {}), bootTs: live.bootTs, running: live.running },
    playit: host.playit,
    host: host.latest,
    cpus: host.cpus,
    xmage: { host: cfg.xmageHost, port: cfg.xmagePort, ms: host.latest?.xmageMs ?? null, mismatch: versionMismatch(`${cfg.xmageHost}:${cfg.xmagePort}`) },
    web: { url: cfg.proxyHttp, ms: host.latest?.webMs ?? null },
    counts: c,
    users,
    recent,
    problems,
    day: { games: games24, users: users24, visitors: visitors24, errors: problems24?.e ?? 0, warnings: problems24?.w ?? 0, peak: peak24 },
    peakAll,
    onlineSeries,
    ingest: { catchingUp: ingest.catchingUp, entries: ingest.entries, lastTs: ingest.lastTs },
  };
}

function concurrencySeries(from, to) {
  const before = one('SELECT online FROM concurrency WHERE ts < ? ORDER BY ts DESC LIMIT 1', from);
  const pts = all('SELECT ts, online FROM concurrency WHERE ts >= ? AND ts < ? ORDER BY ts', from, to);
  const out = [[from, before?.online ?? 0]];
  for (const p of pts) out.push([p.ts, p.online]);
  out.push([to, live.counts().online]);
  return out;
}

function systemPayload(rangeName) {
  const r = rangeOf(rangeName === 'all' ? '90d' : rangeName);
  const step = Math.max(60000, Math.ceil(r.span / 400 / 60000) * 60000);
  const samples = all(`SELECT (ts / ?) * ? AS t, AVG(cpu) AS cpu, AVG(mem_used) AS mem, MAX(mem_total) AS memTotal, AVG(proxy_rss) AS rss,
      AVG(proxy_cpu) AS pcpu, AVG(xmage_ms) AS xms, AVG(web_ms) AS wms, AVG(load1) AS load, MAX(online) AS online,
      SUM(xmage_ms IS NULL) AS xdown, SUM(web_ms IS NULL) AS wdown
    FROM samples WHERE ts >= ? AND ts < ? GROUP BY t ORDER BY t`, step, step, r.from, r.to);
  const lifecycle = all("SELECT ts, kind, message FROM lifecycle WHERE kind IN ('boot', 'stopped', 'exited', 'failed', 'restart', 'consumed') ORDER BY ts DESC LIMIT 80");
  const boots = all("SELECT ts FROM lifecycle WHERE kind = 'boot' ORDER BY ts").map(x => x.ts);
  const groups = new Map();
  for (const p of all('SELECT ts, source, level, origin, message FROM problems WHERE ts >= ? AND ts < ? ORDER BY ts DESC LIMIT 50000', r.from, r.to)) {
    const key = `${p.source}|${p.level}|${p.origin || ''}|${problemKey(p.message)}`;
    const g = groups.get(key);
    if (g) g.n++;
    else groups.set(key, { source: p.source, level: p.level, origin: p.origin || '', message: p.message, n: 1, last: p.ts });
  }
  const problemsByKey = [...groups.values()].sort((a, b) => b.n - a.n).slice(0, 20);
  let dbSize = null;
  try {
    dbSize = fs.statSync(cfg.db).size;
  } catch {
  }
  return {
    range: { name: r.name, from: r.from, to: r.to, step },
    samples,
    lifecycle,
    boots,
    problemsByKey,
    storage: {
      dbSize,
      events: one('SELECT COUNT(*) AS n FROM events')?.n ?? 0,
      since: one('SELECT MIN(ts) AS t FROM events')?.t ?? null,
      visits: one('SELECT COUNT(*) AS n FROM visits')?.n ?? 0,
      samples: one('SELECT COUNT(*) AS n FROM samples')?.n ?? 0,
    },
    allow: cfg.allow.map(c => c.text),
  };
}

function problemKey(msg) {
  return msg
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/Session: \S+/g, 'Session: <id>')
    .replace(/^(Ping failed: )\S+/, '$1<user>')
    .replace(/^(sim )\S+/, '$1<sim>')
    .replace(/\d+/g, '#')
    .slice(0, 80);
}

function journalLines(args) {
  return new Promise(resolve => {
    execFile('journalctl', ['-u', cfg.proxyUnit, '-o', 'json', '--no-pager', '--output-fields=MESSAGE,SYSLOG_IDENTIFIER,_PID', ...args],
      { maxBuffer: 64 * 1024 * 1024, timeout: 15000 }, (err, stdout) => {
        const out = [];
        for (const line of String(stdout || '').split('\n')) {
          if (!line) continue;
          try {
            out.push(JSON.parse(line));
          } catch {
          }
        }
        resolve(out);
      });
  });
}

const NOISE = [/^event >> /, /^sim sim-/, /^connectStart=/, /^connect: /, /^All WebSocket clients disconnected/, /^Grace period expired/,
  /^sim seat /, /^gameUpdate /, /^callback /];

function toRecords(entries) {
  const recs = [];
  let head = null;
  for (const e of entries) {
    const msg = messageOf(e);
    if (msg == null) continue;
    const ts = Math.floor(Number(e.__REALTIME_TIMESTAMP) / 1000);
    if (e.SYSLOG_IDENTIFIER === 'systemd' || e._PID === '1') {
      recs.push({ ts, level: 'system', kind: 'system', origin: 'systemd', text: msg.replace(/^[\w.-]+\.service: /, '') });
      continue;
    }
    const c = classify(msg);
    if (c.kind === 'head') {
      head = { origin: c.origin, ts };
      continue;
    }
    if (c.kind === 'trace' || c.kind === 'exception') {
      const last = recs[recs.length - 1];
      if (last && (last.level === 'error' || last.level === 'warn')) {
        last.extra = last.extra || [];
        if (last.extra.length < 40) last.extra.push(msg);
        continue;
      }
    }
    if (c.kind === 'jul') {
      recs.push({ ts: head?.ts ?? ts, level: c.level, kind: 'log', origin: head?.origin || '', text: c.text });
      head = null;
    } else if (c.kind === 'log4j') {
      const known = KNOWN_SYMPTOMS.some(re => re.test(c.text));
      recs.push({ ts, level: known ? 'info' : c.level, kind: 'log', origin: c.origin, text: c.text });
    } else if (c.kind === 'activity') {
      recs.push({ ts: isoMs(c.iso) ?? ts, level: c.event === 'login_fail' || c.event === 'ws_rejected' ? 'warn' : 'activity', kind: 'activity', origin: c.event, text: c.rest });
    } else {
      recs.push({ ts, level: 'info', kind: c.kind, origin: c.kind === 'proxy' ? 'proxy' : '', text: c.text });
    }
  }
  return recs;
}

function filterView(recs, view) {
  if (view === 'all') return recs;
  if (view === 'activity') return recs.filter(r => r.kind === 'activity');
  if (view === 'problems') return recs.filter(r => r.level === 'error' || r.level === 'warn' || r.level === 'system');
  return recs.filter(r => !(r.kind === 'log' && r.level === 'info' && NOISE.some(re => re.test(r.text))) && !(r.kind === 'log' && r.level === 'debug'));
}

async function logsPayload(params) {
  const source = params.get('source') === 'playit' ? 'playit' : 'proxy';
  const view = ['all', 'clean', 'activity', 'problems'].includes(params.get('view')) ? params.get('view') : 'clean';
  const search = (params.get('q') || '').slice(0, 200);
  const after = params.get('after') || '';
  const limit = 500;
  if (source === 'playit') {
    let recs = parsePlayit(readPlayitFile(cfg.playitLog)).map(r => ({ ts: r.ts, level: r.level, kind: 'playit', origin: r.module, text: r.text }));
    if (view === 'problems') recs = recs.filter(r => r.level === 'error' || r.level === 'warn');
    if (search) recs = recs.filter(r => (r.text + ' ' + r.origin).toLowerCase().includes(search.toLowerCase()));
    return { source, view, records: recs.slice(-limit), cursor: null };
  }
  if (cfg.journalFile) return { source, view, records: [], cursor: null };
  const args = [];
  if (after) args.push(`--after-cursor=${after}`, '-n', '3000');
  else args.push('-n', view === 'all' ? '800' : view === 'activity' ? '600' : '8000');
  if (view === 'activity') args.push('--grep=^\\[activity\\]');
  if (search) args.push(`--grep=${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, '--case-sensitive=no');
  const entries = await journalLines(args);
  let cursor = after || null;
  let cut = entries.length;
  while (cut > 0 && classify(messageOf(entries[cut - 1]) || '').kind === 'head') cut--;
  if (cut > 0) cursor = entries[cut - 1].__CURSOR || cursor;
  const recs = filterView(toRecords(entries.slice(0, cut)), view);
  return { source, view, records: recs.slice(-limit), cursor };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const publicDir = path.join(here, 'public');
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
};

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(body);
}

function sendJson(res, obj) {
  send(res, 200, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(publicDir, rel);
  if (!file.startsWith(publicDir + path.sep)) return send(res, 404, 'Not found', 'text/plain');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(file)] || 'application/octet-stream');
  });
}

const server = http.createServer(async (req, res) => {
  const remote = req.socket.remoteAddress;
  if (!clientAllowed(remote)) {
    log('denied', remote, req.method, req.url);
    return send(res, 403, 'Forbidden: this status page is only available on the local network.', 'text/plain; charset=utf-8');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  const url = new URL(req.url, 'http://status.local');
  try {
    switch (url.pathname) {
      case '/api/health':
        return sendJson(res, { ok: true });
      case '/api/live':
        return sendJson(res, livePayload());
      case '/api/stats':
        return sendJson(res, statsPayload(url.searchParams.get('range') || '30d'));
      case '/api/players':
        return sendJson(res, playersPayload(url.searchParams.get('range') || '30d'));
      case '/api/system':
        return sendJson(res, systemPayload(url.searchParams.get('range') || '24h'));
      case '/api/logs':
        return sendJson(res, await logsPayload(url.searchParams));
      default:
        return serveStatic(res, url.pathname);
    }
  } catch (err) {
    log('request error', url.pathname, err.stack || err.message);
    return send(res, 500, JSON.stringify({ error: err.message }), 'application/json');
  }
});

if (cfg.allow.some(c => c.from <= ipv4ToInt('127.0.0.1') && ipv4ToInt('127.0.0.1') < c.from + c.size)) {
  log('WARNING: STATUS_ALLOW includes loopback. playit tunnel clients arrive as 127.x addresses; never do this on the host.');
}

rebuildLive();
startJournal();
ingestPlayit();
setInterval(ingestPlayit, 60000);
sample().catch(err => log('sample error', err.message));
setInterval(() => sample().catch(err => log('sample error', err.message)), cfg.sampleSecs * 1000);
prune();
setInterval(prune, 6 * 3600000);

server.listen(cfg.port, cfg.bind, () => {
  log(`xmage-status listening on http://${cfg.bind}:${cfg.port} (allow: ${cfg.allow.map(c => c.text).join(', ')})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      txCommit();
      db.close();
    } catch {
    }
    process.exit(0);
  });
}
