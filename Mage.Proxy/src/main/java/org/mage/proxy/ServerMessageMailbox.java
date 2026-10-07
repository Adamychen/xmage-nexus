package org.mage.proxy;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.ReentrantLock;

/**
 * The last user-facing message the server sent this session ({@code SHOW_USERMESSAGE},
 * {@code showMessage}, {@code showError}): a rejected command only says "failed", and the real
 * reason arrives on its own a little later through the callback channel.
 *
 * <p>Guarded by a leaf lock that is never held across a call out, so the waiting command thread
 * and the callback thread that captures the message cannot deadlock against anything else.
 */
final class ServerMessageMailbox {

    private final ReentrantLock lock = new ReentrantLock();
    private final Condition signal = lock.newCondition();
    private volatile String message = null;
    private volatile long at = 0;

    void capture(String message) {
        capture(message, System.currentTimeMillis());
    }

    /** {@code at} is explicit for tests that pre-seed a message that never goes stale. */
    void capture(String message, long at) {
        if (message == null || message.isEmpty()) {
            return;
        }
        lock.lock();
        try {
            this.message = message;
            this.at = at;
            signal.signalAll();
        } finally {
            lock.unlock();
        }
    }

    /**
     * Waits for the server's {@code SHOW_USERMESSAGE} detail that follows a rejected command.
     *
     * <p>This runs on {@code commandExecutor}, the session's only server-facing thread, so it used
     * to be a {@code Thread.sleep(60)} poll loop: one failed action held the whole command queue for
     * up to 4.5 s (1.6 s for a game action, 0.9 s when covering an error), and a burst of rejected
     * actions serialised into tens of seconds of dead queue. A leaf lock plus a condition turns that
     * into a real wait that also returns the moment the message is captured.
     */
    String await(long sinceMillis, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        lock.lock();
        try {
            while (true) {
                String msg = message;
                if (msg != null && at >= sinceMillis) {
                    return msg;
                }
                long remaining = deadline - System.currentTimeMillis();
                if (remaining <= 0) {
                    break;
                }
                try {
                    signal.await(remaining, TimeUnit.MILLISECONDS);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        } finally {
            lock.unlock();
        }
        String msg = message;
        long capturedAt = at;
        if (msg != null && capturedAt >= sinceMillis && System.currentTimeMillis() - capturedAt < 4000) {
            return msg;
        }
        return null;
    }
}
