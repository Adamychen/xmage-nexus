# xmage-status — LAN-only status dashboard

A small, dependency-free Node service (Node ≥ 22.13, uses the built-in `node:sqlite`) that runs next to
`xmage-proxy` on the host machine and shows what is happening on the deployed client: players online now,
history and statistics, the proxy/playit logs, host metrics and service restarts.

It never touches the proxy: everything comes from what the host already records.

| Source | What it gives |
| --- | --- |
| `journalctl -u xmage-proxy` | `[activity]` events (logins, sessions, tables, games), JUL/log4j warnings and errors, systemd start/stop/crash lines |
| `/var/log/playit/playit.log` (+ rotated `.gz`) | one line per public TCP connection with the visitor's real IP; playit errors |
| `systemctl show`, `/proc`, `statfs` | service state, restarts, CPU, memory, disk, load, proxy RSS/CPU |
| TCP/HTTP probes | connect time to the XMage server and to the local web client |

The journal is followed from a stored cursor into `data/status.db` (SQLite, WAL). The first start indexes the
whole journal (≈160 k lines in under a second). The live player list is rebuilt by replaying the activity
events since the last proxy start, so it survives restarts of this service.

## Why "local only" needs care here

The proxy listens on `127.0.0.1` and the playit agent forwards public traffic to `127.0.0.1` too, so tunnel
visitors **look like localhost** (their activity lines show `ip=127.x.y.z`). A "localhost only" check would let
the whole internet in. This service therefore:

1. listens on its own port (`8790`) that has **no playit tunnel** (playit only forwards the ports configured in
   its dashboard: 61100 → 8788 web, 58798 → 8787 WebSocket);
2. accepts only clients whose socket address is inside `STATUS_ALLOW` (default private IPv4 ranges; the unit uses
   `192.168.1.0/24`) and **rejects loopback**, so even a tunnel pointed at 8790 by mistake gets `403`;
3. ignores `X-Forwarded-For`, serves only `GET`, and sends a strict CSP.

Never add `127.0.0.0/8` to `STATUS_ALLOW` on the host (the service logs a warning if you do).

## Configuration (environment)

| Variable | Default |
| --- | --- |
| `STATUS_PORT` / `STATUS_BIND` | `8790` / `0.0.0.0` |
| `STATUS_ALLOW` | `192.168.0.0/16,10.0.0.0/8,172.16.0.0/12` |
| `STATUS_DB` | `./data/status.db` |
| `PROXY_UNIT` / `PLAYIT_UNIT` | `xmage-proxy` / `playit` |
| `PLAYIT_LOG` | `/var/log/playit/playit.log` |
| `XMAGE_HOST` / `XMAGE_PORT` | `beta.xmage.today` / `17171` |
| `PROXY_HTTP` | `http://127.0.0.1:8788/` |
| `STATUS_SAMPLE_SECS` / `STATUS_SAMPLE_RETENTION_DAYS` | `30` / `180` |
| `STATUS_JOURNAL_FILE` | unset; a `journalctl -o json` dump to ingest instead of following the journal (development) |

The service user must be able to read the journal (group `adm` or `systemd-journal`) and the playit log
(group `playit`).

## Deploy / update

```bash
ops/status/deploy.sh                 # default host adam@192.168.1.225; asks for the sudo password once
```

It copies `server.mjs`, `public/` and the unit to `~/xmage-status/`, installs
`/etc/systemd/system/xmage-status.service` and restarts it. Updating the dashboard never restarts the proxy.
Open `http://192.168.1.225:8790/` from any machine on the LAN.

## Local development

```bash
ssh adam@192.168.1.225 'journalctl -u xmage-proxy -o json --output-fields=MESSAGE,SYSLOG_IDENTIFIER,_PID' > /tmp/journal.json
STATUS_ALLOW=127.0.0.0/8 STATUS_DB=/tmp/status.db STATUS_JOURNAL_FILE=/tmp/journal.json node ops/status/server.mjs
```

## API

`GET /api/live`, `/api/stats?range=24h|7d|30d|90d|all`, `/api/players?range=…`, `/api/system?range=24h|7d|30d|90d`,
`/api/logs?source=proxy|playit&view=clean|all|activity|problems&q=…&after=<cursor>`, `/api/health`.
