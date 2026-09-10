<!-- Thank you for contributing to XMage Nexus. Fill in what applies; delete the rest. -->

## What changed

<!-- One paragraph: feature, fix, or refactor + why. Link related issues. -->

## Verification

<!-- Paste the relevant results, e.g. `vitest 158f/1261`, `typecheck clean`, `e2e fake spells 4/4`. -->

- [ ] `node scripts/test.mjs unit typecheck`
- [ ] `node scripts/test.mjs build` (only if the build changed)
- [ ] `node scripts/test.mjs java` + jar rebuilt + proxy restarted (only if proxy Java changed: `node scripts/build.mjs proxy` + `node scripts/ctl.mjs restart proxy`)
- [ ] Fake E2E (`npm --prefix web run test:e2e:fake`) for UI/game-flow changes
- [ ] Real-stack E2E or `record.mjs` regeneration for protocol/mechanic changes

## Docs & contract checklist

- [ ] No hand-edited generated files (`types.generated.ts`, `schema.generated.ts` — regenerated via `gen-types`/`gen-zod` + `:validate`)
- [ ] New UI strings added to **all 9 locales** (`web/src/i18n/`)
- [ ] `PROJECT.md` work-log row added (+ header date)
- [ ] `web/INTERACTION_COVERAGE.md` updated (handler/interaction changes)
- [ ] `web/COMPONENT_PARITY.md` / `site/content.json` updated (parity or phase changes)
- [ ] No generated/runtime files committed (`dist/`, `.run/`, `target/`, `node_modules/`)

See `CONTRIBUTING.md` and `docs/testing.md` for the full rules.
