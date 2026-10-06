package org.mage.proxy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ServerMessageMailboxTest {

    @Test
    void returnsAMessageCapturedAfterTheCommandStarted() {
        ServerMessageMailbox box = new ServerMessageMailbox();
        long start = System.currentTimeMillis();
        box.capture("Wrong password");
        assertEquals("Wrong password", box.await(start, 1000));
    }

    @Test
    void ignoresAMessageFromBeforeTheCommand() {
        ServerMessageMailbox box = new ServerMessageMailbox();
        box.capture("old", 1);
        assertNull(box.await(System.currentTimeMillis(), 50));
    }

    @Test
    void wakesUpAsSoonAsTheMessageArrives() throws Exception {
        ServerMessageMailbox box = new ServerMessageMailbox();
        long start = System.currentTimeMillis();
        Thread later = new Thread(() -> {
            try {
                Thread.sleep(100);
            } catch (InterruptedException ignored) {
            }
            box.capture("Table is full");
        });
        later.start();
        String msg = box.await(start, 5000);
        long took = System.currentTimeMillis() - start;
        later.join();
        assertEquals("Table is full", msg);
        assertTrue(took < 2000, "returned on the signal, not at the timeout (" + took + " ms)");
    }

    @Test
    void anEmptyMessageIsNotCaptured() {
        ServerMessageMailbox box = new ServerMessageMailbox();
        long start = System.currentTimeMillis();
        box.capture("");
        assertNull(box.await(start, 20));
    }
}
