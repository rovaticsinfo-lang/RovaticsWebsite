# The game logic lives in JavaScript inside assets/, so there is little to keep.
# Keep any future JavaScript bridge methods:
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
