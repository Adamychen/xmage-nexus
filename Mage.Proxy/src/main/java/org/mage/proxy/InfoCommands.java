package org.mage.proxy;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;

import java.util.Arrays;
import java.util.UUID;

/** Comandos de lectura: info del servidor, tipos, mesas, usuarios y chat. */
final class InfoCommands {

    private InfoCommands() {
    }

    static boolean handle(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) throws Exception {
        switch (action) {
            case "getServerInfo": {
                JsonObject data = new JsonObject();
                data.addProperty("host", ctx.session().getServerHost());
                data.addProperty("version", ctx.session().getVersionInfo());
                data.addProperty("connected", ctx.isConnected());
                data.addProperty("sessionId", ctx.session().getSessionId());
                data.addProperty("protocolVersion", Config.PROTOCOL_VERSION);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, data));
                return true;
            }
            case "getGameTypes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getGameTypes()));
                return true;
            }
            case "getTournamentGameTypes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getTournamentGameTypes()));
                return true;
            }
            case "getTournamentTypes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getTournamentTypes()));
                return true;
            }
            case "getDraftCubes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getDraftCubes()));
                return true;
            }
            case "getDeckTypes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, Arrays.asList(ctx.session().getDeckTypes())));
                return true;
            }
            case "getPlayerTypes": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, Arrays.asList(ctx.session().getPlayerTypes())));
                return true;
            }
            case "getTables": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getTables(roomId)));
                return true;
            }
            case "getRoomUsers": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getRoomUsers(roomId)));
                return true;
            }
            case "getRoomChatId": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getRoomChatId(roomId).orElse(null)));
                return true;
            }
            case "getFinishedMatches": {
                UUID roomId = JsonArgs.uuid(args, "roomId", ctx.session().getMainRoomId());
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getFinishedMatches(roomId)));
                return true;
            }
            case "getServerMessages": {
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, ctx.session().getServerMessages()));
                return true;
            }
            case "joinChat": {
                UUID chatId = JsonArgs.uuid(args, "chatId", null);
                boolean ok = chatId != null && ctx.session().joinChat(chatId);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, ok ? null : ProxyProtocol.ERR_FAILED, ok ? null : "joinChat failed, need valid chatId"));
                return true;
            }
            case "leaveChat": {
                UUID chatId = JsonArgs.uuid(args, "chatId", null);
                boolean ok = chatId != null && ctx.session().leaveChat(chatId);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, ok ? null : ProxyProtocol.ERR_FAILED, null));
                return true;
            }
            case "getGameChatId": {
                UUID gameId = JsonArgs.uuid(args, "gameId", null);
                UUID chatId = gameId != null ? ctx.session().getGameChatId(gameId).orElse(null) : null;
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, chatId));
                return true;
            }
            case "getTableChatId": {
                UUID tableId = JsonArgs.uuid(args, "tableId", null);
                UUID chatId = tableId != null ? ctx.session().getTableChatId(tableId).orElse(null) : null;
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, chatId));
                return true;
            }
            case "sendChatMessage": {
                UUID chatId = JsonArgs.uuid(args, "chatId", null);
                String text = JsonArgs.str(args, "text", "");
                boolean ok = chatId != null && ctx.session().sendChatMessage(chatId, text);
                ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, ok, ok ? null : ProxyProtocol.ERR_FAILED, null));
                return true;
            }
            default:
                return false;
        }
    }
}
