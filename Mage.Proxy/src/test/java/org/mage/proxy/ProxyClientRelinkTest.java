package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.remote.Connection;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** A lost-link report is checked with the session itself before logging in again. */
class ProxyClientRelinkTest {

    static final class ProbedClient extends ProxyClient {
        volatile boolean answers;
        volatile int probes = 0;

        ProbedClient(Gateway gateway, boolean answers) {
            super(gateway.getConfig(), gateway);
            this.answers = answers;
        }

        @Override
        boolean sessionAnswers(long timeoutMs) {
            probes++;
            return answers;
        }
    }

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private ProbedClient client;

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

    private WebSocket loggedIn(boolean answers) throws Exception {
        client = new ProbedClient(gateway, answers);
        set("connected", true);
        Connection c = new Connection();
        c.setHost("127.0.0.1");
        c.setPort(1);
        c.setUsername("relink-test");
        set("lastConnection", c);
        WebSocket page = conn();
        client.attach(page, "1", null, -1);
        return page;
    }

    private void set(String field, Object value) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        f.set(client, value);
    }

    private List<String> linkStates(WebSocket page, int expected) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        List<String> states;
        do {
            states = gateway.to(page).stream()
                    .filter(f -> "serverLink".equals(f.get("type").getAsString()))
                    .map(f -> f.get("state").getAsString())
                    .collect(Collectors.toList());
            if (states.size() >= expected) {
                return states;
            }
            Thread.sleep(10);
        } while (System.currentTimeMillis() < deadline);
        return states;
    }

    private boolean sawDisconnected(WebSocket page) {
        return gateway.to(page).stream().anyMatch((JsonObject f) -> "disconnected".equals(f.get("type").getAsString()));
    }

    @Test
    void aFalseAlarmKeepsTheHealthySession() throws Exception {
        WebSocket page = loggedIn(true);
        client.disconnected(true, true);
        assertEquals(java.util.Arrays.asList("lost", "restored"), linkStates(page, 2));
        assertTrue(client.isConnected(), "the session was kept");
        assertFalse(client.isRelinking());
        assertFalse(sawDisconnected(page));
    }

    @Test
    void aSessionTheServerNoLongerAnswersIsLoggedInAgain() throws Exception {
        WebSocket page = loggedIn(false);
        client.disconnected(true, true);
        List<String> states = linkStates(page, 2);
        assertEquals("lost", states.get(0));
        assertEquals("retrying", states.get(1));
        assertTrue(client.isRelinking());
    }

    @Test
    void theKeepAliveNoticesALinkLostAfterAFalseAlarm() throws Exception {
        WebSocket page = loggedIn(true);
        client.pingServer();
        assertEquals(0, linkStates(page, 0).size());
        client.answers = false;
        client.pingServer();
        assertTrue(client.isConnected(), "one missed ping is tolerated");
        client.pingServer();
        assertEquals("lost", linkStates(page, 1).get(0));
    }
}
