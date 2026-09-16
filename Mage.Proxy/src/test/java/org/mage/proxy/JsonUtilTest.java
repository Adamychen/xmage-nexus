package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JsonUtilTest {

    private enum Kind {
        SAMPLE
    }

    private static class Sample {
        private String text = "line\nquote\"";
        private UUID id = UUID.fromString("123e4567-e89b-12d3-a456-426614174000");
        private Kind kind = Kind.SAMPLE;
        private Date date = new Date(1234L);
        private Optional<String> present = Optional.of("yes");
        private Optional<String> empty = Optional.empty();
        private Map<String, Object> map = new LinkedHashMap<>();
        private Sample cycle;
        private transient String transientValue = "hidden";
        private static String staticValue = "hidden";

        private Sample() {
            map.put("items", Arrays.asList("a", "b"));
        }
    }

    @Test
    void serializesSupportedValuesAndSkipsTechnicalFields() {
        Sample sample = new Sample();
        sample.cycle = sample;

        JsonObject json = JsonParser.parseString(JsonUtil.toJson(sample)).getAsJsonObject();

        assertEquals("line\nquote\"", json.get("text").getAsString());
        assertEquals("123e4567-e89b-12d3-a456-426614174000", json.get("id").getAsString());
        assertEquals("SAMPLE", json.get("kind").getAsString());
        assertEquals(1234L, json.get("date").getAsLong());
        assertEquals("yes", json.get("present").getAsString());
        assertTrue(json.get("empty").isJsonNull());
        assertEquals(2, json.getAsJsonObject("map").getAsJsonArray("items").size());
        assertTrue(json.get("cycle").isJsonNull());
        assertTrue(!json.has("transientValue"));
        assertTrue(!json.has("staticValue"));
    }

    // -------------------------------------------------------------------
    // P5 (auditoría de fidelidad, 2026-09-16): mage.view.ExileView y
    // mage.view.MutateView (Mage.Common) extienden CardsView, que a su vez
    // extiende LinkedHashMap<UUID, CardView>, y le añaden sus PROPIOS campos
    // declarados (`name`, `id`). writeValue() trataba cualquier objeto que
    // fuera `instanceof Map` tomando la rama writeMap() sin llegar nunca a
    // la reflexión de writeObject() — esos campos propios se descartaban en
    // silencio. Fix: si la clase declara campos propios por encima de la
    // implementación de Map, las entradas del mapa se anidan bajo "cards" y
    // esos campos quedan al nivel superior — igual que sus primas POJO
    // RevealedView/LookedAtView (que sí exponían `cards` como campo propio
    // en vez de heredarlo, y por eso nunca tuvieron este problema).
    //
    // Consumidores reales corregidos con esto: web/src/board/boardShared.ts
    // y web/src/board/crossZone.ts (leían `exile.cards`/`exile.name` sobre
    // GameView.exiles, que antes del fix jamás existían) y el punto ciego de
    // web/src/system/fidelity.ts con cartas exiliadas. BoardZone.tsx y
    // deckTracker.ts leían `mutateView` como mapa plano (funcionaba por
    // coincidencia) y se actualizan a `mutateView.cards` en el mismo cambio.

    /** Reproduce la forma real de ExileView/MutateView: Map + campos propios. */
    private static class MapWithOwnFields extends LinkedHashMap<String, String> {
        private final String name = "Suspended cards";
        private final UUID id = UUID.fromString("00000000-0000-0000-0000-000000000001");

        MapWithOwnFields() {
            put("card-uuid-1", "Rift Bolt");
        }
    }

    @Test
    void mapSubclassOwnFieldsAreKeptAlongsideEntriesNestedUnderCards() {
        JsonObject json = JsonParser.parseString(JsonUtil.toJson(new MapWithOwnFields())).getAsJsonObject();

        assertEquals("Suspended cards", json.get("name").getAsString());
        assertEquals("00000000-0000-0000-0000-000000000001", json.get("id").getAsString());
        assertEquals("Rift Bolt", json.getAsJsonObject("cards").get("card-uuid-1").getAsString());
        // las entradas del mapa ya NO viven sueltas al nivel superior
        assertTrue(!json.has("card-uuid-1"));
    }

    /** Regresión: un Map-subclass SIN campos propios (CardsView normal: hand,
     *  battlefield, graveyard...) debe seguir siendo un mapa plano — sin el
     *  envoltorio "cards" que solo aplica cuando hay campos propios que
     *  rescatar. */
    @Test
    void plainMapSubclassWithoutOwnFieldsStaysFlat() {
        LinkedHashMap<String, String> plain = new LinkedHashMap<>();
        plain.put("card-uuid-2", "Forest");

        JsonObject json = JsonParser.parseString(JsonUtil.toJson(plain)).getAsJsonObject();

        assertEquals("Forest", json.get("card-uuid-2").getAsString());
        assertEquals(1, json.size());
    }

    @Test
    void emptyMapSubclassWithOwnFieldsStillExposesThem() {
        // ExileView/MutateView vacíos (sin cartas) son el caso más común en
        // la práctica: name/id deben seguir presentes, cards debe ser {}.
        class Empty extends LinkedHashMap<String, String> {
            private final String name = "Plots of Alice";
        }
        JsonObject json = JsonParser.parseString(JsonUtil.toJson(new Empty())).getAsJsonObject();
        assertEquals("Plots of Alice", json.get("name").getAsString());
        assertEquals(0, json.getAsJsonObject("cards").size());
    }

    // -------------------------------------------------------------------
    // P5: robustez de valores numéricos no finitos. Double.toString()/
    // Float.toString() para NaN/Infinity producían esos literales sin
    // comillas, que no son JSON válido (JSON.parse los rechaza en el
    // navegador). Fix: se serializan como null. Ningún campo real de
    // GameView es hoy NaN-able en la práctica (solo
    // UserRequestMessage.windowSizeRatio es double en todo Mage.Common/view)
    // pero el serializador genérico no debe poder emitir JSON corrupto si
    // algún campo futuro lo fuera.
    private static class NonFiniteSample {
        private final double nan = Double.NaN;
        private final double posInf = Double.POSITIVE_INFINITY;
        private final float negInfFloat = Float.NEGATIVE_INFINITY;
        private final double normal = 1.5;
    }

    @Test
    void nonFiniteFloatingPointFieldsSerializeAsNull() {
        JsonObject json = JsonParser.parseString(JsonUtil.toJson(new NonFiniteSample())).getAsJsonObject();
        assertTrue(json.get("nan").isJsonNull());
        assertTrue(json.get("posInf").isJsonNull());
        assertTrue(json.get("negInfFloat").isJsonNull());
        assertEquals(1.5, json.get("normal").getAsDouble());
    }
}
