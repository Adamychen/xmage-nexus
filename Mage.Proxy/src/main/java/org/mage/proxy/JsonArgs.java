package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Lectura defensiva de argumentos JSON de comandos. */
final class JsonArgs {

    private JsonArgs() {
    }

    static String str(JsonObject args, String key, String defaultValue) {
        return args.has(key) && args.get(key).isJsonPrimitive() ? args.get(key).getAsString() : defaultValue;
    }

    static int getInt(JsonObject args, String key, int defaultValue) {
        return args.has(key) && args.get(key).isJsonPrimitive() ? args.get(key).getAsInt() : defaultValue;
    }

    static boolean getBool(JsonObject args, String key, boolean defaultValue) {
        return args.has(key) && args.get(key).isJsonPrimitive() ? args.get(key).getAsBoolean() : defaultValue;
    }

    static UUID uuid(JsonObject args, String key, UUID defaultValue) {
        String value = str(args, key, null);
        if (value == null || value.isEmpty()) {
            return defaultValue;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return defaultValue;
        }
    }

    static Object parseActionData(JsonElement data) {
        return parseActionData(data, "");
    }

    static Object parseActionData(JsonElement data, String action) {
        Object parsed = parseActionDataValue(data);
        if (parsed instanceof String && action != null && (action.startsWith("TRIGGER_AUTO_ORDER_ABILITY_") || isUuidDataAction(action))) {
            try {
                return UUID.fromString((String) parsed);
            } catch (IllegalArgumentException ex) {
                return parsed;
            }
        }
        return parsed;
    }

    /** Acciones cuyo `data` es un UUID en el servidor (GameController exige `data instanceof UUID`). */
    private static boolean isUuidDataAction(String action) {
        return "REQUEST_PERMISSION_TO_SEE_HAND_CARDS".equals(action)
                || "ADD_PERMISSION_TO_SEE_HAND_CARDS".equals(action)
                || "VIEW_SIDEBOARD".equals(action)
                || "VIEW_LIMITED_DECK".equals(action);
    }

    private static Object parseActionDataValue(JsonElement data) {
        if (data == null || data.isJsonNull()) {
            return null;
        }
        if (data.isJsonPrimitive()) {
            com.google.gson.JsonPrimitive prim = data.getAsJsonPrimitive();
            if (prim.isBoolean()) {
                return prim.getAsBoolean();
            }
            if (prim.isNumber()) {
                return prim.getAsInt();
            }
            return prim.getAsString();
        }
        return data.toString();
    }

    /** Mapa zona → nombres de carta ({hand:[...], battlefield:[...]}), o null si malformado. */
    static Map<String, List<String>> stringListMap(JsonObject obj) {
        if (obj == null || !obj.isJsonObject()) {
            return null;
        }
        Map<String, List<String>> out = new LinkedHashMap<>();
        for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
            if (entry.getValue() == null || !entry.getValue().isJsonArray()) {
                return null;
            }
            List<String> names = new ArrayList<>();
            for (JsonElement el : entry.getValue().getAsJsonArray()) {
                if (!el.isJsonPrimitive() || !el.getAsJsonPrimitive().isString()) {
                    return null;
                }
                names.add(el.getAsString());
            }
            out.put(entry.getKey(), names);
        }
        return out;
    }
}
