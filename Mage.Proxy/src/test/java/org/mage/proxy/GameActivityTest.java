package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameActivityTest {

    private final List<String> lines = new ArrayList<>();
    private final AtomicLong now = new AtomicLong(1_000_000);
    private final GameActivity activity = new GameActivity(
            (event, user, detail) -> lines.add(event + " user=" + user + " " + detail), now::get);
    private final UUID game = UUID.randomUUID();

    @Test
    void aFinishedGameReportsItsOutcomeTurnsAndDuration() {
        activity.opened(game, "ana", false);
        activity.turn(game, 3);
        activity.turn(game, 7);
        now.addAndGet(640_000);
        activity.ended(game, GameActivity.outcome(true, true, "You won the game on turn 7.", ""), 2);

        assertEquals(List.of(
                "game_start user=ana gameId=" + game + " role=player",
                "game_end user=ana gameId=" + game + " role=player result=won reason=finished turns=7 duration_s=640 players=2"
        ), lines);
        assertEquals(0, activity.openCount());
    }

    @Test
    void aReconnectThatResendsStartGameDoesNotOpenItTwice() {
        activity.opened(game, "ana", false);
        activity.opened(game, "ana", false);
        assertEquals(1, lines.size());
    }

    @Test
    void gamesStillOpenWhenTheSessionEndsAreUnfinished() {
        UUID watched = UUID.randomUUID();
        activity.opened(game, "ana", false);
        activity.opened(watched, "ana", true);
        activity.closeAll("grace_expired");

        assertTrue(lines.get(2).contains("role=player result=unfinished reason=grace_expired"), lines.get(2));
        assertTrue(lines.get(3).contains("role=watcher result=unfinished reason=grace_expired"), lines.get(3));
        assertEquals(0, activity.openCount());
    }

    @Test
    void aConcededMultiplayerGameThatGoesOnWithoutThePlayerIsNotUnfinished() {
        activity.opened(game, "ana", false);
        activity.conceded(game);
        activity.closeAll("disconnect");

        assertTrue(lines.get(1).contains("role=player result=conceded reason=disconnect"), lines.get(1));
        assertTrue(lines.get(1).endsWith("conceded=true"), lines.get(1));
    }

    @Test
    void leavingAGameEndsItOnceAndALateEndGameInfoIsIgnored() {
        activity.opened(game, "ana", false);
        activity.left(game);
        activity.ended(game, GameActivity.outcome(true, false, "You lost the game on turn 4.", ""), 2);
        activity.closeAll("disconnect");

        assertEquals(2, lines.size());
        assertTrue(lines.get(1).contains("result=quit reason=left"), lines.get(1));
    }

    @Test
    void stopWatchingIsRecordedAsWatched() {
        activity.opened(game, "ana", true);
        activity.left(game);
        assertTrue(lines.get(1).contains("role=watcher result=watched reason=left"), lines.get(1));
    }

    @Test
    void eventsOfAGameThatWasNeverOpenedAreIgnored() {
        activity.turn(game, 5);
        activity.conceded(game);
        activity.left(game);
        activity.ended(game, GameActivity.outcome(true, true, "", ""), 2);
        activity.opened(game, null, false);
        assertTrue(lines.isEmpty());
    }

    @Test
    void outcomeReadsTheResultAndCauseFromGameEndViewWording() {
        assertEquals("watched", GameActivity.outcome(false, false, null, "ana has quit the match. ").result);
        assertNull(GameActivity.outcome(false, false, null, "ana has quit the match. ").cause);
        assertEquals("draw", GameActivity.outcome(true, false, "Game is a draw on Turn 9.", "").result);
        assertEquals("lost", GameActivity.outcome(true, false, "You lost the game on turn 9.", "").result);

        assertEquals("timeout", GameActivity.outcome(true, false, "", "You run out of time. ").cause);
        assertEquals("idle", GameActivity.outcome(true, false, "", "You lost the match for being idle. ").cause);
        assertEquals("quit", GameActivity.outcome(true, false, "", "You have quit the match. ").cause);
        assertEquals("opponent_timeout", GameActivity.outcome(true, true, "", "bob runs out of time. ").cause);
        assertEquals("opponent_idle", GameActivity.outcome(true, true, "", "bob lost for being idle. ").cause);
        assertEquals("opponent_quit", GameActivity.outcome(true, true, "", "bob has quit the match. ").cause);
        assertNull(GameActivity.outcome(true, true, "", null).cause);
    }
}
