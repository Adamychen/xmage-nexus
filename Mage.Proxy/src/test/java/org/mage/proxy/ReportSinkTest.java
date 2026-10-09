package org.mage.proxy;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The landing zone of a player-submitted report. What these tests guard is the part that is easy
 * to get wrong and expensive to discover late: a channel any logged-in player can push, landing
 * on the disk of the machine that also runs the games.
 */
class ReportSinkTest {

    private static final String PAYLOAD = "{\"appVersion\":\"0.4.5\",\"game\":{\"turn\":4,\"step\":\"BEGIN_COMBAT\"}}";

    private static Config config(Path dir, String... extra) {
        List<String> args = new ArrayList<>();
        args.add("--reportsDir");
        args.add(dir.toString());
        for (String e : extra) {
            args.add(e);
        }
        return Config.parse(args.toArray(new String[0]));
    }

    private static int countFiles(Path dir) throws IOException {
        List<Path> out = new ArrayList<>();
        ReportSink.collect(dir, out);
        return out.size();
    }
    @Test
    void aReportLandsInADatedFileAndNamesWhereItLanded(@TempDir Path dir) throws IOException {
        Config config = config(dir);
        ReportSink.Quota quota = new ReportSink.Quota(config);

        ReportSink.Result result = ReportSink.store(config, quota, 1L, "ana", "10.0.0.1", "bug",
                "the angel kept priority", "bug:darksteel-angel", PAYLOAD);

        assertTrue(result.stored);
        assertNotNull(result.id);
        assertTrue(result.reason == null);

        String body = new String(Files.readAllBytes(dir.resolve(result.path)), StandardCharsets.UTF_8);
        JsonElement file = JsonParser.parseString(body);
        assertTrue(file.isJsonObject());
        assertEquals("bug", file.getAsJsonObject().get("kind").getAsString());
        assertEquals("ana", file.getAsJsonObject().get("user").getAsString());
        assertEquals("the angel kept priority", file.getAsJsonObject().get("text").getAsString());
        assertEquals(4, file.getAsJsonObject().getAsJsonObject("payload").getAsJsonObject("game").get("turn").getAsInt());
    }

    @Test
    void theSinkStaysShutWhenTheReportsDirectoryIsOff(@TempDir Path dir) throws IOException {
        Config config = Config.parse(new String[]{"--reportsDir", "OFF"});
        assertFalse(ReportSink.enabled(config));
        ReportSink.Quota quota = new ReportSink.Quota(config);

        ReportSink.Result result = ReportSink.store(config, quota, 1L, "ana", "", "bug", "x", "", PAYLOAD);

        assertFalse(result.stored);
        assertEquals("disabled", result.reason);
        assertEquals(0, countFiles(dir));
    }

    @Test
    void aPayloadOverTheCapIsRefusedAndSaysSo(@TempDir Path dir) throws IOException {
        Config config = config(dir, "--reportMaxFileBytes", "64");
        ReportSink.Quota quota = new ReportSink.Quota(config);
        StringBuilder fat = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            fat.append("0123456789");
        }

        ReportSink.Result result = ReportSink.store(config, quota, 1L, "ana", "", "bug", "x", "", fat.toString());

        assertFalse(result.stored);
        assertEquals("too-large", result.reason);
        assertEquals(0, countFiles(dir));
    }

    @Test
    void aSessionStopsAtItsQuotaWhateverTheClockSays(@TempDir Path dir) throws IOException {
        Config config = config(dir, "--reportQuotaCount", "2", "--reportQuotaIntervalSecs", "1");
        ReportSink.Quota quota = new ReportSink.Quota(config);

        assertNull(quota.check("fp:one", 1_000L));
        quota.record("fp:one", 1_000L);
        assertNull(quota.check("fp:two", 3_000L));
        quota.record("fp:two", 3_000L);

        assertEquals("quota", quota.check("fp:three", 9_000L));
        assertEquals(2, quota.used());
    }

    @Test
    void twoReportsInsideTheIntervalAreTooFastEvenWithRoomLeftInQuota(@TempDir Path dir) {
        Config config = config(dir, "--reportQuotaIntervalSecs", "30");
        ReportSink.Quota quota = new ReportSink.Quota(config);
        quota.record("fp:one", 1_000L);

        assertEquals("rate", quota.check("fp:two", 2_000L));
        assertNull(quota.check("fp:two", 40_000L));
    }

    @Test
    void theSameFingerprintTwiceInOneSessionCountsOnce(@TempDir Path dir) {
        Config config = config(dir, "--reportQuotaIntervalSecs", "1");
        ReportSink.Quota quota = new ReportSink.Quota(config);
        quota.record("board-looks-wrong", 1_000L);

        assertEquals("duplicate", quota.check("board-looks-wrong", 60_000L));
        assertNull(quota.check("something-else", 60_000L));
    }

    @Test
    void aNewlineOrAQuoteInTheTextCannotForgeASecondJournalLine() {
        String excerpt = ReportSink.excerpt("it broke\n\"and then\" it broke again", 120);

        assertFalse(excerpt.contains("\n"));
        assertFalse(excerpt.contains("\""));
        assertFalse(ReportSink.excerpt("a".repeat(400), 120).length() > 120);
        assertEquals(80, ReportSink.excerpt("b".repeat(300), 80).length());
    }

    @Test
    void aPayloadThatIsNotJsonIsStoredAsTextSoTheReaderNeverChokes(@TempDir Path dir) throws IOException {
        Config config = config(dir);
        ReportSink.Quota quota = new ReportSink.Quota(config);

        ReportSink.Result result = ReportSink.store(config, quota, 1L, "ana", "", "feedback",
                "quote \" and a newline\nhere", "", "not json at all");

        assertTrue(result.stored);
        String body = new String(Files.readAllBytes(dir.resolve(result.path)), StandardCharsets.UTF_8);
        JsonElement file = JsonParser.parseString(body);
        assertTrue(file.getAsJsonObject().get("payload").isJsonPrimitive());
        // the file keeps what the player typed (it is JSON, not a log line); only the journal is squeezed
        assertEquals("quote \" and a newline\nhere", file.getAsJsonObject().get("text").getAsString());
    }

    @Test
    void pruningKeepsTheDirectoryBoundedByCount(@TempDir Path dir) throws IOException {
        Config config = config(dir, "--reportMaxFiles", "2", "--reportQuotaIntervalSecs", "1");
        ReportSink.Quota quota = new ReportSink.Quota(config);

        for (int i = 0; i < 5; i++) {
            ReportSink.Result result = ReportSink.store(config, quota, 1_000_000L + i * 5_000L, "ana", "", "bug", "", "", PAYLOAD);
            assertTrue(result.stored);
        }

        assertEquals(2, countFiles(dir));
    }

    @Test
    void pruningAlsoDropsWhatWentPastItsAge(@TempDir Path dir) throws IOException {
        Config config = config(dir, "--reportMaxAgeDays", "1", "--reportMaxFiles", "100");
        ReportSink.Quota quota = new ReportSink.Quota(config);

        ReportSink.Result stored = ReportSink.store(config, quota, 1L, "ana", "", "bug", "", "", PAYLOAD);
        Path file = dir.resolve(stored.path);
        Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.fromMillis(System.currentTimeMillis() - 3L * 24 * 60 * 60 * 1000));
        ReportSink.prune(config, dir);

        assertFalse(Files.exists(file));
    }

    @Test
    void idsAreEightHexCharactersSoTheySurviveAFilenameAndAGrep() {
        for (int i = 0; i < 200; i++) {
            String id = ReportSink.newId();
            assertEquals(8, id.length());
            assertTrue(id.matches("[0-9a-f]{8}"), id);
        }
    }
}
