package org.mage.proxy;

import mage.players.net.UserData;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

class UserAppearanceTest {

    private static UserData prefs() {
        UserData prefs = UserData.getDefaultUserDataView();
        prefs.setFlagName("es.png");
        prefs.setAvatarId(42);
        prefs.setAllowRequestShowHandCards(true);
        prefs.setConfirmEmptyManaPool(false);
        return prefs;
    }

    @Test
    void theTokenTravelsAndEveryOtherPreferenceSurvivesTheCopy() {
        UserData out = UserAppearance.withAppearance(prefs(), "nxs1;slv=nebula");
        assertEquals("es.png", out.getFlagName());
        assertEquals(42, out.getAvatarId());
        assertTrue(out.isAllowRequestHandToAll());
        assertFalse(out.confirmEmptyManaPool());
    }

    @Test
    void nothingToCarryLeavesThePreferencesAlone() {
        UserData in = prefs();
        assertSame(in, UserAppearance.withAppearance(in, null));
        assertSame(in, UserAppearance.withAppearance(in, ""));
    }

    @Test
    void onlyShortPlainTokensAreForwarded() {
        assertTrue(UserAppearance.isForwardable("nxs1;slv=nebula"));
        assertFalse(UserAppearance.isForwardable("nxs1;slv=\"quoted\""));
        assertFalse(UserAppearance.isForwardable("nxs1;slv=a b"));
        assertFalse(UserAppearance.isForwardable("data:image/jpeg;base64,/9j/4AAQ".repeat(10)));
    }
}
