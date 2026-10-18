package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TtlCacheTest {

    private long now = 1_000L;

    private TtlCache<String> cache(long maxAge) {
        return new TtlCache<>(() -> now, maxAge);
    }

    @Test
    void servesTheCachedValueWhileItIsYoungerThanTheMaxAge() throws Exception {
        TtlCache<String> cache = cache(30_000L);
        AtomicInteger loads = new AtomicInteger();

        cache.get(() -> "v" + loads.incrementAndGet());
        now += 29_999L;
        TtlCache.Stamped<String> hit = cache.get(() -> "v" + loads.incrementAndGet());

        assertEquals("v1", hit.value);
        assertEquals(1, loads.get());
    }

    @Test
    void reloadsOnDemandOnceTheValueIsAsOldAsTheMaxAge() throws Exception {
        TtlCache<String> cache = cache(30_000L);
        AtomicInteger loads = new AtomicInteger();

        cache.get(() -> "v" + loads.incrementAndGet());
        now += 30_000L;
        TtlCache.Stamped<String> reloaded = cache.get(() -> "v" + loads.incrementAndGet());

        assertEquals("v2", reloaded.value);
        assertEquals(2, loads.get());
        assertEquals(now, reloaded.loadedAtMillis);
    }

    @Test
    void refreshIgnoresAgeAndReplacesTheValue() throws Exception {
        TtlCache<String> cache = cache(30_000L);
        cache.get(() -> "old");

        TtlCache.Stamped<String> refreshed = cache.refresh(() -> "new");

        assertSame(refreshed, cache.peek());
        assertEquals("new", cache.peek().value);
    }

    @Test
    void failedReloadKeepsServingTheLastValue() throws Exception {
        TtlCache<String> cache = cache(30_000L);
        cache.get(() -> "kept");
        now += 60_000L;

        TtlCache.Stamped<String> stale = cache.get(() -> {
            throw new IllegalStateException("server gone");
        });

        assertEquals("kept", stale.value);
    }

    @Test
    void failedFirstLoadPropagatesBecauseThereIsNothingToServe() {
        TtlCache<String> cache = cache(30_000L);

        assertThrows(IllegalStateException.class, () -> cache.get(() -> {
            throw new IllegalStateException("never logged in");
        }));
        assertEquals(null, cache.peek());
    }
}
