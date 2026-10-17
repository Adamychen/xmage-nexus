package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.view.MatchView;
import mage.view.RoomUsersView;
import mage.view.UsersView;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import java.util.function.LongSupplier;

/**
 * Owns the proxy's anonymous statistics session and serves its cached views. The session is a
 * {@link ProxyClient} with no WebSocket, so nothing releases it on a grace timer: a supervisor
 * logs it in again with backoff whenever the XMage server drops it, and a refresh timer keeps the
 * ranking and the match list no older than {@link #REFRESH_MILLIS}. Readers older than
 * {@link #MAX_AGE_MILLIS} reload on demand.
 */
final class StatsService implements StatsApi.Source {

    private static final Logger logger = Logger.getLogger(StatsService.class.getName());

    static final String USERNAME = "nexusstats";
    static final long REFRESH_MILLIS = 60_000L;
    static final long MAX_AGE_MILLIS = 30_000L;
    static final long SUPERVISE_MILLIS = 5_000L;
    static final long MAX_BACKOFF_MILLIS = 300_000L;

    /** The XMage calls behind the service, so the cache and supervisor logic runs without a server. */
    interface Upstream {
        boolean isLoggedIn();

        boolean isRelinking();

        boolean login();

        void logout();

        List<UsersView> roomUsers() throws Exception;

        List<JsonObject> finishedMatches() throws Exception;
    }

    private final Upstream upstream;
    private final LongSupplier clock;
    private final TtlCache<List<UsersView>> users;
    private final TtlCache<List<JsonObject>> matches;
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "stats-service");
        t.setDaemon(true);
        return t;
    });
    private long backoffMillis = SUPERVISE_MILLIS;
    private long nextAttemptAt = 0L;
    private volatile boolean stopped = false;

    StatsService(Upstream upstream, LongSupplier clock) {
        this.upstream = upstream;
        this.clock = clock;
        this.users = new TtlCache<>(clock, MAX_AGE_MILLIS);
        this.matches = new TtlCache<>(clock, MAX_AGE_MILLIS);
    }

    /** The service that logs in to the proxy's configured XMage server. */
    static StatsService forProxy(Config config, Gateway gateway) {
        ProxyClient client = gateway.newClient();
        client.markService();
        gateway.setServiceClient(client);
        return new StatsService(new ProxyUpstream(client, config.getServerHost(), config.getServerPort()),
                System::currentTimeMillis);
    }

    void start() {
        timer.scheduleWithFixedDelay(this::supervise, 0, SUPERVISE_MILLIS, TimeUnit.MILLISECONDS);
        timer.scheduleWithFixedDelay(this::refreshAll, REFRESH_MILLIS, REFRESH_MILLIS, TimeUnit.MILLISECONDS);
    }

    void stop() {
        stopped = true;
        timer.shutdownNow();
        upstream.logout();
    }

    void supervise() {
        if (stopped || upstream.isLoggedIn()) {
            backoffMillis = SUPERVISE_MILLIS;
            return;
        }
        if (upstream.isRelinking()) {
            return;
        }
        long now = clock.getAsLong();
        if (now < nextAttemptAt) {
            return;
        }
        if (upstream.login()) {
            logger.info("statistics session logged in as " + USERNAME);
            backoffMillis = SUPERVISE_MILLIS;
            refreshAll();
            return;
        }
        nextAttemptAt = now + backoffMillis;
        backoffMillis = Math.min(backoffMillis * 2, MAX_BACKOFF_MILLIS);
        logger.warning("statistics session login failed; next attempt in " + (nextAttemptAt - now) / 1000 + " s");
    }

    void refreshAll() {
        if (stopped || !upstream.isLoggedIn()) {
            return;
        }
        try {
            users.refresh(upstream::roomUsers);
        } catch (Exception ex) {
            logger.warning("statistics ranking refresh failed: " + ex);
        }
        try {
            matches.refresh(this::loadMatches);
        } catch (Exception ex) {
            logger.warning("statistics match refresh failed: " + ex);
        }
    }

    @Override
    public Optional<JsonObject> ranking(PublicStats.Format format) {
        TtlCache.Stamped<List<UsersView>> snapshot = read(users, upstream::roomUsers);
        if (snapshot == null) {
            return Optional.empty();
        }
        return Optional.of(PublicStats.ranking(format, updatedAt(snapshot), snapshot.value));
    }

    @Override
    public Optional<JsonObject> matches(int limit) {
        TtlCache.Stamped<List<JsonObject>> snapshot = read(matches, this::loadMatches);
        if (snapshot == null) {
            return Optional.empty();
        }
        return Optional.of(PublicStats.matchesBody(updatedAt(snapshot), snapshot.value, limit));
    }

    private <T> TtlCache.Stamped<T> read(TtlCache<T> cache, TtlCache.Loader<T> loader) {
        if (stopped || !upstream.isLoggedIn()) {
            return null;
        }
        try {
            return cache.get(loader);
        } catch (Exception ex) {
            logger.warning("statistics read failed with an empty cache: " + ex);
            return null;
        }
    }

    private List<JsonObject> loadMatches() throws Exception {
        return PublicStats.newestFirst(upstream.finishedMatches());
    }

    private static String updatedAt(TtlCache.Stamped<?> snapshot) {
        return Instant.ofEpochMilli(snapshot.loadedAtMillis).toString();
    }

    /** The real session: the room's users and finished matches through the proxy's own XMage session. */
    private static final class ProxyUpstream implements Upstream {

        private final ProxyClient client;
        private final String host;
        private final int port;

        ProxyUpstream(ProxyClient client, String host, int port) {
            this.client = client;
            this.host = host;
            this.port = port;
        }

        @Override
        public boolean isLoggedIn() {
            return client.isConnected();
        }

        @Override
        public boolean isRelinking() {
            return client.isRelinking();
        }

        @Override
        public boolean login() {
            try {
                client.connectService(host, port, USERNAME);
                return client.isConnected();
            } catch (RuntimeException ex) {
                logger.warning("statistics session login error: " + ex);
                return false;
            }
        }

        @Override
        public void logout() {
            client.stopService();
        }

        @Override
        public List<UsersView> roomUsers() throws Exception {
            List<UsersView> out = new ArrayList<>();
            UUID room = client.session().getMainRoomId();
            for (RoomUsersView view : client.session().getRoomUsers(room)) {
                if (view != null && view.getUsersView() != null) {
                    out.addAll(view.getUsersView());
                }
            }
            return out;
        }

        @Override
        public List<JsonObject> finishedMatches() throws Exception {
            List<JsonObject> out = new ArrayList<>();
            UUID room = client.session().getMainRoomId();
            for (MatchView match : client.session().getFinishedMatches(room)) {
                out.add(PublicStats.publicMatch(JsonParser.parseString(JsonUtil.toJson(match)).getAsJsonObject()));
            }
            return out;
        }
    }
}
