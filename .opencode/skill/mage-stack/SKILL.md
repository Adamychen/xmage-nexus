---
name: mage-stack
description: Use cuando arranques, reinicies, pares o diagnostiques el stack de desarrollo del Mage (servidor XMage, proxy WebSocket, Vite), cuando algo "no funciona" o haya que leer logs del stack. Keywords: ctl.mjs, dev.mjs, tail.mjs, stack, proxy, servidor, log, puerto, .run, warmup, WARMING_UP, card db, PID huérfano, restart all.
---

# Mage.Proxy — Stack de desarrollo

Guía operativa del stack local (`node` + `mvn`; multiplataforma: macOS/Linux/Windows).

## Composición y puertos

| Servicio | Qué es | Puerto |
| --- | --- | --- |
| `server` | Servidor XMage (Java, `-testMode` en dev) | 17171 |
| `proxy` | Proxy WebSocket `Mage.Proxy` (jar Java) | 8787 (WS), 8788 (HTTP test page) |
| `vite` | Dev server del cliente web | 5173 |
| e2e fake | FixtureServer + vite propio (no toca el proxy) | 8789 (WS), 5175 (HTTP) |

Arranca SIEMPRE en orden `server → proxy → vite` (dev.mjs/ctl.mjs ya lo hacen; el proxy
falla si el servidor no está).

## Comandos

- `node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]` — no
  bloquea la shell (detached); salida en `.run/ctl.out.log`.
- `node scripts/dev.mjs <mismo>` — bloquea la shell; útil para ver el arranque.
- `node scripts/tail.mjs [server|proxy|vite|all] [líneas]` — últimos logs.
- `node scripts/build.mjs [proxy]` — sin args: servidor+plugins+proxy; con `proxy`: solo
  el jar (para el proxy antes si estaba arriba). Luego `node scripts/ctl.mjs restart proxy`
  (mejor `restart all`).
- `node scripts/warmup.mjs` — espera a que el proxy termine de escanear la card DB y tripea
  los callbacks del servidor con una partida IA-vs-IA descartable (la primera partida tras
  arranque en frío puede perder el socket de retorno).
- `node scripts/install.mjs` — setup desde cero (deps + jars del servidor); no arranca nada.
- Vía MCP: `mage_stack`, `mage_logs`, `mage_build` envuelven estos scripts.

## Logs (`.run/*.log`)

- `server.out.log` — servidor XMage (timestamps UTC).
- `proxy.out.log` / `proxy.err.log` — proxy; `proxy.err.log` contiene los reenvíos de eventos
  (`event >> GAME_INIT`, `event IGNORED ...`) y los logs JUL (formato "INFORMACIÓN:", p.ej. las
  decisiones del `SimPlayer`).
- `vite.out.log` — Vite. `ctl.out.log` — salida del propio control.

Arranque en frío: el servidor tarda ~40-60 s (carga de plugins). El proxy escanea su card DB en
`Mage.Proxy/db` (~92k cartas; ~10 s en local, hasta ~15 min en CI) y responde `WARMING_UP` a cada
connect hasta que termina (`NEXUS_PROXY_WARMUP_MS`, 20 min en CI). `dev.mjs` espera los puertos
(server 60 s, proxy 30 s, vite 60 s).

## Síntomas conocidos

- **`WATCHGAME` no llega solo en la primera partida tras arranque frío del servidor**: el
  servidor falla al crear el socket de retorno de callbacks
  (`SESSION CALLBACK EXCEPTION - java.io.IOException: Unable to create socket`, `messageId: 1`).
  El `self-test` ya reintenta; si falla una vez, re-ejecutar con el servidor caliente
  (`scripts/warmup.mjs` también lo evita).
- **Primer login colgado tras reiniciar SOLO el proxy**: sesiones huérfanas en el servidor.
  Arreglo: `node scripts/ctl.mjs restart all` (nunca solo el proxy).
- **`WARMING_UP` en cada connect**: el proxy está escaneando la card DB; no es error, esperar.
- **`event IGNORED (game not active in this session)`**: normal — el proxy filtra callbacks de
  partidas no activas de la sesión.
- **`DROPPED as outdated`**: normal, descarta eventos con messageId inferior al último procesado.
- **`broadcast to 0 connections`**: normal si no hay clientes conectados.
- **`Wrong admin access`**: el cliente no es admin para `adminTableRemove`/kick.
- **Puerto ocupado al arrancar**: PID huérfano (`stopPid` en `scripts/lib.mjs`, o matar por
  puerto) o el launcher de escritorio (Tauri) ocupando 17171/8787 con PIDs fuera de `.run/`.
- **Card DB en ruta inesperada**: se crea en el cwd del proxy (`Mage.Proxy/db` en dev), NO en
  `local-server/db`.

## Regla de oro

Si un problema toca el protocolo (eventos, messageId, contratos), la fuente de verdad es el
código del servidor (subagente `xmage-contract`), no las suposiciones: greppear antes de
parchear. Para grabar/reproducir frames, skill `mage-fixtures`.
