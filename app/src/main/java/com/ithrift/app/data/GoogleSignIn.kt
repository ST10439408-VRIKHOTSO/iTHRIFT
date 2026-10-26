package com.ithrift.app.data

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Base64
import androidx.browser.customtabs.CustomTabsIntent
import java.security.MessageDigest
import java.security.SecureRandom
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Google sign-in for the app, done through the website.
 *
 * Google's on-phone sign-in (Credential Manager) only works once the app's
 * package name and signing key are registered as an Android client in
 * Google Cloud. The website's Google sign-in already works, so the app uses
 * it instead:
 *
 *  1. The app makes a random secret (the verifier), keeps it, and opens
 *     /#/app-sign-in on the server in a browser tab with its SHA-256 (the
 *     challenge).
 *  2. The customer picks a Google account there. The server checks Google's
 *     token and returns a single-use code bound to the challenge.
 *  3. The page sends the browser to ithrift://signed-in?code=..., which
 *     reopens this app (MainActivity).
 *  4. The app swaps the code and its secret for a session at
 *     POST /api/auth/sso/exchange.
 *
 * A session token never travels through the ithrift:// link, so another
 * app that claimed the link would get only a code it cannot use.
 * See server/utils/app-codes.js.
 */
object GoogleSignIn {

    private const val PREFS = "google_sign_in"
    private const val KEY_VERIFIER = "verifier"
    private const val KEY_NEXT = "next"

    /** The ithrift://signed-in link the browser tab opened, waiting for the app to act on it. */
    val returned = MutableStateFlow<Uri?>(null)

    fun isReturnLink(uri: Uri?): Boolean = uri?.scheme == "ithrift" && uri.host == "signed-in"

    /** Opens the website's Google sign-in in a browser tab. Returns an error message, or null. */
    fun start(context: Context, serverUrl: String, next: String): String? {
        val bytes = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = base64url(bytes)
        val challenge = base64url(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(KEY_VERIFIER, verifier)
            .putString(KEY_NEXT, next)
            .apply()
        val uri = Uri.parse("${serverUrl.trimEnd('/')}/#/app-sign-in?challenge=$challenge")
        return try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, uri)
            null
        } catch (e: ActivityNotFoundException) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                null
            } catch (e2: ActivityNotFoundException) {
                "There is no web browser on this phone to sign in with Google."
            }
        }
    }

    /** The secret and the screen to return to, once only: a code is redeemed a single time. */
    fun takePending(context: Context): Pair<String, String>? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val verifier = prefs.getString(KEY_VERIFIER, null) ?: return null
        val next = prefs.getString(KEY_NEXT, "") ?: ""
        prefs.edit().clear().apply()
        return verifier to next
    }

    private fun base64url(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
}
