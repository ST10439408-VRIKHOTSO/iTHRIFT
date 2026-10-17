package com.codecouture.ithrift.data

import androidx.appcompat.app.AppCompatDelegate
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for the appearance setting.
 *
 * The value is written to SharedPreferences as a string ("system", "light",
 * "dark") rather than as an enum ordinal on purpose, and this is the test
 * that keeps it that way. Storing an ordinal would mean that inserting a
 * fourth theme into the middle of the enum silently re-interprets everyone's
 * saved preference as a different one, which is a bug that only shows up on an
 * upgrade, on a customer's phone, where nobody is watching.
 */
class ThemeModeTest {

    @Test
    fun `every mode survives a round trip through storage`() {
        for (mode in AppSettings.ThemeMode.entries) {
            assertEquals(mode, AppSettings.ThemeMode.fromStored(mode.stored))
        }
    }

    @Test
    fun `the stored values are the exact strings written to preferences`() {
        // Pinned literally: changing one of these would orphan the preference
        // already saved on every installed copy of the app.
        assertEquals("system", AppSettings.ThemeMode.SYSTEM.stored)
        assertEquals("light", AppSettings.ThemeMode.LIGHT.stored)
        assertEquals("dark", AppSettings.ThemeMode.DARK.stored)
    }

    @Test
    fun `an unknown or missing stored value falls back to following the system`() {
        // A first run has nothing saved; a downgrade may find a value written
        // by a newer build. Neither should leave the app themeless.
        assertEquals(AppSettings.ThemeMode.SYSTEM, AppSettings.ThemeMode.fromStored(null))
        assertEquals(AppSettings.ThemeMode.SYSTEM, AppSettings.ThemeMode.fromStored(""))
        assertEquals(AppSettings.ThemeMode.SYSTEM, AppSettings.ThemeMode.fromStored("solarized"))
    }

    @Test
    fun `each mode maps to the right AppCompat night mode`() {
        assertEquals(
            AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM,
            AppSettings.ThemeMode.SYSTEM.toNightMode()
        )
        assertEquals(AppCompatDelegate.MODE_NIGHT_NO, AppSettings.ThemeMode.LIGHT.toNightMode())
        assertEquals(AppCompatDelegate.MODE_NIGHT_YES, AppSettings.ThemeMode.DARK.toNightMode())
    }

    @Test
    fun `every mode has a label to show in the settings list`() {
        for (mode in AppSettings.ThemeMode.entries) {
            assertEquals("label missing for ${mode.stored}", false, mode.label.isBlank())
        }
    }
}
