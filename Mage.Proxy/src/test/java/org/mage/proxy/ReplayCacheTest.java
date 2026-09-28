package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class ReplayCacheTest {

    private static final UUID GAME = UUID.fromString("00000000-0000-0000-0000-00000000000a");

    @Test
    void aStateUpdateAfterThePromptKeepsThePromptForTheReplay() {
        ReplayCache cache = new ReplayCache();
        cache.onState(GAME, "state1", false);
        cache.onPrompt(GAME, "GAME_TARGET", "prompt");
        cache.onState(GAME, "state2", false);
        assertEquals(Arrays.asList("state2", "prompt"), cache.replay(GAME));
    }

    @Test
    void answeringTakesThePromptOut() {
        ReplayCache cache = new ReplayCache();
        cache.onState(GAME, "state", false);
        cache.onPrompt(GAME, "GAME_ASK", "ask");
        assertNotNull(cache.takePrompt(GAME));
        assertEquals(Collections.singletonList("state"), cache.replay(GAME));
    }

    @Test
    void aRejectedAnswerPutsThePromptBackUnlessANewerOneArrived() {
        ReplayCache cache = new ReplayCache();
        cache.onPrompt(GAME, "GAME_ASK", "ask");
        ReplayCache.Prompt taken = cache.takePrompt(GAME);
        cache.restorePrompt(GAME, taken);
        assertEquals(Collections.singletonList("ask"), cache.replay(GAME));

        taken = cache.takePrompt(GAME);
        cache.onPrompt(GAME, "GAME_SELECT", "select");
        cache.restorePrompt(GAME, taken);
        assertEquals(Collections.singletonList("select"), cache.replay(GAME));
    }

    @Test
    void aPriorityPassOnlyAnswersAGameSelect() {
        ReplayCache cache = new ReplayCache();
        cache.onPrompt(GAME, "GAME_TARGET", "target");
        assertNull(cache.takePromptIfSelect(GAME));
        assertEquals(Collections.singletonList("target"), cache.replay(GAME));
        cache.onPrompt(GAME, "GAME_SELECT", "select");
        assertNotNull(cache.takePromptIfSelect(GAME));
        assertEquals(0, cache.replay(GAME).size());
    }

    @Test
    void aGameInitOrTheEndOfTheGameDropsThePrompt() {
        ReplayCache cache = new ReplayCache();
        cache.onPrompt(GAME, "GAME_SELECT", "select");
        cache.onState(GAME, "init", true);
        assertEquals(Collections.singletonList("init"), cache.replay(GAME));
        cache.onPrompt(GAME, "GAME_SELECT", "select");
        cache.onGameEnded(GAME);
        assertEquals(Collections.singletonList("init"), cache.replay(GAME));
    }

    @Test
    void onlyTheLastFinishedGameKeepsItsState() {
        // The states map held one GameUpdate (200-800 KB) per game the session ever played,
        // for as long as the user stayed logged in. A client that re-attaches right after a game
        // over still needs that final board, so the most recent one is kept - in a single slot.
        UUID first = UUID.fromString("00000000-0000-0000-0000-00000000000b");
        UUID second = UUID.fromString("00000000-0000-0000-0000-00000000000c");
        ReplayCache cache = new ReplayCache();
        cache.onState(first, "state1", false);
        cache.onGameEnded(first);
        assertEquals(Collections.singletonList("state1"), cache.replay(first));

        cache.onState(second, "state2", false);
        cache.onGameEnded(second);
        assertEquals(Collections.singletonList("state2"), cache.replay(second));
        assertEquals(Collections.emptyList(), cache.replay(first), "the older finished game is gone");
        assertEquals(0, cache.stateCount(), "no finished game is retained in the map");
    }

    @Test
    void gamesInProgressKeepTheirStates() {
        // only finished games are dropped: a state is what a resuming client replays, so the
        // games still being played are the ones that must stay (and there are few of them)
        ReplayCache cache = new ReplayCache();
        cache.onState(GAME, "state", false);
        cache.onState(UUID.fromString("00000000-0000-0000-0000-00000000000b"), "other", false);
        assertEquals(2, cache.stateCount());
        assertEquals(Collections.singletonList("state"), cache.replay(GAME));
        assertEquals(Collections.singletonList("other"),
                cache.replay(UUID.fromString("00000000-0000-0000-0000-00000000000b")));
    }

    @Test
    void aNewStateForAFinishedGameTakesItOutOfTheSlot() {
        ReplayCache cache = new ReplayCache();
        cache.onState(GAME, "ended", false);
        cache.onGameEnded(GAME);
        cache.onState(GAME, "restarted", true);
        assertEquals(Collections.singletonList("restarted"), cache.replay(GAME));
        assertEquals(0, cache.finishedSlotCount(), "the map is the only holder now");
    }

    @Test
    void clearDropsTheFinishedGameToo() {
        ReplayCache cache = new ReplayCache();
        cache.onState(GAME, "state", false);
        cache.onGameEnded(GAME);
        cache.clear();
        assertEquals(Collections.emptyList(), cache.replay(GAME));
        assertEquals(0, cache.finishedSlotCount());
    }
}
