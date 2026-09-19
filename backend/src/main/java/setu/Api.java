package setu;

import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.regex.*;
import java.util.stream.*;

/** Every REST endpoint. Routes are declared once in the constructor; Main only turns HTTP into calls to dispatch(). */
public final class Api {
    public static final class ApiError extends RuntimeException {
        private static final long serialVersionUID = 1L;
        public final int status;
        public final String code;
        public ApiError(int status, String code) { super(code, null, false, false); this.status = status; this.code = code; }
    }

    public record Raw(String type, byte[] body) {}

    interface H { Object run(Ctx c) throws Exception; }

    private record Route(String method, Pattern pattern, H handler) {}

    /** One request. */
    public final class Ctx {
        final String method, path, ip, auth;
        final Map<String, String> query;
        final byte[] raw;
        Matcher m;
        private Map<String, Object> parsed;

        public Ctx(String method, String path, Map<String, String> query, String auth, byte[] raw, String ip) {
            this.method = method; this.path = path; this.query = query; this.auth = auth; this.raw = raw; this.ip = ip;
        }

        Map<String, Object> body() {
            if (parsed != null) return parsed;
            if (raw.length > Main.MAX_BODY) throw err(413, "too_large");
            try {
                Object o = raw.length == 0 ? new LinkedHashMap<String, Object>() : Json.parse(new String(raw, StandardCharsets.UTF_8));
                if (!(o instanceof Map)) throw new IllegalArgumentException();
                return parsed = Json.obj(o);
            } catch (RuntimeException e) {
                throw err(400, "bad_json");
            }
        }

        Store.User require(String... roles) {
            String t = auth == null ? "" : auth;
            long uid = t.startsWith("Bearer ") ? Auth.readToken(t.substring(7)) : -1;
            Store.User u = uid < 0 ? null : store.userById(uid);
            if (u == null) throw err(401, "unauthorized");
            if (roles.length > 0 && !Arrays.asList(roles).contains(u.role)) throw err(403, "forbidden");
            return u;
        }
    }

    static ApiError err(int status, String code) { return new ApiError(status, code); }

    private final Store store;
    private final List<Route> routes = new ArrayList<>();

    public Ctx newCtx(String method, String path, Map<String, String> query, String auth, byte[] raw, String ip) {
        return new Ctx(method, path, query, auth, raw, ip);
    }

    private void route(String method, String regex, H h) { routes.add(new Route(method, Pattern.compile("^" + regex + "$"), h)); }

    public Object dispatch(Ctx c) throws Exception {
        for (Route r : routes) {
            if (!r.method.equals(c.method)) continue;
            Matcher m = r.pattern.matcher(c.path);
            if (m.matches()) { c.m = m; return r.handler.run(c); }
        }
        throw err(404, "not_found");
    }

    static long now() { return System.currentTimeMillis() / 1000; }

    private static String digits10(Object v) {
        String d = String.valueOf(v == null ? "" : v).replaceAll("\\D", "");
        return d.length() > 10 ? d.substring(d.length() - 10) : d;
    }

    private static String clientId(Map<String, Object> b) {
        String cid = Util.clean(b.get("client_id"), 64);
        if (cid == null || !cid.matches("[A-Za-z0-9_-]{8,64}")) throw err(400, "bad_client_id");
        return cid;
    }

    private static double num(Object v, double lo, double hi, String field) {
        double d;
        try { d = v instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(v)); } catch (RuntimeException e) { throw err(400, "bad_" + field); }
        if (Double.isNaN(d) || d < lo || d > hi) throw err(400, "bad_" + field);
        return d;
    }

    private static Double coord(Object v, double lo, double hi) {
        try { double d = v instanceof Number n ? n.doubleValue() : Double.parseDouble(String.valueOf(v)); return d >= lo && d <= hi ? d : null; } catch (RuntimeException e) { return null; }
    }

    public Api(Store store) {
        this.store = store;
        Pattern dataUrl = Pattern.compile("^data:(image/[a-z+]+);base64,(.+)$", Pattern.DOTALL);

        route("GET", "/api/health", c -> Json.map("ok", true, "ai", Cfg.aiEnabled(), "live_prices", !Cfg.GOV_KEY.isEmpty()));

        route("POST", "/api/register", c -> {
            Map<String, Object> b = c.body();
            if (!Auth.rateOk("reg:" + c.ip, 15, 600)) throw err(429, "rate_limited");
            String name = Util.clean(b.get("name"), 60), phone = digits10(b.get("phone")), pin = b.get("pin") == null ? "" : String.valueOf(b.get("pin"));
            String role = b.get("role") == null ? "farmer" : String.valueOf(b.get("role"));
            if (name == null) throw err(400, "bad_name");
            if (!phone.matches("[6-9]\\d{9}")) throw err(400, "bad_phone");
            if (!pin.matches("\\d{4}")) throw err(400, "bad_pin");
            if (!role.equals("farmer") && !role.equals("buyer")) throw err(400, "bad_role");
            String business = role.equals("buyer") ? Util.clean(b.get("business"), 80) : null;
            if (role.equals("buyer") && business == null) throw err(400, "bad_business");
            Store.User u = new Store.User();
            u.name = name; u.phone = phone; u.salt = Auth.newSalt(); u.pinHash = Auth.hashPin(pin, u.salt); u.role = role;
            u.village = Util.clean(b.get("village"), 60); u.business = business;
            u.lang = b.get("lang") instanceof String l && Data.LANGS.containsKey(l) ? l : "en"; u.createdAt = now();
            synchronized (store) {
                if (store.userByPhone(phone) != null) throw err(409, "exists");
                store.addUser(u);
            }
            return Json.map("token", Auth.makeToken(u.id, u.role), "user", u.publicView());
        });

        route("POST", "/api/login", c -> {
            Map<String, Object> b = c.body();
            if (!Auth.rateOk("login:" + c.ip, 30, 600)) throw err(429, "rate_limited");
            String phone = digits10(b.get("phone")), pin = b.get("pin") == null ? "" : String.valueOf(b.get("pin"));
            Store.User u = store.userByPhone(phone);
            if (u == null) { Auth.hashPin(pin, "00000000000000000000000000000000"); throw err(401, "bad_login"); }
            if (u.lockedUntil > now()) throw err(429, "locked");
            boolean ok = Auth.same(Auth.hashPin(pin, u.salt), u.pinHash);   // slow hash computed outside the lock
            synchronized (store) {
                if (!ok) {
                    int fails = u.failed + 1;
                    boolean lock = fails >= 5;
                    u.failed = lock ? 0 : fails;
                    u.lockedUntil = lock ? now() + 900 : 0;
                    store.save();
                    throw err(lock ? 429 : 401, lock ? "locked" : "bad_login");
                }
                u.failed = 0; u.lockedUntil = 0; store.save();
            }
            return Json.map("token", Auth.makeToken(u.id, u.role), "user", u.publicView());
        });

        route("GET", "/api/me", c -> Json.map("user", c.require().publicView()));

        // ---- public directory (read only)
        route("GET", "/api/prices", c -> {
            Live.refreshAsync(store);
            List<Map<String, Object>> live = Live.rows;
            Set<Object> liveCrops = live.stream().map(r -> r.get("crop")).collect(Collectors.toSet());
            List<Object> out = new ArrayList<>();
            for (Object o : Json.arr(Data.SEED.get("prices"))) {
                Map<String, Object> p = Json.obj(o);
                if (liveCrops.contains(p.get("crop"))) continue;
                Map<String, Object> q = new LinkedHashMap<>(p);
                q.put("date", null);
                out.add(q);
            }
            out.addAll(live);
            return Json.map("prices", out);
        });
        route("GET", "/api/buyers", c -> Json.map("buyers", Data.SEED.get("buyers")));
        route("GET", "/api/storage", c -> Json.map("storage", Data.SEED.get("storage")));
        route("GET", "/api/transporters", c -> Json.map("transporters", Data.SEED.get("transporters")));

        // ---- crop cases
        route("POST", "/api/cases", c -> {
            Store.User u = c.require();
            Map<String, Object> b = c.body();
            String cid = clientId(b);
            synchronized (store) {
                Store.Case old = store.caseByClient(u.id, cid);
                if (old != null) return Json.map("case", old.view(), "duplicate", true);
            }
            String source = Json.str(b.get("source"));
            if (!"photo".equals(source) && !"symptoms".equals(source)) throw err(400, "bad_source");
            String crop = b.get("crop") instanceof String s && Data.CROPS.contains(s) ? s : null;
            String lang = b.get("lang") instanceof String l && Data.LANGS.containsKey(l) ? l : u.lang;
            Store.Case k = new Store.Case();
            k.clientId = cid; k.userId = u.id; k.crop = crop; k.source = source; k.status = "done"; k.createdAt = now();
            k.lat = coord(b.get("lat"), -90, 90); k.lng = coord(b.get("lng"), -180, 180);
            for (Object s : Json.arr(b.get("symptoms"))) if (s instanceof String t && Data.SYMPTOMS.contains(t) && k.symptoms.size() < 10) k.symptoms.add(t);

            if (source.equals("photo")) {
                Matcher mt = dataUrl.matcher(Json.str(b.get("image")) == null ? "" : Json.str(b.get("image")));
                if (!mt.matches()) throw err(400, "bad_image");
                byte[] raw;
                try { raw = Base64.getDecoder().decode(mt.group(2)); } catch (IllegalArgumentException e) { throw err(400, "bad_image"); }
                String media = Util.sniffImage(raw);
                if (media == null || raw.length > Main.MAX_IMAGE) throw err(400, "bad_image");
                long used;
                synchronized (store) {
                    used = store.cases().stream().filter(x -> x.userId == u.id && "photo".equals(x.source) && "done".equals(x.status) && x.createdAt > now() - 86400).count();
                }
                if (Cfg.aiEnabled() && used >= Cfg.AI_LIMIT) throw err(429, "ai_limit");
                String ext = media.equals("image/png") ? "png" : media.equals("image/webp") ? "webp" : "jpg";
                byte[] rnd = new byte[12];
                new java.security.SecureRandom().nextBytes(rnd);
                k.imageFile = HexFormat.of().formatHex(rnd) + "." + ext;
                Files.write(store.uploads().resolve(k.imageFile), raw);
                if (!Cfg.aiEnabled()) k.status = "ai_off";
                else {
                    try {
                        k.result = Ai.diagnose(raw, media, crop, lang);
                        String mid = (String) k.result.get("match_id");
                        k.problemId = Data.PROBLEMS.containsKey(mid) ? mid : null;
                        k.confidence = ((Number) k.result.get("confidence")).doubleValue();
                    } catch (Exception e) {
                        if (!Cfg.QUIET) System.err.println("AI error: " + e);
                        k.status = "error";
                    }
                }
            } else {
                Map<String, Object> lr = Json.obj(b.get("local_result"));
                List<Object> matches = new ArrayList<>();
                for (Object o : Json.arr(lr.get("matches"))) {
                    Map<String, Object> x = Json.obj(o);
                    if (x.get("id") instanceof String id && Data.PROBLEMS.containsKey(id) && matches.size() < 3) matches.add(Json.map("id", id, "confidence", Util.round(Json.dbl(x.get("confidence"), 0), 2)));
                }
                k.result = Json.map("engine", "on-device-kb", "matches", matches);
                if (!matches.isEmpty()) {
                    Map<String, Object> first = Json.obj(matches.get(0));
                    k.problemId = (String) first.get("id");
                    k.confidence = ((Number) first.get("confidence")).doubleValue();
                }
            }
            synchronized (store) {
                Store.Case again = store.caseByClient(u.id, cid);   // a concurrent retry may have won the race
                if (again != null) return Json.map("case", again.view(), "duplicate", true);
                store.addCase(k);
            }
            return Json.map("case", k.view());
        });

        route("GET", "/api/cases", c -> {
            Store.User u = c.require();
            return Json.map("cases", store.cases().stream().filter(x -> x.userId == u.id).sorted(Comparator.comparingLong((Store.Case x) -> x.createdAt).reversed())
                    .limit(100).map(Store.Case::view).toList());
        });

        // ---- produce listings
        route("POST", "/api/listings", c -> {
            Store.User u = c.require("farmer", "admin");
            Map<String, Object> b = c.body();
            String cid = clientId(b);
            String crop = Json.str(b.get("crop"));
            if (crop == null || !Data.CROPS.contains(crop)) throw err(400, "bad_crop");
            double qty = num(b.get("qty_qtl"), 0.1, 100000, "qty");
            Object pe = b.get("price_expected");
            Double price = pe == null || "".equals(pe) ? null : num(pe, 1, 1_000_000, "price");
            String ready = Util.clean(b.get("ready_date"), 10);
            if (ready != null && !ready.matches("\\d{4}-\\d{2}-\\d{2}")) ready = null;
            synchronized (store) {
                Store.Listing old = store.listingByClient(u.id, cid);
                if (old != null) return Json.map("id", old.id, "duplicate", true);
                Store.Listing l = new Store.Listing();
                l.clientId = cid; l.userId = u.id; l.crop = crop; l.qtyQtl = qty; l.priceExpected = price;
                String v = Util.clean(b.get("village"), 60);
                l.village = v != null ? v : u.village; l.readyDate = ready; l.createdAt = now();
                l.lat = coord(b.get("lat"), -90, 90); l.lng = coord(b.get("lng"), -180, 180);
                store.addListing(l);
                return Json.map("id", l.id);
            }
        });

        route("GET", "/api/listings/mine", c -> {
            Store.User u = c.require();
            return Json.map("listings", store.listings().stream().filter(l -> l.userId == u.id).sorted(Comparator.comparingLong((Store.Listing l) -> l.createdAt).reversed()).limit(100)
                    .map(l -> Json.map("id", l.id, "client_id", l.clientId, "crop", l.crop, "qty_qtl", l.qtyQtl, "price_expected", l.priceExpected, "village", l.village,
                            "ready_date", l.readyDate, "status", l.status, "created_at", l.createdAt)).toList());
        });

        route("GET", "/api/listings", c -> {
            Store.User u = c.require("buyer", "admin");
            String crop = c.query.get("crop");
            boolean canSee = u.verified || u.role.equals("admin");
            List<Object> rows = new ArrayList<>();
            for (Store.Listing l : store.listings().stream().filter(x -> "open".equals(x.status) && (crop == null || !Data.CROPS.contains(crop) || crop.equals(x.crop)))
                    .sorted(Comparator.comparingLong((Store.Listing x) -> x.createdAt).reversed()).limit(200).toList()) {
                Store.User f = store.userById(l.userId);
                rows.add(Json.map("id", l.id, "crop", l.crop, "qty_qtl", l.qtyQtl, "price_expected", l.priceExpected, "village", l.village, "ready_date", l.readyDate,
                        "created_at", l.createdAt, "lat", l.lat, "lng", l.lng, "farmer_name", f == null ? null : f.name, "farmer_phone", canSee && f != null ? f.phone : null));
            }
            return Json.map("listings", rows, "verified", canSee);
        });

        // ---- requests: buyer interest / storage enquiry / transport
        route("POST", "/api/requests", c -> {
            Store.User u = c.require("farmer", "admin");
            Map<String, Object> b = c.body();
            String cid = clientId(b), kind = Json.str(b.get("kind"));
            if (!"buyer_interest".equals(kind) && !"storage_enquiry".equals(kind) && !"transport".equals(kind)) throw err(400, "bad_kind");
            Map<String, Object> payload = new LinkedHashMap<>();
            for (Map.Entry<String, Object> e : Json.obj(b.get("payload")).entrySet()) {
                if (payload.size() >= 12) break;
                if (e.getValue() instanceof String s) payload.put(e.getKey(), Util.clean(s, 80));
                else if (e.getValue() instanceof Number n) payload.put(e.getKey(), n);
            }
            synchronized (store) {
                Store.Req old = store.requestByClient(u.id, cid);
                if (old != null) return Json.map("id", old.id, "duplicate", true);
                Store.Req r = new Store.Req();
                r.clientId = cid; r.userId = u.id; r.kind = kind; r.targetId = Util.clean(b.get("target_id"), 20); r.targetName = Util.clean(b.get("target_name"), 80);
                r.payload = payload; r.createdAt = now();
                store.addRequest(r);
                return Json.map("id", r.id);
            }
        });

        // ---- admin
        route("GET", "/api/admin/stats", c -> {
            c.require("admin");
            List<Store.User> users = store.users();
            List<Store.Case> cases = store.cases();
            List<Store.Listing> listings = store.listings();
            List<Store.Req> reqs = store.requests();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("users", users.stream().collect(Collectors.groupingBy(x -> x.role, TreeMap::new, Collectors.counting())));
            out.put("pending_buyers", users.stream().filter(x -> x.role.equals("buyer") && !x.verified).count());
            out.put("cases", cases.size());
            out.put("cases_by_source", cases.stream().collect(Collectors.groupingBy(x -> x.source, TreeMap::new, Collectors.counting())));
            out.put("cases_by_status", cases.stream().collect(Collectors.groupingBy(x -> x.status, TreeMap::new, Collectors.counting())));
            out.put("top_problems", cases.stream().filter(x -> x.problemId != null).collect(Collectors.groupingBy(x -> x.problemId, Collectors.counting())).entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey())).limit(8).map(e -> Json.map("id", e.getKey(), "n", e.getValue())).toList());
            out.put("cases_by_crop", cases.stream().collect(Collectors.groupingBy(x -> x.crop == null ? "other" : x.crop, Collectors.counting())).entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey())).map(e -> Json.map("crop", e.getKey(), "n", e.getValue())).toList());
            out.put("listings", listings.size());
            out.put("listing_qtl", listings.stream().filter(l -> "open".equals(l.status)).mapToDouble(l -> l.qtyQtl).sum());
            out.put("listings_by_crop", listings.stream().collect(Collectors.groupingBy(l -> l.crop)).entrySet().stream()
                    .sorted(Comparator.comparingInt((Map.Entry<String, List<Store.Listing>> e) -> e.getValue().size()).reversed().thenComparing(Map.Entry.comparingByKey()))
                    .map(e -> Json.map("crop", e.getKey(), "n", e.getValue().size(), "qtl", Util.round(e.getValue().stream().mapToDouble(l -> l.qtyQtl).sum(), 1))).toList());
            out.put("requests_by_kind", reqs.stream().collect(Collectors.groupingBy(r -> r.kind, TreeMap::new, Collectors.counting())));
            out.put("cases_per_day", perDay(cases.stream().map(x -> x.createdAt).toList()));
            out.put("listings_per_day", perDay(listings.stream().map(x -> x.createdAt).toList()));
            out.put("ai_enabled", Cfg.aiEnabled());
            out.put("live_prices", !Cfg.GOV_KEY.isEmpty());
            return out;
        });

        route("GET", "/api/admin/users", c -> {
            c.require("admin");
            return Json.map("users", store.users().stream().sorted(Comparator.comparingLong((Store.User x) -> x.createdAt).reversed()).limit(300)
                    .map(x -> Json.map("id", x.id, "name", x.name, "phone", x.phone, "role", x.role, "village", x.village, "business", x.business, "verified", x.verified,
                            "lang", x.lang, "created_at", x.createdAt)).toList());
        });

        route("POST", "/api/admin/verify", c -> {
            c.require("admin");
            Map<String, Object> b = c.body();
            long id = (long) Json.dbl(b.get("user_id"), 0);
            synchronized (store) {
                Store.User u = store.userById(id);
                if (u == null || !u.role.equals("buyer")) throw err(404, "not_found");
                u.verified = Boolean.TRUE.equals(b.get("verified"));
                store.save();
            }
            return Json.map("ok", true);
        });

        route("GET", "/api/admin/(cases|listings|requests)", c -> {
            c.require("admin");
            String what = c.m.group(1);
            Map<Long, Store.User> byId = store.users().stream().collect(Collectors.toMap(x -> x.id, x -> x));
            List<Object> rows = new ArrayList<>();
            switch (what) {
                case "cases" -> store.cases().stream().sorted(Comparator.comparingLong((Store.Case x) -> x.createdAt).reversed()).limit(300).forEach(x -> {
                    Store.User f = byId.get(x.userId);
                    rows.add(Json.map("id", x.id, "crop", x.crop, "source", x.source, "status", x.status, "problem_id", x.problemId, "confidence", x.confidence,
                            "has_image", x.imageFile != null, "created_at", x.createdAt, "farmer", f == null ? null : f.name, "phone", f == null ? null : f.phone));
                });
                case "listings" -> store.listings().stream().sorted(Comparator.comparingLong((Store.Listing x) -> x.createdAt).reversed()).limit(300).forEach(x -> {
                    Store.User f = byId.get(x.userId);
                    rows.add(Json.map("id", x.id, "crop", x.crop, "qty_qtl", x.qtyQtl, "price_expected", x.priceExpected, "village", x.village, "ready_date", x.readyDate,
                            "status", x.status, "created_at", x.createdAt, "farmer", f == null ? null : f.name, "phone", f == null ? null : f.phone));
                });
                default -> store.requests().stream().sorted(Comparator.comparingLong((Store.Req x) -> x.createdAt).reversed()).limit(300).forEach(x -> {
                    Store.User f = byId.get(x.userId);
                    rows.add(Json.map("id", x.id, "kind", x.kind, "target_name", x.targetName, "payload", Json.write(x.payload), "status", x.status,
                            "created_at", x.createdAt, "farmer", f == null ? null : f.name, "phone", f == null ? null : f.phone));
                });
            }
            return Json.map(what, rows);
        });

        route("GET", "/api/admin/image/(\\d+)", c -> {
            c.require("admin");
            Store.Case k = store.caseById(Long.parseLong(c.m.group(1)));
            if (k == null || k.imageFile == null) throw err(404, "not_found");
            Path f = store.uploads().resolve(Path.of(k.imageFile).getFileName());
            String type = k.imageFile.endsWith("png") ? "image/png" : k.imageFile.endsWith("webp") ? "image/webp" : "image/jpeg";
            return new Raw(type, Files.readAllBytes(f));
        });

        route("GET", "/api/admin/export/(cases|listings|requests)\\.csv", c -> {
            c.require("admin");
            StringBuilder sb = new StringBuilder();
            switch (c.m.group(1)) {
                case "cases" -> {
                    sb.append("id,client_id,user_id,crop,source,symptoms,status,problem_id,confidence,lat,lng,created_at\n");
                    for (Store.Case x : store.cases()) row(sb, x.id, x.clientId, x.userId, x.crop, x.source, Json.write(x.symptoms), x.status, x.problemId, x.confidence, x.lat, x.lng, x.createdAt);
                }
                case "listings" -> {
                    sb.append("id,client_id,user_id,crop,qty_qtl,price_expected,village,ready_date,status,lat,lng,created_at\n");
                    for (Store.Listing x : store.listings()) row(sb, x.id, x.clientId, x.userId, x.crop, x.qtyQtl, x.priceExpected, x.village, x.readyDate, x.status, x.lat, x.lng, x.createdAt);
                }
                default -> {
                    sb.append("id,client_id,user_id,kind,target_id,target_name,payload,status,created_at\n");
                    for (Store.Req x : store.requests()) row(sb, x.id, x.clientId, x.userId, x.kind, x.targetId, x.targetName, Json.write(x.payload), x.status, x.createdAt);
                }
            }
            return new Raw("text/csv; charset=utf-8", sb.toString().getBytes(StandardCharsets.UTF_8));
        });
    }

    private static void row(StringBuilder sb, Object... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) sb.append(',');
            String s = cells[i] == null ? "" : String.valueOf(cells[i]);
            if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0 && !(cells[i] instanceof Number)) s = "'" + s;   // stop spreadsheet formula injection
            if (s.contains(",") || s.contains("\"") || s.contains("\n")) s = "\"" + s.replace("\"", "\"\"") + "\"";
            sb.append(s);
        }
        sb.append('\n');
    }

    private static List<Object> perDay(List<Long> stamps) {
        long cutoff = now() - 14L * 86400;
        return stamps.stream().filter(t -> t > cutoff).collect(Collectors.groupingBy(t -> LocalDate.ofInstant(Instant.ofEpochSecond(t), ZoneOffset.UTC).toString(), TreeMap::new, Collectors.counting()))
                .entrySet().stream().map(e -> (Object) Json.map("d", e.getKey(), "n", e.getValue())).toList();
    }
}
