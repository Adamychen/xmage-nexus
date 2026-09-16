package org.mage.proxy;

import com.google.gson.JsonParser;
import mage.players.net.UserData;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameCommandsTest {

    @Test
    void updatePreferencesKeepsConfirmEmptyManaPoolByDefault() {
        UserData userData = GameCommands.userDataFromPreferences(JsonParser.parseString("{}").getAsJsonObject());
        assertTrue(userData.confirmEmptyManaPool());
    }

    @Test
    void updatePreferencesDisablesConfirmEmptyManaPool() {
        UserData userData = GameCommands.userDataFromPreferences(
                JsonParser.parseString("{\"confirmEmptyManaPool\":false}").getAsJsonObject());
        assertFalse(userData.confirmEmptyManaPool());
    }

    @Test
    void updatePreferencesEnablesConfirmEmptyManaPool() {
        UserData userData = GameCommands.userDataFromPreferences(
                JsonParser.parseString("{\"confirmEmptyManaPool\":true,\"phases\":{}}").getAsJsonObject());
        assertTrue(userData.confirmEmptyManaPool());
    }

    @Test
    void cheatSetupParsesZoneMap() {
        java.util.Map<String, java.util.List<String>> zones = JsonArgs.stringListMap(JsonParser.parseString(
                "{\"hand\":[\"Counterspell\"],\"battlefield\":[\"Island\",\"Island\"]}").getAsJsonObject());
        assertTrue(zones != null && zones.get("hand").size() == 1 && zones.get("battlefield").size() == 2);
    }

    @Test
    void cheatSetupRejectsMalformedZones() {
        assertTrue(JsonArgs.stringListMap(JsonParser.parseString("{\"hand\":\"Counterspell\"}").getAsJsonObject()) == null);
        assertTrue(JsonArgs.stringListMap(JsonParser.parseString("{\"hand\":[42]}").getAsJsonObject()) == null);
        assertTrue(JsonArgs.stringListMap(null) == null);
    }
}
