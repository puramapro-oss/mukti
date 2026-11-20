package dev.purama.mukti.widgets;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Exported=false; only system time/boot broadcasts and explicit in-app delivery are accepted. */
public final class AffirmationWidgetTimeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            AffirmationWidgetProvider.refreshAll(context);
        }
    }
}
