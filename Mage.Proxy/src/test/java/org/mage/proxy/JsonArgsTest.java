package org.mage.proxy;

import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JsonArgsTest {

    @Test
    void triggerAbilityActionConvertsUuidStringToUuid() {
        String id = "123e4567-e89b-12d3-a456-426614174000";
        Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"" + id + "\""), "TRIGGER_AUTO_ORDER_ABILITY_FIRST");
        assertTrue(parsed instanceof UUID);
        assertEquals(UUID.fromString(id), parsed);
    }

    @Test
    void triggerAbilityActionKeepsNonUuidString() {
        Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"not-a-uuid\""), "TRIGGER_AUTO_ORDER_ABILITY_LAST");
        assertEquals("not-a-uuid", parsed);
    }

    @Test
    void triggerNameActionKeepsRuleTextAsString() {
        Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"Whenever another creature enters\""), "TRIGGER_AUTO_ORDER_NAME_FIRST");
        assertEquals("Whenever another creature enters", parsed);
    }

    @Test
    void otherActionsKeepStringData() {
        Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"special\""), "PASS_PRIORITY_UNTIL_STACK_RESOLVED");
        assertEquals("special", parsed);
    }

    @Test
    void nullDataStaysNull() {
        assertNull(JsonArgs.parseActionData(null, "TRIGGER_AUTO_ORDER_ABILITY_FIRST"));
    }

    @Test
    void handPermissionActionsConvertUuidStringToUuid() {
        String id = "123e4567-e89b-12d3-a456-426614174000";
        for (String action : new String[]{
                "REQUEST_PERMISSION_TO_SEE_HAND_CARDS",
                "ADD_PERMISSION_TO_SEE_HAND_CARDS",
                "VIEW_SIDEBOARD",
                "VIEW_LIMITED_DECK"}) {
            Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"" + id + "\""), action);
            assertTrue(parsed instanceof UUID, action);
            assertEquals(UUID.fromString(id), parsed);
        }
    }

    @Test
    void handPermissionActionsKeepNonUuidString() {
        Object parsed = JsonArgs.parseActionData(JsonParser.parseString("\"not-a-uuid\""), "REQUEST_PERMISSION_TO_SEE_HAND_CARDS");
        assertEquals("not-a-uuid", parsed);
    }

    @Test
    void handPermissionNullDataStaysNull() {
        assertNull(JsonArgs.parseActionData(null, "VIEW_SIDEBOARD"));
    }
}
