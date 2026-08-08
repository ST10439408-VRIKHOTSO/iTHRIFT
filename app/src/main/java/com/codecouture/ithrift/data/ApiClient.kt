package com.codecouture.ithrift.data

import android.content.Context
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

    private var retrofit: Retrofit? = null
    private var cachedBaseUrl: String? = null

    fun getService(context: Context): ApiService {
        val configuredUrl = SessionManager.getServerUrl(context)
        val normalized = normalizeBaseUrl(configuredUrl)

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
            chain.proceed(request)
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

    private fun normalizeBaseUrl(raw: String): String {
        var url = raw.trim()
        if (url.isEmpty()) url = SessionManager.DEFAULT_SERVER_URL
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://$url"
        while (url.endsWith("/")) url = url.dropLast(1)
        return "$url/api/"
    }

    /** The base website origin (no /api suffix) - used to build full image URLs. */
    fun originUrl(context: Context): String {
        var url = SessionManager.getServerUrl(context).trim()
        if (url.isEmpty()) url = SessionManager.DEFAULT_SERVER_URL
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://$url"
        while (url.endsWith("/")) url = url.dropLast(1)
        return url
    }
}
