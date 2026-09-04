package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Valida la pre-validación de mazos contra la BD de cartas real de la release
 * (la misma lista que el servidor oficial). La BD se construye una vez en
 * Mage.Proxy/db (gitignored) y se reutiliza en arranques del proxy y tests.
 * <p>
 * Semántica del servidor oficial: resuelve por (set, número) e IGNORA el nombre
 * de la entrada => un (set, número) existente con otro nombre NO se rechaza:
 * carga otra carta (mismatch). Solo se rechaza lo que devuelve "Card not found".
 */
class DeckValidationTest {

    @BeforeAll
    static void ensureCardDatabase() {
        DeckValidation.ensureCardDatabaseAsync();
        AtomicBoolean done = new AtomicBoolean(false);
        long deadline = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(6);
        while (System.currentTimeMillis() < deadline) {
            DeckValidation.State state = DeckValidation.getState();
            if (state == DeckValidation.State.READY || state == DeckValidation.State.FAILED) {
                done.set(true);
                break;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        assumeTrue(done.get(), "card db build did not finish in time");
        assumeTrue(DeckValidation.getState() == DeckValidation.State.READY,
                "card db not available (no mage-sets on classpath?)");
    }

    private static DeckCardLists deck(DeckCardInfo... cards) {
        DeckCardLists deck = new DeckCardLists();
        deck.setName("Test deck");
        for (DeckCardInfo card : cards) {
            deck.getCards().add(card);
        }
        return deck;
    }

    private static DeckCardInfo card(String name, String set, String number, int amount) {
        return new DeckCardInfo(name, number, set, amount);
    }

    private static JsonObject firstOf(JsonArray array, String cardName) {
        for (int i = 0; i < array.size(); i++) {
            JsonObject problem = array.get(i).getAsJsonObject();
            if (cardName.equals(problem.get("cardName").getAsString())) {
                return problem;
            }
        }
        return null;
    }

    @Test
    void implementedCardPasses() {
        JsonObject report = DeckValidation.validate(deck(card("Island", "LEA", "288", 30)));
        assertTrue(report.get("ready").getAsBoolean());
        assertEquals(0, report.getAsJsonArray("missing").size());
        assertEquals(0, report.getAsJsonArray("mismatches").size());
        assertNull(report.get("fixedDeck"));
    }

    @Test
    void unknownPrintingIsRejectedWithSuggestions() {
        // Counterspell está implementado, pero no con ese set/número: el servidor
        // oficial (búsqueda estricta set+número) la rechazaría con "Card not found"
        JsonObject report = DeckValidation.validate(deck(card("Counterspell", "ZZZ", "999", 2)));

        JsonObject problem = firstOf(report.getAsJsonArray("missing"), "Counterspell");
        assertNotNull(problem);
        assertEquals("OUTDATED_PRINTING", problem.get("reason").getAsString());
        JsonArray suggestions = problem.getAsJsonArray("suggestions");
        assertTrue(suggestions.size() > 0);
        assertEquals("Counterspell", suggestions.get(0).getAsJsonObject().get("cardName").getAsString());

        // fixedDeck la elimina
        JsonObject fixed = report.getAsJsonObject("fixedDeck");
        assertNotNull(fixed);
        assertEquals(0, fixed.getAsJsonArray("cards").size());
    }

    @Test
    void unimplementedCardIsRejectedWithoutSuggestions() {
        JsonObject report = DeckValidation.validate(deck(card("No Existo Carta XYZ", "ZZZ", "1", 1)));

        JsonObject problem = firstOf(report.getAsJsonArray("missing"), "No Existo Carta XYZ");
        assertNotNull(problem);
        assertEquals("UNIMPLEMENTED", problem.get("reason").getAsString());
        assertTrue(!problem.has("suggestions") || problem.getAsJsonArray("suggestions").size() == 0);
    }

    @Test
    void wrongNameOnExistingSetNumberIsMismatchNotRejection() {
        // el servidor oficial ignora el nombre: (C20, 77) es Banisher Priest, así
        // que "Rhystic Tutor - C20 - 77" se acepta PERO carga otra carta; además
        // Rhystic Tutor sí existe en Prophecy (PRO 77) => hay sugerencias de reparación
        JsonObject report = DeckValidation.validate(deck(card("Rhystic Tutor", "C20", "77", 1)));

        assertNull(firstOf(report.getAsJsonArray("missing"), "Rhystic Tutor"));
        JsonObject mismatch = firstOf(report.getAsJsonArray("mismatches"), "Rhystic Tutor");
        assertNotNull(mismatch);
        assertEquals("Banisher Priest", mismatch.get("resolvedName").getAsString());
        JsonArray suggestions = mismatch.getAsJsonArray("suggestions");
        assertTrue(suggestions.size() > 0);
        assertEquals("Rhystic Tutor", suggestions.get(0).getAsJsonObject().get("cardName").getAsString());
        assertNull(report.get("fixedDeck"), "un mismatch no se elimina del fixedDeck");
    }

    @Test
    void duplicateProblemsAccumulateAmount() {
        DeckCardLists testDeck = deck(
                card("Counterspell", "ZZZ", "999", 2),
                card("Counterspell", "ZZZ", "999", 2));
        JsonObject report = DeckValidation.validate(testDeck);
        JsonArray missing = report.getAsJsonArray("missing");
        assertEquals(1, missing.size());
        assertEquals(4, missing.get(0).getAsJsonObject().get("amount").getAsInt());
    }

    @Test
    void sideboardProblemsAreReportedToo() {
        DeckCardLists testDeck = deck(card("Island", "LEA", "288", 20));
        testDeck.getSideboard().add(card("Counterspell", "ZZZ", "999", 1));
        JsonObject report = DeckValidation.validate(testDeck);
        assertNotNull(firstOf(report.getAsJsonArray("missing"), "Counterspell"));
    }

    @Test
    void stripMissingRemovesRejectionsKeepsMismatches() {
        DeckCardLists testDeck = deck(
                card("Island", "LEA", "288", 10),
                card("Counterspell", "ZZZ", "999", 4),
                card("Rhystic Tutor", "C20", "77", 1));
        DeckCardLists clean = DeckValidation.stripMissing(testDeck);
        assertEquals(2, clean.getCards().size(), "quita solo la rechazada");
        assertEquals("Island", clean.getCards().get(0).getCardName());
        assertEquals("Rhystic Tutor", clean.getCards().get(1).getCardName(),
                "el mismatch permanece (el servidor lo carga como otra carta)");
        assertEquals("Test deck", clean.getName());
    }
}
