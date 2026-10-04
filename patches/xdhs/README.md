# XDHS fork patches

`Mage.Proxy` is compiled from source against XMage fork artifacts. The nexus
fork (`../xmage-fork`, branch `nexus`) carries a few small patches that the
proxy source depends on. When building a second proxy flavor against the
xenohedron fork (XDHS server, tag `1.5.8-XDHS-r1`), those same patches must be
applied to that checkout before `mvn install`.

The files touched by these patches are byte-identical between the tag they
were generated from (`xmage_1.4.61V1`) and `1.5.8-XDHS-r1`, so `git apply`
against the XDHS checkout is clean. (The nexus branch itself moved to
`xmage_1.4.62V1`, where upstream carries its own thread-pool fix; only the
XDHS build still needs patch 0003.)

| Patch | Source commit (fork `nexus`) | Why the proxy needs it |
| --- | --- | --- |
| `0001-matchoptions-test-mode.patch` | `40a0cda712` | `MatchOptions.setSkipInitShuffling` / `setSkipStartingPlayerChoice` (deterministic test mode). Explicit `serialVersionUID` keeps the extra fields wire-compatible with unmodified servers. |
| `0002-cheatsetup-client.patch` | `0e95f17bb9` | `SessionImpl.cheatSetup` + `MageServer`/`Testable` declarations. Against a stock XDHS server the call fails softly (the server has no such remote method). |
| `0003-custom-threadpool-shared-pool.patch` | `f1179a096d` | jboss-remoting instantiates `CustomThreadPool` per connection and never releases it; the shared pool bounds the leak that degrades long-lived multi-tenant proxies. XDHS-only as of `xmage_1.4.62V1`: upstream fixed the leak (idle thread expiry) in nexus. |

## How to build the XDHS flavor

```bash
git clone https://github.com/xenohedron/mage ../xmage-xdhs
git -C ../xmage-xdhs checkout 1.5.8-XDHS-r1
for p in patches/xdhs/*.patch; do git -C ../xmage-xdhs apply "$p"; done
mvn -q -f ../xmage-xdhs/pom.xml -pl Mage.Common,Mage,Mage.Sets -am install -DskipTests

# Build the proxy in a throwaway copy: `clean` must not delete the nexus jar
# that lives in Mage.Proxy/target (host service and local assemble use it).
rm -rf /tmp/mage-proxy-xdhs && mkdir -p /tmp/mage-proxy-xdhs
cp Mage.Proxy/pom.xml /tmp/mage-proxy-xdhs/ && cp -R Mage.Proxy/src /tmp/mage-proxy-xdhs/src
mvn -q -f /tmp/mage-proxy-xdhs/pom.xml -Dmage.version=1.5.8 clean package -DskipTests
cp /tmp/mage-proxy-xdhs/target/mage-proxy-1.5.8.jar Mage.Proxy/target/
# -> Mage.Proxy/target/mage-proxy-1.5.8.jar (coexists with mage-proxy-1.4.62.jar)
```

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
