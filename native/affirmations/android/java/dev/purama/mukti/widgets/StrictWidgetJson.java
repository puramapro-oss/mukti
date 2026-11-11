package dev.purama.mukti.widgets;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Small, bounded JSON reader for the widget contract. No Android or network dependency. */
final class StrictWidgetJson {
    private final String input;
    private int position;

    private StrictWidgetJson(String input) {
        this.input = input;
    }

    static Object parse(String input) {
        StrictWidgetJson reader = new StrictWidgetJson(input);
        Object value = reader.value(0);
        reader.whitespace();
        if (reader.position != input.length()) throw invalid();
        return value;
    }

    private Object value(int depth) {
        if (depth > 4) throw invalid();
        whitespace();
        if (position >= input.length()) throw invalid();
        char token = input.charAt(position);
        if (token == '{') return object(depth + 1);
        if (token == '[') return array(depth + 1);
        if (token == '"') return string();
        if (token == '-' || (token >= '0' && token <= '9')) return integer();
        // The v1 schema has no booleans, nulls, decimal numbers or other primitive types.
        throw invalid();
    }

    private Map<String, Object> object(int depth) {
        expect('{');
        Map<String, Object> result = new LinkedHashMap<>();
        whitespace();
        if (take('}')) return result;
        do {
            whitespace();
            String key = string();
            if (result.containsKey(key) || result.size() >= 4) throw invalid();
            whitespace();
            expect(':');
            result.put(key, value(depth));
            whitespace();
            if (take('}')) return result;
            expect(',');
        } while (true);
    }

    private List<Object> array(int depth) {
        expect('[');
        List<Object> result = new ArrayList<>();
        whitespace();
        if (take(']')) return result;
        do {
            if (result.size() >= AffirmationWidgetModel.MAX_ITEMS) throw invalid();
            result.add(value(depth));
            whitespace();
            if (take(']')) return result;
            expect(',');
        } while (true);
    }

    private Long integer() {
        int start = position;
        take('-');
        if (position >= input.length()) throw invalid();
        if (take('0')) {
            if (position < input.length() && Character.isDigit(input.charAt(position))) throw invalid();
        } else {
            if (input.charAt(position) < '1' || input.charAt(position) > '9') throw invalid();
            while (position < input.length()) {
                char c = input.charAt(position);
                if (c < '0' || c > '9') break;
                position++;
            }
        }
        try {
            return Long.valueOf(input.substring(start, position));
        } catch (NumberFormatException error) {
            throw invalid();
        }
    }

    private String string() {
        expect('"');
        StringBuilder result = new StringBuilder();
        while (position < input.length()) {
            char c = input.charAt(position++);
            if (c == '"') {
                String value = result.toString();
                validateUnicode(value);
                return value;
            }
            if (c < 0x20) throw invalid();
            if (c != '\\') {
                result.append(c);
                continue;
            }
            if (position >= input.length()) throw invalid();
            char escaped = input.charAt(position++);
            switch (escaped) {
                case '"': result.append('"'); break;
                case '\\': result.append('\\'); break;
                case '/': result.append('/'); break;
                case 'b': result.append('\b'); break;
                case 'f': result.append('\f'); break;
                case 'n': result.append('\n'); break;
                case 'r': result.append('\r'); break;
                case 't': result.append('\t'); break;
                case 'u':
                    if (position + 4 > input.length()) throw invalid();
                    int value = 0;
                    for (int i = 0; i < 4; i++) {
                        char hex = input.charAt(position++);
                        int digit = hex >= '0' && hex <= '9' ? hex - '0'
                            : hex >= 'a' && hex <= 'f' ? hex - 'a' + 10
                            : hex >= 'A' && hex <= 'F' ? hex - 'A' + 10 : -1;
                        if (digit < 0) throw invalid();
                        value = value * 16 + digit;
                    }
                    result.append((char) value);
                    break;
                default: throw invalid();
            }
        }
        throw invalid();
    }

    static void validateUnicode(String value) {
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (Character.isHighSurrogate(c)) {
                if (++i >= value.length() || !Character.isLowSurrogate(value.charAt(i))) throw invalid();
            } else if (Character.isLowSurrogate(c)) {
                throw invalid();
            }
        }
    }

    private void whitespace() {
        while (position < input.length()) {
            char c = input.charAt(position);
            if (c != ' ' && c != '\t' && c != '\r' && c != '\n') return;
            position++;
        }
    }

    private boolean take(char expected) {
        if (position < input.length() && input.charAt(position) == expected) {
            position++;
            return true;
        }
        return false;
    }

    private void expect(char expected) {
        if (!take(expected)) throw invalid();
    }

    private static IllegalArgumentException invalid() {
        return new IllegalArgumentException("Configuration de widget invalide.");
    }
}
