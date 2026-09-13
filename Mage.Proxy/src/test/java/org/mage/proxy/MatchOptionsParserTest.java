package org.mage.proxy;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MatchOptionsParserTest {

    @Test
    void draftWithoutTimingBuildsDraftOptionsWithRegularTiming() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("constructionTime", 600);
        lo.addProperty("numberBoosters", 3);
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions);
        assertEquals(mage.game.draft.DraftOptions.TimingOption.REGULAR,
                ((mage.game.draft.DraftOptions) tOpts.getLimitedOptions()).getTiming());
    }

    @Test
    void draftWithoutLimitedOptionsBuildsDraftOptionsWithRegularTiming() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft Elimination");

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions);
        assertEquals(mage.game.draft.DraftOptions.TimingOption.REGULAR,
                ((mage.game.draft.DraftOptions) tOpts.getLimitedOptions()).getTiming());
    }

    @Test
    void draftWithInvalidTimingFallsBackToRegularDraftOptions() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("timing", "BOGUS");
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions);
        assertEquals(mage.game.draft.DraftOptions.TimingOption.REGULAR,
                ((mage.game.draft.DraftOptions) tOpts.getLimitedOptions()).getTiming());
    }

    @Test
    void draftCastingLikeEngineDoesNotThrow() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Draft Night");
        args.addProperty("tournamentType", "Booster Draft Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("numberBoosters", 3);
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        mage.game.draft.DraftOptions draftOpts =
                (mage.game.draft.DraftOptions) tOpts.getLimitedOptions();
        assertTrue(draftOpts.getTiming() != null);
    }

    @Test
    void sealedWithoutTimingKeepsBaseLimitedOptions() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Sealed Night");
        args.addProperty("tournamentType", "Sealed Elimination");
        JsonObject lo = new JsonObject();
        lo.addProperty("constructionTime", 600);
        args.add("limitedOptions", lo);

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(!(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions));
    }

    @Test
    void sealedWithoutLimitedOptionsKeepsBaseLimitedOptions() {
        JsonObject args = new JsonObject();
        args.addProperty("name", "Sealed Night");
        args.addProperty("tournamentType", "Sealed Elimination");

        mage.game.tournament.TournamentOptions tOpts = MatchOptionsParser.parseTournamentOptions(args);

        assertTrue(tOpts.getLimitedOptions() != null);
        assertTrue(!(tOpts.getLimitedOptions() instanceof mage.game.draft.DraftOptions));
    }
}
