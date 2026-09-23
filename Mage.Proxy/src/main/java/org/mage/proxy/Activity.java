package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Operational activity log: one greppable line per event on stdout (docker logs)
 * plus an in-memory ring buffer and per-user stats for the /admin/status endpoint.
 * Never records passwords, chat text or deck contents.
 */
public final class Activity {

    private static final int MAX_EVENTS = 500;
    private static final Set<String> QUIET = new HashSet<>(Arrays.asList(
            "ping", "sendPlayerAction", "sendPlayerUUID", "sendPlayerBoolean", "sendPlayerInteger",
            "sendPlayerString", "sendPlayerManaType", "getTables", "getRoomUsers", "getRoomChatId",
            "getFinishedMatches", "getServerMessages", "joinChat", "leaveChat", "getGameChatId",
            "getTableChatId", "sendCardMark", "setBoosterLoaded", "replayNext", "replayPrevious"));
    private static final Set<String> SAFE_ARGS = new HashSet<>(Arrays.asList(
            "gameType", "tableId", "gameId", "tournamentId", "playerType", "deckName", "format", "host", "port"));

    private static final long startedAt = System.currentTimeMillis();
    private static final AtomicLong openConnections = new AtomicLong();
    private static final AtomicLong totalConnections = new AtomicLong();
    private static final Deque<String> events = new ArrayDeque<>();
    private static final Map<String, UserStats> users = new ConcurrentHashMap<>();

    private Activity() {
    }

    static final class UserStats {
        final String user;
        volatile String host = "";
        volatile String ip = "";
        volatile long connectedAt;
        volatile long lastActionAt;
        volatile String lastAction = "";
        volatile int windows = 1;
        final AtomicLong actions = new AtomicLong();

        UserStats(String user) {
            this.user = user;
        }
    }

    private static void emit(String event, String user, String ip, String detail) {
        StringBuilder sb = new StringBuilder(Instant.now().toString()).append(' ').append(event);
        if (user != null && !user.isEmpty()) sb.append(" user=").append(user);
        if (ip != null && !ip.isEmpty()) sb.append(" ip=").append(ip);
        if (detail != null && !detail.isEmpty()) sb.append(' ').append(detail);
        String line = sb.toString().replaceAll("[\\r\\n]+", " ");
        System.out.println("[activity] " + line);
        synchronized (events) {
            events.addLast(line);
            while (events.size() > MAX_EVENTS) events.pollFirst();
        }
    }

    public static void wsOpen(String ip, String origin) {
        openConnections.incrementAndGet();
        totalConnections.incrementAndGet();
        emit("ws_open", null, ip, origin == null || origin.isEmpty() ? null : "origin=" + origin);
    }

    public static void wsRejected(String ip, String origin) {
        emit("ws_rejected", null, ip, "origin=" + origin);
    }

    public static void wsClose(String ip, String user, int code) {
        openConnections.decrementAndGet();
        emit("ws_close", user, ip, "code=" + code);
    }

    public static void login(String user, String ip, String host, int port, boolean ok, String detail, boolean attached) {
        String target = host + ":" + port;
        if (ok) {
            UserStats s = users.computeIfAbsent(user, UserStats::new);
            if (attached) {
                s.windows++;
            } else {
                s.windows = 1;
                s.connectedAt = System.currentTimeMillis();
            }
            s.host = target;
            s.ip = ip == null ? "" : ip;
            emit(attached ? "login_attach" : "login_ok", user, ip, "server=" + target);
        } else {
            emit("login_fail", user, ip, "server=" + target + " reason=\"" + detail + "\"");
        }
    }

    public static void action(String user, String ip, String action, JsonObject args) {
        UserStats s = users.get(user);
        if (s != null) {
            s.actions.incrementAndGet();
            if (!QUIET.contains(action)) {
                s.lastAction = action;
                s.lastActionAt = System.currentTimeMillis();
            }
        }
        if (QUIET.contains(action)) return;
        StringBuilder d = new StringBuilder("action=").append(action);
        if (args != null) {
            for (Map.Entry<String, com.google.gson.JsonElement> e : args.entrySet()) {
                if (SAFE_ARGS.contains(e.getKey()) && e.getValue().isJsonPrimitive()) {
                    d.append(' ').append(e.getKey()).append('=').append(e.getValue().getAsString());
                }
            }
        }
        emit("action", user, ip, d.toString());
    }

    public static void sessionEnd(String user, String reason) {
        UserStats s = user == null ? null : users.remove(user);
        String extra = "reason=" + reason;
        if (s != null) {
            extra += " duration_s=" + (System.currentTimeMillis() - s.connectedAt) / 1000 + " actions=" + s.actions.get();
        }
        emit("session_end", user, s == null ? null : s.ip, extra);
    }

    public static String snapshot() {
        long now = System.currentTimeMillis();
        JsonObject out = new JsonObject();
        out.addProperty("uptimeSeconds", (now - startedAt) / 1000);
        out.addProperty("openConnections", openConnections.get());
        out.addProperty("totalConnections", totalConnections.get());
        JsonArray list = new JsonArray();
        for (UserStats s : users.values()) {
            JsonObject u = new JsonObject();
            u.addProperty("user", s.user);
            u.addProperty("server", s.host);
            u.addProperty("ip", s.ip);
            u.addProperty("windows", s.windows);
            u.addProperty("connectedSeconds", (now - s.connectedAt) / 1000);
            u.addProperty("actions", s.actions.get());
            u.addProperty("lastAction", s.lastAction);
            u.addProperty("lastActionAgoSeconds", s.lastActionAt == 0 ? -1 : (now - s.lastActionAt) / 1000);
            list.add(u);
        }
        out.add("users", list);
        JsonArray ev = new JsonArray();
        synchronized (events) {
            for (String e : events) ev.add(e);
        }
        out.add("events", ev);
        return out.toString();
    }
}
