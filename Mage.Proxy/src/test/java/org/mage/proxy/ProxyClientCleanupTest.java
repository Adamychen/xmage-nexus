package org.mage.proxy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The per-session cleanup paths. Both used to return early on a state the code treated as
 * "nothing to do", which is exactly the state where the local resources were still held.
 */
class ProxyClientCleanupTest {

    private final ProxyClientStreamTest.RecordingGateway gateway = new ProxyClientStreamTest.RecordingGateway();
    private ProxyClient client;

    @AfterEach
    void stop() {
        if (client != null) {
            client.shutdown();
        }
    }

    private static ProxyClient newClient(ProxyClientStreamTest.RecordingGateway gateway) {
        return new ProxyClient(gateway.getConfig(), gateway);
    }

    @SuppressWarnings("unchecked")
    private static Set<UUID> gameIds(ProxyClient pc, String field) throws Exception {
        Field f = ProxyClient.class.getDeclaredField(field);
        f.setAccessible(true);
        return (Set<UUID>) f.get(pc);
    }

    @Test
    void finishedGamesAreTrimmedFromTheSessionAllowlist() throws Exception {
        client = newClient(gateway);
        Set<UUID> ids = gameIds(client, "sessionGameIds");
        for (int i = 0; i < 300; i++) {
            client.markGameActive(UUID.randomUUID());
            // each one finishes right away, the way a quick game does
            client.markGameInactive(ids.iterator().next());
        }
        int limit = 256;
        assertTrue(ids.size() <= limit, "the allowlist grew to " + ids.size());
    }

    @Test
    void theTrimNeverDropsAGameThatIsStillBeingPlayed() throws Exception {
        client = newClient(gateway);
        Set<UUID> ids = gameIds(client, "sessionGameIds");
        Set<UUID> live = ConcurrentHashMap.newKeySet();
        for (int i = 0; i < 300; i++) {
            UUID finished = UUID.randomUUID();
            client.markGameActive(finished);
            client.markGameInactive(finished);
        }
        for (int i = 0; i < 40; i++) {
            UUID inPlay = UUID.randomUUID();
            live.add(inPlay);
            client.markGameActive(inPlay);
        }
        // the next insert triggers the bound again, with 40 live games in the set
        client.markGameActive(UUID.randomUUID());
        assertTrue(ids.containsAll(live), "trimming the finished ids dropped " + (40 - ids.size()) + " live ones");
    }

    @Test
    void aGraceThatExpiresWithTheLinkAlreadyDownStillReleasesTheSession() throws Exception {
        // ROADMAP 4.6: this early return left the account registered and the user listed in
        // Activity forever, and (before the dispose() fix) its threads alive
        client = newClient(gateway);
        Field connected = ProxyClient.class.getDeclaredField("connected");
        connected.setAccessible(true);
        connected.setBoolean(client, false);
        Field relinking = ProxyClient.class.getDeclaredField("relinking");
        relinking.setAccessible(true);
        relinking.setBoolean(client, false);
        Field activityUser = ProxyClient.class.getDeclaredField("activityUser");
        activityUser.setAccessible(true);
        activityUser.set(client, "ghost-user");
        Field accountKey = ProxyClient.class.getDeclaredField("accountKey");
        accountKey.setAccessible(true);
        accountKey.set(client, "127.0.0.1|ghost-user");
        gateway.registerSession("127.0.0.1|ghost-user", client);

        java.lang.reflect.Method expire = ProxyClient.class.getDeclaredMethod("expireGrace");
        expire.setAccessible(true);
        expire.invoke(client);

        assertTrue(client.isReleased(), "the client was released even with the link down");
        assertEquals(null, gateway.findSession("127.0.0.1|ghost-user"), "the account key is free again");
    }

    @Test
    void theOutdatedGuardDoesNotScanTheWholeMapOnEveryCallback() throws Exception {
        // highestMessageId replaced a stream + boxed unboxing over every entry of the map, on
        // every single callback, on the thread that must not fall behind
        client = newClient(gateway);
        Field highest = ProxyClient.class.getDeclaredField("highestMessageId");
        highest.setAccessible(true);
        assertEquals(0, highest.getInt(client));
        Field lastMessages = ProxyClient.class.getDeclaredField("lastMessages");
        lastMessages.setAccessible(true);
        Object map = lastMessages.get(client);
        assertTrue(map instanceof java.util.concurrent.ConcurrentMap,
                "connectStart resets this map from the command thread while callbacks read it");
        assertFalse(java.util.HashMap.class.isInstance(map));
    }
}
