package com.rovatics.cardclash;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
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
 * Card Clash runs as a self-contained HTML/JS game inside a WebView, dressed as a native app:
 * branded splash, first-run welcome tour, immersive full screen, haptics, a native share sheet
 * and an About screen.
 *
 * The game files are bundled in assets/game/ and served over https://appassets.androidplatform.net/
 * by WebViewAssetLoader rather than file://, so localStorage, the clipboard and WebRTC behave exactly
 * as they do on the website.
 */
public class MainActivity extends AppCompatActivity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/game/cardclash.html";
    private static final String HOST = "appassets.androidplatform.net";

    private WebView web;
    private long lastBackPress = 0L;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        // Must run before super.onCreate: swaps the splash theme for the normal one once we are ready.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Draw behind the system bars, then inset the WebView so the game's buttons are never covered.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        setContentView(R.layout.activity_main);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = findViewById(R.id.web);
        // Make room for the system bars, the notch AND the soft keyboard by padding the PARENT layout, so the WebView itself
        // gets smaller and the page's own viewport (and scrolling) shrinks with it. Padding the WebView directly does not work:
        // a WebView paints its page over its whole area and ignores its own padding, which left the keyboard covering the page.
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.root), (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        enterImmersive();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                   // the game saves its record in localStorage
        s.setMediaPlaybackRequiresUserGesture(false);   // sound effects
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);                             // ignore the system font scale so the game layout never breaks
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setAllowFileAccess(false);                    // not needed: assets are served over https
        s.setAllowContentAccess(false);

        // Lets us inspect the page from a computer (chrome://inspect). Debug builds only: never in the release you ship.
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        web.setBackgroundColor(0xFF06122E);
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
        else web.loadUrl(START_URL);

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
     * Back closes an open dialog, then leaves the room, and only then exits -- and exiting asks for
     * a second press, so a stray tap never drops you out of a live game.
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

    /** What the game's JavaScript can ask the app to do. */
    private final class AppBridge {
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
            else if ("reject".equals(kind)) effect = Build.VERSION.SDK_INT >= 30 ? HapticFeedbackConstants.REJECT : HapticFeedbackConstants.LONG_PRESS;
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
        web.onPause();
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
