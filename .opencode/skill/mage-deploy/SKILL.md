---
name: mage-deploy
description: Despliegue y distribución: host multi-usuario con playit.gg (bundle, start scripts, ALLOWED_ORIGINS), actualización "Model A" (host-deploy.sh), launcher Tauri (staging/, assemble-modules, components-manifest.json, latest.json, updater y firma) y variables VITE_DEFAULT_*. Keywords: deploy, despliegue, bundle, playit, túnel, host, systemd, host-deploy, launcher, tauri, updater, components-manifest, latest.json, staging, ALLOWED_ORIGINS.
---

# Despliegue

Arquitectura (modelo playit, `docs/deploy-playit.md`):

```
Browser -> playit (túnel TCP) -> Mage.Proxy (1 proceso multi-tenant)
   HTTP 8788 sirve web/dist ; WS 8787 gateway
      -> beta.xmage.today:17171   (o servidor local con el launcher)
```

Dos modos: (A) host con SOLO proxy + JRE 17 contra beta; (B) launcher Tauri que descarga
JRE+server+proxy y autoaloja (ver Fase 4 en `ROADMAP.md`).

## A) Host con playit.gg

Requisitos: máquina always-on, JRE 17, playit de PAGO para túneles TCP custom (el gratis solo
UDP + preset Minecraft) y dos artefactos: `mage-proxy-1.4.61.jar` + `web/dist`.

```bash
# En la máquina de desarrollo:
node scripts/build.mjs proxy
VITE_DEFAULT_PROXY_HOST=<ws-tunnel> VITE_DEFAULT_PROXY_PORT=<port> \
VITE_DEFAULT_SERVER_HOST=beta.xmage.today VITE_DEFAULT_SERVER_PORT=17171 \
npm --prefix web run build
node scripts/deploy-bundle.mjs          # -> deploy/bundle/ (gitignored)
# Copiar deploy/bundle/ al host como xmage-host/ y arrancar:
ALLOWED_ORIGINS="http://<web-tunnel>" XMAGE_HOST=beta.xmage.today XMAGE_PORT=17171 \
  ./start-proxy.sh                      # Windows: start-proxy.bat
```

- `scripts/deploy/start-proxy.sh|.bat`: defaults `JAR=./mage-proxy-1.4.61.jar`,
  `WEB_DIR=./web-dist`, `WS_PORT=8787`, `HTTP_PORT=8788`, `BIND=127.0.0.1`; añade los 5
  `--add-opens` y avisa si `ALLOWED_ORIGINS` está vacío.
- `ALLOWED_ORIGINS` debe ser el origen EXACTO (esquema incluido, p.ej. `http://abc.playit.gg:12345`);
  sin él el proxy solo acepta orígenes localhost.
- Autostart: unidad systemd de ejemplo en `docs/deploy-playit.md` (también Task Scheduler /
  launchd); en portátil, deshabilitar suspensión.
- Actualización "Model A": `scripts/host-deploy.sh` = `git pull --ff-only` +
  `node scripts/build.mjs` (full, requiere el fork) + `npm --prefix web install/build` +
  `ln -sfn` del jar nuevo a `~/xmage-proxy.jar` + `systemctl restart xmage-proxy`. Asume que
  `web/.env.production.local` ya existe (si no, el login no viene prerrellenado).
- Variante clon + rebuild: `git clone ... && cat > web/.env.production.local` con las 4
  `VITE_DEFAULT_*`, `node scripts/build.mjs`, `npm --prefix web run build`, symlink del jar.
- **TLS/WSS**: el web abre `ws://` fijo (`web/src/state/gateway.ts`). HTTPS requiere playit
  premium + Caddy y cambiar a `wss://` según `location.protocol`; hoy se sirve por `http://`.
- `VITE_DEFAULT_*` se hornean en el build (Vite) y se leen en `LoginScreen.tsx`/`SetupWizard.tsx`
  (defaults: `localhost`, `8787`, `localhost`, `17171`). Una conexión vieja "local" guardada en
  localStorage NO pisa un build remoto (si `REMOTE_PROXY`); `?proxyPort=` en la URL siempre gana.

## B) Launcher Tauri, módulos y updater

Piezas:

- `launcher/src` — CLI `nexus-bootstrap` (`check`/`fetch` con `--data-dir`, `--manifest FILE|URL`,
  `--target`): descarga, verifica sha256, extrae (guarda anti path-traversal), crea
  `components/<release>/{jre,server,proxy}` + `.installed`, siembra `data/server`.
- `launcher/src-tauri` — shell: `frontendDist ../../web/dist`, arranca server+proxy, espera
  `card db READY` (hasta 600 s), updater (`latest.json` + pubkey en `tauri.conf.json`), tray.
- Build: `cargo tauri dev` (necesita vite 5173); `TAURI_BUILD=1 npm --prefix web run build &&
  cargo tauri build` (usa rutas relativas por `vite.config.ts`); firmar con
  `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]`.
- Módulos: `node scripts/assemble-modules.mjs [stagingDir]` -> `staging/{server,proxy,version.json}`
  (gitignored). El JRE se empaqueta aparte con `jlink` en CI (local hoy solo hay mac-arm64).
- Manifest: `node scripts/gen-manifest.mjs --tag vX --repo Adamychen/xmage-nexus --dir <tarballs>
  --out components-manifest.json` — `COMPONENTS jre|server|proxy` x
  `TARGETS linux-x64|win-x64|mac-arm64` (NO mac-x64), con sha256 y bytes; `release` = tag sin `v`.
  **Componentes desacoplados de la app** (`release.yml` input `components_tag`, 2026-09-22): vacío o
  igual al tag → `modules.yml` compila el motor (~1 h) y los tarballs van al release nuevo; un tag
  anterior → NO se compila, se descargan los `nexus-*` de ese release con `gh release download` y el
  manifest apunta allí (`--tag <components_tag>`), así un fix del launcher no re-descarga ~200 MB.
  El launcher compara `release` contra `components/<release>/.installed`: la primera release
  desacoplada (v0.2.1) reutiliza `v0.2.0` y los usuarios actuales no bajan nada.
- Updater: `node scripts/gen-latest.mjs --tag --repo --target-key --bundle-dir --out` emite el
  fragmento por plataforma (claves `linux-x86_64`/`windows-x86_64`/`darwin-aarch64`, distintas de
  los targets del manifest). `latest.json` = `{version, notes, pub_date, platforms}` y se publica
  en `releases/latest/download/latest.json`.
- Estado (2026-09-22): el launcher compila y hay `.app`/`.dmg` en `launcher/target/release/bundle/`;
  los workflows `modules.yml`/`release.yml` fueron BORRADOS en `aa6a8de39c7` (aislamiento del fork)
  y **restaurados/adaptados el 2026-09-19** desde `git show v0.1.0:.github/workflows/<x>.yml`:
  `modules.yml` es reutilizable (`workflow_dispatch` + `workflow_call`) y checkoutea la rama `nexus`
  en `xmage-fork/` (`NEXUS_FORK_DIR`); `release.yml` lo llama desde el job `modules` (salvo cuando
  reutiliza componentes) y publica draft por tag. Falta firma Apple/Windows, JRE por SO y tests de
  primera ejecución (Phase 4 sigue pendiente). v0.2.1 preparada (2026-09-22): fix del launcher en
  Windows (`wait_log` no-UTF-8, rotación de logs, consolas ocultas, códigos `ERR_*` con la ruta de
  logs), splash con barra por fases y desacople de componentes (reutiliza `v0.2.0`). v0.2.2
  (2026-09-22): fix del proxy — `Gateway.originAllowed` rechazaba `http://tauri.localhost`
  (virtual host de WebView2 en Windows) y el launcher de Windows nunca conectaba; requiere
  `components_tag` VACÍO en este release (recompila el módulo proxy, no reutiliza v0.2.1/v0.2.0).
  v0.2.3 (2026-09-22): fix de mazos — una básica importada sin impresión (`setCode`/`cardNumber`
  vacíos, típico de listas en texto plano) pasaba la validación advisory del proxy (fallback por
  nombre, parche exclusivo del fork nexus) pero el servidor real la rechazaba con "Card not found"
  al unirse; `DeckValidation.checkCard` ahora la marca como `missing`. También toca `Mage.Proxy`
  (`DeckValidation.java`) => requiere `components_tag` VACÍO otra vez (no reutiliza v0.2.2/v0.2.1/v0.2.0).
  v0.2.4 (2026-09-24): 3-step deck import wizard (format detection, bulk printings, legality),
  EDHREC commander recommendations, opt-in smart mana payment, local match history with per-deck stats,
  visual presentation polish (recap strip, smart stops, combat/death FX, playmats, adaptive music,
  cinematic end screen), proxy activity logging, /admin/status, and Docker support.
- Dev local sin releases: `NEXUS_MANIFEST` a un manifest con URLs `file://`; overrides
  `NEXUS_DATA_DIR`, `NEXUS_TARGET`, `NEXUS_SERVER_PORT/WS_PORT/HTTP_PORT`.

## Puertos / versiones

| Qué | Valor |
| --- | --- |
| Server XMage | 17171 (testMode en dev; launcher: 127.0.0.1) |
| Proxy WS / HTTP | 8787 / 8788 |
| Vite dev / e2e fake | 5173 / 5175 |
| FakeServer WS | 8789 |
| Versión | XMage 1.4.61-V1; jar `mage-proxy-1.4.61.jar` |

## Trampas

- Versión ESTRICTA (`MageVersion.MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME`): un server de otra
  release rechaza el proxy -> skill `mage-fork-upgrade`.
- `deploy/bundle/` es gitignored y puede quedar DESACTUALIZADO (jar viejo, README copia antigua de
  `docs/deploy-playit.md`): re-ejecuta `deploy-bundle.mjs` antes de distribuir.
- El bundle NO incluye JRE, servidor, playit ni systemd: el host pone el JRE 17.
- El proxy crea su card DB en `./db` (cwd) y responde `WARMING_UP` mientras escanea; espera con
  `scripts/warmup.mjs` (`NEXUS_PROXY_WARMUP_MS`); el launcher espera `card db READY`.
- Reiniciar solo el proxy deja sesiones huérfanas: `node scripts/ctl.mjs restart all`.
- El launcher de escritorio puede ocupar 17171/8787 y dejar PIDs huérfanos en `.run/`: matarlos
  antes de los self-tests.
- **Trampa `releases/latest`**: el repo comparte releases con el fork (los `engine-*.tar.gz` del motor se publican como `engine-1.4.61-v1` en este mismo repo). El updater apunta a `releases/latest/download/latest.json`: si un release del motor queda como «latest», la URL da 404 y el launcher degrada (check falla y sigue). Al publicar un release del producto, verifica `gh release edit <tag> --latest` y que
  `curl -sL https://github.com/Adamychen/xmage-nexus/releases/latest/download/latest.json` responde JSON con las 3 plataformas (el CDN puede tardar unos minutos en soltar el 302 viejo).
- No redistribuir sin revisar licencias (JRE + motor XMage) y sin decidir el modelo de
  distribución (plan4 §10).
