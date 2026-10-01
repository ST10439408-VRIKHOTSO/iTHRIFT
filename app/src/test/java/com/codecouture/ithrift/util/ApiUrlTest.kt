package com.codecouture.ithrift.util

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Unit tests for the server address the customer types into Settings.
 *
 * This is small but it is the single point of failure for the whole app: get
 * it wrong and every screen shows "couldn't reach the server", with no clue
 * that the cause was a trailing slash. Retrofit throws
 * IllegalArgumentException on a base URL that does not end in "/", which
 * would be a crash rather than a message, so that case is pinned here.
 */
class ApiUrlTest {

    @Test
    fun `a plain address gets a scheme and the api path`() {
        assertEquals("http://192.168.0.10:3000/api/", ApiUrl.baseUrl("192.168.0.10:3000"))
    }

    @Test
    fun `an address that already has a scheme keeps it`() {
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl("http://10.0.2.2:3000"))
        assertEquals("https://ithrift.example.com/api/", ApiUrl.baseUrl("https://ithrift.example.com"))
    }

    @Test
    fun `https is never downgraded to http`() {
        // Silently rewriting https to http would send a bearer token in clear.
        assertEquals("https://ithrift.example.com", ApiUrl.origin("https://ithrift.example.com"))
    }

    @Test
    fun `trailing slashes are removed before the api path is added`() {
        // Retrofit rejects a double slash in the base URL, and people type
        // trailing slashes constantly.
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl("http://10.0.2.2:3000/"))
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl("http://10.0.2.2:3000///"))
    }

    @Test
    fun `surrounding whitespace is trimmed`() {
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl("  http://10.0.2.2:3000  "))
    }

    @Test
    fun `a blank address falls back to the emulator default`() {
        // Better than building "http:///api/" and crashing Retrofit.
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl(""))
        assertEquals("http://10.0.2.2:3000/api/", ApiUrl.baseUrl("   "))
    }

    @Test
    fun `the base url always ends in a slash as Retrofit requires`() {
        val inputs = listOf(
            "10.0.2.2:3000",
            "http://10.0.2.2:3000/",
            "https://ithrift.example.com",
            "",
            "  192.168.1.5:3000  ",
        )
        for (input in inputs) {
            val result = ApiUrl.baseUrl(input)
            assertEquals("base URL for \"$input\" must end in /", '/', result.last())
        }
    }

    @Test
    fun `the origin carries no api path so image urls are built correctly`() {
        // Product images come back as "/images/products/3.svg" and are
        // appended to the origin. An origin ending in /api/ would give
        // ".../api//images/..." and a broken image on every tile.
        assertEquals("http://10.0.2.2:3000", ApiUrl.origin("http://10.0.2.2:3000/"))
    }
}
