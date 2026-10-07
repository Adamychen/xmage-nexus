package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.remote.SessionImpl;
import mage.view.RoomUsersView;

import java.util.Collection;
import java.util.Collections;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Polls the session's main room (tables, users, server messages) and publishes it as one
 * {@code lobby} snapshot. Runs on the client's lobby timer only, so its counters need no lock.
 */
final class LobbyPublisher {

    // the session's logger: these lines belong to its log, and its level configuration applies
    private static final Logger logger = Logger.getLogger(ProxyClient.class.getName());

    static final long LOBBY_IN_GAME_INTERVAL_MS = 20_000;
    static final long SERVER_MESSAGES_INTERVAL_MS = 60_000;
    static final long GAME_IDLE_MS = 120_000;

    private final Consumer<String> broadcast;
    private volatile long lastPublishAt = 0;
    private volatile long serverMessagesAt = 0;
    private volatile JsonElement serverMessagesCache = null;
    private int failures = 0;

    LobbyPublisher(Consumer<String> broadcast) {
        this.broadcast = broadcast;
    }

    /** Publish on the next tick even in a game (after a login, an attach or a relink). */
    void publishSoon() {
        lastPublishAt = 0;
    }

    int failures() {
        return failures;
    }

    /**
     * A game in progress (played or watched, with recent activity) hides the lobby: it is then
     * polled every {@link #LOBBY_IN_GAME_INTERVAL_MS} instead of every tick, which saves three
     * server calls and ~50 KB per tick on a busy server while the player is in a game.
     */
    static boolean lobbyDue(int gamesInProgress, long lastGameEventAt, long lastPublishAt, long now) {
        boolean inGame = gamesInProgress > 0 && now - lastGameEventAt < GAME_IDLE_MS;
        return !inGame || now - lastPublishAt >= LOBBY_IN_GAME_INTERVAL_MS;
    }

    void publish(SessionImpl session, SessionGames games) {
        long now = System.currentTimeMillis();
        if (!lobbyDue(games.inProgressCount(), games.lastEventAt(), lastPublishAt, now)) {
            return;
        }
        try {
            UUID roomId = session.getMainRoomId();
            if (roomId == null) {
                return;
            }
            JsonObject lobby = new JsonObject();
            lobby.addProperty("type", "lobby");
            lobby.addProperty("roomId", roomId.toString());
            lobby.add("tables", JsonParser.parseString(JsonUtil.toJson(session.getTables(roomId))));
            Collection<RoomUsersView> roomUsers = session.getRoomUsers(roomId);
            RoomUsersView usersView = (roomUsers != null && !roomUsers.isEmpty())
                    ? roomUsers.iterator().next()
                    : new RoomUsersView(Collections.emptyList(), 0, 0, 0);
            lobby.add("users", JsonParser.parseString(JsonUtil.toJson(usersView)));
            if (serverMessagesCache == null || now - serverMessagesAt >= SERVER_MESSAGES_INTERVAL_MS) {
                serverMessagesCache = JsonParser.parseString(JsonUtil.toJson(session.getServerMessages()));
                serverMessagesAt = now;
            }
            lobby.add("serverMessages", serverMessagesCache);
            broadcast.accept(lobby.toString());
            lastPublishAt = now;
            failures = 0;
        } catch (Throwable ex) {
            // errores transitorios (p.ej. un reinicio del server) no deben inundar el log:
            // el primer fallo se loguea con stack y después solo 1 línea por minuto, para
            // no repetir ~70 KB de stack cada 2 s durante toda la caída
            failures++;
            if (failures == 1) {
                logger.log(Level.WARNING, "Lobby publish failed: " + ex.getMessage(), ex);
            } else if (failures % 30 == 0) {
                logger.log(Level.WARNING, "Lobby publish still failing (" + failures + " ticks): " + ex.getMessage());
            }
        }
    }
}
