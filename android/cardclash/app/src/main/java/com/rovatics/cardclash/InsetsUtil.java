package com.rovatics.cardclash;

import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Edge-to-edge is forced from targetSdk 35, so native screens must pad themselves clear of the system bars. */
final class InsetsUtil {
    private InsetsUtil() {}

    static void padForSystemBars(View root) {
        final int l = root.getPaddingLeft(), t = root.getPaddingTop(), r = root.getPaddingRight(), b = root.getPaddingBottom();
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(l + bars.left, t + bars.top, r + bars.right, b + bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
