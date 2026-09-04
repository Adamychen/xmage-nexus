package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;

import java.util.ArrayList;
import java.util.List;

/**
 * Parses a deck from the web client JSON format into the XMage DeckCardLists:
 * <pre>
 * {"name":"My Deck","cards":[{"cardName":"Grizzly Bears","setCode":"M21","cardNumber":"178","amount":4}],
 *  "sideboard":[{"cardName":"...","setCode":"...","cardNumber":"...","amount":1}]}
 * </pre>
 */
public final class DeckJson {

    private DeckJson() {
    }

    public static DeckCardLists parse(JsonObject deckJson) {
        DeckCardLists deck = new DeckCardLists();
        if (deckJson == null) {
            return deck;
        }
        deck.setName(deckJson.has("name") ? deckJson.get("name").getAsString() : "");
        deck.setAuthor(deckJson.has("author") ? deckJson.get("author").getAsString() : "");
        deck.setCards(parseCards(deckJson.getAsJsonArray("cards")));
        deck.setSideboard(parseCards(deckJson.getAsJsonArray("sideboard")));
        return deck;
    }

    private static List<DeckCardInfo> parseCards(JsonArray array) {
        List<DeckCardInfo> result = new ArrayList<>();
        if (array == null) {
            return result;
        }
        for (JsonElement element : array) {
            JsonObject card = element.getAsJsonObject();
            String cardName = card.has("cardName") ? card.get("cardName").getAsString() : "";
            String setCode = card.has("setCode") ? card.get("setCode").getAsString() : "";
            String cardNumber = card.has("cardNumber") ? card.get("cardNumber").getAsString() : "";
            int amount = card.has("amount") ? card.get("amount").getAsInt() : 1;
            if (!cardName.isEmpty()) {
                String normSet = setCode.trim();
                String normNum = cardNumber.trim();
                if (normSet.equalsIgnoreCase("PLST") && normNum.contains("-")) {
                    String[] parts = normNum.split("-");
                    String num = parts[parts.length - 1].trim();
                    String origSet = parts[0].trim();
                    if (!origSet.isEmpty() && !num.isEmpty()) {
                        normSet = origSet;
                        normNum = num.replaceAll("(?i)[p★]$", "");
                        if (normNum.isEmpty()) normNum = num;
                    }
                } else if (normNum.contains("-") && normNum.matches("(?i)^[A-Z0-9]+-\\d+[a-z★*+]*$")) {
                    String[] parts = normNum.split("-");
                    String num = parts[parts.length - 1].trim();
                    if (!num.isEmpty()) normNum = num.replaceAll("(?i)[p★]$", "");
                } else {
                    String stripped = normNum.replaceAll("(?i)[p★]$", "");
                    if (!stripped.equals(normNum) && stripped.matches(".*\\d.*")) normNum = stripped;
                }
                if (normSet.length() >= 3 && normSet.charAt(0) == 'P' && !normSet.equalsIgnoreCase("PLST")) {
                    String base = normSet.substring(1);
                    if (base.matches("(?i)^[A-Z0-9]{2,4}$")) {
                        try {
                            if (mage.cards.Sets.findSet(base) != null) normSet = base;
                            else if (mage.cards.repository.CardRepository.instance.findCard(cardName, true) != null) {
                                // fallback via name exists, prefer stripped promo base
                                normSet = base;
                            }
                        } catch (Exception ignored) {
                            normSet = base;
                        }
                    }
                }
                result.add(new DeckCardInfo(cardName, normNum, normSet, amount));
            }
        }
        return result;
    }
}
