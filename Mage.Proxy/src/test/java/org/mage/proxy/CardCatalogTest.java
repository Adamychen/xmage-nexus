package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** Consultas de impresiones contra la BD de cartas real de la release (misma que el servidor). */
class CardCatalogTest {

    @BeforeAll
    static void ensureCardDatabase() {
        DeckValidation.ensureCardDatabaseAsync();
        long deadline = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(6);
        while (System.currentTimeMillis() < deadline) {
            DeckValidation.State state = DeckValidation.getState();
            if (state == DeckValidation.State.READY || state == DeckValidation.State.FAILED) {
                break;
            }
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        assumeTrue(DeckValidation.getState() == DeckValidation.State.READY,
                "card db not available (no mage-sets on classpath?)");
    }

    private static JsonObject result(JsonObject report, String name) {
        JsonArray results = report.getAsJsonArray("results");
        for (int i = 0; i < results.size(); i++) {
            JsonObject r = results.get(i).getAsJsonObject();
            if (name.equals(r.get("name").getAsString())) return r;
        }
        return null;
    }

    @Test
    void resolveDefaultMatchesXMageImporterChoice() {
        JsonObject report = CardCatalog.resolvePrintings(Collections.singletonList("Lightning Bolt"), "default", null);
        assertTrue(report.get("ready").getAsBoolean());
        JsonObject bolt = result(report, "Lightning Bolt");
        assertNotNull(bolt);
        assertTrue(bolt.get("found").getAsBoolean());
        CardInfo expected = CardRepository.instance.findPreferredCoreExpansionCard("Lightning Bolt");
        assertEquals(expected.getSetCode(), bolt.get("setCode").getAsString());
        assertEquals(expected.getCardNumber(), bolt.get("cardNumber").getAsString());
    }

    @Test
    void resolveBySetPrefersThatSetAndOldestPicksAnEarlyPrinting() {
        JsonObject bySet = CardCatalog.resolvePrintings(Collections.singletonList("Lightning Bolt"), "set", "LEA");
        assertEquals("LEA", result(bySet, "Lightning Bolt").get("setCode").getAsString());

        JsonObject oldest = CardCatalog.resolvePrintings(Collections.singletonList("Lightning Bolt"), "oldest", null);
        assertEquals("LEA", result(oldest, "Lightning Bolt").get("setCode").getAsString());
    }

    @Test
    void unknownCardIsNotFound() {
        JsonObject report = CardCatalog.resolvePrintings(Collections.singletonList("Not A Real Card Name"), "default", null);
        assertFalse(result(report, "Not A Real Card Name").get("found").getAsBoolean());
        JsonObject printings = CardCatalog.cardPrintings(Collections.singletonList("Not A Real Card Name"), 1);
        assertEquals(0, result(printings, "Not A Real Card Name").getAsJsonArray("printings").size());
    }

    @Test
    void printingsListAndLimit() {
        JsonObject all = CardCatalog.cardPrintings(Arrays.asList("Lightning Bolt", "Lightning Bolt"), 0);
        assertEquals(1, all.getAsJsonArray("results").size(), "names are deduplicated");
        JsonArray boltPrintings = result(all, "Lightning Bolt").getAsJsonArray("printings");
        assertTrue(boltPrintings.size() > 1);

        JsonObject one = CardCatalog.cardPrintings(Collections.singletonList("Lightning Bolt"), 1);
        assertEquals(1, result(one, "Lightning Bolt").getAsJsonArray("printings").size());
    }

    @Test
    void splitAndDoubleFacedNamesResolve() {
        JsonObject report = CardCatalog.cardPrintings(Arrays.asList(
                "Fire // Ice", "Delver of Secrets // Insectile Aberration"), 1);
        assertEquals(1, result(report, "Fire // Ice").getAsJsonArray("printings").size());
        assertEquals(1, result(report, "Delver of Secrets // Insectile Aberration").getAsJsonArray("printings").size());
    }

    @Test
    void deckEntryWithoutPrintingGetsTheImporterPrintingAtTheEdge() {
        JsonObject json = JsonParser.parseString("{\"name\":\"D\",\"cards\":["
                + "{\"cardName\":\"Sol Ring\",\"setCode\":\"\",\"cardNumber\":\"\",\"amount\":1},"
                + "{\"cardName\":\"Lightning Bolt\",\"setCode\":\"LEA\",\"cardNumber\":\"161\",\"amount\":4}],"
                + "\"sideboard\":[]}").getAsJsonObject();
        DeckCardLists deck = DeckJson.parse(json);
        DeckCardInfo solRing = deck.getCards().get(0);
        CardInfo expected = CardRepository.instance.findPreferredCoreExpansionCard("Sol Ring");
        assertEquals(expected.getSetCode(), solRing.getSetCode());
        assertEquals(expected.getCardNumber(), solRing.getCardNumber());
        assertEquals("LEA", deck.getCards().get(1).getSetCode());

        // la validación ya no lo marca como "Card not found": el servidor recibirá esa impresión
        JsonObject report = DeckValidation.validate(deck, DeckJson.sourcePrintings(json));
        assertEquals(0, report.getAsJsonArray("missing").size());

        // y el cliente puede volver a su entrada sin impresión
        Map<String, Set<List<String>>> sources = DeckJson.sourcePrintings(json);
        Set<List<String>> raw = sources.get("Sol Ring|" + expected.getSetCode() + "|" + expected.getCardNumber());
        assertNotNull(raw);
        assertTrue(raw.contains(Arrays.asList("", "")));
    }
}
