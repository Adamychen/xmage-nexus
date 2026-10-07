package org.mage.proxy;

import mage.view.GameClientMessage;
import mage.view.GameView;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.LongSupplier;

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
    }

    static int turnOf(Object data) {
        GameView view = null;
        if (data instanceof GameView) {
            view = (GameView) data;
        } else if (data instanceof GameClientMessage) {
            view = ((GameClientMessage) data).getGameView();
        }
        return view == null ? 0 : view.getTurn();
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
