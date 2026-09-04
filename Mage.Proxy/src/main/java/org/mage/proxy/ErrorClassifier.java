package org.mage.proxy;

import java.util.Locale;

/** Clasificación de errores del servidor a errorCode uniforme + limpieza de prefijos. */
final class ErrorClassifier {

    private ErrorClassifier() {
    }

    static String classifyErrorCode(String detail) {
        if (detail == null) return ProxyProtocol.ERR_FAILED;
        String lower = detail.toLowerCase(Locale.ROOT);
        if (lower.contains("card not found")) return ProxyProtocol.ERR_CARD_NOT_FOUND;
        if (lower.contains("quit ratio")) return ProxyProtocol.ERR_QUIT_RATIO;
        if (lower.contains("minimum rating") || lower.contains("rating") && lower.contains("lower")) return ProxyProtocol.ERR_RATING;
        if (lower.contains("not started tables") || lower.contains("too much") || lower.contains("already") && lower.contains("not started")) return ProxyProtocol.ERR_TABLE_LIMIT;
        if (lower.contains("invalid deck") || lower.contains("deckvalidator") || lower.contains("no valid deck") || lower.contains("must contain") || lower.contains("too few cards") || lower.contains("deck is not valid")
                || lower.contains("too powerful") || lower.contains("power level") || lower.contains("requested no") || lower.contains("appropriate for the selected format") || lower.contains("select a deck that is appropriate")
                || lower.contains("no valid deck selected")) return ProxyProtocol.ERR_INVALID_DECK;
        if (lower.contains("wrong password") || lower.contains("invalid password") || lower.contains("password")) return ProxyProtocol.ERR_PASSWORD;
        if (lower.contains("no available seats") || lower.contains("table is full") || lower.contains("can join a table only")) return ProxyProtocol.ERR_SEAT;
        if (lower.contains("player can't join")) return ProxyProtocol.ERR_SEAT;
        if (lower.contains("could not create player")) return ProxyProtocol.ERR_FAILED;
        if (lower.contains("decktype") || lower.contains("deck type") || lower.contains("invalid deck type")) return ProxyProtocol.ERR_INVALID_DECK_TYPE;
        if (lower.contains("gametype") || lower.contains("game type") || lower.contains("invalid game type")) return ProxyProtocol.ERR_INVALID_GAME_TYPE;
        return ProxyProtocol.ERR_FAILED;
    }

    static String stripServerErrorPrefix(String msg) {
        if (msg == null) return null;
        if (msg.startsWith("Server error: ")) return msg.substring("Server error: ".length());
        if (msg.startsWith("Remote task error: ")) return msg.substring("Remote task error: ".length());
        return msg;
    }
}
