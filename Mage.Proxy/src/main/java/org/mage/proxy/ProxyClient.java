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
import mage.view.RoomUsersView;
import org.java_websocket.WebSocket;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
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
 * - routes JSON commands from the web client to domain handlers (CommandDispatch)
 *   and maps them to Session calls
 * - polls the lobby (tables/users) periodically and publishes it
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
    private final Set<WebSocket> authorized = Collections.newSetFromMap(new IdentityHashMap<WebSocket, Boolean>());

    // all commands from web clients are processed in order on one thread
    private final ExecutorService commandExecutor = Executors.newSingleThreadExecutor();
    // server callbacks are processed in order on one thread (recreated on user switch to drain stale ones)
    private ExecutorService callbackExecutor = Executors.newSingleThreadExecutor();
    private ScheduledExecutorService lobbyTimer = Executors.newSingleThreadScheduledExecutor();
    private final ScheduledExecutorService pingTimer = Executors.newSingleThreadScheduledExecutor();

    // out-of-order protection for reconnect/bad network (same logic as the original client)
    private final Map<ClientCallbackType, Integer> lastMessages = new java.util.HashMap<>();

    /**
     * Game ids "owned" by the current server session (seen via START_GAME / WATCHGAME / GAME_INIT
     * since the last connect). When the proxy switches users, the server re-sends the pending
     * state of the previous user's still-running games over the same channel; those events belong
     * to games this session never joined/watched, so they must not reach the new web client
     * (they flooded the single-threaded callback queue and starved real dialogs like WATCHGAME).
     */
    private final Set<UUID> sessionGameIds = new java.util.HashSet<>();
    /** Último GAME_INIT/GAME_UPDATE serializado por partida (replay al re-attach). */
    private final ConcurrentMap<UUID, String> latestGameEvents = new ConcurrentHashMap<>();
    /** Último prompt de partida pendiente de respuesta (replay al re-attach). */
    private final ConcurrentMap<UUID, String> pendingPromptEvents = new ConcurrentHashMap<>();

    private final SimManager simManager;
    private String accountKey = null;

    private volatile boolean connected = false;
    private final List<ClientCallback> handshakeBuffer = new java.util.LinkedList<>();
    private volatile String lastDetailedMessage = null;
    private volatile long lastDetailedMessageAt = 0;

    private ScheduledFuture<?> graceDisconnectTimer = null;
    public static final int DISCONNECT_GRACE_PERIOD_SECS = 60;

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
        this.simManager = new SimManager(config, this::broadcastError);
        Arrays.stream(ClientCallbackType.values()).forEach(t -> this.lastMessages.put(t, 0));
        lobbyTimer.scheduleWithFixedDelay(this::publishLobby, 2, 2, TimeUnit.SECONDS);
        // keep the server session alive (the original client pings from its UI; we have no UI)
        pingTimer.scheduleWithFixedDelay(this::pingServer, PING_SERVER_SECS, PING_SERVER_SECS, TimeUnit.SECONDS);
    }

    // must be less than the server's connection timeout (UserManagerImpl.USER_CONNECTION_TIMEOUTS_CHECK_SECS)
    private static final int PING_SERVER_SECS = 20;

    private void pingServer() {
        try {
            if (connected) {
                session.ping();
            }
        } catch (Throwable ex) {
            logger.log(Level.FINE, "ping failed", ex);
        }
    }

    public SessionImpl getSession() {
        return session;
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

    public synchronized void shutdown() {
        if (graceDisconnectTimer != null) {
            graceDisconnectTimer.cancel(true);
            graceDisconnectTimer = null;
        }
        commandExecutor.shutdownNow();
        callbackExecutor.shutdownNow();
        lobbyTimer.shutdownNow();
        try {
            session.connectStop(false, false);
        } catch (Exception ignored) {
        }
    }

    // ============================ websocket client callbacks ============================

    public synchronized void onClientOpen(WebSocket conn) {
        if (graceDisconnectTimer != null) {
            graceDisconnectTimer.cancel(false);
            graceDisconnectTimer = null;
            logger.info("New WebSocket client connected; cancelled grace disconnect timer.");
        }
        sendInfo(conn, "Proxy ready. Send {\"action\":\"connect\",...} to log in.");
    }

    public synchronized void onClientClose(WebSocket conn) {
        authorized.remove(conn);
        if (authorized.isEmpty() && connected) {
            logger.info("All WebSocket clients disconnected. Starting " + DISCONNECT_GRACE_PERIOD_SECS + "s grace period before stopping session.");
            if (graceDisconnectTimer != null) {
                graceDisconnectTimer.cancel(false);
            }
            graceDisconnectTimer = pingTimer.schedule(() -> {
                synchronized (ProxyClient.this) {
                    if (authorized.isEmpty() && connected) {
                        logger.info("Grace period expired without client reconnect. Cleaning up XMage session.");
                        simManager.stopSims();
                        try {
                            session.connectStop(false, false);
                        } catch (Exception ignored) {
                        }
                        connected = false;
                        if (accountKey != null) {
                            gateway.unregisterSession(accountKey);
                            accountKey = null;
                        }
                    }
                }
            }, DISCONNECT_GRACE_PERIOD_SECS, TimeUnit.SECONDS);
        }
    }

    /** Reenvía estado solo a conexiones que han autenticado su sesión local. */
    private void broadcastAuthorized(String json) {
        synchronized (authorized) {
            for (WebSocket conn : authorized) {
                gateway.send(conn, json);
            }
        }
    }

    public void onClientMessage(WebSocket conn, String message) {
        commandExecutor.execute(() -> handleCommand(conn, message));
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
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "disconnected");
        ev.addProperty("info", "Disconnected from server");
        broadcastAuthorized(ev.toString());
    }

    @Override
    public void showMessage(String message) {
        captureDetailedMessage(message);
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "info");
        ev.addProperty("message", message);
        broadcastAuthorized(ev.toString());
    }

    @Override
    public void showError(String message) {
        captureDetailedMessage(message);
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "error");
        ev.addProperty("message", message);
        ev.addProperty("fatal", true);
        broadcastAuthorized(ev.toString());
    }

    private void captureDetailedMessage(String message) {
        if (message != null && !message.isEmpty()) {
            lastDetailedMessage = message;
            lastDetailedMessageAt = System.currentTimeMillis();
        }
    }

    private String pollDetailedMessage(long sinceMillis, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            String msg = lastDetailedMessage;
            long at = lastDetailedMessageAt;
            if (msg != null && at >= sinceMillis) {
                return msg;
            }
            try {
                Thread.sleep(60);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        String msg = lastDetailedMessage;
        long at = lastDetailedMessageAt;
        if (msg != null && at >= sinceMillis && System.currentTimeMillis() - at < 4000) {
            return msg;
        }
        return null;
    }

    /** Respuesta ok:false con el detalle real del servidor (y su errorCode clasificado). */
    @Override
    public void sendFailure(WebSocket conn, String action, String requestId, long start) {
        String detail = pollDetailedMessage(start, 1600);
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
        callbackExecutor.execute(() -> processCallback(callback));
    }

    private void tryCaptureFromCallback(ClientCallback callback) {
        try {
            ClientCallbackMethod m = callback.getMethod();
            if (m == ClientCallbackMethod.SHOW_USERMESSAGE) {
                Object d = callback.getData();
                if (d != null) {
                    String json = JsonUtil.toJson(d);
                    JsonElement el = JsonParser.parseString(json);
                    String extracted = null;
                    if (el.isJsonArray()) {
                        // sendErrorMessageToClient manda List<String>: ["Error while connecting to server", detalle]
                        StringBuilder sb = new StringBuilder();
                        for (JsonElement item : el.getAsJsonArray()) {
                            if (item.isJsonPrimitive()) {
                                if (sb.length() > 0) sb.append('\n');
                                sb.append(item.getAsString());
                            }
                        }
                        extracted = sb.length() > 0 ? sb.toString() : null;
                    } else if (el.isJsonObject()) {
                        JsonObject o = el.getAsJsonObject();
                        if (o.has("message") && o.get("message").isJsonPrimitive()) extracted = o.get("message").getAsString();
                        else if (o.has("Message") && o.get("Message").isJsonPrimitive()) extracted = o.get("Message").getAsString();
                        if (extracted == null || extracted.isEmpty()) {
                            for (Map.Entry<String, JsonElement> e : o.entrySet()) {
                                if (!e.getValue().isJsonPrimitive()) continue;
                                String v = e.getValue().getAsString().toLowerCase(Locale.ROOT);
                                if (v.contains("card not found") || v.contains("quit ratio") || v.contains("invalid deck") || v.contains("rating") || v.contains("not started") || v.contains("no valid deck") || v.contains("must contain") || v.contains("too few")
                                        || v.contains("too powerful") || v.contains("power level") || v.contains("requested no") || v.contains("appropriate for the selected format") || v.contains("select a deck") || v.contains("player can't join") || v.contains("could not create player")
                                        || v.contains("no available seats") || v.contains("table is full") || v.contains("can join a table only") || v.contains("wrong password")) {
                                    extracted = e.getValue().getAsString();
                                    break;
                                }
                            }
                        }
                        if (extracted == null && o.has("text") && o.get("text").isJsonPrimitive()) extracted = o.get("text").getAsString();
                        if (extracted == null && json.length() < 2000) extracted = json;
                    }
                    if (extracted != null && !extracted.isEmpty()) captureDetailedMessage(ErrorClassifier.stripServerErrorPrefix(extracted));
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
                int lastAnyMessageId = lastMessages.values().stream().mapToInt(x -> x).max().orElse(0);
                if (lastAnyMessageId > callback.getMessageId()) {
                    if (callback.getMethod().getType().mustIgnoreOnOutdated()) {
                        logger.info("event DROPPED as outdated: " + callback.getMethod() + " (msgId=" + callback.getMessageId()
                                + " < last=" + lastAnyMessageId + ")");
                        return;
                    }
                }
                if (!callback.getMethod().getType().canComeInAnyOrder()) {
                    lastMessages.put(callback.getMethod().getType(), callback.getMessageId());
                }
            }

            // session isolation: drop events of games this session never joined/watched.
            // After a user switch the server re-sends the previous user's still-running games
            // over the same channel; forwarding them floods the single-threaded callback queue
            // and starves real events of the new session (e.g. WATCHGAME arriving 60+ seconds late).
            UUID callbackObjectId = callback.getObjectId();
            if (callbackObjectId != null && isGameRelated(callback.getMethod())) {
                if (callback.getMethod() == ClientCallbackMethod.WATCHGAME
                        || callback.getMethod() == ClientCallbackMethod.START_GAME
                        || callback.getMethod() == ClientCallbackMethod.GAME_INIT) {
                    sessionGameIds.add(callbackObjectId);
                }
                if (!sessionGameIds.contains(callbackObjectId)) {
                    logger.info("event IGNORED (game not active in this session): " + callback.getMethod()
                            + " (msgId=" + callback.getMessageId() + ", obj=" + callbackObjectId + ")");
                    return;
                }
            }

            JsonObject ev = new JsonObject();
            ev.addProperty("type", "event");
            ev.addProperty("method", callback.getMethod().name());
            ev.addProperty("messageId", callback.getMessageId());
            if (callback.getObjectId() != null) {
                ev.addProperty("objectId", callback.getObjectId().toString());
            }
            Object data = callback.getData();
            if (data != null) {
                JsonElement dataJson = JsonParser.parseString(JsonUtil.toJson(data));
                // El ChatMessage del servidor no trae su chatId (viaja en el objectId
                // del callback): inyectarlo para cumplir el contrato ChatMessageEvent.
                if (callback.getMethod() == ClientCallbackMethod.CHATMESSAGE
                        && callbackObjectId != null
                        && dataJson.isJsonObject()
                        && !dataJson.getAsJsonObject().has("chatId")) {
                    dataJson.getAsJsonObject().addProperty("chatId", callbackObjectId.toString());
                }
                ev.add("data", dataJson);
            }
            if (logger.isLoggable(Level.FINE) || !isGameUpdate(callback)) {
                logger.info("event >> " + callback.getMethod() + " (msgId=" + callback.getMessageId()
                        + (callback.getObjectId() != null ? ", obj=" + callback.getObjectId() : "")
                        + ", data=" + (data == null ? "null" : data.getClass().getSimpleName()) + ")");
            }
            String eventJson = ev.toString();
            if (callbackObjectId != null && isGameRelated(callback.getMethod())) {
                if (callback.getMethod() == ClientCallbackMethod.GAME_INIT || isGameUpdate(callback)) {
                    latestGameEvents.put(callbackObjectId, eventJson);
                    pendingPromptEvents.remove(callbackObjectId);
                } else if (isGamePrompt(callback.getMethod())) {
                    pendingPromptEvents.put(callbackObjectId, eventJson);
                }
            }
            broadcastAuthorized(eventJson);
        } catch (Exception ex) {
            logger.log(Level.SEVERE, "Error processing callback " + callback.getInfo(), ex);
            JsonObject ev = new JsonObject();
            ev.addProperty("type", "error");
            ev.addProperty("message", "Callback error: " + callback.getMethod() + " - " + ex.getMessage());
            ev.addProperty("fatal", false);
            broadcastAuthorized(ev.toString());
        }
    }

    private static boolean isGameUpdate(ClientCallback callback) {
        ClientCallbackMethod m = callback.getMethod();
        return m == ClientCallbackMethod.GAME_UPDATE || m == ClientCallbackMethod.GAME_UPDATE_AND_INFORM;
    }

    private static boolean isGameRelated(ClientCallbackMethod method) {
        if (method == ClientCallbackMethod.START_GAME
                || method == ClientCallbackMethod.WATCHGAME
                || method == ClientCallbackMethod.END_GAME_INFO) {
            return true;
        }
        return method.name().startsWith("GAME_");
    }

    private static boolean isGamePrompt(ClientCallbackMethod method) {
        switch (method) {
            case GAME_ASK:
            case GAME_TARGET:
            case GAME_CHOOSE_ABILITY:
            case GAME_CHOOSE_PILE:
            case GAME_CHOOSE_CHOICE:
            case GAME_SELECT:
            case GAME_PLAY_MANA:
            case GAME_PLAY_XMANA:
            case GAME_GET_AMOUNT:
            case GAME_GET_MULTI_AMOUNT:
                return true;
            default:
                return false;
        }
    }

    /** Reenvía a una conexión recién adjuntada el último estado y prompt pendiente de esa partida. */
    @Override
    public void replayGameState(WebSocket conn, UUID gameId) {
        String state = latestGameEvents.get(gameId);
        if (state != null) {
            gateway.send(conn, state);
        }
        String prompt = pendingPromptEvents.get(gameId);
        if (prompt != null) {
            gateway.send(conn, prompt);
        }
    }

    // ============================ lobby polling ============================

    private void publishLobby() {
        if (!connected) {
            return;
        }
        try {
            UUID roomId = session.getMainRoomId();
            if (roomId == null) {
                return;
            }
            JsonObject lobby = new JsonObject();
            lobby.addProperty("type", "lobby");
            lobby.addProperty("roomId", roomId.toString());
            lobby.add("tables", JsonParser.parseString(JsonUtil.toJson(session.getTables(roomId))));
            Collection<RoomUsersView> roomUsers = session.getRoomUsers(roomId);
            RoomUsersView usersView = (roomUsers != null && !roomUsers.isEmpty())
                    ? roomUsers.iterator().next()
                    : new RoomUsersView(Collections.emptyList(), 0, 0, 0);
            lobby.add("users", JsonParser.parseString(JsonUtil.toJson(usersView)));
            lobby.add("serverMessages", JsonParser.parseString(JsonUtil.toJson(session.getServerMessages())));
            broadcastAuthorized(lobby.toString());
        } catch (Throwable ex) {
            // transient errors (e.g. server restart) must not spam the log; a Throwable here
            // (e.g. a remoting Error while the server dies) would otherwise cancel the
            // periodic task silently, killing all lobby broadcasts until the proxy restarts
            logger.log(Level.WARNING, "Lobby publish failed: " + ex.getMessage(), ex);
        }
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
        if (!isPublic && !authorized.contains(conn)) {
            gateway.send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_NOT_AUTHORIZED, "not connected: send connect first"));
            return;
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
                    connect(conn, requestId, host, port, username, password, flagName, avatarId);
                    break;
                }
                case "disconnect": {
                    synchronized (this) {
                        if (graceDisconnectTimer != null) {
                            graceDisconnectTimer.cancel(false);
                            graceDisconnectTimer = null;
                        }
                    }
                    simManager.stopSims();
                    session.connectStop(false, false);
                    connected = false;
                    if (accountKey != null) {
                        gateway.unregisterSession(accountKey);
                        accountKey = null;
                    }
                    authorized.clear();
                    gateway.send(conn, ProxyProtocol.resultJson(action, requestId, true, null, null));
                    break;
                }
                case "ping": {
                    gateway.send(conn, ProxyProtocol.resultJson(action, requestId, true, null, "pong"));
                    break;
                }
                default: {
                    if (!CommandDispatch.dispatch(action, conn, requestId, args, this)) {
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
        } catch (Exception ex) {
            logger.log(Level.SEVERE, "Command failed: " + action, ex);
            String raw = ex.getMessage() != null ? ex.getMessage() : ex.toString();
            String detail = ErrorClassifier.stripServerErrorPrefix(raw);
            if (detail != null && detail.startsWith("Command failed: ")) detail = detail.substring("Command failed: ".length());
            // si la excepción ya trae "Card not found - ...", no prefijar para no enterrar el pattern
            String payload = detail != null && !detail.isEmpty() ? detail : raw;
            // para errores de cubierta, intentar pescar también el callback que el servidor ya encoló
            String polled = pollDetailedMessage(System.currentTimeMillis() - 2000, 900);
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

    private synchronized void connect(WebSocket conn, String requestId, String host, int port, String username, String password, String flagName, int avatarId) {
        // mage.remote.Connection.getURI() sustituye "localhost" por la primera IP
        // no-loopback que encuentra enumerando interfaces (Connection.getLocalAddress).
        // Con interfaces bridge/túnel de VMs activas (p.ej. 192.168.97.0) construye un
        // locator bisocket inalcanzable y el login muere en "client lease". El literal
        // 127.0.0.1 se usa tal cual y siempre es correcto en el host del proxy.
        // (La misma normalización se aplica en Gateway.handleConnect para que la
        // clave host|username coincida con el accountKey registrado aquí.)
        host = normalizeHost(host);
        if (graceDisconnectTimer != null) {
            graceDisconnectTimer.cancel(false);
            graceDisconnectTimer = null;
            logger.info("connect: cancelled grace disconnect timer");
        }
        // idempotent connect: same user + same server already connected (e.g. several browser
        // tabs re-login after a proxy restart). Restarting the session here would kill the
        // server session and start a reconnect loop (test mode kicks duplicate users on the
        // same host), leaving the WebSocket registry empty and broadcasts at 0 connections.
        if (connected && isSameSession(host, port, username)) {
            logger.info("connect: already connected as " + username + " at " + host + ":" + port + " — no session restart");
            if (conn != null) {
                authorized.add(conn);
            }
            JsonObject data = new JsonObject();
            data.addProperty("attached", true);
            gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, true, null, data));
            return;
        }
        if (conn != null) {
            authorized.remove(conn);
        }
        if (connected) {
            // replace the old session instead of rejecting the new client (refresh/reconnect case)
            logger.info("connect: already connected, disconnecting old session first");
            if (accountKey != null) {
                gateway.unregisterSession(accountKey);
                accountKey = null;
            }
            simManager.stopSims();
            authorized.clear();
            session.connectStop(false, false);
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

        boolean ok = session.connectStart(connection);
        connected = ok;
        logger.info("connectStart=" + ok + " lastError='" + session.getLastError() + "'");
        if (ok) {
            // new server session => its message ids restart low, so the outdated-guard
            // would silently drop every UPDATE event of the new session otherwise
            lastMessages.replaceAll((t, v) -> 0);
            // new session owns a fresh set of games; events of the previous user's still-running
            // games (re-sent by the server over the same channel) must be dropped, not forwarded
            sessionGameIds.clear();
            latestGameEvents.clear();
            pendingPromptEvents.clear();
            // drop callbacks still queued from the previous session instead of replaying them
            // to the new client (e.g. a WATCHGAME that lagged behind the update flood)
            callbackExecutor.shutdownNow();
            callbackExecutor = Executors.newSingleThreadExecutor();
            // a dead lobby timer (e.g. an uncatchable error during a server restart) must be
            // healed on reconnect, or the lobby UI would never receive table broadcasts again
            lobbyTimer.shutdownNow();
            lobbyTimer = Executors.newSingleThreadScheduledExecutor();
            lobbyTimer.scheduleWithFixedDelay(this::publishLobby, 0, 2, TimeUnit.SECONDS);
            accountKey = host + "|" + username;
            gateway.registerSession(accountKey, this);
            if (conn != null) {
                authorized.add(conn);
            }
            JsonObject connectData = new JsonObject();
            connectData.addProperty("attached", false);
            gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, true, null, connectData));
        } else {
            // el servidor manda el detalle del fallo por un callback SHOW_USERMESSAGE
            // (llega ~3s después, tras su sleep anti-bruteforce): sondearlo para no
            // responder con un error vacío
            long start = System.currentTimeMillis();
            String detail = pollDetailedMessage(start, 4500);
            if (detail == null) detail = ErrorClassifier.stripServerErrorPrefix(session.getLastError());
            if (detail == null || detail.isEmpty() || detail.equalsIgnoreCase("No message")) detail = ProxyProtocol.ERR_FAILED;
            gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, false, ErrorClassifier.classifyErrorCode(detail), detail));
        }
    }

    public void connect(String host, int port, String username, String password) {
        connect(null, "", host, port, username, password, "world.png", 51);
    }

    /** Adjunta una conexión ya autenticada a esta sesión existente (misma cuenta, otra ventana). */
    public synchronized void attach(WebSocket conn, String requestId) {
        authorized.add(conn);
        JsonObject data = new JsonObject();
        data.addProperty("attached", true);
        gateway.send(conn, ProxyProtocol.resultJson("connect", requestId, true, null, data));
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "connected");
        ev.addProperty("info", "Connected (attached to existing session)");
        gateway.send(conn, ev.toString());
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

    // ============================ helpers ============================

    private static void sendInfo(WebSocket conn, String message) {
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "info");
        ev.addProperty("message", message);
        gatewaySend(conn, ev.toString());
    }

    private static void gatewaySend(WebSocket conn, String json) {
        if (conn != null && conn.isOpen()) {
            conn.send(json);
        }
    }
}
