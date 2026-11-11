package dev.purama.mukti.widgets;

import android.content.Context;
import android.content.SharedPreferences;

/** This cache contains a deliberately selected public catalogue snapshot, never a session or token. */
final class AffirmationWidgetStore {
    static final String PREFERENCES_FILE = "purama_affirmations_widget";
    static final String PAYLOAD_KEY = "affirmationWidget.v1";

    private AffirmationWidgetStore() {}

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFERENCES_FILE, Context.MODE_PRIVATE);
    }

    static AffirmationWidgetModel read(Context context) {
        try {
            String value = preferences(context).getString(PAYLOAD_KEY, null);
            return value == null ? null : AffirmationWidgetModel.parse(value);
        } catch (IllegalArgumentException | ClassCastException error) {
            // A corrupt or obsolete cache must never become a visible success or crash the host.
            return null;
        }
    }

    static boolean save(Context context, AffirmationWidgetModel model) {
        return preferences(context).edit().putString(PAYLOAD_KEY, model.payload).commit();
    }

    static boolean clear(Context context) {
        return preferences(context).edit().remove(PAYLOAD_KEY).commit();
    }
}
