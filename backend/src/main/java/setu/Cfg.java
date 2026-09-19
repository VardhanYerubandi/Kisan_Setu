package setu;

/** All configuration comes from environment variables, so nothing secret lives in the code. */
public final class Cfg {
    private Cfg() {}

    static String env(String k, String d) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? d : v;
    }

    public static final int PORT = Integer.parseInt(env("PORT", "8080"));
    public static final String HOST = env("HOST", "127.0.0.1");
    public static final String DATA_DIR = env("KS_DATA", "data");
    public static final String AI_KEY = env("ANTHROPIC_API_KEY", "");
    public static final String AI_MODEL = env("ANTHROPIC_MODEL", "claude-sonnet-5");
    public static final String AI_BASE = env("ANTHROPIC_BASE_URL", "https://api.anthropic.com").replaceAll("/+$", "");
    public static final int AI_LIMIT = Integer.parseInt(env("AI_DAILY_LIMIT", "20"));
    public static final String GOV_KEY = env("DATA_GOV_API_KEY", "");
    public static final int TRUST_PROXY = Integer.parseInt(env("TRUST_PROXY", "0"));
    public static final boolean QUIET = "1".equals(env("KS_QUIET", "0"));
    public static boolean aiEnabled() { return !AI_KEY.isEmpty(); }
}
