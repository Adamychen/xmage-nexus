package org.mage.rl;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import mage.ObjectColor;
import mage.cards.repository.CardCriteria;
import mage.cards.repository.CardInfo;
import mage.cards.repository.CardRepository;
import mage.cards.repository.CardScanner;
import mage.constants.CardType;
import mage.constants.SubType;

import java.io.BufferedWriter;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * One-off tool: dump every card in the engine DB as JSONL
 * {n, set, num, mv, ty, sub, c, rules} for the offline embedding builder.
 */
public final class DumpCards {

    public static void main(String[] args) throws Exception {
        java.util.logging.LogManager.getLogManager().reset();
        List<String> errors = new ArrayList<>();
        CardScanner.scan(errors);
        if (!errors.isEmpty()) {
            System.err.println("scan errors: " + errors.size());
        }
        List<CardInfo> cards = new ArrayList<>();
        cards.addAll(CardRepository.instance.findCards(new CardCriteria().nightCard(false)));
        cards.addAll(CardRepository.instance.findCards(new CardCriteria().nightCard(true)));
        Gson gson = new Gson();
        Set<String> seen = new HashSet<>();
        int written = 0;
        try (PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(args[0])))) {
            for (CardInfo c : cards) {
                if (c.getName() == null || c.getName().isEmpty() || !seen.add(c.getName())) {
                    continue;
                }
                JsonObject o = new JsonObject();
                o.addProperty("n", c.getName());
                o.addProperty("set", c.getSetCode());
                o.addProperty("num", c.getCardNumber());
                o.addProperty("mv", c.getManaValue());
                JsonArray types = new JsonArray();
                for (CardType t : c.getTypes()) {
                    types.add(t.name());
                }
                o.add("ty", types);
                JsonArray subs = new JsonArray();
                for (SubType s : c.getSubTypes()) {
                    subs.add(s.name());
                }
                o.add("sub", subs);
                o.addProperty("c", colorMask(c.getColor()));
                JsonArray rules = new JsonArray();
                for (String r : c.getRules()) {
                    rules.add(r);
                }
                o.add("rules", rules);
                out.println(gson.toJson(o));
                written++;
            }
        }
        System.err.println("dumped " + written + " cards");
    }

    static int colorMask(ObjectColor color) {
        if (color == null) {
            return 0;
        }
        int m = 0;
        if (color.isWhite()) m |= 1;
        if (color.isBlue()) m |= 2;
        if (color.isBlack()) m |= 4;
        if (color.isRed()) m |= 8;
        if (color.isGreen()) m |= 16;
        return m;
    }
}
