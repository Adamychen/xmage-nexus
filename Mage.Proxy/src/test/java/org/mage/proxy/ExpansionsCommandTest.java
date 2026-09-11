package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Comando T5: getExpansionsWithBoosters responde ok con un array (vacío si la BD aún no está lista). */
class ExpansionsCommandTest {

    static final class StubSession extends SessionImpl {
        StubSession() {
            super(null);
        }
    }

    static final class CapturingGateway extends Gateway {
        final List<String> sent = new ArrayList<>();

        CapturingGateway() {
            super(Config.parse(new String[]{"--wsPort", "0"}));
        }

        @Override
        public void send(WebSocket conn, String json) {
            sent.add(json);
        }
    }

    static final class StubCtx implements CommandContext {
        final StubSession session = new StubSession();
        final CapturingGateway gateway = new CapturingGateway();

        @Override
        public SessionImpl session() {
            return session;
        }

        @Override
        public Gateway gateway() {
            return gateway;
        }

        @Override
        public boolean isConnected() {
            return true;
        }

        @Override
        public void sendFailure(WebSocket conn, String action, String requestId, long start) {
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_FAILED, null));
        }

        @Override
        public void replayGameState(WebSocket conn, java.util.UUID gameId) {
        }

        @Override
        public void startSims(JsonObject args, java.util.UUID roomId, java.util.UUID tableId) {
        }
    }

    @Test
    void getExpansionsWithBoostersReturnsArray() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = InfoCommands.handle("getExpansionsWithBoosters", null, "r1",
                JsonParser.parseString("{}").getAsJsonObject(), ctx);
        assertTrue(routed);
        assertFalse(ctx.gateway.sent.isEmpty());
        JsonObject res = JsonParser.parseString(ctx.gateway.sent.get(ctx.gateway.sent.size() - 1)).getAsJsonObject();
        assertTrue(res.get("ok").getAsBoolean());
        assertTrue(res.get("data").isJsonArray());
        JsonArray data = res.getAsJsonArray("data");
        for (int i = 0; i < data.size(); i++) {
            JsonObject e = data.get(i).getAsJsonObject();
            assertTrue(e.has("code") && e.has("name"));
        }
    }
}
