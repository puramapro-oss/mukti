package dev.purama.mukti;

import static org.junit.Assert.*;

import android.app.Instrumentation;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.Settings;
import android.webkit.WebView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.core.app.ApplicationProvider;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import com.getcapacitor.Bridge;
import com.getcapacitor.WebViewListener;
import dev.purama.mukti.widgets.AffirmationWidgetProvider;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class WrapperInstrumentedTest {
    private static final String ORIGIN = "https://mukti.purama.dev";
    private static final String WIDGET_ROUTE = ORIGIN + "/dashboard/subconscient/ecran-verrouille";

    @Test public void startsProductActivityWithItsWebViewAndRegisteredPlugins() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertEquals("dev.purama.mukti", activity.getPackageName());
                assertEquals(1, Settings.Global.getInt(activity.getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0));
                Bridge bridge = activity.getBridge();
                assertNotNull(bridge.getWebView());
                assertEquals(ORIGIN, bridge.getServerUrl());
                assertEquals(Uri.parse(ORIGIN).getHost(), Uri.parse(bridge.getAppUrl()).getHost());
                for (String id : new String[]{"App", "Haptics", "Preferences", "PushNotifications", "SplashScreen", "StatusBar", "AffirmationWidget"}) {
                    assertNotNull(id, bridge.getPlugin(id));
                }
            });
        }
    }

    @Test public void androidResolvesTheLauncherArtAndWidgetResources() throws Exception {
        Context context = ApplicationProvider.getApplicationContext();
        PackageManager manager = context.getPackageManager();
        assertEquals("MUKTI", manager.getApplicationLabel(context.getApplicationInfo()).toString());
        assertNotNull(manager.getApplicationIcon(context.getPackageName()));
        for (String key : new String[]{"drawable/splash", "mipmap/ic_launcher", "xml/purama_affirmation_widget_info"}) {
            assertNotEquals(key, 0, context.getResources().getIdentifier(key, null, context.getPackageName()));
        }
        ComponentName widget = new ComponentName(context, AffirmationWidgetProvider.class);
        assertNotNull(manager.getReceiverInfo(widget, PackageManager.GET_META_DATA).metaData.get("android.appwidget.provider"));
    }

    @Test public void openingTheWidgetOnAnExistingActivityRequestsItsFixedRoute() {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        Intent launcher = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        assertNotNull(launcher);
        launcher.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        MainActivity activity = (MainActivity) instrumentation.startActivitySync(launcher);
        AtomicBoolean seen = new AtomicBoolean();
        try {
            instrumentation.runOnMainSync(() -> {
                activity.getBridge().addWebViewListener(new WebViewListener() {
                    @Override public void onPageStarted(WebView view) { observe(view, seen); }
                    @Override public void onPageLoaded(WebView view) { observe(view, seen); }
                    @Override public void onReceivedError(WebView view) { observe(view, seen); }
                });
                Intent open = new Intent(activity, MainActivity.class)
                    .setAction(AffirmationWidgetProvider.ACTION_OPEN)
                    .putExtra(AffirmationWidgetProvider.EXTRA_OPEN, true)
                    .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
                activity.startActivity(open);
            });
            long until = SystemClock.elapsedRealtime() + 15000;
            while (!seen.get() && SystemClock.elapsedRealtime() < until) {
                instrumentation.runOnMainSync(() -> observe(activity.getBridge().getWebView(), seen));
                SystemClock.sleep(100);
            }
            assertTrue("Expected the product WebView to request " + WIDGET_ROUTE, seen.get());
        } finally {
            // MainActivity consumes and replaces the widget intent. Close the original
            // instance directly so cleanup does not depend on matching the launch intent.
            instrumentation.runOnMainSync(activity::finishAndRemoveTask);
            instrumentation.waitForIdleSync();
        }
    }

    private static void observe(WebView view, AtomicBoolean seen) {
        if (WIDGET_ROUTE.equals(view.getUrl()) || WIDGET_ROUTE.equals(view.getOriginalUrl())) seen.set(true);
    }
}
