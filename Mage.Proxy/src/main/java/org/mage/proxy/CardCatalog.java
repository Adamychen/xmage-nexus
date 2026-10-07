package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Consultas a la BD de cartas de la MISMA release que el servidor objetivo, con
 * las mismas funciones que usa XMage, para que el cliente no tenga que adivinar
 * con Scryfall qué existe en el servidor:
 * <ul>
 * <li>{@link #resolvePrintings}: la impresión que eligen los importadores de
 *     XMage para un nombre ({@code findPreferredCoreExpansionCard}, la más
 *     antigua no promo o la de un set concreto).</li>
 * <li>{@link #cardPrintings}: las impresiones implementadas de una carta (lista
 *     vacía = no implementada en esta release).</li>
 * </ul>
 * Advisory: con la BD aún sin construir responde {@code ready:false} y el
 * cliente sigue con su camino sin proxy.
 */
public final class CardCatalog {

    private static final Logger logger = Logger.getLogger(CardCatalog.class.getName());
    /** Tope por petición: una página de búsqueda o un mazo de 250 cartas distintas caben de sobra. */
    static final int MAX_NAMES = 500;

    private CardCatalog() {
    }

    static boolean isReady() {
        return DeckValidation.getState() == DeckValidation.State.READY;
    }

    /**
     * Impresión que elige XMage para una entrada sin impresión (mismo criterio
     * que sus importadores de texto). Null si la BD no está lista o la carta
     * no existe en esta release.
     */
    static String[] preferredPrinting(String cardName) {
        if (cardName == null || cardName.trim().isEmpty() || !isReady()) {
            return null;
        }
        CardInfo info = resolve(cardName.trim(), "default", null);
        return info == null ? null : new String[]{info.getSetCode(), info.getCardNumber()};
    }

    private static CardInfo resolve(String name, String strategy, String setCode) {
        try {
            switch (strategy) {
                case "oldest":
                    return CardRepository.instance.findOldestNonPromoVersionCard(name);
                case "set":
                    if (setCode != null && !setCode.trim().isEmpty()) {
                        return CardRepository.instance.findCardWithPreferredSetAndNumber(name, setCode.trim(), null);
                    }
                    return CardRepository.instance.findPreferredCoreExpansionCard(name);
                default:
                    return CardRepository.instance.findPreferredCoreExpansionCard(name);
            }
        } catch (Throwable ex) {
            // OldestNonPromoComparator asume que todo set existe: ante cualquier
            // fallo del repositorio se cae a la elección por defecto
            logger.log(Level.FINE, "resolve " + strategy + " failed for " + name + ": " + ex.getMessage());
            try {
                return CardRepository.instance.findPreferredCoreExpansionCard(name);
            } catch (Throwable ignored) {
                return null;
            }
        }
    }

    /**
     * <pre>
     * { ready: true,
     *   results: [ {name, found: true, cardName, setCode, cardNumber}
     *            | {name, found: false} ] }
     * </pre>
     * {@code strategy}: "default" (la del importador de XMage), "oldest" o
     * "set" (con {@code setCode}; si no existe en ese set, la de por defecto).
     */
    public static JsonObject resolvePrintings(List<String> names, String strategy, String setCode) {
        JsonObject out = new JsonObject();
        JsonArray results = new JsonArray();
        boolean ready = isReady();
        out.addProperty("ready", ready);
        out.add("results", results);
        if (!ready || names == null) {
            return out;
        }
        String mode = strategy == null ? "default" : strategy;
        for (String name : distinct(names)) {
            JsonObject r = new JsonObject();
            r.addProperty("name", name);
            CardInfo info = resolve(name, mode, setCode);
            r.addProperty("found", info != null);
            if (info != null) {
                r.addProperty("cardName", info.getName());
                r.addProperty("setCode", info.getSetCode());
                r.addProperty("cardNumber", info.getCardNumber());
            }
            results.add(r);
        }
        return out;
    }

    /**
     * <pre>
     * { ready: true,
     *   results: [ {name, printings: [{setCode, cardNumber}, ...]} ] }
     * </pre>
     * {@code limit} > 0 corta las impresiones por carta (para saber solo si
     * está implementada basta con 1).
     */
    public static JsonObject cardPrintings(List<String> names, int limit) {
        JsonObject out = new JsonObject();
        JsonArray results = new JsonArray();
        boolean ready = isReady();
        out.addProperty("ready", ready);
        out.add("results", results);
        if (!ready || names == null) {
            return out;
        }
        for (String name : distinct(names)) {
            JsonObject r = new JsonObject();
            r.addProperty("name", name);
            JsonArray printings = new JsonArray();
            Set<String> seen = new LinkedHashSet<>();
            try {
                List<CardInfo> found = CardRepository.instance.findCards(name, Math.max(0, limit));
                for (CardInfo ci : found) {
                    if (!seen.add(ci.getSetCode() + "|" + ci.getCardNumber())) {
                        continue;
                    }
                    JsonObject p = new JsonObject();
                    p.addProperty("setCode", ci.getSetCode());
                    p.addProperty("cardNumber", ci.getCardNumber());
                    printings.add(p);
                }
            } catch (Throwable ex) {
                logger.log(Level.WARNING, "cardPrintings failed for " + name + ": " + ex.getMessage());
            }
            r.add("printings", printings);
            results.add(r);
        }
        return out;
    }

    private static Set<String> distinct(List<String> names) {
        Set<String> out = new LinkedHashSet<>();
        for (String n : names) {
            if (n == null) continue;
            String t = n.trim();
            if (t.isEmpty()) continue;
            out.add(t);
            if (out.size() >= MAX_NAMES) break;
        }
        return out;
    }
}
