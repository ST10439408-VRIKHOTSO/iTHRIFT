package com.codecouture.ithrift.data

import android.content.Context
import androidx.appcompat.app.AppCompatDelegate

/**
 * The settings a customer can change, and where each one is kept.
 *
 * There are two kinds of setting in this app and they are stored in two
 * different places on purpose.
 *
 * Device settings are the appearance, the notification preferences and the
 * server address. They belong to this phone rather than to the account, so
 * they live in SharedPreferences here and survive both a restart and a
 * sign-out.
 *
 * Account settings are the name, phone number, delivery address and
 * password. They belong to the customer and must read the same on the
 * website, so they live in the database and are changed through the API
 * (GET and PUT /api/auth/profile, POST /api/auth/change-password).
 *
 * Putting a delivery address in SharedPreferences would mean a customer who
 * changed it on the website still saw the old one on the phone, which is the
 * bug this split avoids.
 */
object AppSettings {

    private const val PREFS_NAME = "ithrift_settings"
    private const val KEY_THEME = "theme_mode"
    private const val KEY_ORDER_NOTIFICATIONS = "notify_order_updates"
    private const val KEY_PROMO_NOTIFICATIONS = "notify_promotions"

    /** How the app should follow light and dark. Stored as a stable string, not an ordinal. */
    enum class ThemeMode(val stored: String, val label: String) {
        SYSTEM("system", "Follow the system setting"),
        LIGHT("light", "Always light"),
        DARK("dark", "Always dark");

        /** The AppCompat constant this mode maps to. */
        fun toNightMode(): Int = when (this) {
            SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
            DARK -> AppCompatDelegate.MODE_NIGHT_YES
        }

        companion object {
            fun fromStored(value: String?): ThemeMode =
                entries.firstOrNull { it.stored == value } ?: SYSTEM
        }
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    // --- Appearance ---------------------------------------------------------

    fun getThemeMode(context: Context): ThemeMode =
        ThemeMode.fromStored(prefs(context).getString(KEY_THEME, ThemeMode.SYSTEM.stored))

    fun setThemeMode(context: Context, mode: ThemeMode) {
        prefs(context).edit().putString(KEY_THEME, mode.stored).apply()
        applyTheme(mode)
    }

    /** Applies a theme immediately. Recreates the running activities, so the change is visible at once. */
    fun applyTheme(mode: ThemeMode) {
        AppCompatDelegate.setDefaultNightMode(mode.toNightMode())
    }

    /**
     * Called once at start-up, before any screen is shown, so the app opens
     * in the chosen theme rather than flashing the wrong one first.
     */
    fun applyStoredTheme(context: Context) = applyTheme(getThemeMode(context))

    // --- Notifications ------------------------------------------------------
    // The preference is recorded here and shown on the order confirmation
    // screen. Delivery of push notifications is not part of the prototype;
    // the setting is honoured by the app, not by a push service.

    fun orderNotificationsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ORDER_NOTIFICATIONS, true)

    fun setOrderNotificationsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_ORDER_NOTIFICATIONS, enabled).apply()
    }

    fun promotionNotificationsEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_PROMO_NOTIFICATIONS, false)

    fun setPromotionNotificationsEnabled(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean(KEY_PROMO_NOTIFICATIONS, enabled).apply()
    }

    // --- Connection ---------------------------------------------------------
    // The server address stays in SessionManager, which is where ApiClient
    // reads it. These two functions exist so the settings screen has one
    // consistent place to talk to, rather than reaching across to the session.

    fun getServerUrl(context: Context): String = SessionManager.getServerUrl(context)

    /** Saves the address and forces the next API call to build a fresh client against it. */
    fun setServerUrl(context: Context, url: String) {
        SessionManager.setServerUrl(context, url)
        ApiClient.reset()
        LookupCache.clear()
    }

    // --- Reset --------------------------------------------------------------

    /**
     * Clears cached catalogue data: the saved brand and category lists, and
     * the built API client.
     *
     * Deliberately narrow. It does not sign anyone out, and it does not reset
     * the appearance, notification or connection settings, because those are choices
     * the customer made, not cached data, and a button labelled "Clear cached
     * data" that silently undid them would be a trap. Losing a session and
     * clearing a cache are different things, and so are a preference and a
     * cache.
     */
    fun clearCachedData(context: Context) {
        LookupCache.clear()
        ApiClient.reset()
    }
}
