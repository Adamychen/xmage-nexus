package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
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
    private final java.util.Map<String, SimPlayer> sims = new java.util.HashMap<>();
    private int simCounter = 0;
    // servidor al que conecta la sesión web (los Sim se conectan al mismo)
    private volatile String serverHost = "";
    private volatile int serverPort = 0;

    SimManager(Config config, Consumer<String> errorSink) {
        this.config = config;
        this.errorSink = errorSink;
    }

    void setServer(String host, int port) {
        this.serverHost = host;
        this.serverPort = port;
    }

    /** Crea y une un SimPlayer por cada asiento "SIM" de la mesa recién creada. */
    void startSims(JsonObject args, UUID roomId, UUID tableId) {
        if (!args.has("playerTypes")) {
            return;
        }
        JsonArray types = args.getAsJsonArray("playerTypes");
        int simSeats = 0;
        for (JsonElement e : types) {
            if ("SIM".equalsIgnoreCase(e.getAsString())) {
                simSeats++;
            }
        }
        if (simSeats == 0) {
            return;
        }
        JsonArray simDecks = args.has("simDecks") && args.get("simDecks").isJsonArray()
                ? args.getAsJsonArray("simDecks") : null;
        for (int i = 0; i < simSeats; i++) {
            DeckCardLists deck = null;
            if (simDecks != null && i < simDecks.size() && simDecks.get(i).isJsonObject()) {
                deck = DeckJson.parse(simDecks.get(i).getAsJsonObject());
            }
            if (deck == null) {
                deck = defaultSimDeck();
            }
            // un asiento SIM con cartas no implementadas dejaría la mesa sin bot y sin
            // señal: quitarlas (la validación es la misma que la del servidor oficial)
            deck = DeckValidation.stripMissing(deck);
            SimPlayer sim = new SimPlayer(nextSimUsername(), config.getPassword(), deck, serverHost, serverPort);
            sims.put(tableId + "#" + i, sim);
            boolean joined = sim.startAndJoin(roomId, tableId);
            logger.info("sim seat " + i + " for table " + tableId + " (" + sim.getUsername() + ") joined=" + joined);
            if (!joined) {
                String detail = ErrorClassifier.stripServerErrorPrefix(sim.getLastJoinError());
                errorSink.accept("SIM " + sim.getUsername() + " failed to join"
                        + (detail != null && !detail.isEmpty() ? ": " + detail : ""));
            }
        }
    }

    private String nextSimUsername() {
        return "sim-" + String.format("%06d", ++simCounter) + "-" + (System.currentTimeMillis() % 1000);
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
        for (SimPlayer sim : sims.values()) {
            try {
                sim.stop();
            } catch (Exception ignored) {
            }
        }
        sims.clear();
    }
}
