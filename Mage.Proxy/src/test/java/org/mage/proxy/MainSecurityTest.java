package org.mage.proxy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MainSecurityTest {

    @TempDir
    Path tempDir;

    @Test
    void resolvesOnlyFilesInsideWebDirectory() throws IOException {
        Path web = Files.createDirectory(tempDir.resolve("web"));
        Path index = Files.write(web.resolve("index.html"), new byte[]{1, 2, 3});
        Path outside = Files.write(tempDir.resolve("outside.txt"), new byte[]{4});

        File resolved = Main.resolveWebFile(web.toString(), "/index.html");

        assertEquals(index.toFile().getCanonicalFile(), resolved);
        assertNull(Main.resolveWebFile(web.toString(), "../outside.txt"));
        assertNull(Main.resolveWebFile(web.toString(), "..\\outside.txt"));
        assertNull(Main.resolveWebFile(web.toString(), "nested/../../outside.txt"));
        assertTrue(outside.toFile().isFile());
    }

    @Test
    void detectsTraversalSegmentsBeforeResourceFallback() {
        assertTrue(Main.hasTraversalSegments("/../pom.xml"));
        assertTrue(Main.hasTraversalSegments("/nested/../pom.xml"));
        assertTrue(Main.hasTraversalSegments("..\\pom.xml"));
        assertTrue(!Main.hasTraversalSegments("/assets/app.js"));
    }

    @Test
    void theAdminTokenIsOnlyAcceptedAsABearerHeader() {
        // the query string form is gone: it landed in the access log, the browser history and
        // every proxy in between, and this endpoint is the one thing that lists the users
        assertEquals("secret", Main.stripBearer("Bearer secret"));
        assertEquals("", Main.stripBearer("secret"));
        assertEquals("", Main.stripBearer(null));
        assertEquals("", Main.stripBearer("Basic secret"));
    }

    @Test
    void onlyViteFingerprintedAssetsAreCachedForever() {
        // called with the request path, as serveFile does
        assertTrue(Main.isFingerprinted("/assets/index-SpEjMz13.js"));
        assertTrue(Main.isFingerprinted("/assets/index-CbvLKDBy.css"));
        assertTrue(Main.isFingerprinted("/assets/sounds/turn-bell-a1b2c3d4.mp3"));
        // an unpinned client or entry point must not survive a deploy
        assertTrue(!Main.isFingerprinted("/index.html"));
        assertTrue(!Main.isFingerprinted("/splash-i18n.js"));
        assertTrue(!Main.isFingerprinted("/assets/app.js"));
        assertTrue(!Main.isFingerprinted("/assets/index-toolonghash1.js"));
        // copied verbatim from web/public: overwritten on deploy, never immutable
        assertTrue(!Main.isFingerprinted("/sounds/turn-bell.mp3"));
        assertTrue(!Main.isFingerprinted("/logo-title.jpg"));
        // a bare file name has no /assets/ prefix: never immutable on that alone
        assertTrue(!Main.isFingerprinted("index-SpEjMz13.js"));
    }
}
