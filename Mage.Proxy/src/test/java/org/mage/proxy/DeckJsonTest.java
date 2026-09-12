package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeckJsonTest {

    private static JsonObject card(String name, String set, String num, int amount) {
        JsonObject card = new JsonObject();
        card.addProperty("cardName", name);
        card.addProperty("setCode", set);
        card.addProperty("cardNumber", num);
        card.addProperty("amount", amount);
        return card;
    }

    private static JsonArray array(JsonObject... cards) {
        JsonArray arr = new JsonArray();
        for (JsonObject card : cards) {
            arr.add(card);
        }
        return arr;
    }

    @Test
    void movesDesignatedCommandersFromMainToSideboard() {
        JsonObject json = new JsonObject();
        json.addProperty("name", "Partner deck");
        json.add("cards", array(
                card("Sidar Kondo of Jamuraa", "PC2", "1", 1),
                card("Tana, the Bloodsower", "C16", "56", 1),
                card("Forest", "LEA", "294", 98)));
        json.add("sideboard", new JsonArray());
        json.add("commanders", array(
                card("Sidar Kondo of Jamuraa", "PC2", "1", 1),
                card("Tana, the Bloodsower", "C16", "56", 1)));

        DeckCardLists deck = DeckJson.parse(json);

        assertEquals(1, deck.getCards().size());
        assertEquals("Forest", deck.getCards().get(0).getCardName());
        assertEquals(2, deck.getSideboard().size());
        assertEquals("Sidar Kondo of Jamuraa", deck.getSideboard().get(0).getCardName());
        assertEquals("Tana, the Bloodsower", deck.getSideboard().get(1).getCardName());
    }

    @Test
    void decrementsDuplicatedCommanderWithoutRemovingTheEntry() {
        JsonObject json = new JsonObject();
        json.add("cards", array(card("Relentless Rats", "M10", "1", 3)));
        json.add("sideboard", new JsonArray());
        json.add("commanders", array(card("Relentless Rats", "M10", "1", 1)));

        DeckCardLists deck = DeckJson.parse(json);

        assertEquals(1, deck.getCards().size());
        assertEquals(2, deck.getCards().get(0).getAmount());
        assertEquals(1, deck.getSideboard().size());
    }

    @Test
    void keepsTheDeckUntouchedWithoutCommanders() {
        JsonObject json = new JsonObject();
        json.add("cards", array(card("Lightning Bolt", "M10", "146", 4)));
        json.add("sideboard", array(card("Red Elemental Blast", "4ED", "218", 2)));

        DeckCardLists deck = DeckJson.parse(json);

        assertEquals(1, deck.getCards().size());
        assertEquals(4, deck.getCards().get(0).getAmount());
        assertEquals(1, deck.getSideboard().size());
        assertTrue(deck.getSideboard().stream().noneMatch(c -> c.getCardName().contains("Sidar")));
    }
}
