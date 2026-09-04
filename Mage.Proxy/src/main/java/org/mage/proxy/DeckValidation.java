package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardInfo;
import mage.cards.decks.DeckCardLists;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.cards.repository.CardScanner;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Pre-validación de mazos contra la base de datos de cartas de la MISMA release
 * de XMage que corre el servidor objetivo. Replica exactamente la semántica del
 * servidor oficial (Deck.load upstream): búsqueda estricta por (setCode, cardNumber)
 * + instanciación de la clase; el nombre de la entrada NO participa en la
 * resolución. No usa ningún código propio del fork, solo APIs upstream públicas
 * (CardRepository, CardScanner).
 * <p>
 * Detecta dos problemas distintos:
 * <ul>
 * <li><b>missing</b>: el servidor rechaza la carta ("Card not found" al unirse) —
 *     set/número desconocidos (el nombre existe en otra impresión => OUTDATED_PRINTING
 *     con sugerencias) o carta sin implementar en ninguna impresión (UNIMPLEMENTED).</li>
 * <li><b>mismatches</b>: el servidor la acepta pero resuelve a OTRA carta (el
 *     nombre no coincide con la de ese set/número — p.ej. "Rhystic Tutor - C20 - 77"
 *     carga en realidad Banisher Priest). El jugador cree jugar una carta y juega otra.</li>
 * </ul>
 * <p>
 * La BD se construye de forma perezosa en segundo plano (CardScanner.scan) la
 * primera vez que arranca el proxy y se re-construye sola si cambia el build del
 * fork (nueva release => lista de cartas nueva). Si la BD no está lista, la
 * validación se degrada con gracia: responde ready=false y el flujo de juego
 * continúa como siempre (la validación es advisory, nunca bloqueante).
 */
public final class DeckValidation {

    public enum State { NOT_STARTED, BUILDING, READY, FAILED }

    private static final Logger logger = Logger.getLogger(DeckValidation.class.getName());
    private static final AtomicReference<State> STATE = new AtomicReference<>(State.NOT_STARTED);
    private static final int MAX_SUGGESTIONS = 8;

    private DeckValidation() {
    }

    public static State getState() {
        return STATE.get();
    }

    /** Arranca (una vez) la construcción perezosa de la BD de cartas en segundo plano. */
    public static void ensureCardDatabaseAsync() {
        if (!STATE.compareAndSet(State.NOT_STARTED, State.BUILDING)) {
            return;
        }
        Thread t = new Thread(() -> {
            long start = System.currentTimeMillis();
            try {
                // no-op si la BD ya está construida y al día; re-escanea si el build cambió
                CardScanner.scan();
                boolean ready = isDatabasePopulated();
                STATE.set(ready ? State.READY : State.FAILED);
                logger.info("card db " + (ready ? "READY" : "EMPTY (no card classes on classpath?)")
                        + " in " + (System.currentTimeMillis() - start) + "ms");
            } catch (Throwable ex) {
                logger.log(Level.SEVERE, "card db build failed", ex);
                STATE.set(State.FAILED);
            }
        }, "proxy-card-db");
        t.setDaemon(true);
        t.start();
    }

    private static boolean isDatabasePopulated() {
        try {
            // mismas sondas que usa checkDatabaseHealthAndFix / el arranque del servidor
            return CardRepository.instance.findCard("Island", "LEA") != null
                    || CardRepository.instance.findCard("Silvercoat Lion", true) != null;
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "card db probe failed: " + ex.getMessage());
            return false;
        }
    }

    private static final class CardStatus {
        final boolean rejected;      // el servidor lanzará "Card not found"
        final boolean nameMismatch;  // el servidor la acepta pero resuelve a otra carta
        final CardInfo resolved;

        CardStatus(boolean rejected, boolean nameMismatch, CardInfo resolved) {
            this.rejected = rejected;
            this.nameMismatch = nameMismatch;
            this.resolved = resolved;
        }
    }

    /**
     * Semántica exacta del servidor oficial (Deck.load upstream):
     * CardRepository.findCard(set, number) + createCard(); el nombre de la
     * entrada no se usa para resolver.
     */
    private static CardStatus checkCard(DeckCardInfo info) {
        CardInfo resolved = null;
        try {
            resolved = CardRepository.instance.findCard(info.getSetCode(), info.getCardNumber());
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "card lookup failed for " + info.getCardName() + ": " + ex.getMessage());
            return new CardStatus(false, false, null); // degradar con gracia: dejar pasar
        }
        if (resolved == null) {
            return new CardStatus(true, false, null);
        }
        try {
            if (resolved.createCard() == null) {
                return new CardStatus(true, false, resolved);
            }
        } catch (Throwable ex) {
            // fila en BD pero la clase no instancia (caso raro): el servidor también fallará
            return new CardStatus(true, false, resolved);
        }
        boolean mismatch = !sameName(info.getCardName(), resolved.getName());
        return new CardStatus(false, mismatch, resolved);
    }

    /** true si la entrada del mazo y la carta resuelta se refieren a la misma carta. */
    private static boolean sameName(String requested, String resolved) {
        if (requested == null || requested.trim().isEmpty()) {
            return true;
        }
        String a = requested.trim();
        String b = resolved == null ? "" : resolved.trim();
        if (a.equalsIgnoreCase(b)) {
            return true;
        }
        // split/transform: "Fire // Ice" (entrada) vs fila de media carta "Fire"
        int cut = a.indexOf("//");
        if (cut > 0 && a.substring(0, cut).trim().equalsIgnoreCase(b)) {
            return true;
        }
        if (b.contains("//")) {
            for (String part : b.split("//")) {
                if (part.trim().equalsIgnoreCase(a)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Valida un mazo (ya normalizado por DeckJson, que es lo que se enviará al
     * servidor) y devuelve el informe JSON:
     * <pre>
     * { ready: true,
     *   missing: [ {cardName, setCode, cardNumber, amount,
     *               reason: "UNIMPLEMENTED"|"OUTDATED_PRINTING", suggestions?: [...]} ],
     *   mismatches: [ {cardName, setCode, cardNumber, amount, resolvedName, suggestions} ],
     *   fixedDeck: { name, author, cards: [...], sideboard: [...] } }  // solo si missing > 0
     * </pre>
     */
    public static JsonObject validate(DeckCardLists deck) {
        State state = STATE.get();
        boolean ready = state == State.READY && isDatabasePopulated();
        JsonObject report = new JsonObject();
        report.addProperty("ready", ready);
        JsonArray missing = new JsonArray();
        JsonArray mismatches = new JsonArray();
        if (ready && deck != null) {
            // dedup por entrada: la misma carta N veces acumula el amount una sola vez
            Map<String, JsonObject> rejections = new LinkedHashMap<>();
            Map<String, JsonObject> swaps = new LinkedHashMap<>();
            collectProblems(deck.getCards(), rejections, swaps);
            collectProblems(deck.getSideboard(), rejections, swaps);
            for (JsonObject problem : rejections.values()) {
                missing.add(problem);
            }
            for (JsonObject problem : swaps.values()) {
                mismatches.add(problem);
            }
        }
        report.add("missing", missing);
        report.add("mismatches", mismatches);
        if (ready && deck != null && missing.size() > 0) {
            report.add("fixedDeck", fixedDeckJson(deck));
        }
        return report;
    }

    private static void collectProblems(List<DeckCardInfo> cards, Map<String, JsonObject> rejections,
                                        Map<String, JsonObject> swaps) {
        if (cards == null) {
            return;
        }
        for (DeckCardInfo info : cards) {
            if (info == null) {
                continue;
            }
            CardStatus status = checkCard(info);
            if (!status.rejected && !status.nameMismatch) {
                continue;
            }
            String key = info.getCardName() + "|" + info.getSetCode() + "|" + info.getCardNumber();
            Map<String, JsonObject> target = status.rejected ? rejections : swaps;
            JsonObject problem = target.get(key);
            if (problem == null) {
                problem = new JsonObject();
                problem.addProperty("cardName", info.getCardName());
                problem.addProperty("setCode", info.getSetCode());
                problem.addProperty("cardNumber", info.getCardNumber());
                problem.addProperty("amount", info.getAmount());
                if (status.rejected) {
                    problem.addProperty("reason", rejectionReason(info));
                    if ("OUTDATED_PRINTING".equals(problem.get("reason").getAsString())) {
                        problem.add("suggestions", suggestionsJson(info.getCardName()));
                    }
                } else {
                    problem.addProperty("resolvedName", status.resolved.getName());
                    problem.add("suggestions", suggestionsJson(info.getCardName()));
                }
                target.put(key, problem);
            } else {
                problem.addProperty("amount", problem.get("amount").getAsInt() + info.getAmount());
            }
        }
    }

    /**
     * @return "OUTDATED_PRINTING" si el nombre existe en otra impresión (reparable
     * cambiando la impresión), "UNIMPLEMENTED" si no está implementada en ninguna.
     */
    private static String rejectionReason(DeckCardInfo info) {
        try {
            List<CardInfo> others = CardRepository.instance.findCards(info.getCardName(), MAX_SUGGESTIONS);
            return others != null && !others.isEmpty() ? "OUTDATED_PRINTING" : "UNIMPLEMENTED";
        } catch (Throwable ex) {
            return "UNIMPLEMENTED";
        }
    }

    private static JsonArray suggestionsJson(String cardName) {
        JsonArray suggestions = new JsonArray();
        try {
            List<CardInfo> others = CardRepository.instance.findCards(cardName, MAX_SUGGESTIONS);
            if (others != null) {
                for (CardInfo ci : others) {
                    JsonObject s = new JsonObject();
                    s.addProperty("cardName", ci.getName());
                    s.addProperty("setCode", ci.getSetCode());
                    s.addProperty("cardNumber", ci.getCardNumber());
                    suggestions.add(s);
                }
            }
        } catch (Throwable ignored) {
        }
        return suggestions;
    }

    /** Mazo en formato JSON (DeckJson) sin las cartas que el servidor rechazaría. */
    public static JsonObject fixedDeckJson(DeckCardLists deck) {
        JsonObject out = new JsonObject();
        out.addProperty("name", deck.getName());
        out.addProperty("author", deck.getAuthor());
        out.add("cards", cleanCards(deck.getCards()));
        out.add("sideboard", cleanCards(deck.getSideboard()));
        return out;
    }

    private static JsonArray cleanCards(List<DeckCardInfo> cards) {
        JsonArray arr = new JsonArray();
        if (cards == null) {
            return arr;
        }
        for (DeckCardInfo info : cards) {
            if (info == null || checkCard(info).rejected) {
                continue;
            }
            JsonObject card = new JsonObject();
            card.addProperty("cardName", info.getCardName());
            card.addProperty("setCode", info.getSetCode());
            card.addProperty("cardNumber", info.getCardNumber());
            card.addProperty("amount", info.getAmount());
            arr.add(card);
        }
        return arr;
    }

    public static boolean isCommanderFormat(String deckType, String gameType) {
        String d = deckType == null ? "" : deckType.toLowerCase(java.util.Locale.ROOT);
        String g = gameType == null ? "" : gameType.toLowerCase(java.util.Locale.ROOT);
        return d.contains("commander") || g.contains("commander");
    }

    public static DeckCardLists normalizeForXMage(DeckCardLists deck, String deckType, String gameType) {
        if (deck == null) return deck;
        if (!isCommanderFormat(deckType, gameType)) return deck;
        if (deck.getSideboard() != null && !deck.getSideboard().isEmpty()) return deck;
        java.util.List<DeckCardInfo> main = deck.getCards();
        if (main == null || main.isEmpty()) return deck;
        int totalMain = 0;
        for (DeckCardInfo c : main) if (c != null) totalMain += c.getAmount();
        if (totalMain < 99) return deck;
        // buscar comandante: primera carta legendaria que pueda ser comandante
        int commanderIdx = -1;
        for (int i = 0; i < main.size(); i++) {
            DeckCardInfo info = main.get(i);
            if (info == null) continue;
            try {
                CardInfo ci = CardRepository.instance.findCard(info.getSetCode(), info.getCardNumber());
                if (ci == null) continue;
                mage.cards.Card card = ci.createCard();
                if (card == null) continue;
                boolean canBe = false;
                try {
                    if (card.getAbilities().contains(mage.abilities.common.CanBeYourCommanderAbility.getInstance())) canBe = true;
                    else if (card.isLegendary() && (card.hasCardTypeForDeckbuilding(mage.constants.CardType.CREATURE)
                            || card.hasSubTypeForDeckbuilding(mage.constants.SubType.VEHICLE)
                            || card.hasSubTypeForDeckbuilding(mage.constants.SubType.SPACECRAFT))) canBe = true;
                } catch (Throwable ignored) {}
                if (canBe) { commanderIdx = i; break; }
            } catch (Throwable ignored) {}
        }
        if (commanderIdx == -1) commanderIdx = 0;
        DeckCardLists normalized = new DeckCardLists();
        normalized.setName(deck.getName());
        normalized.setAuthor(deck.getAuthor());
        boolean moved = false;
        for (int i = 0; i < main.size(); i++) {
            DeckCardInfo c = main.get(i);
            if (c == null) continue;
            if (i == commanderIdx && !moved) {
                normalized.getSideboard().add(new DeckCardInfo(c.getCardName(), c.getCardNumber(), c.getSetCode(), 1));
                if (c.getAmount() > 1) {
                    normalized.getCards().add(new DeckCardInfo(c.getCardName(), c.getCardNumber(), c.getSetCode(), c.getAmount() - 1));
                }
                moved = true;
            } else {
                normalized.getCards().add(c.copy());
            }
        }
        if (deck.getSideboard() != null) {
            for (DeckCardInfo c : deck.getSideboard()) if (c != null) normalized.getSideboard().add(c.copy());
        }
        return normalized;
    }

    /**
     * Igual que fixedDeckJson pero devolviendo DeckCardLists (para los asientos SIM).
     * Si la BD no está lista o no hay faltantes, devuelve el mismo mazo.
     */
    public static DeckCardLists stripMissing(DeckCardLists deck) {
        if (deck == null || STATE.get() != State.READY || !isDatabasePopulated()) {
            return deck;
        }
        DeckCardLists clean = new DeckCardLists();
        clean.setName(deck.getName());
        clean.setAuthor(deck.getAuthor());
        boolean changed = copyOk(deck.getCards(), clean.getCards());
        changed |= copyOk(deck.getSideboard(), clean.getSideboard());
        return changed ? clean : deck;
    }

    private static boolean copyOk(List<DeckCardInfo> from, List<DeckCardInfo> to) {
        boolean changed = false;
        if (from == null) {
            return false;
        }
        for (DeckCardInfo info : from) {
            if (info == null) {
                continue;
            }
            if (checkCard(info).rejected) {
                changed = true;
            } else {
                to.add(info.copy());
            }
        }
        return changed;
    }
}
