package com.rovatics.arcade;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

/**
 * Hosts one of the Rovatics games (HTML/JS bundled in assets/game/) and dresses it as a native app:
 * branded splash, first-run welcome tour, immersive full screen, haptics, a native share sheet and an About screen.
 *
 * Which game runs is decided by the product flavor: its start_page string and its own assets/game folder.
 * The pages are served over https://appassets.androidplatform.net/ by WebViewAssetLoader rather than file://, so
 * localStorage and friends behave exactly as they do on the website. The games are fully offline: no permissions.
 */
public class MainActivity extends AppCompatActivity {

    private static final String HOST = "appassets.androidplatform.net";

    private WebView web;
    private long lastBackPress = 0L;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        // Must run before super.onCreate: swaps the splash theme for the normal one once we are ready.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setContentView(R.layout.activity_main);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = findViewById(R.id.web);
        // Make room for the system bars, the notch AND the soft keyboard by padding the PARENT layout, so the WebView itself
        // gets smaller and the page's own viewport (and scrolling) shrinks with it. Padding the WebView directly does not work:
        // a WebView paints its page over its whole area and ignores its own padding.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root), (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        enterImmersive();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                   // progress and settings are saved in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);   // sound effects
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                             // ignore the system font scale so layouts never break
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);                    // not needed: assets are served over https
        s.setAllowContentAccess(false);

        // Lets us inspect the page from a computer (chrome://inspect). Debug builds only: never in the release you ship.
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        web.setBackgroundColor(getColor(R.color.brand_bg));
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        // Text selection and the context menu are blocked in the page itself (user-select + contextmenu); a native
        // long-click blocker here can swallow slow drags on some phones and stop the page scrolling.
        web.setVerticalScrollBarEnabled(true);
        web.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        web.setHapticFeedbackEnabled(true);

        // The game's Android layer (android.js) calls into these. Only our own bundled pages ever load here.
        web.addJavascriptInterface(new AppBridge(), "RovaticsApp");

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return false;   // our own pages load in the WebView
                openExternally(url);                            // anything else opens in the browser
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(gameUrl(getIntent()));

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() { handleBack(); }
        });

        // First launch: show the welcome tour on top of the game.
        if (savedInstanceState == null && !Prefs.isOnboarded(this)) {
            startActivity(new Intent(this, OnboardingActivity.class));
        }
    }

    /** Hide the status and navigation bars; a swipe from the edge shows them briefly. */
    private void enterImmersive() {
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) enterImmersive();
    }

    /**
     * Back first lets the game handle it (close a dialog, pause, return to its menu); only when the game says it has
     * nothing to do does the app ask for a second press to exit, so a stray tap never drops you out mid-game.
     */
    private void handleBack() {
        web.evaluateJavascript(
                "(function(){try{return window.__androidBack&&window.__androidBack()?'1':'0'}catch(e){return '0'}})()",
                value -> {
                    if (value != null && value.contains("1")) return;
                    long now = System.currentTimeMillis();
                    if (now - lastBackPress < 2000) {
                        finish();
                    } else {
                        lastBackPress = now;
                        Toast.makeText(MainActivity.this, R.string.press_back_again, Toast.LENGTH_SHORT).show();
                    }
                });
    }

    private void openExternally(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(this, R.string.cannot_open_link, Toast.LENGTH_SHORT).show();
        }
    }

    /** The bundled game page; a shared rovatics.com link keeps its query (?c=... challenge) so the game can react to it. */
    private String gameUrl(Intent intent) {
        String url = "https://" + HOST + "/assets/game/" + getString(R.string.start_page);
        Uri d = intent == null ? null : intent.getData();
        if (d != null && d.getEncodedQuery() != null) url += "?" + d.getEncodedQuery();
        return url;
    }

    /** A link was tapped while the app is already running. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (web == null || intent == null || intent.getData() == null) return;
        String room = intent.getData().getQueryParameter("room");
        if (room != null && room.matches("[A-Za-z0-9]{5}")) {
            // Card Clash invite while the app is open: show the Join / No thanks dialog without losing the current screen.
            web.evaluateJavascript("window.__rvInvite && window.__rvInvite('" + room + "')", null);
        } else {
            web.loadUrl(gameUrl(intent));
        }
    }

    /** What the game's JavaScript can ask the app to do. */
    private final class AppBridge {
        /** mode: landscape | auto. Racers turns the phone sideways while a race is on. */
        @JavascriptInterface
        public void orientation(String mode) {
            final int o = "landscape".equals(mode) ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_USER;
            runOnUiThread(() -> setRequestedOrientation(o));
        }

        @JavascriptInterface
        public void openAbout() {
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, AboutActivity.class)));
        }

        @JavascriptInterface
        public void share(String text) {
            if (text == null) return;
            final String t = text.length() > 500 ? text.substring(0, 500) : text;
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, t);
                startActivity(Intent.createChooser(send, getString(R.string.share_chooser)));
            });
        }

        /** kind: tick | heavy | success | reject. Uses the view's own haptics, so no VIBRATE permission is needed. */
        @JavascriptInterface
        public void haptic(String kind) {
            final int effect;
            if ("heavy".equals(kind)) effect = HapticFeedbackConstants.LONG_PRESS;
            else if ("success".equals(kind)) effect = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.CONFIRM : HapticFeedbackConstants.LONG_PRESS;
            else if ("reject".equals(kind) || "error".equals(kind)) effect = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
            else effect = HapticFeedbackConstants.VIRTUAL_KEY;
            if (web != null) web.post(() -> web.performHapticFeedback(effect));
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Card Clash keeps running so its online room (and the host's code) survives while the app is in the background.
        if (!getResources().getBoolean(R.bool.keep_alive_in_background)) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
