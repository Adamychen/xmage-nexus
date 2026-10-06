package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import mage.interfaces.callback.ClientCallback;
import mage.interfaces.callback.ClientCallbackMethod;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CallbackEventsTest {

    private static class Titled {
        String title = "Table";
        String message = "Wrong password";
    }

    private static class Unlabelled {
        String header = "Join";
        String detail = "Table is full";
    }

    @Test
    void anErrorListJoinsItsLines() {
        Object data = new ArrayList<>(Arrays.asList("Error while connecting to server", "Wrong password"));
        assertEquals("Error while connecting to server\nWrong password", CallbackEvents.userMessageText(data));
    }

    @Test
    void anObjectGivesItsMessageField() {
        assertEquals("Wrong password", CallbackEvents.userMessageText(new Titled()));
    }

    @Test
    void anObjectWithoutAMessageFieldGivesTheFieldThatReadsLikeARejection() {
        assertEquals("Table is full", CallbackEvents.userMessageText(new Unlabelled()));
    }

    @Test
    void noDataGivesNoText() {
        assertNull(CallbackEvents.userMessageText(null));
        assertNull(CallbackEvents.userMessageText(new ArrayList<String>()));
    }

    @Test
    void classifiesGameCallbacks() {
        assertTrue(CallbackEvents.isGameRelated(ClientCallbackMethod.START_GAME));
        assertTrue(CallbackEvents.isGameRelated(ClientCallbackMethod.GAME_TARGET));
        assertFalse(CallbackEvents.isGameRelated(ClientCallbackMethod.CHATMESSAGE));
        assertTrue(CallbackEvents.isGamePrompt(ClientCallbackMethod.GAME_SELECT));
        assertFalse(CallbackEvents.isGamePrompt(ClientCallbackMethod.GAME_UPDATE));
        assertTrue(CallbackEvents.isGameUpdate(ClientCallbackMethod.GAME_UPDATE_AND_INFORM));
        assertTrue(CallbackEvents.opensGame(ClientCallbackMethod.GAME_INIT));
        assertTrue(CallbackEvents.endsGame(ClientCallbackMethod.END_GAME_INFO));
    }

    @Test
    void anEventFrameCarriesMethodIdAndObject() {
        UUID game = UUID.randomUUID();
        ClientCallback cb = new ClientCallback(ClientCallbackMethod.GAME_UPDATE, game);
        cb.setMessageId(7);
        JsonObject ev = JsonParser.parseString(CallbackEvents.toEventJson(cb)).getAsJsonObject();
        assertEquals("event", ev.get("type").getAsString());
        assertEquals("GAME_UPDATE", ev.get("method").getAsString());
        assertEquals(7, ev.get("messageId").getAsInt());
        assertEquals(game.toString(), ev.get("objectId").getAsString());
        assertFalse(ev.has("data"));
    }
}
