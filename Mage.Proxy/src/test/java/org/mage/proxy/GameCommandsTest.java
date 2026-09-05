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
}
