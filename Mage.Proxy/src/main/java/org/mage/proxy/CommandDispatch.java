package org.mage.proxy;

import com.google.gson.JsonObject;
import org.java_websocket.WebSocket;

/** Router de comandos a handlers por dominio (info/mesas/torneos/partida). */
final class CommandDispatch {

    private CommandDispatch() {
    }

    static boolean dispatch(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) throws Exception {
        return InfoCommands.handle(action, conn, requestId, args, ctx)
                || TableCommands.handle(action, conn, requestId, args, ctx)
                || TournamentCommands.handle(action, conn, requestId, args, ctx)
                || GameCommands.handle(action, conn, requestId, args, ctx);
    }
}
