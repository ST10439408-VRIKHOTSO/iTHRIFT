package com.codecouture.ithrift.data

import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.Response
import java.io.IOException
import kotlin.coroutines.cancellation.CancellationException

/**
 * Unit tests for safeApiCall, the single funnel every network call in the app
 * passes through.
 *
 * This is the reason a bad input or a dropped connection shows a message
 * instead of closing the app: nothing above this layer ever sees an
 * exception. That claim is worth testing rather than asserting, so each of
 * the ways a call can go wrong is exercised here: a 4xx carrying the API's
 * own error message, a 4xx carrying something else, a body that is missing
 * entirely, no network at all, and an unexpected runtime failure.
 */
class SafeApiCallTest {

    private fun errorBody(json: String) =
        json.toResponseBody("application/json".toMediaType())

    @Test
    fun `a successful response is unwrapped`() = runTest {
        val outcome = safeApiCall { Response.success(OkResponse(ok = true)) }
        assertTrue(outcome is ApiOutcome.Success)
        assertEquals(true, (outcome as ApiOutcome.Success).data.ok)
    }

    @Test
    fun `the API's own error message is what the customer is shown`() = runTest {
        // The server writes messages meant to be read, such as "Only 2 of this item
        // is in stock." Losing them in favour of "HTTP 409" would be a
        // downgrade for every error in the app at once.
        val outcome = safeApiCall<OkResponse> {
            Response.error(409, errorBody("""{"error":"Only 2 of this item is in stock."}"""))
        }
        assertTrue(outcome is ApiOutcome.Failure)
        assertEquals("Only 2 of this item is in stock.", (outcome as ApiOutcome.Failure).message)
    }

    @Test
    fun `an error body that is not our JSON still produces a message`() = runTest {
        // A proxy or a crashed server returns HTML. There must still be
        // something to put on the screen.
        val outcome = safeApiCall<OkResponse> {
            Response.error(502, errorBody("<html><body>Bad Gateway</body></html>"))
        }
        assertTrue(outcome is ApiOutcome.Failure)
        assertTrue((outcome as ApiOutcome.Failure).message.isNotBlank())
    }

    @Test
    fun `an empty error body produces a message rather than an empty banner`() = runTest {
        val outcome = safeApiCall<OkResponse> { Response.error(500, errorBody("")) }
        assertTrue(outcome is ApiOutcome.Failure)
        assertTrue((outcome as ApiOutcome.Failure).message.isNotBlank())
    }

    @Test
    fun `a success with no body is a failure, not a null handed upwards`() = runTest {
        // Response.success(null) is a 200 with nothing in it. Unwrapping that
        // to null would move the crash into whichever screen used the result.
        val outcome = safeApiCall<OkResponse> { Response.success(null) }
        assertTrue(outcome is ApiOutcome.Failure)
    }

    @Test
    fun `a network failure becomes advice instead of an exception`() = runTest {
        val outcome = safeApiCall<OkResponse> { throw IOException("connect timed out") }
        assertTrue(outcome is ApiOutcome.Failure)
        val message = (outcome as ApiOutcome.Failure).message
        // The message should point at the setting that is usually wrong,
        // not repeat the socket error to a customer who cannot act on it.
        assertTrue(
            "expected the message to mention the server address, got \"$message\"",
            message.contains("server", ignoreCase = true)
        )
    }

    @Test
    fun `an unexpected exception is caught rather than reaching the screen`() = runTest {
        val outcome = safeApiCall<OkResponse> { throw IllegalStateException("something odd") }
        assertTrue(outcome is ApiOutcome.Failure)
        assertTrue((outcome as ApiOutcome.Failure).message.isNotBlank())
    }

    @Test
    fun `a cancelled call is rethrown so a closed screen stops instead of crashing`() = runTest {
        // When a screen closes, its pending calls are cancelled. Turning that into
        // a Failure let the screen carry on and touch views that were already
        // destroyed, which is what crashed the Shop and Search tabs on a phone.
        var rethrown = false
        try {
            safeApiCall<OkResponse> { throw CancellationException("screen closed") }
        } catch (e: CancellationException) {
            rethrown = true
        }
        assertTrue("cancellation must reach the caller", rethrown)
    }
}
