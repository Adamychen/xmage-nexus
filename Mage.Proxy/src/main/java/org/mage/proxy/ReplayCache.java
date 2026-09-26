package org.mage.proxy;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Latest state and pending prompt of every game of a session, replayed to a connection that
 * (re)joins the game. The prompt stays cached until the player answers it or the game ends: the
 * server keeps sending state updates while a prompt is open, and dropping the prompt on those
 * left a re-attached player looking at "waiting for the opponent" on their own turn.
 */
final class ReplayCache {

    static final class Prompt {
        final String method;
        final String json;

        Prompt(String method, String json) {
            this.method = method;
            this.json = json;
        }
    }

    private final ConcurrentMap<UUID, String> states = new ConcurrentHashMap<>();
    private final ConcurrentMap<UUID, Prompt> prompts = new ConcurrentHashMap<>();

    void onState(UUID gameId, String json, boolean init) {
        states.put(gameId, json);
        if (init) {
            // a (re)initialised game re-asks whatever it still waits for
            prompts.remove(gameId);
        }
    }

    void onPrompt(UUID gameId, String method, String json) {
        prompts.put(gameId, new Prompt(method, json));
    }

    void onGameEnded(UUID gameId) {
        prompts.remove(gameId);
    }

    /** The player is answering: the cached prompt is taken out before the answer is sent. */
    Prompt takePrompt(UUID gameId) {
        return gameId == null ? null : prompts.remove(gameId);
    }

    /** Only a GAME_SELECT is answered by a priority pass. */
    Prompt takePromptIfSelect(UUID gameId) {
        if (gameId == null) {
            return null;
        }
        Prompt p = prompts.get(gameId);
        if (p != null && "GAME_SELECT".equals(p.method) && prompts.remove(gameId, p)) {
            return p;
        }
        return null;
    }

    /** The answer was rejected: the prompt is still open unless a newer one arrived meanwhile. */
    void restorePrompt(UUID gameId, Prompt prompt) {
        if (gameId != null && prompt != null) {
            prompts.putIfAbsent(gameId, prompt);
        }
    }

    List<String> replay(UUID gameId) {
        List<String> out = new ArrayList<>(2);
        String state = states.get(gameId);
        if (state != null) {
            out.add(state);
        }
        Prompt prompt = prompts.get(gameId);
        if (prompt != null) {
            out.add(prompt.json);
        }
        return out;
    }

    void clear() {
        states.clear();
        prompts.clear();
    }
}
