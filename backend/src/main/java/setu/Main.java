package setu;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.zip.GZIPOutputStream;

/**
 * Kisan Setu backend: Java 21, JDK only (no Maven dependencies).
 * Serves the React app from the classpath (public/) and the REST API under /api.
 */
public final class Main {
    public static final int MAX_BODY = 6 * 1024 * 1024, MAX_IMAGE = 1_500_000;
    private static final Map<String, String> MIME = Map.ofEntries(
            Map.entry("html", "text/html; charset=utf-8"), Map.entry("js", "text/javascript; charset=utf-8"), Map.entry("css", "text/css; charset=utf-8"),
            Map.entry("json", "application/json; charset=utf-8"), Map.entry("webmanifest", "application/manifest+json"), Map.entry("svg", "image/svg+xml"),
            Map.entry("png", "image/png"), Map.entry("jpg", "image/jpeg"), Map.entry("ico", "image/x-icon"), Map.entry("mp4", "video/mp4"), Map.entry("txt", "text/plain; charset=utf-8"));
    private static final Map<String, String> SECURITY = Map.of(
            "X-Content-Type-Options", "nosniff", "Referrer-Policy", "no-referrer", "X-Frame-Options", "DENY",
            "Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self)",
            "Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-ancestors 'none'");

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(Cfg.DATA_DIR);
        Files.createDirectories(dir);
        Store store = new Store(dir);
        Auth.init(dir);
        ensureAdmin(store);
        Api api = new Api(store);
        HttpServer server = HttpServer.create(new InetSocketAddress(Cfg.HOST, Cfg.PORT), 0);
        server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
        server.createContext("/", ex -> handle(ex, api));
        server.start();
        System.out.println("Kisan Setu running at http://" + Cfg.HOST + ":" + Cfg.PORT + "   admin console: /admin");
        System.out.println("  photo diagnosis (Claude vision): " + (Cfg.aiEnabled() ? "ON  (" + Cfg.AI_MODEL + ")" : "OFF - set ANTHROPIC_API_KEY"));
        System.out.println("  live mandi prices (Agmarknet):   " + (Cfg.GOV_KEY.isEmpty() ? "OFF - using sample prices; set DATA_GOV_API_KEY" : "ON"));
    }

    private static void ensureAdmin(Store store) {
        if (store.hasAdmin()) return;
        String phone = Cfg.env("ADMIN_PHONE", "9000000000");
        String pin = Cfg.env("ADMIN_PIN", "");
        if (pin.isEmpty()) { SecureRandom r = new SecureRandom(); pin = String.format("%06d", r.nextInt(1_000_000)); }
        Store.User u = new Store.User();
        u.name = "Administrator"; u.phone = phone; u.salt = Auth.newSalt(); u.pinHash = Auth.hashPin(pin, u.salt); u.role = "admin"; u.verified = true; u.lang = "en"; u.createdAt = Api.now();
        store.addUser(u);
        System.out.println("\n  Admin account created - phone " + phone + "  PIN " + pin);
        System.out.println("  (shown once; set ADMIN_PHONE / ADMIN_PIN before the first run to choose your own)\n");
    }

    private static String clientIp(HttpExchange ex) {
        String remote = ex.getRemoteAddress().getAddress().getHostAddress();
        String xff = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (Cfg.TRUST_PROXY > 0 && xff != null) {
            String[] p = Arrays.stream(xff.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
            if (p.length >= Cfg.TRUST_PROXY) return p[p.length - Cfg.TRUST_PROXY];   // proxies append, so count from the right
        }
        return remote;
    }

    private static Map<String, String> query(String raw) {
        Map<String, String> q = new HashMap<>();
        if (raw == null) return q;
        for (String kv : raw.split("&")) {
            int i = kv.indexOf('=');
            if (i > 0) q.put(URLDecoder.decode(kv.substring(0, i), StandardCharsets.UTF_8), URLDecoder.decode(kv.substring(i + 1), StandardCharsets.UTF_8));
        }
        return q;
    }

    private static void handle(HttpExchange ex, Api api) throws IOException {
        int status = 200;
        try {
            String method = ex.getRequestMethod(), path = ex.getRequestURI().getPath();
            if (path.startsWith("/api/")) {
                byte[] body = ex.getRequestBody().readNBytes(MAX_BODY + 1);
                try {
                    Api.Ctx c = api.newCtx(method, path, query(ex.getRequestURI().getRawQuery()), ex.getRequestHeaders().getFirst("Authorization"), body, clientIp(ex));
                    Object res = api.dispatch(c);
                    if (res instanceof Api.Raw r) send(ex, 200, r.type(), r.body(), false);
                    else send(ex, 200, "application/json; charset=utf-8", Json.write(res).getBytes(StandardCharsets.UTF_8), false);
                } catch (Api.ApiError e) {
                    status = e.status;
                    send(ex, e.status, "application/json; charset=utf-8", Json.write(Json.map("error", e.code)).getBytes(StandardCharsets.UTF_8), false);
                } catch (Exception e) {
                    status = 500;
                    System.err.println("500 " + path + ": " + e);
                    send(ex, 500, "application/json; charset=utf-8", Json.write(Json.map("error", "server_error")).getBytes(StandardCharsets.UTF_8), false);
                }
                return;
            }
            if (!method.equals("GET")) {
                status = 405;
                send(ex, 405, "application/json; charset=utf-8", Json.write(Json.map("error", "method_not_allowed")).getBytes(StandardCharsets.UTF_8), false);
                return;
            }
            String p = path.equals("/") ? "/index.html" : path.equals("/admin") ? "/admin.html" : path;
            String last = p.substring(p.lastIndexOf('/') + 1);
            byte[] data = p.contains("..") || p.contains("\\") || p.indexOf('\0') >= 0 || !last.contains(".") ? null : Data.bytes("/public" + p);
            if (data == null) {
                status = 404;
                send(ex, 404, "application/json; charset=utf-8", Json.write(Json.map("error", "not_found")).getBytes(StandardCharsets.UTF_8), false);
                return;
            }
            String ext = last.substring(last.lastIndexOf('.') + 1).toLowerCase();
            send(ex, 200, MIME.getOrDefault(ext, "application/octet-stream"), data, true);
        } finally {
            if (!Cfg.QUIET) System.err.println(ex.getRemoteAddress().getAddress().getHostAddress() + " \"" + ex.getRequestMethod() + " " + ex.getRequestURI().getPath() + "\" " + status);
            ex.close();
        }
    }

    private static void send(HttpExchange ex, int status, String type, byte[] body, boolean isStatic) throws IOException {
        Headers h = ex.getResponseHeaders();
        h.set("Content-Type", type);
        SECURITY.forEach(h::set);
        h.set("Cache-Control", isStatic ? "no-cache" : "no-store");
        boolean gz = body.length > 860 && (type.startsWith("text/") || type.contains("json") || type.contains("javascript") || type.contains("svg"))
                && String.valueOf(ex.getRequestHeaders().getFirst("Accept-Encoding")).contains("gzip");
        if (gz) {
            ByteArrayOutputStream bo = new ByteArrayOutputStream();
            try (GZIPOutputStream g = new GZIPOutputStream(bo)) { g.write(body); }
            body = bo.toByteArray();
            h.set("Content-Encoding", "gzip");
            h.set("Vary", "Accept-Encoding");
        }
        ex.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
        if (body.length > 0) try (OutputStream os = ex.getResponseBody()) { os.write(body); }
    }
}
