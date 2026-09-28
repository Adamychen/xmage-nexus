package org.mage.proxy;

import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Date;
import java.util.EnumMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Reflection based JSON serializer for XMage view objects.
 * <p>
 * Safe for the serialized client views (GameView, TableView, cards, choices...):
 * - skips null fields, static/transient fields and technical fields (loggers, Class, Throwable...)
 * - detects object cycles and writes null for re-entered objects
 * - serializes UUID and Enum as strings, dates as epoch millis
 * <p>
 * NOTE: this is a Phase 0 transport format, it mirrors field names of the Java classes 1:1.
 */
public final class JsonUtil {

    private static final ConcurrentMap<Class<?>, Field[]> WRITABLE_FIELDS = new ConcurrentHashMap<>();
    private static final char[] HEX = "0123456789abcdef".toCharArray();

    private JsonUtil() {
    }

    public static String toJson(Object root) {
        // a GameUpdate carries hundreds of views, so this reallocates 4 times per frame otherwise
        StringBuilder sb = new StringBuilder(64 * 1024);
        writeValue(sb, root, new IdentityHashMap<>());
        return sb.toString();
    }

    private static void writeValue(StringBuilder sb, Object obj, IdentityHashMap<Object, Boolean> stack) {
        if (obj == null) {
            sb.append("null");
            return;
        }

        Class<?> clazz = obj.getClass();

        if (obj instanceof Character) {
            writeString(sb, obj.toString());
            return;
        }
        if (obj instanceof CharSequence) {
            writeString(sb, obj.toString());
            return;
        }
        if (obj instanceof Boolean || obj instanceof Byte || obj instanceof Short
                || obj instanceof Integer || obj instanceof Long) {
            sb.append(obj.toString());
            return;
        }
        if (obj instanceof Float || obj instanceof Double) {
            // Double.toString()/Float.toString() de NaN/Infinity producen esos
            // literales sin comillas, que no son JSON válido (JSON.parse los
            // rechaza en el navegador). Ningún campo real es hoy NaN-able en
            // la práctica, pero el serializador genérico no debe poder emitir
            // JSON corrupto si algún campo futuro lo fuera.
            double d = ((Number) obj).doubleValue();
            sb.append(Double.isFinite(d) ? obj.toString() : "null");
            return;
        }
        if (obj instanceof UUID) {
            writeString(sb, obj.toString());
            return;
        }
        if (obj instanceof Enum) {
            writeString(sb, ((Enum) obj).name());
            return;
        }
        if (obj instanceof Date) {
            sb.append(((Date) obj).getTime());
            return;
        }
        if (obj instanceof Optional) {
            Optional opt = (Optional) obj;
            writeValue(sb, opt.isPresent() ? opt.get() : null, stack);
            return;
        }
        if (clazz == Class.class) {
            writeString(sb, ((Class) obj).getName());
            return;
        }
        if (obj instanceof Throwable) {
            writeString(sb, obj.toString());
            return;
        }

        // cycle detection: same instance already on the current serialization path
        if (stack.containsKey(obj)) {
            sb.append("null");
            return;
        }
        stack.put(obj, Boolean.TRUE);

        if (obj instanceof Map) {
            List<Field> ownFields = collectOwnFieldsAboveMapImpl(clazz);
            if (ownFields.isEmpty()) {
                writeMap(sb, (Map) obj, stack);
            } else {
                // Real XMage view classes like ExileView/MutateView (Mage.Common)
                // extend CardsView (-> LinkedHashMap<UUID, CardView>) AND declare
                // their own fields (name, id). Without this branch those fields
                // are silently dropped: `obj instanceof Map` alone would route
                // here via writeMap(), which only walks map entries and never
                // reaches the reflection loop below that reads declared fields.
                // Wrap: own fields stay at the top level, map entries move under
                // "cards" (mirrors the sibling POJOs RevealedView/LookedAtView,
                // which already expose a `cards` field the same way).
                writeMapWithOwnFields(sb, obj, (Map) obj, ownFields, stack);
            }
        } else if (obj instanceof Iterable) {
            writeIterable(sb, (Iterable) obj, stack);
        } else if (clazz.isArray()) {
            sb.append('[');
            int len = Array.getLength(obj);
            for (int i = 0; i < len; i++) {
                if (i > 0) {
                    sb.append(',');
                }
                writeValue(sb, Array.get(obj, i), stack);
            }
            sb.append(']');
        } else {
            writeObject(sb, obj, stack);
        }

        stack.remove(obj);
    }

    private static void writeMap(StringBuilder sb, Map<?, ?> map, IdentityHashMap<Object, Boolean> stack) {
        sb.append('{');
        boolean first = true;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, String.valueOf(entry.getKey()));
            sb.append(':');
            writeValue(sb, entry.getValue(), stack);
        }
        sb.append('}');
    }

    /**
     * Fields declared by obj's own class hierarchy above the terminal java.*
     * Map implementation (e.g. ExileView/MutateView declare `name`/`id` on
     * top of extending CardsView -> LinkedHashMap; a plain CardsView with no
     * such subclass returns an empty list, keeping the old flat behavior).
     */
    private static List<Field> collectOwnFieldsAboveMapImpl(Class<?> clazz) {
        List<Field> result = new ArrayList<>();
        for (Class<?> c = clazz; c != null && Map.class.isAssignableFrom(c); c = c.getSuperclass()) {
            Package pkg = c.getPackage();
            if (pkg != null && (pkg.getName().startsWith("java.") || pkg.getName().startsWith("javax."))) {
                break;
            }
            for (Field field : c.getDeclaredFields()) {
                if (isWritableField(field)) {
                    result.add(field);
                }
            }
        }
        return result;
    }

    private static void writeMapWithOwnFields(StringBuilder sb, Object obj, Map<?, ?> map, List<Field> ownFields, IdentityHashMap<Object, Boolean> stack) {
        sb.append('{');
        boolean first = true;
        for (Field field : ownFields) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, field.getName());
            sb.append(':');
            try {
                if (!field.isAccessible()) {
                    field.setAccessible(true);
                }
                writeValue(sb, field.get(obj), stack);
            } catch (Exception e) {
                sb.append("null");
            }
        }
        if (!first) {
            sb.append(',');
        }
        writeString(sb, "cards");
        sb.append(':');
        writeMap(sb, map, stack);
        sb.append('}');
    }

    private static void writeIterable(StringBuilder sb, Iterable<?> iterable, IdentityHashMap<Object, Boolean> stack) {
        sb.append('[');
        boolean first = true;
        for (Object item : iterable) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeValue(sb, item, stack);
        }
        sb.append(']');
    }

    private static void writeObject(StringBuilder sb, Object obj, IdentityHashMap<Object, Boolean> stack) {
        sb.append('{');
        boolean first = true;
        for (Field field : writableFields(obj.getClass())) {
            if (!first) {
                sb.append(',');
            }
            first = false;
            writeString(sb, field.getName());
            sb.append(':');
            try {
                writeValue(sb, field.get(obj), stack);
            } catch (Exception e) {
                sb.append("null");
            }
        }
        sb.append('}');
    }

    /**
     * The writable fields of a class and of its superclasses, resolved once.
     *
     * <p>This is the hot loop of the proxy: a single {@code GAME_UPDATE} walks a thousand views, so
     * re-running {@code getDeclaredFields()} plus a dozen string comparisons per field, for every
     * object, on every event, was the bulk of the garbage the callback thread had to keep up with.
     * The filter only depends on the class, so the answer cannot change between calls.
     */
    private static Field[] writableFields(Class<?> type) {
        Field[] cached = WRITABLE_FIELDS.get(type);
        if (cached != null) {
            return cached;
        }
        List<Field> out = new ArrayList<>();
        for (Class<?> clazz = type; clazz != null && clazz != Object.class; clazz = clazz.getSuperclass()) {
            for (Field field : clazz.getDeclaredFields()) {
                if (!isWritableField(field)) {
                    continue;
                }
                try {
                    field.setAccessible(true);
                } catch (RuntimeException ex) {
                    // a module-protected field: read it reflectively and it will fail per value,
                    // which writeObject already turns into null
                    continue;
                }
                out.add(field);
            }
        }
        Field[] result = out.toArray(new Field[0]);
        Field[] raced = WRITABLE_FIELDS.putIfAbsent(type, result);
        return raced != null ? raced : result;
    }

    private static boolean isWritableField(Field field) {
        int mod = field.getModifiers();
        if (Modifier.isStatic(mod) || Modifier.isTransient(mod)) {
            return false;
        }
        String name = field.getName();
        if (name.equals("serialVersionUID") || name.equals("$assertionsDisabled")) {
            return false;
        }
        if (name.equals("logger") || name.equals("log") || name.equals("LOGGER")) {
            return false;
        }
        Class<?> type = field.getType();
        if (type == Class.class || type == Thread.class || type == java.util.logging.Logger.class
                || type == org.apache.log4j.Logger.class || type == StackTraceElement.class
                || type == Throwable.class) {
            return false;
        }
        String typeName = type.getName();
        if (typeName.startsWith("java.lang.reflect.") || typeName.startsWith("sun.reflect.")
                || typeName.startsWith("java.util.concurrent.")
                || typeName.equals("java.lang.Class")) {
            return false;
        }
        return true;
    }

    private static void writeString(StringBuilder sb, String value) {
        if (value == null) {
            sb.append("null");
            return;
        }
        sb.append('"');
        int len = value.length();
        for (int i = 0; i < len; i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                default:
                    if (c < 0x20) {
                        // String.format per control character re-parsed the format every time
                        sb.append("\\u")
                                .append(HEX[(c >> 12) & 0xf])
                                .append(HEX[(c >> 8) & 0xf])
                                .append(HEX[(c >> 4) & 0xf])
                                .append(HEX[c & 0xf]);
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }
}
