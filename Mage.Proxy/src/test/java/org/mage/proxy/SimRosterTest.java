package org.mage.proxy;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SimRosterTest {

    @TempDir
    File dir;

    private final AtomicLong now = new AtomicLong(5_000_000);

    private static SimRoster.Seat seat(String owner, String name, String host) {
        JsonObject deck = new JsonObject();
        deck.addProperty("name", "Sim lands");
        return new SimRoster.Seat(owner, name, host, 17171, 3, deck);
    }

    @Test
    void seatsSurviveAProxyRestart() {
        File file = new File(dir, "sims.json");
        SimRoster roster = new SimRoster(file, now::get);
        roster.add(seat("127.0.0.1|alice", "sim-000123", "127.0.0.1"));
        roster.add(seat("127.0.0.1|bob", "sim-000124", "127.0.0.1"));

        SimRoster restarted = new SimRoster(file, now::get);
        assertEquals(2, restarted.size());
        List<SimRoster.Seat> alice = restarted.takeFor("127.0.0.1|alice", "127.0.0.1", 17171);
        assertEquals(1, alice.size());
        assertEquals("sim-000123", alice.get(0).username);
        assertEquals(3, alice.get(0).skill);
        assertEquals("Sim lands", alice.get(0).deck.get("name").getAsString());
        assertEquals(1, restarted.size(), "taken seats leave the roster");
        assertEquals(1, new SimRoster(file, now::get).size());
    }

    @Test
    void onlyTheOwnersSeatsOnThatServerAreTaken() {
        SimRoster roster = new SimRoster(new File(dir, "sims.json"), now::get);
        roster.add(seat("127.0.0.1|alice", "sim-000001", "127.0.0.1"));
        assertEquals(0, roster.takeFor("127.0.0.1|bob", "127.0.0.1", 17171).size());
        assertEquals(0, roster.takeFor("127.0.0.1|alice", "beta.xmage.today", 17171).size());
        assertEquals(0, roster.takeFor("127.0.0.1|alice", "127.0.0.1", 17172).size());
        assertEquals(1, roster.takeFor("127.0.0.1|alice", "127.0.0.1", 17171).size());
    }

    @Test
    void aStaleRosterIsIgnored() {
        File file = new File(dir, "sims.json");
        new SimRoster(file, now::get).add(seat("o", "sim-000001", "h"));
        now.addAndGet(SimRoster.MAX_AGE_MS + 1);
        assertEquals(0, new SimRoster(file, now::get).size());
    }

    @Test
    void touchKeepsAPlayingRosterFresh() {
        File file = new File(dir, "sims.json");
        SimRoster roster = new SimRoster(file, now::get);
        roster.add(seat("o", "sim-000001", "h"));
        now.addAndGet(SimRoster.MAX_AGE_MS - 1000);
        roster.touch();
        now.addAndGet(SimRoster.MAX_AGE_MS - 1000);
        assertEquals(1, new SimRoster(file, now::get).size());
    }

    @Test
    void removedSeatsAreNotRestored() {
        File file = new File(dir, "sims.json");
        SimRoster roster = new SimRoster(file, now::get);
        roster.add(seat("o", "sim-000001", "h"));
        roster.remove("sim-000001");
        assertEquals(0, new SimRoster(file, now::get).size());
    }

    @Test
    void newSimNamesStartAboveTheRestoredOnes() {
        SimRoster roster = new SimRoster(null, now::get);
        roster.add(seat("o", "sim-987654", "h"));
        assertEquals(987654, roster.maxSimNumber());
        SimManager manager = new SimManager(Config.parse(new String[]{}), msg -> { }, roster);
        String next = manager.nextSimUsername();
        assertTrue(Long.parseLong(next.substring("sim-".length())) > 987654, next);
        assertTrue(next.length() <= 14, next);
    }
}
