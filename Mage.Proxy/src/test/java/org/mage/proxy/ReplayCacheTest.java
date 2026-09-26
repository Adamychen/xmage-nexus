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
}
