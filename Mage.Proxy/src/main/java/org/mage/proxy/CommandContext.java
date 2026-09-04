package org.mage.proxy;

import com.google.gson.JsonObject;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;

import java.util.UUID;

/** Superficie de ProxyClient que necesitan los handlers de comandos por dominio. */
interface CommandContext {

    SessionImpl session();

    Gateway gateway();

    boolean isConnected();

    void sendFailure(WebSocket conn, String action, String requestId, long start);

    void startSims(JsonObject args, UUID roomId, UUID tableId);
}
