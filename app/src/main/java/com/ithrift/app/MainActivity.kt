package com.ithrift.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import com.ithrift.app.data.GoogleSignIn
import com.ithrift.app.ui.IThriftApp

/**
 * The one activity. Everything on screen is drawn by Jetpack Compose in
 * [IThriftApp]; this only switches on edge-to-edge drawing so the header and
 * the tab bar can sit behind the system bars, as the website's frosted
 * header does.
 *
 * It stays an AppCompatActivity so the light and dark setting applied in
 * IThriftApplication also reaches the window and any system dialogs.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_ROUTE = "route"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        // A screen to open first, when another app or a test asks for one
        // (an app route such as "product/34").
        takeGoogleReturn(intent)
        setContent { IThriftApp(startRoute = intent?.getStringExtra(EXTRA_ROUTE)) }
    }

    /** The browser tab sends the customer back here after Google sign-in. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        takeGoogleReturn(intent)
    }

    private fun takeGoogleReturn(intent: Intent?) {
        val uri = intent?.data
        if (GoogleSignIn.isReturnLink(uri)) GoogleSignIn.returned.value = uri
    }
}
