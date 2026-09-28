package org.mage.proxy;

import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.concurrent.ExecutorService;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * A login that never reaches the server must not leave the proxy holding the client's threads.
 *
 * <p>Every {@link ProxyClient} spawns five non-daemon executors, two of them with a task already
 * scheduled in the constructor. The web client re-sends {@code connect} on a fresh WebSocket after
 * every failure (wrong password, a username over the server limit, the "already connected" retry
 * loop), so an unfixed proxy leaked the whole set per attempt and could no longer exit cleanly.
 */
class ProxyClientFailedLoginTest {

    /** Fails the login the way a rejected username does, without touching the network. */
    static final class FailingSession extends SessionImpl {
        FailingSession() {
            super(null);
        }

        @Override
        public boolean connectStart(mage.remote.Connection connection) {
            return false;
        }

        @Override
        public String getLastError() {
            return "User name may not be longer than 14 characters";
        }
    }

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private ProxyClient client;

    @AfterEach
    void stop() {
        if (client != null) {
            client.shutdown();
        }
    }

    private static WebSocket conn() {
        return (WebSocket) Proxy.newProxyInstance(WebSocket.class.getClassLoader(), new Class<?>[]{WebSocket.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("equals")) {
                        return proxy == args[0];
                    }
                    if (method.getName().equals("hashCode")) {
                        return System.identityHashCode(proxy);
                    }
                    return method.getReturnType() == boolean.class ? Boolean.TRUE : null;
                });
    }

    /**
     * A client that fails to log in, with the login itself stubbed out. The server's error detail
     * is pre-seeded so {@code pollDetailedMessage} returns on its first read instead of sleeping
     * through the 4.5 s it allows a delayed {@code SHOW_USERMESSAGE}.
     */
    private ProxyClient failingClient() throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        set(pc, "session", new FailingSession());
        set(pc, "lastDetailedMessage", "User name may not be longer than 14 characters");
        set(pc, "lastDetailedMessageAt", Long.MAX_VALUE);
        client = pc;
        return pc;
    }

    private static void set(ProxyClient pc, String field, Object value) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(pc, value);
    }

    private static boolean isShutdown(ProxyClient pc, String field) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        Object executor = f.get(pc);
        return executor instanceof ExecutorService && ((ExecutorService) executor).isShutdown();
    }

    /** Drives the real command path so the failed-login branch of connect() actually runs. */
    private WebSocket sendConnect(ProxyClient pc, String user) {
        WebSocket page = conn();
        pc.onClientMessage(page, "{\"requestId\":\"c\",\"action\":\"connect\",\"args\":{\"host\":\"127.0.0.1\","
                + "\"port\":1,\"username\":\"" + user + "\",\"password\":\"x\"}}");
        return page;
    }

    /**
     * Waits for the connect result the proxy answers the login with. Deliberately not keyed on
     * the client's own state: the login answering at all is what has to be true, so the suite
     * stays fast whether or not the release happens.
     */
    private void awaitConnectResult(WebSocket page) {
        long deadline = System.currentTimeMillis() + 10000;
        while (System.currentTimeMillis() < deadline) {
            if (gateway.to(page).stream().anyMatch(f -> "result".equals(f.get("type").getAsString())
                    && "connect".equals(f.get("action").getAsString()))) {
                return;
            }
            try {
                Thread.sleep(5);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        throw new AssertionError("the proxy never answered the connect");
    }

    @Test
    void aFailedLoginReleasesTheClientExecutors() throws Exception {
        ProxyClient pc = failingClient();
        awaitConnectResult(sendConnect(pc, "too-long-username"));

        assertTrue(pc.isReleased(), "a login that never reached the server released the client");
        assertTrue(isShutdown(pc, "commandExecutor"));
        assertTrue(isShutdown(pc, "callbackExecutor"));
        assertTrue(isShutdown(pc, "lobbyTimer"));
        assertTrue(isShutdown(pc, "pingTimer"));
        assertTrue(isShutdown(pc, "keepAliveTimer"));
        assertTrue(isShutdown(pc, "sequencerTimer"));
    }

    @Test
    void aFailedLoginFreesTheAccountKeyWithoutHoldingTheClient() throws Exception {
        ProxyClient pc = failingClient();
        awaitConnectResult(sendConnect(pc, "too-long-username"));

        assertTrue(pc.isDisposable(), "closing its WebSocket has nothing left to wait for");
        assertTrue(gateway.findSession("127.0.0.1|too-long-username") == null,
                "the account slot is free again, so a retry gets its own client");
    }

    @Test
    void repeatedFailedLoginsDoNotAccumulateThreads() throws Exception {
        int before = liveThreadsNamed("pool-");
        for (int i = 0; i < 25; i++) {
            ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
            set(pc, "session", new FailingSession());
            set(pc, "lastDetailedMessage", "User name may not be longer than 14 characters");
            set(pc, "lastDetailedMessageAt", Long.MAX_VALUE);
            awaitConnectResult(sendConnect(pc, "too-long-username-" + i));
        }
        // a shut-down pool lets its thread out asynchronously, so let the count settle first
        long deadline = System.currentTimeMillis() + 10000;
        int after = liveThreadsNamed("pool-");
        while (after > before && System.currentTimeMillis() < deadline) {
            try {
                Thread.sleep(20);
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
                break;
            }
            after = liveThreadsNamed("pool-");
        }
        assertTrue(after <= before, "25 failed logins left " + (after - before)
                + " extra non-daemon executor threads behind");
    }

    @Test
    void aClientThatNeverLoggedInIsDisposable() throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        client = pc;
        assertTrue(pc.isDisposable(), "no session, no relink and no grace timer: nothing to wait for");
    }

    @Test
    void aClientHoldingASessionIsNotDisposable() throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        client = pc;
        set(pc, "connected", true);
        assertFalse(pc.isDisposable(), "closing the page must still arm the grace period");
    }

    private static int liveThreadsNamed(String prefix) {
        Thread[] all = new Thread[Thread.activeCount() * 2 + 32];
        int n = Thread.enumerate(all);
        int count = 0;
        for (int i = 0; i < n; i++) {
            Thread t = all[i];
            if (t != null && t.isAlive() && t.getName().startsWith(prefix) && !t.isDaemon()) {
                count++;
            }
        }
        return count;
    }
}
