package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import mage.game.match.MatchOptions;
import mage.players.PlayerType;

import java.util.List;
import java.util.Locale;

/** Construcción de MatchOptions/TournamentOptions desde args JSON. */
final class MatchOptionsParser {

    private MatchOptionsParser() {
    }

    static MatchOptions parseMatchOptions(JsonObject args) {
        String name = JsonArgs.str(args, "name", "Game " + System.currentTimeMillis());
        String gameType = JsonArgs.str(args, "gameType", "");
        boolean multiPlayer = JsonArgs.getBool(args, "multiPlayer", false);
        MatchOptions options = new MatchOptions(name, gameType, multiPlayer);
        options.setDeckType(JsonArgs.str(args, "deckType", ""));
        options.setLimited(JsonArgs.getBool(args, "limited", false));
        options.setWinsNeeded(JsonArgs.getInt(args, "winsNeeded", 1));
        // default high value, so any user can create tables (real client lets the owner pick it)
        options.setQuitRatio(JsonArgs.getInt(args, "quitRatio", 100));
        options.setPassword(JsonArgs.str(args, "password", ""));
        options.setSpectatorsAllowed(JsonArgs.getBool(args, "spectatorsAllowed", true));
        if (args.has("rollbackTurnsAllowed")) {
            options.setRollbackTurnsAllowed(JsonArgs.getBool(args, "rollbackTurnsAllowed", true));
        }
        if (args.has("rated")) {
            options.setRated(JsonArgs.getBool(args, "rated", false));
        }
        if (args.has("skillLevel")) {
            try {
                options.setSkillLevel(mage.constants.SkillLevel.valueOf(JsonArgs.str(args, "skillLevel", "CASUAL").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("timeLimit")) {
            try {
                options.setMatchTimeLimit(mage.constants.MatchTimeLimit.valueOf(JsonArgs.str(args, "timeLimit", "NONE").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("bufferTime")) {
            try {
                options.setMatchBufferTime(mage.constants.MatchBufferTime.valueOf(JsonArgs.str(args, "bufferTime", "NONE").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("freeMulligans")) {
            options.setFreeMulligans(JsonArgs.getInt(args, "freeMulligans", 0));
        }
        if (args.has("attackOption")) {
            try {
                options.setAttackOption(mage.constants.MultiplayerAttackOption.valueOf(JsonArgs.str(args, "attackOption", "LEFT").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("range")) {
            try {
                options.setRange(mage.constants.RangeOfInfluence.valueOf(JsonArgs.str(args, "range", "ALL").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("minimumRating")) {
            options.setMinimumRating(JsonArgs.getInt(args, "minimumRating", 0));
        }
        if (args.has("quitRatio")) {
            options.setQuitRatio(JsonArgs.getInt(args, "quitRatio", 100));
        }
        if (args.has("edhPowerLevel")) {
            options.setEdhPowerLevel(JsonArgs.getInt(args, "edhPowerLevel", 100));
        }
        if (args.has("mulliganType")) {
            try {
                options.setMullgianType(mage.game.mulligan.MulliganType.valueOf(JsonArgs.str(args, "mulliganType", "GAME_DEFAULT").toUpperCase(Locale.ROOT)));
            } catch (Exception ignored) {
            }
        }
        if (args.has("customStartLifeEnabled")) {
            options.setCustomStartLifeEnabled(JsonArgs.getBool(args, "customStartLifeEnabled", false));
            if (args.has("customStartLife")) options.setCustomStartLife(JsonArgs.getInt(args, "customStartLife", 20));
        }
        if (args.has("customStartHandSizeEnabled")) {
            options.setCustomStartHandSizeEnabled(JsonArgs.getBool(args, "customStartHandSizeEnabled", false));
            if (args.has("customStartHandSize")) options.setCustomStartHandSize(JsonArgs.getInt(args, "customStartHandSize", 7));
        }
        if (args.has("planeChase")) {
            options.setPlaneChase(JsonArgs.getBool(args, "planeChase", false));
        }
        if (args.has("bannedUsers") && args.get("bannedUsers").isJsonArray()) {
            java.util.Set<String> banned = new java.util.HashSet<>();
            for (JsonElement e : args.getAsJsonArray("bannedUsers")) banned.add(e.getAsString());
            options.setBannedUsers(banned);
        }
        // modo test: no barajar el mazo inicial (la librería queda en el orden
        // enviado); los servidores sin modificar ignoran el campo
        options.setSkipInitShuffling(JsonArgs.getBool(args, "skipInitShuffling", false));
        // modo test: sin sorteo aleatorio de starting player (el primer jugador de
        // la mesa empieza); los servidores sin modificar ignoran el campo
        options.setSkipStartingPlayerChoice(JsonArgs.getBool(args, "skipStartingPlayerChoice", false));
        options.getPlayerTypes().add(PlayerType.HUMAN);
        if (args.has("playerTypes")) {
            JsonArray arr = args.getAsJsonArray("playerTypes");
            List<PlayerType> types = new java.util.ArrayList<>();
            for (JsonElement e : arr) {
                String raw = e.getAsString();
                if ("SIM".equalsIgnoreCase(raw)) {
                    // asiento simulado: el servidor oficial ve un asiento humano normal
                    types.add(PlayerType.HUMAN);
                } else {
                    types.add(PlayerType.valueOf(raw.toUpperCase(Locale.ROOT)));
                }
            }
            if (!types.isEmpty()) {
                options.getPlayerTypes().clear();
                options.getPlayerTypes().addAll(types);
            }
        }
        return options;
    }

    static mage.game.tournament.TournamentOptions parseTournamentOptions(JsonObject args) {
        String name = JsonArgs.str(args, "name", "Tournament " + System.currentTimeMillis());
        String tournamentType = JsonArgs.str(args, "tournamentType", "Elimination");
        String matchType = JsonArgs.str(args, "matchType", JsonArgs.str(args, "gameType", "Two Player Duel"));
        boolean isSingleMultiplayerGame = JsonArgs.getBool(args, "isSingleMultiplayerGame", false);
        mage.game.tournament.TournamentOptions tOpts = new mage.game.tournament.TournamentOptions(name, matchType, isSingleMultiplayerGame);
        tOpts.setTournamentType(tournamentType);
        if (args.has("numberRounds")) tOpts.setNumberRounds(JsonArgs.getInt(args, "numberRounds", 0));
        if (args.has("password")) tOpts.setPassword(JsonArgs.str(args, "password", ""));
        if (args.has("quitRatio")) tOpts.setQuitRatio(JsonArgs.getInt(args, "quitRatio", 100));
        if (args.has("minimumRating")) tOpts.setMinimumRating(JsonArgs.getInt(args, "minimumRating", 0));
        if (args.has("watchingAllowed")) tOpts.setWatchingAllowed(JsonArgs.getBool(args, "watchingAllowed", true));
        if (args.has("playerTypes")) {
            JsonArray arr = args.getAsJsonArray("playerTypes");
            List<PlayerType> types = new java.util.ArrayList<>();
            for (JsonElement e : arr) {
                String raw = e.getAsString();
                if ("SIM".equalsIgnoreCase(raw)) types.add(PlayerType.HUMAN);
                else try { types.add(PlayerType.valueOf(raw.toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
            }
            if (!types.isEmpty()) {
                tOpts.getPlayerTypes().clear();
                tOpts.getPlayerTypes().addAll(types);
            }
        }
        // matchOptions sub-fields
        MatchOptions mOpts = tOpts.getMatchOptions();
        mOpts.setDeckType(JsonArgs.str(args, "deckType", ""));
        mOpts.setLimited(JsonArgs.getBool(args, "limited", false));
        mOpts.setWinsNeeded(JsonArgs.getInt(args, "winsNeeded", 1));
        mOpts.setQuitRatio(JsonArgs.getInt(args, "quitRatio", 100));
        mOpts.setPassword(JsonArgs.str(args, "password", ""));
        mOpts.setSpectatorsAllowed(JsonArgs.getBool(args, "spectatorsAllowed", true));
        if (args.has("rollbackTurnsAllowed")) {
            mOpts.setRollbackTurnsAllowed(JsonArgs.getBool(args, "rollbackTurnsAllowed", true));
        }
        if (args.has("rated")) {
            mOpts.setRated(JsonArgs.getBool(args, "rated", false));
        }
        if (args.has("skillLevel")) {
            try { mOpts.setSkillLevel(mage.constants.SkillLevel.valueOf(JsonArgs.str(args, "skillLevel", "CASUAL").toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
        }
        if (args.has("timeLimit")) {
            try { mOpts.setMatchTimeLimit(mage.constants.MatchTimeLimit.valueOf(JsonArgs.str(args, "timeLimit", "NONE").toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
        }
        if (args.has("bufferTime")) {
            try { mOpts.setMatchBufferTime(mage.constants.MatchBufferTime.valueOf(JsonArgs.str(args, "bufferTime", "NONE").toUpperCase(Locale.ROOT))); } catch (Exception ignored) {}
        }
        if (args.has("bannedUsers") && args.get("bannedUsers").isJsonArray()) {
            java.util.Set<String> banned = new java.util.HashSet<>();
            for (JsonElement e : args.getAsJsonArray("bannedUsers")) banned.add(e.getAsString());
            mOpts.setBannedUsers(banned);
        }
        // limitedOptions
        if (args.has("limitedOptions") && args.get("limitedOptions").isJsonObject()) {
            JsonObject lo = args.getAsJsonObject("limitedOptions");
            mage.game.tournament.LimitedOptions lim = new mage.game.tournament.LimitedOptions();
            if (lo.has("constructionTime")) lim.setConstructionTime(JsonArgs.getInt(lo, "constructionTime", 600));
            if (lo.has("numberBoosters")) lim.setNumberBoosters(JsonArgs.getInt(lo, "numberBoosters", 3));
            if (lo.has("draftCubeName")) lim.setDraftCubeName(JsonArgs.str(lo, "draftCubeName", ""));
            try {
                java.lang.reflect.Field f = mage.game.tournament.LimitedOptions.class.getDeclaredField("sets");
                f.setAccessible(true);
                @SuppressWarnings("unchecked")
                List<String> sets = (List<String>) f.get(lim);
                if (lo.has("setCodes") && lo.get("setCodes").isJsonArray()) {
                    for (JsonElement e : lo.getAsJsonArray("setCodes")) sets.add(e.getAsString());
                } else if (lo.has("sets") && lo.get("sets").isJsonArray()) {
                    for (JsonElement e : lo.getAsJsonArray("sets")) sets.add(e.getAsString());
                }
            } catch (Exception ignored) {}
            tOpts.setLimitedOptions(lim);
        }
        return tOpts;
    }
}
