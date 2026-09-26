package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class OutboundLogTest {

    private final AtomicLong now = new AtomicLong(1_000_000);

    private static JsonObject parse(String json) {
        return JsonParser.parseString(json).getAsJsonObject();
    }

    private static String frame(String name) {
        return "{\"type\":\"event\",\"method\":\"" + name + "\"}";
    }

    @Test
    void numbersEveryFrameInOrder() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        String a = log.append(frame("A"), null, true);
        String b = log.append(frame("B"), null, true);
        assertEquals(1, parse(a).get("seq").getAsLong());
        assertEquals(2, parse(b).get("seq").getAsLong());
        assertEquals("A", parse(a).get("method").getAsString());
        assertEquals(2, log.lastSeq());
    }

    @Test
    void injectsSeqIntoAnEmptyObject() {
        assertEquals("{\"seq\":7}", OutboundLog.withSeq("{}", 7));
    }

    @Test
    void resumesWithTheFramesAfterTheLastOneSeen() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        log.append(frame("A"), null, true);
        log.append(frame("B"), null, true);
        log.append(frame("C"), null, false);
        List<String> missed = log.since(1);
        assertNotNull(missed);
        assertEquals(2, missed.size());
        assertEquals("B", parse(missed.get(0)).get("method").getAsString());
        assertEquals("C", parse(missed.get(1)).get("method").getAsString());
        assertEquals(0, log.since(3).size());
    }

    @Test
    void refusesASeqFromTheFuture() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        log.append(frame("A"), null, true);
        assertNull(log.since(5));
    }

    @Test
    void aNewerStateReplacesTheOlderOneOfTheSameGame() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        log.append(frame("UPDATE1"), "state:g", true);
        log.append(frame("PROMPT"), null, true);
        log.append(frame("UPDATE2"), "state:g", true);
        List<String> missed = log.since(0);
        assertNotNull(missed, "superseded frames never make the stream unresumable");
        assertEquals(2, missed.size());
        assertEquals("PROMPT", parse(missed.get(0)).get("method").getAsString());
        assertEquals("UPDATE2", parse(missed.get(1)).get("method").getAsString());
        assertEquals(2, log.size());
    }

    @Test
    void evictionBySizeMakesOlderSeqsUnresumable() {
        OutboundLog log = new OutboundLog(now::get, 3, 1_000_000);
        for (int i = 0; i < 5; i++) {
            log.append(frame("F" + i), null, false);
        }
        assertEquals(3, log.size());
        assertNull(log.since(0), "frames 1 and 2 were evicted");
        assertNull(log.since(1));
        List<String> missed = log.since(2);
        assertNotNull(missed);
        assertEquals(3, missed.size());
    }

    @Test
    void deliveredFramesExpireButUndeliveredOnesAreKept() {
        OutboundLog log = new OutboundLog(now::get, 100, 1_000_000);
        log.append(frame("OLD"), null, true);
        now.addAndGet(OutboundLog.DELIVERED_RETENTION_MS + 1);
        log.append(frame("NOCLIENT"), null, false);
        assertEquals(1, log.size());
        assertNull(log.since(0));
        assertEquals(1, log.since(1).size());
        now.addAndGet(OutboundLog.DELIVERED_RETENTION_MS * 10);
        log.append(frame("LATER"), null, false);
        assertEquals(2, log.since(1).size(), "frames nobody received are kept until a client returns");
    }

    @Test
    void sizeLimitCountsCharacters() {
        OutboundLog log = new OutboundLog(now::get, 100, 200);
        String big = "{\"type\":\"event\",\"pad\":\"" + new String(new char[120]).replace('\0', 'x') + "\"}";
        log.append(big, null, false);
        log.append(big, null, false);
        assertEquals(1, log.size());
        assertNull(log.since(0));
        assertNotNull(log.since(1));
    }
}
