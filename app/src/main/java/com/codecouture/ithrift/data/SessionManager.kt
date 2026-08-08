package com.codecouture.ithrift.data

import android.content.Context
import android.content.SharedPreferences

/**
 * Persists the signed-in session and the configurable server address using
 * plain SharedPreferences. Kept deliberately simple - same spirit as the
 * website's use of localStorage for its token (see public/js/app.js).
 */
object SessionManager {

    private const val PREFS_NAME = "ithrift_prefs"
    private const val KEY_TOKEN = "token"
    private const val KEY_USER_TYPE = "user_type"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_SERVER_URL = "server_url"

    // 10.0.2.2 is the special alias the Android Emulator uses to reach
    // "localhost" on the host machine running npm start.
    const val DEFAULT_SERVER_URL = "http://10.0.2.2:3000"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getToken(context: Context): String? = prefs(context).getString(KEY_TOKEN, null)

    fun getUser(context: Context): AuthUser? {
        val p = prefs(context)
        val type = p.getString(KEY_USER_TYPE, null) ?: return null
        val name = p.getString(KEY_USER_NAME, null) ?: return null
        val id = p.getInt(KEY_USER_ID, -1)
        if (id == -1) return null
        return AuthUser(type = type, id = id, name = name)
    }

    fun isLoggedIn(context: Context): Boolean = getToken(context) != null

    fun saveSession(context: Context, token: String, user: AuthUser) {
        prefs(context).edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USER_TYPE, user.type)
            .putInt(KEY_USER_ID, user.id)
            .putString(KEY_USER_NAME, user.name)
            .apply()
    }

    fun clearSession(context: Context) {
        prefs(context).edit()
            .remove(KEY_TOKEN)
            .remove(KEY_USER_TYPE)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .apply()
    }

    fun getServerUrl(context: Context): String =
        prefs(context).getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL

    fun setServerUrl(context: Context, url: String) {
        prefs(context).edit().putString(KEY_SERVER_URL, url.trim()).apply()
    }
}
