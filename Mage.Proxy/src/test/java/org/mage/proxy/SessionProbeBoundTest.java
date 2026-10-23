package org.mage.proxy;

import mage.interfaces.MageServer;
import mage.remote.SessionImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/** A server that stops answering must not make the probe start a thread per check. */
class SessionProbeBoundTest {

    @Test
    void aProbeStillWaitingOnTheServerIsNotStartedAgain() throws Exception {
        CountDownLatch release = new CountDownLatch(1);
        AtomicInteger pings = new AtomicInteger();
        MageServer server = (MageServer) Proxy.newProxyInstance(MageServer.class.getClassLoader(),
                new Class<?>[]{MageServer.class}, (proxy, method, args) -> {
                    if (method.getName().equals("ping")) {
                        pings.incrementAndGet();
                        awaitIgnoringInterrupts(release);
                        return true;
                    }
                    return method.getReturnType() == boolean.class ? Boolean.FALSE : null;
                });
        SessionImpl session = new SessionImpl(null) {
            @Override
            public String getSessionId() {
                return "hung-session";
            }
        };
        Field serverField = SessionImpl.class.getDeclaredField("server");
        serverField.setAccessible(true);
        serverField.set(session, server);
        try {
            assertFalse(SessionProbe.answers(session, 1000));
            assertEquals(1, pings.get());

            assertFalse(SessionProbe.answers(session, 1000));
            assertEquals(1, pings.get(), "the probe of a session still waiting on the server is not repeated");
        } finally {
            release.countDown();
        }
    }

    /**
     * A hung remoting call sits in a socket read, which ignores the probe's cancel(true). An
     * interruptible wait would end the ping on the timeout, free the session and let the second
     * probe start another one: the race that made this test fail on CI with 2 pings.
     */
    private static void awaitIgnoringInterrupts(CountDownLatch latch) {
        boolean interrupted = false;
        while (true) {
            try {
                latch.await();
                break;
            } catch (InterruptedException ex) {
                interrupted = true;
            }
        }
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }
}
