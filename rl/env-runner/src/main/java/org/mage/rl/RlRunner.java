package org.mage.rl;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.MageObject;
import mage.abilities.ActivatedAbility;
import mage.abilities.SpellAbility;
import mage.cards.Card;
import mage.cards.decks.Deck;
import mage.cards.decks.DeckCardLists;
import mage.cards.decks.importer.DeckImporter;
import mage.cards.repository.CardScanner;
import mage.collectors.DataCollectorServices;
import mage.constants.MultiplayerAttackOption;
import mage.constants.RangeOfInfluence;
import mage.constants.Zone;
import mage.game.Game;
import mage.game.GameOptions;
import mage.game.TwoPlayerDuel;
import mage.game.combat.Combat;
import mage.game.mulligan.MulliganType;
import mage.game.permanent.Permanent;
import mage.players.Player;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Headless RL environment worker: two RlPlayers play mirror games and talk
 * JSONL over stdin/stdout (one line per prompt; logs go to stderr).
 *
 * stdin  -> {"cmd":"new","first":"A","turns":30}
 * stdout <- {"type":"obs",...} / {"type":"result",...}
 * stdin  -> {"seat":"A","pass":1} | {"seat":"A","play":2} |
 *           {"seat":"A","attackers":[0,2]} | {"seat":"B","pairs":[[0,1],...]}
 */
public final class RlRunner {

    static final String DEFAULT_PASS = "{\"pass\":1,\"attackers\":[],\"pairs\":[]}";
    private static final Gson GSON = new Gson();
    private static final long PROMPT_TIMEOUT_SECS = 30;

    private static final java.util.Map<mage.constants.CardType, Integer> TYPE_BITS = new java.util.HashMap<>();
    static {
        mage.constants.CardType[] order = {
                mage.constants.CardType.ARTIFACT, mage.constants.CardType.CREATURE,
                mage.constants.CardType.ENCHANTMENT, mage.constants.CardType.INSTANT,
                mage.constants.CardType.LAND, mage.constants.CardType.PLANESWALKER,
                mage.constants.CardType.SORCERY, mage.constants.CardType.BATTLE,
        };
        for (int i = 0; i < order.length; i++) {
            TYPE_BITS.put(order[i], 1 << i);
        }
    }

    private final Player[] players = new Player[2];
    private final Map<String, Integer> seatIdx = new HashMap<>();
    private final List<BlockingQueue<String>> queues = new ArrayList<>();
    private final BlockingQueue<String> cmdQueue = new ArrayBlockingQueue<>(4);
    private final Map<String, List<ActivatedAbility>> lastPlayable = new HashMap<>();
    private final Map<String, List<Permanent>> lastCands = new HashMap<>();
    private final Map<String, List<UUID>> lastAttackerIds = new HashMap<>();
    // deck label per seat (training label for the opponent-archetype aux head)
    private final Map<String, String> seatDeck = new HashMap<>();

    public static void main(String[] args) throws Exception {
        java.util.logging.LogManager.getLogManager().reset();
        List<String> errors = new ArrayList<>();
        boolean scanned = false;
        for (int attempt = 0; attempt < 6 && !scanned; attempt++) {
            try {
                errors.clear();
                CardScanner.scan(errors);
                if (mage.cards.repository.CardRepository.instance == null) {
                    throw new IllegalStateException("CardRepository instance is null after scan");
                }
                // probe: a poisoned <clinit> cannot heal inside this JVM, fail fast
                mage.cards.repository.CardRepository.instance.findCards("Lightning Bolt");
                scanned = true;
            } catch (Throwable t) {
                System.err.println("card scan attempt " + attempt + " failed: " + t);
                Thread.sleep(2000 + attempt * 2000L);
            }
        }
        if (!scanned) {
            System.err.println("card scan failed permanently");
            System.exit(2);
        }
        if (!errors.isEmpty()) {
            System.err.println("Card scan errors: " + errors.size());
        }
        DataCollectorServices.init(System.getenv("RL_GAMELOG") != null, false);
        System.out.println("RL_READY");
        System.out.flush();
        new RlRunner(args[0]).run();
    }

    private final String deckPath;
    private final Map<String, DeckCardLists> deckCache = new HashMap<>();

    RlRunner(String deckPath) {
        this.deckPath = deckPath;
        for (int i = 0; i < 2; i++) {
            queues.add(new ArrayBlockingQueue<>(4));
        }
        seatIdx.put("A", 0);
        seatIdx.put("B", 1);
        Thread reader = new Thread(this::readStdin, "stdin-reader");
        reader.setDaemon(true);
        reader.start();
    }

    private volatile boolean stdinOpen = true;

    private void readStdin() {
        try (BufferedReader br = new BufferedReader(new InputStreamReader(System.in))) {
            String line;
            while ((line = br.readLine()) != null) {
                if (!line.trim().startsWith("{")) {
                    continue;
                }
                JsonObject json = JsonParser.parseString(line).getAsJsonObject();
                if (json.has("seat")) {
                    queues.get(seatIdx.get(json.get("seat").getAsString())).offer(line);
                } else if (json.has("cmd")) {
                    cmdQueue.offer(line);
                }
            }
            stdinOpen = false;
        } catch (Exception e) {
            stdinOpen = false;
            System.err.println("stdin reader died: " + e);
        }
    }

    private void run() throws Exception {
        while (stdinOpen) {
            String line = cmdQueue.poll(2, TimeUnit.SECONDS);
            if (line == null) {
                continue;
            }
            JsonObject cmd = JsonParser.parseString(line).getAsJsonObject();
            if (!"new".equals(str(cmd, "cmd"))) {
                continue;
            }
            String first = cmd.has("first") ? str(cmd, "first") : "A";
            int turns = cmd.has("turns") ? cmd.get("turns").getAsInt() : 30;
            String opp = cmd.has("opp") ? str(cmd, "opp") : null;
            String oppType = cmd.has("oppType") ? str(cmd, "oppType") : "mad";
            String deckA = cmd.has("deckA") ? str(cmd, "deckA") : null;
            String deckB = cmd.has("deckB") ? str(cmd, "deckB") : null;
            playOneGame(first, turns, opp, oppType, deckA, deckB);
        }
        System.exit(0);
    }

    private void playOneGame(String first, int maxTurns, String opp, String oppType,
                             String deckA, String deckB) {
        lastPlayable.clear();
        lastCands.clear();
        lastAttackerIds.clear();
        try {
            Game game = new TwoPlayerDuel(MultiplayerAttackOption.LEFT, RangeOfInfluence.ONE,
                    MulliganType.GAME_DEFAULT.getMulligan(0), 60, 20, 7);
            players[0] = new RlPlayer("BotA", "A", this);
            players[1] = new RlPlayer("BotB", "B", this);
            if (opp != null) {
                players[seatIdx.get(opp)] = createAiOpponent(oppType, opp);
            }
            String[] deckPaths = {deckA != null ? deckA : deckPath, deckB != null ? deckB : deckPath};
            seatDeck.put("A", deckName(deckPaths[0]));
            seatDeck.put("B", deckName(deckPaths[1]));
            mage.game.match.MatchOptions matchOptions = new mage.game.match.MatchOptions("rl match", "Two Player Duel", false);
            mage.game.match.Match match = new mage.game.FreeForAllMatch(matchOptions);
            for (int i = 0; i < 2; i++) {
                Player p = players[i];
                Deck deck = Deck.load(deckList(deckPaths[i]), false, false);
                game.loadCards(deck.getCards(), p.getId());
                game.loadCards(deck.getSideboard(), p.getId());
                game.addPlayer(p, deck);
                match.addPlayer(p, deck);
            }
            for (Player p : players) {
                p.updateRange(game);
            }
            GameOptions options = new GameOptions();
            options.testMode = false;
            options.stopOnTurn = maxTurns;
            game.setGameOptions(options);
            game.start(players["A".equals(first) ? 0 : 1].getId());

            String winner = "";
            if (game.hasEnded()) {
                String w = game.getWinner();
                if (w != null) {
                    if (w.contains("BotA")) {
                        winner = "A";
                    } else if (w.contains("BotB")) {
                        winner = "B";
                    }
                }
            }
            JsonObject result = new JsonObject();
            result.addProperty("type", "result");
            result.addProperty("winner", winner);
            result.addProperty("turns", game.getTurnNum());
            result.addProperty("paused", game.isPaused());
            result.addProperty("lostA", players[0].hasLost());
            result.addProperty("lostB", players[1].hasLost());
            result.addProperty("libA", players[0].getLibrary().size());
            result.addProperty("libB", players[1].getLibrary().size());
            result.addProperty("handA", players[0].getHand().size());
            result.addProperty("handB", players[1].getHand().size());
            result.addProperty("lifeA", players[0].getLife());
            result.addProperty("lifeB", players[1].getLife());
            send(result);
        } catch (Throwable t) {
            System.err.println("game failed: " + t);
            t.printStackTrace();
            JsonObject result = new JsonObject();
            result.addProperty("type", "result");
            result.addProperty("winner", "");
            result.addProperty("error", 1);
            send(result);
        }
    }

    private DeckCardLists deckList(String path) throws Exception {
        DeckCardLists cached = deckCache.get(path);
        if (cached == null) {
            cached = DeckImporter.importDeckFromFile(path, true);
            deckCache.put(path, cached);
        }
        return cached;
    }

    private Player createAiOpponent(String type, String seat) {
        String name = "Bot" + seat;
        if ("mad".equalsIgnoreCase(type)) {
            return new mage.player.ai.ComputerPlayer7(name, RangeOfInfluence.ONE, 1);
        }
        return new mage.player.ai.ComputerPlayer(name, RangeOfInfluence.ONE);
    }

    String ask(String seat, Game game, String prompt) {
        try {
            send(buildObs(seat, game, prompt));
            BlockingQueue<String> q = queues.get(seatIdx.get(seat));
            String line = q.poll(PROMPT_TIMEOUT_SECS, TimeUnit.SECONDS);
            return line != null ? line : DEFAULT_PASS;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return DEFAULT_PASS;
        }
    }

    private JsonObject buildObs(String seat, Game game, String prompt) {
        JsonObject o = new JsonObject();
        o.addProperty("type", "obs");
        o.addProperty("seat", seat);
        o.addProperty("prompt", prompt);
        o.addProperty("turn", game.getTurnNum());
        o.addProperty("step", game.getTurnStepType().toString());
        o.addProperty("active", seatOf(game.getActivePlayerId()));
        o.addProperty("stack", game.getStack().size());
        o.add("me", playerJson(seat, game, true));
        o.add("op", playerJson(other(seat), game, false));
        // --- training labels (never used as policy input; consumed by aux heads) ---
        o.addProperty("deck", seatDeck.getOrDefault(seat, "?"));
        o.addProperty("opDeck", seatDeck.getOrDefault(other(seat), "?"));
        o.add("opHand", handNames(other(seat), game));
        List<Permanent> meBf = bfList(seat, game);
        List<Permanent> opBf = bfList(other(seat), game);

        if ("priority".equals(prompt)) {
            List<ActivatedAbility> playable = ((RlPlayer) players[seatIdx.get(seat)]).getPlayable(game, true, Zone.ALL, false);
            lastPlayable.put(seat, playable);
            JsonArray acts = new JsonArray();
            for (ActivatedAbility a : playable) {
                JsonObject act = new JsonObject();
                MageObject source = a.getSourceId() != null ? game.getObject(a.getSourceId()) : null;
                act.addProperty("n", source != null ? source.getName() : "");
                act.addProperty("k", a instanceof SpellAbility ? "cast" : "act");
                if (source != null) {
                    act.addProperty("ty", typeMask(source.getCardType(game)));
                    act.addProperty("co", colorMask(source.getColor(game)));
                    act.addProperty("mv", source.getManaValue());
                }
                acts.add(act);
            }
            o.add("acts", acts);
        } else if ("attackers".equals(prompt)) {
            UUID defenderId = opponentIdOf(seat);
            List<Permanent> cands = new ArrayList<>();
            JsonArray candsJson = new JsonArray();
            for (Permanent p : meBf) {
                if (p.isCreature()) {
                    JsonObject c = new JsonObject();
                    c.addProperty("i", cands.size());
                    c.addProperty("can", p.canAttack(defenderId, game) ? 1 : 0);
                    candcFeatures(c, p, game);
                    candsJson.add(c);
                    cands.add(p);
                }
            }
            lastCands.put(seat, cands);
            o.add("cands", candsJson);
        } else if ("blockers".equals(prompt)) {
            Map<UUID, Permanent> opPerm = new HashMap<>();
            for (Permanent p : opBf) {
                opPerm.put(p.getId(), p);
            }
            List<UUID> attackerIds = new ArrayList<>();
            List<Permanent> attackers = new ArrayList<>();
            for (UUID attackerId : game.getCombat().getAttackers()) {
                Permanent attacker = opPerm.get(attackerId);
                if (attacker != null) {
                    attackerIds.add(attackerId);
                    attackers.add(attacker);
                }
            }
            lastAttackerIds.put(seat, attackerIds);
            JsonArray attackersJson = new JsonArray();
            for (int i = 0; i < attackers.size(); i++) {
                attackersJson.add(permJson(game, i, attackers.get(i)));
            }
            o.add("attackers", attackersJson);

            List<Permanent> cands = new ArrayList<>();
            JsonArray candsJson = new JsonArray();
            for (Permanent p : meBf) {
                if (p.isCreature()) {
                    JsonObject c = new JsonObject();
                    c.addProperty("i", cands.size());
                    JsonArray can = new JsonArray();
                    for (int i = 0; i < attackers.size(); i++) {
                        if (p.canBlock(attackerIds.get(i), game)) {
                            can.add(i);
                        }
                    }
                    c.add("cb", can);
                    candcFeatures(c, p, game);
                    candsJson.add(c);
                    cands.add(p);
                }
            }
            lastCands.put(seat, cands);
            o.add("cands", candsJson);
        }
        return o;
    }

    private void candcFeatures(JsonObject c, Permanent p, Game game) {
        c.addProperty("n", p.getName());
        c.addProperty("t", p.isTapped() ? 1 : 0);
        c.addProperty("ty", typeMask(p.getCardType(game)));
        c.addProperty("co", colorMask(p.getColor(game)));
        c.addProperty("mv", p.getManaValue());
        c.addProperty("dmg", p.getDamage());
        c.addProperty("cnt", p.getCounters(game).getTotalCount());
        if (p.isCreature()) {
            c.addProperty("p", p.getPower().getValue());
            c.addProperty("h", p.getToughness().getValue());
        }
    }

    private JsonArray bfJson(String seat, Game game) {
        JsonArray arr = new JsonArray();
        for (Permanent p : bfList(seat, game)) {
            arr.add(permJson(game, -1, p));
        }
        return arr;
    }

    private JsonObject permJson(Game game, int idx, Permanent p) {
        JsonObject c = new JsonObject();
        if (idx >= 0) {
            c.addProperty("i", idx);
        }
        c.addProperty("n", p.getName());
        c.addProperty("t", p.isTapped() ? 1 : 0);
        c.addProperty("ty", typeMask(p.getCardType(game)));
        c.addProperty("co", colorMask(p.getColor(game)));
        c.addProperty("mv", p.getManaValue());
        c.addProperty("dmg", p.getDamage());
        c.addProperty("cnt", p.getCounters(game).getTotalCount());
        if (p.isCreature()) {
            c.addProperty("p", p.getPower().getValue());
            c.addProperty("h", p.getToughness().getValue());
        }
        return c;
    }

    static int typeMask(List<mage.constants.CardType> types) {
        int m = 0;
        for (mage.constants.CardType t : types) {
            int bit = TYPE_BITS.getOrDefault(t, 0);
            m |= bit;
        }
        return m;
    }

    static int colorMask(mage.ObjectColor color) {
        if (color == null) {
            return 0;
        }
        int m = 0;
        if (color.isWhite()) m |= 1;
        if (color.isBlue()) m |= 2;
        if (color.isBlack()) m |= 4;
        if (color.isRed()) m |= 8;
        if (color.isGreen()) m |= 16;
        return m;
    }

    private List<Permanent> bfList(String seat, Game game) {
        Player p = players[seatIdx.get(seat)];
        return new ArrayList<>(game.getBattlefield().getAllActivePermanents(p.getId()));
    }

    private JsonObject playerJson(String seat, Game game, boolean view) {
        Player p = players[seatIdx.get(seat)];
        JsonObject j = new JsonObject();
        j.addProperty("life", p.getLife());
        j.addProperty("lib", p.getLibrary().size());
        if (view) {
            j.add("hand", handNames(seat, game));
        } else {
            j.addProperty("handCount", p.getHand().size());
        }
        JsonArray gy = new JsonArray();
        for (UUID cardId : p.getGraveyard()) {
            Card card = game.getCard(cardId);
            if (card != null) {
                gy.add(card.getName());
            }
        }
        j.add("gy", gy);
        j.add("bf", bfJson(seat, game));
        return j;
    }

    private JsonArray handNames(String seat, Game game) {
        JsonArray hand = new JsonArray();
        for (UUID cardId : players[seatIdx.get(seat)].getHand()) {
            Card card = game.getCard(cardId);
            if (card != null) {
                hand.add(card.getName());
            }
        }
        return hand;
    }

    /** Deck label = file name without directory/extension ("MonoRedBurn"). */
    private static String deckName(String path) {
        String base = path;
        int slash = Math.max(base.lastIndexOf('/'), base.lastIndexOf('\\'));
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        if (base.toLowerCase().endsWith(".dck")) {
            base = base.substring(0, base.length() - 4);
        }
        return base;
    }

    UUID opponentIdOf(String seat) {
        return players[1 - seatIdx.get(seat)].getId();
    }

    List<ActivatedAbility> lastPlayableOf(String seat) {
        return lastPlayable.get(seat);
    }

    List<Permanent> lastCandsOf(String seat) {
        return lastCands.get(seat);
    }

    List<UUID> lastAttackersOf(String seat) {
        return lastAttackerIds.get(seat);
    }

    private String other(String seat) {
        return "A".equals(seat) ? "B" : "A";
    }

    private String seatOf(UUID playerId) {
        for (int i = 0; i < players.length; i++) {
            if (players[i] != null && players[i].getId().equals(playerId)) {
                return i == 0 ? "A" : "B";
            }
        }
        return "?";
    }

    private synchronized void send(JsonObject json) {
        System.out.println(GSON.toJson(json));
        System.out.flush();
    }

    static Integer playIndex(String actionLine) {
        JsonObject a = JsonParser.parseString(actionLine).getAsJsonObject();
        if (a.has("play")) {
            return a.get("play").getAsInt();
        }
        return null;
    }

    static List<Integer> intList(String actionLine, String field) {
        List<Integer> out = new ArrayList<>();
        JsonObject a = JsonParser.parseString(actionLine).getAsJsonObject();
        if (a.has(field)) {
            a.get(field).getAsJsonArray().forEach(e -> out.add(e.getAsInt()));
        }
        return out;
    }

    static List<int[]> pairs(String actionLine) {
        List<int[]> out = new ArrayList<>();
        JsonObject a = JsonParser.parseString(actionLine).getAsJsonObject();
        if (a.has("pairs")) {
            a.get("pairs").getAsJsonArray().forEach(e -> {
                JsonArray pair = e.getAsJsonArray();
                out.add(new int[]{pair.get(0).getAsInt(), pair.get(1).getAsInt()});
            });
        }
        return out;
    }

    private static String str(JsonObject json, String field) {
        return json.has(field) ? json.get(field).getAsString() : null;
    }
}
