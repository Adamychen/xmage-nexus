package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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

    // ── sonda: daño de comandante ───────────────────────────────────────────────

    private GameActivity.FrameCommander commander(UUID id, String name, String... rules) {
        return new GameActivity.FrameCommander(id, name, List.of(rules));
    }

    @Test
    void commanderDamageIsJournaledOnlyWhenTotalsChange() {
        activity.opened(game, "ana", false);
        UUID krenko = UUID.randomUUID();
        List<GameActivity.FrameCommander> hit = List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b>",
                        "<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>sim-137363</font>."));
        activity.commanderFrame(game, "ana", 4, hit);
        activity.commanderFrame(game, "ana", 4, hit); // mismo frame: sin duplicado
        activity.commanderFrame(game, "ana", 5, List.of(
                commander(krenko, "Krenko, Mob Boss", "<b>Commander</b>"))); // sin daño todavía: sin línea

        // lines.get(0) es el game_start de opened()
        assertEquals(2, lines.size());
        assertTrue(lines.get(1).startsWith("commander_damage user=ana "), lines.get(1));
        assertTrue(lines.get(1).contains("gameId=" + game + " turn=4 "), lines.get(1));
        assertTrue(lines.get(1).contains("Krenko, Mob Boss{sim-137363=3}"), lines.get(1));
    }

    @Test
    void commanderDamageTotalsGrowWithNewHitsAndSeveralTargetsShareTheLine() {
        activity.opened(game, "ana", false);
        UUID krenko = UUID.randomUUID();
        activity.commanderFrame(game, "ana", 3, List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>sim-1</font>.")));
        activity.commanderFrame(game, "ana", 7, List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b> did 8 combat damage to player <font color='#20B2AA'>sim-1</font>.",
                        "<b>Commander</b> did 5 combat damage to player <font color='#20B2AA'>ana</font>.")));

        assertEquals(3, lines.size());
        assertTrue(lines.get(2).contains("sim-1=8"), lines.get(2));
        assertTrue(lines.get(2).contains("ana=5"), lines.get(2));
    }

    @Test
    void aCommanderWithDamageThatVanishesFromEveryVisibleZoneIsFlaggedOnce() {
        activity.opened(game, "ana", false);
        UUID krenko = UUID.randomUUID();
        List<GameActivity.FrameCommander> onBoard = List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b> did 6 combat damage to player <font color='#20B2AA'>sim-1</font>."));
        activity.commanderFrame(game, "ana", 4, onBoard);
        // el comandante bota a la mano rival: ninguna zona visible lo muestra
        activity.commanderFrame(game, "ana", 5, List.of());
        // sigue invisible en frames posteriores: sin repetir
        activity.commanderFrame(game, "ana", 6, List.of());
        // vuelve a verse con los mismos totales: el dump no cambia, sin línea nueva
        activity.commanderFrame(game, "ana", 7, onBoard);

        assertEquals(3, lines.size());
        assertTrue(lines.get(1).startsWith("commander_damage "), lines.get(1));
        assertTrue(lines.get(2).startsWith("commander_hidden "), lines.get(2));
        assertTrue(lines.get(2).contains("commander=Krenko, Mob Boss totals={sim-1=6}"), lines.get(2));
    }

    @Test
    void aGameWithoutCommanderDamageJournalsNothing() {
        activity.opened(game, "ana", false);
        UUID goblin = UUID.randomUUID();
        activity.commanderFrame(game, "ana", 3, List.of(
                commander(goblin, "Goblin Guide", "Haste. Whenever {this} attacks, defending player gets a Map token.")));
        // sin el marcador <b>Commander</b> al principio de una regla, no es un comandante
        activity.commanderFrame(game, "ana", 4, List.of(
                commander(UUID.randomUUID(), "Krenko, Mob Boss", "Whenever {this} attacks...")));
        activity.commanderFrame(game, "ana", 5, List.of());

        // solo el game_start: la sonda no emite nada sin daño de comandante real
        assertEquals(1, lines.size());
    }

    @Test
    void theWireTotalsAreAuthoritativeSoARollbackLowersTheReportedDamage() {
        activity.opened(game, "ana", false);
        UUID krenko = UUID.randomUUID();
        activity.commanderFrame(game, "ana", 6, List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b> did 9 combat damage to player <font color='#20B2AA'>sim-1</font>.")));
        activity.commanderFrame(game, "ana", 4, List.of(
                commander(krenko, "Krenko, Mob Boss",
                        "<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>sim-1</font>.")));

        assertEquals(3, lines.size());
        assertTrue(lines.get(2).contains("sim-1=3"), lines.get(2));
    }

    @Test
    void concatenatedDamageSentencesInOneRulesStringAreParsedSentenceBySentence() {
        Map<String, Integer> totals = GameActivity.parseDamageTotals(List.of(
                "<b>Commander</b> did 3 combat damage to player <font color='#20B2AA'>bob</font>. <b>Commander</b> did 5 combat damage to player <font color='#20B2AA'>carol</font>."));
        assertEquals(3, totals.get("bob"));
        assertEquals(5, totals.get("carol"));
    }

    @Test
    void damageLinesWithoutTheCommanderMarkerAreNotDamage() {
        assertTrue(GameActivity.parseDamageTotals(
                List.of("Lightning Bolt deals 3 damage to any target.")).isEmpty());
        assertTrue(GameActivity.isCommanderRules(List.of("<b>Commander</b> did 3 combat damage to player bob.")));
        assertTrue(GameActivity.isCommanderRules(List.of("<b>Commander</b>")));
        assertFalse(GameActivity.isCommanderRules(null));
        assertFalse(GameActivity.isCommanderRules(List.of("Companion — Your starting deck...")));
    }
}
