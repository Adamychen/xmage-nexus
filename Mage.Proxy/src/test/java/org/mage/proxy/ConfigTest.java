package org.mage.proxy;

import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ConfigTest {

    @Test
    void defaultsAreLocalAndBounded() {
        Config config = Config.parse(new String[0]);

        assertEquals(Config.DEFAULT_BIND_ADDRESS, config.getBindAddress());
        assertEquals(Config.DEFAULT_WS_PORT, config.getWsPort());
        assertEquals(Config.DEFAULT_HTTP_PORT, config.getHttpPort());
        assertEquals(Config.DEFAULT_MAX_MESSAGE_BYTES, config.getMaxMessageBytes());
        assertEquals(Config.DEFAULT_MAX_MESSAGES_PER_SECOND, config.getMaxMessagesPerSecond());
        assertTrue(config.getAllowedOrigins().isEmpty());
    }

    @Test
    void parsesSecurityOptionsAndTrimsOrigins() {
        Config config = Config.parse(new String[]{
                "--bind", "127.0.0.1",
                "--wsPort", "9001",
                "--httpPort", "9002",
                "--allowedOrigins", " http://localhost:5173,https://example.test ",
                "--maxMessageBytes", "2048",
                "--maxMessagesPerSecond", "12"
        });

        assertEquals("127.0.0.1", config.getBindAddress());
        assertEquals(9001, config.getWsPort());
        assertEquals(9002, config.getHttpPort());
        assertEquals(2048, config.getMaxMessageBytes());
        assertEquals(12, config.getMaxMessagesPerSecond());
        assertEquals(
                new java.util.HashSet<>(Arrays.asList("http://localhost:5173", "https://example.test")),
                config.getAllowedOrigins()
        );
    }

    @Test
    void invalidIntegersUseDefaults() {
        Config config = Config.parse(new String[]{
                "--wsPort", "not-a-port",
                "--maxMessageBytes", "nope"
        });

        assertEquals(Config.DEFAULT_WS_PORT, config.getWsPort());
        assertEquals(Config.DEFAULT_MAX_MESSAGE_BYTES, config.getMaxMessageBytes());
    }

    @Test
    void aFlagIsNeverTakenAsTheValueOfThePreviousOne() {
        // used to set host="--port" and drop 17171: the proxy then dialled host "--port" on the
        // default port with nothing in the log. A typo in a systemd unit must not start like that.
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> Config.parse(new String[]{
                "--host", "--port", "17171"
        }));
        assertTrue(ex.getMessage().contains("--host"), ex.getMessage());
    }

    @Test
    void aTrailingFlagWithoutAValueIsRejected() {
        // used to be dropped silently, after the loop had read the previous key as its value
        assertThrows(IllegalArgumentException.class, () -> Config.parse(new String[]{"--adminToken"}));
        assertThrows(IllegalArgumentException.class, () -> Config.parse(new String[]{"--wsPort", "9001", "--bind"}));
    }

    @Test
    void aValueThatLooksLikeAFlagIsStillRejected() {
        // even a plausible password: guessing the intent is worse than refusing to start
        assertThrows(IllegalArgumentException.class, () -> Config.parse(new String[]{"--password", "--host"}));
    }

    @Test
    void nonFlagArgumentsAreIgnored() {
        Config config = Config.parse(new String[]{"java", "-jar", "proxy.jar", "--wsPort", "9001"});

        assertEquals(9001, config.getWsPort());
    }
}
