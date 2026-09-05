package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardLists;
import mage.constants.ManaType;
import mage.constants.PlayerAction;
import mage.players.net.SkipPrioritySteps;
import mage.players.net.UserData;
import mage.players.net.UserSkipPrioritySteps;
import org.java_websocket.WebSocket;

import java.util.UUID;

/** Comandos de partida: replay, mazos, preferencias y respuestas del jugador. */
final class GameCommands {

    private GameCommands() {
    }

    static UserData userDataFromPreferences(JsonObject args) {
        UserData userData = UserData.getDefaultUserDataView();
        userData.setConfirmEmptyManaPool(JsonArgs.getBool(args, "confirmEmptyManaPool", true));
        JsonObject phases = args.getAsJsonObject("phases");
        if (phases != null) {
            UserSkipPrioritySteps skips = new UserSkipPrioritySteps();
            JsonObject yourTurn = phases.getAsJsonObject("yourTurn");
            JsonObject opponentTurn = phases.getAsJsonObject("opponentTurn");
            if (yourTurn != null) {
                SkipPrioritySteps yt = skips.getYourTurn();
                yt.setUpkeep(JsonArgs.getBool(yourTurn, "upkeep", false));
                yt.setDraw(JsonArgs.getBool(yourTurn, "draw", false));
                yt.setMain1(JsonArgs.getBool(yourTurn, "main1", true));
                yt.setBeforeCombat(JsonArgs.getBool(yourTurn, "beginCombat", false));
                yt.setEndOfCombat(JsonArgs.getBool(yourTurn, "endCombat", false));
                yt.setMain2(JsonArgs.getBool(yourTurn, "main2", true));
                yt.setEndOfTurn(JsonArgs.getBool(yourTurn, "endStep", false));
            }
            if (opponentTurn != null) {
                SkipPrioritySteps ot = skips.getOpponentTurn();
                ot.setUpkeep(JsonArgs.getBool(opponentTurn, "upkeep", false));
                ot.setDraw(JsonArgs.getBool(opponentTurn, "draw", false));
                ot.setMain1(JsonArgs.getBool(opponentTurn, "main1", true));
                ot.setBeforeCombat(JsonArgs.getBool(opponentTurn, "beginCombat", false));
                ot.setEndOfCombat(JsonArgs.getBool(opponentTurn, "endCombat", false));
                ot.setMain2(JsonArgs.getBool(opponentTurn, "main2", true));
                ot.setEndOfTurn(JsonArgs.getBool(opponentTurn, "endStep", false));
            }
            userData.setUserSkipPrioritySteps(skips);
        }
        return userData;
    }

    static boolean handle(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) throws Exception {
        switch (action) {
            case "replayGame": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                boolean ok = gameId != null && ctx.session().replayGame(gameId);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, ok ? null : ProxyProtocol.ERR_FAILED, null));
                return true;
            }
            case "startReplay": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().startReplay(gameId), null, null));
                return true;
            }
            case "stopReplay": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().stopReplay(gameId), null, null));
                return true;
            }
            case "replayNext": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().nextPlay(gameId), null, null));
                return true;
            }
            case "replayPrevious": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().previousPlay(gameId), null, null));
                return true;
            }
            case "replaySkipForward": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                int moves = JsonArgs.getInt(args, "moves", 1);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().skipForward(gameId, moves), null, null));
                return true;
            }
            case "stopWatching": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().stopWatching(gameId), null, null));
                return true;
            }
            case "joinGame": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().joinGame(gameId), null, null));
                return true;
            }
            case "quitMatch": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().quitMatch(gameId), null, null));
                return true;
            }
            case "submitDeck": {
                long start = System.currentTimeMillis();
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                DeckCardLists deck = DeckJson.parse(args.getAsJsonObject("deck"));
                boolean ok = tableId != null && ctx.session().submitDeck(tableId, deck);
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                }
                return true;
            }
            case "updateDeck": {
                long start = System.currentTimeMillis();
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                DeckCardLists deck = DeckJson.parse(args.getAsJsonObject("deck"));
                boolean ok = tableId != null && ctx.session().updateDeck(tableId, deck);
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                }
                return true;
            }
            case "validateDeck": {
                DeckCardLists deck = args.has("deck") && args.get("deck").isJsonObject()
                        ? DeckJson.parse(args.getAsJsonObject("deck")) : null;
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, DeckValidation.validate(deck)));
                return true;
            }
            case "updatePreferences": {
                UserData userData = userDataFromPreferences(args);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().updatePreferencesForServer(userData), null, null));
                return true;
            }
            case "sendPlayerAction": {
                String actionName = JsonArgs.str(args, "action", "");
                PlayerAction playerAction = PlayerAction.valueOf(actionName);
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                Object data = JsonArgs.parseActionData(args.get("data"), actionName);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerAction(playerAction, gameId, data), null, null));
                return true;
            }
            case "sendPlayerUUID": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                UUID value = JsonArgs.uuid(args, "value", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerUUID(gameId, value), null, null));
                return true;
            }
            case "sendPlayerBoolean": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                boolean value = JsonArgs.getBool(args, "value", false);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerBoolean(gameId, value), null, null));
                return true;
            }
            case "sendPlayerInteger": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                int value = JsonArgs.getInt(args, "value", 0);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerInteger(gameId, value), null, null));
                return true;
            }
            case "sendPlayerString": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                String value = JsonArgs.str(args, "value", "");
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerString(gameId, value), null, null));
                return true;
            }
            case "sendPlayerManaType": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                UUID playerId = JsonArgs.uuid(args, "playerId", null);
                ManaType manaType = ManaType.valueOf(JsonArgs.str(args, "manaType", ""));
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().sendPlayerManaType(gameId, playerId, manaType), null, null));
                return true;
            }
            default:
                return false;
        }
    }
}
