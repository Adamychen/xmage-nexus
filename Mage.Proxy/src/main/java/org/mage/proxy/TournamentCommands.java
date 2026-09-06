package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardLists;
import mage.players.PlayerType;
import org.java_websocket.WebSocket;

import java.util.Locale;
import java.util.UUID;

/** Comandos de torneo y draft. */
final class TournamentCommands {

    private TournamentCommands() {
    }

    static boolean handle(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) throws Exception {
        switch (action) {
            case "createTournamentTable": {
                long start = System.currentTimeMillis();
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);
                Object result = ctx.session().createTournamentTable(roomId, tOpts);
                boolean ok = result != null;
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, result));
                }
                return true;
            }
            case "joinTournamentTable": {
                long start = System.currentTimeMillis();
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                String playerName = JsonArgs.str(args, "playerName", ctx.session().getUserName());
                PlayerType playerType = PlayerType.valueOf(JsonArgs.str(args, "playerType", "HUMAN").toUpperCase(Locale.ROOT));
                int skill = JsonArgs.getInt(args, "skill", 0);
                DeckCardLists deck = args.has("deck") && args.get("deck").isJsonObject() ? DeckJson.parse(args.getAsJsonObject("deck")) : null;
                deck = DeckValidation.normalizeForXMage(deck, JsonArgs.str(args, "deckType", null), JsonArgs.str(args, "gameType", null));
                String password = JsonArgs.str(args, "password", "");
                boolean ok = ctx.session().joinTournamentTable(roomId, tableId, playerName, playerType, skill, deck, password);
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                }
                return true;
            }
            case "watchTournamentTable": {
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().watchTournamentTable(tableId), null, null));
                return true;
            }
            case "startTournament": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                boolean ok = tableId != null && ctx.session().startTournament(roomId, tableId);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, null, null));
                return true;
            }
            case "getTournament": {
                UUID tournamentId = JsonArgs.uuid(args, "tournamentId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, tournamentId != null, tournamentId == null ? ProxyProtocol.ERR_INVALID_ARGUMENT : null, tournamentId != null ? ctx.session().getTournament(tournamentId) : null));
                return true;
            }
            case "getTournamentChatId": {
                UUID tournamentId = JsonArgs.uuid(args, "tournamentId", null);
                java.util.Optional<UUID> chatId = tournamentId != null ? ctx.session().getTournamentChatId(tournamentId) : java.util.Optional.empty();
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, chatId.orElse(null)));
                return true;
            }
            case "quitTournament": {
                UUID tournamentId = JsonArgs.uuid(args, "tournamentId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, tournamentId != null && ctx.session().quitTournament(tournamentId), null, null));
                return true;
            }
            case "quitDraft": {
                UUID draftId = JsonArgs.uuid(args, "draftId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, draftId != null && ctx.session().quitDraft(draftId), null, null));
                return true;
            }
            case "sendCardPick": {
                UUID draftId = JsonArgs.uuid(args, "draftId", null);
                UUID cardId = JsonArgs.uuid(args, "cardId", null);
                java.util.Set<UUID> hidden = null;
                if (args.has("hiddenCards") && args.get("hiddenCards").isJsonArray()) {
                    hidden = new java.util.HashSet<>();
                    for (JsonElement e : args.getAsJsonArray("hiddenCards")) {
                        try { hidden.add(UUID.fromString(e.getAsString())); } catch (Exception ignored) {}
                    }
                }
                Object res = (draftId != null && cardId != null) ? ctx.session().sendCardPick(draftId, cardId, hidden) : null;
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, res != null, res == null ? ProxyProtocol.ERR_FAILED : null, res));
                return true;
            }
            case "sendCardMark": {
                UUID draftId = JsonArgs.uuid(args, "draftId", null);
                UUID cardId = JsonArgs.uuid(args, "cardId", null);
                Object res = (draftId != null && cardId != null) ? ctx.session().sendCardMark(draftId, cardId) : null;
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, res));
                return true;
            }
            case "setBoosterLoaded": {
                UUID draftId = JsonArgs.uuid(args, "draftId", null);
                boolean ok = draftId != null && ctx.session().setBoosterLoaded(draftId);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ok));
                return true;
            }
            default:
                return false;
        }
    }
}
