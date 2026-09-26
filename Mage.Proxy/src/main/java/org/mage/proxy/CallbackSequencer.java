package org.mage.proxy;

import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.ToIntFunction;

/**
 * Restores the server's callback order before the proxy processes it.
 * <p>
 * XMage numbers every callback of a session with one contiguous counter
 * ({@code Session.fireCallback}), but the remoting layer can hand them over out of
 * order. On a reconnect the re-asked GAME_SELECT used to overtake its START_GAME /
 * GAME_INIT, was dropped as an event of a foreign game, and the player was left
 * without the prompt the engine was waiting for. Items are released in messageId
 * order; a gap that is not filled within the timeout (a callback the server never
 * delivered) is skipped, so the stream never stalls.
 */
final class CallbackSequencer<T> {

    static final long GAP_TIMEOUT_MS = 400;

    private final ToIntFunction<T> idOf;
    private final Consumer<T> sink;
    private final ScheduledExecutorService timer;
    private final long gapTimeoutMs;
    private final TreeMap<Integer, T> waiting = new TreeMap<>();
    private int next = 1;
    private long timerToken = 0;
    private ScheduledFuture<?> gapTimer = null;

    CallbackSequencer(ToIntFunction<T> idOf, Consumer<T> sink, ScheduledExecutorService timer, long gapTimeoutMs) {
        this.idOf = idOf;
        this.sink = sink;
        this.timer = timer;
        this.gapTimeoutMs = gapTimeoutMs;
    }

    synchronized void offer(T item) {
        int id = idOf.applyAsInt(item);
        if (id <= 0 || id < next) {
            // unnumbered, or late after its gap was skipped: the outdated guard decides
            sink.accept(item);
            return;
        }
        if (id > next) {
            waiting.put(id, item);
            armGapTimer();
            return;
        }
        sink.accept(item);
        next = id + 1;
        drain();
    }

    /** New server session: its counter restarts at 1 and items of the old one are dropped. */
    synchronized void reset() {
        waiting.clear();
        next = 1;
        cancelGapTimer();
    }

    synchronized int pending() {
        return waiting.size();
    }

    private void drain() {
        while (!waiting.isEmpty() && waiting.firstKey() == next) {
            sink.accept(waiting.pollFirstEntry().getValue());
            next++;
        }
        cancelGapTimer();
        if (!waiting.isEmpty()) {
            armGapTimer();
        }
    }

    private void armGapTimer() {
        if (gapTimer != null) {
            return;
        }
        final long token = ++timerToken;
        gapTimer = timer.schedule(() -> skipGap(token), gapTimeoutMs, TimeUnit.MILLISECONDS);
    }

    private synchronized void skipGap(long token) {
        // a timer cancelled while already waiting for the lock must not skip a newer gap
        if (token != timerToken || gapTimer == null) {
            return;
        }
        gapTimer = null;
        Map.Entry<Integer, T> first = waiting.firstEntry();
        if (first == null) {
            return;
        }
        next = first.getKey();
        drain();
    }

    private void cancelGapTimer() {
        timerToken++;
        if (gapTimer != null) {
            gapTimer.cancel(false);
            gapTimer = null;
        }
    }
}
