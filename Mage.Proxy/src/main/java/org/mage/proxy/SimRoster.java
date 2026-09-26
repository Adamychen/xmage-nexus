package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.LongSupplier;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * SIM seats that are playing, kept on disk so a restarted proxy can log the bots in again. The
 * server keeps the tables of a lost connection for a few minutes and treats a login with the same
 * name from the same host as a reconnection, which restores the bot's games; without this a game
 * against a SIM stalled forever after a proxy restart.
 */
final class SimRoster {

    private static final Logger logger = Logger.getLogger(SimRoster.class.getName());

    /** A roster older than this belongs to games the server has already closed. */
    static final long MAX_AGE_MS = 10 * 60 * 1000L;

    static final class Seat {
        final String owner;
        final String username;
        final String host;
        final int port;
        final int skill;
        final JsonObject deck;

        Seat(String owner, String username, String host, int port, int skill, JsonObject deck) {
            this.owner = owner;
            this.username = username;
            this.host = host;
            this.port = port;
            this.skill = skill;
            this.deck = deck;
        }
    }

    private final File file;
    private final LongSupplier clock;
    private final Map<String, Seat> seats = new LinkedHashMap<>();

    SimRoster(File file, LongSupplier clock) {
        this.file = file;
        this.clock = clock;
        load();
    }

    static SimRoster fromConfig(Config config) {
        String path = config.getSimRosterPath();
        return new SimRoster(path.isEmpty() ? null : new File(path), System::currentTimeMillis);
    }

    synchronized void add(Seat seat) {
        seats.put(seat.username, seat);
        save();
    }

    synchronized void remove(String username) {
        if (seats.remove(username) != null) {
            save();
        }
    }

    /** Takes the seats of an account on a server: the caller logs them in again. */
    synchronized List<Seat> takeFor(String owner, String host, int port) {
        List<Seat> out = new ArrayList<>();
        for (Seat s : seats.values()) {
            if (s.owner.equals(owner) && s.host.equalsIgnoreCase(host) && s.port == port) {
                out.add(s);
            }
        }
        if (!out.isEmpty()) {
            for (Seat s : out) {
                seats.remove(s.username);
            }
            save();
        }
        return out;
    }

    /** Highest numeric suffix of the SIM names on the roster (new bots must not reuse one). */
    synchronized long maxSimNumber() {
        long max = 0;
        for (String name : seats.keySet()) {
            int dash = name.lastIndexOf('-');
            try {
                max = Math.max(max, Long.parseLong(name.substring(dash + 1)));
            } catch (NumberFormatException ignored) {
            }
        }
        return max;
    }

    synchronized int size() {
        return seats.size();
    }

    /** Refreshes the file's timestamp while bots are playing (a stale file is ignored on load). */
    synchronized void touch() {
        if (!seats.isEmpty()) {
            save();
        }
    }

    private void load() {
        if (file == null || !file.isFile()) {
            return;
        }
        try {
            JsonObject root = JsonParser.parseString(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)).getAsJsonObject();
            long savedAt = root.has("savedAt") ? root.get("savedAt").getAsLong() : 0;
            if (clock.getAsLong() - savedAt > MAX_AGE_MS) {
                logger.info("SIM roster " + file + " is stale, ignored");
                return;
            }
            for (JsonElement el : root.getAsJsonArray("seats")) {
                JsonObject o = el.getAsJsonObject();
                Seat s = new Seat(
                        o.get("owner").getAsString(),
                        o.get("username").getAsString(),
                        o.get("host").getAsString(),
                        o.get("port").getAsInt(),
                        o.has("skill") ? o.get("skill").getAsInt() : 0,
                        o.has("deck") && o.get("deck").isJsonObject() ? o.getAsJsonObject("deck") : null);
                seats.put(s.username, s);
            }
            logger.info("SIM roster loaded: " + seats.size() + " seat(s) to restore");
        } catch (Exception ex) {
            logger.log(Level.WARNING, "SIM roster " + file + " unreadable, ignored: " + ex.getMessage());
        }
    }

    private void save() {
        if (file == null) {
            return;
        }
        JsonObject root = new JsonObject();
        root.addProperty("savedAt", clock.getAsLong());
        JsonArray arr = new JsonArray();
        for (Seat s : seats.values()) {
            JsonObject o = new JsonObject();
            o.addProperty("owner", s.owner);
            o.addProperty("username", s.username);
            o.addProperty("host", s.host);
            o.addProperty("port", s.port);
            o.addProperty("skill", s.skill);
            if (s.deck != null) {
                o.add("deck", s.deck);
            }
            arr.add(o);
        }
        root.add("seats", arr);
        try {
            File dir = file.getAbsoluteFile().getParentFile();
            if (dir != null) {
                dir.mkdirs();
            }
            File tmp = new File(file.getPath() + ".tmp");
            Files.write(tmp.toPath(), root.toString().getBytes(StandardCharsets.UTF_8));
            Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            logger.log(Level.WARNING, "SIM roster " + file + " not saved: " + ex.getMessage());
        }
    }
}
