package setu;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Reviewed crop knowledge base and sample directory data, loaded once from the classpath. */
public final class Data {
    private Data() {}

    public static final Set<String> CROPS = Set.of("paddy", "tomato", "chilli", "cotton", "maize", "groundnut", "onion", "banana");
    public static final Map<String, String> LANGS = Map.of("en", "English", "te", "Telugu", "hi", "Hindi", "ta", "Tamil", "kn", "Kannada");
    public static final Map<String, Object> KB = Json.obj(Json.parse(text("/kb.json")));
    public static final Map<String, Object> SEED = Json.obj(Json.parse(text("/seed.json")));
    public static final Map<String, Map<String, Object>> PROBLEMS = new LinkedHashMap<>();
    public static final Set<String> SYMPTOMS = new LinkedHashSet<>();

    static {
        for (Object o : Json.arr(KB.get("problems"))) {
            Map<String, Object> p = Json.obj(o);
            PROBLEMS.put((String) p.get("id"), p);
        }
        for (Object o : Json.arr(KB.get("symptoms"))) SYMPTOMS.add((String) o);
    }

    public static String text(String resource) {
        try (InputStream in = Data.class.getResourceAsStream(resource)) {
            if (in == null) throw new IllegalStateException("missing resource " + resource);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static byte[] bytes(String resource) {
        try (InputStream in = Data.class.getResourceAsStream(resource)) {
            return in == null ? null : in.readAllBytes();
        } catch (IOException e) {
            return null;
        }
    }
}
