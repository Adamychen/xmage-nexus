---
name: Bug report
about: Something broken in the web client, proxy, or stack
title: "[bug] "
labels: bug
---

## What happened

<!-- What you saw vs what you expected. One paragraph each. -->

## Repro steps

1.
2.
3.

## Environment

- Mode: <!-- web-only (fake) / full stack (real) / public server -->
- Proxy jar: <!-- e.g. mage-proxy-1.4.61.jar -->
- XMage server: <!-- local 1.4.61-V1 / beta.xmage.today -->
- Browser + OS:
- Commit/branch:

## Logs

<!-- Relevant excerpts from node scripts/tail.mjs [server|proxy|vite] all, browser console, or web/test-results/ artefacts. -->
<!-- Note: self-test WATCHGAME can flake once on a cold server start — retry warm first (see docs/testing.md). -->
```
