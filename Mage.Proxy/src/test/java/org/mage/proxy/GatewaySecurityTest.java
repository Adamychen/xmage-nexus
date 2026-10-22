package org.mage.proxy;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewaySecurityTest {

    @Test
    void defaultPolicyAllowsOnlyLocalBrowserOrigins() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);

        assertTrue(gateway.originAllowed(null));
        assertTrue(gateway.originAllowed("http://localhost:5173"));
        assertTrue(gateway.originAllowed("http://127.0.0.1:8788"));
        assertFalse(gateway.originAllowed("https://attacker.example"));
        assertFalse(gateway.originAllowed("not a uri"));
    }

    @Test
    void allowsTheWindowsTauriLauncherVirtualHost() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);

        // WebView2 (Windows) no soporta el esquema custom tauri:// y sirve la
        // app vía el virtual host http://tauri.localhost; macOS/Linux usan
        // tauri://localhost (host ya "localhost", cubierto arriba).
        assertTrue(gateway.originAllowed("http://tauri.localhost"));
        assertTrue(gateway.originAllowed("https://tauri.localhost"));
        assertFalse(gateway.originAllowed("http://evil-tauri.localhost.attacker.example"));
    }

    @Test
    void explicitOriginsReplaceTheDefaultPolicy() {
        Config config = Config.parse(new String[]{"--allowedOrigins", "https://client.example"});
        Gateway gateway = new Gateway(config, 0);

        assertTrue(gateway.originAllowed("https://client.example"));
        assertFalse(gateway.originAllowed("http://localhost:5173"));
    }

    @Test
    void pingIsRecognizedWithoutRoutingItToTheSessionQueue() {
        assertEquals("hb-1", Gateway.pingRequestId("{\"requestId\":\"hb-1\",\"action\":\"ping\",\"args\":{}}"));
        assertEquals("", Gateway.pingRequestId("{\"action\":\"ping\"}"));
        assertNull(Gateway.pingRequestId("{\"requestId\":\"1\",\"action\":\"sendChatMessage\",\"args\":{\"text\":\"ping\"}}"));
        assertNull(Gateway.pingRequestId("{\"requestId\":\"2\",\"action\":\"joinGame\",\"args\":{}}"));
        assertNull(Gateway.pingRequestId("\"ping\" not json"));
    }

    private static WebSocket connectionFrom(String ip) {
        InetSocketAddress peer = new InetSocketAddress(ip, 4321);
        return (WebSocket) Proxy.newProxyInstance(WebSocket.class.getClassLoader(), new Class<?>[]{WebSocket.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("getRemoteSocketAddress")) {
                        return peer;
                    }
                    if (method.getName().equals("equals")) {
                        return proxy == args[0];
                    }
                    if (method.getName().equals("hashCode")) {
                        return System.identityHashCode(proxy);
                    }
                    return method.getReturnType() == boolean.class ? Boolean.TRUE : null;
                });
    }

    private static ClientHandshake handshake(Map<String, String> headers) {
        return (ClientHandshake) Proxy.newProxyInstance(ClientHandshake.class.getClassLoader(), new Class<?>[]{ClientHandshake.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("hasFieldValue")) {
                        return headers.containsKey(args[0]);
                    }
                    if (method.getName().equals("getFieldValue")) {
                        return headers.get(args[0]);
                    }
                    return null;
                });
    }

    @Test
    void aForwardedAddressIsTrustedOnlyFromTheLocalReverseProxy() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);
        WebSocket local = connectionFrom("127.0.0.1");
        gateway.onOpen(local, handshake(Map.of("X-Forwarded-For", "203.0.113.7, 10.0.0.1", "Origin", "http://localhost:5173")));
        assertEquals("203.0.113.7", gateway.ipOf(local));

        WebSocket remote = connectionFrom("198.51.100.9");
        gateway.onOpen(remote, handshake(Map.of("X-Forwarded-For", "10.9.9.9", "Origin", "http://localhost:5173")));
        assertEquals("198.51.100.9", gateway.ipOf(remote), "a remote client cannot pick its own address");
    }

    @Test
    void aRejectedOriginCannotForgeALogLine() {
        Gateway gateway = new Gateway(Config.parse(new String[0]), 0);
        PrintStream stderr = System.err;
        ByteArrayOutputStream captured = new ByteArrayOutputStream();
        System.setErr(new PrintStream(captured, true, StandardCharsets.UTF_8));
        try {
            gateway.onOpen(connectionFrom("198.51.100.9"),
                    handshake(Map.of("Origin", "https://attacker.example\r\n[proxy] ws close: forged")));
        } finally {
            System.setErr(stderr);
        }
        String log = captured.toString(StandardCharsets.UTF_8);
        assertEquals(1, log.chars().filter(c -> c == '\n').count(), "one line per rejected origin: " + log);
        assertFalse(log.contains("\r"));
        assertTrue(log.contains("ws rejected origin=https://attacker.example[proxy] ws close: forged"), log);
    }
}
