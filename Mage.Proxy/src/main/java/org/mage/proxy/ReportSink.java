package org.mage.proxy;

import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Where a player-submitted report lands: one greppable journal line (written by
 * {@link Activity#report}) and one file under the reports directory.
 * <p>
 * Nothing here is public: the file is what the maintainer reads, and only what the maintainer
 * promotes ever reaches the issue tracker. The quota and the caps exist because the submit
 * channel is reachable by any logged-in player, and an unbounded one is a disk-filling spam
 * relay rather than a feedback system.
 */
final class ReportSink {

    /** "OFF" (or empty) in {@code --reportsDir} disables the whole feature. */
    static final String OFF = "OFF";
    static final int MAX_TEXT_CHARS = 2000;
    static final int EXCERPT_CHARS = 120;

    private static final SecureRandom RANDOM = new SecureRandom();

    private ReportSink() {
    }

    static boolean enabled(Config config) {
        String dir = config.getReportsDir();
        return !dir.trim().isEmpty() && !OFF.equalsIgnoreCase(dir.trim());
    }

    static Path root(Config config) {
        return Paths.get(config.getReportsDir().trim());
    }

    /** Eight lowercase hex chars, the reference the player is shown and quotes later. */
    static String newId() {
        byte[] four = new byte[4];
        RANDOM.nextBytes(four);
        StringBuilder sb = new StringBuilder(8);
        for (byte b : four) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16));
            sb.append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }

    /**
     * One greppable line out of whatever the player typed: quotes and control characters become
     * spaces (a \n in a report would otherwise forge a second journal line) and it is cut at
     * {@code maxChars}. Used for the excerpt and for the fingerprint.
     */
    static String excerpt(String raw, int maxChars) {
        if (raw == null || raw.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder(Math.min(raw.length(), maxChars));
        for (int i = 0; i < raw.length() && sb.length() < maxChars; i++) {
            char c = raw.charAt(i);
            sb.append(c == '"' || c == '\\' || Character.isISOControl(c) ? ' ' : c);
        }
        return sb.toString().trim();
    }

    /** A JSON string literal, escaped, for values that go into the report file. */
    static String jsonString(String raw) {
        if (raw == null || raw.isEmpty()) {
            return "\"\"";
        }
        StringBuilder sb = new StringBuilder(raw.length() + 8);
        sb.append('"');
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c == '"') {
                sb.append("\\\"");
            } else if (c == '\\') {
                sb.append("\\\\");
            } else if (c == '\n') {
                sb.append("\\n");
            } else if (c == '\r') {
                sb.append("\\r");
            } else if (c == '\t') {
                sb.append("\\t");
            } else if (Character.isISOControl(c)) {
                sb.append(' ');
            } else {
                sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    /**
     * What the sink decided, for the journal line and the ack sent back to the player.
     */
    static final class Result {
        final boolean stored;
        final String id;
        final String path;
        final String reason;
        final int bytes;

        Result(boolean stored, String id, String path, String reason, int bytes) {
            this.stored = stored;
            this.id = id;
            this.path = path;
            this.reason = reason;
            this.bytes = bytes;
        }
    }

    /**
     * The whole decision in one place, so it is testable without a WebSocket: caps first, then
     * the per-session quota, then the disk. It returns without storing when any of them says no,
     * and it never rejects a payload the client sent for being surprising - only for being too
     * big or for an unwritable disk.
     */
    static Result store(Config config, Quota quota, long nowMs, String user, String ip, String kind,
                        String text, String fingerprint, String payload) throws IOException {
        int bytes = payload.length();
        if (!enabled(config)) {
            return new Result(false, null, null, "disabled", bytes);
        }
        if (bytes > config.getReportMaxFileBytes()) {
            return new Result(false, null, null, "too-large", bytes);
        }
        String refused = quota.check(fingerprint, nowMs);
        if (refused != null) {
            return new Result(false, null, null, refused, bytes);
        }
        String id = uniqueId(config);
        String path = write(config, id, file(id, nowMs, user, ip, kind, text, fingerprint, payload));
        quota.record(fingerprint, nowMs);
        return new Result(true, id, path, null, bytes);
    }

    private static String uniqueId(Config config) {
        for (int attempt = 0; attempt < 8; attempt++) {
            String id = newId();
            String day = LocalDate.now(ZoneOffset.UTC).toString();
            if (!Files.exists(root(config).resolve(day).resolve(id + ".json"))) {
                return id;
            }
        }
        return newId();
    }

    private static String file(String id, long nowMs, String user, String ip, String kind, String text,
                               String fingerprint, String payload) {
        StringBuilder sb = new StringBuilder(payload.length() + 256);
        sb.append('{')
                .append("\"id\":").append(jsonString(id)).append(',')
                .append("\"at\":").append(nowMs).append(',')
                .append("\"kind\":").append(jsonString(kind)).append(',')
                .append("\"user\":").append(jsonString(user)).append(',')
                .append("\"ip\":").append(jsonString(ip)).append(',')
                .append("\"fingerprint\":").append(jsonString(fingerprint)).append(',')
                .append("\"text\":").append(jsonString(text)).append(',')
                .append("\"payload\":").append(isJson(payload) ? payload : jsonString(payload))
                .append('}');
        return sb.toString();
    }

    /**
     * A report file has to stay parseable: the dashboard reads it, and one payload that is not
     * JSON would take the panel down for every report behind it. Anything unparseable is stored
     * as a string instead, which is still worth reading.
     */
    private static boolean isJson(String payload) {
        try {
            JsonParser.parseString(payload);
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    /**
     * Writes the payload to {@code <root>/<yyyy-MM-dd>/<id>.json} and prunes afterwards.
     * Returns the relative path so the journal line names where to look.
     */
    static String write(Config config, String id, String json) throws IOException {
        Path base = root(config);
        String day = LocalDate.now(ZoneOffset.UTC).toString();
        Path dir = base.resolve(day);
        Files.createDirectories(dir);
        Path file = dir.resolve(id + ".json");
        Files.write(file, json.getBytes(StandardCharsets.UTF_8));
        prune(config, base);
        return day + "/" + id + ".json";
    }

    /**
     * Keeps the directory bounded by age, by count and by total bytes, in that order. Called
     * after every write because the proxy runs unattended: the failure mode of a report sink
     * nobody reads is a full disk on the box that also serves the games.
     */
    static void prune(Config config, Path base) {
        final int maxFiles = config.getReportMaxFiles();
        final long maxBytes = config.getReportMaxBytes();
        final long maxAgeMs = config.getReportMaxAgeDays() * 24L * 60L * 60L * 1000L;
        final long now = System.currentTimeMillis();
        List<Path> files = new ArrayList<Path>();
        long total = 0;
        try {
            collect(base, files);
        } catch (IOException ignored) {
            return;
        }
        for (Path p : files) {
            total += sizeOf(p);
        }
        boolean expired = false;
        for (Path p : files) {
            if (now - age(p) > maxAgeMs) {
                expired = true;
                break;
            }
        }
        if (!expired && files.size() <= maxFiles && total <= maxBytes) {
            return;
        }
        // oldest first: when a bug is still happening, the report worth keeping is the recent one
        Collections.sort(files, new Comparator<Path>() {
            @Override
            public int compare(Path a, Path b) {
                return Long.compare(age(a), age(b));
            }
        });
        for (Path p : new ArrayList<Path>(files)) {
            long size = sizeOf(p);
            boolean overAge = now - age(p) > maxAgeMs;
            if (!overAge && files.size() <= maxFiles && total <= maxBytes) {
                return;
            }
            if (delete(p)) {
                files.remove(p);
                total -= size;
            }
        }
    }

    private static long sizeOf(Path p) {
        try {
            return Files.size(p);
        } catch (IOException ex) {
            return 0L;
        }
    }

    private static boolean delete(Path p) {
        try {
            Files.delete(p);
            return true;
        } catch (IOException ex) {
            return false;
        }
    }

    private static long age(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis();
        } catch (IOException ex) {
            return 0L;
        }
    }

    static void collect(Path dir, List<Path> out) throws IOException {
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path p : stream) {
                if (Files.isDirectory(p)) {
                    collect(p, out);
                } else {
                    out.add(p);
                }
            }
        }
    }

    /**
     * Per-session limits. One instance per {@link ProxyClient}, which is why it can keep plain
     * fields instead of a shared map nothing would ever clean up.
     */
    static final class Quota {

        private final Config config;
        private final Set<String> seen = new HashSet<String>();
        private int count;
        private long lastAt;

        Quota(Config config) {
            this.config = config;
        }

        /** Null when the report may be stored, otherwise the reason it will not. */
        synchronized String check(String fingerprint, long nowMs) {
            if (count >= config.getReportQuotaCount()) {
                return "quota";
            }
            if (lastAt != 0 && nowMs - lastAt < config.getReportQuotaIntervalMillis()) {
                return "rate";
            }
            if (!fingerprint.isEmpty() && seen.contains(fingerprint)) {
                return "duplicate";
            }
            return null;
        }

        synchronized void record(String fingerprint, long nowMs) {
            count++;
            lastAt = nowMs;
            if (!fingerprint.isEmpty()) {
                if (seen.size() > 64) {
                    seen.clear();
                }
                seen.add(fingerprint);
            }
        }

        synchronized int used() {
            return count;
        }
    }
}