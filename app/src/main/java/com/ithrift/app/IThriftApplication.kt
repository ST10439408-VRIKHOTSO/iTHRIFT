package com.ithrift.app

import android.app.Application
import android.util.Log
import com.ithrift.app.data.AppSettings

/**
 * Applies the saved appearance setting before any screen is created.
 *
 * Doing this in MainActivity.onCreate() would be too late: the activity is
 * already being laid out in the previous theme, so switching it there makes
 * the app flash light and then go dark on every launch. Application.onCreate
 * runs first, which is why this class exists at all.
 *
 * Reference: AppCompatDelegate.setDefaultNightMode,
 * https://developer.android.com/reference/androidx/appcompat/app/AppCompatDelegate
 */
class IThriftApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        val mode = AppSettings.getThemeMode(this)
        Log.d(TAG, "Starting with theme: ${mode.stored}")
        AppSettings.applyTheme(mode)
    }

    private companion object {
        const val TAG = "iTHRIFT"
    }
}
