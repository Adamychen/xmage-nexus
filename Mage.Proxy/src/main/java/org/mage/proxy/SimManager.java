package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.cards.decks.DeckCardLists;

import java.util.UUID;
import java.util.function.Consumer;
import java.util.logging.Logger;

/** Asientos "SIM": oponentes simulados con su propia sesión de servidor. */
final class SimManager {

    private static final Logger logger = Logger.getLogger(SimManager.class.getName());

    private final Config config;
    private final Consumer<String> errorSink;
    private final SimRoster roster;
    private final java.util.Map<String, SimPlayer> sims = new java.util.HashMap<>();
    private volatile String owner = null;
    // Compartido por TODAS las instancias de SimManager del proceso (una por
    // sesión/ProxyClient). Antes era un contador por instancia (siempre
    // arrancaba en 0) y la única fuente de unicidad entre sesiones era
    // currentTimeMillis() % 1000 — un espacio de solo 1000 valores. Con
    // varias mesas SIM creándose casi a la vez (visto en vivo con el fuzzer
    // de P6: 2 de 8 tablas concurrentes) dos sesiones distintas podían
    // generar el MISMO username "sim-000001-<mismos ms%1000>"; el servidor
    // trata las conexiones duplicadas del mismo usuario como reconexión y
    // mata la sesión más antigua, dejando el asiento SIM de esa mesa sin
    // ocupar y `startMatch` falla con "Command failed". Un contador atómico
    // global garantiza unicidad sin depender del reloj.
    private static final java.util.concurrent.atomic.AtomicLong GLOBAL_SIM_COUNTER = new java.util.concurrent.atomic.AtomicLong();
    // servidor al que conecta la sesión web (los Sim se conectan al mismo)
    private volatile String serverHost = "";
    private volatile int serverPort = 0;

    SimManager(Config config, Consumer<String> errorSink) {
        this(config, errorSink, null);
    }

    SimManager(Config config, Consumer<String> errorSink, SimRoster roster) {
        this.config = config;
        this.errorSink = errorSink;
        this.roster = roster;
        if (roster != null) {
            reserveSimNumbers(roster.maxSimNumber());
        }
    }

    /**
     * SIM names must never repeat one of a previous proxy process: the server would take the new
     * bot for a reconnection of the old one and hand it the old bot's tables. The counter starts
     * from the clock (and above every name on the roster).
     */
    static {
        reserveSimNumbers((System.currentTimeMillis() / 1000) % 900_000);
    }

    static void reserveSimNumbers(long atLeast) {
        GLOBAL_SIM_COUNTER.accumulateAndGet(atLeast, Math::max);
    }

    void setServer(String host, int port) {
        this.serverHost = host;
        this.serverPort = port;
    }

    /** Account (host|username) that owns the bots started from now on. */
    void setOwner(String owner) {
        this.owner = owner;
    }

    /**
     * Logs in again the bots this account had playing when the previous proxy process stopped
     * (runs in the background: the login of the account must not wait for its bots).
     */
    void restoreSims() {
        String who = owner;
        if (roster == null || who == null) {
            return;
        }
        java.util.List<SimRoster.Seat> seats = roster.takeFor(who, serverHost, serverPort);
        if (seats.isEmpty()) {
            return;
        }
        Thread t = new Thread(() -> {
            for (SimRoster.Seat seat : seats) {
                DeckCardLists deck = seat.deck != null ? DeckJson.parse(seat.deck) : defaultSimDeck();
                SimPlayer sim = new SimPlayer(seat.username, config.getPassword(), DeckValidation.stripMissing(deck),
                        seat.host, seat.port, seat.skill);
                track("restored#" + seat.username, sim, seat);
                boolean ok = sim.startRestored(RESTORED_IDLE_STOP_MS);
                logger.info("sim " + seat.username + " restored for " + who + " => " + ok);
                if (!ok) {
                    sim.stop();
                }
            }
        }, "sim-restore");
        t.setDaemon(true);
        t.start();
    }

    static final long RESTORED_IDLE_STOP_MS = 60_000;

    private void track(String key, SimPlayer sim, SimRoster.Seat seat) {
        synchronized (sims) {
            sims.put(key, sim);
        }
        if (roster != null && seat != null) {
            roster.add(seat);
            sim.setOnStopped(() -> {
                roster.remove(seat.username);
                synchronized (sims) {
                    sims.remove(key, sim);
                }
            });
        }
    }

    /** Crea y une un SimPlayer por cada asiento "SIM" de la mesa recién creada. */
    void startSims(JsonObject args, UUID roomId, UUID tableId) {
        if (!args.has("playerTypes")) {
            return;
        }
        JsonArray types = args.getAsJsonArray("playerTypes");
        JsonArray simDecks = args.has("simDecks") && args.get("simDecks").isJsonArray()
                ? args.getAsJsonArray("simDecks") : null;
        JsonArray seatSkills = args.has("seatSkills") && args.get("seatSkills").isJsonArray()
                ? args.getAsJsonArray("seatSkills") : null;
        int botIdx = -1;
        int simIdx = 0;
        for (int t = 0; t < types.size(); t++) {
            String raw = types.get(t).getAsString();
            if ("HUMAN".equalsIgnoreCase(raw)) {
                continue;
            }
            botIdx++;
            if (!"SIM".equalsIgnoreCase(raw)) {
                continue;
            }
            int i = simIdx++;
            JsonObject deckJson = simDecks != null && i < simDecks.size() && simDecks.get(i).isJsonObject()
                    ? simDecks.get(i).getAsJsonObject() : null;
            DeckCardLists deck = deckJson != null ? DeckJson.parse(deckJson) : defaultSimDeck();
            // un asiento SIM con cartas no implementadas dejaría la mesa sin bot y sin
            // señal: quitarlas (la validación es la misma que la del servidor oficial)
            deck = DeckValidation.stripMissing(deck);
            int skill = seatSkillAt(seatSkills, botIdx);
            SimPlayer sim = new SimPlayer(nextSimUsername(), config.getPassword(), deck, serverHost, serverPort, skill);
            String who = owner;
            track(tableId + "#" + i, sim, who == null ? null
                    : new SimRoster.Seat(who, sim.getUsername(), serverHost, serverPort, skill, deckJson));
            boolean joined = sim.startAndJoin(roomId, tableId);
            logger.info("sim seat " + i + " for table " + tableId + " (" + sim.getUsername() + ") joined=" + joined);
            if (!joined) {
                String detail = ErrorClassifier.stripServerErrorPrefix(sim.getLastJoinError());
                errorSink.accept("SIM " + sim.getUsername() + " failed to join"
                        + (detail != null && !detail.isEmpty() ? ": " + detail : ""));
            }
        }
    }

    String nextSimUsername() {
        return "sim-" + String.format("%06d", GLOBAL_SIM_COUNTER.incrementAndGet());
    }

    /** Skill 1-10 del asiento bot (orden de plazas no-humanas); 0 si ausente/inválido. */
    static int seatSkillAt(JsonArray seatSkills, int botIdx) {
        if (seatSkills == null || botIdx < 0 || botIdx >= seatSkills.size()) {
            return 0;
        }
        try {
            return seatSkills.get(botIdx).getAsInt();
        } catch (Exception ignored) {
            return 0;
        }
    }

    /** Mazo por defecto del asiento simulado: solo tierras (partida determinista). */
    private static DeckCardLists defaultSimDeck() {
        JsonObject deck = new JsonObject();
        deck.addProperty("name", "Sim lands");
        JsonArray cards = new JsonArray();
        cards.add(cardJson("Island", "LEA", "288", 30));
        cards.add(cardJson("Mountain", "LEA", "292", 30));
        deck.add("cards", cards);
        deck.add("sideboard", new JsonArray());
        return DeckJson.parse(deck);
    }

    private static JsonObject cardJson(String name, String set, String number, int amount) {
        JsonObject card = new JsonObject();
        card.addProperty("cardName", name);
        card.addProperty("setCode", set);
        card.addProperty("cardNumber", number);
        card.addProperty("amount", amount);
        return card;
    }

    /** Detiene todos los bots simulados (nuevo usuario o desconexión del web). */
    void stopSims() {
        java.util.List<SimPlayer> all;
        synchronized (sims) {
            all = new java.util.ArrayList<>(sims.values());
            sims.clear();
        }
        for (SimPlayer sim : all) {
            try {
                sim.stop();
            } catch (Exception ignored) {
            }
        }
    }
}
