package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ProxyClientStreamTest {

    private static final UUID GAME = UUID.fromString("00000000-0000-0000-0000-0000000000aa");

    static final class Sent {
        final WebSocket conn;
        final JsonObject frame;

        Sent(WebSocket conn, String json) {
            this.conn = conn;
            this.frame = JsonParser.parseString(json).getAsJsonObject();
        }
    }

    static final class RecordingGateway extends Gateway {
        final List<Sent> sent = new ArrayList<>();

        RecordingGateway() {
            super(Config.parse(new String[]{"--wsPort", "0", "--simRoster", "none"}));
        }

        @Override
        public synchronized void send(WebSocket conn, String json) {
            sent.add(new Sent(conn, json));
        }

        synchronized List<JsonObject> to(WebSocket conn) {
            return sent.stream().filter(s -> s.conn == conn).map(s -> s.frame).collect(Collectors.toList());
        }
    }

    private final RecordingGateway gateway = new RecordingGateway();
    private final ProxyClient client = new ProxyClient(gateway.getConfig(), gateway);

    @AfterEach
    void stop() {
        client.shutdown();
    }

    private static WebSocket conn() {
        return (WebSocket) Proxy.newProxyInstance(WebSocket.class.getClassLoader(), new Class<?>[]{WebSocket.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("equals")) {
                        return proxy == args[0];
                    }
                    if (method.getName().equals("hashCode")) {
                        return System.identityHashCode(proxy);
                    }
                    return method.getReturnType() == boolean.class ? Boolean.TRUE : null;
                });
    }

    private void callback(ClientCallbackMethod method, int messageId) {
        ClientCallback cb = new ClientCallback(method, GAME);
        cb.setMessageId(messageId);
        client.onCallback(cb);
    }

    private List<JsonObject> events(WebSocket conn, int expected) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        List<JsonObject> out;
        do {
            out = gateway.to(conn).stream().filter(f -> "event".equals(f.get("type").getAsString())).collect(Collectors.toList());
            if (out.size() >= expected) {
                return out;
            }
            Thread.sleep(10);
        } while (System.currentTimeMillis() < deadline);
        return out;
    }

    private static JsonObject result(List<JsonObject> frames) {
        return frames.stream().filter(f -> "result".equals(f.get("type").getAsString())).findFirst()
                .orElseThrow(() -> new AssertionError("no connect result")).getAsJsonObject("data");
    }

    private static List<String> methods(List<JsonObject> events) {
        return events.stream().map(e -> e.get("method").getAsString()).collect(Collectors.toList());
    }

    @Test
    void aReturningConnectionResumesTheFramesItMissed() throws Exception {
        client.markGameActive(GAME);
        WebSocket first = conn();
        client.attach(first, "1", null, -1);
        String streamId = result(gateway.to(first)).get("streamId").getAsString();
        assertFalse(result(gateway.to(first)).get("resumed").getAsBoolean());

        callback(ClientCallbackMethod.GAME_UPDATE, 1);
        callback(ClientCallbackMethod.GAME_TARGET, 2);
        List<JsonObject> seen = events(first, 2);
        assertEquals(2, seen.size());
        assertEquals(1, seen.get(0).get("seq").getAsLong());
        assertEquals(2, seen.get(1).get("seq").getAsLong());

        client.onClientClose(first);
        callback(ClientCallbackMethod.GAME_UPDATE, 3);
        callback(ClientCallbackMethod.GAME_ASK, 4);
        Thread.sleep(200);

        WebSocket back = conn();
        client.attach(back, "2", streamId, 2);
        assertTrue(result(gateway.to(back)).get("resumed").getAsBoolean());
        List<JsonObject> missed = events(back, 2);
        assertEquals(java.util.Arrays.asList("GAME_UPDATE", "GAME_ASK"), methods(missed));
        assertEquals(3, missed.get(0).get("seq").getAsLong());
        assertEquals(4, missed.get(1).get("seq").getAsLong());

        callback(ClientCallbackMethod.GAME_UPDATE, 5);
        assertEquals(5, events(back, 3).get(2).get("seq").getAsLong(), "the live stream continues after the replay");
    }

    @Test
    void aResumeFromTheStartSkipsSupersededStates() throws Exception {
        client.markGameActive(GAME);
        WebSocket first = conn();
        client.attach(first, "1", null, -1);
        String streamId = result(gateway.to(first)).get("streamId").getAsString();
        callback(ClientCallbackMethod.GAME_UPDATE, 1);
        callback(ClientCallbackMethod.GAME_TARGET, 2);
        callback(ClientCallbackMethod.GAME_UPDATE, 3);
        events(first, 3);

        WebSocket back = conn();
        client.attach(back, "2", streamId, 0);
        assertEquals(java.util.Arrays.asList("GAME_TARGET", "GAME_UPDATE"), methods(events(back, 2)));
    }

    @Test
    void anotherStreamGetsNoReplay() throws Exception {
        client.markGameActive(GAME);
        client.attach(conn(), "1", null, -1);
        callback(ClientCallbackMethod.GAME_UPDATE, 1);
        Thread.sleep(200);

        WebSocket other = conn();
        client.attach(other, "2", UUID.randomUUID().toString(), 0);
        assertFalse(result(gateway.to(other)).get("resumed").getAsBoolean());
        assertEquals(0, events(other, 0).size());
    }

    @Test
    void theRejoinReplayKeepsAPromptFollowedByAStateUpdate() throws Exception {
        client.markGameActive(GAME);
        WebSocket first = conn();
        client.attach(first, "1", null, -1);
        callback(ClientCallbackMethod.GAME_UPDATE, 1);
        callback(ClientCallbackMethod.GAME_SELECT, 2);
        callback(ClientCallbackMethod.GAME_UPDATE, 3);
        events(first, 3);

        WebSocket rejoin = conn();
        client.replayGameState(rejoin, GAME);
        List<JsonObject> replayed = gateway.to(rejoin);
        assertEquals(java.util.Arrays.asList("GAME_UPDATE", "GAME_SELECT"), methods(replayed));
        assertEquals(3, replayed.get(0).get("messageId").getAsInt());
    }

    @Test
    void theLobbyIsPolledRarelyDuringAGame() {
        long now = 1_000_000;
        assertTrue(LobbyPublisher.lobbyDue(0, 0, now - 2000, now), "no game: every tick");
        assertFalse(LobbyPublisher.lobbyDue(1, now - 1000, now - 2000, now), "in a game: skipped");
        assertTrue(LobbyPublisher.lobbyDue(1, now - 1000, now - LobbyPublisher.LOBBY_IN_GAME_INTERVAL_MS, now));
        assertTrue(LobbyPublisher.lobbyDue(1, now - LobbyPublisher.GAME_IDLE_MS, now - 2000, now), "a silent game no longer counts");
    }

    private long graceAfterClose(boolean left) throws Exception {
        java.lang.reflect.Field connected = ProxyClient.class.getDeclaredField("connected");
        connected.setAccessible(true);
        connected.set(client, true);
        WebSocket page = conn();
        client.attach(page, "1", null, -1);
        client.onClientClose(page, left);
        long deadline = System.currentTimeMillis() + 5000;
        while (client.graceRemainingSecs() < 0 && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        return client.graceRemainingSecs();
    }

    @Test
    void aClosedPageGetsTheShortGracePeriod() throws Exception {
        long secs = graceAfterClose(true);
        assertTrue(secs > Config.DEFAULT_LEAVE_GRACE_SECS - 5 && secs <= Config.DEFAULT_LEAVE_GRACE_SECS, "grace " + secs);
    }

    @Test
    void aDroppedConnectionKeepsTheFullGracePeriod() throws Exception {
        long secs = graceAfterClose(false);
        assertTrue(secs > Config.DEFAULT_GRACE_SECS - 5 && secs <= Config.DEFAULT_GRACE_SECS, "grace " + secs);
    }

    @Test
    void recognisesTheLeavingNotice() {
        assertTrue(Gateway.isLeaving("{\"action\":\"leaving\",\"args\":{}}"));
        assertFalse(Gateway.isLeaving("{\"action\":\"sendChatMessage\",\"args\":{\"text\":\"leaving\"}}"));
        assertFalse(Gateway.isLeaving("not json \"leaving\""));
    }

    @Test
    void theShortGraceNeverExceedsTheFullOne() {
        assertEquals(Config.DEFAULT_LEAVE_GRACE_SECS, Config.parse(new String[]{}).getLeaveGraceSecs());
        assertEquals(20, Config.parse(new String[]{"--graceSecs", "20"}).getLeaveGraceSecs());
        assertEquals(10, Config.parse(new String[]{"--leaveGraceSecs", "10"}).getLeaveGraceSecs());
    }

    @Test
    void aSessionLostRightAfterItsRelinkWasTakenOverByAnotherLogin() {
        long now = 10_000_000;
        assertTrue(ProxyClient.isSuperseded(true, now - 1000, now));
        assertFalse(ProxyClient.isSuperseded(false, now - 1000, now), "a first loss relinks");
        assertFalse(ProxyClient.isSuperseded(true, now - ProxyClient.SUPERSEDED_WINDOW_MS, now), "a relink long ago relinks again");
    }
}
