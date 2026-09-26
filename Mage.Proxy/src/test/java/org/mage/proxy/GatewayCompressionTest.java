package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.WebSocket;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.drafts.Draft;
import org.java_websocket.drafts.Draft_6455;
import org.java_websocket.extensions.permessage_deflate.PerMessageDeflateExtension;
import org.java_websocket.handshake.ServerHandshake;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayCompressionTest {

    private Gateway gateway;
    private final List<Client> clients = new ArrayList<>();

    @AfterEach
    void stop() throws Exception {
        for (Client c : clients) {
            if (c.isOpen()) {
                c.closeBlocking();
            }
        }
        if (gateway != null) {
            gateway.stop(1000);
        }
    }

    private void start() throws Exception {
        gateway = new Gateway(Config.parse(new String[]{}), 0);
        gateway.start();
        long deadline = System.currentTimeMillis() + 20000;
        while (gateway.getPort() <= 0 && System.currentTimeMillis() < deadline) {
            Thread.sleep(10);
        }
        assertTrue(gateway.getPort() > 0, "gateway did not bind an ephemeral port");
    }

    private Client connect(Draft draft) throws Exception {
        Client c = new Client(new URI("ws://127.0.0.1:" + gateway.getPort()), draft);
        clients.add(c);
        assertTrue(c.connectBlocking(5, TimeUnit.SECONDS));
        c.messages.poll(5, TimeUnit.SECONDS); // "Proxy ready" info
        return c;
    }

    private WebSocket serverSideOf(Client c) throws Exception {
        long deadline = System.currentTimeMillis() + 5000;
        while (System.currentTimeMillis() < deadline) {
            for (WebSocket conn : gateway.getConnections()) {
                if (conn.getRemoteSocketAddress() != null
                        && conn.getRemoteSocketAddress().getPort() == c.getLocalSocketAddress().getPort()) {
                    return conn;
                }
            }
            Thread.sleep(10);
        }
        throw new AssertionError("server side connection not found");
    }

    private static String bigFrame(int thread, int seq) {
        StringBuilder sb = new StringBuilder("{\"type\":\"event\",\"thread\":").append(thread)
                .append(",\"seq\":").append(seq).append(",\"cards\":[");
        for (int i = 0; i < 600; i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append("{\"name\":\"Grizzly Bears\",\"power\":\"2\",\"toughness\":\"2\",\"tapped\":false,\"n\":")
                    .append(i).append('}');
        }
        return sb.append("]}").toString();
    }

    @Test
    void negotiatesPermessageDeflateWithClientsThatOfferIt() throws Exception {
        start();
        Client c = connect(new Draft_6455(new PerMessageDeflateExtension()));
        Draft negotiated = c.getConnection().getDraft();
        assertTrue(((Draft_6455) negotiated).getExtension() instanceof PerMessageDeflateExtension);
    }

    @Test
    void clientsWithoutTheExtensionStillWork() throws Exception {
        start();
        Client c = connect(new Draft_6455());
        assertFalse(((Draft_6455) c.getConnection().getDraft()).getExtension() instanceof PerMessageDeflateExtension);
        c.send("{\"requestId\":\"p1\",\"action\":\"ping\",\"args\":{}}");
        JsonObject pong = JsonParser.parseString(c.messages.poll(5, TimeUnit.SECONDS)).getAsJsonObject();
        assertEquals("pong", pong.get("data").getAsString());
    }

    @Test
    void concurrentLargeSendsToOneCompressedConnectionArriveIntact() throws Exception {
        start();
        Client c = connect(new Draft_6455(new PerMessageDeflateExtension()));
        WebSocket conn = serverSideOf(c);
        int threads = 6;
        int perThread = 40;
        CountDownLatch go = new CountDownLatch(1);
        List<Thread> senders = new ArrayList<>();
        for (int t = 0; t < threads; t++) {
            final int thread = t;
            Thread sender = new Thread(() -> {
                try {
                    go.await();
                } catch (InterruptedException ex) {
                    return;
                }
                for (int i = 0; i < perThread; i++) {
                    gateway.send(conn, bigFrame(thread, i));
                }
            });
            sender.start();
            senders.add(sender);
        }
        go.countDown();
        for (Thread sender : senders) {
            sender.join(20000);
        }
        int[] nextSeq = new int[threads];
        for (int received = 0; received < threads * perThread; received++) {
            String raw = c.messages.poll(10, TimeUnit.SECONDS);
            assertTrue(raw != null, "frame " + received + " missing (connection closed: " + c.closeReason + ")");
            JsonObject frame = JsonParser.parseString(raw).getAsJsonObject();
            int thread = frame.get("thread").getAsInt();
            assertEquals(nextSeq[thread]++, frame.get("seq").getAsInt());
            assertEquals(600, frame.getAsJsonArray("cards").size());
        }
        assertTrue(c.isOpen());
    }

    @Test
    void sendNeverWaitsOnTheConnectionMonitor() throws Exception {
        // Java-WebSocket holds the connection's monitor while it runs onClose; a send that
        // synchronized on the connection under a session lock deadlocked the whole server
        start();
        Client c = connect(new Draft_6455(new PerMessageDeflateExtension()));
        WebSocket conn = serverSideOf(c);
        CountDownLatch sent = new CountDownLatch(1);
        synchronized (conn) {
            Thread sender = new Thread(() -> {
                gateway.send(conn, "{\"type\":\"info\",\"message\":\"hi\"}");
                sent.countDown();
            });
            sender.start();
            assertTrue(sent.await(5, TimeUnit.SECONDS), "send blocked on the connection monitor");
        }
        assertEquals("hi", JsonParser.parseString(c.messages.poll(5, TimeUnit.SECONDS)).getAsJsonObject().get("message").getAsString());
    }

    private static final class Client extends WebSocketClient {
        final BlockingQueue<String> messages = new LinkedBlockingQueue<>();
        volatile String closeReason = null;

        Client(URI uri, Draft draft) {
            super(uri, draft);
        }

        @Override
        public void onOpen(ServerHandshake handshake) {
        }

        @Override
        public void onMessage(String message) {
            messages.add(message);
        }

        @Override
        public void onClose(int code, String reason, boolean remote) {
            closeReason = code + " " + reason;
        }

        @Override
        public void onError(Exception ex) {
            closeReason = String.valueOf(ex);
        }
    }
}
