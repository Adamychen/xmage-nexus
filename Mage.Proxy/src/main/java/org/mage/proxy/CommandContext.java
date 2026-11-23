package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.players.net.UserData;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;

import java.util.UUID;

/** Superficie de ProxyClient que necesitan los handlers de comandos por dominio. */
interface CommandContext {

    SessionImpl session();

    Gateway gateway();

    boolean isConnected();

    void sendFailure(WebSocket conn, String action, String requestId, long start);

    void replayGameState(WebSocket conn, UUID gameId);

    /** Lets the session forward events of a game it (re)joined or watches. */
    void markGameActive(UUID gameId);

    /** The player left or stopped watching the game. */
    void markGameInactive(UUID gameId);

    /**
     * Takes the cached open prompt of a game out before the player's answer is sent (only a
     * GAME_SELECT when {@code onlySelect}); null when there is none.
     */
    ReplayCache.Prompt takePrompt(UUID gameId, boolean onlySelect);

    /** The answer was rejected, so the prompt is still open. */
    void restorePrompt(UUID gameId, ReplayCache.Prompt prompt);

    /**
     * The preferences of an update, carrying what identifies the player at the table: the
     * avatar and the flag of the live connection, and the appearance token (APR-6). XMage
     * replaces the whole {@code UserData} on every update, so an object built from preferences
     * alone resets all three for everyone else at the table.
     */
    UserData withConnectionProfile(UserData prefs, String appearance);

    void startSims(JsonObject args, UUID roomId, UUID tableId);

    /** Whether the dev-only proxy SIM bots are enabled ({@code --sim on}). */
    boolean simEnabled();
}
