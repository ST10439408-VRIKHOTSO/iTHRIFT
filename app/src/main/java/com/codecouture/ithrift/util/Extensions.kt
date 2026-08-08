package com.codecouture.ithrift.util

import android.content.Context
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiClient
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** "R1,620" - matches the formatting used on the website and the PWA. */
fun formatMoney(amount: Double): String {
    return String.format(Locale.US, "R%,.0f", amount)
}

/** Resolves a relative image path like "/images/products/3.svg" returned by the API into a full URL. */
fun resolveImageUrl(context: Context, path: String): String {
    if (path.startsWith("http://") || path.startsWith("https://")) return path
    val origin = ApiClient.originUrl(context)
    return if (path.startsWith("/")) "$origin$path" else "$origin/$path"
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

/** "★★★☆☆" style star string for a 1-5 rating. */
fun starString(rating: Int): String {
    val filled = "\u2605".repeat(rating.coerceIn(0, 5))
    val empty = "\u2606".repeat(5 - rating.coerceIn(0, 5))
    return filled + empty
}

/** Colour resource id for a product's condition badge ("Excellent", "Very Good", "Good", "Fair"). */
fun conditionColorRes(condition: String): Int = when (condition) {
    "Excellent" -> R.color.excellent
    "Very Good" -> R.color.info
    "Good" -> R.color.good_condition
    "Fair" -> R.color.bad
    else -> R.color.muted
}

/** Colour resource id for an order status badge ("Processing", "Shipped", "Delivered", "Cancelled"). */
fun statusColorRes(status: String): Int = when (status) {
    "Processing" -> R.color.warn
    "Shipped" -> R.color.info
    "Delivered" -> R.color.good
    "Cancelled" -> R.color.bad
    else -> R.color.muted
}

