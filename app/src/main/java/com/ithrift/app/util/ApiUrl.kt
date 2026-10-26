package com.ithrift.app.util

/**
 * Turning whatever the customer typed into the Settings screen's "server
 * address" field into a URL Retrofit will accept.
 *
 * This is separated from ApiClient, and kept free of any Android type, for
 * one reason: it is the piece most likely to be got wrong and it is worth
 * unit-testing directly. A missing scheme or a trailing slash is exactly the
 * kind of thing a tired person types at 2am on a phone keyboard, and the
 * resulting IllegalArgumentException from Retrofit ("baseUrl must end in /")
 * is not a message anyone can act on.
 *
 * Reference: Retrofit.Builder.baseUrl, which requires the trailing slash,
 * https://square.github.io/retrofit/2.x/retrofit/retrofit2/-retrofit/-builder/base-url.html
 */
object ApiUrl {

    /**
     * The hosted server on Render, the same one the website runs on, so the
     * app works out of the box on any phone. For a server running on your own
     * computer, enter http://10.0.2.2:3000 (the emulator's name for that
     * computer) or the computer's network address in Settings.
     */
    const val DEFAULT_SERVER_URL = "https://ithrift-api.onrender.com"

    /** The emulator's alias for "localhost on the machine running npm start". */
    const val EMULATOR_SERVER_URL = "http://10.0.2.2:3000"

    /**
     * The origin the server is reachable at: scheme and host, no path, no
     * trailing slash. Used to build absolute image URLs from the relative
     * paths the API returns.
     */
    fun origin(raw: String): String {
        var url = raw.trim()
        if (url.isEmpty()) url = DEFAULT_SERVER_URL
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "http://$url"
        while (url.endsWith("/")) url = url.dropLast(1)
        return url
    }

    /**
     * The API base URL for Retrofit. Retrofit requires a base URL ending in
     * a slash, and every path in ApiService is relative to /api/.
     */
    fun baseUrl(raw: String): String = "${origin(raw)}/api/"
}
