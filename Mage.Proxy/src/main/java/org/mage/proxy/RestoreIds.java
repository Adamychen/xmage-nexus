package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.LongSupplier;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Last XMage session id seen per account, kept across {@link ProxyClient} instances and proxy
 * restarts (on disk).
 *
 * <p>While a user is connected the server keeps that user's session id as its restore id and
 * hands the session over to any client that presents it ({@code Session.connectUserHandling},
 * {@code canDisconnectAnyDueSessionRestore}), even when the login arrives from another address.
 * Remembering it is what lets a retry after a disposed client, a page reload, a proxy deploy or
 * a changed IP take the account back instead of being refused with "already connected or your
 * IP address changed" until the server expires the old session.
 *
 * <p>Bounded in memory (least recently used evicted) and on disk (entries older than
 * {@link #MAX_AGE_MS} pruned on save/load, like the SIM roster): after that the server has
 * already removed the user, so the id would never match.
 */
final class RestoreIds {

    private static final Logger logger = Logger.getLogger(RestoreIds.class.getName());

    /** One small entry per account; the eldest is evicted so a long-lived proxy cannot grow. */
    static final int MAX_ACCOUNTS = 10_000;

    /** The server removes a lost user 8 minutes after it stops answering; an older id cannot match. */
    static final long MAX_AGE_MS = 10 * 60 * 1000L;

    private static final class Entry {
        final String sessionId;
        final long at;

        Entry(String sessionId, long at) {
            this.sessionId = sessionId;
            this.at = at;
        }
    }

    private static final Map<String, Entry> BY_ACCOUNT = Collections.synchronizedMap(
            new LinkedHashMap<String, Entry>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
                    return size() > MAX_ACCOUNTS;
                }
            });

    private static File file = null;
    private static LongSupplier clock = System::currentTimeMillis;

    private RestoreIds() {
    }

    /** Enables persistence (once, at startup); a disabled config keeps the store in memory only. */
    static synchronized void configure(Config config) {
        String path = config.getRestoreIdsPath();
        file = path.isEmpty() ? null : new File(path);
        if (file != null) {
            load();
        }
    }

    static String key(String host, String username) {
        return ProxyClient.normalizeHost(host == null ? "" : host) + "|" + (username == null ? "" : username);
    }

    /** Restore id to present on a login of that account ("" when the proxy never saw one). */
    static synchronized String get(String host, String username) {
        Entry e = BY_ACCOUNT.get(key(host, username));
        return e == null ? "" : e.sessionId;
    }

    /** Remembers the account's live session id; blank ids are ignored. */
    static synchronized void put(String host, String username, String sessionId) {
        if (sessionId == null || sessionId.isEmpty()) {
            return;
        }
        BY_ACCOUNT.put(key(host, username), new Entry(sessionId, clock.getAsLong()));
        save();
    }

    /** An explicit logout drops the ticket: the next login is a fresh session. */
    static synchronized void clear(String host, String username) {
        if (BY_ACCOUNT.remove(key(host, username)) != null) {
            save();
        }
    }

    /** Test isolation: the store is process-wide like the account registry. */
    static synchronized void clearAll() {
        BY_ACCOUNT.clear();
    }

    private static void load() {
        if (file == null || !file.isFile()) {
            return;
        }
        try {
            JsonObject root = JsonParser.parseString(
                    new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)).getAsJsonObject();
            long now = clock.getAsLong();
            if (root.has("ids") && root.get("ids").isJsonObject()) {
                for (Map.Entry<String, JsonElement> e : root.getAsJsonObject("ids").entrySet()) {
                    JsonObject o = e.getValue().getAsJsonObject();
                    long at = o.has("at") ? o.get("at").getAsLong() : 0;
                    if (now - at <= MAX_AGE_MS && o.has("id")) {
                        BY_ACCOUNT.put(e.getKey(), new Entry(o.get("id").getAsString(), at));
                    }
                }
            }
            logger.info("restore ids loaded: " + BY_ACCOUNT.size() + " account(s)");
        } catch (Exception ex) {
            logger.log(Level.WARNING, "restore ids " + file + " unreadable, ignored: " + ex.getMessage());
        }
    }

    private static void save() {
        if (file == null) {
            return;
        }
        long now = clock.getAsLong();
        JsonObject ids = new JsonObject();
        for (Map.Entry<String, Entry> e : BY_ACCOUNT.entrySet()) {
            if (now - e.getValue().at > MAX_AGE_MS) {
                continue;
            }
            JsonObject o = new JsonObject();
            o.addProperty("id", e.getValue().sessionId);
            o.addProperty("at", e.getValue().at);
            ids.add(e.getKey(), o);
        }
        JsonObject root = new JsonObject();
        root.addProperty("savedAt", now);
        root.add("ids", ids);
        try {
            File dir = file.getAbsoluteFile().getParentFile();
            if (dir != null) {
                dir.mkdirs();
            }
            File tmp = new File(file.getPath() + ".tmp");
            Files.write(tmp.toPath(), root.toString().getBytes(StandardCharsets.UTF_8));
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            // a session id is a bearer ticket for the account: owner-only, best effort
            file.setReadable(false, false);
            file.setReadable(true, true);
            file.setWritable(false, false);
            file.setWritable(true, true);
        } catch (IOException ex) {
            logger.log(Level.WARNING, "restore ids " + file + " not saved: " + ex.getMessage());
        }
    }
}
