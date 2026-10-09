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
        for (int i = 0; i < args.length; i++) {
            String key = args[i];
            if (!key.startsWith("--")) {
                continue;
            }
            String name = key.substring(2);
            if (i + 1 >= args.length) {
                // a trailing --key with no value: previously it was silently dropped, and the
                // loop then read the key before it as this key's value
                throw new IllegalArgumentException("missing value for --" + name);
            }
            String value = args[i + 1];
            if (value.startsWith("--")) {
                // a flag can never be a value: --host --port 17171 used to set host="--port"
                // and drop 17171, leaving the proxy on host "--port" and the default port
                throw new IllegalArgumentException("--" + name + " needs a value, got the flag " + value);
            }
            config.values.put(name, value);
            i++;
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
     * Player-submitted reports (see {@link ReportSink}). On by default: a sink nobody has to
     * remember to switch on is the only kind that collects anything. Bound by count, total bytes
     * and age so an unattended proxy cannot fill the disk it plays the games from.
     */
    public static final String DEFAULT_REPORTS_DIR = "reports";
    public static final int DEFAULT_REPORT_MAX_BYTES = 64 * 1024 * 1024;
    /** Per-report cap. A GAME_UPDATE is 200-800 KB, which is why the client trims before sending. */
    public static final int DEFAULT_REPORT_MAX_FILE_BYTES = 96 * 1024;
    public static final int DEFAULT_REPORT_MAX_FILES = 500;
    public static final int DEFAULT_REPORT_MAX_AGE_DAYS = 14;
    public static final int DEFAULT_REPORT_QUOTA_COUNT = 5;
    public static final int DEFAULT_REPORT_QUOTA_INTERVAL_SECS = 30;

    public String getReportsDir() {
        return get("reportsDir", DEFAULT_REPORTS_DIR);
    }

    public int getReportMaxBytes() {
        return getInt("reportMaxBytes", DEFAULT_REPORT_MAX_BYTES);
    }

    public int getReportMaxFileBytes() {
        return getInt("reportMaxFileBytes", DEFAULT_REPORT_MAX_FILE_BYTES);
    }

    public int getReportMaxFiles() {
        return getInt("reportMaxFiles", DEFAULT_REPORT_MAX_FILES);
    }

    public int getReportMaxAgeDays() {
        return Math.max(1, getInt("reportMaxAgeDays", DEFAULT_REPORT_MAX_AGE_DAYS));
    }

    public int getReportQuotaCount() {
        return Math.max(1, getInt("reportQuotaCount", DEFAULT_REPORT_QUOTA_COUNT));
    }

    public long getReportQuotaIntervalMillis() {
        return Math.max(1000L, getInt("reportQuotaIntervalSecs", DEFAULT_REPORT_QUOTA_INTERVAL_SECS) * 1000L);
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

    /**
     * File that keeps the per-account restore ids across proxy restarts ("none" disables it),
     * so a re-login after a deploy takes the account's session back instead of being refused
     * with "already connected" while the server still holds it.
     */
    public String getRestoreIdsPath() {
        String raw = get("restoreIds", "");
        if ("none".equalsIgnoreCase(raw)) {
            return "";
        }
        if (!raw.isEmpty()) {
            return raw;
        }
        return new java.io.File(System.getProperty("java.io.tmpdir"), "mage-proxy-restore-" + getWsPort() + ".json").getPath();
    }
}
