package org.mage.proxy;

import mage.interfaces.MageServer;
import mage.remote.SessionImpl;

import java.lang.reflect.Field;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

/**
 * Asks the XMage server whether it still answers a ping of one session. jboss' connection
 * validator reports a lost link after a 3 s ping timeout, which a server busy with dead sessions'
 * callbacks easily exceeds; logging in again on such a false alarm kicks the healthy session out
 * and leaves one more dead session whose callbacks stall the games.
 */
final class SessionProbe {

    private static final ExecutorService PROBES = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "session-probe");
        t.setDaemon(true);
        return t;
    });

    private SessionProbe() {
    }

    /**
     * True when the server answered the ping of this session within the timeout; false when it
     * did not answer (the link is really down) or no longer knows the session (another login of
     * the account took it over, or it expired).
     */
    static boolean answers(SessionImpl session, long timeoutMs) {
        Future<Boolean> probe = PROBES.submit(() -> ping(session));
        try {
            return Boolean.TRUE.equals(probe.get(timeoutMs, TimeUnit.MILLISECONDS));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            probe.cancel(true);
            return false;
        } catch (Exception ex) {
            probe.cancel(true);
            return false;
        }
    }

    /** {@code SessionImpl.ping()} swallows every failure, so the server's ping is called directly. */
    private static boolean ping(SessionImpl session) throws Exception {
        String sessionId = session.getSessionId();
        if (sessionId == null || sessionId.isEmpty()) {
            return false;
        }
        Field f = SessionImpl.class.getDeclaredField("server");
        f.setAccessible(true);
        MageServer server = (MageServer) f.get(session);
        return server != null && server.ping(sessionId, null);
    }
}
