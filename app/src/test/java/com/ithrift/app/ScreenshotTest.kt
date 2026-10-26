package com.ithrift.app

import android.content.Context
import android.content.Intent
import android.os.Looper
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.printToString
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.AuthResponse
import com.ithrift.app.data.SessionManager
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.captureScreenRoboImage
import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders the real screens, against a real server, into images.
 *
 * It runs on the JVM with Robolectric, so no emulator is needed, and only
 * when asked for (-Pscreens=true) because it needs the Node.js server
 * running on this machine with the seeded database. The CI workflow starts
 * the server, runs this, and publishes the images, which is how the screens
 * are checked against the website.
 */
@OptIn(ExperimentalRoborazziApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xhdpi")
class ScreenshotTest {

    @get:Rule
    val compose = createEmptyComposeRule()

    private val server = "http://localhost:3000"
    private val context: Context get() = ApplicationProvider.getApplicationContext()

    private fun signIn(identifier: String?, password: String?) {
        SessionManager.clearSession(context)
        AppSettings.setServerUrl(context, server)
        AppSettings.setReduceMotion(context, true)
        AppSettings.setOnboardLater(context)
        if (identifier == null) return
        val body = Gson().toJson(mapOf("identifier" to identifier, "password" to password)).toRequestBody("application/json".toMediaType())
        val response = OkHttpClient().newCall(Request.Builder().url("$server/api/auth/login").post(body).build()).execute()
        val auth = Gson().fromJson(response.body!!.string(), AuthResponse::class.java)
        SessionManager.saveSession(context, auth.token, auth.user)
    }

    /** Lets network calls finish and the screen settle, with the main looper and the Compose clock moving. */
    private fun settle(millis: Long) {
        val end = System.currentTimeMillis() + millis
        while (System.currentTimeMillis() < end) {
            Thread.sleep(100)
            shadowOf(Looper.getMainLooper()).idle()
            compose.mainClock.advanceTimeBy(100)
        }
    }

    /** Opens a screen, taps the texts in [taps] in order, and photographs each step. */
    private fun journey(name: String, route: String, vararg taps: String) {
        RuntimeEnvironment.setQualifiers("+notnight")
        AppSettings.setThemeMode(context, AppSettings.ThemeMode.LIGHT)
        val intent = Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_ROUTE, route)
        ActivityScenario.launch<MainActivity>(intent).use {
            settle(4000)
            taps.forEachIndexed { i, text ->
                val nodes = compose.onAllNodesWithText(text, useUnmergedTree = true)
                if (nodes.fetchSemanticsNodes().isEmpty()) {
                    java.io.File("screens").mkdirs()
                    java.io.File("screens/missing $name ${i + 1}.txt").writeText(runCatching { compose.onRoot(useUnmergedTree = true).printToString() }.getOrElse { it.toString() })
                    return@use
                }
                runCatching { nodes[0].performScrollTo() }
                settle(500)
                nodes[0].performClick()
                settle(2500)
                // The whole screen, so a sheet or a dialog (a separate window) is in the picture too.
                captureScreenRoboImage("screens/$name ${i + 1}.png")
            }
        }
    }

    private fun shoot(name: String, route: String, dark: Boolean = false, wait: Long = 4000) {
        RuntimeEnvironment.setQualifiers(if (dark) "+night" else "+notnight")
        AppSettings.setThemeMode(context, if (dark) AppSettings.ThemeMode.DARK else AppSettings.ThemeMode.LIGHT)
        val intent = Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_ROUTE, route)
        ActivityScenario.launch<MainActivity>(intent).use {
            settle(wait)
            compose.onRoot().captureRoboImage("screens/$name.png")
        }
    }

    @Test
    fun customerScreens() {
        assumeTrue(System.getProperty("screens") == "true")
        signIn("lerato.m@gmail.com", "Password1")
        shoot("customer home light", "home", wait = 6000)
        shoot("customer home dark", "home", dark = true, wait = 6000)
        shoot("customer shop", "shop?f=")
        shoot("customer product", "product/1")
        shoot("customer product sale dark", "product/34", dark = true)
        shoot("customer bag", "bag")
        shoot("customer checkout", "checkout")
        shoot("customer wishlist", "wishlist")
        shoot("customer orders", "orders")
        shoot("customer order", "order/22")
        shoot("customer receipt", "receipt/1?gift=false")
        shoot("customer account", "account")
        shoot("customer account dark", "account", dark = true)
        shoot("customer settings", "settings")
        shoot("customer points", "points")
        shoot("customer notifications", "notifications")
        shoot("customer sell", "sell")
        shoot("customer help", "help?section=")
        shoot("customer thread", "thread/1")
        shoot("customer search", "search")
        shoot("customer compare", "compare")
        journey("journey filters", "shop?f=", "Filters")
        journey("journey add to bag", "product/1", "UK 8", "Add to bag")
        shoot("customer bag after adding", "bag")
        journey("journey checkout", "checkout", "Collect from the Pretoria store")
        journey("journey review", "product/2", "Write a review")
    }

    @Test
    fun guestAndStaffScreens() {
        assumeTrue(System.getProperty("screens") == "true")
        signIn(null, null)
        shoot("guest sign in", "login?next=")
        shoot("guest register", "register?next=")
        signIn("vukosir@icloud.com", "ithrift@2025")
        shoot("staff console", "console", wait = 6000)
        shoot("staff console dark", "console", dark = true, wait = 6000)
        shoot("staff orders", "staff/orders?status=Processing")
        shoot("staff order", "order/12")
        shoot("staff listings", "staff/listings")
        shoot("staff returns", "staff/returns")
        shoot("staff sell", "staff/sell")
        shoot("staff promos", "staff/promos")
    }
}
