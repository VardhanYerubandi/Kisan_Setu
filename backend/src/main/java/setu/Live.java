package setu;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Optional live mandi prices from Agmarknet (data.gov.in). Refreshed in the background at most every 6 hours. */
public final class Live {
    private Live() {}

    private static final String RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";
    private static final Map<String, String> COMMODITY = Map.of("paddy", "Paddy(Dhan)(Common)", "tomato", "Tomato", "chilli", "Dry Chillies", "cotton", "Cotton",
            "maize", "Maize", "groundnut", "Groundnut", "onion", "Onion", "banana", "Banana");
    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    public static volatile List<Map<String, Object>> rows = List.of();

    public static void refreshAsync(Store store) {
        if (Cfg.GOV_KEY.isEmpty() || !RUNNING.compareAndSet(false, true)) return;
        Thread.startVirtualThread(() -> {
            try {
                Object last = store.meta("live_prices_at");
                if (last instanceof Number n && System.currentTimeMillis() / 1000 - n.longValue() < 6 * 3600) return;
                Map<String, Object> places = Json.obj(Data.SEED.get("places"));
                List<Map<String, Object>> out = new ArrayList<>();
                for (Map.Entry<String, String> c : COMMODITY.entrySet()) {
                    for (String state : new String[]{"Andhra Pradesh", "Telangana"}) {
                        try {
                            String url = "https://api.data.gov.in/resource/" + RESOURCE + "?api-key=" + enc(Cfg.GOV_KEY) + "&format=json&limit=60"
                                    + "&filters%5Bstate.keyword%5D=" + enc(state) + "&filters%5Bcommodity%5D=" + enc(c.getValue());
                            HttpResponse<String> r = HTTP.send(HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(20)).build(), HttpResponse.BodyHandlers.ofString());
                            for (Object o : Json.arr(Json.obj(Json.parse(r.body())).get("records"))) {
                                Map<String, Object> rec = Json.obj(o);
                                try {
                                    Map<String, Object> pl = Json.obj(places.get(Json.str(rec.get("district"))));
                                    out.add(Json.map("market", Json.str(rec.get("market")), "state", state, "lat", pl.get("lat"), "lng", pl.get("lng"), "crop", c.getKey(),
                                            "min", (long) Double.parseDouble(Json.str(rec.get("min_price"))), "modal", (long) Double.parseDouble(Json.str(rec.get("modal_price"))),
                                            "max", (long) Double.parseDouble(Json.str(rec.get("max_price"))), "trend", List.of(), "source", "agmarknet", "date", Json.str(rec.get("arrival_date"))));
                                } catch (RuntimeException skip) { /* malformed record */ }
                            }
                        } catch (Exception e) {
                            System.err.println("live price fetch failed: " + c.getKey() + " " + state + " " + e);
                        }
                    }
                }
                if (!out.isEmpty()) rows = out;
                store.putMeta("live_prices_at", System.currentTimeMillis() / 1000);
            } finally {
                RUNNING.set(false);
            }
        });
    }

    private static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }
}
