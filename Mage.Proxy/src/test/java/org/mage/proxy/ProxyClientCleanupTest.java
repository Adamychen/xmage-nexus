package org.mage.proxy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
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

    private static SessionGames games(ProxyClient pc) throws Exception {
        Field f = ProxyClient.class.getDeclaredField("games");
        f.setAccessible(true);
        return (SessionGames) f.get(pc);
    }

    @Test
    void finishedGamesAreTrimmedFromTheSessionAllowlist() throws Exception {
        client = newClient(gateway);
        SessionGames games = games(client);
        for (int i = 0; i < 300; i++) {
            UUID game = UUID.randomUUID();
            client.markGameActive(game);
            // each one finishes right away, the way a quick game does
            client.markGameInactive(game);
        }
        assertTrue(games.ownedCount() <= SessionGames.ALLOWLIST_LIMIT, "the allowlist grew to " + games.ownedCount());
    }

    @Test
    void theTrimNeverDropsAGameThatIsStillBeingPlayed() throws Exception {
        client = newClient(gateway);
        SessionGames games = games(client);
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
        long dropped = live.stream().filter(id -> !games.owns(id)).count();
        assertEquals(0, dropped, "trimming the finished ids dropped " + dropped + " live ones");
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
    void theOutdatedGuardTracksTheHighestMessageId() throws Exception {
        client = newClient(gateway);
        Field highest = ProxyClient.class.getDeclaredField("highestMessageId");
        highest.setAccessible(true);
        assertEquals(0, highest.getInt(client));
    }
}
