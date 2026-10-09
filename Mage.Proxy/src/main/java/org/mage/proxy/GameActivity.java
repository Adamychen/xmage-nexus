package org.mage.proxy;

import mage.view.CardView;
import mage.view.CardsView;
import mage.view.CommandObjectView;
import mage.view.GameClientMessage;
import mage.view.GameView;
import mage.view.MutateView;
import mage.view.PermanentView;
import mage.view.PlayerView;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.LongSupplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class GameActivity {

    interface Emitter {
        void emit(String event, String user, String detail);
    }

    static final class Outcome {
        final String result;
        final String cause;

        Outcome(String result, String cause) {
            this.result = result;
            this.cause = cause;
        }
    }

    private static final class Track {
        final String user;
        final String role;
        final long startedAt;
        int turn;
        boolean conceded;

        Track(String user, String role, long startedAt) {
            this.user = user;
            this.role = role;
            this.startedAt = startedAt;
        }
    }

    private final Map<UUID, Track> open = new LinkedHashMap<>();
    private final Emitter emitter;
    private final LongSupplier clock;

    // ── Sonda: daño de comandante ────────────────────────────────────────────────────
    // El daño de comandante no tiene campo en el view: viaja solo en las rules del objeto
    // del comandante (CommanderInfoWatcher → cardState info, una entrada por jugador con el
    // TOTAL acumulado). El cliente web lo parsea para su matriz de daño
    // (web/src/board/commanders.ts) y borraba la columna cuando el objeto caía en una zona
    // invisible (mano rival, biblioteca). Esta sonda vuelca al journal los mismos totales
    // vistos desde el proxy — solo cuando cambian — y marca la desaparición, para poder
    // comparar en producción lo que el wire dice con lo que la web mostró.

    /** Objetos (id, nombre, rules) de un frame: extraídos del GameView por `commanderDamage`.
     *  Clase anidada inmutable, no record: el proxy compila a Java 8. */
    static final class FrameCommander {
        final UUID id;
        final String name;
        final List<String> rules;

        FrameCommander(UUID id, String name, List<String> rules) {
            this.id = id;
            this.name = name;
            this.rules = rules;
        }

        UUID id() { return id; }
        String name() { return name; }
        List<String> rules() { return rules; }
    }

    /** Estado de la sonda por partida abierta. */
    private static final class CommanderState {
        final Map<UUID, String> names = new LinkedHashMap<>();
        /** Último total visto por (comandante, objetivo): el valor del wire es autoritativo
         *  (se reemplaza, no se acumula) — un rollback del motor baja los totales y aquí se ve. */
        final Map<UUID, Map<String, Integer>> totals = new LinkedHashMap<>();
        final Set<UUID> hidden = new LinkedHashSet<>();
        String lastDump = "";
    }

    private final Map<UUID, CommanderState> commanderStates = new LinkedHashMap<>();

    /** true si las rules marcan el objeto como comandante (línea del watcher al principio). */
    static boolean isCommanderRules(List<String> rules) {
        if (rules == null) return false;
        for (String r : rules) {
            if (r != null && r.startsWith("<b>Commander</b>")) return true;
        }
        return false;
    }

    /** Totales de daño de UN comandante desde sus rules: objetivo (en minúsculas) -> total.
     *  Cada frase del watcher empieza con <b>; se parte por ahí para que el casado anclado a
     *  fin de frase sea correcto frase a frase aunque lleguen concatenadas. */
    static Map<String, Integer> parseDamageTotals(List<String> rules) {
        Map<String, Integer> totals = new LinkedHashMap<>();
        if (rules == null) return totals;
        for (String rule : rules) {
            if (rule == null || !rule.contains("combat damage to")) continue;
            for (String sentence : rule.split("(?=<b>)")) {
                String line = TAGS.matcher(sentence).replaceAll(" ");
                Matcher m = DAMAGE_LINE.matcher(line);
                while (m.find()) {
                    String target = unescape(m.group(2)).trim().replaceAll("\\.+$", "").toLowerCase(Locale.ROOT);
                    if (target.isEmpty()) continue;
                    int total = Integer.parseInt(m.group(1));
                    totals.merge(target, total, Math::max);
                }
            }
        }
        return totals;
    }

    private static final Pattern TAGS = Pattern.compile("<[^>]*>");
    private static final Pattern DAMAGE_LINE =
            Pattern.compile("did\\s+(\\d+)\\s+combat damage to(?:\\s+player)?\\s+(.+?)\\s*\\.?\\s*$", Pattern.CASE_INSENSITIVE);

    private static String unescape(String s) {
        return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&apos;", "'");
    }

    /** Punto de entrada desde `trackGame`: extrae los objetos comandante visibles del frame. */
    void commanderDamage(UUID gameId, GameView view) {
        if (gameId == null || view == null || view.getPlayers() == null) return;
        List<FrameCommander> visible = new ArrayList<>();
        for (PlayerView p : view.getPlayers()) {
            if (p.getCommandObjectList() != null) {
                for (CommandObjectView c : p.getCommandObjectList()) {
                    visible.add(new FrameCommander(c.getId(), c.getName(), c.getRules()));
                }
            }
            if (p.getBattlefield() != null) {
                for (PermanentView perm : p.getBattlefield().values()) {
                    visible.add(new FrameCommander(perm.getId(), perm.getName(), perm.getRules()));
                    MutateView mutate = perm.getMutateView();
                    if (mutate != null) {
                        for (CardView hiddenCard : mutate.values()) {
                            visible.add(new FrameCommander(hiddenCard.getId(), hiddenCard.getName(), hiddenCard.getRules()));
                        }
                    }
                }
            }
            for (CardsView zone : new CardsView[]{p.getGraveyard(), p.getExile()}) {
                if (zone == null) continue;
                for (CardView card : zone.values()) {
                    visible.add(new FrameCommander(card.getId(), card.getName(), card.getRules()));
                }
            }
        }
        Track t = open.get(gameId);
        commanderFrame(gameId, t == null ? null : t.user, view.getTurn(), visible);
    }

    /** Máquina de estados de la sonda (pura salvo el emit; testeable sin GameView real). */
    synchronized void commanderFrame(UUID gameId, String user, int turn, List<FrameCommander> visible) {
        CommanderState st = commanderStates.computeIfAbsent(gameId, k -> new CommanderState());
        // sin sesión abierta y sin nada que contar: no retener estado (anti-fuga)
        if (!open.containsKey(gameId) && st.totals.isEmpty() && st.lastDump.isEmpty()) {
            commanderStates.remove(gameId);
            return;
        }
        Set<UUID> visibleIds = new LinkedHashSet<>();
        if (visible != null) {
            for (FrameCommander fc : visible) {
                if (fc.id() == null || !isCommanderRules(fc.rules())) continue;
                visibleIds.add(fc.id());
                if (fc.name() != null) st.names.put(fc.id(), fc.name());
                Map<String, Integer> parsed = parseDamageTotals(fc.rules());
                if (!parsed.isEmpty()) {
                    st.totals.put(fc.id(), parsed);
                } else if (st.totals.containsKey(fc.id())) {
                    // El objeto visible ya no reporta daño (p. ej. tras un rollback): el wire manda.
                    st.totals.remove(fc.id());
                }
            }
        }
        // transición a invisible: comandante con daño que ya no está en ninguna zona visible
        for (Map.Entry<UUID, Map<String, Integer>> e : st.totals.entrySet()) {
            boolean isVisible = visibleIds.contains(e.getKey());
            if (!isVisible && !e.getValue().isEmpty() && st.hidden.add(e.getKey())) {
                emitter.emit("commander_hidden", user, "gameId=" + gameId + " turn=" + turn
                        + " commander=" + st.names.get(e.getKey()) + " totals=" + e.getValue());
            } else if (isVisible) {
                st.hidden.remove(e.getKey());
            }
        }
        String dump = dumpOf(st);
        if (!dump.isEmpty() && !dump.equals(st.lastDump)) {
            st.lastDump = dump;
            emitter.emit("commander_damage", user, "gameId=" + gameId + " turn=" + turn + " " + dump);
        }
    }

    private static String dumpOf(CommanderState st) {
        List<String> parts = new ArrayList<>();
        for (Map.Entry<UUID, Map<String, Integer>> e : st.totals.entrySet()) {
            if (e.getValue().isEmpty()) continue;
            parts.add(st.names.getOrDefault(e.getKey(), e.getKey().toString()) + e.getValue());
        }
        parts.sort(String.CASE_INSENSITIVE_ORDER);
        return String.join("; ", parts);
    }

    private void forgetCommanderState(UUID gameId) {
        commanderStates.remove(gameId);
    }

    GameActivity() {
        this(Activity::game, System::currentTimeMillis);
    }

    GameActivity(Emitter emitter, LongSupplier clock) {
        this.emitter = emitter;
        this.clock = clock;
    }

    synchronized void opened(UUID gameId, String user, boolean watcher) {
        if (gameId == null || user == null || open.containsKey(gameId)) {
            return;
        }
        Track t = new Track(user, watcher ? "watcher" : "player", clock.getAsLong());
        open.put(gameId, t);
        emitter.emit("game_start", user, "gameId=" + gameId + " role=" + t.role);
    }

    synchronized void turn(UUID gameId, int turn) {
        Track t = open.get(gameId);
        if (t != null && turn > t.turn) {
            t.turn = turn;
        }
    }

    synchronized void conceded(UUID gameId) {
        Track t = open.get(gameId);
        if (t != null) {
            t.conceded = true;
        }
    }

    synchronized void ended(UUID gameId, Outcome outcome, int players) {
        Track t = open.remove(gameId);
        if (t != null) {
            end(gameId, t, outcome.result, "finished", outcome.cause, players);
        }
    }

    synchronized void left(UUID gameId) {
        Track t = open.remove(gameId);
        if (t != null) {
            end(gameId, t, "watcher".equals(t.role) ? "watched" : "quit", "left", null, 0);
        }
    }

    synchronized void closeAll(String reason) {
        List<Map.Entry<UUID, Track>> left = new ArrayList<>(open.entrySet());
        open.clear();
        for (Map.Entry<UUID, Track> e : left) {
            end(e.getKey(), e.getValue(), e.getValue().conceded ? "conceded" : "unfinished", reason, null, 0);
        }
    }

    synchronized int openCount() {
        return open.size();
    }

    private void end(UUID gameId, Track t, String result, String reason, String cause, int players) {
        StringBuilder d = new StringBuilder("gameId=").append(gameId)
                .append(" role=").append(t.role)
                .append(" result=").append(result)
                .append(" reason=").append(reason)
                .append(" turns=").append(t.turn)
                .append(" duration_s=").append((clock.getAsLong() - t.startedAt) / 1000);
        if (players > 0) d.append(" players=").append(players);
        if (t.conceded) d.append(" conceded=true");
        if (cause != null) d.append(" cause=").append(cause);
        emitter.emit("game_end", t.user, d.toString());
        forgetCommanderState(gameId);
    }

    static int turnOf(Object data) {
        GameView view = viewOf(data);
        return view == null ? 0 : view.getTurn();
    }

    static GameView viewOf(Object data) {
        if (data instanceof GameView) {
            return (GameView) data;
        }
        if (data instanceof GameClientMessage) {
            return ((GameClientMessage) data).getGameView();
        }
        return null;
    }

    static Outcome outcome(boolean seated, boolean won, String gameInfo, String additionalInfo) {
        String result;
        if (!seated) {
            result = "watched";
        } else if (won) {
            result = "won";
        } else if (gameInfo != null && gameInfo.startsWith("Game is a draw")) {
            result = "draw";
        } else {
            result = "lost";
        }
        return new Outcome(result, seated ? cause(additionalInfo == null ? "" : additionalInfo) : null);
    }

    private static String cause(String info) {
        if (info.contains("You run out of time")) return "timeout";
        if (info.contains("You lost the match for being idle")) return "idle";
        if (info.contains("You have quit the match")) return "quit";
        if (info.contains("runs out of time")) return "opponent_timeout";
        if (info.contains("lost for being idle")) return "opponent_idle";
        if (info.contains("has quit the match")) return "opponent_quit";
        return null;
    }
}
