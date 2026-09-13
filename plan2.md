# PLAN-2 — cobertura restante + auditoría UI/UX (2026-09-13)

> ESTADO AL CREAR: `plan.md` (fases 0–4) completo y commiteado (`244a47b8e6`:
> sealed punta a punta). Este plan recoge la estela: gaps de cobertura en
> vivo, deuda diagnosticada, auditoría UX dedicada y red anti-drift.
> Repo `/Users/adam/Desktop/proyectos_git/mage_alt_client`, rama `master`.
> Mandato: **planificar primero; no ejecutar ni commitear sin pedirlo**.

## 0. Contexto heredado (no redescubrir)

- Stack: server 17171, proxy 8787 (multi-tenant, una XMage-session por cuenta),
  vite 5173. Nada de reinicios a la ligera.
- Cuentas reutilizables: `qa-ui-1345` (navegador), `qa-self-A/B`, `qa-gang-A/B`,
  `qa-mull-A/B`, `qa-vfy-A/B`, `qa-vfy-A2/B2`, `mcp-mtyu3t58`, `qa-seal-A/B`,
  `qa-beta-probe` (solo lectura en beta).
- Harness MCP con pin `session?`; sesiones nombradas por experimento.
- Scripts WS crudos en `web/.run/scratch/` (`sealed-*.mjs`, no commiteables):
  joinTournament/joinGame/submitDeck/getTournament ya resueltos ahí.
- Lecciones vigentes: respuestas raw usan campo `value` (no `uuid`);
  `sendPlayerUUID/Boolean/Integer` + `sendPlayerAction`; cerrar el WS mata la
  sesión XMage a los ~60s (mantener conexiones abiertas); `head -N` mata por
  SIGPIPE (nohup + fichero); `wait_for_prompt timeout:true` devuelve estado
  cacheado (exigir prompts frescos tras `start_match`); apagar auto-pass antes
  de declarar atacantes; mano inicial ordenada top-first con
  `skipInitShuffling`; F1 no existe en web (skips F4–F11); `watchGame` es por
  partida (sin auto-follow Bo3/torneo); `END_GAME_INFO` no llega a espectadores
  (fin de partida 100% sintético en watcher); HMR ≠ bug (recarga dura a `/`).
- Quirk engine (fork, fuera de alcance): Ballista en declare-attackers abre
  `GAME_CHOOSE_ABILITY`; shroud mapea a tipo `ABILITY_HEXPROOF`.

## A. Gaps de cobertura en vivo (por valor/coste)

1. **Booster draft con picks en web** — `sendCardPick`/`setBoosterLoaded`/
   `DraftScreen` nunca tocados en vivo (el sealed se auto-submiteó). Intentar
   2 HUMAN (+SIMs de relleno si el servidor los admite en draft) con picks
   alternos; si el mínimo de jugadores lo impide, documentar el mínimo real.
2. **Construcción sealed desde la web** — submit de 40 cartas vía UI
   (`ConstructScreen`) en torneo vivo, no auto-submit.
3. **Sideboard Bo3 desde la web** — `SideboardScreen` solo tiene tests; en vivo
   se usó WS crudo (`.run/scratch/submit-sideboard.mjs`).
4. **Staging de torneo + bracket** — `TournamentBracketModal` y staging con
   torneo vivo de 2 (Elimination basta).
5. **Visor de exilio en vivo** — solo cementerio verificado (fix singular
   `43304b87`); exiliar carta y abrir/cerrar el visor.
6. **UserActionModal humano↔humano** — ignorar/susurrar/perfil en mesa real
   (pendiente desde Fase 2B; cubierto solo por tests).
7. **Reconexión web mid-game** — matar el WS del navegador y reenganchar la
   partida (el harness MCP lo cubre; la web sin verificar).
8. **3+ jugadores (Free For All)** — render multi-oponente, turn order ring,
   targeting con varios defensores.

## B. Deuda diagnosticada (fix directo)

9. **Chat flotante tapa botones** en Mazos (z-order FloatingChat vs contenido;
   repro en plan §4). Bug UX real.
10. **Espectador sin auto-follow** (Bo3/torneo) — decisión consciente (paridad
    desktop); mejora propuesta: aviso "la partida cambió" + botón seguir, sin
    cambiar el modelo.
11. **Docs**: `COMPONENT_PARITY.md` + `site/content.json` desactualizados
    (admitido en plan §2) — sincronizar Estado/Evidencia/fecha por unidad.
12. **Harness MCP**: exponer `joinTournament`/`joinGame`/`getTournament`/
    `submitDeck` (hoy solo WS crudo) + tests + README.

## C. Auditoría UX dedicada (con método, no vistazo)

13. **Heurísticas Nielsen por pantalla** (lobby, builder, partida, torneo):
    visibilidad de estado, prevención de errores, consistencia
    (¿son descubribles F4–F11? ¿y que F1 no existe?).
14. **Teclado + lector** en partida: mano, pila, Pasar/Confirmar, diálogos
    de voto y multi-cantidad solo con teclado; foco visible y trampa de Tab.
15. **Contraste/densidad**: badges P/T, píldoras ➔ del feed, tooltips ES/EN
    con screenshots comparativos.
16. **Móvil 390px jugando** (solo se probó navegación): 3 turnos táctiles.
17. **Rendimiento**: GAME_INIT de ~180KB (sealed) — medir primer pintado;
    proponer virtualización del log si hace falta.
18. **Locales no latinos** (ja/zhs/ru/pt): strings largas, fuentes, layout.

## D. Red anti-drift

19. **E2E real nocturno** (`E2E_BACKEND=real`) en cron + regrabado de fixtures
    tras cada cambio de proxy (`record.mjs all`).
20. **Drivers recorder**: `sealed-pool` (CONSTRUCT 28KB) y `tournament-end`
    (reutilizar `sealed-*.mjs`) para cubrir torneos en fake.

## Orden propuesto y estimación gruesa

1. B (9–12): ~1 sesión — deuda pequeña y cerrada; 11+12 sin stack.
2. A.1–A.4 (draft/torneo en web): ~1 sesión — reaprovecha `qa-seal-*` y lo
   aprendido en plan §12.
3. C (13–18): ~2 sesiones — capturas ES/EN lado a lado, informe de hallazgos
   con severidad antes de ningún fix.
4. D (19–20): ~1 sesión — infra CI + fixtures.
5. A.5–A.8: ~1 sesión — colas largas.

## Criterio de cierre por ítem

- Cobertura: evidencia en vivo (mesa + turnos + screenshots) o justificación
  escrita de imposibilidad (p. ej. mínimo de jugadores del engine).
- UX: informe con hallazgo + severidad (bloqueante/mayor/nit) + captura; los
  fixes van en lote aparte con tests, como en el plan anterior.
- Docs: `PROJECT.md` (fila fechada) + este fichero (§E de sesiones) al día;
  commit solo a petición.

## E. Sesiones (bitácora; una entrada por sesión de trabajo)

- **2026-09-13 — 3 carriles en paralelo (B.9 + B.11 + B.12 + C.13) ✅**
  - *Estático (B.11)*: `web/COMPONENT_PARITY.md` + `site/content.json`
    sincronizados (+34/−12) con lo verificado en vivo (plan §§2–12); matriz
    gruesa sin cambios (correcta a ese grano). `content.json OK`.
  - *Estático (C.13)*: 8 hallazgos lobby/builder solo-lectura — 1 bloqueante
    (chat tapa contenido, = B.9), 4 mayores (footer galería confuso, borrado
    sin red, invite ambiguo, recomendación 60/100 ingenua), 3 nits.
  - *Harness (B.12)*: 7 tools torneo en MCP (`create_tournament_table`,
    `join_tournament_table`, `start_tournament`, `join_tournament`,
    `join_game`, `get_tournament`, `submit_deck`; pin `session?`, ids
    capturados por evento) + `mcp/test/tournament.test.ts` (4 herméticos) +
    README. `mcp test` 37 passed/1 skipped, typecheck ✅; verificado en vivo
    (`p2-harness-seal` 6×M20 hasta `CONSTRUCT`); lobby a 0.
  - *Navegador (B.9)*: causa raíz = reserva `margin-right:380px` solo para
    `.has-deck-builder`, no para la galería. Fix: clase `has-decks-gallery`
    en `LobbyScreen` + regla CSS (≥1100px) + `web/e2e/chat-overlap.spec.ts`
    (falla sin fix, pasa con fix). `unit` 1369/1369, typecheck ✅; screenshots
    antes/después en `.run/playwright-mcp/`.
  - Sin commits (pendiente pedir). Resto del plan 2 intacto: A.1–A.8,
    B.10, C.14–C.18, D.19–D.20.
