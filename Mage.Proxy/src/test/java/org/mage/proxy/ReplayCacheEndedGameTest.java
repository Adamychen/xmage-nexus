package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** A trailing update of a finished game must not put its state back in the cache. */
class ReplayCacheEndedGameTest {

    @Test
    void aTrailingUpdateAfterTheGameEndedIsNotCachedAgain() {
        ReplayCache cache = new ReplayCache();
        UUID game = UUID.randomUUID();
        cache.onState(game, "FINAL-STATE", false);
        cache.onGameEnded(game);
        cache.onState(game, "TRAILING-STATE-200KB", false);

        assertEquals(0, cache.stateCount(), "no state of a finished game stays in the per-game cache");
        assertEquals(Collections.singletonList("FINAL-STATE"), cache.replay(game),
                "the one finished-game slot keeps the state the game ended with");
    }
}
