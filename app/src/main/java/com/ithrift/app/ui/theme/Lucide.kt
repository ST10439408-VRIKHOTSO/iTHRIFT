package com.ithrift.app.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.unit.dp

/**
 * The icon set the website uses: Lucide (ISC licence, see assets/licences/lucide.txt),
 * converted from the SVG files of lucide-static 0.460.0 into path data so the app and
 * the website draw exactly the same marks. Every icon is a 24 by 24 outline with a
 * 2 unit stroke and round ends; the colour is applied by the Icon composable.
 *
 * Generated from the SVG files; regenerate rather than editing by hand.
 *
 * Reference: Lucide icons, https://lucide.dev (ISC licence).
 */
object Lucide {

    private fun build(name: String, vararg paths: String): ImageVector {
        val builder = ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
        )
        for (d in paths) {
            builder.addPath(
                pathData = PathParser().parsePathString(d).toNodes(),
                fill = null,
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
        return builder.build()
    }

    val search: ImageVector by lazy { build("search", "M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", "m21 21-4.3-4.3") }
    val heart: ImageVector by lazy { build("heart", "M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z") }
    val shoppingBag: ImageVector by lazy { build("shopping-bag", "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z", "M3 6h18", "M16 10a4 4 0 0 1-8 0") }
    val packageIcon: ImageVector by lazy { build("package", "M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z", "M12 22V12", "m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7", "m7.5 4.27 9 5.15") }
    val user: ImageVector by lazy { build("user", "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0") }
    val bell: ImageVector by lazy { build("bell", "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0") }
    val x: ImageVector by lazy { build("x", "M18 6 6 18", "m6 6 12 12") }
    val chevronRight: ImageVector by lazy { build("chevron-right", "m9 18 6-6-6-6") }
    val chevronLeft: ImageVector by lazy { build("chevron-left", "m15 18-6-6 6-6") }
    val chevronDown: ImageVector by lazy { build("chevron-down", "m6 9 6 6 6-6") }
    val chevronUp: ImageVector by lazy { build("chevron-up", "m18 15-6-6-6 6") }
    val plus: ImageVector by lazy { build("plus", "M5 12h14", "M12 5v14") }
    val minus: ImageVector by lazy { build("minus", "M5 12h14") }
    val slidersHorizontal: ImageVector by lazy { build("sliders-horizontal", "M21 4L14 4", "M10 4L3 4", "M21 12L12 12", "M8 12L3 12", "M21 20L16 20", "M12 20L3 20", "M14 2L14 6", "M8 10L8 14", "M16 18L16 22") }
    val arrowUpDown: ImageVector by lazy { build("arrow-up-down", "m21 16-4 4-4-4", "M17 20V4", "m3 8 4-4 4 4", "M7 4v16") }
    val share2: ImageVector by lazy { build("share-2", "M15 5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M15 19a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "M8.59 13.51L15.42 17.49", "M15.41 6.51L8.59 10.49") }
    val copy: ImageVector by lazy { build("copy", "M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z", "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2") }
    val messageCircle: ImageVector by lazy { build("message-circle", "M7.9 20A9 9 0 1 0 4 16.1L2 22Z") }
    val ruler: ImageVector by lazy { build("ruler", "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z", "m14.5 12.5 2-2", "m11.5 9.5 2-2", "m8.5 6.5 2-2", "m17.5 15.5 2-2") }
    val info: ImageVector by lazy { build("info", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "M12 16v-4", "M12 8h.01") }
    val check: ImageVector by lazy { build("check", "M20 6 9 17l-5-5") }
    val circleCheck: ImageVector by lazy { build("circle-check", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "m9 12 2 2 4-4") }
    val circleAlert: ImageVector by lazy { build("circle-alert", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "M12 8L12 12", "M12 16L12.01 16") }
    val truck: ImageVector by lazy { build("truck", "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2", "M15 18H9", "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14", "M15 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0", "M5 18a2 2 0 1 0 4 0a2 2 0 1 0 -4 0") }
    val store: ImageVector by lazy { build("store", "m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7", "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8", "M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4", "M2 7h20", "M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7") }
    val gift: ImageVector by lazy { build("gift", "M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z", "M12 8v13", "M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7", "M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5") }
    val printer: ImageVector by lazy { build("printer", "M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2", "M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6", "M7 14h10a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1Z") }
    val sparkles: ImageVector by lazy { build("sparkles", "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z", "M20 3v4", "M22 5h-4", "M4 17v2", "M5 18H3") }
    val star: ImageVector by lazy { build("star", "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z") }
    val layers: ImageVector by lazy { build("layers", "m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z", "m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65", "m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65") }
    val columns3: ImageVector by lazy { build("columns-3", "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z", "M9 3v18", "M15 3v18") }
    val trash2: ImageVector by lazy { build("trash-2", "M3 6h18", "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6", "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2", "M10 11L10 17", "M14 11L14 17") }
    val pencil: ImageVector by lazy { build("pencil", "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z", "m15 5 4 4") }
    val mapPin: ImageVector by lazy { build("map-pin", "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0", "M9 10a3 3 0 1 0 6 0a3 3 0 1 0 -6 0") }
    val settings: ImageVector by lazy { build("settings", "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0") }
    val logOut: ImageVector by lazy { build("log-out", "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17L21 12L16 7", "M21 12L9 12") }
    val sun: ImageVector by lazy { build("sun", "M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41") }
    val moon: ImageVector by lazy { build("moon", "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z") }
    val monitor: ImageVector by lazy { build("monitor", "M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2Z", "M8 21L16 21", "M12 17L12 21") }
    val leaf: ImageVector by lazy { build("leaf", "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12") }
    val droplets: ImageVector by lazy { build("droplets", "M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z", "M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97") }
    val tag: ImageVector by lazy { build("tag", "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z", "M7 7.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0") }
    val tags: ImageVector by lazy { build("tags", "m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19", "M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z", "M6 9.5a0.5 0.5 0 1 0 1 0a0.5 0.5 0 1 0 -1 0") }
    val bookmark: ImageVector by lazy { build("bookmark", "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z") }
    val bookmarkPlus: ImageVector by lazy { build("bookmark-plus", "m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z", "M12 7L12 13", "M15 10L9 10") }
    val zap: ImageVector by lazy { build("zap", "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z") }
    val clock: ImageVector by lazy { build("clock", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "M12 6L12 12L16 14") }
    val calendar: ImageVector by lazy { build("calendar", "M8 2v4", "M16 2v4", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2Z", "M3 10h18") }
    val rotateCcw: ImageVector by lazy { build("rotate-ccw", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", "M3 3v5h5") }
    val circleHelp: ImageVector by lazy { build("circle-help", "M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0", "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", "M12 17h.01") }
    val send: ImageVector by lazy { build("send", "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z", "m21.854 2.147-10.94 10.939") }
    val mail: ImageVector by lazy { build("mail", "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2Z", "m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7") }
    val phone: ImageVector by lazy { build("phone", "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z") }
    val shirt: ImageVector by lazy { build("shirt", "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z") }
    val footprints: ImageVector by lazy { build("footprints", "M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z", "M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z", "M16 17h4", "M4 13h4") }
    val gem: ImageVector by lazy { build("gem", "M6 3h12l4 6-10 13L2 9Z", "M11 3 8 9l4 13 4-13-3-6", "M2 9h20") }
    val chartColumn: ImageVector by lazy { build("chart-column", "M3 3v16a2 2 0 0 0 2 2h16", "M18 17V9", "M13 17V5", "M8 17v-3") }
    val chartLine: ImageVector by lazy { build("chart-line", "M3 3v16a2 2 0 0 0 2 2h16", "m19 9-5 5-4-4-3 3") }
    val download: ImageVector by lazy { build("download", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10L12 15L17 10", "M12 15L12 3") }
    val percent: ImageVector by lazy { build("percent", "M19 5L5 19", "M4 6.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0", "M15 17.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0") }
    val box: ImageVector by lazy { build("box", "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z", "m3.3 7 8.7 5 8.7-5", "M12 22V12") }
    val users: ImageVector by lazy { build("users", "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75") }
    val undo2: ImageVector by lazy { build("undo-2", "M9 14 4 9l5-5", "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11") }
    val inbox: ImageVector by lazy { build("inbox", "M22 12L16 12L14 15L10 15L8 12L2 12", "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z") }
    val messageSquare: ImageVector by lazy { build("message-square", "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") }
    val coins: ImageVector by lazy { build("coins", "M2 8a6 6 0 1 0 12 0a6 6 0 1 0 -12 0", "M18.09 10.37A6 6 0 1 1 10.34 18", "M7 6h1v4", "m16.71 13.88.7.71-2.82 2.82") }
    val eye: ImageVector by lazy { build("eye", "M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0") }
    val eyeOff: ImageVector by lazy { build("eye-off", "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49", "M14.084 14.158a3 3 0 0 1-4.242-4.242", "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143", "m2 2 20 20") }
    val zoomIn: ImageVector by lazy { build("zoom-in", "M3 11a8 8 0 1 0 16 0a8 8 0 1 0 -16 0", "M21 21L16.65 16.65", "M11 8L11 14", "M8 11L14 11") }
    val refreshCw: ImageVector by lazy { build("refresh-cw", "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16", "M8 16H3v5") }
    val house: ImageVector by lazy { build("house", "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z") }
    val lock: ImageVector by lazy { build("lock", "M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-7a2 2 0 0 1 2 -2Z", "M7 11V7a5 5 0 0 1 10 0v4") }
    val circleDashed: ImageVector by lazy { build("circle-dashed", "M10.1 2.182a10 10 0 0 1 3.8 0", "M13.9 21.818a10 10 0 0 1-3.8 0", "M17.609 3.721a10 10 0 0 1 2.69 2.7", "M2.182 13.9a10 10 0 0 1 0-3.8", "M20.279 17.609a10 10 0 0 1-2.7 2.69", "M21.818 10.1a10 10 0 0 1 0 3.8", "M3.721 6.391a10 10 0 0 1 2.7-2.69", "M6.391 20.279a10 10 0 0 1-2.69-2.7") }
    val listChecks: ImageVector by lazy { build("list-checks", "m3 17 2 2 4-4", "m3 7 2 2 4-4", "M13 6h8", "M13 12h8", "M13 18h8") }
    val badgePercent: ImageVector by lazy { build("badge-percent", "M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z", "m15 9-6 6", "M9 9h.01", "M15 15h.01") }
    val externalLink: ImageVector by lazy { build("external-link", "M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6") }
    val arrowLeft: ImageVector by lazy { build("arrow-left", "m12 19-7-7 7-7", "M19 12H5") }
    val arrowRight: ImageVector by lazy { build("arrow-right", "M5 12h14", "m12 5 7 7-7 7") }
    val filter: ImageVector by lazy { build("filter", "M22 3L2 3L10 12.46L10 19L14 21L14 12.46L22 3Z") }
    val loaderCircle: ImageVector by lazy { build("loader-circle", "M21 12a9 9 0 1 1-6.219-8.56") }
    val imageOff: ImageVector by lazy { build("image-off", "M2 2L22 22", "M10.41 10.41a2 2 0 1 1-2.83-2.83", "M13.5 13.5L6 21", "M18 12L21 15", "M3.59 3.59A1.99 1.99 0 0 0 3 5v14a2 2 0 0 0 2 2h14c.55 0 1.052-.22 1.41-.59", "M21 15V5a2 2 0 0 0-2-2H9") }
    val handCoins: ImageVector by lazy { build("hand-coins", "M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17", "m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9", "m2 16 6 6", "M13.1 9a2.9 2.9 0 1 0 5.8 0a2.9 2.9 0 1 0 -5.8 0", "M3 5a3 3 0 1 0 6 0a3 3 0 1 0 -6 0") }
    val clipboardList: ImageVector by lazy { build("clipboard-list", "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1Z", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M12 11h4", "M12 16h4", "M8 11h.01", "M8 16h.01") }
    val wifiOff: ImageVector by lazy { build("wifi-off", "M12 20h.01", "M8.5 16.429a5 5 0 0 1 7 0", "M5 12.859a10 10 0 0 1 5.17-2.69", "M19 12.859a10 10 0 0 0-2.007-1.523", "M2 8.82a15 15 0 0 1 4.177-2.643", "M22 8.82a15 15 0 0 0-11.288-3.764", "m2 2 20 20") }
    val type: ImageVector by lazy { build("type", "M4 7L4 4L20 4L20 7", "M9 20L15 20", "M12 4L12 20") }
    val accessibility: ImageVector by lazy { build("accessibility", "M15 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0", "m18 19 1-7-6 1", "m5 8 3-3 5.5 3-2.36 3.5", "M4.24 14.5a5 5 0 0 0 6.88 6", "M13.76 17.5a5 5 0 0 0-6.88-6") }
    val bellOff: ImageVector by lazy { build("bell-off", "M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5", "M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7", "M10.3 21a1.94 1.94 0 0 0 3.4 0", "m2 2 20 20") }
    val scanSearch: ImageVector by lazy { build("scan-search", "M3 7V5a2 2 0 0 1 2-2h2", "M17 3h2a2 2 0 0 1 2 2v2", "M21 17v2a2 2 0 0 1-2 2h-2", "M7 21H5a2 2 0 0 1-2-2v-2", "M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", "m16 16-1.9-1.9") }

    /** The star with its inside filled, for ratings; every other icon is an outline. */
    val starFilled: ImageVector by lazy {
        ImageVector.Builder(name = "star-filled", defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
            .addPath(
                pathData = PathParser().parsePathString("M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z").toNodes(),
                fill = SolidColor(Color.Black),
                stroke = SolidColor(Color.Black),
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
            .build()
    }
}
