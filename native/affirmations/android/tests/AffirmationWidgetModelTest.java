package dev.purama.mukti.widgets;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;
import java.util.TimeZone;

/** Run on an ordinary JDK. It tests the same model/parser shipped in the Android application. */
public final class AffirmationWidgetModelTest {
    private static int checks;
    private static final String ID = "01234567-89ab-cdef-0123-456789abcdef";
    private static final String TEXT = "Je m’accorde un instant de paix.";
    private static final String DATE = "2026-11-11T05:30:48.123Z";

    public static void main(String[] args) {
        payloadValidation();
        boundaryVectors();
        compareWithJavaTime();
        System.out.println("PASS: " + checks + " Android widget model checks (pure Java; no Android host exercised).");
    }

    private static void payloadValidation() {
        String valid = payload("daily", item(ID, TEXT), DATE);
        AffirmationWidgetModel parsed = AffirmationWidgetModel.parse(valid);
        check(parsed.items.size() == 1 && TEXT.equals(parsed.items.get(0).text), "round trip accents/apostrophe");
        check(valid.equals(parsed.payload), "the validated snapshot is returned without a new source of truth");
        accepted(payload("moments", item(ID, repeat("🌿", 100)), DATE), "100 supplementary Unicode points");
        rejected(payload("daily", item(ID, repeat("🌿", 101)), DATE), "101 supplementary Unicode points");
        accepted(payload("daily", item(ID, "J’avance avec douceur."), "2024-02-29T23:59:59Z"), "leap date");
        rejected(payload("daily", item(ID, TEXT), "2025-02-29T23:59:59Z"), "invalid leap date");
        rejected(payload("daily", item(ID, TEXT), "2026-13-01T00:00:00Z"), "invalid month");
        rejected(payload("daily", item(ID, TEXT), "2026-11-11T24:00:00Z"), "invalid hour");
        rejected(payload("daily", item(ID, TEXT), "2026-11-11T00:00:60Z"), "unsupported leap second");
        rejected(payload("daily", item(ID, TEXT), "0000-01-01T00:00:00Z"), "year zero");
        rejected(payload("daily", item(ID, TEXT), "2026-11-11"), "date-only timestamp");
        rejected(payload("daily", item(ID, TEXT), "2026-11-11T00:00:00+01:00"), "contract requires ISO UTC Z");
        rejected(payload("hourly", item(ID, TEXT), DATE), "unknown cadence");
        rejected(payload("daily", "", DATE), "empty catalogue");
        rejected(payload("daily", item("custom-" + ID, TEXT), DATE), "personal ID cannot enter public snapshot");
        rejected(payload("daily", item("not-a-uuid", TEXT), DATE), "invalid catalogue ID");
        rejected(payload("daily", item(ID, TEXT) + "," + item(ID.toUpperCase(Locale.ROOT), "Autre phrase."), DATE), "case-insensitive duplicate ID");
        rejected(payload("daily", item(ID, TEXT) + "," + item(uuid(2), TEXT), DATE), "duplicate text");
        rejected(payload("daily", item(ID, "Je respire.") + "," + item(uuid(2), "JE RESPIRE."), DATE), "duplicate text case");
        rejected(payload("daily", item(ID, "Élan") + "," + item(uuid(2), "E\u0301lan"), DATE), "duplicate text normalization");
        rejected(payload("daily", item(ID, "Paix") + "," + item(uuid(2), "Ｐａｉｘ"), DATE), "duplicate NFKC compatibility form");
        rejected(payload("daily", item(ID, ""), DATE), "empty text");
        rejected(payload("daily", item(ID, "   "), DATE), "blank text");
        rejected(payload("daily", item(ID, "\u00a0\u2003"), DATE), "Unicode blank text");
        rejected(payload("daily", item(ID, "\u200d\u200b"), DATE), "format-only text");
        accepted(payload("daily", item(ID, "Un instant avec ma famille 👨‍👩‍👧."), DATE), "visible emoji with ZWJ");
        rejected(payload("daily", item(ID, " Une phrase"), DATE), "untrimmed text");
        int[] ecmaSpaces = { 0x0009, 0x000A, 0x000B, 0x000C, 0x000D, 0x0020, 0x00A0, 0x1680,
            0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
            0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF };
        for (int point : ecmaSpaces) {
            String space = new String(Character.toChars(point));
            String label = String.format(Locale.ROOT, "U+%04X", point);
            rejected(payload("daily", item(ID, space + TEXT), DATE), "leading whitespace " + label);
            rejected(payload("daily", item(ID, TEXT + space), DATE), "trailing whitespace " + label);
        }
        rejected(valid.replace(TEXT, "\\uFEFF" + TEXT), "escaped leading BOM");
        rejected(valid.replace(TEXT, TEXT + "\\uFEFF"), "escaped trailing BOM");
        for (String allowed : new String[] { "\u200BUne phrase.", "Une phrase.\u200D", "Une\uFEFF phrase." }) {
            check(AffirmationWidgetModel.parse(payload("daily", item(ID, allowed), DATE)).items.get(0).text.equals(allowed),
                "visible text with permitted format scalar is preserved");
        }
        rejected(valid.replace(TEXT, "Une\\nphrase"), "escaped newline");
        rejected(valid.replace(TEXT, "Une\nphrase"), "raw newline");
        rejected(valid.replace(TEXT, "Une\\u0000phrase"), "escaped NUL");
        rejected(valid.replace(TEXT, "Une\u0085phrase"), "C1 control");
        rejected(valid.replace(TEXT, "Une\u202ephrase"), "bidi override");
        rejected(valid.replace(TEXT, "Une\u2067phrase"), "bidi isolate");
        rejected(valid.replace(TEXT, "Une\u2028phrase"), "Unicode line separator");
        rejected(valid.replace(TEXT, "\\uD800"), "unpaired high surrogate");
        rejected(valid.replace(TEXT, "\\uDC00"), "unpaired low surrogate");
        accepted(valid.replace(TEXT, "\\uD83C\\uDF3F"), "escaped surrogate pair");
        rejected(valid.replace(TEXT, "\\u１２３４"), "non-ASCII hexadecimal escape");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":2"), "schema v2");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":\"1\""), "schema type");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":1.0"), "decimal schema version");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":01"), "leading zero");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":1e0"), "exponent not in contract");
        rejected(valid.replace("\"schemaVersion\":1", "\"schemaVersion\":1,\"schemaVersion\":1"), "duplicate object key");
        rejected(valid.replace("\"schemaVersion\":1", "\"secret\":1"), "unknown root field");
        rejected(valid.replace("\"text\":", "\"token\":"), "unknown item field");
        rejected(valid + "{}", "trailing JSON value");
        rejected(valid.replace("\"items\":[", "\"items\":[["), "wrong item type");
        rejected("null", "null root");
        rejected("[]", "array root");
        rejected(null, "null payload");

        StringBuilder thirty = new StringBuilder();
        for (int i = 0; i < 30; i++) {
            if (i > 0) thirty.append(',');
            thirty.append(item(uuid(i), "Phrase publique " + i + "."));
        }
        accepted(payload("daily", thirty.toString(), DATE), "30 entries");
        rejected(payload("daily", thirty + "," + item(uuid(31), "Une dernière phrase."), DATE), "31 entries");
        int padding = AffirmationWidgetModel.MAX_BYTES - valid.getBytes(StandardCharsets.UTF_8).length;
        accepted(valid + repeat(" ", padding), "exact UTF-8 byte limit");
        rejected(valid + repeat(" ", padding + 1), "UTF-8 byte limit exceeded");
        try {
            parsed.items.clear();
            throw new AssertionError("snapshot must be immutable");
        } catch (UnsupportedOperationException expected) {
            checks++;
        }
    }

    private static void boundaryVectors() {
        TimeZone utc = TimeZone.getTimeZone("UTC");
        at("1970-01-01T12:00:00Z", utc, "daily", 5, 0);
        at("1969-12-31T12:00:00Z", utc, "daily", 5, 4);
        at("1970-01-01T06:59:59.999Z", utc, "moments", 5, 4);
        at("1970-01-01T07:00:00Z", utc, "moments", 5, 0);
        at("1970-01-01T12:59:59.999Z", utc, "moments", 5, 0);
        at("1970-01-01T13:00:00Z", utc, "moments", 5, 1);
        at("1970-01-01T19:59:59.999Z", utc, "moments", 5, 1);
        at("1970-01-01T20:00:00Z", utc, "moments", 5, 2);
        at("1970-01-02T06:59:59.999Z", utc, "moments", 5, 2);
        at("1970-01-02T07:00:00Z", utc, "moments", 5, 3);
        at("1969-12-31T07:00:00Z", utc, "moments", 5, 2);
        at("1970-01-01T23:00:00Z", TimeZone.getTimeZone("Europe/Paris"), "daily", 5, 1);
        at("1970-01-01T23:00:00Z", utc, "daily", 5, 0);
        for (String cadence : new String[] { "daily", "moments" }) {
            at("2026-11-11T05:00:00Z", TimeZone.getTimeZone("Pacific/Kiritimati"), cadence, 1, 0);
        }
    }

    private static void compareWithJavaTime() {
        String[] zones = { "UTC", "Europe/Paris", "America/New_York", "Pacific/Auckland", "Asia/Kolkata", "Pacific/Kiritimati" };
        String[] instants = {
            "1969-12-31T23:59:59Z", "1970-01-01T00:00:00Z", "2000-02-29T23:59:59Z",
            "2026-03-29T00:59:59Z", "2026-03-29T01:00:00Z", "2026-03-29T05:59:59Z",
            "2026-03-29T06:00:00Z", "2026-10-25T00:59:59Z", "2026-10-25T01:00:00Z",
            "2026-10-25T05:59:59Z", "2026-10-25T06:00:00Z", "2026-11-11T12:00:00Z"
        };
        for (String zone : zones) for (String input : instants) for (String cadence : new String[] { "daily", "moments" }) {
            ZonedDateTime local = Instant.parse(input).atZone(ZoneId.of(zone));
            long day = local.toLocalDate().toEpochDay();
            long ordinal = day;
            if (cadence.equals("moments")) {
                int hour = local.getHour();
                int slot = hour < 7 ? 2 : hour < 13 ? 0 : hour < 20 ? 1 : 2;
                ordinal = (hour < 7 ? day - 1 : day) * 3 + slot;
            }
            for (int count : new int[] { 1, 7, 30 }) {
                int expected = (int) Math.floorMod(ordinal, count);
                at(input, TimeZone.getTimeZone(zone), cadence, count, expected);
            }
        }
    }

    private static void at(String iso, TimeZone zone, String cadence, int count, int expected) {
        int actual = AffirmationWidgetModel.indexAt(Instant.parse(iso).toEpochMilli(), zone, cadence, count);
        check(actual == expected, "rotation " + iso + " " + zone.getID() + " " + cadence + " " + count);
    }

    private static void accepted(String input, String name) {
        AffirmationWidgetModel.parse(input);
        checks++;
    }

    private static void rejected(String input, String name) {
        try {
            AffirmationWidgetModel.parse(input);
        } catch (IllegalArgumentException expected) {
            checks++;
            return;
        }
        throw new AssertionError("Should reject: " + name);
    }

    private static void check(boolean passed, String name) {
        if (!passed) throw new AssertionError(name);
        checks++;
    }

    private static String payload(String cadence, String items, String date) {
        return "{\"schemaVersion\":1,\"cadence\":\"" + cadence + "\",\"items\":[" + items + "],\"configuredAt\":\"" + date + "\"}";
    }

    private static String item(String id, String text) {
        return "{\"id\":\"" + id + "\",\"text\":\"" + text + "\"}";
    }

    private static String uuid(int value) {
        return String.format(Locale.ROOT, "%08x-0000-0000-0000-000000000000", value);
    }

    private static String repeat(String text, int count) {
        StringBuilder result = new StringBuilder();
        for (int i = 0; i < count; i++) result.append(text);
        return result.toString();
    }
}
