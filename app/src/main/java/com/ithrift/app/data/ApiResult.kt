package com.ithrift.app.data

import android.util.Log
import com.google.gson.Gson
import okhttp3.ResponseBody
import retrofit2.Response
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

/**
 * Every screen calls the API through safeApiCall() so error handling only
 * has to be written once: network failures, and the API's own
 * `{ "error": "message" }` JSON body on non-2xx responses, both turn into
 * a plain, displayable message.
 *
 * Every failure is also written to Logcat under the tag "ApiCall", with the
 * HTTP status where there is one, so a problem a customer reports can be
 * matched to the line the server logged for the same request.
 *
 * References:
 *  - Kotlin sealed classes: https://kotlinlang.org/docs/sealed-classes.html
 *  - Rethrowing CancellationException: https://kotlinlang.org/docs/cancellation-and-timeouts.html
 *  - Retrofit Response and errorBody(): https://square.github.io/retrofit/
 *  - android.util.Log levels: https://developer.android.com/reference/android/util/Log
 */
sealed class ApiOutcome<out T> {
    data class Success<T>(val data: T) : ApiOutcome<T>()
    data class Failure(val message: String) : ApiOutcome<Nothing>()
}

private const val TAG = "ApiCall"

suspend fun <T> safeApiCall(block: suspend () -> Response<T>): ApiOutcome<T> {
    return try {
        val response = block()
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) {
                ApiOutcome.Success(body)
            } else {
                Log.w(TAG, "HTTP ${response.code()} with an empty body")
                ApiOutcome.Failure("Empty response from server.")
            }
        } else {
            val message = parseErrorBody(response.errorBody())
            // A 4xx is usually the customer's input being refused (warn); a
            // 5xx is the server failing (error), which is the one to chase.
            if (response.code() >= 500) Log.e(TAG, "HTTP ${response.code()}: $message")
            else Log.w(TAG, "HTTP ${response.code()}: $message")
            ApiOutcome.Failure(message)
        }
    } catch (e: CancellationException) {
        // A screen that closes cancels its calls. That is not an error to show:
        // it must be rethrown so the caller stops instead of carrying on and
        // touching views that no longer exist.
        throw e
    } catch (e: IOException) {
        Log.e(TAG, "Network failure: ${e.javaClass.simpleName}: ${e.message}")
        ApiOutcome.Failure("Couldn't reach iTHRIFT. Check your connection and try again. The server can take up to a minute to wake up after a quiet spell.")
    } catch (e: Exception) {
        Log.e(TAG, "Unexpected failure", e)
        ApiOutcome.Failure(e.message ?: "Something went wrong.")
    }
}

private fun parseErrorBody(errorBody: ResponseBody?): String {
    if (errorBody == null) return "Something went wrong."
    return try {
        val json = errorBody.string()
        val parsed = Gson().fromJson(json, ErrorResponse::class.java)
        parsed?.error ?: "Something went wrong."
    } catch (e: Exception) {
        "Something went wrong."
    }
}
