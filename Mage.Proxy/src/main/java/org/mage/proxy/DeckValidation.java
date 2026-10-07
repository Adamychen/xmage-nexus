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
 * de XMage que corre el servidor objetivo. Búsqueda estricta por (setCode,
 * cardNumber) + instanciación de la clase, igual que el servidor real de
 * destino (upstream {@code Deck.load}: el nombre de la entrada NO participa en
 * la resolución, solo se usa para detectar mismatches y sugerir impresiones).
 * <p>
 * Detecta tres problemas distintos:
 * <ul>
 * <li><b>missing</b>: el servidor rechaza la carta ("Card not found" al unirse) —
 *     set/número desconocidos (el nombre existe en otra impresión => OUTDATED_PRINTING
 *     con sugerencias), carta sin implementar en ninguna impresión (UNIMPLEMENTED),
 *     o entrada sin impresión asignada en absoluto (mazos importados como texto
 *     plano: "17 Forest" sin `[SET:NUM]`) — también OUTDATED_PRINTING con
 *     sugerencias. Este último caso resuelve "bien" con el fallback-por-nombre
 *     de {@link #resolveForCommander}, pero ese fallback es un parche exclusivo
 *     del fork nexus (`Deck.resolveCardInfo`, no upstream); un servidor real sin
 *     el parche hace el lookup estricto y lo rechaza igual, así que aquí se
 *     marca como missing a propósito para no dar un falso "ready" (bug real
 *     reportado con "Forest" sin impresión en un mazo importado, "elves
 *     pauper").</li>
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
     * Lookup estricto por (set, número), como hace el servidor real de destino.
     * Si la entrada no trae impresión, se resuelve por nombre solo para poder
     * diagnosticar/sugerir (ver {@link #resolveForCommander}), pero se marca
     * igualmente como {@code missing}: ese fallback-por-nombre no existe en un
     * servidor sin el parche del fork nexus, así que un "ready" aquí sería un
     * falso negativo (el join real fallaría con "Card not found"). Las entradas
     * que llegan por el protocolo ya traen impresión: {@link DeckJson#resolvePrinting}
     * les asigna la del importador de XMage en el borde; aquí solo llegan sin
     * ella si la carta no existe en la release o la BD no estaba lista.
     */
    private static CardStatus checkCard(DeckCardInfo info) {
        String set = info.getSetCode() == null ? "" : info.getSetCode().trim();
        String num = info.getCardNumber() == null ? "" : info.getCardNumber().trim();
        boolean noPrinting = set.isEmpty() && num.isEmpty();
        CardInfo resolved = null;
        try {
            resolved = resolveForCommander(info);
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "card lookup failed for " + info.getCardName() + ": " + ex.getMessage());
            return new CardStatus(false, false, null); // degradar con gracia: dejar pasar
        }
        if (resolved == null) {
            return new CardStatus(true, false, null);
        }
        if (noPrinting) {
            return new CardStatus(true, false, resolved);
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
        String a = foldSplitSeparator(foldName(requested));
        String b = foldSplitSeparator(foldName(resolved));
        if (a.equals(b)) {
            return true;
        }
        // split/transform: "Fire // Ice" (entrada) vs fila de media carta "Fire"
        int cut = a.indexOf("//");
        if (cut > 0 && a.substring(0, cut).trim().equals(b)) {
            return true;
        }
        if (b.contains("//")) {
            for (String part : b.split("//")) {
                if (part.trim().equals(a)) {
                    return true;
                }
            }
        }
        return false;
    }

    /** "Fire / Ice" (single slash, as some exporters write it) reads as "Fire // Ice". */
    private static String foldSplitSeparator(String name) {
        return name.replaceAll("\\s*/{1,2}\\s*", " // ");
    }

    /** Minúsculas y sin diacríticos: "Andúril" y "Anduril" son la misma carta. */
    private static String foldName(String name) {
        if (name == null) {
            return "";
        }
        String decomposed = java.text.Normalizer.normalize(name.trim(), java.text.Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").toLowerCase(java.util.Locale.ROOT);
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
        return validate(deck, java.util.Collections.emptyMap());
    }

    /**
     * @param sources raw client printings rewritten by {@link DeckJson} normalization,
     *                keyed by name|set|number; echoed as {@code sources} on each problem
     */
    public static JsonObject validate(DeckCardLists deck, Map<String, java.util.Set<List<String>>> sources) {
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
            collectProblems(deck.getCards(), rejections, swaps, sources);
            collectProblems(deck.getSideboard(), rejections, swaps, sources);
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
                                        Map<String, JsonObject> swaps,
                                        Map<String, java.util.Set<List<String>>> sources) {
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
                java.util.Set<List<String>> raw = sources.get(key);
                if (raw != null && !raw.isEmpty()) {
                    JsonArray arr = new JsonArray();
                    for (List<String> printing : raw) {
                        JsonObject src = new JsonObject();
                        src.addProperty("setCode", printing.get(0));
                        src.addProperty("cardNumber", printing.get(1));
                        arr.add(src);
                    }
                    problem.add("sources", arr);
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

    /**
     * Resuelve una entrada del mazo como el servidor (Deck.resolveCardInfo):
     * por (set, número) y, si la entrada no trae impresión, por nombre.
     */
    private static CardInfo resolveForCommander(DeckCardInfo info) {
        if (info == null) return null;
        String set = info.getSetCode() == null ? "" : info.getSetCode().trim();
        String num = info.getCardNumber() == null ? "" : info.getCardNumber().trim();
        String name = info.getCardName() == null ? "" : info.getCardName().trim();
        if (set.isEmpty() && num.isEmpty() && !name.isEmpty()) {
            CardInfo byName = CardRepository.instance.findPreferredCoreExpansionCard(name, "");
            return byName != null ? byName : CardRepository.instance.findCard(name, true);
        }
        return CardRepository.instance.findCard(set, num);
    }

    /**
     * Nombres de deckType de config.xml del servidor -> clase validadora de la
     * MISMA release. El cliente envía exactamente estos nombres (son los que la
     * mesa declara al crearse), así que la resolución exacta es el camino
     * normal; el fallback normalizado es solo por robustez. Excluidos los
     * formatos de bloque (obsoletos) y Limited (vive en otro artefacto).
     */
    private static final Map<String, String> DECK_TYPE_VALIDATORS = buildDeckTypeValidators();

    private static Map<String, String> buildDeckTypeValidators() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("Constructed - Standard", "mage.deck.Standard");
        m.put("Constructed - Extended", "mage.deck.Extended");
        m.put("Constructed - Frontier", "mage.deck.Frontier");
        m.put("Constructed - Pioneer", "mage.deck.Pioneer");
        m.put("Constructed - Modern", "mage.deck.Modern");
        m.put("Constructed - Modern - No Banned List", "mage.deck.ModernNoBannedList");
        m.put("Constructed - Eternal", "mage.deck.Eternal");
        m.put("Constructed - Legacy", "mage.deck.Legacy");
        m.put("Constructed - Vintage", "mage.deck.Vintage");
        m.put("Constructed - Pauper", "mage.deck.Pauper");
        m.put("Constructed - Historic", "mage.deck.Historic");
        m.put("Constructed - Historical Type 2", "mage.deck.HistoricalType2");
        m.put("Constructed - Super Type 2", "mage.deck.SuperType2");
        m.put("Constructed - Australian Highlander", "mage.deck.AusHighlander");
        m.put("Constructed - Canadian Highlander", "mage.deck.CanadianHighlander");
        m.put("Constructed - European Highlander", "mage.deck.EuropeanHighlander");
        m.put("Constructed - Old School 93/94", "mage.deck.OldSchool9394");
        m.put("Constructed - Old School 93/94 - Italian Rules", "mage.deck.OldSchool9394Italian");
        m.put("Constructed - Old School 93/94 - Channel Fireball Rules", "mage.deck.OldSchool9394CFB");
        m.put("Constructed - Old School 93/94 - EudoGames Rules", "mage.deck.OldSchool9394EG");
        m.put("Constructed - Freeform", "mage.deck.Freeform");
        m.put("Constructed - Freeform Unlimited", "mage.deck.FreeformUnlimited");
        m.put("Variant Magic - Commander", "mage.deck.Commander");
        m.put("Variant Magic - Duel Commander", "mage.deck.DuelCommander");
        m.put("Variant Magic - MTGO 1v1 Commander", "mage.deck.MTGO1v1Commander");
        m.put("Variant Magic - Centurion Commander", "mage.deck.CenturionCommander");
        m.put("Variant Magic - Tiny Leaders", "mage.deck.TinyLeaders");
        m.put("Variant Magic - Momir Basic", "mage.deck.Momir");
        m.put("Variant Magic - Penny Dreadful Commander", "mage.deck.PennyDreadfulCommander");
        m.put("Variant Magic - Freeform Commander", "mage.deck.FreeformCommander");
        m.put("Variant Magic - Freeform Unlimited Commander", "mage.deck.FreeformUnlimitedCommander");
        m.put("Variant Magic - Brawl", "mage.deck.Brawl");
        m.put("Variant Magic - Oathbreaker", "mage.deck.Oathbreaker");
        return m;
    }

    private static String foldDeckType(String s) {
        return s == null ? "" : s.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    /**
     * Resuelve el DeckValidator oficial de XMage por deckType y, si no, por
     * gameType (ambos son nombres de config.xml). Null si no hay validador
     * para ese tipo: el cliente mantiene su validación local.
     */
    private static Class<?> resolveDeckValidator(String deckType, String gameType) {
        for (String candidate : new String[]{deckType, gameType}) {
            if (candidate == null || candidate.isBlank()) continue;
            String className = DECK_TYPE_VALIDATORS.get(candidate);
            if (className == null) {
                String folded = foldDeckType(candidate);
                for (Map.Entry<String, String> e : DECK_TYPE_VALIDATORS.entrySet()) {
                    if (foldDeckType(e.getKey()).equals(folded)) {
                        className = e.getValue();
                        break;
                    }
                }
            }
            if (className == null) {
                // "Commander" -> "Variant Magic - Commander", etc.
                String folded = foldDeckType(candidate);
                for (Map.Entry<String, String> e : DECK_TYPE_VALIDATORS.entrySet()) {
                    String k = foldDeckType(e.getKey());
                    if (k.contains(folded) || folded.contains(k)) {
                        className = e.getValue();
                        break;
                    }
                }
            }
            if (className != null) {
                try {
                    return Class.forName(className);
                } catch (Throwable ignored) {
                    // clase ausente en esta release: seguir con el siguiente candidato
                }
            }
        }
        return null;
    }

    private static JsonObject formatError(String type, String group, String message, String cardName) {
        JsonObject err = new JsonObject();
        err.addProperty("type", type);
        if (group != null) err.addProperty("group", group);
        if (message != null) err.addProperty("message", message);
        if (cardName != null) err.addProperty("cardName", cardName);
        return err;
    }

    /**
     * Validación COMPLETA del mazo con el DeckValidator oficial de XMage de la
     * misma release que el servidor objetivo (tamaños, bans, reglas de
     * comandante y partner, identidad de color). Se aplica primero la misma
     * normalización que en joinTable (comandantes al sideboard), así que lo que
     * se valida es EXACTAMENTE lo que llegaría al servidor. Advisory: ready=false
     * si la BD de cartas no está disponible, supported=false si no hay
     * validador para el formato pedido.
     */
    public static JsonObject validateDeckFormat(DeckCardLists deck, String deckType, String gameType) {
        JsonObject out = new JsonObject();
        JsonArray errors = new JsonArray();
        out.add("errors", errors);
        boolean ready = isDatabasePopulated();
        out.addProperty("ready", ready);
        if (!ready || deck == null) {
            out.addProperty("supported", false);
            out.addProperty("valid", true);
            out.addProperty("validator", "");
            return out;
        }
        Class<?> validatorClass = resolveDeckValidator(deckType, gameType);
        if (validatorClass == null) {
            out.addProperty("supported", false);
            out.addProperty("valid", true);
            out.addProperty("validator", "");
            return out;
        }
        out.addProperty("supported", true);
        out.addProperty("validator", validatorClass.getSimpleName());
        mage.cards.decks.DeckValidator validator;
        try {
            validator = (mage.cards.decks.DeckValidator) validatorClass.getDeclaredConstructor().newInstance();
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "validateDeckFormat: cannot instantiate " + validatorClass.getName(), ex);
            out.addProperty("valid", true);
            return out;
        }
        // misma transformación que joinTable: sin esto el validador oficial vería
        // el comandante en el main y rechazaría un mazo que el servidor acepta
        mage.cards.decks.DeckCardLists normalized = normalizeForXMage(deck, deckType, gameType);
        mage.cards.decks.Deck loaded;
        try {
            // mismos flags que el flujo real post-parse: sin re-chequeo de
            // cartas (eso ya lo hizo checkCard); las reglas las pone el validador
            loaded = mage.cards.decks.Deck.load(normalized, false, false);
        } catch (mage.game.GameException ex) {
            String msg = ex.getMessage() == null ? "Deck rejected" : ex.getMessage();
            out.addProperty("valid", false);
            errors.add(formatError("OTHER", msg, msg, null));
            return out;
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "validateDeckFormat: deck load failed", ex);
            // advisory: un fallo técnico nunca bloquea el flujo
            out.addProperty("valid", true);
            return out;
        }
        boolean valid;
        try {
            valid = validator.validate(loaded);
        } catch (Throwable ex) {
            logger.log(Level.WARNING, "validateDeckFormat: validator threw", ex);
            out.addProperty("valid", true);
            return out;
        }
        out.addProperty("valid", valid);
        for (mage.cards.decks.DeckValidatorError e : validator.getErrorsList()) {
            errors.add(formatError(
                    e.getErrorType() == null ? "OTHER" : e.getErrorType().name(),
                    e.getGroup(), e.getMessage(), e.getCardName()));
        }
        return out;
    }

    public static boolean isCommanderFormat(String deckType, String gameType) {
        String d = deckType == null ? "" : deckType.toLowerCase(java.util.Locale.ROOT);
        String g = gameType == null ? "" : gameType.toLowerCase(java.util.Locale.ROOT);
        return d.contains("commander") || g.contains("commander");
    }

    /**
     * ¿Puede esta carta ser comandante según XMage? Espejo exacto de
     * AbstractCommander.checkCommander (1.4.62): la habilidad
     * CanBeYourCommander manda; para el resto se usa el tipo de deckbuilding
     * real de la clase, que algunas cartas sobreescriben (Grist se reporta
     * criatura fuera del campo de batalla, CR 903.5a, aunque su línea de tipo
     * sea Planeswalker); las naves legendarias cuentan si tienen un nivel de
     * estacionamiento con P/T (StationLevelAbility.hasPT). Los planeswalkers
     * con "can be your commander" en el texto (p.ej. Commodore Guff) la
     * implementan con CanBeYourCommanderAbility; un planeswalker legendario
     * sin esa frase (p.ej. The Royal Scions) se rechaza, igual que en el juego
     * real.
     */
    public static boolean canBeCommander(mage.cards.Card card) {
        if (card == null) return false;
        try {
            if (card.getAbilities().contains(mage.abilities.common.CanBeYourCommanderAbility.getInstance())) return true;
            if (!card.isLegendary()) return false;
            if (card.hasCardTypeForDeckbuilding(mage.constants.CardType.CREATURE)) return true;
            if (card.hasSubTypeForDeckbuilding(mage.constants.SubType.VEHICLE)) return true;
            return card.hasSubTypeForDeckbuilding(mage.constants.SubType.SPACECRAFT)
                    && mage.util.CardUtil.castStream(card.getAbilities(), mage.abilities.keyword.StationLevelAbility.class)
                        .anyMatch(mage.abilities.keyword.StationLevelAbility::hasPT);
        } catch (Throwable ignored) {
            return false;
        }
    }

    /**
     * Elegibilidad de comandante por nombre, calculada con las clases reales de
     * XMage de la MISMA release que el servidor objetivo (fuente de verdad; el
     * cliente web la usa para habilitar el icono de comandante y cae a una
     * heurística local cuando el proxy no responde). La elegibilidad es de la
     * carta (su clase), no de la impresión, así que se resuelve por nombre.
     * Advisory: ready=false si la BD de cartas no está disponible.
     */
    public static JsonObject commanderEligibility(List<String> names) {
        JsonObject out = new JsonObject();
        out.addProperty("ready", isDatabasePopulated());
        JsonArray results = new JsonArray();
        if (names != null) {
            for (String name : names) {
                if (name == null || name.isBlank()) continue;
                boolean eligible = false;
                try {
                    CardInfo ci = CardRepository.instance.findCard(name, true);
                    eligible = ci != null && canBeCommander(ci.createCard());
                } catch (Throwable ignored) {
                }
                JsonObject entry = new JsonObject();
                entry.addProperty("name", name);
                entry.addProperty("eligible", eligible);
                results.add(entry);
            }
        }
        out.add("results", results);
        return out;
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
                CardInfo ci = resolveForCommander(info);
                if (ci == null) continue;
                mage.cards.Card card = ci == null ? null : ci.createCard();
                boolean canBe = canBeCommander(card);
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
