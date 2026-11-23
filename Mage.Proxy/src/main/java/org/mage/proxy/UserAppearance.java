package org.mage.proxy;

import mage.players.net.UserData;
import mage.players.net.UserGroup;

/**
 * The appearance a player declares to the rest of the table (APR-6).
 *
 * XMage carries no appearance of its own, so the token travels in {@code userIdStr}, the one
 * free string of {@link UserData}: the server copies it verbatim and puts the whole object in
 * every {@code PlayerView}, which is how the avatar and the flag already reach other clients.
 * The token is opaque here, the catalogue of sleeves lives in the web client; this class only
 * decides whether a string is safe to forward and gets it into an object that has no setter
 * for that field.
 */
final class UserAppearance {

    /** The token rides in every game view, for every player, so it stays short. */
    static final int MAX_LENGTH = 120;

    private UserAppearance() {
    }

    /** Whether the token is one the proxy forwards: short, and `key=value;key=value` at most. */
    static boolean isForwardable(String appearance) {
        if (appearance == null || appearance.isEmpty() || appearance.length() > MAX_LENGTH) {
            return false;
        }
        for (int i = 0; i < appearance.length(); i++) {
            char c = appearance.charAt(i);
            boolean allowed = (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
                    || c == '=' || c == ';' || c == '-' || c == '_' || c == '.';
            if (!allowed) {
                return false;
            }
        }
        return true;
    }

    /**
     * A copy of {@code prefs} carrying the token, or {@code prefs} itself when there is nothing
     * to carry. {@code UserData} exposes no setter for {@code userIdStr}, so its constructor is
     * the only way in; every other field is copied from {@code prefs}, which the caller built
     * from this client's own preferences and connection.
     */
    static UserData withAppearance(UserData prefs, String appearance) {
        if (prefs == null || !isForwardable(appearance)) {
            return prefs;
        }
        UserData out = new UserData(
                UserGroup.DEFAULT,
                prefs.getAvatarId(),
                prefs.isAllowRequestHandToAll(),
                prefs.confirmEmptyManaPool(),
                prefs.getUserSkipPrioritySteps(),
                prefs.getFlagName(),
                prefs.askMoveToGraveOrder(),
                prefs.isManaPoolAutomatic(),
                prefs.isManaPoolAutomaticRestricted(),
                prefs.isPassPriorityCast(),
                prefs.isPassPriorityActivation(),
                prefs.isAutoOrderTrigger(),
                prefs.getAutoTargetLevel(),
                prefs.isUseSameSettingsForReplacementEffects(),
                prefs.isUseFirstManaAbility(),
                appearance);
        out.setGroupId(prefs.getGroupId());
        return out;
    }
}
