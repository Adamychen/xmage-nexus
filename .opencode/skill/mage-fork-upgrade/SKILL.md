---
name: mage-fork-upgrade
description: Subir la versión de XMage: merge del tag upstream en el fork ../xmage-fork (rama nexus) conservando los parches nexus (testMode/cheatSetup/vistas), bump de versión en poms/scripts/docs, rebuild total, re-validación de contrato (oráculos + frames) y verificación. Úsalo si el proxy falla con MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME o al integrar un release upstream nuevo. Keywords: fork, upstream, magefree, versión, merge, tag, xmage_1.4.61V1, release, rebuild, artefactos, ~/.m2, ensureMageArtifacts, XMAGE_VERSION.
---

# Subir de versión de XMage (fork)

## Cuándo

- El proxy no conecta a un servidor de otra release: `MageVersion.MAGE_VERSION_RELEASE_INFO_MUST_BE_SAME`
  = true (`../xmage-fork/Mage.Common/src/main/java/mage/utils/MageVersion.java`): el server
  rechaza el proxy por release info distinta.
- Se quiere integrar un release upstream nuevo (reglas/cartas/features).
- Tras actualizar el fork, las guardas (`mechanicsCoverage`/`engineViewCoverage`/`serverStateCoverage`)
  detectan drift: es el momento de re-validar contrato y frames.

## Piezas

- Fork en `../xmage-fork` (repo `Adamychen/xmage-nexus`, rama `nexus`); remotos `origin` (tu repo)
  y `upstream` (`magefree/mage`). `forkDir()` resuelve `NEXUS_FORK_DIR` -> `../xmage-fork`
  (`scripts/lib.mjs`).
- Parches nexus = commits propios sobre el tag base: `nexus fork state on xmage_1.4.61V1`
  (test-mode options en GameOptions/MatchOptions/TableController, campos de vista/Deck,
  The Zeta Set) + `cheatSetup` para siembra determinista (testMode). El tag upstream usado fue
  `xmage_1.4.61V1`.

## Inventario de parches nexus (qué hay que conservar en cada merge)

Un merge upstream **solo puede romper lo que tocamos**. Esta es la lista completa; si un merge trae
conflicto fuera de estos ficheros, es que upstream reescribió algo que damos por sentado y hay que
mirarlo. Actualízala al añadir o quitar un parche.

| Fichero (en `Mage.Common` salvo donde se diga) | Qué es | Cómo saber si sigue vivo |
|---|---|---|
| `Mage.Server/.../TableController.java`, `GameOptions`, `MatchOptions` | propagación de `skipInitShuffling` / `skipStartingPlayerChoice` (testMode) | `node scripts/test.mjs self-test` (arranca partidas deterministas) |
| `MageServer`, `Testable`, `SessionImpl`, `MageServerImpl`, `GameManager`, `GameController` | canal `cheatSetup` (P1, testMode) | `Mage.Proxy` tests + `mage_cheat_setup` del MCP |
| `mage/view/*`, `mage/remote/Deck` (según el fork state) | campos de vista y de mazo que el contrato serializa | `node scripts/view-schema.mjs` y `engine-view-schema.mjs` |
| **`mage/remote/CustomThreadPool.java`** | **fuga de 4 hilos por sesión**: cada instancia delega en un pool compartido (jboss-remoting nunca para el pool que crea por conexión) | `jcmd <pid> Thread.print \| grep -cE '^"ThreadPool\('` tras 2-3 scripts de `verify`: debe quedarse en 0 |
| `mage/server/.../` (commit «informar a los espectadores del fin de partida») | aviso de fin de partida a espectadores | `node scripts/test.mjs verify` (`verify-spectator-end`) |

`CustomThreadPool` es **aditivo y de un solo fichero**: si upstream arregla la fuga por su cuenta, se
revierte ese fichero y ya está; nada más del fork depende de él.
Propuesto a upstream el 2026-10-02 como PR
[magefree/mage#16439](https://github.com/magefree/mage/pull/16439) (issue #16438, variante
idle-expiry compatible con el async world; si se mergea, al rebasear el fork se puede reemplazar
la delegación por el fix upstream y borrar el parche).
- Artefactos org.mage en `~/.m2` POR VERSIÓN: `scripts/lib.mjs` (`XMAGE_VERSION`) +
  `ensureMageArtifacts()` los instala desde el fork si faltan.
- Versión replicada en: `scripts/lib.mjs` (`XMAGE_VERSION`), `Mage.Proxy/pom.xml`, nombre del jar
  (`mage-proxy-<v>.jar`), `readme.md`/`docs/`/`AGENTS.md`, `launcher/manifest.example.json` y
  `launcher/src/manifest.rs` (tests), `scripts/gen-manifest.mjs` (`--xmage` default),
  `web/fixtures/server-state-schema.json` (campo `version`) y `staging/version.json` (regenerado).

## Procedimiento

1. Fork: `cd ../xmage-fork && git fetch upstream --tags && git checkout nexus`, y merge/rebase del
   tag nuevo. Resolver conflictos conservando los parches nexus (testMode, vistas, Deck, cheatSetup).
2. Comprobar que siguen: `git log --oneline upstream/master..nexus` (deben aparecer los commits
   nexus) y que el árbol compila.
3. Bump de versión en el fork (poms) y en este repo: `scripts/lib.mjs`, `Mage.Proxy/pom.xml`,
   referencias de docs, `gen-manifest.mjs`, `launcher/manifest.example.json`/`manifest.rs` y
   `server-state-schema.json`.
4. Rebuild total: `node scripts/build.mjs` (módulos base + plugins + jar; `ensureMageArtifacts`
   instala la versión nueva). Reiniciar: `node scripts/ctl.mjs restart all`.
5. Comprobar que los parches siguen vivos, sobre todo los que no fallan ruidosamente:
   `jcmd <pid> Thread.print | grep -cE '^"ThreadPool\('` tras un par de scripts de `verify` debe
   quedar en 0 (si no, el merge revirtió `CustomThreadPool` y el proxy vuelve a filtrar 4 hilos por
   sesión, que no se nota hasta que la partida se queda sin vistas).
6. Re-validar contrato/oráculos (requiere fork): `node scripts/view-schema.mjs`,
   `node scripts/engine-view-schema.mjs` (triar y, si procede, `--update-baseline`),
   `node scripts/server-state-schema.mjs`; luego `cd web && npm run gen-types && npm run gen-zod
   && npm run gen-server-state` y sus `:validate`. Detalle en la skill `mage-contract-codegen`.
7. Anti-drift de frames: `node scripts/record.mjs all` (o por tandas) + `node scripts/record-sync.mjs`
   + `npx vitest run fixtures/recorded.test.ts` + `npx playwright test recorded.spec.ts`.
   Ver skill `mage-fixtures` y `docs/history/qa/p4-frames-log.md`.
8. Suite: `node scripts/test.mjs` (stack arriba) y E2E real (`E2E_BACKEND=real ...`); smoke directo:
   `node scripts/self-test.mjs` / `human-test.mjs`.
9. Docs: `ROADMAP.md` (estado), `AGENTS.md` (versión), `readme.md`,
   `docs/deployment.md`, `site/content.json`.

## Checklist de cierre

- `mvn -pl Mage.Proxy -am test` verde y el jar nuevo arranca contra el server local de la MISMA
  versión.
- Frames re-grabados y guardas unit en verde.
- Distribución actualizada: `node scripts/deploy-bundle.mjs` (jar renombrado), manifiestos del
  launcher y `staging/` regenerados si aplica.
- Sin referencias a la versión vieja fuera de históricos: `grep -rn "1.4.61"` en el repo.

## Trampas

- `~/.m2` cachea por versión: si el bump no llega al fork, `ensureMageArtifacts` no reinstala y el
  proxy queda mezclado (versión vieja del motor).
- El proxy usa clases org.mage por reflexión/clase: cualquier API renombrada upstream rompe en
  runtime (aunque el typecheck Java no lo vea).
- Cambios upstream en `mage.view.*`/`GameState` -> regenerar oráculos y modelar en el contrato;
  cambios en `config.xml` -> `serverStateCoverage` (gameTypes/deckTypes/cubes).
- `Utils/mtg-*.txt` y la card DB: el proxy re-escanea `./db` si cambia el build del fork
  (WARMING_UP; puede tardar minutos). En CI, `NEXUS_PROXY_WARMUP_MS` cubre el escaneo en frío.
- El fork es un repo APARTE: no mezclar cambios del cliente y del motor en un mismo commit, y no
  commitear en el fork sin pedirlo.
- "One-line pom change" es engañoso: además hay que rebuild total, re-validar guardas y re-grabar
  frames.
