package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** Stateless helpers that classify server callbacks and turn them into web events. */
final class CallbackEvents {

    private CallbackEvents() {
    }

    static boolean isGameUpdate(ClientCallbackMethod m) {
        return m == ClientCallbackMethod.GAME_UPDATE || m == ClientCallbackMethod.GAME_UPDATE_AND_INFORM;
    }

    static boolean isGameRelated(ClientCallbackMethod method) {
        if (method == ClientCallbackMethod.START_GAME
                || method == ClientCallbackMethod.WATCHGAME
                || method == ClientCallbackMethod.END_GAME_INFO) {
            return true;
        }
        return method.name().startsWith("GAME_");
    }

    /** The callbacks that make a game this session's own (see {@link SessionGames}). */
    static boolean opensGame(ClientCallbackMethod m) {
        return m == ClientCallbackMethod.WATCHGAME
                || m == ClientCallbackMethod.START_GAME
                || m == ClientCallbackMethod.GAME_INIT;
    }

    static boolean endsGame(ClientCallbackMethod m) {
        return m == ClientCallbackMethod.GAME_OVER || m == ClientCallbackMethod.END_GAME_INFO;
    }

    static boolean isGamePrompt(ClientCallbackMethod method) {
        switch (method) {
            case GAME_ASK:
            case GAME_TARGET:
            case GAME_CHOOSE_ABILITY:
            case GAME_CHOOSE_PILE:
            case GAME_CHOOSE_CHOICE:
            case GAME_SELECT:
            case GAME_PLAY_MANA:
            case GAME_PLAY_XMANA:
            case GAME_GET_AMOUNT:
            case GAME_GET_MULTI_AMOUNT:
                return true;
            default:
                return false;
        }
    }

    /** The {@code event} frame for a callback whose data is already decompressed. */
    static String toEventJson(ClientCallback callback) {
        UUID objectId = callback.getObjectId();
        JsonObject ev = new JsonObject();
        ev.addProperty("type", "event");
        ev.addProperty("method", callback.getMethod().name());
        ev.addProperty("messageId", callback.getMessageId());
        if (objectId != null) {
            ev.addProperty("objectId", objectId.toString());
        }
        Object data = callback.getData();
        if (data != null) {
            JsonElement dataJson = JsonParser.parseString(JsonUtil.toJson(data));
            // El ChatMessage del servidor no trae su chatId (viaja en el objectId
            // del callback): inyectarlo para cumplir el contrato ChatMessageEvent.
            if (callback.getMethod() == ClientCallbackMethod.CHATMESSAGE
                    && objectId != null
                    && dataJson.isJsonObject()
                    && !dataJson.getAsJsonObject().has("chatId")) {
                dataJson.getAsJsonObject().addProperty("chatId", objectId.toString());
            }
            ev.add("data", dataJson);
        }
        return ev.toString();
    }

    /**
     * The human-readable text of a {@code SHOW_USERMESSAGE} payload, or {@code null}. The server
     * sends either a {@code List<String>} ({@code sendErrorMessageToClient}: a title and the
     * detail) or a view object whose message field name varies.
     */
    static String userMessageText(Object data) {
        if (data == null) {
            return null;
        }
        String json = JsonUtil.toJson(data);
        JsonElement el = JsonParser.parseString(json);
        String extracted = null;
        if (el.isJsonArray()) {
            // sendErrorMessageToClient manda List<String>: ["Error while connecting to server", detalle]
            StringBuilder sb = new StringBuilder();
            for (JsonElement item : el.getAsJsonArray()) {
                if (item.isJsonPrimitive()) {
                    if (sb.length() > 0) sb.append('\n');
                    sb.append(item.getAsString());
                }
            }
            extracted = sb.length() > 0 ? sb.toString() : null;
        } else if (el.isJsonObject()) {
            JsonObject o = el.getAsJsonObject();
            if (o.has("message") && o.get("message").isJsonPrimitive()) extracted = o.get("message").getAsString();
            else if (o.has("Message") && o.get("Message").isJsonPrimitive()) extracted = o.get("Message").getAsString();
            if (extracted == null || extracted.isEmpty()) {
                for (Map.Entry<String, JsonElement> e : o.entrySet()) {
                    if (!e.getValue().isJsonPrimitive()) continue;
                    String v = e.getValue().getAsString().toLowerCase(Locale.ROOT);
                    if (looksLikeRejection(v)) {
                        extracted = e.getValue().getAsString();
                        break;
                    }
                }
            }
            if (extracted == null && o.has("text") && o.get("text").isJsonPrimitive()) extracted = o.get("text").getAsString();
            if (extracted == null && json.length() < 2000) extracted = json;
        }
        return extracted == null || extracted.isEmpty() ? null : extracted;
    }

    private static boolean looksLikeRejection(String v) {
        return v.contains("card not found") || v.contains("quit ratio") || v.contains("invalid deck") || v.contains("rating") || v.contains("not started") || v.contains("no valid deck") || v.contains("must contain") || v.contains("too few")
                || v.contains("too powerful") || v.contains("power level") || v.contains("requested no") || v.contains("appropriate for the selected format") || v.contains("select a deck") || v.contains("player can't join") || v.contains("could not create player")
                || v.contains("no available seats") || v.contains("table is full") || v.contains("can join a table only") || v.contains("wrong password");
    }
}
