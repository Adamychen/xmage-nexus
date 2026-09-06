package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardLists;
import mage.game.match.MatchOptions;
import mage.players.PlayerType;
import mage.view.TableView;
import org.java_websocket.WebSocket;

import java.util.Locale;
import java.util.UUID;

/** Comandos de mesa/partida: crear, unirse, salir, arrancar, mirar. */
final class TableCommands {

    private TableCommands() {
    }

    static boolean handle(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) throws Exception {
        switch (action) {
            case "createTable": {
                long start = System.currentTimeMillis();
                MatchOptions options = MatchOptionsParser.parseMatchOptions(args);
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                Object result = ctx.session().createTable(roomId, options);
                boolean ok = result != null;
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, result));
                    if (result instanceof TableView) {
                        ctx.startSims(args, roomId, ((TableView) result).getTableId());
                    }
                }
                return true;
            }
            case "joinTable": {
                long start = System.currentTimeMillis();
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                String playerName = JsonArgs.str(args, "playerName", ctx.session().getUserName());
                PlayerType playerType = PlayerType.valueOf(JsonArgs.str(args, "playerType", "HUMAN").toUpperCase(Locale.ROOT));
                int skill = JsonArgs.getInt(args, "skill", 0);
                DeckCardLists deck = DeckJson.parse(args.getAsJsonObject("deck"));
                deck = DeckValidation.normalizeForXMage(deck, JsonArgs.str(args, "deckType", null), JsonArgs.str(args, "gameType", null));
                String password = JsonArgs.str(args, "password", "");
                boolean ok = ctx.session().joinTable(roomId, tableId, playerName, playerType, skill, deck, password);
                if (!ok) {
                    ctx.sendFailure(conn, action, requestId, start);
                } else {
                    ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                }
                return true;
            }
            case "leaveTable": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().leaveTable(roomId, tableId), null, null));
                return true;
            }
            case "removeTable": {
                // siempre la variante con roomId: removeTable(tableId) es la
                // variante de admin (adminTableRemove) y falla con "Wrong admin
                // access" para usuarios normales, dejando mesas huérfanas
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().removeTable(roomId, tableId), null, null));
                return true;
            }
            case "startMatch": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().startMatch(roomId, tableId), null, null));
                return true;
            }
            case "swapSeats": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                int seatNum1 = JsonArgs.getInt(args, "seatNum1", -1);
                int seatNum2 = JsonArgs.getInt(args, "seatNum2", -1);
                boolean ok = tableId != null && seatNum1 >= 0 && seatNum2 >= 0
                        && ctx.session().swapSeats(roomId, tableId, seatNum1, seatNum2);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, null, null));
                return true;
            }
            case "watchTable": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().watchTable(roomId, tableId), null, null));
                return true;
            }
            case "watchGame": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ctx.session().watchGame(gameId), null, null));
                return true;
            }
            default:
                return false;
        }
    }
}
