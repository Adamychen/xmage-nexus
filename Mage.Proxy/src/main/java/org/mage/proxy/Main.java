package org.mage.proxy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.lang.management.ManagementFactory;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.util.concurrent.Executors;

/**
 * Mage.Proxy entry point.
 * <p>
 * Usage:
 * <pre>
 * java -jar mage-proxy.jar [--host beta.xmage.today] [--port 17171] [--username u] [--password p] [--wsPort 8787] [--httpPort 8788]
 * </pre>
 * Then open http://localhost:8788/index.html (test page) which connects to ws://localhost:8787
 */
public class Main {

    public static void main(String[] args) throws Exception {
        Config config = Config.parse(args);

        Gateway gateway = new Gateway(config);
        gateway.start();

        // construcción perezosa de la BD de cartas del proxy (validación de mazos)
        DeckValidation.ensureCardDatabaseAsync();

        System.out.println("[proxy] XMage proxy started");
        System.out.println("[proxy]   websocket gateway : ws://" + config.getBindAddress() + ":" + config.getWsPort() + "/");
        System.out.println("[proxy]   test page         : http://" + config.getBindAddress() + ":" + config.getHttpPort() + "/index.html");
        System.out.println("[proxy]   protocol version  : " + Config.PROTOCOL_VERSION);
        System.out.println("[proxy]   multi-tenant     : each WebSocket connection = its own XMage session");

        startHttpServer(config, gateway);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            for (ProxyClient pc : gateway.getSessions()) {
                pc.shutdown();
            }
            try {
                gateway.stop(1000);
            } catch (InterruptedException ignored) {
            }
        }));
    }

    static HttpServer httpServer;

    private static void startHttpServer(Config config, Gateway gateway) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(config.getBindAddress(), config.getHttpPort()), 0);
        // Without an executor the JDK uses a single-threaded dispatcher, so one slow
        // /admin/status (it serialises 500 events) or one large static file blocked every other
        // request, including the health checks below.
        server.setExecutor(Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "proxy-http");
            t.setDaemon(true);
            return t;
        }));
        server.createContext("/", exchange -> serveFile(exchange, config.getWebDir()));
        server.createContext("/health", exchange -> serveHealth(exchange, true));
        server.createContext("/ready", exchange -> serveHealth(exchange, false));
        if (!config.getAdminToken().isEmpty()) {
            server.createContext("/admin/status", exchange -> serveAdmin(exchange, gateway, config.getAdminToken()));
        }
        server.start();
        httpServer = server;
    }

    /**
     * {@code /health} is liveness: the process answers. {@code /ready} is readiness: it is only
     * 200 once the card database is built, so a load balancer or the launcher waits instead of
     * sending players into a proxy whose deck validation answers FAILED. Both are unauthenticated
     * and carry no session data.
     */
    private static void serveHealth(HttpExchange exchange, boolean liveness) {
        DeckValidation.State state = DeckValidation.getState();
        boolean ready = state == DeckValidation.State.READY;
        boolean ok = liveness || ready;
        String body = "{\"ok\":" + ok + ",\"liveness\":" + liveness + ",\"ready\":" + ready
                + ",\"cardDb\":" + quote(state.name()) + ",\"sessions\":" + Activity.sessionCount()
                + ",\"threads\":" + ManagementFactory.getThreadMXBean().getThreadCount()
                + ",\"uptimeSeconds\":" + Activity.uptimeSeconds() + "}\n";
        byte[] bytes = body.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().add("Cache-Control", "no-store");
        try {
            exchange.sendResponseHeaders(ok ? 200 : 503, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        } catch (IOException ignored) {
        } finally {
            exchange.close();
        }
    }

    private static String quote(String s) {
        return "\"" + s + "\"";
    }

    /**
     * Resuelve un path de petición HTTP a un fichero dentro de webDir.
     * Devuelve null si la ruta canónica escapa de webDir (path traversal),
     * no existe, o webDir no es un directorio.
     */
    static File resolveWebFile(String webDir, String path) throws IOException {
        File base = new File(webDir).getCanonicalFile();
        if (!base.isDirectory()) {
            return null;
        }
        String p = (path == null || path.isEmpty()) ? "/" : path;
        File file = new File(base, p).getCanonicalFile();
        String filePath = file.getPath();
        String basePath = base.getPath();
        if (!filePath.equals(basePath) && !filePath.startsWith(basePath + File.separator)) {
            return null;
        }
        return file.isFile() ? file : null;
    }

    /** true si el path decodificado intenta subir de nivel (guarda para el fallback de recursos). */
    static boolean hasTraversalSegments(String path) {
        if (path == null) {
            return false;
        }
        String p = path;
        if (p.startsWith("/")) {
            p = p.substring(1);
        }
        if (p.equals("..") || p.startsWith("../") || p.contains("/../") || p.endsWith("/..")
                || p.contains("\\..") || p.startsWith("..\\")) {
            return true;
        }
        return false;
    }

    private static void serveAdmin(HttpExchange exchange, Gateway gateway, String token) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(405, -1);
            exchange.close();
            return;
        }
        // Header only: a token in the query string lands in the access log, the browser history
        // and every proxy in between (ops/status scrapes this endpoint from journald).
        String auth = exchange.getRequestHeaders().getFirst("Authorization");
        if (!token.equals(stripBearer(auth))) {
            exchange.getResponseHeaders().add("WWW-Authenticate", "Bearer");
            exchange.sendResponseHeaders(401, -1);
            exchange.close();
            return;
        }
        com.google.gson.JsonObject out = com.google.gson.JsonParser
                .parseString(Activity.snapshot()).getAsJsonObject();
        // thread and session counters: the leak this proxy had for weeks was invisible without them
        out.add("runtime", gateway.runtime());
        out.add("sessions", gateway.sessionsDetail());
        byte[] body = out.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        exchange.getResponseHeaders().add("Cache-Control", "no-store");
        exchange.sendResponseHeaders(200, body.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(body);
        }
    }

    static String stripBearer(String auth) {
        if (auth == null) {
            return "";
        }
        return auth.startsWith("Bearer ") ? auth.substring("Bearer ".length()) : "";
    }

    private static void serveFile(HttpExchange exchange, String webDir) {
        try {
            if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                exchange.close();
                return;
            }
            String path = exchange.getRequestURI().getPath();
            if (path == null || path.equals("/")) {
                path = "/index.html";
            }
            // prevent path traversal: solo ficheros dentro de webDir
            File file = resolveWebFile(webDir, path);
            if (file != null) {
                byte[] content = Files.readAllBytes(file.toPath());
                exchange.getResponseHeaders().add("Content-Type", contentType(file.getName()));
                applySecurityHeaders(exchange, path);
                exchange.sendResponseHeaders(200, content.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(content);
                }
                return;
            }
            if (hasTraversalSegments(path)) {
                exchange.sendResponseHeaders(404, -1);
                exchange.close();
                return;
            }
            // fallback: serve from the jar resources (/web/index.html)
            java.io.InputStream in = Main.class.getResourceAsStream("/web" + path);
            if (in != null) {
                byte[] content;
                try (java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        bos.write(buf, 0, n);
                    }
                    content = bos.toByteArray();
                }
                exchange.getResponseHeaders().add("Content-Type", contentType(path));
                applySecurityHeaders(exchange, path);
                exchange.sendResponseHeaders(200, content.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(content);
                }
                return;
            }
            exchange.sendResponseHeaders(404, -1);
            exchange.close();
        } catch (Exception ex) {
            try {
                exchange.sendResponseHeaders(500, -1);
            } catch (IOException ignored) {
            }
            exchange.close();
        }
    }

    /**
     * The bundled web client is code this proxy serves to every player, so the browser is told not
     * to sniff a response, not to embed it elsewhere, and only ever to run its own scripts.
     * Fingerprinted build assets may be cached forever; {@code index.html} and the splash may not,
     * or a deploy would keep serving the old client.
     */
    private static void applySecurityHeaders(HttpExchange exchange, String name) {
        exchange.getResponseHeaders().add("X-Content-Type-Options", "nosniff");
        exchange.getResponseHeaders().add("X-Frame-Options", "DENY");
        exchange.getResponseHeaders().add("Referrer-Policy", "same-origin");
        exchange.getResponseHeaders().add("Content-Security-Policy",
                "default-src 'self'; connect-src 'self' ws: wss: http: https:; "
                        + "img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; "
                        + "script-src 'self' 'unsafe-inline'; media-src 'self' data: blob:");
        if (isFingerprinted(name)) {
            exchange.getResponseHeaders().add("Cache-Control", "public, max-age=31536000, immutable");
        } else {
            exchange.getResponseHeaders().add("Cache-Control", "no-cache");
        }
    }

    /**
     * True for a Vite build output: the request path is under {@code /assets/} and the file name
     * carries the 8-character base64url hash Vite appends. That is the real signal, and it beats an
     * extension list: anything copied verbatim from {@code web/public} (sounds, logos, the splash)
     * keeps its plain name, so a deploy overwrites it and it must not be cached for a year.
     *
     * <p>Called with the request path, not the file name: the {@code /assets/} prefix only exists
     * in the path, and a bare {@code index-SpEjMz13.js} would then never be recognised.
     */
    static boolean isFingerprinted(String path) {
        String lower = path.toLowerCase(java.util.Locale.ROOT);
        int assets = lower.indexOf("/assets/");
        if (assets < 0) {
            return false;
        }
        String file = lower.substring(assets + "/assets/".length());
        int slash = file.lastIndexOf('/');
        if (slash >= 0) {
            file = file.substring(slash + 1);
        }
        int dot = file.lastIndexOf('.');
        if (dot < 9 || dot - 9 != file.lastIndexOf('-')) {
            return false;
        }
        for (int i = dot - 8; i < dot; i++) {
            char c = file.charAt(i);
            boolean base64url = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c == '_' || c == '-';
            if (!base64url) {
                return false;
            }
        }
        return true;
    }

    static String contentType(String name) {
        String lower = name.toLowerCase(java.util.Locale.ROOT);
        if (lower.endsWith(".html") || lower.endsWith(".htm")) {
            return "text/html; charset=utf-8";
        }
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) {
            return "application/javascript; charset=utf-8";
        }
        if (lower.endsWith(".css")) {
            return "text/css; charset=utf-8";
        }
        if (lower.endsWith(".json") || lower.endsWith(".map")) {
            return "application/json; charset=utf-8";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".ico")) {
            return "image/x-icon";
        }
        if (lower.endsWith(".woff2")) {
            return "font/woff2";
        }
        if (lower.endsWith(".woff")) {
            return "font/woff";
        }
        if (lower.endsWith(".ttf")) {
            return "font/ttf";
        }
        if (lower.endsWith(".otf")) {
            return "font/otf";
        }
        if (lower.endsWith(".wav")) {
            return "audio/wav";
        }
        if (lower.endsWith(".mp3")) {
            return "audio/mpeg";
        }
        if (lower.endsWith(".ogg") || lower.endsWith(".oga")) {
            return "audio/ogg";
        }
        if (lower.endsWith(".wasm")) {
            return "application/wasm";
        }
        if (lower.endsWith(".txt")) {
            return "text/plain; charset=utf-8";
        }
        if (lower.endsWith(".xml")) {
            return "application/xml; charset=utf-8";
        }
        return "application/octet-stream";
    }
}
