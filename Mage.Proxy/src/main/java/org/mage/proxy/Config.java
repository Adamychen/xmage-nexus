package org.mage.proxy;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Proxy configuration from command line args: --key value
 */
public class Config {

    public static final String DEFAULT_SERVER_HOST = "beta.xmage.today";
    public static final int DEFAULT_SERVER_PORT = 17171;
    public static final int DEFAULT_WS_PORT = 8787;
    public static final int DEFAULT_HTTP_PORT = 8788;
    public static final String DEFAULT_BIND_ADDRESS = "127.0.0.1";
    public static final int DEFAULT_MAX_MESSAGE_BYTES = 1024 * 1024;
    public static final int DEFAULT_MAX_MESSAGES_PER_SECOND = 100;
    /**
     * Seconds an XMage session stays alive after its last WebSocket closed, so a reload, a
     * network switch or a phone in the background can re-attach to the running game. Matches
     * the window the server itself gives a desktop client that lost its connection
     * (UserManagerImpl.USER_CONNECTION_TIMEOUT_SESSION_EXPIRE_AFTER_SECS).
     */
    public static final int DEFAULT_GRACE_SECS = 180;

    /**
     * Protocolo JSON del gateway. Se incrementa con cada cambio incompatible del
     * contrato (campos obligatorios, formas de error, etc.).
     */
    public static final String PROTOCOL_VERSION = "1";

    private final Map<String, String> values = new HashMap<>();

    public static Config parse(String[] args) {
        Config config = new Config();
        for (int i = 0; i + 1 < args.length; i++) {
            String key = args[i];
            if (key.startsWith("--")) {
                config.values.put(key.substring(2), args[i + 1]);
                i++;
            }
        }
        return config;
    }

    public String get(String key, String defaultValue) {
        return values.getOrDefault(key, defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        try {
            return Integer.parseInt(get(key, String.valueOf(defaultValue)));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public String getServerHost() {
        return get("host", DEFAULT_SERVER_HOST);
    }

    public int getServerPort() {
        return getInt("port", DEFAULT_SERVER_PORT);
    }

    public String getUsername() {
        return get("username", "");
    }

    public String getPassword() {
        return get("password", "");
    }

    public boolean hasAutoConnect() {
        return !getUsername().isEmpty();
    }

    public int getWsPort() {
        return getInt("wsPort", DEFAULT_WS_PORT);
    }

    public int getHttpPort() {
        return getInt("httpPort", DEFAULT_HTTP_PORT);
    }

    public String getWebDir() {
        return get("webDir", "web");
    }

    /**
     * Dirección de bind de ws/http. Por defecto solo loopback (127.0.0.1):
     * local-first seguro. Para exponer el proxy hay que pasarlo explícitamente.
     */
    public String getBindAddress() {
        return get("bind", DEFAULT_BIND_ADDRESS);
    }

    /**
     * Orígenes WebSocket exactos permitidos (separados por coma).
     * Vacío = política por defecto local-first: solo orígenes de localhost.
     */
    public Set<String> getAllowedOrigins() {
        String raw = get("allowedOrigins", "");
        if (raw.trim().isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> out = new HashSet<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                out.add(trimmed);
            }
        }
        return out;
    }

    public String getAdminToken() {
        return get("adminToken", "");
    }

    public int getMaxMessageBytes() {
        return getInt("maxMessageBytes", DEFAULT_MAX_MESSAGE_BYTES);
    }

    public int getMaxMessagesPerSecond() {
        return getInt("maxMessagesPerSecond", DEFAULT_MAX_MESSAGES_PER_SECOND);
    }

    public int getGraceSecs() {
        return Math.max(1, getInt("graceSecs", DEFAULT_GRACE_SECS));
    }

    /**
     * Grace period when the last page announced it was closing (tab closed, navigated away):
     * a reload comes back within seconds, a player who left keeps the opponent waiting only this
     * long. A dropped connection (no announcement) keeps the full {@link #getGraceSecs()}.
     */
    public int getLeaveGraceSecs() {
        return Math.max(1, Math.min(getGraceSecs(), getInt("leaveGraceSecs", DEFAULT_LEAVE_GRACE_SECS)));
    }

    public static final int DEFAULT_LEAVE_GRACE_SECS = 45;

    /**
     * Seconds the proxy keeps logging a session in again after it lost its link to the XMage
     * server, before telling the web client the session is gone.
     */
    public int getRelinkSecs() {
        return Math.max(1, getInt("relinkSecs", DEFAULT_RELINK_SECS));
    }

    public static final int DEFAULT_RELINK_SECS = 600;

    /** File that keeps the playing SIM seats across proxy restarts ("none" disables it). */
    public String getSimRosterPath() {
        String raw = get("simRoster", "");
        if ("none".equalsIgnoreCase(raw)) {
            return "";
        }
        if (!raw.isEmpty()) {
            return raw;
        }
        return new java.io.File(System.getProperty("java.io.tmpdir"), "mage-proxy-sims-" + getWsPort() + ".json").getPath();
    }
}
