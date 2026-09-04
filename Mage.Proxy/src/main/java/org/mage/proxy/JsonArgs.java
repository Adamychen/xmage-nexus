package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

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
}
