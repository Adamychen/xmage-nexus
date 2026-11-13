package org.mage.proxy;

import mage.players.PlayerType;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** LBY-30: getPlayerTypes only publishes seats a table accepts, so the draft bot never reaches the client. */
class PlayerTypesCommandTest {

    @Test
    void dropsTheDraftBot() {
        List<PlayerType> playable = InfoCommands.playableTypes(new PlayerType[]{
                PlayerType.HUMAN, PlayerType.COMPUTER_DRAFT_BOT, PlayerType.COMPUTER_MAD});

        assertEquals(List.of(PlayerType.HUMAN, PlayerType.COMPUTER_MAD), playable);
    }

    @Test
    void aServerWithNoPlayableAiPublishesNoAi() {
        List<PlayerType> playable = InfoCommands.playableTypes(new PlayerType[]{
                PlayerType.HUMAN, PlayerType.COMPUTER_DRAFT_BOT});

        assertEquals(List.of(PlayerType.HUMAN), playable);
        assertFalse(playable.stream().anyMatch(PlayerType::isAI));
    }

    @Test
    void everyPublishedTypeIsWorkable() {
        List<PlayerType> playable = InfoCommands.playableTypes(PlayerType.values());

        assertTrue(playable.size() < PlayerType.values().length);
        assertTrue(playable.stream().allMatch(PlayerType::isWorkablePlayer));
    }

    @Test
    void noServerStateYetIsAnEmptyList() {
        assertTrue(InfoCommands.playableTypes(null).isEmpty());
    }
}
