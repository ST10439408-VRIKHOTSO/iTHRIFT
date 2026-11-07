package com.ithrift.app.data

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.browser.customtabs.CustomTabsIntent
import kotlinx.coroutines.flow.MutableStateFlow

/**
 * Paying for an order online, on the payment provider's own page.
 *
 * The server makes the payment link (POST /api/payments/{id}/start) and the
 * app opens it in a browser tab, as it does for Google sign-in. Card details
 * and bank logins are typed on PayFast's, Ozow's, Paystack's or Yoco's page,
 * never in this app. Afterwards the server's return page sends the browser
 * to ithrift://payment?order=..., which reopens MainActivity, and the app
 * shows the order.
 *
 * The link only says which order to show. Whether it was paid is always read
 * from the server, which only believes the provider: anything could open an
 * ithrift:// link.
 *
 * Only the payment page's host is logged, because the link itself carries
 * the token that opens the payment.
 *
 * References:
 *  - Android Custom Tabs: https://developer.chrome.com/docs/android/custom-tabs
 *  - Deep links into an app: https://developer.android.com/training/app-links/deep-linking
 */
object OnlinePayment {

    private const val TAG = "OnlinePayment"

    /** The ithrift://payment link the browser tab opened, waiting for the app to act on it. */
    val returned = MutableStateFlow<Uri?>(null)

    fun isReturnLink(uri: Uri?): Boolean = uri?.scheme == "ithrift" && uri.host == "payment"

    /** Opens a payment page in a browser tab. Returns an error message, or null. */
    fun open(context: Context, url: String): String? {
        val uri = Uri.parse(url)
        Log.i(TAG, "Opening the payment page on ${uri.host} in a browser tab")
        return try {
            CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(context, uri)
            null
        } catch (e: ActivityNotFoundException) {
            // Custom Tabs need a browser that supports them; any browser will do.
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                null
            } catch (e2: ActivityNotFoundException) {
                Log.e(TAG, "No browser is installed, so the payment page cannot open")
                "There is no web browser on this phone to pay with."
            }
        }
    }
}
