package org.mage.proxy;

import mage.interfaces.MageServer;
import mage.remote.SessionImpl;

import java.lang.reflect.Field;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Asks the XMage server whether it still answers a ping of one session. jboss' connection
 * validator reports a lost link after a 3 s ping timeout, which a server busy with dead sessions'
 * callbacks easily exceeds; logging in again on such a false alarm kicks the healthy session out
 * and leaves one more dead session whose callbacks stall the games.
 */
final class SessionProbe {

    private static final Logger logger = Logger.getLogger(SessionProbe.class.getName());

    private static final ExecutorService PROBES = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "session-probe");
        t.setDaemon(true);
        return t;
    });

    /**
     * Resolved once. The probe goes through reflection into the fork, so a field renamed there
     * would otherwise make every probe report a dead link and put every session in a permanent
     * relink loop - a self-inflicted outage with nothing in the log.
     */
    private static final Field SERVER_FIELD = findServerField();

    private SessionProbe() {
    }

    private static Field findServerField() {
        try {
            Field f = SessionImpl.class.getDeclaredField("server");
            f.setAccessible(true);
            return f;
        } catch (ReflectiveOperationException | RuntimeException ex) {
            logger.log(Level.SEVERE, "SessionImpl.server is not reachable by reflection: this proxy "
                    + "build cannot probe the server link and will keep every session until the "
                    + "server's own validator expires it. Rename the field in the fork or update "
                    + "SessionProbe.", ex);
            return null;
        }
    }

    /**
     * True when the server answered the ping of this session within the timeout; false when it
     * did not answer (the link is really down) or no longer knows the session (another login of
     * the account took it over, or it expired).
     *
     * <p>An unaskable probe - the reflection is broken, the pool rejected the task, the call was
     * interrupted - is reported as "answers", never as a lost link: a relink on a false alarm
     * kicks the healthy session out, leaves one more dead session on the server and freezes the
     * game thread, so an unknown result must not act. It is logged loudly instead.
     */
    static boolean answers(SessionImpl session, long timeoutMs) {
        if (SERVER_FIELD == null) {
            return true;
        }
        Future<Boolean> probe;
        try {
            probe = PROBES.submit(() -> ping(session));
        } catch (RuntimeException ex) {
            logger.log(Level.WARNING, "Could not run the link probe; treating the link as alive", ex);
            return true;
        }
        try {
            return Boolean.TRUE.equals(probe.get(timeoutMs, TimeUnit.MILLISECONDS));
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            probe.cancel(true);
            return true;
        } catch (TimeoutException ex) {
            // the one result that really means a lost link: the server did not answer in time
            probe.cancel(true);
            return false;
        } catch (ExecutionException ex) {
            probe.cancel(true);
            logger.log(Level.WARNING, "The link probe failed (" + ex.getCause() + "); treating the "
                    + "link as alive rather than logging in again on an unknown result", ex.getCause());
            return true;
        }
    }

    /** {@code SessionImpl.ping()} swallows every failure, so the server's ping is called directly. */
    private static boolean ping(SessionImpl session) throws Exception {
        String sessionId = session.getSessionId();
        if (sessionId == null || sessionId.isEmpty()) {
            return false;
        }
        MageServer server = (MageServer) SERVER_FIELD.get(session);
        return server != null && server.ping(sessionId, null);
    }
}
