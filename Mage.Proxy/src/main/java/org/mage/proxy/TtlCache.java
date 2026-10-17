package org.mage.proxy;

import java.util.function.LongSupplier;

/**
 * One cached value with the time it was loaded. A read reloads it only when it is older than the
 * max age; a failed reload keeps serving the last value, and only an empty cache rethrows. Loads
 * run under the cache's monitor, so concurrent readers wait for one load instead of starting many.
 */
final class TtlCache<T> {

    interface Loader<T> {
        T load() throws Exception;
    }

    static final class Stamped<T> {
        final T value;
        final long loadedAtMillis;

        Stamped(T value, long loadedAtMillis) {
            this.value = value;
            this.loadedAtMillis = loadedAtMillis;
        }
    }

    private final LongSupplier clock;
    private final long maxAgeMillis;
    private Stamped<T> current;

    TtlCache(LongSupplier clock, long maxAgeMillis) {
        this.clock = clock;
        this.maxAgeMillis = maxAgeMillis;
    }

    synchronized Stamped<T> get(Loader<T> loader) throws Exception {
        if (current != null && clock.getAsLong() - current.loadedAtMillis < maxAgeMillis) {
            return current;
        }
        try {
            return replace(loader.load());
        } catch (Exception ex) {
            if (current != null) {
                return current;
            }
            throw ex;
        }
    }

    /** Reloads unconditionally. A failure leaves the previous value in place and propagates. */
    synchronized Stamped<T> refresh(Loader<T> loader) throws Exception {
        return replace(loader.load());
    }

    synchronized Stamped<T> peek() {
        return current;
    }

    private Stamped<T> replace(T value) {
        current = new Stamped<>(value, clock.getAsLong());
        return current;
    }
}
