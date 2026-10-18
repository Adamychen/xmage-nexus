package org.mage.proxy;

import com.google.gson.JsonObject;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Routing, parameter parsing and CORS for the read-only statistics API, independent of the HTTP
 * server so each rule can be tested without one. {@code GET /api/ranking?format=} and
 * {@code GET /api/matches?limit=} are the only routes.
 */
final class StatsApi {

    static final String RANKING_PATH = "/api/ranking";
    static final String MATCHES_PATH = "/api/matches";
    static final int DEFAULT_LIMIT = 50;
    static final int MAX_LIMIT = 200;
    static final String CACHE_CONTROL = "public, max-age=30";
    static final String JSON_CONTENT_TYPE = "application/json; charset=utf-8";
    static final Set<String> TAURI_ORIGINS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            "tauri://localhost", "http://tauri.localhost", "https://tauri.localhost")));

    interface Source {
        Optional<JsonObject> ranking(PublicStats.Format format);

        Optional<JsonObject> matches(int limit);
    }

    /** Source used while the statistics session is disabled: every read is not ready. */
    static final Source UNAVAILABLE = new Source() {
        @Override
        public Optional<JsonObject> ranking(PublicStats.Format format) {
            return Optional.empty();
        }

        @Override
        public Optional<JsonObject> matches(int limit) {
            return Optional.empty();
        }
    };

    /** {@code body} is null for a response without content (204, 405 carries an error body). */
    static final class Response {
        final int status;
        final String body;
        final Map<String, String> headers;

        Response(int status, String body, Map<String, String> headers) {
            this.status = status;
            this.body = body;
            this.headers = headers;
        }
    }

    private StatsApi() {
    }

    static Response handle(String method, String path, String rawQuery, String origin,
                           Set<String> allowedOrigins, Source source) {
        Map<String, String> headers = new LinkedHashMap<>();
        applyCors(headers, origin, allowedOrigins);
        headers.put("Content-Type", JSON_CONTENT_TYPE);
        if ("OPTIONS".equals(method)) {
            headers.put("Access-Control-Allow-Methods", "GET, OPTIONS");
            headers.put("Access-Control-Max-Age", "600");
            return new Response(204, null, headers);
        }
        if (!"GET".equals(method)) {
            headers.put("Allow", "GET, OPTIONS");
            return error(405, "method_not_allowed", headers);
        }
        if (RANKING_PATH.equals(path)) {
            PublicStats.Format format = PublicStats.Format.parse(queryParam(rawQuery, "format"));
            if (format == null) {
                return error(400, "bad_format", headers);
            }
            return cached(source.ranking(format), headers);
        }
        if (MATCHES_PATH.equals(path)) {
            Integer limit = parseLimit(queryParam(rawQuery, "limit"));
            if (limit == null) {
                return error(400, "bad_limit", headers);
            }
            return cached(source.matches(limit), headers);
        }
        return error(404, "not_found", headers);
    }

    /**
     * Echoes the request origin only when it is one of the configured origins or a Tauri origin.
     * Never {@code *}: an origin is echoed exactly, and the response varies by origin.
     */
    static void applyCors(Map<String, String> headers, String origin, Set<String> allowedOrigins) {
        headers.put("Vary", "Origin");
        if (origin == null || origin.isEmpty() || "*".equals(origin)) {
            return;
        }
        if (TAURI_ORIGINS.contains(origin) || allowedOrigins.contains(origin)) {
            headers.put("Access-Control-Allow-Origin", origin);
        }
    }

    /** Default {@link #DEFAULT_LIMIT}; values above {@link #MAX_LIMIT} are capped; null when invalid. */
    static Integer parseLimit(String raw) {
        if (raw == null) {
            return DEFAULT_LIMIT;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            if (value < 1) {
                return null;
            }
            return Math.min(value, MAX_LIMIT);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    /** The first value of a query parameter, or null when absent. */
    static String queryParam(String rawQuery, String name) {
        if (rawQuery == null || rawQuery.isEmpty()) {
            return null;
        }
        for (String pair : rawQuery.split("&")) {
            int eq = pair.indexOf('=');
            String key = decode(eq < 0 ? pair : pair.substring(0, eq));
            if (name.equals(key)) {
                return eq < 0 ? "" : decode(pair.substring(eq + 1));
            }
        }
        return null;
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, "UTF-8");
        } catch (UnsupportedEncodingException | IllegalArgumentException ex) {
            return value;
        }
    }

    private static Response cached(Optional<JsonObject> body, Map<String, String> headers) {
        headers.put("Cache-Control", CACHE_CONTROL);
        if (!body.isPresent()) {
            return new Response(503, "{\"error\":\"not_ready\"}", headers);
        }
        return new Response(200, body.get().toString(), headers);
    }

    private static Response error(int status, String code, Map<String, String> headers) {
        return new Response(status, "{\"error\":\"" + code + "\"}", headers);
    }
}
