package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Códigos de error uniformes y sobre de respuesta del protocolo JSON.
 */
final class ProxyProtocol {

    static final String ERR_BAD_JSON = "BAD_JSON";
    static final String ERR_NOT_AUTHORIZED = "NOT_AUTHORIZED";
    static final String ERR_GAME_ID_REQUIRED = "GAME_ID_REQUIRED";
    static final String ERR_INVALID_ARGUMENT = "INVALID_ARGUMENT";
    static final String ERR_UNKNOWN_ACTION = "UNKNOWN_ACTION";
    static final String ERR_FAILED = "FAILED";
    static final String ERR_QUIT_RATIO = "QUIT_RATIO";
    static final String ERR_RATING = "RATING";
    static final String ERR_INVALID_DECK = "INVALID_DECK";
    static final String ERR_CARD_NOT_FOUND = "CARD_NOT_FOUND";
    static final String ERR_TABLE_LIMIT = "TABLE_LIMIT";
    static final String ERR_INVALID_GAME_TYPE = "INVALID_GAME_TYPE";
    static final String ERR_INVALID_DECK_TYPE = "INVALID_DECK_TYPE";
    static final String ERR_PASSWORD = "PASSWORD";
    static final String ERR_SEAT = "SEAT";

    private ProxyProtocol() {
    }

    static String resultJson(String action, String requestId, boolean ok, String errorCode, Object data) {
        JsonObject res = new JsonObject();
        res.addProperty("type", "result");
        res.addProperty("action", action);
        res.addProperty("requestId", requestId == null ? "" : requestId);
        res.addProperty("ok", ok);
        if (errorCode != null) {
            res.addProperty("errorCode", errorCode);
        }
        if (!ok) {
            if (data instanceof String) {
                res.addProperty("error", (String) data);
            } else if (data != null) {
                res.addProperty("error", JsonUtil.toJson(data));
            } else {
                res.addProperty("error", errorCode == null ? "Command failed" : errorCode);
            }
        } else if (data != null) {
            if (data instanceof JsonElement) {
                res.add("data", (JsonElement) data);
            } else if (data instanceof String) {
                res.addProperty("data", (String) data);
            } else {
                res.add("data", JsonParser.parseString(JsonUtil.toJson(data)));
            }
        }
        return res.toString();
    }

    /** Compat: usado por el auto-connect de arranque (sin requestId). */
    static String resultJson(String action, boolean ok, Object data) {
        return resultJson(action, "", ok, ok ? null : ERR_FAILED, data);
    }
}
