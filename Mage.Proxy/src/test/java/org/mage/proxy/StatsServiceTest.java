package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.view.UsersView;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StatsServiceTest {

    private static final class FakeUpstream implements StatsService.Upstream {
        boolean loggedIn;
        boolean relinking;
        boolean loginResult = true;
        int loginCalls;
        int logouts;
        int roomCalls;
        List<UsersView> users = new ArrayList<>();
        List<JsonObject> matches = new ArrayList<>();

        @Override
        public boolean isLoggedIn() {
            return loggedIn;
        }

        @Override
        public boolean isRelinking() {
            return relinking;
        }

        @Override
        public boolean login() {
            loginCalls++;
            loggedIn = loginResult;
            return loginResult;
        }

        @Override
        public void logout() {
            logouts++;
            loggedIn = false;
        }

        @Override
        public List<UsersView> roomUsers() {
            roomCalls++;
            return users;
        }

        @Override
        public List<JsonObject> finishedMatches() {
            return matches;
        }
    }

    private static final class Clock implements java.util.function.LongSupplier {
        long now = 1_700_000_000_000L;

        @Override
        public long getAsLong() {
            return now;
        }
    }

    private static UsersView user(String name, int constructed, int limited) {
        return new UsersView("world.png", name, "", 0, "", 0, "", "", 1500, constructed, limited);
    }

    @Test
    void notLoggedInAnswersNothingSoTheApiReturns503() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.users.add(user("alice", 1600, 1500));
        StatsService service = new StatsService(upstream, new Clock());

        assertFalse(service.ranking(PublicStats.Format.CONSTRUCTED).isPresent());
        assertFalse(service.matches(10).isPresent());
        assertEquals(0, upstream.roomCalls);
    }

    @Test
    void rankingIsBuiltFromTheCachedRoomAndStampedWithItsLoadTime() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.loggedIn = true;
        upstream.users.add(user("bob", 1200, 1700));
        upstream.users.add(user("alice", 1600, 1500));
        Clock clock = new Clock();
        StatsService service = new StatsService(upstream, clock);

        JsonObject body = service.ranking(PublicStats.Format.CONSTRUCTED).get();

        assertEquals("constructed", body.get("format").getAsString());
        assertEquals("2023-11-14T22:13:20Z", body.get("updatedAt").getAsString());
        assertEquals("alice", body.getAsJsonArray("players").get(0).getAsJsonObject().get("username").getAsString());
        assertEquals("bob", body.getAsJsonArray("players").get(1).getAsJsonObject().get("username").getAsString());
    }

    @Test
    void readsWithinThirtySecondsReuseTheCacheAndOlderOnesReload() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.loggedIn = true;
        Clock clock = new Clock();
        StatsService service = new StatsService(upstream, clock);

        service.ranking(PublicStats.Format.LIMITED);
        clock.now += 29_000L;
        service.ranking(PublicStats.Format.LIMITED);
        assertEquals(1, upstream.roomCalls);

        clock.now += 1_000L;
        service.ranking(PublicStats.Format.LIMITED);
        assertEquals(2, upstream.roomCalls);
    }

    @Test
    void matchesAreReducedToPublicFieldsNewestFirstAndCutToTheLimit() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.loggedIn = true;
        upstream.matches.add(match("old", 100L));
        upstream.matches.add(match("new", 300L));
        upstream.matches.add(match("mid", 200L));
        StatsService service = new StatsService(upstream, new Clock());

        JsonObject body = service.matches(2).get();

        assertEquals(2, body.getAsJsonArray("matches").size());
        assertEquals("new", body.getAsJsonArray("matches").get(0).getAsJsonObject().get("matchName").getAsString());
        assertEquals("mid", body.getAsJsonArray("matches").get(1).getAsJsonObject().get("matchName").getAsString());
        assertFalse(body.getAsJsonArray("matches").get(0).getAsJsonObject().has("deckContents"));
        assertFalse(body.getAsJsonArray("matches").get(0).getAsJsonObject().has("chat"));
    }

    @Test
    void supervisorLogsInAndBacksOffWhileTheServerRefusesTheLogin() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.loginResult = false;
        Clock clock = new Clock();
        StatsService service = new StatsService(upstream, clock);

        service.supervise();
        service.supervise();
        assertEquals(1, upstream.loginCalls);

        clock.now += StatsService.SUPERVISE_MILLIS;
        service.supervise();
        assertEquals(2, upstream.loginCalls);

        upstream.loginResult = true;
        clock.now += 60_000L;
        service.supervise();
        assertEquals(3, upstream.loginCalls);
        assertTrue(upstream.isLoggedIn());
        assertEquals(1, upstream.roomCalls);
    }

    @Test
    void supervisorDoesNotCompeteWithAWebSocketLessRelink() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.relinking = true;
        StatsService service = new StatsService(upstream, new Clock());

        service.supervise();

        assertEquals(0, upstream.loginCalls);
    }

    @Test
    void stopLogsTheSessionOutAndAnswersNothingAfterwards() {
        FakeUpstream upstream = new FakeUpstream();
        upstream.loggedIn = true;
        StatsService service = new StatsService(upstream, new Clock());

        service.stop();

        assertEquals(1, upstream.logouts);
        assertFalse(service.ranking(PublicStats.Format.CONSTRUCTED).isPresent());
    }

    private static JsonObject match(String name, long endTime) {
        JsonObject m = JsonParser.parseString("{\"matchName\":\"" + name + "\",\"endTime\":" + endTime
                + ",\"deckType\":\"Constructed\",\"players\":\"a, b\",\"chat\":\"hi\",\"deckContents\":[]}").getAsJsonObject();
        return PublicStats.publicMatch(m);
    }
}
