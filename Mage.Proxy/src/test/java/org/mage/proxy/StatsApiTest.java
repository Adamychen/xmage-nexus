package org.mage.proxy;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StatsApiTest {

    private static final Set<String> NO_ORIGINS = Collections.emptySet();
    private static final Set<String> CONFIGURED = Collections.singleton("https://nexus.example");

    private static final StatsApi.Source READY = new StatsApi.Source() {
        @Override
        public Optional<JsonObject> ranking(PublicStats.Format format) {
            JsonObject body = new JsonObject();
            body.addProperty("format", format.wire());
            return Optional.of(body);
        }

        @Override
        public Optional<JsonObject> matches(int limit) {
            JsonObject body = new JsonObject();
            body.addProperty("limit", limit);
            return Optional.of(body);
        }
    };

    private static StatsApi.Response get(String path, String query, Set<String> origins, StatsApi.Source source) {
        return StatsApi.handle("GET", path, query, null, origins, source);
    }

    @Test
    void formatAcceptsOnlyTheTwoKnownValues() {
        assertEquals(PublicStats.Format.CONSTRUCTED, PublicStats.Format.parse("constructed"));
        assertEquals(PublicStats.Format.LIMITED, PublicStats.Format.parse("limited"));
        assertNull(PublicStats.Format.parse("Constructed"));
        assertNull(PublicStats.Format.parse(""));
        assertNull(PublicStats.Format.parse(null));
    }

    @Test
    void unknownOrMissingFormatIsBadFormat() {
        assertEquals(400, get(StatsApi.RANKING_PATH, "format=draft", NO_ORIGINS, READY).status);
        assertEquals(400, get(StatsApi.RANKING_PATH, null, NO_ORIGINS, READY).status);
        assertTrue(get(StatsApi.RANKING_PATH, "format=draft", NO_ORIGINS, READY).body.contains("bad_format"));
    }

    @Test
    void limitDefaultsToFiftyAndIsCappedAtTwoHundred() {
        assertEquals(Integer.valueOf(50), StatsApi.parseLimit(null));
        assertEquals(Integer.valueOf(1), StatsApi.parseLimit("1"));
        assertEquals(Integer.valueOf(200), StatsApi.parseLimit("200"));
        assertEquals(Integer.valueOf(200), StatsApi.parseLimit("5000"));
        assertEquals(Integer.valueOf(7), StatsApi.parseLimit(" 7 "));
    }

    @Test
    void invalidLimitIsBadLimit() {
        assertNull(StatsApi.parseLimit("0"));
        assertNull(StatsApi.parseLimit("-3"));
        assertNull(StatsApi.parseLimit("ten"));
        assertNull(StatsApi.parseLimit(""));
        assertEquals(400, get(StatsApi.MATCHES_PATH, "limit=x", NO_ORIGINS, READY).status);
    }

    @Test
    void queryParamReadsTheFirstValueAndDecodesIt() {
        assertEquals("constructed", StatsApi.queryParam("format=constructed&format=limited", "format"));
        assertEquals("a b", StatsApi.queryParam("x=1&format=a%20b", "format"));
        assertEquals("", StatsApi.queryParam("format", "format"));
        assertNull(StatsApi.queryParam("limit=3", "format"));
        assertNull(StatsApi.queryParam(null, "format"));
    }

    @Test
    void configuredOriginIsEchoedExactly() {
        Map<String, String> headers = new HashMap<>();
        StatsApi.applyCors(headers, "https://nexus.example", CONFIGURED);

        assertEquals("https://nexus.example", headers.get("Access-Control-Allow-Origin"));
        assertEquals("Origin", headers.get("Vary"));
    }

    @Test
    void tauriOriginsAreAlwaysAllowed() {
        for (String origin : new String[]{"tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"}) {
            Map<String, String> headers = new HashMap<>();
            StatsApi.applyCors(headers, origin, NO_ORIGINS);
            assertEquals(origin, headers.get("Access-Control-Allow-Origin"));
        }
    }

    @Test
    void unknownOriginGetsNoAllowOriginHeader() {
        Map<String, String> headers = new HashMap<>();
        StatsApi.applyCors(headers, "https://evil.example", CONFIGURED);

        assertFalse(headers.containsKey("Access-Control-Allow-Origin"));
    }

    @Test
    void wildcardIsNeverEchoed() {
        Map<String, String> headers = new HashMap<>();
        StatsApi.applyCors(headers, "*", Collections.singleton("*"));

        assertFalse(headers.containsKey("Access-Control-Allow-Origin"));
    }

    @Test
    void preflightIsAnsweredWith204ForAnyOrigin() {
        StatsApi.Response response = StatsApi.handle("OPTIONS", StatsApi.RANKING_PATH, null,
                "tauri://localhost", NO_ORIGINS, READY);

        assertEquals(204, response.status);
        assertNull(response.body);
        assertEquals("tauri://localhost", response.headers.get("Access-Control-Allow-Origin"));
        assertTrue(response.headers.get("Access-Control-Allow-Methods").contains("GET"));
    }

    @Test
    void otherMethodsAreNotAllowed() {
        for (String method : new String[]{"POST", "PUT", "DELETE"}) {
            StatsApi.Response response = StatsApi.handle(method, StatsApi.RANKING_PATH, "format=limited",
                    null, NO_ORIGINS, READY);
            assertEquals(405, response.status);
            assertEquals("GET, OPTIONS", response.headers.get("Allow"));
        }
    }

    @Test
    void notReadyIsAn503WithTheCacheHeader() {
        StatsApi.Response ranking = get(StatsApi.RANKING_PATH, "format=constructed", NO_ORIGINS, StatsApi.UNAVAILABLE);
        StatsApi.Response matches = get(StatsApi.MATCHES_PATH, "limit=5", NO_ORIGINS, StatsApi.UNAVAILABLE);

        assertEquals(503, ranking.status);
        assertEquals("{\"error\":\"not_ready\"}", ranking.body);
        assertEquals("public, max-age=30", ranking.headers.get("Cache-Control"));
        assertEquals(503, matches.status);
        assertEquals("{\"error\":\"not_ready\"}", matches.body);
    }

    @Test
    void readyAnswersTheBodyWithTheCacheHeaderAndJson() {
        StatsApi.Response response = get(StatsApi.RANKING_PATH, "format=limited", NO_ORIGINS, READY);

        assertEquals(200, response.status);
        assertEquals("{\"format\":\"limited\"}", response.body);
        assertEquals("public, max-age=30", response.headers.get("Cache-Control"));
        assertEquals("application/json; charset=utf-8", response.headers.get("Content-Type"));
    }

    @Test
    void matchesPassesTheParsedLimitThrough() {
        StatsApi.Response response = get(StatsApi.MATCHES_PATH, null, NO_ORIGINS, READY);

        assertEquals("{\"limit\":50}", response.body);
    }

    @Test
    void unknownPathIsNotFound() {
        assertEquals(404, get("/api/nope", null, NO_ORIGINS, READY).status);
    }
}
