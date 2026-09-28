package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.WebSocket;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The counters the admin endpoint and the watchdog log exist because the thread leak this proxy
 * carried for weeks was invisible: nothing counted what was created, so nothing noticed what was
 * never released.
 */
class GatewayWatchdogTest {

    static final class QuietGateway extends Gateway {
        final List<ProxyClient> created = new ArrayList<>();

        QuietGateway() {
            super(Config.parse(new String[]{"--wsPort", "0", "--simRoster", "none"}));
        }

        @Override
        ProxyClient newClient() {
            ProxyClient pc = new ProxyClient(getConfig(), this);
            created.add(pc);
            return pc;
        }

        @Override
        public void send(WebSocket conn, String json) {
        }
    }

    private final QuietGateway gateway = new QuietGateway();

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

    @Test
    void countsEveryClientItCreatesAndEveryClientItReleases() {
        int createdBefore = gateway.runtime().get("clientsCreated").getAsInt();
        int disposedBefore = gateway.runtime().get("clientsDisposed").getAsInt();

        // built directly, not through the overridden factory: the counters hang off the
        // constructor and dispose(), so a test double cannot make them drift
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        assertEquals(createdBefore + 1, gateway.runtime().get("clientsCreated").getAsInt());
        assertEquals(disposedBefore, gateway.runtime().get("clientsDisposed").getAsInt());

        pc.dispose();
        assertEquals(createdBefore + 1, gateway.runtime().get("clientsDisposed").getAsInt());
    }

    @Test
    void disposingTwiceIsNotCountedTwice() {
        int disposedBefore = gateway.runtime().get("clientsDisposed").getAsInt();
        ProxyClient pc = gateway.newClient();
        pc.dispose();
        pc.dispose();
        pc.shutdown();
        assertEquals(disposedBefore + 1, gateway.runtime().get("clientsDisposed").getAsInt(),
                "shutdown() routes through dispose(), and both are idempotent");
    }

    @Test
    void runtimeExposesTheNumbersThatWereMissing() throws Exception {
        JsonObject runtime = gateway.runtime();
        for (String key : new String[]{"threads", "peakThreads", "heapUsedBytes", "heapMaxBytes", "gcCount",
                "clientsCreated", "clientsDisposed", "clientsAlive", "accountsRegistered", "wsErrors",
                "cardDb", "deckImportsInFlight"}) {
            assertTrue(runtime.has(key), "runtime is missing " + key);
        }
        assertTrue(runtime.get("threads").getAsInt() > 0, "the JVM always has at least one thread");
    }

    @Test
    void clientsAliveIsWhatCreatedMinusDisposed() {
        int before = gateway.runtime().get("clientsAlive").getAsInt();
        ProxyClient a = new ProxyClient(gateway.getConfig(), gateway);
        assertEquals(before + 1, gateway.runtime().get("clientsAlive").getAsInt());
        a.dispose();
        assertEquals(before, gateway.runtime().get("clientsAlive").getAsInt());
    }

    @Test
    void aSessionReportsWhatItIsDoing() throws Exception {
        ProxyClient pc = new ProxyClient(gateway.getConfig(), gateway);
        try {
            JsonObject d = pc.diagnostics();
            for (String key : new String[]{"connected", "relinking", "released", "graceRemainingSecs",
                    "gamesInProgress", "pendingGapEvents", "outboundFrames", "outboundChars",
                    "replayStates", "replayPrompts", "sessionGameIds", "failedKeepAlives",
                    "lobbyPublishFailures", "relinkAttempts", "simsAlive"}) {
                assertTrue(d.has(key), "session diagnostics are missing " + key);
            }
            assertTrue(!d.get("connected").getAsBoolean(), "a fresh client has no session");
            assertEquals(-1, d.get("graceRemainingSecs").getAsInt(), "no grace timer is running yet");
        } finally {
            pc.dispose();
        }
    }

    @Test
    void theWatchdogTickDoesNotThrowOnAnIdleProxy() throws Exception {
        // the tick shares the roster timer, so a throw here would silently kill both jobs
        java.lang.reflect.Method watchdog = Gateway.class.getDeclaredMethod("watchdogTick");
        watchdog.setAccessible(true);
        watchdog.invoke(gateway);
        gateway.onStart();
        assertTrue(gateway.runtime().get("peakThreads").getAsInt() > 0,
                "the tick records the peak it observed");
    }
}
