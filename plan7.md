# PLAN-7 — CI remoto en verde, fork publicado y cierre de planes (2026-09-19)

> ESTADO AL CREAR: rama `master`, commit `4f837b79969` (release v0.2.0
> publicada), árbol limpio. Nace de la pregunta "¿hay algo que no tengamos en
> cuenta en los planes?".
>
> **Qué es este plan**: no añade producto. Cubre lo que ningún plan miraba:
> la suite local daba 9/9, pero el workflow `Web client CI` de GitHub estaba
> **en rojo en `master` desde el 2026-09-13**, y el fork tenía un commit sin
> publicar del que no salió la release. Además, es **la lista viva única** de
> lo que queda abierto de plan4/plan5/plan6 (§4), que se dan por cerrados.

---

## 1. Hallazgos

| # | Hallazgo | Evidencia | Causa raíz |
|---|---|---|---|
| H1 | Job `proxy` de CI no compila: `GameCommands.java:186` no encuentra `SessionImpl.cheatSetup(...)` | run `35432661849` (commit `87a7bea4b`) y todos los push desde `5cfeb6651` | `ensureMageArtifacts()` (`scripts/lib.mjs`) solo comprobaba que **existiera** `mage-1.4.61.jar` en `~/.m2`; `setup-java` con `cache: maven` restauraba artefactos `org.mage` de antes del parche P1 (`cheatSetup`) y nunca se reinstalaban desde el fork |
| H2 | 5 e2e fake fallan solo en CI (runner 3 workers, más lento) | mismo run: `best-of-5`, `gallery`, `hand-bar` ×2, `latency` (tierra) | ver §2 (uno es un bug real de producto) |
| H3 | El fork `nexus` iba 1 commit por delante de `origin/nexus` (`2fbfc7d021` END_GAME_INFO a espectadores, plan4 §3) | `git status -sb` en `../xmage-fork` | CI y `release.yml` hacen checkout de `origin/nexus` ⇒ **los módulos de la v0.2.0 salieron sin el fix** |
| H4 | Fase 3.1/4 (launcher Tauri) figuraba "pendiente" | `PROJECT.md` §2, `ROADMAP.md`, `site/content.json` | Drift: v0.1.0 (2026-09-10) y v0.2.0 (2026-09-19) publicadas con bundles firmados y updater |
| H5 | La regla de "hecho" solo exigía la suite **local** | `AGENTS.md` §Rules | Nadie miraba `gh run list` ⇒ una semana en rojo sin detectarlo |

## 2. Detalle de H2 (e2e solo-CI)

| Spec | Síntoma en CI | Causa | Arreglo |
|---|---|---|---|
| `hand-bar` "tierras del campo…" | Preview de Samwise pegado con el ratón en (8,8) (captura del artifact) | **Bug real**: si el slot con hover se re-renderiza en otro nodo bajo el puntero, el navegador no emite `mouseleave` sobre el nodo desconectado y el preview queda huérfano (la validación contra el `GameView` no lo limpia porque la carta sigue en juego) | `useBoardPresenter`: al abrir el preview se guarda el ancla (`hoverAnchorFor`, el elemento `:hover` con el mismo rect) y un `mouseover` de documento cierra el preview si el ancla se desconectó o perdió `:hover` (`hoverAnchorLost`). 3 tests unit, el primero rojo sin el fix |
| `hand-bar` "hover en la mano propia…" | El preview desaparece a mitad del sondeo | El escenario seguía moviendo tierras de la mano al campo mientras el test hacía hover | Esperar prioridad propia (`.big-action-btn` habilitado) y reintentar el hover con `toPass` |
| `latency` "jugar tierra" | Eco a 488 ms (< 720) | El helper juega tierras en paralelo; un evento suyo enviado antes del clic aterriza después y se toma por el eco | Intento contaminado (eco más rápido que el retardo artificial) ⇒ se reintenta; resto de casos: `waitEventsQuiet` antes de medir |
| `best-of-5` | Timeout de 120 s en la partida 3 (2,1 min) | 3 partidas + 2 sideboards no caben en el presupuesto por defecto en el runner | `test.setTimeout(300_000)` |
| `gallery` "todas las entradas…" | Timeout de 120 s (2,2 min) | El coste crece con la galería (160+ entradas) | Presupuesto proporcional: `max(120 s, 2 s × entradas)` |

## 3. Trabajo hecho

| WP | Qué | Estado |
|---|---|---|
| WP-1 | Sello `~/.m2/repository/org/mage/.nexus-fork-commit` + `forkCommit()`/`stampMageArtifacts()`; `ensureMageArtifacts()` reinstala si el commit del fork no coincide; `build.mjs` sella tras compilar el motor | ✅ verificado en local (detectó artefactos sin sello y reinstaló) |
| WP-2 | Arreglos de §2 | ✅ estrés local: 5 specs ×3 con 6 workers verde; suite fake completa con 6 workers 263 passed / 4 skipped |
| WP-3 | Publicar `2fbfc7d021` en `origin/nexus` (decisión del usuario 2026-09-19: se conserva aunque en beta no aplique) | ver §5 |
| WP-4 | Docs: fase 4 publicada en `PROJECT.md`/`ROADMAP.md`/`site/content.json`; regla de CI remoto en `AGENTS.md`; plan4/5/6 marcados cerrados con puntero aquí | ✅ |

## 4. Lo que sigue abierto (lista viva única)

Todo requiere personas o máquinas limpias; no es automatizable:

| # | Origen | Qué | Nota |
|---|---|---|---|
| V5 | plan5 / plan4 §5.2 | Evaluador 3 en vivo (teclado + vista del rival) | 2 de 3 hechos |
| V6 | plan5 / plan4 §5.3, §5.5, §5.6 | Prueba de 5 s, rondas con jugadores, dogfooding | — |
| V7 | plan5 / plan4 §6 | Instalación en máquinas limpias Win/macOS/Ubuntu (SmartScreen/Gatekeeper) y updater de extremo a extremo | Los bloqueantes anotados (JRE mac-arm64, firma del updater) **ya no aplican**: v0.2.0 publica `darwin-aarch64` y bundles `.sig` con `latest.json` |

## 5. Criterios de cierre

| Criterio | Estado |
|---|---|
| `Web client CI` verde en `master` (jobs `web`, `mcp`, `proxy`, `e2e-fake`) | pendiente del push |
| `origin/nexus` contiene `2fbfc7d021` | pendiente del push |
| Suite local `node scripts/test.mjs` con stack reiniciado | ✅ 9/9 (2026-09-19) |
