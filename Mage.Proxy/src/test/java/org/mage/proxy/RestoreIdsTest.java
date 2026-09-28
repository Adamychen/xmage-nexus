package org.mage.proxy;

import mage.remote.SessionImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.function.LongSupplier;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * The account's restore id must survive the {@link ProxyClient} that first logged it in: after a
 * disposed client (failed login, reload, proxy restart within the process) the next login
 * presents it and the server hands the old session over instead of refusing with
 * "already connected or your IP address changed".
 */
class RestoreIdsTest {

    /** A session whose id is known without touching the network. */
    static final class StubSession extends SessionImpl {
        private final String id;

        StubSession(String id) {
            super(null);
            this.id = id;
        }

        @Override
        public String getSessionId() {
            return id;
        }
    }

    private final ProxyClientStreamTest.RecordingGateway gateway =
            new ProxyClientStreamTest.RecordingGateway();
    private ProxyClient client;

    @AfterEach
    void stop() throws Exception {
        RestoreIds.clearAll();
        // persistence is opt-in: leave the static store in memory-only mode for the other tests
        RestoreIds.configure(Config.parse(new String[]{"--restoreIds", "none"}));
        setStatic("clock", (LongSupplier) System::currentTimeMillis);
        if (client != null) {
            client.shutdown();
        }
    }

    private static void set(ProxyClient pc, String field, Object value) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(pc, value);
    }

    private static void setStatic(String field, Object value) throws Exception {
        Field f = RestoreIds.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(null, value);
    }

    @Test
    void aRememberedSessionIdIsPresentedByTheNextClient() throws Exception {
        ProxyClient first = new ProxyClient(gateway.getConfig(), gateway);
        client = first;
        set(first, "session", new StubSession("session-1"));
        first.rememberLiveSession("127.0.0.1", "u1");
        assertEquals("session-1", RestoreIds.get("127.0.0.1", "u1"));

        // a brand-new client (the previous one was disposed) has no lastSessionId of its own
        ProxyClient retry = new ProxyClient(gateway.getConfig(), gateway);
        try {
            assertEquals("session-1", retry.restoreIdFor("127.0.0.1", 17171, "u1"));
            assertEquals("", retry.restoreIdFor("127.0.0.1", 17171, "other"));
        } finally {
            retry.shutdown();
        }
    }

    @Test
    void theLiveSessionOfTheSameClientWinsOverTheStoredId() throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        client = pc;
        RestoreIds.put("127.0.0.1", "u1", "older");
        set(pc, "lastSessionId", "live");
        mage.remote.Connection conn = new mage.remote.Connection();
        conn.setHost("127.0.0.1");
        conn.setPort(17171);
        conn.setUsername("u1");
        set(pc, "lastConnection", conn);

        assertEquals("live", pc.restoreIdFor("127.0.0.1", 17171, "u1"));
        assertEquals("older", pc.restoreIdFor("127.0.0.1", 17172, "u1"),
                "another port is not the same session, so the stored id is the one presented");
    }

    @Test
    void anExplicitLogoutDropsTheTicket() {
        RestoreIds.put("127.0.0.1", "u1", "session-1");
        RestoreIds.clear("127.0.0.1", "u1");
        assertEquals("", RestoreIds.get("127.0.0.1", "u1"));
    }

    @Test
    void idsSurviveAProxyRestart(@TempDir Path dir) {
        File file = dir.resolve("restore.json").toFile();
        Config cfg = Config.parse(new String[]{"--restoreIds", file.getPath()});
        RestoreIds.configure(cfg);
        RestoreIds.put("127.0.0.1", "u1", "s1");

        RestoreIds.clearAll();      // the process restarts: memory is gone, the file stays
        RestoreIds.configure(cfg);  // the new process reads it back

        assertEquals("s1", RestoreIds.get("127.0.0.1", "u1"));
    }

    @Test
    void idsOlderThanTheServerSessionAreNotResurrected(@TempDir Path dir) throws Exception {
        File file = dir.resolve("restore.json").toFile();
        Config cfg = Config.parse(new String[]{"--restoreIds", file.getPath()});
        setStatic("clock", (LongSupplier) () -> 0L);
        RestoreIds.configure(cfg);
        RestoreIds.put("127.0.0.1", "u1", "s1");

        RestoreIds.clearAll();
        setStatic("clock", (LongSupplier) () -> RestoreIds.MAX_AGE_MS + 1);
        RestoreIds.configure(cfg);

        assertEquals("", RestoreIds.get("127.0.0.1", "u1"));
    }

    @Test
    void theStoreIsBounded() {
        for (int i = 0; i <= RestoreIds.MAX_ACCOUNTS; i++) {
            RestoreIds.put("127.0.0.1", "u" + i, "s" + i);
        }
        assertEquals("", RestoreIds.get("127.0.0.1", "u0"), "the eldest account was evicted");
        assertEquals("s" + RestoreIds.MAX_ACCOUNTS,
                RestoreIds.get("127.0.0.1", "u" + RestoreIds.MAX_ACCOUNTS));
    }
}
