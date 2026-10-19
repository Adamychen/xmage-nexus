package org.mage.proxy;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import mage.view.UsersView;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * The public shape of the statistics API: which fields of the XMage views leave the proxy, how a
 * rating becomes a tier, and how a ranking or a match list is ordered. Nothing else is copied, so
 * a field added to a view upstream stays private until it is listed here.
 */
final class PublicStats {

    /** Fields of {@code mage.view.MatchView} that are match metadata. Deck and chat data are not among them. */
    static final String[] MATCH_FIELDS = {
        "tableId", "matchId", "matchName", "gameType", "deckType", "games", "result", "players",
        "startTime", "endTime", "replayAvailable", "isTournament", "rated"
    };

    private PublicStats() {
    }

    enum Format {
        CONSTRUCTED("constructed"), LIMITED("limited");

        private final String wire;

        Format(String wire) {
            this.wire = wire;
        }

        String wire() {
            return wire;
        }

        /** The format named by the query value, or null when it is not one of ours. */
        static Format parse(String value) {
            if (value != null) {
                for (Format format : values()) {
                    if (format.wire.equals(value)) {
                        return format;
                    }
                }
            }
            return null;
        }

        int ratingOf(UsersView user) {
            return this == CONSTRUCTED ? user.getConstructedRating() : user.getLimitedRating();
        }
    }

    /**
     * XMage does not name ranks: the view only carries the numeric ratings. The thresholds are the
     * ones this API publishes, not an XMage constant.
     */
    static String tier(int rating) {
        if (rating >= 1688) {
            return "MYTHIC";
        }
        if (rating >= 1611) {
            return "DIAMOND";
        }
        if (rating >= 1520) {
            return "PLATINUM";
        }
        if (rating >= 1360) {
            return "GOLD";
        }
        if (rating >= 1136) {
            return "SILVER";
        }
        return "BRONZE";
    }

    static String division(int rating) {
        if (rating >= 1688) {
            return null;
        }
        int[] starts = divisionStarts(tier(rating));
        int index = 0;
        for (int i = 0; i < starts.length; i++) {
            if (rating >= starts[i]) {
                index = i;
            }
        }
        return new String[]{"IV", "III", "II", "I"}[index];
    }

    private static int[] divisionStarts(String tier) {
        switch (tier) {
            case "DIAMOND":
                return new int[]{1611, 1628, 1648, 1662};
            case "PLATINUM":
                return new int[]{1520, 1541, 1557, 1580};
            case "GOLD":
                return new int[]{1360, 1401, 1429, 1473};
            case "SILVER":
                return new int[]{1136, 1177, 1250, 1298};
            default:
                return new int[]{0, 885, 985, 1051};
        }
    }

    /** Players of the room ordered by the format's rating, highest first, then by name. */
    static JsonObject ranking(Format format, String updatedAt, List<UsersView> users) {
        List<UsersView> sorted = new ArrayList<>();
        for (UsersView user : users) {
            if (user != null && user.getUserName() != null) {
                sorted.add(user);
            }
        }
        sorted.sort(Comparator
                .comparingInt((UsersView user) -> format.ratingOf(user)).reversed()
                .thenComparing(UsersView::getUserName, String.CASE_INSENSITIVE_ORDER));
        JsonArray players = new JsonArray();
        for (UsersView user : sorted) {
            int rating = format.ratingOf(user);
            JsonObject player = new JsonObject();
            player.addProperty("username", user.getUserName());
            player.addProperty("rating", rating);
            player.addProperty("tier", tier(rating));
            String division = division(rating);
            player.addProperty("division", division);
            players.add(player);
        }
        JsonObject body = new JsonObject();
        body.addProperty("format", format.wire());
        body.addProperty("updatedAt", updatedAt);
        body.add("players", players);
        return body;
    }

    /** A serialized {@code MatchView} reduced to {@link #MATCH_FIELDS}. */
    static JsonObject publicMatch(JsonObject raw) {
        JsonObject out = new JsonObject();
        for (String field : MATCH_FIELDS) {
            if (raw.has(field)) {
                out.add(field, raw.get(field));
            }
        }
        return out;
    }

    /** Newest finished match first (endTime is epoch millis), cut to the requested limit. */
    static List<JsonObject> newestFirst(List<JsonObject> matches) {
        List<JsonObject> sorted = new ArrayList<>(matches);
        sorted.sort(Comparator.comparingLong((JsonObject match) -> endTimeOf(match)).reversed());
        return sorted;
    }

    static JsonObject matchesBody(String updatedAt, List<JsonObject> newestFirst, int limit) {
        JsonArray matches = new JsonArray();
        for (int i = 0; i < newestFirst.size() && i < limit; i++) {
            matches.add(newestFirst.get(i));
        }
        JsonObject body = new JsonObject();
        body.addProperty("updatedAt", updatedAt);
        body.add("matches", matches);
        return body;
    }

    private static long endTimeOf(JsonObject match) {
        JsonElement end = match.get("endTime");
        if (end instanceof JsonPrimitive && ((JsonPrimitive) end).isNumber()) {
            return end.getAsLong();
        }
        return 0L;
    }
}
