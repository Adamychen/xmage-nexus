package org.mage.proxy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CallbackSequencerTest {

    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private final List<Integer> delivered = new CopyOnWriteArrayList<>();

    @AfterEach
    void stop() {
        timer.shutdownNow();
    }

    private CallbackSequencer<Integer> sequencer(long gapTimeoutMs) {
        return new CallbackSequencer<>(i -> i, delivered::add, timer, gapTimeoutMs);
    }

    private void awaitDelivered(int count) throws InterruptedException {
        long deadline = System.currentTimeMillis() + 5000;
        while (delivered.size() < count && System.currentTimeMillis() < deadline) {
            Thread.sleep(5);
        }
    }

    @Test
    void inOrderCallbacksPassStraightThrough() {
        CallbackSequencer<Integer> seq = sequencer(10_000);
        for (int i = 1; i <= 5; i++) {
            seq.offer(i);
        }
        assertEquals(Arrays.asList(1, 2, 3, 4, 5), delivered);
        assertEquals(0, seq.pending());
    }

    @Test
    void reconnectRestoreIsReleasedInServerOrder() {
        // the order the proxy log showed on a reconnect: the re-asked GAME_SELECT (5)
        // overtook JOINED_TABLE (2), START_GAME (3) and GAME_INIT (4)
        CallbackSequencer<Integer> seq = sequencer(10_000);
        seq.offer(1);
        seq.offer(5);
        seq.offer(6);
        assertEquals(Arrays.asList(1), delivered);
        seq.offer(2);
        seq.offer(3);
        seq.offer(4);
        assertEquals(Arrays.asList(1, 2, 3, 4, 5, 6), delivered);
        assertEquals(0, seq.pending());
    }

    @Test
    void aGapThatIsNeverFilledIsSkippedAfterTheTimeout() throws Exception {
        CallbackSequencer<Integer> seq = sequencer(50);
        seq.offer(1);
        seq.offer(3);
        seq.offer(4);
        assertEquals(Arrays.asList(1), delivered);
        awaitDelivered(3);
        assertEquals(Arrays.asList(1, 3, 4), delivered);
        seq.offer(5);
        assertEquals(Arrays.asList(1, 3, 4, 5), delivered);
    }

    @Test
    void aLateCallbackAfterItsGapWasSkippedIsStillDelivered() throws Exception {
        CallbackSequencer<Integer> seq = sequencer(50);
        seq.offer(2);
        awaitDelivered(1);
        seq.offer(1);
        assertEquals(Arrays.asList(2, 1), delivered);
    }

    @Test
    void unnumberedCallbacksAreNeverHeld() {
        CallbackSequencer<Integer> seq = sequencer(10_000);
        seq.offer(3);
        seq.offer(0);
        assertEquals(Arrays.asList(0), delivered);
    }

    @Test
    void resetDropsTheOldSessionAndRestartsAtOne() throws Exception {
        CallbackSequencer<Integer> seq = sequencer(50);
        seq.offer(1);
        seq.offer(2);
        seq.offer(900);
        seq.reset();
        assertEquals(0, seq.pending());
        seq.offer(1);
        seq.offer(2);
        Thread.sleep(150);
        assertEquals(Arrays.asList(1, 2, 1, 2), delivered);
    }

    @Test
    void aSecondGapGetsItsOwnFullTimeout() throws Exception {
        CallbackSequencer<Integer> seq = sequencer(300);
        seq.offer(1);
        seq.offer(3);
        Thread.sleep(200);
        seq.offer(2);
        seq.offer(5);
        assertEquals(Arrays.asList(1, 2, 3), delivered);
        Thread.sleep(150);
        assertEquals(Arrays.asList(1, 2, 3), delivered, "the new gap must not inherit the old timer");
        awaitDelivered(4);
        assertTrue(delivered.contains(5));
    }
}
