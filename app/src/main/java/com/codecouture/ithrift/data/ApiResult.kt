package com.codecouture.ithrift.data

import com.google.gson.Gson
import okhttp3.ResponseBody
import retrofit2.Response
import java.io.IOException

/**
 * Every screen calls the API through safeApiCall() so error handling only
 * has to be written once: network failures, and the API's own
 * `{ "error": "message" }` JSON body on non-2xx responses, both turn into
 * a plain, displayable message.
 */
sealed class ApiOutcome<out T> {
    data class Success<T>(val data: T) : ApiOutcome<T>()
    data class Failure(val message: String) : ApiOutcome<Nothing>()
}

suspend fun <T> safeApiCall(block: suspend () -> Response<T>): ApiOutcome<T> {
    return try {
        val response = block()
        if (response.isSuccessful) {
            val body = response.body()
            if (body != null) {
                ApiOutcome.Success(body)
            } else {
                ApiOutcome.Failure("Empty response from server.")
            }
        } else {
            ApiOutcome.Failure(parseErrorBody(response.errorBody()))
        }
    } catch (e: IOException) {
        ApiOutcome.Failure("Couldn't reach the server. Check the server address in Account, and make sure npm start is running.")
    } catch (e: Exception) {
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
