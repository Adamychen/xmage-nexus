package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.remote.Connection;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

/**
 * A second window of an account joins the live session only with that account's password, and
 * the account is one session per server host and port, whatever the case of the username.
 */
class ProxyClientAttachTest {

    /** Logs in without a server: the session reports the user and host of its last connectStart. */
    static final class FakeSession extends SessionImpl {
        final AtomicInteger starts = new AtomicInteger();
        private volatile Connection current;

        FakeSession() {
            super(null);
        }

        @Override
        public boolean connectStart(Connection connection) {
            starts.incrementAndGet();
            current = connection;
            return true;
        }

        @Override
        public String getUserName() {
            Connection c = current;
            return c == null ? null : c.getUsername();
        }

        @Override
        public String getServerHost() {
            Connection c = current;
            return c == null ? "" : c.getHost();
        }
    }

    static final class LoginGateway extends Gateway {
        final List<ProxyClient> created = new CopyOnWriteArrayList<>();
        private final List<ProxyClientStreamTest.Sent> sent = new CopyOnWriteArrayList<>();

        LoginGateway() {
            super(Config.parse(new String[]{"--wsPort", "0", "--simRoster", "none"}));
        }

        @Override
        public void send(WebSocket conn, String json) {
            sent.add(new ProxyClientStreamTest.Sent(conn, json));
        }

        List<JsonObject> to(WebSocket conn) {
            List<JsonObject> frames = new java.util.ArrayList<>();
            for (ProxyClientStreamTest.Sent s : sent) {
                if (s.conn == conn) {
                    frames.add(s.frame);
                }
            }
            return frames;
        }

        @Override
        ProxyClient newClient() {
            ProxyClient pc = new ProxyClient(getConfig(), this);
            try {
                Field f = ProxyClient.class.getDeclaredField("session");
                f.setAccessible(true);
                f.set(pc, new FakeSession());
            } catch (ReflectiveOperationException ex) {
                throw new IllegalStateException(ex);
            }
            created.add(pc);
            return pc;
        }
    }

    private final LoginGateway gateway = new LoginGateway();
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
        for (ProxyClient pc : gateway.created) {
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

    private static String connect(String requestId, String host, int port, String username, String password) {
        JsonObject args = new JsonObject();
        args.addProperty("host", host);
        args.addProperty("port", port);
        args.addProperty("username", username);
        if (password != null) {
            args.addProperty("password", password);
        }
        JsonObject cmd = new JsonObject();
        cmd.addProperty("requestId", requestId);
        cmd.addProperty("action", "connect");
        cmd.add("args", args);
        return cmd.toString();
    }

    private static String unknownAction(String requestId) {
        return "{\"requestId\":\"" + requestId + "\",\"action\":\"noSuchAction\",\"args\":{}}";
    }

    private JsonObject result(WebSocket page, String requestId) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        do {
            for (JsonObject frame : gateway.to(page)) {
                if ("result".equals(frame.get("type").getAsString()) && requestId.equals(frame.get("requestId").getAsString())) {
                    return frame;
                }
            }
            Thread.sleep(10);
        } while (System.currentTimeMillis() < deadline);
        fail("no result for request " + requestId);
        return null;
    }

    private static boolean isOk(JsonObject result) {
        return result.get("ok").getAsBoolean();
    }

    private static boolean attached(JsonObject result) {
        return result.getAsJsonObject("data").get("attached").getAsBoolean();
    }

    private static String errorCode(JsonObject result) {
        return result.has("errorCode") ? result.get("errorCode").getAsString() : null;
    }

    private WebSocket loggedInAs(String username, String password) throws InterruptedException {
        WebSocket page = conn();
        gateway.onMessage(page, connect("1", "127.0.0.1", 17171, username, password));
        assertTrue(isOk(result(page, "1")), "the first window logs in");
        return page;
    }

    @Test
    void aWindowWithTheSamePasswordAttachesToTheLiveSession() throws Exception {
        loggedInAs("alice", "secret");
        WebSocket second = conn();
        gateway.onMessage(second, connect("2", "127.0.0.1", 17171, "alice", "secret"));
        JsonObject r = result(second, "2");
        assertTrue(isOk(r));
        assertTrue(attached(r), "a second window of the same account shares its session");
        assertEquals(1, gateway.created.size());
    }

    @Test
    void aWindowWithAWrongPasswordIsRefusedAndTheOwnersWindowsAreUnaffected() throws Exception {
        WebSocket owner = loggedInAs("alice", "secret");
        WebSocket intruder = conn();
        gateway.onMessage(intruder, connect("2", "127.0.0.1", 17171, "alice", "guess"));
        JsonObject refused = result(intruder, "2");
        assertFalse(isOk(refused));
        assertEquals("PASSWORD", errorCode(refused));
        assertEquals(1, gateway.created.size(), "no second client for a refused window");
        assertTrue(gateway.created.get(0).isConnected(), "the session keeps running");
        gateway.onMessage(owner, unknownAction("3"));
        assertEquals("UNKNOWN_ACTION", errorCode(result(owner, "3")), "the owner's window stays authorized");
    }

    @Test
    void aWindowWithoutAPasswordIsRefused() throws Exception {
        loggedInAs("alice", "secret");
        WebSocket intruder = conn();
        gateway.onMessage(intruder, connect("2", "127.0.0.1", 17171, "alice", null));
        JsonObject refused = result(intruder, "2");
        assertFalse(isOk(refused));
        assertEquals("PASSWORD", errorCode(refused));
    }

    @Test
    void aRetypedWrongPasswordOnAnAttachedWindowDoesNotRestartTheSession() throws Exception {
        loggedInAs("alice", "secret");
        WebSocket second = conn();
        gateway.onMessage(second, connect("2", "127.0.0.1", 17171, "alice", "secret"));
        assertTrue(attached(result(second, "2")));
        gateway.onMessage(second, connect("3", "127.0.0.1", 17171, "alice", "guess"));
        JsonObject refused = result(second, "3");
        assertFalse(isOk(refused));
        assertEquals("PASSWORD", errorCode(refused));
        assertTrue(gateway.created.get(0).isConnected(), "the session was not replaced");
        gateway.onMessage(second, unknownAction("4"));
        assertEquals("UNKNOWN_ACTION", errorCode(result(second, "4")), "the window stays attached");
    }

    @Test
    void anotherServerPortIsAnotherSession() throws Exception {
        loggedInAs("alice", "secret");
        ProxyClient owner = gateway.created.get(0);
        assertFalse(owner.isSameSession("127.0.0.1", 17172, "alice"));
        WebSocket other = conn();
        gateway.onMessage(other, connect("2", "127.0.0.1", 17172, "alice", "secret"));
        JsonObject r = result(other, "2");
        assertTrue(isOk(r));
        assertFalse(attached(r), "the same account on another server is a session of its own");
        assertEquals(2, gateway.created.size());
    }

    @Test
    void theUsernameIsCaseInsensitiveForTheSameSession() throws Exception {
        loggedInAs("alice", "secret");
        WebSocket other = conn();
        gateway.onMessage(other, connect("2", "localhost", 17171, "Alice", "secret"));
        JsonObject r = result(other, "2");
        assertTrue(isOk(r));
        assertTrue(attached(r), "Alice and alice are the same account");
        assertEquals(1, gateway.created.size());
    }

    @Test
    void theAccountKeyCannotBeForgedThroughAPipeOrAPortOrACase() {
        assertNotEquals(ProxyClient.sessionKey("host|x", 17171, "y"), ProxyClient.sessionKey("host", 17171, "x|y"));
        assertNotEquals(ProxyClient.sessionKey("127.0.0.1", 17171, "a"), ProxyClient.sessionKey("127.0.0.1", 17172, "a"));
        assertEquals(ProxyClient.sessionKey("127.0.0.1", 17171, "Bob"), ProxyClient.sessionKey("127.0.0.1", 17171, "bob"));
        assertEquals(ProxyClient.sessionKey("127.0.0.1", 17171, "bob"), ProxyClient.sessionKey("localhost", 17171, "bob"));
    }
}
