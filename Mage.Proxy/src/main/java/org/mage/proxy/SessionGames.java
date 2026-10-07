package org.mage.proxy;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Logger;

/**
 * The games of the current server session: the ones it owns, and the ones being played or
 * watched right now.
 *
 * <p>Game ids are "owned" when seen via START_GAME / WATCHGAME / GAME_INIT since the last connect.
 * When the proxy switches users, the server re-sends the pending state of the previous user's
 * still-running games over the same channel; those events belong to games this session never
 * joined/watched, so they must not reach the new web client (they flooded the single-threaded
 * callback queue and starved real dialogs like WATCHGAME).
 */
final class SessionGames {

    // the session's logger: these lines belong to its log, and its level configuration applies
    private static final Logger logger = Logger.getLogger(ProxyClient.class.getName());

    /** Well above any real number of simultaneous games; only reached by months-long sessions. */
    static final int ALLOWLIST_LIMIT = 256;

    private final Set<UUID> owned = ConcurrentHashMap.newKeySet();
    /** Games being played or watched now: the lobby is polled much less meanwhile. */
    private final Set<UUID> inProgress = ConcurrentHashMap.newKeySet();
    private volatile long lastEventAt = 0;

    /** The session joined, started or watches this game. */
    void markActive(UUID gameId) {
        owned.add(gameId);
        inProgress.add(gameId);
        bound();
        touch();
    }

    void markInactive(UUID gameId) {
        inProgress.remove(gameId);
    }

    boolean owns(UUID gameId) {
        return owned.contains(gameId);
    }

    /** A game event of this session just went through. */
    void touch() {
        lastEventAt = System.currentTimeMillis();
    }

    /** New server session: nothing of the previous one may leak into it. */
    void clear() {
        owned.clear();
        inProgress.clear();
    }

    int inProgressCount() {
        return inProgress.size();
    }

    int ownedCount() {
        return owned.size();
    }

    long lastEventAt() {
        return lastEventAt;
    }

    /** For log lines: the ids of the games in progress. */
    String describeInProgress() {
        return inProgress.toString();
    }

    /**
     * The allowlist only ever grows (nothing removes an id once the game is over), which on a
     * session that plays for months is one UUID per game retained forever. Trim the finished ones
     * only: every id still in progress is a game the client is in, and dropping one of those would
     * silently swallow its events as foreign.
     */
    private void bound() {
        if (owned.size() <= ALLOWLIST_LIMIT) {
            return;
        }
        int before = owned.size();
        owned.removeIf(id -> !inProgress.contains(id));
        logger.info("Trimmed the per-session game allowlist from " + before + " to "
                + owned.size() + " ids (" + inProgress.size() + " still in progress)");
    }
}
