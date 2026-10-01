package com.codecouture.ithrift.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Unit tests for the formatting helpers in Extensions.kt.
 *
 * Money is the one worth being strict about. The app is South African and
 * prices are shown in rand, but the formatter is asked for a US locale on
 * purpose: on a phone set to Afrikaans or French the default grouping
 * separator is a space or a full stop, and "R1.620" reads as one rand
 * sixty-two to half the people who see it. Pinning the expected output here
 * means a well-meaning change to the locale fails a test instead of quietly
 * mispricing the catalogue.
 */
class FormattingTest {

    // --- Money --------------------------------------------------------------

    @Test
    fun `prices are shown in rand with no decimals`() {
        assertEquals("R450", formatMoney(450.0))
        assertEquals("R180", formatMoney(180.0))
    }

    @Test
    fun `thousands are grouped with a comma regardless of the phone's locale`() {
        val original = Locale.getDefault()
        try {
            // A locale whose own convention is a space or a full stop.
            Locale.setDefault(Locale.FRANCE)
            assertEquals("R1,620", formatMoney(1620.0))
            assertEquals("R12,500", formatMoney(12500.0))
        } finally {
            Locale.setDefault(original)
        }
    }

    @Test
    fun `cents are rounded rather than truncated`() {
        assertEquals("R181", formatMoney(180.5))
        assertEquals("R180", formatMoney(180.4))
    }

    @Test
    fun `a zero total still reads as money`() {
        assertEquals("R0", formatMoney(0.0))
    }

    // --- Star ratings -------------------------------------------------------

    @Test
    fun `a rating is drawn as five stars, filled to the rating`() {
        assertEquals("★☆☆☆☆", starString(1))
        assertEquals("★★★☆☆", starString(3))
        assertEquals("★★★★★", starString(5))
    }

    @Test
    fun `a rating outside one to five is clamped instead of throwing`() {
        // Bad data from the API must not take the product screen down.
        assertEquals("☆☆☆☆☆", starString(0))
        assertEquals("☆☆☆☆☆", starString(-2))
        assertEquals("★★★★★", starString(9))
    }

    @Test
    fun `every rating produces exactly five characters`() {
        for (rating in -1..7) {
            assertEquals("rating $rating", 5, starString(rating).length)
        }
    }

    // --- Relative times -----------------------------------------------------

    @Test
    fun `recent timestamps are described in words`() {
        assertEquals("today", timeAgo(utcTimestampDaysAgo(0)))
        assertEquals("yesterday", timeAgo(utcTimestampDaysAgo(1)))
        assertEquals("5 days ago", timeAgo(utcTimestampDaysAgo(5)))
    }

    @Test
    fun `timestamps older than a month fall back to a date`() {
        // "97 days ago" is not useful; a date is.
        val result = timeAgo(utcTimestampDaysAgo(97))
        assertTrue("expected a date with a year, got \"$result\"", result.contains(Regex("\\d{4}")))
    }

    @Test
    fun `an unparseable timestamp is returned unchanged instead of crashing`() {
        // Order and review screens both render this. A malformed value from
        // the API should look odd, not close the screen.
        assertEquals("not a date", timeAgo("not a date"))
        assertEquals("", timeAgo(""))
    }

    /** A timestamp in the SQLite `datetime('now')` format the API returns: UTC, no zone suffix. */
    private fun utcTimestampDaysAgo(days: Int): String {
        val format = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        // Midday, so that a test running near midnight in any zone does not
        // land on the wrong side of a day boundary and fail at random.
        val millis = System.currentTimeMillis() - days * 86_400_000L
        return format.format(Date(millis))
    }
}
