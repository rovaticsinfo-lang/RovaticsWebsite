package com.rovatics.cardclash;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.pm.PackageInfoCompat;

/**
 * The "About" screen: what the app is, what it does with your data, who made it and how to reach them --
 * the information a Play Store listing would show, available inside the app after installation.
 */
public class AboutActivity extends AppCompatActivity {

    // The release application id (the debug build adds a ".debug" suffix, which is not a real Play listing).
    private static final String PLAY_ID = "com.rovatics.cardclash";
    private static final String PRIVACY_URL = "https://rovatics.com/privacy.html";
    private static final String WEBSITE_URL = "https://rovatics.com";
    private static final String CONTACT_EMAIL = "info@rovatics.com";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_about);
        InsetsUtil.padForSystemBars(findViewById(R.id.root));

        Toolbar toolbar = findViewById(R.id.toolbar);
        setSupportActionBar(toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        ((TextView) findViewById(R.id.version)).setText(versionText());

        LinearLayout content = findViewById(R.id.content);
        section(content, R.string.about_h_game, R.string.about_game);
        section(content, R.string.about_h_features, R.string.about_features);
        section(content, R.string.about_h_howto, R.string.about_howto);
        section(content, R.string.about_h_privacy, R.string.about_privacy);
        section(content, R.string.about_h_notice, R.string.about_notice);
        section(content, R.string.about_h_credits, R.string.about_credits);

        button(content, R.string.about_btn_share, true, v -> shareApp());
        button(content, R.string.about_btn_rate, false, v -> rateApp());
        button(content, R.string.about_btn_tour, false, v -> startActivity(new Intent(this, OnboardingActivity.class)));
        button(content, R.string.about_btn_privacy, false, v -> open(Uri.parse(PRIVACY_URL)));
        button(content, R.string.about_btn_website, false, v -> open(Uri.parse(WEBSITE_URL)));
        button(content, R.string.about_btn_contact, false, v -> contact());
    }

    private String versionText() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            long code = PackageInfoCompat.getLongVersionCode(info);
            return getString(R.string.about_version, info.versionName, (int) code);
        } catch (PackageManager.NameNotFoundException e) {
            return "";
        }
    }

    private int dp(int v) { return (int) (v * getResources().getDisplayMetrics().density + .5f); }

    private void section(LinearLayout parent, @StringRes int heading, @StringRes int body) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundResource(R.drawable.bg_card);
        card.setPadding(dp(18), dp(16), dp(18), dp(16));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.topMargin = dp(12);
        card.setLayoutParams(lp);

        TextView h = new TextView(this);
        h.setText(heading);
        h.setTextColor(getColor(R.color.brand_accent));
        h.setTextSize(16);
        h.setTypeface(h.getTypeface(), android.graphics.Typeface.BOLD);

        TextView b = new TextView(this);
        b.setText(body);
        b.setTextColor(getColor(R.color.text_primary));
        b.setTextSize(15);
        b.setLineSpacing(0, 1.18f);
        b.setPadding(0, dp(8), 0, 0);
        b.setTextIsSelectable(true);

        card.addView(h);
        card.addView(b);
        parent.addView(card);
    }

    private void button(LinearLayout parent, @StringRes int label, boolean primary, View.OnClickListener l) {
        Button btn = new Button(this);
        btn.setText(label);
        btn.setAllCaps(false);
        btn.setTextSize(16);
        btn.setStateListAnimator(null);
        btn.setGravity(Gravity.CENTER);
        btn.setBackgroundResource(primary ? R.drawable.bg_btn_primary : R.drawable.bg_btn_secondary);
        btn.setTextColor(primary ? 0xFF04142D : getColor(R.color.text_primary));
        btn.setTypeface(btn.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
        lp.topMargin = dp(primary ? 18 : 10);
        btn.setLayoutParams(lp);
        btn.setOnClickListener(l);
        parent.addView(btn);
    }

    private void shareApp() {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, getString(R.string.share_app_text));
        startActivity(Intent.createChooser(send, getString(R.string.share_chooser)));
    }

    private void rateApp() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + PLAY_ID)));
        } catch (ActivityNotFoundException e) {
            open(Uri.parse("https://play.google.com/store/apps/details?id=" + PLAY_ID));
        }
    }

    private void contact() {
        Intent mail = new Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:" + CONTACT_EMAIL))
                .putExtra(Intent.EXTRA_SUBJECT, getString(R.string.contact_subject));
        try {
            startActivity(mail);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, CONTACT_EMAIL, Toast.LENGTH_LONG).show();
        }
    }

    private void open(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.cannot_open_link, Toast.LENGTH_SHORT).show();
        }
    }
}
