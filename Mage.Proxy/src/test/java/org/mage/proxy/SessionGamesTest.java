package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The allowlist trim is covered through the client in {@link ProxyClientCleanupTest}. */
class SessionGamesTest {

    @Test
    void aFinishedGameStaysOwnedButNotInProgress() {
        SessionGames games = new SessionGames();
        UUID game = UUID.randomUUID();
        games.markActive(game);
        games.markInactive(game);
        assertTrue(games.owns(game), "its late events still belong to this session");
        assertEquals(0, games.inProgressCount());
    }

    @Test
    void clearForgetsEverything() {
        SessionGames games = new SessionGames();
        UUID game = UUID.randomUUID();
        games.markActive(game);
        games.clear();
        assertFalse(games.owns(game));
        assertEquals(0, games.inProgressCount());
    }
}
