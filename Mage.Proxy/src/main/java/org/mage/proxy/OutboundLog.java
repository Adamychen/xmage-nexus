package org.mage.proxy;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.function.LongSupplier;

/**
 * Sequence-numbered log of the frames a session broadcast, so a connection that comes back
 * (network blip, phone in the background) resumes from the last frame it processed instead of
 * only getting the latest state and prompt: a SIDEBOARD, a Bo3 game 2 START_GAME, a GAME_OVER
 * or chat sent during the gap are replayed in order.
 * <p>
 * A frame carrying a {@code supersedeKey} (a full game state) replaces the older frame with the
 * same key. Frames are kept while they are recent or were produced with no client attached,
 * bounded by size; a resume from a sequence that was evicted is refused (the caller falls back to
 * the latest state and prompt).
 */
final class OutboundLog {

    static final int MAX_FRAMES = 2000;
    static final long MAX_CHARS = 16L * 1024 * 1024;
    static final long DELIVERED_RETENTION_MS = 60_000;

    private static final class Entry {
        final long seq;
        final long at;
        final boolean delivered;
        final String key;
        String json;

        Entry(long seq, long at, boolean delivered, String key, String json) {
            this.seq = seq;
            this.at = at;
            this.delivered = delivered;
            this.key = key;
            this.json = json;
        }
    }

    private final LongSupplier clock;
    private final int maxFrames;
    private final long maxChars;
    private final Deque<Entry> entries = new ArrayDeque<>();
    private final Map<String, Entry> byKey = new HashMap<>();
    private long nextSeq = 1;
    private long evictedThrough = 0;
    private long chars = 0;
    private int live = 0;

    OutboundLog() {
        this(System::currentTimeMillis, MAX_FRAMES, MAX_CHARS);
    }

    OutboundLog(LongSupplier clock, int maxFrames, long maxChars) {
        this.clock = clock;
        this.maxFrames = maxFrames;
        this.maxChars = maxChars;
    }

    /** Numbers a JSON object frame and keeps it; returns the frame with its {@code seq}. */
    synchronized String append(String json, String supersedeKey, boolean delivered) {
        long seq = nextSeq++;
        String framed = withSeq(json, seq);
        Entry entry = new Entry(seq, clock.getAsLong(), delivered, supersedeKey, framed);
        if (supersedeKey != null) {
            Entry old = byKey.put(supersedeKey, entry);
            if (old != null && old.json != null) {
                chars -= old.json.length();
                old.json = null;
                live--;
            }
        }
        entries.addLast(entry);
        chars += framed.length();
        live++;
        trim();
        return framed;
    }

    /**
     * Frames after {@code seq}, in order, or null when some of them were evicted and the stream
     * can no longer be resumed from there.
     */
    synchronized List<String> since(long seq) {
        if (seq < evictedThrough || seq >= nextSeq) {
            return null;
        }
        List<String> out = new ArrayList<>();
        for (Entry e : entries) {
            if (e.seq > seq && e.json != null) {
                out.add(e.json);
            }
        }
        return out;
    }

    synchronized long lastSeq() {
        return nextSeq - 1;
    }

    synchronized int size() {
        return live;
    }

    private void trim() {
        long now = clock.getAsLong();
        Iterator<Entry> it = entries.iterator();
        while (it.hasNext()) {
            Entry e = it.next();
            boolean dead = e.json == null;
            boolean overLimit = live > maxFrames || chars > maxChars;
            boolean expired = e.delivered && now - e.at > DELIVERED_RETENTION_MS;
            if (!dead && !overLimit && !expired) {
                break;
            }
            it.remove();
            if (!dead) {
                chars -= e.json.length();
                live--;
                evictedThrough = e.seq;
                if (e.key != null && byKey.get(e.key) == e) {
                    byKey.remove(e.key);
                }
            }
        }
    }

    static String withSeq(String json, long seq) {
        if (json.length() < 2 || json.charAt(0) != '{') {
            return json;
        }
        return "{\"seq\":" + seq + (json.charAt(1) == '}' ? "" : ",") + json.substring(1);
    }
}
