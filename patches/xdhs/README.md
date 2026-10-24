# XDHS fork patches

`Mage.Proxy` is compiled from source against XMage fork artifacts. The nexus
fork (`../xmage-fork`, branch `nexus`) carries a few small patches that the
proxy source depends on. When building a second proxy flavor against the
xenohedron fork (XDHS server, tag `1.6.1-XDHS-r2`), those same patches must be
applied to that checkout before `mvn install`.

The files touched by patches `0001`/`0002` apply cleanly against
`1.6.1-XDHS-r2`.

| Patch | Source commit (fork `nexus`) | Why the proxy needs it |
| --- | --- | --- |
| `0001-matchoptions-test-mode.patch` | `40a0cda712` | `MatchOptions.setSkipInitShuffling` / `setSkipStartingPlayerChoice` (deterministic test mode). Explicit `serialVersionUID` keeps the extra fields wire-compatible with unmodified servers. |
| `0002-cheatsetup-client.patch` | `0e95f17bb9` | `SessionImpl.cheatSetup` + `MageServer`/`Testable` declarations. Against a stock XDHS server the call fails softly (the server has no such remote method). |
| `0003-custom-threadpool-shared-pool.patch` | retired | The nexus-side thread-pool leak patch. **Not applied** since `1.6.1-XDHS-r2` (it does not apply: the XDHS fork carries the upstream fix itself, `CustomThreadPool.enableIdleThreadExit`, idle threads stop after 60 s). The file lives in `retired/` so the glob `patches/xdhs/*.patch` (CI and `host-xdhs.sh`) only ever applies active patches. |

## Host install (`scripts/deploy/host-xdhs.sh`)

The host script runs the steps above and installs the `xmage-proxy-xdhs` service.

- `ALLOWED_ORIGINS` is required (the script fails without it). Set it to the exact
  origin the web page is served from, e.g. `https://example.trycloudflare.com`.
  Without the flag the proxy accepts localhost origins only, so a missing value
  would silently block every remote player. There is deliberately no default,
  because quick-tunnel hostnames change between runs.
- The XDHS jar is served from `RUN_DIR` (default `~/Escritorio/xmage-xdhs-run/`),
  not from `Mage.Proxy/target/`. `build.mjs proxy` and the beta deploy run
  `mvn clean` on `target/` and would delete it, leaving the service with
  "unable to access jarfile" on its next restart.
- The systemd unit is rewritten (and `daemon-reload`ed) whenever its content
  changes, so changing `ALLOWED_ORIGINS` or the ports takes effect on the next run.

## How to build the XDHS flavor

```bash
git clone https://github.com/xenohedron/mage ../xmage-xdhs
git -C ../xmage-xdhs checkout 1.6.1-XDHS-r2
git -C ../xmage-xdhs apply patches/xdhs/0001-matchoptions-test-mode.patch
git -C ../xmage-xdhs apply patches/xdhs/0002-cheatsetup-client.patch
mvn -q -f ../xmage-xdhs/pom.xml -pl Mage.Common,Mage,Mage.Sets,Mage.Server.Plugins/Mage.Deck.Constructed -am install -DskipTests

# Build the proxy in a throwaway copy: `clean` must not delete the nexus jar
# that lives in Mage.Proxy/target (host service and local assemble use it).
rm -rf /tmp/mage-proxy-xdhs && mkdir -p /tmp/mage-proxy-xdhs
cp Mage.Proxy/pom.xml /tmp/mage-proxy-xdhs/ && cp -R Mage.Proxy/src /tmp/mage-proxy-xdhs/src
mvn -q -f /tmp/mage-proxy-xdhs/pom.xml -Dmage.version=1.6.1 clean package -DskipTests
cp /tmp/mage-proxy-xdhs/target/mage-proxy-1.6.1.jar Mage.Proxy/target/
# -> Mage.Proxy/target/mage-proxy-1.6.1.jar (coexists with mage-proxy-1.4.62.jar)
```

The proxy needs `org.mage:mage-deck-constructed` (deck validation), which is why
the install list includes `Mage.Server.Plugins/Mage.Deck.Constructed`.

CI does the same in `.github/workflows/modules.yml` (`proxy-xdhs` job; fresh
checkout, so it can clean in place). `node scripts/build.mjs proxy` (nexus)
runs `clean` and removes the XDHS jar from `Mage.Proxy/target`; rerun the copy
build above to restore it for local launcher staging (`assemble-modules.mjs`).

## Regenerating a patch

From the nexus fork checkout:

```bash
git -C ../xmage-fork diff <commit>^ <commit> -- <paths> > patches/xdhs/<name>.patch
```

Keep each patch scoped to what the proxy build needs (client-side classes).
Server-side halves (e.g. `Mage.Server` implementations) are not needed to
compile the proxy.
