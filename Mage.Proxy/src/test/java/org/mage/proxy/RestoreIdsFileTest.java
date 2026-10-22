package org.mage.proxy;

import mage.remote.SessionImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/** The restore-id file is a bearer ticket: it must not be written through a link or readable by others. */
class RestoreIdsFileTest {

    @AfterEach
    void stop() {
        RestoreIds.clearAll();
        RestoreIds.configure(Config.parse(new String[]{"--restoreIds", "none"}));
    }

    private static Config configFor(File file) {
        return Config.parse(new String[]{"--restoreIds", file.getPath()});
    }

    @Test
    void savingDoesNotFollowALinkPlantedAtTheOldTempName(@TempDir Path dir) throws Exception {
        Path victim = dir.resolve("victim.txt");
        Files.write(victim, "keep me".getBytes(StandardCharsets.UTF_8));
        Files.createSymbolicLink(dir.resolve("restore.json.tmp"), victim);

        RestoreIds.configure(configFor(dir.resolve("restore.json").toFile()));
        RestoreIds.put("127.0.0.1", "u1", "s1");

        assertEquals("keep me", new String(Files.readAllBytes(victim), StandardCharsets.UTF_8),
                "the file behind the planted link was not overwritten with the ticket");
        assertEquals("s1", RestoreIds.get("127.0.0.1", "u1"));
    }

    @Test
    void theSavedFileIsOwnerOnlyAndNoTempFileIsLeftBehind(@TempDir Path dir) throws Exception {
        assumeTrue(FileSystems.getDefault().supportedFileAttributeViews().contains("posix"));
        RestoreIds.configure(configFor(dir.resolve("restore.json").toFile()));
        RestoreIds.put("127.0.0.1", "u1", "s1");

        assertEquals(PosixFilePermissions.fromString("rw-------"), Files.getPosixFilePermissions(dir.resolve("restore.json")));
        try (Stream<Path> files = Files.list(dir)) {
            assertEquals(1, files.count(), "only the restore file remains");
        }
    }

    @Test
    void theAccountIsTheSameWhateverTheCaseOfItsName() {
        RestoreIds.put("127.0.0.1", "Alice", "s1");
        assertEquals("s1", RestoreIds.get("127.0.0.1", "alice"), "XMage account names are case-insensitive");
    }

    @Test
    void aFileWrittenBeforeTheKeysWereNormalisedIsStillRead(@TempDir Path dir) throws Exception {
        File file = dir.resolve("restore.json").toFile();
        long now = System.currentTimeMillis();
        Files.write(file.toPath(), ("{\"savedAt\":" + now + ",\"ids\":{\"127.0.0.1|Alice\":{\"id\":\"s1\",\"at\":" + now + "}}}")
                .getBytes(StandardCharsets.UTF_8));

        RestoreIds.configure(configFor(file));

        assertEquals("s1", RestoreIds.get("127.0.0.1", "alice"));
    }
}
