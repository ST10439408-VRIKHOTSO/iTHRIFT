package com.ithrift.app.util

import android.content.Context
import com.ithrift.app.data.ApiClient
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/*
 * Formatting shared by every screen. Each function matches its namesake in
 * the website's public/js/app.js, so a price or a date reads the same in
 * both places. Nothing here depends on the phone's locale.
 */

// Money is formatted with Locale.US on purpose: the phone's own locale may group
// thousands with a space or a full stop. Reference: java.util.Formatter,
// https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Formatter.html

/** "R1,620", matching the website. Cents are rounded, never shown. */
fun formatMoney(amount: Double): String {
    return String.format(Locale.US, "R%,.0f", amount)
}

/** "R239.61": with cents, for VAT lines on a tax invoice. */
fun formatMoneyCents(amount: Double): String {
    return String.format(Locale.US, "R%,.2f", amount)
}

/** "2 pieces", "1 piece". */
fun plural(n: Int, one: String, many: String = one + "s"): String = "$n ${if (n == 1) one else many}"

/** Resolves a relative image path like "/images/products/3.svg" returned by the API into a full URL. */
fun resolveImageUrl(context: Context, path: String): String {
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    val origin = ApiClient.originUrl(context)
    return if (path.startsWith("/")) "$origin$path" else "$origin/$path"
}

private val SA_TIME: TimeZone = TimeZone.getTimeZone("Africa/Johannesburg")
private val MONTHS = listOf("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
private val DAYS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

/**
 * Parses an API date: either a day ("2026-10-21") or an SQLite timestamp
 * ("2026-10-16 03:31:20", always UTC). Returns null for anything else.
 */
fun parseApiDate(value: String?): Date? {
    if (value.isNullOrBlank()) return null
    return try {
        if (Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(value)) {
            val f = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
            f.timeZone = SA_TIME
            f.parse("$value 12:00")
        } else {
            val f = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
            f.timeZone = TimeZone.getTimeZone("UTC")
            f.parse(value.replace('T', ' ').take(19))
        }
    } catch (e: Exception) {
        null
    }
}

/** "7 Oct 2026", or "Tue 7 Oct" with [weekday] and without [year]. Shown in South African time. */
fun dateLabel(value: String?, year: Boolean = true, weekday: Boolean = false): String {
    val d = parseApiDate(value) ?: return value ?: ""
    val c = Calendar.getInstance(SA_TIME).apply { time = d }
    val day = c.get(Calendar.DAY_OF_MONTH)
    val month = MONTHS[c.get(Calendar.MONTH)]
    val w = if (weekday) DAYS[c.get(Calendar.DAY_OF_WEEK) - 1] + " " else ""
    return "$w$day $month" + if (year) " ${c.get(Calendar.YEAR)}" else ""
}

/** "04:25", in South African time. */
fun timeLabel(value: String?): String {
    val d = parseApiDate(value) ?: return ""
    val f = SimpleDateFormat("HH:mm", Locale.US)
    f.timeZone = SA_TIME
    return f.format(d)
}

/**
 * Turns an SQLite `datetime('now')` style timestamp ("2026-06-10 14:23:00",
 * always UTC) into a short relative string: "today", "yesterday", "5 days ago".
 */
fun timeAgo(sqliteTimestamp: String): String {
    return try {
        val format = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        format.timeZone = TimeZone.getTimeZone("UTC")
        val parsed: Date = format.parse(sqliteTimestamp) ?: return sqliteTimestamp
        val days = (System.currentTimeMillis() - parsed.time) / 86_400_000L
        when {
            days <= 0 -> "today"
            days == 1L -> "yesterday"
            days < 30 -> "$days days ago"
            else -> {
                val display = SimpleDateFormat("d MMM yyyy", Locale.US)
                display.format(parsed)
            }
        }
    } catch (e: Exception) {
        sqliteTimestamp
    }
}

/** Star string for a 1 to 5 rating: filled stars then empty ones. */
fun starString(rating: Int): String {
    val filled = "★".repeat(rating.coerceIn(0, 5))
    val empty = "☆".repeat(5 - rating.coerceIn(0, 5))
    return filled + empty
}
