package setu;

import java.util.regex.Pattern;

public final class Util {
    private Util() {}

    private static final Pattern CTRL = Pattern.compile("[\\x00-\\x1f\\x7f]");

    public static String clean(Object v, int max) {
        if (v == null) return null;
        String s = CTRL.matcher(String.valueOf(v)).replaceAll(" ").trim();
        if (s.length() > max) s = s.substring(0, max);
        return s.isEmpty() ? null : s;
    }

    public static String sniffImage(byte[] b) {
        if (b.length > 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff) return "image/jpeg";
        if (b.length > 8 && (b[0] & 0xff) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') return "image/png";
        if (b.length > 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F' && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "image/webp";
        return null;
    }

    public static double round(double v, int places) {
        double f = Math.pow(10, places);
        return Math.round(v * f) / f;
    }
}
