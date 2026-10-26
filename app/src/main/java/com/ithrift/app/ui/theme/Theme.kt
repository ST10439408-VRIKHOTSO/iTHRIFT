package com.ithrift.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.ithrift.app.R

/*
 * The iTHRIFT design system for Android. Every value here mirrors a token in
 * the website's public/css/style.css, so the two clients look like one
 * product: a cool paper ground, pine for actions, marigold only for sale
 * prices, and the four-step condition meter as the one signature element.
 */

@Immutable
data class IThriftColors(
    val isDark: Boolean,
    val paper: Color,
    val surface: Color,
    val surface2: Color,
    val surface3: Color,
    val ink: Color,
    val ink2: Color,
    val muted: Color,
    val faint: Color,
    val hairline: Color,
    val hairlineStrong: Color,
    val pine: Color,
    val pineSoft: Color,
    val onPine: Color,
    val marigold: Color,
    val sale: Color,
    val saleSoft: Color,
    val good: Color,
    val goodSoft: Color,
    val warn: Color,
    val warnSoft: Color,
    val bad: Color,
    val badSoft: Color,
    val info: Color,
    val infoSoft: Color,
    val scrim: Color,
    val toast: Color,
    val onToast: Color,
)

val LightColors = IThriftColors(
    isDark = false,
    paper = Color(0xFFF5F6F4),
    surface = Color(0xFFFFFFFF),
    surface2 = Color(0xFFEEF0ED),
    surface3 = Color(0xFFE3E7E3),
    ink = Color(0xFF15201B),
    ink2 = Color(0xFF33403A),
    muted = Color(0xFF5C6661),
    faint = Color(0xFF8A938E),
    hairline = Color(0x1A15201B),
    hairlineStrong = Color(0x2E15201B),
    pine = Color(0xFF1E5A43),
    pineSoft = Color(0xFFE3EFE8),
    onPine = Color(0xFFFFFFFF),
    marigold = Color(0xFFE8892B),
    sale = Color(0xFFA8520C),
    saleSoft = Color(0xFFFCEFDF),
    good = Color(0xFF1F7A4D),
    goodSoft = Color(0xFFE2F3EA),
    warn = Color(0xFF8A5A00),
    warnSoft = Color(0xFFFBF0D6),
    bad = Color(0xFFB3261E),
    badSoft = Color(0xFFFBE6E4),
    info = Color(0xFF23589B),
    infoSoft = Color(0xFFE5EEFA),
    scrim = Color(0x6B0C120F),
    toast = Color(0xFF15201B),
    onToast = Color(0xFFF5F6F4),
)

val DarkColors = IThriftColors(
    isDark = true,
    paper = Color(0xFF0E1311),
    surface = Color(0xFF161D1A),
    surface2 = Color(0xFF1E2723),
    surface3 = Color(0xFF27322D),
    ink = Color(0xFFEEF2EF),
    ink2 = Color(0xFFCFD7D2),
    muted = Color(0xFF9BA6A0),
    faint = Color(0xFF6F7A74),
    hairline = Color(0x1AEEF2EF),
    hairlineStrong = Color(0x2EEEF2EF),
    pine = Color(0xFF5FBF93),
    pineSoft = Color(0x245FBF93),
    onPine = Color(0xFF0C1A14),
    marigold = Color(0xFFF2A24E),
    sale = Color(0xFFF2A24E),
    saleSoft = Color(0x24F2A24E),
    good = Color(0xFF6FD19D),
    goodSoft = Color(0x216FD19D),
    warn = Color(0xFFF0C25A),
    warnSoft = Color(0x21F0C25A),
    bad = Color(0xFFFF8A80),
    badSoft = Color(0x21FF8A80),
    info = Color(0xFF8AB4F8),
    infoSoft = Color(0x218AB4F8),
    scrim = Color(0x99000000),
    toast = Color(0xFFEEF2EF),
    onToast = Color(0xFF0E1311),
)

val InstrumentSans = FontFamily(
    Font(R.font.instrumentsansregular, FontWeight.Normal),
    Font(R.font.instrumentsansmedium, FontWeight.Medium),
    Font(R.font.instrumentsanssemibold, FontWeight.SemiBold),
    Font(R.font.instrumentsansbold, FontWeight.Bold),
)

// References: custom design systems in Compose,
// https://developer.android.com/develop/ui/compose/designsystems/custom;
// downloadable and bundled fonts, https://developer.android.com/develop/ui/compose/text/fonts;
// Instrument Sans (SIL Open Font Licence), see assets/licences/instrumentsans.txt.

/** The type scale, the same steps as the website's phone layout. */
@Immutable
data class IThriftType(
    val display: TextStyle,
    val h1: TextStyle,
    val h2: TextStyle,
    val h3: TextStyle,
    val body: TextStyle,
    val bodyStrong: TextStyle,
    val small: TextStyle,
    val smallStrong: TextStyle,
    val tiny: TextStyle,
    val price: TextStyle,
    val button: TextStyle,
)

private fun style(size: Float, weight: FontWeight, line: Float, tracking: TextUnit = 0.sp, scale: Float) = TextStyle(
    fontFamily = InstrumentSans,
    fontWeight = weight,
    fontSize = (size * scale).sp,
    lineHeight = (line * scale).sp,
    letterSpacing = tracking,
)

fun typeScale(scale: Float) = IThriftType(
    display = style(38f, FontWeight.SemiBold, 42f, (-0.03).em, scale),
    h1 = style(28f, FontWeight.SemiBold, 33f, (-0.02).em, scale),
    h2 = style(20f, FontWeight.SemiBold, 26f, (-0.01).em, scale),
    h3 = style(17f, FontWeight.SemiBold, 23f, scale = scale),
    body = style(16f, FontWeight.Normal, 24f, scale = scale),
    bodyStrong = style(16f, FontWeight.SemiBold, 24f, scale = scale),
    small = style(14f, FontWeight.Normal, 20f, scale = scale),
    smallStrong = style(14f, FontWeight.SemiBold, 20f, scale = scale),
    tiny = style(12f, FontWeight.Normal, 18f, scale = scale),
    price = style(17f, FontWeight.SemiBold, 22f, scale = scale),
    button = style(16f, FontWeight.SemiBold, 20f, scale = scale),
)

/** Corner radii: the website's --r-sm, --r, --r-img, --r-lg and --r-xl. */
object Radius {
    val sm: Dp = 8.dp
    val md: Dp = 12.dp
    val img: Dp = 14.dp
    val lg: Dp = 20.dp
    val xl: Dp = 28.dp
    val pill = RoundedCornerShape(percent = 50)
}

/** The 8-point spacing scale. */
object Space {
    val s1: Dp = 4.dp
    val s2: Dp = 8.dp
    val s3: Dp = 12.dp
    val s4: Dp = 16.dp
    val s5: Dp = 24.dp
    val s6: Dp = 32.dp
    val s7: Dp = 48.dp
}

/** Whether animations should be kept to a minimum, from Settings. */
val LocalReduceMotion = staticCompositionLocalOf { false }
val LocalColors = staticCompositionLocalOf { LightColors }
val LocalType = staticCompositionLocalOf { typeScale(1f) }

/** Short names used by every screen: `C.pine`, `T.h1`. */
val C: IThriftColors
    @Composable get() = LocalColors.current
val T: IThriftType
    @Composable get() = LocalType.current

@Composable
fun IThriftTheme(
    themeMode: String = "system",
    largeText: Boolean = false,
    reduceMotion: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    val colors = if (dark) DarkColors else LightColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = colors.pine, onPrimary = colors.onPine, background = colors.paper, onBackground = colors.ink,
            surface = colors.surface, onSurface = colors.ink, surfaceVariant = colors.surface2, onSurfaceVariant = colors.muted,
            outline = colors.hairlineStrong, error = colors.bad, secondaryContainer = colors.pineSoft, onSecondaryContainer = colors.ink,
            surfaceContainerLow = colors.surface, surfaceContainer = colors.surface, surfaceContainerHigh = colors.surface,
        )
    } else {
        lightColorScheme(
            primary = colors.pine, onPrimary = colors.onPine, background = colors.paper, onBackground = colors.ink,
            surface = colors.surface, onSurface = colors.ink, surfaceVariant = colors.surface2, onSurfaceVariant = colors.muted,
            outline = colors.hairlineStrong, error = colors.bad, secondaryContainer = colors.pineSoft, onSecondaryContainer = colors.ink,
            surfaceContainerLow = colors.surface, surfaceContainer = colors.surface, surfaceContainerHigh = colors.surface,
        )
    }
    val type = typeScale(if (largeText) 1.125f else 1f)
    CompositionLocalProvider(
        LocalColors provides colors,
        LocalType provides type,
        LocalReduceMotion provides reduceMotion,
    ) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}
