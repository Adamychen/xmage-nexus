package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.players.PlayerType;
import mage.game.match.MatchOptions;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SimPlayerTest {

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

    private static Set<Character> setOf(Character... values) {
        return new LinkedHashSet<>(Arrays.asList(values));
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