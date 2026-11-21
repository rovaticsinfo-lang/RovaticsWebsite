package com.rovatics.arcade;

import android.content.Context;
import android.content.SharedPreferences;

/** Tiny native settings store (each game keeps its own progress in the WebView's localStorage). */
final class Prefs {
    private static final String FILE = "arcade_app";
    private static final String KEY_ONBOARDED = "onboarded";

    private Prefs() {}

    private static SharedPreferences sp(Context c) { return c.getSharedPreferences(FILE, Context.MODE_PRIVATE); }

    static boolean isOnboarded(Context c) { return sp(c).getBoolean(KEY_ONBOARDED, false); }

    static void setOnboarded(Context c, boolean v) { sp(c).edit().putBoolean(KEY_ONBOARDED, v).apply(); }
}
