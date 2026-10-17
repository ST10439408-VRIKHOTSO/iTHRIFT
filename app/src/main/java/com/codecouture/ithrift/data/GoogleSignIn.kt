package com.codecouture.ithrift.data

import android.content.Context
import android.util.Log
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.codecouture.ithrift.BuildConfig
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential

/**
 * Single sign-on, on the client side.
 *
 * The app's only job in single sign-on is to ask Android for a Google ID
 * token and hand it to our API. It deliberately does not decide who the
 * customer is: it cannot, because anything it worked out here could be
 * forged by anyone who repackaged the app. The API verifies the token with
 * Google (server/utils/sso.js) and only then issues a session.
 *
 * This uses Credential Manager, which is the API Google supports on
 * Android 14 and later and back-ports to older versions through Play
 * Services. The older GoogleSignInClient is deprecated.
 *
 * Configuration: put your OAuth *web* client id in local.properties as
 *
 *     GOOGLE_WEB_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
 *
 * and set the same value in the server's GOOGLE_CLIENT_ID environment
 * variable. It is the web client id and not the Android one because that is
 * the audience Google puts in the ID token it issues to a backend.
 * local.properties is not committed, so the id never reaches the repository.
 *
 * Reference: Google. 2025. Sign in your user with Credential Manager.
 * https://developer.android.com/identity/sign-in/credential-manager-siwg
 */
object GoogleSignIn {

    private const val TAG = "GoogleSignIn"

    /** Whether this build was given a client id at all. */
    val isConfigured: Boolean
        get() = BuildConfig.GOOGLE_WEB_CLIENT_ID.isNotBlank()

    /** What the caller gets back from [requestIdToken]. */
    sealed class Result {
        /** A Google ID token, ready to POST to /api/auth/sso. */
        data class Token(val idToken: String) : Result()

        /** The customer dismissed the sheet. Not an error, so say nothing. */
        data object Cancelled : Result()

        /** Something went wrong, with a message that is safe to show. */
        data class Failure(val message: String) : Result()
    }

    /**
     * Shows the Google account chooser and returns the ID token it produces.
     *
     * [context] must be an Activity context: Credential Manager renders a
     * system sheet over the current activity and cannot do that from an
     * application context.
     */
    suspend fun requestIdToken(context: Context): Result {
        if (!isConfigured) {
            return Result.Failure("Google sign-in is not set up in this build of the app.")
        }

        // GetSignInWithGoogleOption shows the full account chooser, including
        // accounts that have never used this app. GetGoogleIdOption would only
        // offer previously authorised accounts, which is wrong for a sign-in
        // button that a brand-new customer is expected to press.
        val option = GetSignInWithGoogleOption.Builder(BuildConfig.GOOGLE_WEB_CLIENT_ID).build()
        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()

        return try {
            Log.d(TAG, "Requesting a Google ID token through Credential Manager")
            val response = CredentialManager.create(context).getCredential(context, request)
            val credential = response.credential

            if (credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL) {
                Log.w(TAG, "Unexpected credential type: ${credential.type}")
                return Result.Failure("That sign-in method is not supported here.")
            }

            val googleCredential = GoogleIdTokenCredential.createFrom(credential.data)
            Log.d(TAG, "Received an ID token; handing it to the API for verification")
            Result.Token(googleCredential.idToken)
        } catch (e: GetCredentialCancellationException) {
            Log.d(TAG, "The customer dismissed the Google sign-in sheet")
            Result.Cancelled
        } catch (e: NoCredentialException) {
            Log.i(TAG, "No Google account is available on this device", e)
            Result.Failure("No Google account was found on this phone. Add one in the phone's settings, or sign in with your email and password.")
        } catch (e: GetCredentialException) {
            Log.w(TAG, "Credential Manager refused the request", e)
            Result.Failure("Google sign-in is unavailable right now. Please sign in with your email and password.")
        } catch (e: Exception) {
            // Play Services is missing or out of date on some handsets. That
            // must not take the screen down with it, because the customer can still
            // sign in with a password.
            Log.e(TAG, "Google sign-in failed unexpectedly", e)
            Result.Failure("Google sign-in could not start. Please sign in with your email and password.")
        }
    }
}
