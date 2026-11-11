package dev.purama.mukti.widgets;

import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.GregorianCalendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Validated public-catalogue snapshot and calendar rotation; compatible with Android API 23. */
public final class AffirmationWidgetModel {
    public static final int MAX_BYTES = 20 * 1024;
    public static final int MAX_ITEMS = 30;
    public static final int MAX_TEXT_CODE_POINTS = 100;
    private static final Pattern UUID = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern UTC_DATE = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})(?:\\.\\d{1,9})?Z");
    public final String payload;
    public final String cadence;
    public final String configuredAt;
    public final List<Item> items;

    public static final class Item {
        public final String id;
        public final String text;

        private Item(String id, String text) {
            this.id = id;
            this.text = text;
        }
    }

    private AffirmationWidgetModel(String payload, String cadence, String configuredAt, List<Item> items) {
        this.payload = payload;
        this.cadence = cadence;
        this.configuredAt = configuredAt;
        this.items = Collections.unmodifiableList(items);
    }

    public static AffirmationWidgetModel parse(String payload) {
        if (payload == null || payload.length() > MAX_BYTES || payload.getBytes(StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw invalid();
        }
        Object parsed = StrictWidgetJson.parse(payload);
        if (!(parsed instanceof Map)) throw invalid();
        Map<?, ?> root = (Map<?, ?>) parsed;
        requireKeys(root, "schemaVersion", "cadence", "items", "configuredAt");
        if (!Long.valueOf(1).equals(root.get("schemaVersion"))) throw invalid();
        String cadence = string(root.get("cadence"));
        if (!"daily".equals(cadence) && !"moments".equals(cadence)) throw invalid();
        String configuredAt = string(root.get("configuredAt"));
        validateDate(configuredAt);
        Object list = root.get("items");
        if (!(list instanceof List)) throw invalid();
        List<?> values = (List<?>) list;
        if (values.isEmpty() || values.size() > MAX_ITEMS) throw invalid();
        List<Item> items = new ArrayList<>();
        Set<String> ids = new HashSet<>();
        Set<String> texts = new HashSet<>();
        for (Object value : values) {
            if (!(value instanceof Map)) throw invalid();
            Map<?, ?> item = (Map<?, ?>) value;
            requireKeys(item, "id", "text");
            String id = string(item.get("id"));
            String text = string(item.get("text"));
            if (!UUID.matcher(id).matches() || !ids.add(id.toLowerCase(Locale.ROOT))) throw invalid();
            validateText(text);
            if (!texts.add(Normalizer.normalize(text, Normalizer.Form.NFKC).toLowerCase(Locale.ROOT))) throw invalid();
            items.add(new Item(id, text));
        }
        return new AffirmationWidgetModel(payload, cadence, configuredAt, items);
    }

    public Item itemAt(long unixMillis, TimeZone timeZone) {
        return items.get(indexAt(unixMillis, timeZone, cadence, items.size()));
    }

    public static int indexAt(long unixMillis, TimeZone timeZone, String cadence, int count) {
        if (timeZone == null || count < 1 || count > MAX_ITEMS || (!"daily".equals(cadence) && !"moments".equals(cadence))) {
            throw invalid();
        }
        GregorianCalendar local = calendar(timeZone);
        local.setTimeInMillis(unixMillis);
        GregorianCalendar utcDay = calendar(TimeZone.getTimeZone("UTC"));
        utcDay.clear();
        utcDay.set(Calendar.ERA, local.get(Calendar.ERA));
        utcDay.set(local.get(Calendar.YEAR), local.get(Calendar.MONTH), local.get(Calendar.DAY_OF_MONTH), 0, 0, 0);
        long epochDay = floorDiv(utcDay.getTimeInMillis(), 86_400_000L);
        long ordinal = epochDay;
        if ("moments".equals(cadence)) {
            int hour = local.get(Calendar.HOUR_OF_DAY);
            int slot;
            if (hour < 7) {
                epochDay--;
                slot = 2;
            } else if (hour < 13) {
                slot = 0;
            } else if (hour < 20) {
                slot = 1;
            } else {
                slot = 2;
            }
            ordinal = epochDay * 3 + slot;
        }
        return (int) ((ordinal % count + count) % count);
    }

    private static void validateText(String text) {
        StrictWidgetJson.validateUnicode(text);
        int count = text.codePointCount(0, text.length());
        if (count < 1 || count > MAX_TEXT_CODE_POINTS
            || ecmaWhitespace(text.codePointAt(0)) || ecmaWhitespace(text.codePointBefore(text.length()))) throw invalid();
        boolean hasVisibleCharacter = false;
        for (int offset = 0; offset < text.length();) {
            int point = text.codePointAt(offset);
            int type = Character.getType(point);
            if (Character.isISOControl(point) || type == Character.LINE_SEPARATOR || type == Character.PARAGRAPH_SEPARATOR
                || (point >= 0x202A && point <= 0x202E) || (point >= 0x2066 && point <= 0x2069)) throw invalid();
            if (!ecmaWhitespace(point) && type != Character.FORMAT) hasVisibleCharacter = true;
            offset += Character.charCount(point);
        }
        if (!hasVisibleCharacter) throw invalid();
    }

    /** Same set as JavaScript String.trim() and /\s/; String.trim() only covers ASCII. */
    private static boolean ecmaWhitespace(int point) {
        return (point >= 0x0009 && point <= 0x000D) || point == 0x0020 || point == 0x00A0
            || point == 0x1680 || (point >= 0x2000 && point <= 0x200A) || point == 0x2028
            || point == 0x2029 || point == 0x202F || point == 0x205F || point == 0x3000 || point == 0xFEFF;
    }

    private static void validateDate(String value) {
        Matcher match = UTC_DATE.matcher(value);
        if (!match.matches()) throw invalid();
        GregorianCalendar date = calendar(TimeZone.getTimeZone("UTC"));
        date.clear();
        date.setLenient(false);
        int year = Integer.parseInt(match.group(1));
        if (year < 1) throw invalid();
        date.set(year, Integer.parseInt(match.group(2)) - 1, Integer.parseInt(match.group(3)),
            Integer.parseInt(match.group(4)), Integer.parseInt(match.group(5)), Integer.parseInt(match.group(6)));
        try {
            date.getTimeInMillis();
        } catch (IllegalArgumentException error) {
            throw invalid();
        }
    }

    private static GregorianCalendar calendar(TimeZone timeZone) {
        GregorianCalendar value = new GregorianCalendar(timeZone, Locale.ROOT);
        value.setGregorianChange(new Date(Long.MIN_VALUE));
        return value;
    }

    private static long floorDiv(long value, long divisor) {
        long quotient = value / divisor;
        return value < 0 && value % divisor != 0 ? quotient - 1 : quotient;
    }

    private static String string(Object value) {
        if (!(value instanceof String)) throw invalid();
        return (String) value;
    }

    private static void requireKeys(Map<?, ?> value, String... keys) {
        if (value.size() != keys.length || !value.keySet().containsAll(Arrays.asList(keys))) throw invalid();
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Configuration de widget invalide.");
    }
}
