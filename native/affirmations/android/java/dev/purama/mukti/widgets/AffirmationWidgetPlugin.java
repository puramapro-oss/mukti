package dev.purama.mukti.widgets;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AffirmationWidget")
public final class AffirmationWidgetPlugin extends Plugin {
    @PluginMethod
    public void getState(PluginCall call) {
        withTrustedPage(call, () -> onWorker(call, () -> {
            boolean supported = supportsWidgets();
            AffirmationWidgetModel model = supported ? AffirmationWidgetStore.read(getContext()) : null;
            JSObject state = new JSObject();
            state.put("supported", supported);
            state.put("configured", model != null);
            state.put("installed", supported && AppWidgetManager.getInstance(getContext()) != null && AppWidgetManager.getInstance(getContext())
                .getAppWidgetIds(new ComponentName(getContext(), AffirmationWidgetProvider.class)).length > 0);
            if (model != null) state.put("payload", model.payload);
            call.resolve(state);
        }));
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String payload = call.getString("payload");
        final AffirmationWidgetModel model;
        try {
            model = AffirmationWidgetModel.parse(payload);
        } catch (IllegalArgumentException error) {
            call.reject("Configuration de widget invalide.", "INVALID_PAYLOAD");
            return;
        }
        withTrustedPage(call, () -> onWorker(call, () -> {
            if (!supportsWidgets()) {
                call.reject("Les widgets ne sont pas disponibles sur cet appareil.", "UNSUPPORTED");
                return;
            }
            if (!AffirmationWidgetStore.save(getContext(), model)) {
                call.reject("Enregistrement du widget non confirmé. Réessaie.", "SAVE_FAILED");
                return;
            }
            AffirmationWidgetProvider.refreshAll(getContext());
            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        }));
    }

    @PluginMethod
    public void clear(PluginCall call) {
        withTrustedPage(call, () -> onWorker(call, () -> {
            if (!AffirmationWidgetStore.clear(getContext())) {
                call.reject("Effacement du widget non confirmé. Réessaie.", "CLEAR_FAILED");
                return;
            }
            AffirmationWidgetProvider.refreshAll(getContext());
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        }));
    }

    @PluginMethod
    public void requestPin(PluginCall call) {
        // A launcher request is not proof that the user has added the widget.
        withTrustedPage(call, () -> {
            boolean requested = false;
            if (supportsWidgets() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AppWidgetManager manager = AppWidgetManager.getInstance(getContext());
                try {
                    if (manager.isRequestPinAppWidgetSupported()) {
                        requested = manager.requestPinAppWidget(
                            new ComponentName(getContext(), AffirmationWidgetProvider.class), null, null);
                    }
                } catch (IllegalStateException | SecurityException error) {
                    call.reject("Ouvre MUKTI au premier plan pour demander l'ajout du widget.", "PIN_UNAVAILABLE");
                    return;
                }
            }
            JSObject result = new JSObject();
            result.put("requested", requested);
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnResume() {
        // Recompute using the current local day after a return to the application.
        execute(() -> AffirmationWidgetProvider.refreshAll(getContext()));
    }

    private boolean supportsWidgets() {
        return getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_APP_WIDGETS);
    }

    private void onWorker(PluginCall call, Runnable action) {
        execute(() -> {
            try {
                action.run();
            } catch (RuntimeException error) {
                call.reject("Résultat du widget non confirmé. Rouvre MUKTI pour vérifier.", "NATIVE_FAILURE");
            }
        });
    }

    private void withTrustedPage(PluginCall call, Runnable action) {
        if (getActivity() == null || getBridge() == null) {
            call.reject("Application indisponible. Rouvre MUKTI.", "UNAVAILABLE");
            return;
        }
        getBridge().executeOnMainThread(() -> {
            String current = getBridge().getWebView() == null ? null : getBridge().getWebView().getUrl();
            Uri uri = current == null ? null : Uri.parse(current);
            if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())
                || !"mukti.purama.dev".equalsIgnoreCase(uri.getHost())
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
                call.reject("Cette page ne peut pas configurer le widget.", "UNTRUSTED_ORIGIN");
                return;
            }
            try {
                action.run();
            } catch (RuntimeException error) {
                call.reject("Résultat du widget non confirmé. Rouvre MUKTI pour vérifier.", "NATIVE_FAILURE");
            }
        });
    }
}
