package setu;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

/**
 * Photo diagnosis through Claude vision. The model only CHOOSES from the reviewed problem list; it never writes treatment
 * advice. Whatever it returns is validated here, so an unknown id or an out-of-range confidence can never reach a farmer.
 */
public final class Ai {
    private Ai() {}

    private static final HttpClient HTTP = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public static Map<String, Object> diagnose(byte[] img, String media, String cropHint, String lang) throws Exception {
        StringBuilder problems = new StringBuilder();
        for (Map<String, Object> p : Data.PROBLEMS.values()) problems.append(p.get("id")).append(": ").append(p.get("crop")).append(" - ").append(p.get("en")).append('\n');
        String prompt = "Farmer says the crop is: " + (cropHint == null ? "not stated" : cropHint) + ".\n"
                + "Known problems (id: crop - name):\n" + problems + "\n"
                + "Return ONLY a JSON object with these keys:\n"
                + "\"crop_seen\": the crop you see, one lowercase English word, or \"unknown\";\n"
                + "\"match_id\": one id from the list, or \"healthy\" if the plant looks healthy, or \"unknown\" if nothing fits;\n"
                + "\"confidence\": a number from 0 to 1;\n"
                + "\"alternatives\": up to 2 other ids from the list (may be empty);\n"
                + "\"observation\": one or two short, plain sentences in " + Data.LANGS.getOrDefault(lang, "English")
                + " describing what is visible (colour and shape of spots, insects, holes). Do not give treatment advice.\n"
                + "If the photo is not a plant, use match_id \"unknown\", confidence 0 and say so in observation.";
        Map<String, Object> body = Json.map(
                "model", Cfg.AI_MODEL, "max_tokens", 500,
                "system", "You are a crop-health assistant for smallholder farmers in India. Look at one photo and decide which known problem it most likely shows. Answer with JSON only.",
                "messages", List.of(Json.map("role", "user", "content", List.of(
                        Json.map("type", "image", "source", Json.map("type", "base64", "media_type", media, "data", Base64.getEncoder().encodeToString(img))),
                        Json.map("type", "text", "text", prompt)))));
        HttpRequest req = HttpRequest.newBuilder(URI.create(Cfg.AI_BASE + "/v1/messages")).timeout(Duration.ofSeconds(40))
                .header("content-type", "application/json").header("x-api-key", Cfg.AI_KEY).header("anthropic-version", "2023-06-01")
                .POST(HttpRequest.BodyPublishers.ofString(Json.write(body))).build();
        HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() / 100 != 2) throw new IllegalStateException("AI status " + resp.statusCode());
        StringBuilder text = new StringBuilder();
        for (Object o : Json.arr(Json.obj(Json.parse(resp.body())).get("content"))) {
            Map<String, Object> blk = Json.obj(o);
            if ("text".equals(blk.get("type"))) text.append(blk.get("text"));
        }
        int a = text.indexOf("{"), z = text.lastIndexOf("}");
        Map<String, Object> raw = a >= 0 && z > a ? Json.obj(Json.parse(text.substring(a, z + 1))) : new LinkedHashMap<>();

        String match = Json.str(raw.get("match_id"));
        if (match == null || (!Data.PROBLEMS.containsKey(match) && !match.equals("healthy") && !match.equals("unknown"))) match = "unknown";
        double conf = Math.max(0, Math.min(1, Json.dbl(raw.get("confidence"), 0)));
        if (match.equals("unknown")) conf = 0;
        List<Object> alts = new ArrayList<>();
        for (Object o : Json.arr(raw.get("alternatives"))) if (o instanceof String s && Data.PROBLEMS.containsKey(s) && !s.equals(match) && alts.size() < 2) alts.add(s);
        String seen = Util.clean(raw.get("crop_seen"), 30);
        String obs = Util.clean(raw.get("observation"), 320);
        return Json.map("engine", "claude-vision", "match_id", match, "confidence", Util.round(conf, 2), "alternatives", alts,
                "crop_seen", seen == null ? "unknown" : seen, "observation", obs == null ? "" : obs);
    }
}
