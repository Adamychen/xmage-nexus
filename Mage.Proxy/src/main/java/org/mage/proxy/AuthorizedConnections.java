package org.mage.proxy;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;

import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The WebSocket connections of one session that completed {@code connect}, and the numbered
 * stream of frames broadcast to them.
 *
 * <p>Every method runs under this object's monitor, so a frame is numbered, kept and sent to the
 * same set of connections in broadcast order, and an attach or the end of a login replays its
 * backlog without losing or doubling a frame against the live stream. Lock order: the owning
 * {@link ProxyClient}'s monitor may be held when calling in, never the other way round - nothing
 * here calls back into the client.
 */
final class AuthorizedConnections {

    static final int LOGIN_BACKLOG_LIMIT = 500;

    private final Gateway gateway;
    private final Set<WebSocket> authorized = Collections.newSetFromMap(new IdentityHashMap<WebSocket, Boolean>());
    /** Every non-lobby frame broadcast, numbered, so a returning connection resumes the stream. */
    private final OutboundLog outbound = new OutboundLog();
    private final String streamId = UUID.randomUUID().toString();

    /**
     * Frames broadcast while a login is in progress. The logging-in connection is not authorized
     * until connectStart returns, but a reconnect's restore (START_GAME, GAME_INIT, the re-asked
     * prompt) can arrive before that; it is handed to the connection right after its connect
     * result instead of being lost.
     */
    private List<String> loginBacklog = null;

    AuthorizedConnections(Gateway gateway) {
        this.gateway = gateway;
    }

    /**
     * Numbers the frame in the session's stream (a frame with a {@code supersedeKey} replaces
     * the older one with the same key there) and sends it to every authorized connection.
     */
    synchronized void broadcast(String json, String supersedeKey) {
        String framed = outbound.append(json, supersedeKey, !authorized.isEmpty());
        if (loginBacklog != null && loginBacklog.size() < LOGIN_BACKLOG_LIMIT) {
            loginBacklog.add(framed);
        }
        for (WebSocket conn : authorized) {
            gateway.send(conn, framed);
        }
    }

    /** The lobby is a snapshot re-sent every few seconds: never numbered nor kept. */
    synchronized void broadcastUnnumbered(String json) {
        for (WebSocket conn : authorized) {
            gateway.send(conn, json);
        }
    }

    synchronized boolean contains(WebSocket conn) {
        return authorized.contains(conn);
    }

    synchronized int count() {
        return authorized.size();
    }

    /** Removes the connection and tells whether none is left. */
    synchronized boolean removeAndCheckEmpty(WebSocket conn) {
        authorized.remove(conn);
        return authorized.isEmpty();
    }

    /** {@code null} removes every connection. */
    synchronized void deauthorize(WebSocket conn) {
        if (conn == null) {
            authorized.clear();
        } else {
            authorized.remove(conn);
        }
    }

    /** A login starts: keep what is broadcast meanwhile for the connection logging in. */
    synchronized void beginLogin() {
        loginBacklog = new ArrayList<>();
    }

    /** The login failed or was a relink with no connection waiting for it. */
    synchronized void abandonLogin() {
        loginBacklog = null;
    }

    /** Sends the successful connect result, then everything broadcast during the login. */
    synchronized void finishLogin(WebSocket conn, String resultJson) {
        List<String> backlog = loginBacklog;
        loginBacklog = null;
        gateway.send(conn, resultJson);
        if (conn != null) {
            authorized.add(conn);
            if (backlog != null) {
                for (String json : backlog) {
                    gateway.send(conn, json);
                }
            }
        }
    }

    /**
     * Attaches an authenticated connection to the live session. A connection that names this
     * stream and the last frame it processed gets every frame it missed, in order
     * ({@code resumed: true}); otherwise it rejoins its game and gets the latest state and prompt.
     */
    synchronized void attach(WebSocket conn, String requestId, String resumeStreamId, long resumeSeq) {
        List<String> missed = streamId.equals(resumeStreamId) && resumeSeq >= 0 ? outbound.since(resumeSeq) : null;
        gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, true, null, connectData(true, missed != null)));
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "connected");
        ev.addProperty("info", "Connected (attached to existing session)");
        gateway.send(conn, ev.toString());
        if (missed != null) {
            for (String json : missed) {
                gateway.send(conn, json);
            }
        }
        if (conn != null) {
            authorized.add(conn);
        }
    }

    /** {@code connect} result data shared by every successful login or attach. */
    JsonObject connectData(boolean attached, Boolean resumed) {
        JsonObject data = new JsonObject();
        data.addProperty("attached", attached);
        data.addProperty("streamId", streamId);
        if (resumed != null) {
            data.addProperty("resumed", resumed);
        }
        return data;
    }

    /** Not under this monitor: the admin endpoint must not wait behind a broadcast. */
    int outboundFrames() {
        return outbound.size();
    }

    long outboundChars() {
        return outbound.chars();
    }
}
