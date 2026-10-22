package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** A frame nobody had yet must not keep the delivered frames behind it past their retention. */
class OutboundLogRetentionTest {

    private final AtomicLong now = new AtomicLong(1_000_000);

    @Test
    void anUndeliveredHeadDoesNotPinDeliveredFramesBehindIt() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        log.append("{\"type\":\"event\",\"method\":\"UNDELIVERED\"}", null, false);
        log.append("{\"type\":\"event\",\"method\":\"DELIVERED\"}", null, true);
        now.addAndGet(OutboundLog.DELIVERED_RETENTION_MS + 1000);
        log.append("{\"type\":\"event\",\"method\":\"NEW\"}", null, true);

        assertEquals(2, log.size(), "the delivered frame past its retention is gone, the undelivered one is kept");
    }
}
