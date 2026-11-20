package dev.purama.mukti.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.widget.RemoteViews;

import java.util.TimeZone;

import dev.purama.mukti.MainActivity;
import dev.purama.mukti.R;

/** A local, text-only RemoteViews widget. No foreground service, alarm, network or notification. */
public final class AffirmationWidgetProvider extends AppWidgetProvider {
    public static final String ACTION_OPEN = "dev.purama.mukti.action.OPEN_AFFIRMATION_WIDGET";
    public static final String EXTRA_OPEN = "dev.purama.mukti.extra.AFFIRMATION_WIDGET";
    public static final String DESTINATION = "https://mukti.purama.dev/dashboard/subconscient/ecran-verrouille";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        render(context, manager, new int[] { id });
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        render(context, manager, manager.getAppWidgetIds(new ComponentName(context, AffirmationWidgetProvider.class)));
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        AffirmationWidgetModel model = AffirmationWidgetStore.read(context);
        String text = model == null
            ? context.getString(R.string.purama_affirmation_widget_empty)
            : model.itemAt(System.currentTimeMillis(), TimeZone.getDefault()).text;
        String footer = context.getString(model == null
            ? R.string.purama_affirmation_widget_configure : R.string.purama_affirmation_widget_open);
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(ACTION_OPEN)
            .putExtra(EXTRA_OPEN, true)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 7411, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.purama_affirmation_widget);
            view.setTextViewText(R.id.purama_affirmation_text, text);
            view.setTextViewText(R.id.purama_affirmation_action, footer);
            view.setContentDescription(R.id.purama_affirmation_root, text + ". " + footer);
            view.setOnClickPendingIntent(R.id.purama_affirmation_root, open);
            try {
                manager.updateAppWidget(id, view);
            } catch (IllegalArgumentException | SecurityException error) {
                // The launcher may delete an instance between the query and this update.
                // Never log the payload or imply that a requested update reached the screen.
                Log.w("AffirmationWidget", "Widget update not accepted by the host.");
            }
        }
    }
}
