package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Parses a deck from the web client JSON format into the XMage DeckCardLists:
 * <pre>
 * {"name":"My Deck","cards":[{"cardName":"Grizzly Bears","setCode":"M21","cardNumber":"178","amount":4}],
 *  "sideboard":[{"cardName":"...","setCode":"...","cardNumber":"...","amount":1}],
 *  "commanders":[{"cardName":"...","setCode":"...","cardNumber":"...","amount":1}]}
 * </pre>
 * Los comandantes designados (1-2, parejas legales tipo Partner/Trasfondo) se
 * mueven del main al sideboard: es donde XMage los espera
 * (GameCommanderImpl/AbstractCommander). Sin este campo el proxy mantiene su
 * heurística de primera carta legal en normalizeForXMage.
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
        List<DeckCardInfo> commanders = parseCards(deckJson.getAsJsonArray("commanders"));
        if (!commanders.isEmpty()) {
            deck.getSideboard().clear();
        }
        for (DeckCardInfo commander : commanders) {
            removeOne(deck.getCards(), commander);
            deck.getSideboard().add(new DeckCardInfo(
                    commander.getCardName(), commander.getCardNumber(), commander.getSetCode(), 1));
        }
        return deck;
    }

    private static void removeOne(List<DeckCardInfo> cards, DeckCardInfo target) {
        for (int i = 0; i < cards.size(); i++) {
            DeckCardInfo c = cards.get(i);
            if (!sameCard(c, target)) {
                continue;
            }
            if (c.getAmount() > 1) {
                cards.set(i, new DeckCardInfo(c.getCardName(), c.getCardNumber(), c.getSetCode(), c.getAmount() - 1));
            } else {
                cards.remove(i);
            }
            return;
        }
    }

    private static boolean sameCard(DeckCardInfo a, DeckCardInfo b) {
        String an = a.getCardName() == null ? "" : a.getCardName();
        String bn = b.getCardName() == null ? "" : b.getCardName();
        String as = a.getSetCode() == null ? "" : a.getSetCode();
        String bs = b.getSetCode() == null ? "" : b.getSetCode();
        String ac = a.getCardNumber() == null ? "" : a.getCardNumber();
        String bc = b.getCardNumber() == null ? "" : b.getCardNumber();
        return an.equalsIgnoreCase(bn) && as.equalsIgnoreCase(bs) && ac.equalsIgnoreCase(bc);
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
                String[] printing = resolvePrinting(cardName, setCode, cardNumber);
                result.add(new DeckCardInfo(cardName, printing[1], printing[0], amount));
            }
        }
        return result;
    }

    /**
     * The printing actually sent to the server: {@link #normalizePrinting} and,
     * for an entry with no printing at all (plain-text lists: "4 Lightning Bolt"),
     * the one XMage's own importers pick by name
     * ({@link CardCatalog#preferredPrinting}). The target server resolves strictly
     * by (set, number), so a blank printing would be "Card not found" at join.
     * Left blank while the card DB is not ready (validation then reports it).
     */
    static String[] resolvePrinting(String cardName, String setCode, String cardNumber) {
        String[] printing = normalizePrinting(setCode, cardNumber);
        if (printing[0].isEmpty() && printing[1].isEmpty()) {
            String[] byName = CardCatalog.preferredPrinting(cardName);
            if (byName != null) {
                return byName;
            }
        }
        return printing;
    }

    /** Normalizes a client printing the way it is sent to the server: {set, number}. */
    static String[] normalizePrinting(String setCode, String cardNumber) {
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
                    // Solo tratarlo como promo si el ORIGINAL no es un set real
                    // y el base sí. Nunca decidir por la existencia de la carta
                    // por nombre: eso mutila sets reales con P (PCY, PRO, PC2...)
                    // y rompe la validación en bucle (PCY -> CY -> PCY -> ...).
                    if (mage.cards.Sets.findSet(normSet) == null
                            && mage.cards.Sets.findSet(base) != null) {
                        normSet = base;
                    }
                } catch (Exception ignored) {
                    // no tocar el set ante errores del índice
                }
            }
        }
        return new String[]{normSet, normNum};
    }

    /**
     * Raw printings the client sent that normalization rewrote, keyed by the
     * normalized entry key (name|set|number) that validation reports. Lets the
     * client find its own entry (e.g. PWOE #242s is validated as WOE #242s).
     */
    public static Map<String, Set<List<String>>> sourcePrintings(JsonObject deckJson) {
        Map<String, Set<List<String>>> out = new HashMap<>();
        if (deckJson == null) {
            return out;
        }
        for (String field : new String[]{"cards", "sideboard", "commanders"}) {
            if (!deckJson.has(field) || !deckJson.get(field).isJsonArray()) {
                continue;
            }
            for (JsonElement element : deckJson.getAsJsonArray(field)) {
                if (!element.isJsonObject()) {
                    continue;
                }
                JsonObject card = element.getAsJsonObject();
                String cardName = card.has("cardName") ? card.get("cardName").getAsString() : "";
                String setCode = card.has("setCode") ? card.get("setCode").getAsString() : "";
                String cardNumber = card.has("cardNumber") ? card.get("cardNumber").getAsString() : "";
                if (cardName.isEmpty()) {
                    continue;
                }
                String[] printing = resolvePrinting(cardName, setCode, cardNumber);
                if (printing[0].equals(setCode) && printing[1].equals(cardNumber)) {
                    continue;
                }
                out.computeIfAbsent(cardName + "|" + printing[0] + "|" + printing[1], k -> new LinkedHashSet<>())
                        .add(Arrays.asList(setCode, cardNumber));
            }
        }
        return out;
    }
}
