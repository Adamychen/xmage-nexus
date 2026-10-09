package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import mage.interfaces.MageClient;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import mage.interfaces.callback.ClientCallbackType;
import mage.players.net.UserData;
import mage.remote.Connection;
import mage.remote.SessionImpl;
import mage.utils.MageVersion;
import mage.view.GameEndView;
import mage.view.GameView;
import org.java_websocket.WebSocket;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Bridge between an XMage server (SessionImpl) and the WebSocket gateway.
 * <p>
 * - implements MageClient to receive server callbacks and forward them as JSON events
 * - routes JSON commands from the web client to domain handlers (Info/Table/Tournament/Game/OnlineDeck)
 *   and maps them to Session calls
 * - polls the lobby (tables/users) periodically and publishes it ({@link LobbyPublisher})
 * <p>
 * State it delegates: the authorized connections and their numbered stream
 * ({@link AuthorizedConnections}), the games of the server session ({@link SessionGames}), the
 * server's error detail for rejected commands ({@link ServerMessageMailbox}) and the latest
 * state/prompt per game ({@link ReplayCache}). What stays here is the session lifecycle: login,
 * attach, relink, grace period and release, all under this object's monitor.
 * <p>
 * Seguridad del protocolo (local-first):
 * - cada conexión WebSocket debe hacer connect antes de cualquier otro comando
 *   (auth por conexión: los comandos ajenos se rechazan con NOT_AUTHORIZED)
 * - respuestas con requestId (echo del comando) y errorCode uniforme
 * - las acciones de partida exigen gameId (GAME_ID_REQUIRED si falta)
 */
public class ProxyClient implements MageClient, CommandContext {

    private static final Logger logger = Logger.getLogger(ProxyClient.class.getName());

    private final Config config;
    private final Gateway gateway;
    private final MageVersion version = new MageVersion(ProxyClient.class);
    private final SessionImpl session;

    /** conexiones WebSocket autorizadas (han hecho connect con éxito) */
    private final AuthorizedConnections connections;

    // all commands from web clients are processed in order on one thread
    private final ExecutorService commandExecutor = Executors.newSingleThreadExecutor();
    // server callbacks are processed in order on one thread (recreated on user switch to drain stale ones)
    private volatile ExecutorService callbackExecutor = Executors.newSingleThreadExecutor();
    private ScheduledExecutorService lobbyTimer = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService pingTimer = Executors.newSingleThreadScheduledExecutor();
    // the keep-alive probe can wait on a busy server: never on pingTimer (sequencer gaps, grace)
    private final ScheduledExecutorService keepAliveTimer = Executors.newSingleThreadScheduledExecutor();
    // the sequencer's 400 ms gap budget: never on pingTimer either, because expireGrace runs there
    // and blocks for a whole server round-trip, which silently overran the budget for every session
    // whose grace period expired
    private final ScheduledExecutorService sequencerTimer = Executors.newSingleThreadScheduledExecutor();
    private int failedKeepAlives = 0;

    // Out-of-order protection for reconnect/bad network (same logic as the original client).
    /** Highest message id seen for this session. */
    private volatile int highestMessageId = 0;

    private final SessionGames games = new SessionGames();
    private final GameActivity gameActivity = new GameActivity();
    /** Latest state and open prompt per game (replayed when a connection joins the game). */
    private final ReplayCache replay = new ReplayCache();
    private final LobbyPublisher lobby;

    /** Login data of the live session, to log in again when the link to the server drops. */
    private volatile Connection lastConnection = null;
    private volatile String lastSessionId = "";
    /** Set while the proxy itself stops or starts the XMage session (not a lost link). */
    private volatile boolean expectDisconnect = false;
    private volatile boolean relinking = false;
    private volatile int relinkAttempts = 0;
    private ExecutorService relinkExecutor = null;
    private volatile long lastLoginAt = 0;
    private volatile boolean lastLoginWasRelink = false;
    /**
     * A session logged in again by the relink that is lost again this soon was taken over by
     * another login of the same account (the server disconnects the older instance of a user,
     * which looks exactly like a lost link): relinking again would start a login fight.
     */
    static final long SUPERSEDED_WINDOW_MS = 120_000;

    private final SimManager simManager;
    private String accountKey = null;
    private volatile String activityUser = null;

    public String getActivityUser() {
        return activityUser;
    }

    private volatile boolean connected = false;
    private final List<ClientCallback> handshakeBuffer = new java.util.LinkedList<>();
    private final ServerMessageMailbox serverMessages = new ServerMessageMailbox();

    private ScheduledFuture<?> graceDisconnectTimer = null;
    private volatile boolean released = false;
    /** dispose() is idempotent but reachable from several paths; the counter must be once-only. */
    private boolean disposeCounted = false;

    private final CallbackSequencer<ClientCallback> sequencer = new CallbackSequencer<>(
            ClientCallback::getMessageId,
            cb -> callbackExecutor.execute(() -> processCallback(cb)),
            sequencerTimer,
            CallbackSequencer.GAP_TIMEOUT_MS);

    /**
     * Normaliza el host del servidor para que la clave de sesión
     * (Gateway.handleConnect) y el accountKey coincidan. Ver detalle en connect().
     */
    static String normalizeHost(String host) {
        if ("localhost".equalsIgnoreCase(host)) {
            return "127.0.0.1";
        }
        return host;
    }

    public ProxyClient(Config config, Gateway gateway) {
        this.config = config;
        this.gateway = gateway;
        this.session = new SessionImpl(this);
        this.connections = new AuthorizedConnections(gateway);
        this.lobby = new LobbyPublisher(connections::broadcastUnnumbered);
        this.simManager = new SimManager(config, this::broadcastError, gateway.simRoster());
        gateway.clientCreated();
        lobbyTimer.scheduleWithFixedDelay(this::publishLobby, 2, 2, TimeUnit.SECONDS);
        // keep the server session alive (the original client pings from its UI; we have no UI)
        keepAliveTimer.scheduleWithFixedDelay(this::pingServer, PING_SERVER_SECS, PING_SERVER_SECS, TimeUnit.SECONDS);
    }

    // must be less than the server's connection timeout (UserManagerImpl.USER_CONNECTION_TIMEOUTS_CHECK_SECS)
    // shared with SimPlayer: its own session also needs periodic pings
    static final int PING_SERVER_SECS = 20;

    /**
     * Keeps the session alive and watches it: jboss' own validator fires only once, so after a
     * false alarm (below) a real loss is only noticed here, after two failed probes in a row.
     */
    void pingServer() {
        if (!connected || relinking || released) {
            failedKeepAlives = 0;
            return;
        }
        if (sessionAnswers(KEEP_ALIVE_PROBE_TIMEOUT_MS)) {
            failedKeepAlives = 0;
        } else if (++failedKeepAlives >= 2 && connected && !relinking && !released) {
            failedKeepAlives = 0;
            logger.info("The XMage server stopped answering this session's pings");
            connected = false;
            if (lastConnection != null) {
                startRelink();
            } else {
                broadcastDisconnected();
            }
        }
    }

    static final long KEEP_ALIVE_PROBE_TIMEOUT_MS = 15_000;
    /** A server busy with dead sessions' callbacks can take ~40-60 s to answer. */
    static final long LOST_LINK_PROBE_TIMEOUT_MS = 45_000;

    /** Whether the server still answers a ping of this session (see {@link SessionProbe}). */
    boolean sessionAnswers(long timeoutMs) {
        return SessionProbe.answers(session, timeoutMs);
    }

    @Override
    public SessionImpl session() {
        return session;
    }

    @Override
    public Gateway gateway() {
        return gateway;
    }

    public boolean isConnected() {
        return connected;
    }

    public boolean isReleased() {
        return released;
    }

    /**
     * Proxy shutdown (restart, deploy). The XMage session is deliberately NOT disconnected:
     * an explicit disconnect is DisconnectedByUser on the server, which removes the player from
     * every table (the game counts as abandoned). When the process exits the server sees a lost
     * connection instead, keeps the tables for its session-expiry window and restores them on
     * the next login (User.onReconnect).
     */
    public synchronized void shutdown() {
        cancelGraceTimer();
        dispose();
    }

    /**
     * Releases the six per-client executors and marks the client unusable.
     *
     * <p>Every {@code ProxyClient} spawns its threads in the constructor
     * ({@code lobbyTimer} and {@code keepAliveTimer} at construction, the rest on first use) and
     * they are all non-daemon. A client that never gets an XMage session - a login that failed
     * (wrong password, a username over the server limit, the "already connected" retry loop) or
     * a link that could not be restored - can never use them again, and nothing else reaches it:
     * the grace timer is only armed for a connected or relinking client, and the process shutdown
     * hook walks {@link Gateway#getSessions()}, which only holds the clients still registered
     * under an account key. Without this those threads, and their 2 s lobby / 20 s keep-alive
     * tasks, pile up for the life of the process and also keep the JVM from exiting.
     */
    public synchronized void dispose() {
        released = true;
        // once per client, not once per call: shutdown() routes through here, and expireGrace()
        // sets released itself, so "already released" is not a usable guard
        if (!disposeCounted) {
            disposeCounted = true;
            gateway.clientDisposed();
        }
        commandExecutor.shutdownNow();
        callbackExecutor.shutdownNow();
        lobbyTimer.shutdownNow();
        pingTimer.shutdownNow();
        keepAliveTimer.shutdownNow();
        sequencerTimer.shutdownNow();
        synchronized (relinkLock) {
            if (relinkExecutor != null) {
                relinkExecutor.shutdownNow();
            }
        }
    }

    /**
     * True when this client can never serve a session again, so closing its last WebSocket
     * should also release it. Requires no pending grace timer: that timer is scheduled on
     * {@link #pingTimer} and its whole job is the server-side cleanup, so disposing here would
     * silently cancel it and leave the session alive on the server until it expires.
     */
    public synchronized boolean isDisposable() {
        return released || (!connected && !relinking && lastConnection == null && graceDisconnectTimer == null);
    }

    /**
     * What one session is doing, for the admin endpoint. Every field here already existed and was
     * reachable (some of it through accessors nothing ever called); a session that is stuck on a
     * silent relink, an unbounded replay cache or a lobby that stopped publishing is otherwise
     * indistinguishable from a player who simply went away.
     */
    JsonObject diagnostics() {
        JsonObject out = new JsonObject();
        out.addProperty("user", activityUser);
        out.addProperty("account", accountKey);
        out.addProperty("connected", connected);
        out.addProperty("relinking", relinking);
        out.addProperty("released", released);
        out.addProperty("authorizedConnections", connections.count());
        out.addProperty("graceRemainingSecs", graceRemainingSecs());
        out.addProperty("gamesInProgress", games.inProgressCount());
        out.addProperty("pendingGapEvents", sequencer.pending());
        out.addProperty("outboundFrames", connections.outboundFrames());
        out.addProperty("outboundChars", connections.outboundChars());
        out.addProperty("replayStates", replay.stateCount());
        out.addProperty("replayPrompts", replay.promptCount());
        out.addProperty("sessionGameIds", games.ownedCount());
        out.addProperty("failedKeepAlives", failedKeepAlives);
        out.addProperty("lobbyPublishFailures", lobby.failures());
        out.addProperty("relinkAttempts", relinkAttempts);
        out.addProperty("lastLoginWasRelink", lastLoginWasRelink);
        out.addProperty("lastLoginAt", lastLoginAt);
        out.addProperty("simsAlive", simManager.aliveCount());
        return out;
    }

    private synchronized void cancelGraceTimer() {
        if (graceDisconnectTimer != null) {
            graceDisconnectTimer.cancel(false);
            graceDisconnectTimer = null;
        }
    }

    /**
     * No WebSocket came back within the grace period: the player is gone. The session is closed
     * for good (the server removes the player from its tables) and the client is released.
     * Closing it with keepMySessionActive instead leaves a zombie session on the server whose
     * callbacks block server threads for a minute each and that expires with the same table
     * removal three minutes later.
     */
    private synchronized void expireGrace() {
        graceDisconnectTimer = null;
        if (connections.count() != 0 || released) {
            return;
        }
        boolean linkUsable = connected || relinking;
        if (!linkUsable) {
            // The grace expired with the XMage link already down, so there is nothing to
            // disconnect (the round trip would fail and be swallowed). The local cleanup below
            // is still owed: returning early here left the account registered in byAccount and
            // the user listed in Activity forever, and the threads alive.
            logger.info("Grace period expired while the XMage link was already down. Releasing the "
                    + "local session only (games " + games.describeInProgress() + ").");
            releaseLocalOnly();
            return;
        }
        logger.info("Grace period expired without client reconnect. Cleaning up XMage session (server link "
                + (session.isConnected() ? "up" : "DOWN") + ", games " + games.describeInProgress() + ").");
        simManager.stopSims();
        stopSession(false);
        connected = false;
        releaseLocalOnly();
    }

    /** Everything {@link #expireGrace()} releases apart from the server round trip. */
    private void releaseLocalOnly() {
        released = true;
        gameActivity.closeAll("grace_expired");
        Activity.sessionEnd(activityUser, "grace_expired");
        if (accountKey != null) {
            gateway.unregisterSession(accountKey, this);
            accountKey = null;
        }
        dispose();
    }

    /** Stops the XMage session on the proxy's own initiative (never taken for a lost link). */
    private void stopSession(boolean keepMySessionActive) {
        expectDisconnect = true;
        try {
            session.connectStop(false, keepMySessionActive);
        } catch (Exception ignored) {
        } finally {
            expectDisconnect = false;
        }
    }

    // ============================ websocket client callbacks ============================

    /**
     * Runs on the WebSocket selector thread, so it must never wait for this client's monitor
     * (held by connect() through a whole login, up to a minute on a slow server): that would
     * stall every connection of the proxy. The grace timer is armed from the timer thread.
     */
    public void onClientClose(WebSocket conn) {
        onClientClose(conn, false);
    }

    /**
     * {@code left}: the page announced it was closing, so the session gets the short grace
     * period (a reload is back within seconds); a dropped connection gets the full one.
     */
    public void onClientClose(WebSocket conn, boolean left) {
        boolean noClientsLeft = connections.removeAndCheckEmpty(conn);
        if (noClientsLeft && (connected || relinking)) {
            try {
                pingTimer.execute(() -> startGraceIfIdle(left));
            } catch (java.util.concurrent.RejectedExecutionException ignored) {
                // already released
            }
        }
    }

    private synchronized void startGraceIfIdle(boolean left) {
        if (connections.count() != 0 || (!connected && !relinking) || released) {
            return;
        }
        int secs = left ? config.getLeaveGraceSecs() : config.getGraceSecs();
        logger.info("All WebSocket clients disconnected" + (left ? " (page closed)" : "") + ". Starting " + secs
                + "s grace period before stopping session.");
        if (graceDisconnectTimer != null) {
            graceDisconnectTimer.cancel(false);
        }
        graceDisconnectTimer = pingTimer.schedule(this::expireGrace, secs, TimeUnit.SECONDS);
    }

    /** Seconds left on the grace timer, or -1 when none is running. */
    synchronized long graceRemainingSecs() {
        return graceDisconnectTimer == null ? -1 : graceDisconnectTimer.getDelay(TimeUnit.SECONDS);
    }

    /** Reenvía estado solo a conexiones que han autenticado su sesión local. */
    private void broadcastAuthorized(String json) {
        connections.broadcast(json, null);
    }

    /** New server session: nothing of the previous one may leak into it. */
    private void resetSessionState() {
        // message ids restart at 1 on the new session, so the outdated-guard would silently
        // drop every UPDATE event of the new one otherwise
        highestMessageId = 0;
        // events of the previous user's still-running games (re-sent by the server over the
        // same channel) must be dropped, not forwarded
        games.clear();
        replay.clear();
        // drop callbacks still queued from the previous session instead of replaying them
        // to the new client (e.g. a WATCHGAME that lagged behind the update flood). Done
        // BEFORE connectStart: the reconnect restore of the new session can arrive while
        // the login is still running and must survive it.
        sequencer.reset();
        callbackExecutor.shutdownNow();
        callbackExecutor = Executors.newSingleThreadExecutor();
        connections.beginLogin();
    }

    @Override
    public void markGameActive(UUID gameId) {
        if (gameId != null) {
            games.markActive(gameId);
        }
    }

    @Override
    public void markGameInactive(UUID gameId) {
        if (gameId != null) {
            games.markInactive(gameId);
        }
    }

    @Override
    public ReplayCache.Prompt takePrompt(UUID gameId, boolean onlySelect) {
        return onlySelect ? replay.takePromptIfSelect(gameId) : replay.takePrompt(gameId);
    }

    @Override
    public void restorePrompt(UUID gameId, ReplayCache.Prompt prompt) {
        replay.restorePrompt(gameId, prompt);
    }

    public void onClientMessage(WebSocket conn, String message) {
        try {
            commandExecutor.execute(() -> handleCommand(conn, message));
        } catch (java.util.concurrent.RejectedExecutionException ex) {
            // released between the gateway lookup and now: the client retries on a fresh one
            gateway.send(conn, ProxyProtocol.resultJson("", "", false, ProxyProtocol.ERR_FAILED, "session closed, retry"));
        }
    }

    // ============================ MageClient implementation ============================

    @Override
    public MageVersion getVersion() {
        return version;
    }

    @Override
    public void connected(String message) {
        connected = true;
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "connected");
        ev.addProperty("info", message == null ? "Connected" : message);
        broadcastAuthorized(ev.toString());

        List<ClientCallback> toFlush;
        synchronized (handshakeBuffer) {
            toFlush = new java.util.LinkedList<>(handshakeBuffer);
            handshakeBuffer.clear();
        }
        for (ClientCallback cb : toFlush) {
            callbackExecutor.execute(() -> processCallback(cb));
        }
    }

    @Override
    public void disconnected(boolean askToReconnect, boolean keepMySessionActive) {
        connected = false;
        if (expectDisconnect || relinking) {
            return;
        }
        if (!released && lastConnection != null) {
            if (isSuperseded(lastLoginWasRelink, lastLoginAt, System.currentTimeMillis())) {
                logger.info("Session lost again right after a relink: another login of this account took over");
                broadcastLink("failed", 0, "superseded");
                broadcastDisconnected();
                return;
            }
            startRelink();
            return;
        }
        broadcastDisconnected();
    }

    static boolean isSuperseded(boolean lastLoginWasRelink, long lastLoginAt, long now) {
        return lastLoginWasRelink && now - lastLoginAt < SUPERSEDED_WINDOW_MS;
    }

    private void broadcastDisconnected() {
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "disconnected");
        ev.addProperty("info", "Disconnected from server");
        broadcastAuthorized(ev.toString());
    }

    private void broadcastLink(String state, int attempt) {
        broadcastLink(state, attempt, null);
    }

    private void broadcastLink(String state, int attempt, String reason) {
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "serverLink");
        ev.addProperty("state", state);
        if (attempt > 0) {
            ev.addProperty("attempt", attempt);
        }
        if (reason != null) {
            ev.addProperty("reason", reason);
        }
        broadcastAuthorized(ev.toString());
    }

    /**
     * The link to the XMage server dropped (network, server hiccup) while the web clients are
     * still attached. The server keeps the player's tables for a few minutes, so the session is
     * logged in again in the background — keeping the old server session hidden and passing its
     * restore id, as the desktop client does — and the server restores the games. The web shows a
     * banner meanwhile instead of dropping the player on the login screen.
     */
    private void startRelink() {
        // called by SessionImpl with its own monitor held: taking this client's monitor here
        // would deadlock against connect(), which holds it while it waits for the session's
        synchronized (relinkLock) {
            if (relinking || released) {
                return;
            }
            relinking = true;
            if (relinkExecutor == null) {
                relinkExecutor = Executors.newSingleThreadExecutor();
            }
            try {
                relinkExecutor.execute(this::relinkLoop);
            } catch (java.util.concurrent.RejectedExecutionException ex) {
                relinking = false;
            }
        }
    }

    private final Object relinkLock = new Object();

    private void relinkLoop() {
        broadcastLink("lost", 0);
        // a false alarm of jboss' validator must not kick this healthy session out
        if (!released && sessionAnswers(LOST_LINK_PROBE_TIMEOUT_MS)) {
            logger.info("The XMage server still answers this session: false alarm, no relink");
            connected = true;
            relinking = false;
            broadcastLink("restored", 0);
            return;
        }
        logger.info("Lost the link to the XMage server: logging in again");
        long deadline = System.currentTimeMillis() + config.getRelinkSecs() * 1000L;
        long delay = 1000;
        int attempt = 0;
        relinkAttempts = 0;
        try {
            while (!released && System.currentTimeMillis() < deadline) {
                attempt++;
                relinkAttempts = attempt;
                broadcastLink("retrying", attempt);
                if (relinkOnce()) {
                    logger.info("Link to the XMage server restored after " + attempt + " attempt(s)");
                    relinking = false;
                    broadcastLink("restored", attempt);
                    return;
                }
                Thread.sleep(delay);
                delay = Math.min(delay * 2, 15000);
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
        relinking = false;
        if (!released) {
            logger.warning("Could not restore the link to the XMage server");
            broadcastLink("failed", attempt);
            broadcastDisconnected();
        }
    }

    private synchronized boolean relinkOnce() {
        if (released) {
            return false;
        }
        if (connected) {
            return true;
        }
        Connection connection = lastConnection;
        if (connection == null) {
            return false;
        }
        expectDisconnect = true;
        try {
            try {
                session.connectStop(false, true);
            } catch (Exception ignored) {
            }
            session.setRestoreSessionId(lastSessionId);
            resetSessionState();
            boolean ok;
            try {
                ok = session.connectStart(connection);
            } catch (Exception ex) {
                logger.log(Level.FINE, "relink attempt failed", ex);
                ok = false;
            }
            connections.abandonLogin();
            connected = ok;
            if (ok) {
                Connection live = lastConnection;
                if (live != null) {
                    rememberLiveSession(live.getHost(), live.getUsername());
                }
                lobby.publishSoon();
                lastLoginAt = System.currentTimeMillis();
                lastLoginWasRelink = true;
            }
            return ok;
        } finally {
            expectDisconnect = false;
        }
    }

    @Override
    public void showMessage(String message) {
        serverMessages.capture(message);
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "info");
        ev.addProperty("message", message);
        broadcastAuthorized(ev.toString());
    }

    @Override
    public void showError(String message) {
        serverMessages.capture(message);
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "error");
        ev.addProperty("message", message);
        ev.addProperty("fatal", true);
        broadcastAuthorized(ev.toString());
    }

    /** Respuesta ok:false con el detalle real del servidor (y su errorCode clasificado). */
    @Override
    public void sendFailure(WebSocket conn, String action, String requestId, long start) {
        String detail = serverMessages.await(start, 1600);
        if (detail == null) detail = ErrorClassifier.stripServerErrorPrefix(session.getLastError());
        if (detail == null || detail.isEmpty() || detail.equalsIgnoreCase("No message")) detail = null;
        String code = detail != null ? ErrorClassifier.classifyErrorCode(detail) : ProxyProtocol.ERR_FAILED;
        gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, code, detail != null ? detail : ProxyProtocol.ERR_FAILED));
    }

    @Override
    public void startSims(JsonObject args, UUID roomId, UUID tableId) {
        simManager.startSims(args, roomId, tableId);
    }

    /** Aviso no fatal a la web (p.ej. un asiento SIM no pudo unirse). */
    private void broadcastError(String message) {
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "error");
        ev.addProperty("message", message);
        ev.addProperty("fatal", false);
        broadcastAuthorized(ev.toString());
    }

    @Override
    public void onNewConnection() {
        // nothing to do: temp data is per-proxy, not per-connection
    }

    @Override
    public void onCallback(ClientCallback callback) {
        sequencer.offer(callback);
    }

    private void tryCaptureFromCallback(ClientCallback callback) {
        try {
            if (callback.getMethod() == ClientCallbackMethod.SHOW_USERMESSAGE) {
                String text = CallbackEvents.userMessageText(callback.getData());
                if (text != null) {
                    serverMessages.capture(ErrorClassifier.stripServerErrorPrefix(text));
                }
            }
        } catch (Exception ignored) {}
    }

    private void processCallback(ClientCallback callback) {
        try {
            callback.decompressData();
            tryCaptureFromCallback(callback);

            // Buffer MESSAGE callbacks that arrive before the handshake completes.
            // The server may send SHOW_USERMESSAGE (news/disclaimer) before connected()
            // is called; flushing them after connected guarantees correct event ordering.
            if (!connected && callback.getMethod().getType() == ClientCallbackType.MESSAGE) {
                synchronized (handshakeBuffer) {
                    handshakeBuffer.add(callback);
                }
                return;
            }

            // ignore outdated game updates on reconnect/bad network (same logic as original client)
            if (!callback.getMethod().getType().equals(ClientCallbackType.CLIENT_SIDE_EVENT)) {
                int lastAnyMessageId = highestMessageId;
                if (lastAnyMessageId > callback.getMessageId()) {
                    if (callback.getMethod().getType().mustIgnoreOnOutdated()) {
                        logger.info("event DROPPED as outdated: " + callback.getMethod() + " (msgId=" + callback.getMessageId()
                                + " < last=" + lastAnyMessageId + ")");
                        return;
                    }
                }
                if (!callback.getMethod().getType().canComeInAnyOrder()) {
                    if (callback.getMessageId() > highestMessageId) {
                        highestMessageId = callback.getMessageId();
                    }
                }
            }

            // session isolation: drop events of games this session never joined/watched.
            // After a user switch the server re-sends the previous user's still-running games
            // over the same channel; forwarding them floods the single-threaded callback queue
            // and starves real events of the new session (e.g. WATCHGAME arriving 60+ seconds late).
            ClientCallbackMethod m = callback.getMethod();
            UUID callbackObjectId = callback.getObjectId();
            boolean gameEvent = callbackObjectId != null && CallbackEvents.isGameRelated(m);
            if (gameEvent) {
                if (CallbackEvents.opensGame(m)) {
                    games.markActive(callbackObjectId);
                }
                if (!games.owns(callbackObjectId)) {
                    logger.info("event IGNORED (game not active in this session): " + m
                            + " (msgId=" + callback.getMessageId() + ", obj=" + callbackObjectId + ")");
                    return;
                }
                games.touch();
                trackGame(m, callbackObjectId, callback.getData());
                if (CallbackEvents.endsGame(m)) {
                    games.markInactive(callbackObjectId);
                }
            }

            String eventJson = CallbackEvents.toEventJson(callback);
            Object data = callback.getData();
            if (logger.isLoggable(Level.FINE) || !CallbackEvents.isGameUpdate(m)) {
                logger.info("event >> " + m + " (msgId=" + callback.getMessageId()
                        + (callbackObjectId != null ? ", obj=" + callbackObjectId : "")
                        + ", data=" + (data == null ? "null" : data.getClass().getSimpleName()) + ")");
            }
            String supersedeKey = null;
            if (gameEvent) {
                if (m == ClientCallbackMethod.GAME_INIT || CallbackEvents.isGameUpdate(m)) {
                    replay.onState(callbackObjectId, eventJson, m == ClientCallbackMethod.GAME_INIT);
                } else if (CallbackEvents.isGamePrompt(m)) {
                    replay.onPrompt(callbackObjectId, m.name(), eventJson);
                } else if (CallbackEvents.endsGame(m)) {
                    replay.onGameEnded(callbackObjectId);
                }
                if (m == ClientCallbackMethod.GAME_UPDATE) {
                    // a plain state snapshot: only the latest one matters to a resuming client
                    supersedeKey = "state:" + callbackObjectId;
                }
            }
            connections.broadcast(eventJson, supersedeKey);
        } catch (Throwable ex) {
            // Throwable, not Exception: this runs on callbackExecutor, a single thread, and an
            // Error (a StackOverflowError from the recursive serializer is the realistic one)
            // would kill it for good - ThreadPoolExecutor never replaces a dead thread, so the
            // session would go deaf with nothing at all in the log.
            logger.log(Level.SEVERE, "Error processing callback " + callback.getInfo(), ex);
            JsonObject ev = new JsonObject();
            ev.addProperty("type", "error");
            ev.addProperty("message", "Callback error: " + callback.getMethod() + " - " + ex);
            ev.addProperty("fatal", false);
            broadcastAuthorized(ev.toString());
        }
    }

    private void trackGame(ClientCallbackMethod m, UUID gameId, Object data) {
        if (m == ClientCallbackMethod.START_GAME || m == ClientCallbackMethod.WATCHGAME) {
            gameActivity.opened(gameId, activityUser, m == ClientCallbackMethod.WATCHGAME);
        }
        int turn = GameActivity.turnOf(data);
        if (turn > 0) {
            gameActivity.turn(gameId, turn);
        }
        GameView view = GameActivity.viewOf(data);
        if (view != null) {
            gameActivity.commanderDamage(gameId, view);
        }
        if (m == ClientCallbackMethod.END_GAME_INFO && data instanceof GameEndView) {
            GameEndView end = (GameEndView) data;
            gameActivity.ended(gameId, GameActivity.outcome(end.getClientPlayer() != null, end.hasWon(),
                    end.getGameInfo(), end.getAdditionalInfo()), end.getPlayers().size());
        }
    }

    private void trackGameCommand(String action, JsonObject args) {
        UUID gameId = JsonArgs.uuid(args, "gameId", null);
        if (gameId == null) {
            return;
        }
        if ("quitMatch".equals(action) || "stopWatching".equals(action)) {
            gameActivity.left(gameId);
        } else if ("sendPlayerAction".equals(action) && "CONCEDE".equals(JsonArgs.str(args, "action", ""))) {
            gameActivity.conceded(gameId);
        }
    }

    /** Reenvía a una conexión recién adjuntada el último estado y prompt pendiente de esa partida. */
    @Override
    public void replayGameState(WebSocket conn, UUID gameId) {
        for (String json : replay.replay(gameId)) {
            gateway.send(conn, json);
        }
    }

    // ============================ lobby polling ============================

    private void publishLobby() {
        if (!connected) {
            return;
        }
        lobby.publish(session, games);
    }

    // ============================ command handling ============================

    private void handleCommand(WebSocket conn, String message) {
        String requestId = "";
        String action = "";
        JsonObject args = new JsonObject();
        JsonObject cmd;
        try {
            cmd = JsonParser.parseString(message).getAsJsonObject();
        } catch (JsonSyntaxException ex) {
            gateway.send(conn, ProxyProtocol.resultJson("", requestId, false, ProxyProtocol.ERR_BAD_JSON, "Bad JSON: " + ex.getMessage()));
            return;
        }
        if (cmd.has("requestId")) {
            JsonElement rid = cmd.get("requestId");
            if (rid.isJsonPrimitive()) {
                requestId = rid.getAsString();
            }
        }
        action = cmd.has("action") ? cmd.get("action").getAsString() : "";
        if (cmd.has("args") && cmd.get("args").isJsonObject()) {
            args = cmd.get("args").getAsJsonObject();
        }

        // auth por conexión: connect/ping son públicos; el resto exige sesión autorizada
        boolean isPublic = "connect".equals(action) || "ping".equals(action);
        if (!isPublic && !connections.contains(conn)) {
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_NOT_AUTHORIZED, "not connected: send connect first"));
            return;
        }

        if (!"connect".equals(action) && activityUser != null) {
            Activity.action(activityUser, gateway.ipOf(conn), action, args);
            trackGameCommand(action, args);
        }

        // gameId obligatorio para todas las acciones de partida
        if (requiresGameId(action) && JsonArgs.uuid(args, "gameId", null) == null) {
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_GAME_ID_REQUIRED, "gameId is required"));
            return;
        }

        try {
            switch (action) {
                case "connect": {
                    String host = JsonArgs.str(args, "host", config.getServerHost());
                    int port = JsonArgs.getInt(args, "port", config.getServerPort());
                    String username = JsonArgs.str(args, "username", config.getUsername());
                    String password = JsonArgs.str(args, "password", config.getPassword());
                    String flagName = JsonArgs.str(args, "flagName", "world.png");
                    int avatarId = JsonArgs.getInt(args, "avatarId", 51);
                    connect(conn, requestId, host, port, username, password, flagName, avatarId,
                            resumeStream(args), resumeSeq(args));
                    break;
                }
                case "disconnect": {
                    cancelGraceTimer();
                    simManager.stopSims();
                    Connection logged = lastConnection;
                    lastConnection = null;
                    if (logged != null) {
                        RestoreIds.clear(logged.getHost(), logged.getUsername());
                    }
                    stopSession(false);
                    connected = false;
                    gameActivity.closeAll("disconnect");
                    Activity.sessionEnd(activityUser, "disconnect");
                    if (accountKey != null) {
                        gateway.unregisterSession(accountKey, this);
                        accountKey = null;
                    }
                    connections.deauthorize(null);
                    gateway.send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                    break;
                }
                case "ping": {
                    gateway.send(conn, ProxyProtocol.resultJson(action, requestId, true, null, "pong"));
                    break;
                }
                default: {
                    boolean handled = InfoCommands.handle(action, conn, requestId, args, this)
                            || TableCommands.handle(action, conn, requestId, args, this)
                            || TournamentCommands.handle(action, conn, requestId, args, this)
                            || GameCommands.handle(action, conn, requestId, args, this)
                            || OnlineDeckCommands.handle(action, conn, requestId, args, this);
                    if (!handled) {
                        gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_UNKNOWN_ACTION, "Unknown action: " + action));
                    }
                    break;
                }
            }
        } catch (IllegalArgumentException ex) {
            String detail = ErrorClassifier.stripServerErrorPrefix(ex.getMessage());
            String code = ErrorClassifier.classifyErrorCode(detail != null ? detail : ex.getMessage());
            if (ProxyProtocol.ERR_FAILED.equals(code) && detail != null && !detail.toLowerCase(Locale.ROOT).contains("invalid argument")) {
                detail = "Invalid argument: " + detail;
            }
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, code, detail != null ? detail : "Invalid argument: " + ex.getMessage()));
        } catch (Throwable ex) {
            // Throwable, not Exception: this runs on commandExecutor, a single thread, and an
            // Error would kill it for good with no log line - ThreadPoolExecutor never replaces
            // a dead thread, so the session would stop answering any action at all.
            logger.log(Level.SEVERE, "Command failed: " + action, ex);
            String raw = ex.getMessage() != null ? ex.getMessage() : ex.toString();
            String detail = ErrorClassifier.stripServerErrorPrefix(raw);
            if (detail != null && detail.startsWith("Command failed: ")) detail = detail.substring("Command failed: ".length());
            // si la excepción ya trae "Card not found - ...", no prefijar para no enterrar el pattern
            String payload = detail != null && !detail.isEmpty() ? detail : raw;
            // para errores de cubierta, intentar pescar también el callback que el servidor ya encoló
            String polled = serverMessages.await(System.currentTimeMillis() - 2000, 900);
            if (polled != null && polled.length() > payload.length()) payload = polled;
            String code = ErrorClassifier.classifyErrorCode(payload);
            String msg = payload;
            if (ProxyProtocol.ERR_FAILED.equals(code) && !payload.toLowerCase(Locale.ROOT).startsWith("command failed")) {
                msg = "Command failed: " + payload;
            }
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, code, msg));
        }
    }

    static boolean requiresGameId(String action) {
        switch (action) {
            case "sendPlayerAction":
            case "sendPlayerUUID":
            case "sendPlayerBoolean":
            case "sendPlayerInteger":
            case "sendPlayerString":
            case "sendPlayerManaType":
            case "watchGame":
            case "stopWatching":
            case "joinGame":
            case "quitMatch":
                return true;
            default:
                return false;
        }
    }

    static String resumeStream(JsonObject args) {
        JsonObject resume = args.has("resume") && args.get("resume").isJsonObject() ? args.getAsJsonObject("resume") : null;
        return resume == null ? null : JsonArgs.str(resume, "streamId", null);
    }

    static long resumeSeq(JsonObject args) {
        JsonObject resume = args.has("resume") && args.get("resume").isJsonObject() ? args.getAsJsonObject("resume") : null;
        if (resume == null || !resume.has("seq") || !resume.get("seq").isJsonPrimitive()) {
            return -1;
        }
        try {
            return resume.get("seq").getAsLong();
        } catch (NumberFormatException ex) {
            return -1;
        }
    }

    private synchronized void connect(WebSocket conn, String requestId, String host, int port, String username, String password,
                                      String flagName, int avatarId, String resumeStreamId, long resumeSeq) {
        // mage.remote.Connection.getURI() sustituye "localhost" por la primera IP
        // no-loopback que encuentra enumerando interfaces (Connection.getLocalAddress).
        // Con interfaces bridge/túnel de VMs activas (p.ej. 192.168.97.0) construye un
        // locator bisocket inalcanzable y el login muere en "client lease". El literal
        // 127.0.0.1 se usa tal cual y siempre es correcto en el host del proxy.
        // (La misma normalización se aplica en Gateway.handleConnect para que la
        // clave host|username coincida con el accountKey registrado aquí.)
        host = normalizeHost(host);
        cancelGraceTimer();
        // idempotent connect: same user + same server already connected (e.g. several browser
        // tabs re-login after a proxy restart). Restarting the session here would kill the
        // server session and start a reconnect loop (test mode kicks duplicate users on the
        // same host), leaving the WebSocket registry empty and broadcasts at 0 connections.
        if ((connected || relinking) && isSameSession(host, port, username)) {
            logger.info("connect: already connected as " + username + " at " + host + ":" + port + " — no session restart");
            attach(conn, requestId, resumeStreamId, resumeSeq);
            return;
        }
        if (conn != null) {
            connections.deauthorize(conn);
        }
        if (connected) {
            // replace the old session instead of rejecting the new client (refresh/reconnect case)
            logger.info("connect: already connected, disconnecting old session first");
            if (accountKey != null) {
                gateway.unregisterSession(accountKey, this);
                accountKey = null;
            }
            simManager.stopSims();
            connections.deauthorize(null);
            stopSession(false);
            connected = false;
            try {
                Thread.sleep(500);
            } catch (InterruptedException ignored) {
            }
        }
        Connection connection = new Connection();
        connection.setHost(host);
        connection.setPort(port);
        connection.setUsername(username);
        connection.setPassword(password);
        connection.setUserIdStr(System.getProperty("user.name") + ":" + System.getProperty("os.name") + ":mage-proxy");
        String cleanFlag = flagName == null || flagName.isEmpty() ? "world.png" : flagName;
        if (!cleanFlag.endsWith(".png")) {
            cleanFlag = cleanFlag + ".png";
        }
        int avatar = avatarId > 0 ? avatarId : 51;
        UserData userData = UserData.getDefaultUserDataView();
        userData.setFlagName(cleanFlag);
        userData.setAvatarId(avatar);
        // Paridad con el desktop (PreferencesDialog KEY_GAME_ALLOW_REQUEST_SHOW_HAND_CARDS = "true"):
        // sin esto el servidor rechaza de oficio cualquier REQUEST_PERMISSION_TO_SEE_HAND_CARDS.
        userData.setAllowRequestShowHandCards(true);
        connection.setUserData(userData);
        connection.setProxyType(Connection.ProxyType.NONE);

        simManager.setServer(host, port);

        // a fresh ProxyClient (the previous one was disposed after a failed login, or the proxy
        // restarted) has no lastSessionId of its own, so the id the account last used is read
        // from the cross-client store: without it every retry is refused with "already
        // connected" until the server expires the old session, and the same account in another
        // tab cannot take over after an IP change
        session.setRestoreSessionId(restoreIdFor(host, port, username));
        resetSessionState();
        boolean ok;
        expectDisconnect = true;
        try {
            ok = session.connectStart(connection);
        } finally {
            expectDisconnect = false;
        }
        connected = ok;
        logger.info("connectStart=" + ok + " lastError='" + session.getLastError() + "'");
        if (ok) {
            // a dead lobby timer (e.g. an uncatchable error during a server restart) must be
            // healed on reconnect, or the lobby UI would never receive table broadcasts again
            lobbyTimer.shutdownNow();
            lobbyTimer = Executors.newSingleThreadScheduledExecutor();
            lobbyTimer.scheduleWithFixedDelay(this::publishLobby, 0, 2, TimeUnit.SECONDS);
            accountKey = host + "|" + username;
            gateway.registerSession(accountKey, this);
            if (activityUser != null && !activityUser.equals(username)) {
                gameActivity.closeAll("user_switch");
            }
            activityUser = username;
            lastConnection = connection;
            rememberLiveSession(host, username);
            lobby.publishSoon();
            lastLoginAt = System.currentTimeMillis();
            lastLoginWasRelink = false;
            Activity.login(username, gateway.ipOf(conn), host, port, true, null, false);
            connections.finishLogin(conn, ProxyProtocol.resultJson("connect", requestId, true, null, connections.connectData(false, false)));
            simManager.setOwner(accountKey);
            simManager.restoreSims();
        } else {
            connections.abandonLogin();
            // el servidor manda el detalle del fallo por un callback SHOW_USERMESSAGE
            // (llega ~3s después, tras su sleep anti-bruteforce): sondearlo para no
            // responder con un error vacío
            long start = System.currentTimeMillis();
            String detail = serverMessages.await(start, 4500);
            if (detail == null) detail = ErrorClassifier.stripServerErrorPrefix(session.getLastError());
            if (detail == null || detail.isEmpty() || detail.equalsIgnoreCase("No message")) detail = ProxyProtocol.ERR_FAILED;
            Activity.login(username, gateway.ipOf(conn), host, port, false, detail, false);
            gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, false, ErrorClassifier.classifyErrorCode(detail), detail));
            if (lastConnection == null) {
                // never logged in: stop holding the account's slot for concurrent logins, and
                // stop holding five non-daemon threads and their timers for a client that can
                // never reach a session. A retry arrives on a new WebSocket, so this client
                // has no further use (onClientMessage answers anything else with "retry").
                gateway.unregisterSession(host + "|" + username, this);
                dispose();
            }
        }
    }

    public boolean isRelinking() {
        return relinking;
    }

    /**
     * Attaches an authenticated connection to this live session (same account, another window or
     * a reload). Runs on the WebSocket selector thread, so it must not take this client's monitor.
     * A connection that names this session's stream and the last frame it processed gets every
     * frame it missed, in order ({@code resumed: true}); otherwise it rejoins its game and gets
     * the latest state and prompt. Done under the broadcast lock, so no frame is lost or doubled
     * between the replay and the live stream.
     */
    public void attach(WebSocket conn, String requestId, String resumeStreamId, long resumeSeq) {
        connections.attach(conn, requestId, resumeStreamId, resumeSeq);
        lobby.publishSoon();
    }

    public boolean isSameSession(String host, int port, String username) {
        try {
            return session.getUserName() != null
                    && session.getUserName().equalsIgnoreCase(username)
                    && session.getServerHost().equalsIgnoreCase(host);
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * Restore id to present on a login: this client's live session id when it is the same
     * account, otherwise the id that account last used through this proxy, so a retry or a
     * reload can take over a session the server still holds (see {@link RestoreIds}).
     */
    String restoreIdFor(String host, int port, String username) {
        Connection previous = lastConnection;
        boolean sameAccount = previous != null && previous.getHost().equalsIgnoreCase(host)
                && previous.getPort() == port && previous.getUsername().equalsIgnoreCase(username);
        if (sameAccount && lastSessionId != null && !lastSessionId.isEmpty()) {
            return lastSessionId;
        }
        return RestoreIds.get(host, username);
    }

    /** The session id just established is the account's restore ticket across clients (see {@link RestoreIds}). */
    void rememberLiveSession(String host, String username) {
        lastSessionId = session.getSessionId();
        RestoreIds.put(host, username, lastSessionId);
    }
}
