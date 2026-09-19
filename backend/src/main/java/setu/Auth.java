package setu;

import javax.crypto.Mac;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.*;

/** PIN hashing (PBKDF2), signed tokens (HMAC-SHA256) and a simple in-memory rate limiter. */
public final class Auth {
    private Auth() {}

    private static final SecureRandom RNG = new SecureRandom();
    private static final long TOKEN_TTL = 60L * 60 * 24 * 30;
    private static byte[] secret;
    private static final Map<String, Deque<Long>> HITS = new HashMap<>();

    public static void init(Path dir) throws IOException {
        Path f = dir.resolve("secret.key");
        if (!Files.exists(f)) {
            byte[] b = new byte[32];
            RNG.nextBytes(b);
            Files.writeString(f, HexFormat.of().formatHex(b));
            try {
                Files.setPosixFilePermissions(f, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) { /* non-POSIX filesystem */ }
        }
        secret = HexFormat.of().parseHex(Files.readString(f).trim());
    }

    public static String newSalt() {
        byte[] b = new byte[16];
        RNG.nextBytes(b);
        return HexFormat.of().formatHex(b);
    }

    public static String hashPin(String pin, String saltHex) {
        try {
            PBEKeySpec spec = new PBEKeySpec(pin.toCharArray(), HexFormat.of().parseHex(saltHex), 150_000, 256);
            return HexFormat.of().formatHex(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded());
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static boolean same(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.UTF_8), b.getBytes(StandardCharsets.UTF_8));
    }

    private static String b64(byte[] b) { return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }

    private static String sign(String payload) {
        try {
            Mac m = Mac.getInstance("HmacSHA256");
            m.init(new SecretKeySpec(secret, "HmacSHA256"));
            return b64(m.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public static String makeToken(long uid, String role) {
        String payload = b64(Json.write(Json.map("u", uid, "r", role, "e", System.currentTimeMillis() / 1000 + TOKEN_TTL)).getBytes(StandardCharsets.UTF_8));
        return payload + "." + sign(payload);
    }

    /** Returns the user id if the token is genuine and unexpired, otherwise -1. */
    public static long readToken(String tok) {
        try {
            int dot = tok.indexOf('.');
            if (dot < 1 || tok.indexOf('.', dot + 1) >= 0) return -1;
            String payload = tok.substring(0, dot);
            if (!same(tok.substring(dot + 1), sign(payload))) return -1;
            Map<String, Object> m = Json.obj(Json.parse(new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8)));
            return ((Number) m.get("e")).longValue() > System.currentTimeMillis() / 1000 ? ((Number) m.get("u")).longValue() : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    public static synchronized boolean rateOk(String key, int limit, int windowSec) {
        long now = System.currentTimeMillis();
        Deque<Long> d = HITS.computeIfAbsent(key, k -> new ArrayDeque<>());
        while (!d.isEmpty() && now - d.peekFirst() > windowSec * 1000L) d.pollFirst();
        if (d.size() >= limit) return false;
        d.addLast(now);
        return true;
    }
}
