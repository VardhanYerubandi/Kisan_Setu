package setu;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Durable in-memory store. Every change is written to data/db.json with an atomic replace, so a crash never leaves a
 * half-written file. Fine for a pilot (thousands of records). For scale, replace this class with a JDBC/PostgreSQL
 * implementation: the rest of the backend only talks to these methods.
 */
public final class Store {
    public static final class User {
        public long id, lockedUntil, createdAt;
        public String name, phone, pinHash, salt, role, village, business, lang;
        public boolean verified;
        public int failed;

        Map<String, Object> toMap() {
            return Json.map("id", id, "name", name, "phone", phone, "pinHash", pinHash, "salt", salt, "role", role, "village", village,
                    "business", business, "lang", lang, "verified", verified, "failed", failed, "lockedUntil", lockedUntil, "createdAt", createdAt);
        }

        static User of(Map<String, Object> m) {
            User u = new User();
            u.id = ((Number) m.get("id")).longValue();
            u.name = Json.str(m.get("name")); u.phone = Json.str(m.get("phone")); u.pinHash = Json.str(m.get("pinHash")); u.salt = Json.str(m.get("salt"));
            u.role = Json.str(m.get("role")); u.village = Json.str(m.get("village")); u.business = Json.str(m.get("business")); u.lang = Json.str(m.get("lang"));
            u.verified = Boolean.TRUE.equals(m.get("verified"));
            u.failed = (int) Json.dbl(m.get("failed"), 0); u.lockedUntil = (long) Json.dbl(m.get("lockedUntil"), 0); u.createdAt = (long) Json.dbl(m.get("createdAt"), 0);
            return u;
        }

        public Map<String, Object> publicView() {
            return Json.map("id", id, "name", name, "phone", phone, "role", role, "village", village, "business", business, "verified", verified, "lang", lang);
        }
    }

    public static final class Case {
        public long id, userId, createdAt;
        public String clientId, crop, source, imageFile, status, problemId;
        public List<Object> symptoms = new ArrayList<>();
        public Double confidence, lat, lng;
        public Map<String, Object> result;

        Map<String, Object> toMap() {
            return Json.map("id", id, "clientId", clientId, "userId", userId, "crop", crop, "source", source, "symptoms", symptoms, "imageFile", imageFile,
                    "status", status, "problemId", problemId, "confidence", confidence, "result", result, "lat", lat, "lng", lng, "createdAt", createdAt);
        }

        static Case of(Map<String, Object> m) {
            Case c = new Case();
            c.id = ((Number) m.get("id")).longValue(); c.userId = ((Number) m.get("userId")).longValue(); c.createdAt = (long) Json.dbl(m.get("createdAt"), 0);
            c.clientId = Json.str(m.get("clientId")); c.crop = Json.str(m.get("crop")); c.source = Json.str(m.get("source")); c.imageFile = Json.str(m.get("imageFile"));
            c.status = Json.str(m.get("status")); c.problemId = Json.str(m.get("problemId")); c.symptoms = Json.arr(m.get("symptoms"));
            c.confidence = m.get("confidence") instanceof Number n ? n.doubleValue() : null;
            c.lat = m.get("lat") instanceof Number n ? n.doubleValue() : null; c.lng = m.get("lng") instanceof Number n ? n.doubleValue() : null;
            c.result = m.get("result") instanceof Map ? Json.obj(m.get("result")) : null;
            return c;
        }

        public Map<String, Object> view() {
            return Json.map("id", id, "client_id", clientId, "crop", crop, "source", source, "status", status, "problem_id", problemId,
                    "confidence", confidence, "result", result, "created_at", createdAt, "has_image", imageFile != null);
        }
    }

    public static final class Listing {
        public long id, userId, createdAt;
        public String clientId, crop, village, readyDate, status = "open";
        public double qtyQtl;
        public Double priceExpected, lat, lng;

        Map<String, Object> toMap() {
            return Json.map("id", id, "clientId", clientId, "userId", userId, "crop", crop, "qtyQtl", qtyQtl, "priceExpected", priceExpected, "village", village,
                    "readyDate", readyDate, "status", status, "lat", lat, "lng", lng, "createdAt", createdAt);
        }

        static Listing of(Map<String, Object> m) {
            Listing l = new Listing();
            l.id = ((Number) m.get("id")).longValue(); l.userId = ((Number) m.get("userId")).longValue(); l.createdAt = (long) Json.dbl(m.get("createdAt"), 0);
            l.clientId = Json.str(m.get("clientId")); l.crop = Json.str(m.get("crop")); l.village = Json.str(m.get("village")); l.readyDate = Json.str(m.get("readyDate"));
            l.status = Json.str(m.get("status")); l.qtyQtl = Json.dbl(m.get("qtyQtl"), 0);
            l.priceExpected = m.get("priceExpected") instanceof Number n ? n.doubleValue() : null;
            l.lat = m.get("lat") instanceof Number n ? n.doubleValue() : null; l.lng = m.get("lng") instanceof Number n ? n.doubleValue() : null;
            return l;
        }
    }

    public static final class Req {
        public long id, userId, createdAt;
        public String clientId, kind, targetId, targetName, status = "new";
        public Map<String, Object> payload = new LinkedHashMap<>();

        Map<String, Object> toMap() {
            return Json.map("id", id, "clientId", clientId, "userId", userId, "kind", kind, "targetId", targetId, "targetName", targetName,
                    "payload", payload, "status", status, "createdAt", createdAt);
        }

        static Req of(Map<String, Object> m) {
            Req r = new Req();
            r.id = ((Number) m.get("id")).longValue(); r.userId = ((Number) m.get("userId")).longValue(); r.createdAt = (long) Json.dbl(m.get("createdAt"), 0);
            r.clientId = Json.str(m.get("clientId")); r.kind = Json.str(m.get("kind")); r.targetId = Json.str(m.get("targetId")); r.targetName = Json.str(m.get("targetName"));
            r.status = Json.str(m.get("status")); r.payload = Json.obj(m.get("payload"));
            return r;
        }
    }

    private final Path dir, dbFile;
    private final List<User> users = new ArrayList<>();
    private final List<Case> cases = new ArrayList<>();
    private final List<Listing> listings = new ArrayList<>();
    private final List<Req> requests = new ArrayList<>();
    private final Map<String, Object> meta = new LinkedHashMap<>();
    private final Map<String, Long> seq = new HashMap<>();

    public Store(Path dir) throws IOException {
        this.dir = dir;
        this.dbFile = dir.resolve("db.json");
        Files.createDirectories(dir.resolve("uploads"));
        load();
    }

    public Path uploads() { return dir.resolve("uploads"); }

    public Path dir() { return dir; }

    private void load() throws IOException {
        if (!Files.exists(dbFile)) return;
        Map<String, Object> root = Json.obj(Json.parse(Files.readString(dbFile, StandardCharsets.UTF_8)));
        for (Object o : Json.arr(root.get("users"))) users.add(User.of(Json.obj(o)));
        for (Object o : Json.arr(root.get("cases"))) cases.add(Case.of(Json.obj(o)));
        for (Object o : Json.arr(root.get("listings"))) listings.add(Listing.of(Json.obj(o)));
        for (Object o : Json.arr(root.get("requests"))) requests.add(Req.of(Json.obj(o)));
        meta.putAll(Json.obj(root.get("meta")));
        for (Map.Entry<String, Object> e : Json.obj(root.get("seq")).entrySet()) seq.put(e.getKey(), ((Number) e.getValue()).longValue());
    }

    public synchronized void save() {
        try {
            Map<String, Object> root = new LinkedHashMap<>();
            root.put("seq", new LinkedHashMap<>(seq));
            root.put("meta", meta);
            root.put("users", users.stream().map(User::toMap).toList());
            root.put("cases", cases.stream().map(Case::toMap).toList());
            root.put("listings", listings.stream().map(Listing::toMap).toList());
            root.put("requests", requests.stream().map(Req::toMap).toList());
            Path tmp = dir.resolve("db.json.tmp");
            Files.writeString(tmp, Json.write(root), StandardCharsets.UTF_8);
            try {
                Files.move(tmp, dbFile, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(tmp, dbFile, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalStateException("could not save database: " + e.getMessage(), e);
        }
    }

    private long next(String kind) {
        long v = seq.getOrDefault(kind, 0L) + 1;
        seq.put(kind, v);
        return v;
    }

    // users
    public synchronized User userById(long id) { return users.stream().filter(u -> u.id == id).findFirst().orElse(null); }
    public synchronized User userByPhone(String phone) { return users.stream().filter(u -> u.phone.equals(phone)).findFirst().orElse(null); }
    public synchronized boolean hasAdmin() { return users.stream().anyMatch(u -> "admin".equals(u.role)); }
    public synchronized List<User> users() { return new ArrayList<>(users); }
    public synchronized User addUser(User u) { u.id = next("user"); users.add(u); save(); return u; }

    // cases
    public synchronized Case caseByClient(long userId, String clientId) {
        return cases.stream().filter(c -> c.userId == userId && c.clientId.equals(clientId)).findFirst().orElse(null);
    }
    public synchronized Case addCase(Case c) { c.id = next("case"); cases.add(c); save(); return c; }
    public synchronized List<Case> cases() { return new ArrayList<>(cases); }
    public synchronized Case caseById(long id) { return cases.stream().filter(c -> c.id == id).findFirst().orElse(null); }

    // listings
    public synchronized Listing listingByClient(long userId, String clientId) {
        return listings.stream().filter(l -> l.userId == userId && l.clientId.equals(clientId)).findFirst().orElse(null);
    }
    public synchronized Listing addListing(Listing l) { l.id = next("listing"); listings.add(l); save(); return l; }
    public synchronized List<Listing> listings() { return new ArrayList<>(listings); }

    // requests
    public synchronized Req requestByClient(long userId, String clientId) {
        return requests.stream().filter(r -> r.userId == userId && r.clientId.equals(clientId)).findFirst().orElse(null);
    }
    public synchronized Req addRequest(Req r) { r.id = next("request"); requests.add(r); save(); return r; }
    public synchronized List<Req> requests() { return new ArrayList<>(requests); }

    // meta
    public synchronized Object meta(String k) { return meta.get(k); }
    public synchronized void putMeta(String k, Object v) { meta.put(k, v); save(); }
}
