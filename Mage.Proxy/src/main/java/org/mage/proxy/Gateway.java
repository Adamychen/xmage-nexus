package org.mage.proxy;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.Deque;
import java.util.IdentityHashMap;
import java.util.Locale;
import java.util.Collection;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * WebSocket server: transport between the web client and the proxy logic.
 * <p>
 * Seguridad local-first (todo aplicado en el transporte):
 * - bind a 127.0.0.1 por defecto (configurable con --bind)
 * - rechazo de orígenes WebSocket que no sean localhost (o --allowedOrigins)
 * - límite de tamaño de mensaje y de frecuencia por conexión
 */
public class Gateway extends WebSocketServer {

    private final Config config;
    /** conn -> su ProxyClient (sesión propia o compartida por cuenta). */
    private final Map<WebSocket, ProxyClient> byConn = Collections.synchronizedMap(new IdentityHashMap<WebSocket, ProxyClient>());
    /** host|username -> ProxyClient conectado (para re-adjuntar ventanas de la misma cuenta). */
    private final Map<String, ProxyClient> byAccount = new ConcurrentHashMap<>();

    /** recuento de mensajes por conexión (ventana deslizante de 1 s) */
    private final Map<WebSocket, Deque<Long>> messageTimes =
            Collections.synchronizedMap(new IdentityHashMap<WebSocket, Deque<Long>>());

    public Gateway(Config config) {
        this(config, config.getWsPort());
    }

    public Gateway(Config config, int port) {
        super(new InetSocketAddress(config.getBindAddress(), port));
        this.config = config;
        setReuseAddr(true);
    }

    public Config getConfig() {
        return config;
    }

    public void registerSession(String key, ProxyClient pc) {
        byAccount.put(key, pc);
    }

    public void unregisterSession(String key) {
        byAccount.remove(key);
    }

    public ProxyClient findSession(String key) {
        return byAccount.get(key);
    }

    public java.util.Collection<ProxyClient> getSessions() {
        return byAccount.values();
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        String origin = handshake.getFieldValue("Origin");
        if (!originAllowed(origin)) {
            System.err.println("[proxy] ws rejected origin=" + origin);
            conn.close(1008, "origin not allowed");
            return;
        }
        // Lazy: la sesión se crea en handleConnect (al recibir `connect`), para poder
        // re-adjuntar la conexión a una sesión existente de la misma cuenta.
        sendReady(conn);
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        messageTimes.remove(conn);
        ProxyClient pc = byConn.remove(conn);
        if (pc != null) {
            pc.onClientClose(conn);
        }
        System.err.println("[proxy] ws close: " + conn.getRemoteSocketAddress() + " code=" + code + " reason='" + reason + "'");
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        if (!rateLimit(conn)) {
            conn.close(1008, "message rate limit exceeded");
            return;
        }
        if (utf8Length(message) > config.getMaxMessageBytes()) {
            conn.close(1009, "message too large");
            return;
        }
        ProxyClient pc = byConn.get(conn);
        if (pc != null) {
            pc.onClientMessage(conn, message);
            return;
        }
        // Pre-auth: solo se acepta `connect` (y `ping`, keep-alive público).
        String action = "";
        String requestId = "";
        try {
            JsonObject cmd = JsonParser.parseString(message).getAsJsonObject();
            action = cmd.has("action") ? cmd.get("action").getAsString() : "";
            if (cmd.has("requestId") && cmd.get("requestId").isJsonPrimitive()) {
                requestId = cmd.get("requestId").getAsString();
            }
        } catch (Exception ex) {
            conn.send(ProxyClient.resultJson("", "", false, ProxyClient.ERR_BAD_JSON, "Bad JSON"));
            return;
        }
        if ("connect".equals(action)) {
            handleConnect(conn, message);
        } else if ("ping".equals(action)) {
            conn.send(ProxyClient.resultJson("ping", requestId, true, null, "pong"));
        } else {
            conn.send(ProxyClient.resultJson(action, requestId, false, ProxyClient.ERR_NOT_AUTHORIZED, "send connect first"));
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("[proxy] websocket error: " + ex);
    }

    @Override
    public void onStart() {
    }

    public void send(WebSocket conn, String json) {
        if (conn != null && conn.isOpen()) {
            conn.send(json);
        }
    }

    /** Intercepta `connect` para decidir create-vs-attach antes de crear la sesión. */
    private void handleConnect(WebSocket conn, String message) {
        String requestId = "";
        String host;
        int port;
        String username;
        try {
            JsonObject cmd = JsonParser.parseString(message).getAsJsonObject();
            if (cmd.has("requestId") && cmd.get("requestId").isJsonPrimitive()) {
                requestId = cmd.get("requestId").getAsString();
            }
            JsonObject args = cmd.has("args") && cmd.get("args").isJsonObject()
                    ? cmd.getAsJsonObject("args") : new JsonObject();
            host = args.has("host") ? args.get("host").getAsString() : config.getServerHost();
            port = args.has("port") ? args.get("port").getAsInt() : config.getServerPort();
            username = args.has("username") ? args.get("username").getAsString() : config.getUsername();
        } catch (Exception ex) {
            conn.send(ProxyClient.resultJson("connect", requestId, false, ProxyClient.ERR_BAD_JSON, "Bad JSON: " + ex.getMessage()));
            return;
        }
        String key = host + "|" + username;
        ProxyClient existing = byAccount.get(key);
        if (existing != null && existing.isConnected() && existing.isSameSession(host, port, username)) {
            // Misma cuenta: adjuntar a la sesión existente (varias ventanas = una sesión).
            byConn.put(conn, existing);
            existing.attach(conn, requestId);
            return;
        }
        ProxyClient pc = new ProxyClient(config, this);
        byConn.put(conn, pc);
        pc.onClientMessage(conn, message);
    }

    private void sendReady(WebSocket conn) {
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "info");
        ev.addProperty("message", "Proxy ready. Send {\"action\":\"connect\",...} to log in.");
        if (conn != null && conn.isOpen()) {
            conn.send(ev.toString());
        }
    }

    /**
     * Permite conexiones sin Origin (node/self-test) y orígenes de localhost.
     * Si --allowedOrigins está definido, solo se aceptan esos valores exactos.
     */
    boolean originAllowed(String origin) {
        if (origin == null || origin.isEmpty()) {
            return true;
        }
        Set<String> allowed = config.getAllowedOrigins();
        if (!allowed.isEmpty()) {
            return allowed.contains(origin);
        }
        try {
            String host = new URI(origin).getHost();
            if (host == null) {
                return false;
            }
            String h = host.toLowerCase(Locale.ROOT);
            return h.equals("localhost") || h.equals("127.0.0.1") || h.equals("::1");
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean rateLimit(WebSocket conn) {
        int max = config.getMaxMessagesPerSecond();
        if (max <= 0) {
            return true;
        }
        long now = System.currentTimeMillis();
        Deque<Long> times;
        synchronized (messageTimes) {
            times = messageTimes.get(conn);
            if (times == null) {
                times = new ArrayDeque<>();
                messageTimes.put(conn, times);
            }
        }
        synchronized (times) {
            while (!times.isEmpty() && now - times.peekFirst() > 1000) {
                times.pollFirst();
            }
            if (times.size() >= max) {
                return false;
            }
            times.addLast(now);
            return true;
        }
    }

    private static int utf8Length(String s) {
        int bytes = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            bytes += c < 0x80 ? 1 : (c < 0x800 ? 2 : 3);
        }
        return bytes;
    }
}
