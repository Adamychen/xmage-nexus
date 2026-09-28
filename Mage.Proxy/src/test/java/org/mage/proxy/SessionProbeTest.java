package org.mage.proxy;

import mage.remote.SessionImpl;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * The probe is the gate in front of a relink. Relinking on a false alarm kicks the healthy session
 * out, leaves one more dead session on the server and freezes the game thread, so a probe that
 * cannot ask must never be read as a dead link.
 */
class SessionProbeTest {

    /** A session the server does not know: the one answer that really means "not alive". */
    static final class UnknownSession extends SessionImpl {
        private final String id;

        UnknownSession(String sessionId) {
            super(null);
            this.id = sessionId;
        }

        @Override
        public String getSessionId() {
            return id;
        }
    }

    @Test
    void aSessionTheServerDoesNotKnowIsReportedAsNotAnswering() {
        // SessionImpl(null) has no server behind it, so the ping is a definitive "no"
        assertFalse(SessionProbe.answers(new UnknownSession(""), 2000));
    }

    @Test
    void aServerThatDoesNotAnswerInTimeIsReportedAsNotAnswering() {
        assertFalse(SessionProbe.answers(new UnknownSession("3j001-4hoy2q-mul2ujtl-1-mul2vqic-m"), 2000));
    }
}
