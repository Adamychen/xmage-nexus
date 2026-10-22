package org.mage.proxy;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.fail;

/** A command whose shape is wrong is answered with a failed result, never dropped. */
class ProxyClientCommandShapeTest {

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private final ProxyClient client = new ProxyClient(gateway.getConfig(), gateway);

    @AfterEach
    void stop() {
        client.shutdown();
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

    private JsonObject answer(WebSocket page) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        do {
            List<JsonObject> results = gateway.to(page).stream()
                    .filter(f -> "result".equals(f.get("type").getAsString()))
                    .collect(Collectors.toList());
            if (!results.isEmpty()) {
                return results.get(0);
            }
            Thread.sleep(10);
        } while (System.currentTimeMillis() < deadline);
        fail("the command got no answer");
        return null;
    }

    private void assertBadJson(String command, String requestId) throws InterruptedException {
        WebSocket page = conn();
        client.onClientMessage(page, command);
        JsonObject r = answer(page);
        assertFalse(r.get("ok").getAsBoolean());
        assertEquals("BAD_JSON", r.get("errorCode").getAsString());
        assertEquals(requestId, r.get("requestId").getAsString());
    }

    @Test
    void anArrayIsAnsweredAsBadJson() throws Exception {
        assertBadJson("[]", "");
    }

    @Test
    void aNullActionIsAnsweredWithItsRequestId() throws Exception {
        assertBadJson("{\"action\":null,\"requestId\":\"r\"}", "r");
    }

    @Test
    void anObjectActionIsAnsweredWithItsRequestId() throws Exception {
        assertBadJson("{\"action\":{},\"requestId\":\"r\"}", "r");
    }
}
