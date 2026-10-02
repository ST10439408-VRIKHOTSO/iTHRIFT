package com.codecouture.ithrift.data

import android.content.Context
import android.util.Log
import com.codecouture.ithrift.util.ApiUrl
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Builds the Retrofit/OkHttp client used to call the shared REST API.
 * The server address is user-configurable (Account tab -> Server address),
 * since it points at whichever machine on the network is running
 * `npm start`. The client is rebuilt automatically whenever that address
 * changes.
 */
object ApiClient {

    private const val TAG = "ApiClient"

    /** Routes where a 401 means "wrong password", not "your session has gone". */
    private val CREDENTIAL_ROUTES = listOf("/auth/login", "/auth/register", "/auth/sso", "/auth/change-password")

    private var retrofit: Retrofit? = null
    private var cachedBaseUrl: String? = null

    fun getService(context: Context): ApiService {
        val configuredUrl = SessionManager.getServerUrl(context)
        val normalized = ApiUrl.baseUrl(configuredUrl)

        if (retrofit == null || cachedBaseUrl != normalized) {
            retrofit = buildRetrofit(context, normalized)
            cachedBaseUrl = normalized
        }
        return retrofit!!.create(ApiService::class.java)
    }

    /** Forces the next call to getService() to build a fresh client (e.g. after the server address changes). */
    fun reset() {
        retrofit = null
        cachedBaseUrl = null
    }

    private fun buildRetrofit(context: Context, baseUrl: String): Retrofit {
        val authInterceptor = Interceptor { chain ->
            val token = SessionManager.getToken(context)
            val request = if (token != null) {
                chain.request().newBuilder().addHeader("Authorization", "Bearer $token").build()
            } else {
                chain.request()
            }
            val response = chain.proceed(request)

            // The server no longer recognises the saved session, for example
            // because it was restarted. Forget the token so the app asks for a
            // fresh sign-in instead of failing every request with the same
            // message. Sign-in and password routes answer 401 for a wrong
            // password, which is not a lost session, so they are left alone.
            val path = request.url.encodedPath
            val isCredentialRoute = CREDENTIAL_ROUTES.any { path.endsWith(it) }
            if (token != null && response.code == 401 && !isCredentialRoute) {
                Log.i(TAG, "The server rejected the saved session; signing out on this phone")
                SessionManager.clearSession(context)
            }
            response
        }

        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BASIC
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    /** The base website origin (no /api suffix), used to build full image URLs. */
    fun originUrl(context: Context): String = ApiUrl.origin(SessionManager.getServerUrl(context))
}
