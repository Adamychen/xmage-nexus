package org.mage.proxy;

import org.java_websocket.WebSocket;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.BrokenBarrierException;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;

/** One account never gets two server sessions through the proxy while its login runs. */
class GatewayLoginQueueTest {

    /** A client whose login never ends: it only records the connects it was handed. */
    static final class PendingClient extends ProxyClient {
        final List<WebSocket> handed = new ArrayList<>();

        PendingClient(Gateway gateway) {
            super(gateway.getConfig(), gateway);
        }

        @Override
        public void onClientMessage(WebSocket conn, String message) {
            handed.add(conn);
        }
    }

    static final class QueueGateway extends Gateway {
        final List<PendingClient> created = new ArrayList<>();

        QueueGateway() {
            super(Config.parse(new String[]{"--wsPort", "0", "--simRoster", "none"}));
        }

        @Override
        ProxyClient newClient() {
            PendingClient pc = new PendingClient(this);
            created.add(pc);
            return pc;
        }

        @Override
        public void send(WebSocket conn, String json) {
        }
    }

    /** Two connects of one account reach the client factory together, as on two worker threads. */
    static final class RaceGateway extends Gateway {
        final CyclicBarrier bothInFactory = new CyclicBarrier(2);
        final List<PendingClient> created = Collections.synchronizedList(new ArrayList<>());

        RaceGateway() {
            super(Config.parse(new String[]{"--wsPort", "0", "--simRoster", "none"}));
        }

        @Override
        ProxyClient newClient() {
            try {
                bothInFactory.await(500, TimeUnit.MILLISECONDS);
            } catch (InterruptedException | BrokenBarrierException | TimeoutException ignored) {
            }
            PendingClient pc = new PendingClient(this);
            created.add(pc);
            return pc;
        }

        @Override
        public void send(WebSocket conn, String json) {
        }
    }

    private final QueueGateway gateway = new QueueGateway();
    private AtomicReference<DeckValidation.State> state;
    private DeckValidation.State before;

    @SuppressWarnings("unchecked")
    @BeforeEach
    void cardDataReady() throws Exception {
        Field f = DeckValidation.class.getDeclaredField("STATE");
        f.setAccessible(true);
        state = (AtomicReference<DeckValidation.State>) f.get(null);
        before = state.get();
        state.set(DeckValidation.State.FAILED);
    }

    @AfterEach
    void restore() {
        state.set(before);
        for (PendingClient pc : gateway.created) {
            pc.shutdown();
        }
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

    private static String connect(String host, String user) {
        return "{\"requestId\":\"c\",\"action\":\"connect\",\"args\":{\"host\":\"" + host + "\",\"port\":17171,\"username\":\"" + user + "\"}}";
    }

    @Test
    void aSecondConnectOfTheAccountWaitsForTheLoginInProgress() {
        WebSocket first = conn();
        WebSocket retry = conn();
        gateway.onMessage(first, connect("127.0.0.1", "alice"));
        assertNotNull(gateway.findSession(ProxyClient.sessionKey("127.0.0.1", 17171, "alice")), "the account is held while its login runs");
        gateway.onMessage(retry, connect("localhost", "alice"));
        assertEquals(1, gateway.created.size(), "no second server session for the same account");
        PendingClient pc = gateway.created.get(0);
        assertEquals(2, pc.handed.size());
        assertSame(retry, pc.handed.get(1));
    }

    @Test
    void otherAccountsStillGetTheirOwnSession() {
        gateway.onMessage(conn(), connect("127.0.0.1", "alice"));
        gateway.onMessage(conn(), connect("127.0.0.1", "bob"));
        assertEquals(2, gateway.created.size());
    }

    @Test
    void aFailedFirstLoginFreesTheAccount() {
        gateway.onMessage(conn(), connect("127.0.0.1", "alice"));
        PendingClient pc = gateway.created.get(0);
        gateway.unregisterSession(ProxyClient.sessionKey("127.0.0.1", 17171, "alice"), pc);
        assertNull(gateway.findSession(ProxyClient.sessionKey("127.0.0.1", 17171, "alice")));
        gateway.onMessage(conn(), connect("127.0.0.1", "alice"));
        assertEquals(2, gateway.created.size());
    }

    @Test
    void simultaneousConnectsOfOneAccountOpenOneClient() throws Exception {
        RaceGateway race = new RaceGateway();
        CyclicBarrier start = new CyclicBarrier(2);
        Runnable connectAlice = () -> {
            try {
                start.await();
            } catch (InterruptedException | BrokenBarrierException ignored) {
            }
            race.onMessage(conn(), connect("127.0.0.1", "alice"));
        };
        Thread first = new Thread(connectAlice);
        Thread second = new Thread(connectAlice);
        first.start();
        second.start();
        first.join();
        second.join();
        try {
            assertEquals(1, race.created.size(), "one account, one server session, however the connects interleave");
        } finally {
            for (PendingClient pc : race.created) {
                pc.shutdown();
            }
        }
    }
}
