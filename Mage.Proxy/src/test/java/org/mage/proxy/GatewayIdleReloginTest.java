package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.remote.Connection;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Logging in again through a client that is only waiting in its grace period needs the account's password. */
class GatewayIdleReloginTest {

    /** A client that lost its WebSocket and waits in its grace period; it records the connects handed to it. */
    static final class IdleClient extends ProxyClient {
        final List<WebSocket> handed = new ArrayList<>();

        IdleClient(Gateway gateway) {
            super(gateway.getConfig(), gateway);
        }

        @Override
        public void onClientMessage(WebSocket conn, String message) {
            handed.add(conn);
        }
    }

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private AtomicReference<DeckValidation.State> state;
    private DeckValidation.State before;
    private IdleClient idle;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void cardDataReady() throws Exception {
        Field f = DeckValidation.class.getDeclaredField("STATE");
        f.setAccessible(true);
        state = (AtomicReference<DeckValidation.State>) f.get(null);
        before = state.get();
        state.set(DeckValidation.State.FAILED);

        idle = new IdleClient(gateway);
        Method digest = ProxyClient.class.getDeclaredMethod("passwordDigest", String.class);
        digest.setAccessible(true);
        set("passwordHash", digest.invoke(idle, "right"));
        Connection c = new Connection();
        c.setHost("127.0.0.1");
        c.setPort(17171);
        c.setUsername("alice");
        set("lastConnection", c);
        gateway.registerSession(ProxyClient.sessionKey("127.0.0.1", 17171, "alice"), idle);
    }

    @AfterEach
    void restore() {
        state.set(before);
        idle.shutdown();
    }

    private void set(String field, Object value) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(idle, value);
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

    private static String connect(String password) {
        return "{\"requestId\":\"c\",\"action\":\"connect\",\"args\":{\"host\":\"127.0.0.1\",\"port\":17171,"
                + "\"username\":\"alice\",\"password\":\"" + password + "\"}}";
    }

    @Test
    void aWrongPasswordDoesNotTakeOverTheIdleSession() {
        WebSocket page = conn();
        gateway.onMessage(page, connect("wrong"));

        assertEquals(0, idle.handed.size(), "the connect was not forwarded to the client waiting for its owner");
        List<JsonObject> results = gateway.to(page).stream()
                .filter(f -> "result".equals(f.get("type").getAsString())).collect(Collectors.toList());
        assertEquals(1, results.size());
        assertEquals("PASSWORD", results.get(0).get("errorCode").getAsString());
    }

    @Test
    void theRightPasswordReachesTheIdleSession() {
        WebSocket page = conn();
        gateway.onMessage(page, connect("right"));

        assertEquals(1, idle.handed.size());
        assertTrue(idle.handed.get(0) == page);
    }
}
