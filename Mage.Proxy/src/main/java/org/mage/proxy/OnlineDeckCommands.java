package org.mage.proxy;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.WebSocket;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Import de mazos desde servicios externos (Moxfield/Archidekt).
 * <p>
 * El fetch corre aqui, en el proxy (Java), en vez de en el navegador: las APIs
 * de Moxfield/Archidekt no envian cabeceras CORS que permitan {@code fetch()}
 * desde el origen del cliente web, asi que un fetch directo del navegador
 * siempre falla con "Failed to fetch". El proxy no tiene esa restriccion.
 */
final class OnlineDeckCommands {

    // Sin marcador explicito ("moxfield.com/decks/"/"archidekt.com/decks/" o
    // "id=") se asume que urlOrId YA es el id: no hay alternativa "^" en el
    // patron porque, al no tener ancho fijo, "hijacka" el prefijo "https" de
    // una URL completa en vez de fallar y caer al urlOrId.trim() de abajo.
    private static final Pattern MOXFIELD_ID = Pattern.compile("moxfield\\.com/decks/([A-Za-z0-9_-]+)|id=([A-Za-z0-9_-]+)");
    private static final Pattern ARCHIDEKT_ID = Pattern.compile("archidekt\\.com/decks/(\\d+)|id=(\\d+)");
    private static final int TIMEOUT_MS = 8000;
    private static final int MAX_BODY_BYTES = 2_000_000;

    private OnlineDeckCommands() {
    }

    static boolean handle(String action, WebSocket conn, String requestId, JsonObject args, CommandContext ctx) {
        if (!"fetchOnlineDeck".equals(action)) {
            return false;
        }
        String source = JsonArgs.str(args, "source", "");
        String urlOrId = JsonArgs.str(args, "urlOrId", "");
        String apiUrl = resolveApiUrl(source, urlOrId);
        if (apiUrl == null) {
            ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_INVALID_ARGUMENT, "unknown source or id"));
            return true;
        }
        try {
            String body = httpGetJson(apiUrl);
            JsonObject data = JsonParser.parseString(body).getAsJsonObject();
            ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, true, null, data));
        } catch (Exception ex) {
            ctx.gateway().send(conn, ProxyProtocol.resultJson(action, requestId, false, ProxyProtocol.ERR_FAILED, "fetch failed: " + ex.getMessage()));
        }
        return true;
    }

    /** Resuelve la URL de API real (host/paths fijos, allowlist implicita) a partir de source + URL/id pegado por el usuario. */
    static String resolveApiUrl(String source, String urlOrId) {
        String id = extractId(source, urlOrId);
        if (id == null || id.isEmpty()) {
            return null;
        }
        if ("moxfield".equals(source)) {
            return "https://api.moxfield.com/v2/decks/all/" + id;
        }
        if ("archidekt".equals(source)) {
            return "https://archidekt.com/api/decks/" + id + "/small/";
        }
        return null;
    }

    static String extractId(String source, String urlOrId) {
        if (urlOrId == null) {
            return null;
        }
        Pattern pattern = "moxfield".equals(source) ? MOXFIELD_ID : "archidekt".equals(source) ? ARCHIDEKT_ID : null;
        if (pattern == null) {
            return null;
        }
        Matcher m = pattern.matcher(urlOrId);
        if (m.find()) {
            return m.group(1) != null ? m.group(1) : m.group(2);
        }
        return urlOrId.trim();
    }

    private static String httpGetJson(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty("User-Agent", "Mage.Proxy/1.0 (+deck-import)");
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            int status = conn.getResponseCode();
            InputStream stream = status >= 200 && status < 300 ? conn.getInputStream() : conn.getErrorStream();
            if (stream == null) {
                throw new IOException("HTTP " + status + " (no body)");
            }
            String body = readLimited(stream, MAX_BODY_BYTES);
            if (status < 200 || status >= 300) {
                throw new IOException("HTTP " + status);
            }
            return body;
        } finally {
            conn.disconnect();
        }
    }

    private static String readLimited(InputStream in, int maxChars) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            char[] buf = new char[8192];
            int total = 0;
            int n;
            while ((n = reader.read(buf)) != -1) {
                total += n;
                if (total > maxChars) {
                    throw new IOException("response too large");
                }
                sb.append(buf, 0, n);
            }
            return sb.toString();
        }
    }
}
