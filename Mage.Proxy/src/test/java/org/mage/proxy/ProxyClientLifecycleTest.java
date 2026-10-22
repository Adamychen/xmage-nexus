package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.remote.Connection;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Lifecycle and concurrency of one client: logins that block, queued commands, relinks, diagnostics. */
class ProxyClientLifecycleTest {

    /** A login (or relink) that waits for the test to open the gate before it answers {@code ok}. */
    static final class GatedSession extends SessionImpl {
        final CountDownLatch entered = new CountDownLatch(1);
        final CountDownLatch gate = new CountDownLatch(1);
        final AtomicInteger starts = new AtomicInteger();
        final AtomicInteger stops = new AtomicInteger();
        final boolean ok;

        GatedSession(boolean ok) {
            super(null);
            this.ok = ok;
        }

        @Override
        public boolean connectStart(Connection connection) {
            starts.incrementAndGet();
            entered.countDown();
            try {
                gate.await();
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            }
            return ok;
        }

        @Override
        public synchronized void connectStop(boolean askForReconnect, boolean keepMySessionActive) {
            stops.incrementAndGet();
        }

        @Override
        public String getLastError() {
            return "User name may not be longer than 14 characters";
        }
    }

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private final List<ProxyClient> clients = new ArrayList<>();
    private AtomicReference<DeckValidation.State> state;
    private DeckValidation.State before;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void cardDataReady() throws Exception {
        Field f = DeckValidation.class.getDeclaredField("STATE");
        f.setAccessible(true);
        state = (AtomicReference<DeckValidation.State>) f.get(null);
        before = state.get();
        state.set(DeckValidation.State.FAILED);
    }

    @AfterEach
    void stop() {
        state.set(before);
        for (ProxyClient pc : clients) {
            pc.shutdown();
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

    private static String connect(String user) {
        return "{\"requestId\":\"c\",\"action\":\"connect\",\"args\":{\"host\":\"127.0.0.1\",\"port\":17171,"
                + "\"username\":\"" + user + "\",\"password\":\"x\"}}";
    }

    private ProxyClient client(GatedSession session) throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        clients.add(pc);
        set(pc, "session", session);
        Field f = ProxyClient.class.getDeclaredField("serverMessages");
        f.setAccessible(true);
        ((ServerMessageMailbox) f.get(pc)).capture("User name may not be longer than 14 characters", Long.MAX_VALUE);
        return pc;
    }

    private static void set(Object target, String field, Object value) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(target, value);
    }

    private static Object get(ProxyClient pc, String field) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        return f.get(pc);
    }

    /** Whether a result of {@code action} reached {@code page} within a few seconds. */
    private boolean awaitResult(WebSocket page, String action, long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        do {
            boolean found = gateway.to(page).stream().anyMatch((JsonObject f) -> "result".equals(f.get("type").getAsString())
                    && action.equals(f.get("action").getAsString()));
            if (found) {
                return true;
            }
            Thread.sleep(5);
        } while (System.currentTimeMillis() < deadline);
        return false;
    }

    /** A selector-style close must come back at once even while a login holds the client. */
    static final class LoginGateway extends ProxyClientStreamTest.RecordingGateway {
        final GatedSession session;

        LoginGateway(GatedSession session) {
            this.session = session;
        }

        @Override
        ProxyClient newClient() {
            try {
                ProxyClient pc = new ProxyClient(getConfig(), this);
                set(pc, "session", session);
                Field f = ProxyClient.class.getDeclaredField("serverMessages");
                f.setAccessible(true);
                ((ServerMessageMailbox) f.get(pc)).capture("User name may not be longer than 14 characters", Long.MAX_VALUE);
                return pc;
            } catch (Exception ex) {
                throw new IllegalStateException(ex);
            }
        }
    }

    @Test
    void closingThePageOfALoginInProgressReturnsAtOnce() throws Exception {
        GatedSession session = new GatedSession(false);
        LoginGateway gateway = new LoginGateway(session);
        WebSocket page = conn();
        try {
            gateway.onMessage(page, connect("alice"));
            assertTrue(session.entered.await(5, TimeUnit.SECONDS), "the login reached the server");
            ProxyClient pc = gateway.findSession(ProxyClient.sessionKey("127.0.0.1", 17171, "alice"));
            assertNotNull(pc);

            Thread closer = new Thread(() -> gateway.onClose(page, 1001, "reload", true));
            closer.start();
            closer.join(1000);
            assertFalse(closer.isAlive(), "the selector thread was held by the login: onClose did not return within 1 s");
            assertFalse(pc.isReleased(), "the page closing during its own login does not release the login");
        } finally {
            session.gate.countDown();
        }
    }

    @Test
    void aCommandQueuedBehindAFailingLoginGetsAnAnswer() throws Exception {
        GatedSession session = new GatedSession(false);
        ProxyClient pc = client(session);
        WebSocket first = conn();
        WebSocket second = conn();
        pc.onClientMessage(first, connect("alice"));
        assertTrue(session.entered.await(5, TimeUnit.SECONDS));
        pc.onClientMessage(second, connect("alice"));
        session.gate.countDown();
        assertTrue(awaitResult(second, "connect", 10_000), "the connect queued behind the failed login was answered");
    }

    @Test
    void logoutDuringAnInFlightRelinkStopsTheRelink() throws Exception {
        GatedSession session = new GatedSession(false);
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway) {
            @Override
            boolean sessionAnswers(long timeoutMs) {
                return false;
            }
        };
        clients.add(pc);
        set(pc, "session", session);
        Connection c = new Connection();
        c.setHost("127.0.0.1");
        c.setPort(17171);
        c.setUsername("alice");
        set(pc, "lastConnection", c);
        set(pc, "connected", true);
        WebSocket page = conn();
        pc.attach(page, "1", null, -1);

        pc.disconnected(true, true);
        assertTrue(session.entered.await(5, TimeUnit.SECONDS), "the relink is logging in");
        pc.onClientMessage(page, "{\"requestId\":\"d\",\"action\":\"disconnect\"}");
        session.gate.countDown();
        assertTrue(awaitResult(page, "disconnect", 10_000));

        long deadline = System.currentTimeMillis() + 3000;
        while (pc.isRelinking() && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertFalse(pc.isRelinking(), "a relink with nothing to log in again stops instead of retrying until its deadline");
        assertFalse(pc.isConnected());
        assertEquals(1, session.starts.get(), "no login is attempted after the logout");
    }

    @Test
    void aFailedLoginAfterAFailedReLoginOfAConnectedClientDisposesIt() throws Exception {
        GatedSession session = new GatedSession(false);
        session.gate.countDown();
        ProxyClient pc = client(session);
        set(pc, "connected", true);
        Connection old = new Connection();
        old.setHost("127.0.0.1");
        old.setPort(17171);
        old.setUsername("alice");
        set(pc, "lastConnection", old);
        WebSocket page = conn();
        pc.onClientMessage(page, connect("bob"));
        assertTrue(awaitResult(page, "connect", 10_000));
        assertTrue(pc.isReleased(), "the old session was stopped and the new login failed: nothing is left to serve");
        assertTrue(pc.isDisposable());
    }

    @Test
    void theHandshakeBufferIsEmptiedByASessionReset() throws Exception {
        ProxyClient pc = client(new GatedSession(false));
        ClientCallback cb = new ClientCallback(ClientCallbackMethod.SHOW_USERMESSAGE, null);
        cb.setMessageId(1);
        pc.onCallback(cb);
        long deadline = System.currentTimeMillis() + 5000;
        while (handshakeSize(pc) == 0 && System.currentTimeMillis() < deadline) {
            Thread.sleep(5);
        }
        assertEquals(1, handshakeSize(pc), "the message waits for the handshake");

        Method reset = ProxyClient.class.getDeclaredMethod("resetSessionState");
        reset.setAccessible(true);
        reset.invoke(pc);
        assertEquals(0, handshakeSize(pc), "a message of a failed attempt must not be flushed at the next login");
    }

    private static int handshakeSize(ProxyClient pc) throws Exception {
        @SuppressWarnings("unchecked")
        List<ClientCallback> buffer = (List<ClientCallback>) get(pc, "handshakeBuffer");
        synchronized (buffer) {
            return buffer.size();
        }
    }

    @Test
    void diagnosticsDoesNotWaitForALoginInProgress() throws Exception {
        ProxyClient pc = client(new GatedSession(false));
        CountDownLatch holding = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        Thread login = new Thread(() -> {
            synchronized (pc) {
                holding.countDown();
                try {
                    release.await();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
            }
        });
        login.start();
        try {
            assertTrue(holding.await(5, TimeUnit.SECONDS));
            Thread diagnostics = new Thread(pc::diagnostics);
            diagnostics.start();
            diagnostics.join(1000);
            assertFalse(diagnostics.isAlive(), "/admin/status returned while a login held the client");
        } finally {
            release.countDown();
            login.join();
        }
    }
}
