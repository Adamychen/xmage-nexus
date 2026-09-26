package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.constants.PlayerAction;
import mage.players.PlayerType;
import mage.game.match.MatchOptions;
import mage.remote.SessionImpl;
import mage.view.CardsView;
import mage.view.GameClientMessage;
import mage.view.UserRequestMessage;
import org.junit.jupiter.api.Test;

import java.io.Serializable;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SimPlayerTest {

    @Test
    void nextBlockerSkipsBlockersTheServerAlreadyRejected() {
        UUID wall = UUID.randomUUID();
        UUID bear = UUID.randomUUID();
        Set<UUID> tried = new LinkedHashSet<>();
        assertEquals(wall, SimPlayer.nextBlocker(Arrays.asList(wall, bear), tried));
        tried.add(wall);
        assertEquals(bear, SimPlayer.nextBlocker(Arrays.asList(wall, bear), tried));
        tried.add(bear);
        assertNull(SimPlayer.nextBlocker(Arrays.asList(wall, bear), tried));
        assertNull(SimPlayer.nextBlocker(null, tried));
    }

    @Test
    void parseMatchOptionsMapsSimSeatsToHuman() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "t");
        args.addProperty("gameType", "Two Player Duel");
        args.addProperty("deckType", "Constructed - Modern");
        JsonArray types = new JsonArray();
        types.add("HUMAN");
        types.add("SIM");
        args.add("playerTypes", types);

        MatchOptions options = MatchOptionsParser.parseMatchOptions(args);

        assertEquals(2, options.getPlayerTypes().size());
        assertEquals(PlayerType.HUMAN, options.getPlayerTypes().get(0));
        // el asiento SIM se materializa como un asiento humano normal para el servidor
        assertEquals(PlayerType.HUMAN, options.getPlayerTypes().get(1));
    }

    @Test
    void parseMatchOptionsKeepsRealAiTypes() {
        JsonObject args = new JsonObject();
        JsonArray types = new JsonArray();
        types.add("COMPUTER_MAD");
        types.add("SIM");
        args.add("playerTypes", types);

        MatchOptions options = MatchOptionsParser.parseMatchOptions(args);

        assertEquals(PlayerType.COMPUTER_MAD, options.getPlayerTypes().get(0));
        assertEquals(PlayerType.HUMAN, options.getPlayerTypes().get(1));
    }

    @Test
    void parseTournamentOptionsForwardsLobbyFlags() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft");
        args.addProperty("rated", true);
        args.addProperty("rollbackTurnsAllowed", false);
        args.addProperty("isSingleMultiplayerGame", true);
        JsonArray banned = new JsonArray();
        banned.add("griefer");
        args.add("bannedUsers", banned);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getMatchOptions().isRated());
        assertTrue(!tOpts.getMatchOptions().isRollbackTurnsAllowed());
        assertTrue(tOpts.getMatchOptions().isSingleGameTourney());
        assertTrue(tOpts.getMatchOptions().getBannedUsers().contains("griefer"));
    }

    @Test
    void parseTournamentOptionsBuildsDraftOptionsWhenTimingPresent() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("constructionTime", 600);
        lo.addProperty("numberBoosters", 3);
        lo.addProperty("timing", "PROFESSIONAL");
        JsonArray codes = new JsonArray();
        codes.add("M21");
        lo.add("setCodes", codes);
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions);
        assertEquals(mage.game.draft.DraftOptions.TimingOption.PROFESSIONAL,
                ((mage.game.draft.DraftOptions) tOpts.getLimitedOptions()).getTiming());
    }

    @Test
    void parseTournamentOptionsKeepsBaseLimitedOptionsWithoutTiming() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Sealed Night");
        args.addProperty("tournamentType", "Sealed Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("constructionTime", 600);
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(!(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions));
    }

    @Test
    void parseTournamentOptionsDefaultsPasswordAndLimitedOptions() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "No Extras");
        args.addProperty("tournamentType", "Constructed Elimination");

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertEquals("", tOpts.getPassword());
        assertTrue(tOpts.getLimitedOptions() != null);
        assertTrue(!(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions));
    }

    @Test
    void mulliganAskDetection() {
        assertTrue(SimPlayer.isMulliganAsk("Do you want to keep your hand? (Mulligan)"));
        assertTrue(!SimPlayer.isMulliganAsk("Do you want to pass priority? You have mana in your mana pool"));
    }

    @Test
    void requiredColorsParsesManaSymbols() {
        assertEquals(setOf('R', 'W'), SimPlayer.requiredColors("Pay {R}{W}"));
        assertEquals(setOf('U'), SimPlayer.requiredColors("Pay {U}{2}"));
        assertEquals(setOf(), SimPlayer.requiredColors("Pay {2}{2}"));
        assertEquals(setOf(), SimPlayer.requiredColors(null));
    }

    // GAME_TARGET de la sobrecarga Cards (Fact or Fiction y similares): data.targets
    // llega null y los ids están en options.possibleTargets; el SIM debe elegir una
    // carta válida con sendPlayerUUID (NO cancelar) y cerrar con sendPlayerBoolean.

    @Test
    void cardTargetWithPossibleTargetsPicksAValidCard() {
        UUID a = UUID.fromString("00000000-0000-0000-0000-00000000000a");
        UUID b = UUID.fromString("00000000-0000-0000-0000-00000000000b");
        UUID c = UUID.fromString("00000000-0000-0000-0000-00000000000c");
        Map<String, Serializable> options = new HashMap<>();
        options.put("possibleTargets", new LinkedHashSet<>(Arrays.asList(c, b, a)));
        options.put("chosenTargets", new LinkedHashSet<UUID>());
        options.put("UI.right.btn.text", "Done");

        // min=0: el primer prompt ya trae "Done", pero sin ninguna carta elegida
        // toca seleccionar (nunca cerrar en vacío)
        assertTrue(!SimPlayer.cardTargetDone(options));
        assertTrue(Arrays.asList(a, b, c).contains(SimPlayer.cardTargetPick(options)));
        assertEquals(a, SimPlayer.cardTargetPick(options));
    }

    @Test
    void cardTargetDoneAfterAPickAndNotBefore() {
        UUID a = UUID.fromString("00000000-0000-0000-0000-00000000000a");
        Map<String, Serializable> options = new HashMap<>();
        options.put("possibleTargets", new LinkedHashSet<>(Arrays.asList(a)));
        options.put("chosenTargets", new LinkedHashSet<UUID>());
        options.put("UI.right.btn.text", "Done");
        assertTrue(!SimPlayer.cardTargetDone(options));

        options.put("chosenTargets", new LinkedHashSet<>(Arrays.asList(a)));
        assertTrue(SimPlayer.cardTargetDone(options));
    }

    @Test
    void cardTargetWithoutPossibleTargetsHasNoPick() {
        assertNull(SimPlayer.cardTargetPick(null));
        assertNull(SimPlayer.cardTargetPick(new HashMap<>()));
        assertTrue(!SimPlayer.cardTargetDone(null));
    }

    @Test
    void onTargetCardsOverloadSendsAValidUuidInsteadOfCancelling() {
        RecordingSession session = new RecordingSession();
        SimPlayer sim = new SimPlayer("sim-test", session);
        UUID a = UUID.fromString("00000000-0000-0000-0000-00000000000a");
        UUID b = UUID.fromString("00000000-0000-0000-0000-00000000000b");
        Map<String, Serializable> options = new HashMap<>();
        options.put("possibleTargets", new LinkedHashSet<>(Arrays.asList(b, a)));
        options.put("chosenTargets", new LinkedHashSet<UUID>());
        options.put("UI.right.btn.text", "Done");
        GameClientMessage prompt = new GameClientMessage(null, options, "cards to put in the first pile", new CardsView(), null, false);

        sim.onTarget(prompt);

        assertEquals(a, session.lastUuid);
        assertNull(session.lastBoolean);

        // segundo prompt con la carta ya elegida: cierra la selección con un booleano
        options.put("chosenTargets", new LinkedHashSet<>(Arrays.asList(a)));
        sim.onTarget(prompt);

        assertEquals(Boolean.FALSE, session.lastBoolean);
    }

    @Test
    void acceptsRollbackRequestsSoTheVoteCanComplete() {
        RecordingSession session = new RecordingSession();
        SimPlayer sim = new SimPlayer("sim-test", session);
        UUID game = UUID.fromString("00000000-0000-0000-0000-0000000000a1");
        UUID requester = UUID.fromString("00000000-0000-0000-0000-0000000000b2");
        UserRequestMessage request = new UserRequestMessage("Request by sim-test", "Allow rollback to the start of the current turn?");
        request.setGameId(game);
        request.setRelatedUser(requester, "Alice");
        request.setButton1("Accept", PlayerAction.ADD_PERMISSION_TO_ROLLBACK_TURN);
        request.setButton2("Deny", PlayerAction.DENY_PERMISSION_TO_ROLLBACK_TURN);

        sim.onUserRequest(request, null);

        assertEquals(PlayerAction.ADD_PERMISSION_TO_ROLLBACK_TURN, session.lastAction);
        assertEquals(game, session.lastActionGame);
        assertEquals(requester, session.lastActionData);
    }

    @Test
    void ignoresOtherUserRequests() {
        RecordingSession session = new RecordingSession();
        SimPlayer sim = new SimPlayer("sim-test", session);
        UserRequestMessage request = new UserRequestMessage("User request", "Allow user <b>Eve</b> for this match to see your hand cards?");
        request.setGameId(UUID.randomUUID());
        request.setRelatedUser(UUID.randomUUID(), "Eve");
        request.setButton1("Accept", PlayerAction.ADD_PERMISSION_TO_SEE_HAND_CARDS);
        request.setButton2("Reject", null);

        sim.onUserRequest(request, null);

        assertNull(session.lastAction);
        assertTrue(!SimPlayer.isRollbackRequest(null));
    }

    private static Set<Character> setOf(Character... values) {
        return new LinkedHashSet<>(Arrays.asList(values));
    }

    private static final class RecordingSession extends SessionImpl {
        private UUID lastUuid;
        private Boolean lastBoolean;
        private PlayerAction lastAction;
        private UUID lastActionGame;
        private Object lastActionData;

        private RecordingSession() {
            super(null);
        }

        @Override
        public boolean sendPlayerUUID(UUID gameId, UUID data) {
            lastUuid = data;
            return true;
        }

        @Override
        public boolean sendPlayerBoolean(UUID gameId, boolean data) {
            lastBoolean = data;
            return true;
        }

        @Override
        public boolean sendPlayerAction(PlayerAction action, UUID gameId, Object data) {
            lastAction = action;
            lastActionGame = gameId;
            lastActionData = data;
            return true;
        }
    }

    @Test
    void seatSkillAtReadsByBotIndex() {
        JsonArray skills = new JsonArray();
        skills.add(2);
        skills.add(7);
        assertEquals(2, SimManager.seatSkillAt(skills, 0));
        assertEquals(7, SimManager.seatSkillAt(skills, 1));
        assertEquals(0, SimManager.seatSkillAt(skills, 2));
        assertEquals(0, SimManager.seatSkillAt(null, 0));
        assertEquals(0, SimManager.seatSkillAt(skills, -1));
    }

    @Test
    void normalizeHostMapsLocalhostToLoopback() {
        // Gateway.handleConnect y ProxyClient.connect deben calcular la misma
        // clave host|username: si difieren, el segundo connect duplica la
        // sesión y el servidor expulsa a la primera (mismo host).
        assertEquals("127.0.0.1", ProxyClient.normalizeHost("localhost"));
        assertEquals("127.0.0.1", ProxyClient.normalizeHost("LOCALHOST"));
        assertEquals("127.0.0.1", ProxyClient.normalizeHost("127.0.0.1"));
        assertEquals("beta.xmage.today", ProxyClient.normalizeHost("beta.xmage.today"));
    }
}