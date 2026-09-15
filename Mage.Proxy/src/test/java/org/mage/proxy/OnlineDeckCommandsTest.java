package org.mage.proxy;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class OnlineDeckCommandsTest {

    @Test
    void moxfieldUrlResolvesToDeckIdApiUrl() {
        String url = OnlineDeckCommands.resolveApiUrl("moxfield", "https://moxfield.com/decks/nX0-VuJKOEuFVfDDLnKrTA");
        assertEquals("https://api.moxfield.com/v2/decks/all/nX0-VuJKOEuFVfDDLnKrTA", url);
    }

    @Test
    void moxfieldBareIdIsAccepted() {
        String url = OnlineDeckCommands.resolveApiUrl("moxfield", "nX0-VuJKOEuFVfDDLnKrTA");
        assertEquals("https://api.moxfield.com/v2/decks/all/nX0-VuJKOEuFVfDDLnKrTA", url);
    }

    @Test
    void archidektUrlResolvesToNumericDeckIdApiUrl() {
        String url = OnlineDeckCommands.resolveApiUrl("archidekt", "https://archidekt.com/decks/123456/some-deck-name");
        assertEquals("https://archidekt.com/api/decks/123456/small/", url);
    }

    @Test
    void unknownSourceResolvesToNull() {
        assertNull(OnlineDeckCommands.resolveApiUrl("mtggoldfish", "https://mtggoldfish.com/deck/123"));
    }

    @Test
    void blankIdResolvesToNull() {
        assertNull(OnlineDeckCommands.resolveApiUrl("moxfield", ""));
        assertNull(OnlineDeckCommands.resolveApiUrl("moxfield", null));
    }

    @Test
    void extractIdFallsBackToTrimmedInputWhenPatternDoesNotMatch() {
        assertEquals("abc123", OnlineDeckCommands.extractId("moxfield", "  abc123  "));
    }

    @Test
    void moxfieldFullUrlDoesNotCaptureTheHttpsPrefix() {
        // Regresión: una alternativa "^" de ancho variable en el patron
        // "secuestra" el prefijo "https" de la URL completa antes de llegar
        // al marcador real "moxfield.com/decks/".
        assertEquals("nX0-VuJKOEuFVfDDLnKrTA", OnlineDeckCommands.extractId("moxfield", "https://moxfield.com/decks/nX0-VuJKOEuFVfDDLnKrTA"));
    }
}
