package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.remote.SessionImpl;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Cableado de las acciones de staging U4: swapSeats, startTournament y panel-join (joinTournament/joinDraft). */
class TableStagingCommandsTest {

    private static final UUID ROOM = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID TABLE = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID CHAT = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID TOURNAMENT = UUID.fromString("00000000-0000-0000-0000-000000000004");
    private static final UUID DRAFT = UUID.fromString("00000000-0000-0000-0000-000000000005");

    static final class StubSession extends SessionImpl {
        UUID swapRoom;
        UUID swapTable;
        int swapA = -99;
        int swapB = -99;
        boolean swapResult = true;
        UUID startRoom;
        UUID startTable;
        boolean startResult = true;

        StubSession() {
            super(null);
        }

        @Override
        public UUID getMainRoomId() {
            return ROOM;
        }

        @Override
        public String getUserName() {
            return "tester";
        }

        @Override
        public boolean swapSeats(UUID roomId, UUID tableId, int seatNum1, int seatNum2) {
            swapRoom = roomId;
            swapTable = tableId;
            swapA = seatNum1;
            swapB = seatNum2;
            return swapResult;
        }

        @Override
        public boolean startTournament(UUID roomId, UUID tableId) {
            startRoom = roomId;
            startTable = tableId;
            return startResult;
        }

        UUID joinedTournament;
        UUID joinedDraft;

        @Override
        public boolean joinTournament(UUID tournamentId) {
            joinedTournament = tournamentId;
            return true;
        }

        @Override
        public boolean joinDraft(UUID draftId) {
            joinedDraft = draftId;
            return true;
        }

        @Override
        public java.util.Optional<UUID> getTableChatId(UUID tableId) {
            return TABLE.equals(tableId) ? java.util.Optional.of(CHAT) : java.util.Optional.empty();
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
        public void startSims(JsonObject args, UUID roomId, UUID tableId) {
        }
    }

    private static JsonObject args(String json) {
        return JsonParser.parseString(json).getAsJsonObject();
    }

    private static JsonObject lastResult(StubCtx ctx) {
        assertFalse(ctx.gateway.sent.isEmpty());
        return JsonParser.parseString(ctx.gateway.sent.get(ctx.gateway.sent.size() - 1)).getAsJsonObject();
    }

    @Test
    void swapSeatsForwardsSeatIndicesToSession() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TableCommands.handle("swapSeats", null, "r1",
                args("{\"tableId\":\"" + TABLE + "\",\"seatNum1\":0,\"seatNum2\":2}"), ctx);
        assertTrue(routed);
        assertEquals(ROOM, ctx.session.swapRoom);
        assertEquals(TABLE, ctx.session.swapTable);
        assertEquals(0, ctx.session.swapA);
        assertEquals(2, ctx.session.swapB);
        JsonObject res = lastResult(ctx);
        assertTrue(res.get("ok").getAsBoolean());
        assertEquals("r1", res.get("requestId").getAsString());
    }

    @Test
    void swapSeatsRejectsMissingIndicesWithoutCallingSession() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TableCommands.handle("swapSeats", null, "r2",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(-99, ctx.session.swapA);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void swapSeatsPropagatesSessionFailure() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.session.swapResult = false;
        TableCommands.handle("swapSeats", null, "r3",
                args("{\"tableId\":\"" + TABLE + "\",\"seatNum1\":1,\"seatNum2\":0}"), ctx);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void startTournamentForwardsTableToSession() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("startTournament", null, "r4",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(ROOM, ctx.session.startRoom);
        assertEquals(TABLE, ctx.session.startTable);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void startTournamentWithoutTableIdFails() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("startTournament", null, "r5", args("{}"), ctx);
        assertTrue(routed);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void joinTournamentForwardsIdToSession() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("joinTournament", null, "r8",
                args("{\"tournamentId\":\"" + TOURNAMENT + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(TOURNAMENT, ctx.session.joinedTournament);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void joinTournamentWithoutIdFails() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("joinTournament", null, "r9", args("{}"), ctx);
        assertTrue(routed);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void joinDraftForwardsIdToSession() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("joinDraft", null, "r10",
                args("{\"draftId\":\"" + DRAFT + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(DRAFT, ctx.session.joinedDraft);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void joinDraftWithoutIdFails() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TournamentCommands.handle("joinDraft", null, "r11", args("{}"), ctx);
        assertTrue(routed);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void getTableChatIdReturnsSessionChatId() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = InfoCommands.handle("getTableChatId", null, "r6",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        assertTrue(routed);
        JsonObject res = lastResult(ctx);
        assertTrue(res.get("ok").getAsBoolean());
        assertEquals(CHAT.toString(), res.get("data").getAsString());
    }

    @Test
    void getTableChatIdWithoutTableIdReturnsNull() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = InfoCommands.handle("getTableChatId", null, "r7", args("{}"), ctx);
        assertTrue(routed);
        JsonObject res = lastResult(ctx);
        assertTrue(res.get("ok").getAsBoolean());
        assertTrue(!res.has("data") || res.get("data").isJsonNull());
    }
}
