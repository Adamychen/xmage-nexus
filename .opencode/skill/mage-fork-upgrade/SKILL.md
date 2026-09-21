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
5. Re-validar contrato/oráculos (requiere fork): `node scripts/view-schema.mjs`,
   `node scripts/engine-view-schema.mjs` (triar y, si procede, `--update-baseline`),
   `node scripts/server-state-schema.mjs`; luego `cd web && npm run gen-types && npm run gen-zod
   && npm run gen-server-state` y sus `:validate`. Detalle en la skill `mage-contract-codegen`.
6. Anti-drift de frames: `node scripts/record.mjs all` (o por tandas) + `node scripts/record-sync.mjs`
   + `npx vitest run fixtures/recorded.test.ts` + `npx playwright test recorded.spec.ts`.
   Ver skill `mage-fixtures` y `docs/history/qa/p4-frames-log.md`.
7. Suite: `node scripts/test.mjs` (stack arriba) y E2E real (`E2E_BACKEND=real ...`); smoke directo:
   `node scripts/self-test.mjs` / `human-test.mjs`.
8. Docs: `PROJECT.md` (log + fecha + estado), `AGENTS.md` (versión), `readme.md`,
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
