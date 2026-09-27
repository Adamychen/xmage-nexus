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

/** Cableado de las acciones de staging U4 (swapSeats/startTournament/panel-join) y del replay al re-join. */
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
        UUID joinedGame;

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
        public boolean joinGame(UUID gameId) {
            joinedGame = gameId;
            return true;
        }

        boolean answerResult = true;
        java.util.function.BooleanSupplier onAnswer = () -> true;
        UUID answeredWith;

        @Override
        public boolean sendPlayerUUID(UUID gameId, UUID data) {
            answeredWith = data;
            onAnswer.getAsBoolean();
            return answerResult;
        }

        @Override
        public boolean sendPlayerAction(mage.constants.PlayerAction passPriorityAction, UUID gameId, Object data) {
            onAnswer.getAsBoolean();
            return answerResult;
        }

        boolean tableExists = true;
        boolean owner = true;
        UUID removedTable;

        @Override
        public java.util.Optional<mage.view.TableView> getTable(UUID roomId, UUID tableId) {
            return tableExists ? java.util.Optional.of(blankTableView()) : java.util.Optional.empty();
        }

        private static mage.view.TableView blankTableView() {
            try {
                java.lang.reflect.Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
                f.setAccessible(true);
                return (mage.view.TableView) ((sun.misc.Unsafe) f.get(null)).allocateInstance(mage.view.TableView.class);
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
        }

        @Override
        public boolean isTableOwner(UUID roomId, UUID tableId) {
            return owner;
        }

        @Override
        public boolean removeTable(UUID roomId, UUID tableId) {
            removedTable = tableId;
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
        final java.util.List<UUID> activeGames = new java.util.ArrayList<>();

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
        public void replayGameState(WebSocket conn, UUID gameId) {
            gateway.send(conn, ProxyProtocol.resultJson("joinGame", "", true, null, "replayed:" + gameId));
        }

        @Override
        public void markGameActive(UUID gameId) {
            activeGames.add(gameId);
        }

        final ReplayCache replay = new ReplayCache();

        @Override
        public void markGameInactive(UUID gameId) {
            activeGames.remove(gameId);
        }

        @Override
        public ReplayCache.Prompt takePrompt(UUID gameId, boolean onlySelect) {
            return onlySelect ? replay.takePromptIfSelect(gameId) : replay.takePrompt(gameId);
        }

        @Override
        public void restorePrompt(UUID gameId, ReplayCache.Prompt prompt) {
            replay.restorePrompt(gameId, prompt);
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
    void removeTableByOwnerRemovesIt() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = TableCommands.handle("removeTable", null, "rt1",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(TABLE, ctx.session.removedTable);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
    }

    @Test
    void removeTableByNonOwnerFailsWithoutCallingServer() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.session.owner = false;
        TableCommands.handle("removeTable", null, "rt2",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        JsonObject res = lastResult(ctx);
        assertFalse(res.get("ok").getAsBoolean());
        assertEquals(ProxyProtocol.ERR_NOT_AUTHORIZED, res.get("errorCode").getAsString());
        assertEquals(null, ctx.session.removedTable);
    }

    @Test
    void removeTableThatIsAlreadyGoneSucceeds() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.session.tableExists = false;
        ctx.session.owner = false;
        TableCommands.handle("removeTable", null, "rt3",
                args("{\"tableId\":\"" + TABLE + "\"}"), ctx);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
        assertEquals(null, ctx.session.removedTable);
    }

    @Test
    void removeTableWithoutTableIdFails() throws Exception {
        StubCtx ctx = new StubCtx();
        TableCommands.handle("removeTable", null, "rt4", args("{}"), ctx);
        JsonObject res = lastResult(ctx);
        assertFalse(res.get("ok").getAsBoolean());
        assertEquals(ProxyProtocol.ERR_INVALID_ARGUMENT, res.get("errorCode").getAsString());
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
    void joinGameForwardsIdAndRequestsStateReplay() throws Exception {
        UUID game = UUID.fromString("00000000-0000-0000-0000-000000000006");
        StubCtx ctx = new StubCtx();
        boolean routed = GameCommands.handle("joinGame", null, "r11",
                args("{\"gameId\":\"" + game + "\"}"), ctx);
        assertTrue(routed);
        assertEquals(game, ctx.session.joinedGame);
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
        assertTrue(ctx.gateway.sent.stream().anyMatch(json -> json.contains("replayed:" + game)));
        assertEquals(java.util.Collections.singletonList(game), ctx.activeGames);
    }

    @Test
    void joinGameWithoutIdFailsAndDoesNotReplay() throws Exception {
        StubCtx ctx = new StubCtx();
        boolean routed = GameCommands.handle("joinGame", null, "r12", args("{}"), ctx);
        assertTrue(routed);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
        assertTrue(ctx.gateway.sent.stream().noneMatch(json -> json.contains("replayed:")));
        assertTrue(ctx.activeGames.isEmpty());
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

    private static final UUID GAME = UUID.fromString("00000000-0000-0000-0000-000000000006");

    @Test
    void anAnswerTakesTheCachedPromptOutBeforeTheServerCall() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.replay.onState(GAME, "state", false);
        ctx.replay.onPrompt(GAME, "GAME_TARGET", "target");
        java.util.List<Integer> replayDuringCall = new java.util.ArrayList<>();
        ctx.session.onAnswer = () -> replayDuringCall.add(ctx.replay.replay(GAME).size());
        UUID target = UUID.randomUUID();
        GameCommands.handle("sendPlayerUUID", null, "a1",
                args("{\"gameId\":\"" + GAME + "\",\"value\":\"" + target + "\"}"), ctx);
        assertEquals(target, ctx.session.answeredWith);
        assertEquals(java.util.Collections.singletonList(1), replayDuringCall, "the next prompt may arrive during the call");
        assertTrue(lastResult(ctx).get("ok").getAsBoolean());
        assertEquals(java.util.Collections.singletonList("state"), ctx.replay.replay(GAME));
    }

    @Test
    void aRejectedAnswerKeepsThePromptCached() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.replay.onPrompt(GAME, "GAME_TARGET", "target");
        ctx.session.answerResult = false;
        GameCommands.handle("sendPlayerUUID", null, "a2",
                args("{\"gameId\":\"" + GAME + "\",\"value\":\"" + UUID.randomUUID() + "\"}"), ctx);
        assertFalse(lastResult(ctx).get("ok").getAsBoolean());
        assertEquals(java.util.Collections.singletonList("target"), ctx.replay.replay(GAME));
    }

    @Test
    void aPriorityPassAnswersOnlyAPrioritySelect() throws Exception {
        StubCtx ctx = new StubCtx();
        ctx.replay.onPrompt(GAME, "GAME_TARGET", "target");
        GameCommands.handle("sendPlayerAction", null, "a3",
                args("{\"gameId\":\"" + GAME + "\",\"action\":\"PASS_PRIORITY_UNTIL_NEXT_TURN\"}"), ctx);
        assertEquals(java.util.Collections.singletonList("target"), ctx.replay.replay(GAME));

        ctx.replay.onPrompt(GAME, "GAME_SELECT", "select");
        GameCommands.handle("sendPlayerAction", null, "a4",
                args("{\"gameId\":\"" + GAME + "\",\"action\":\"PASS_PRIORITY_UNTIL_NEXT_TURN\"}"), ctx);
        assertEquals(0, ctx.replay.replay(GAME).size());

        ctx.replay.onPrompt(GAME, "GAME_SELECT", "select");
        GameCommands.handle("sendPlayerAction", null, "a5",
                args("{\"gameId\":\"" + GAME + "\",\"action\":\"REQUEST_PERMISSION_TO_SEE_HAND_CARDS\"}"), ctx);
        assertEquals(java.util.Collections.singletonList("select"), ctx.replay.replay(GAME));
    }
}
