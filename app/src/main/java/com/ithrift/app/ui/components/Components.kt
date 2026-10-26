@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.LocalReduceMotion
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.resolveImageUrl

/*
 * The building blocks every screen is made from. Each one is the Android
 * twin of a class in the website's style.css: .btn, .chip, .meter, .pill,
 * .panel, .list-item, .option, .switch-row, .segmented, .callout and so on.
 */

// --- Icons -----------------------------------------------------------------------

@Composable
fun Ico(icon: ImageVector, modifier: Modifier = Modifier, size: Dp = 20.dp, tint: Color = C.ink2, description: String? = null) {
    Icon(icon, contentDescription = description, modifier = modifier.size(size), tint = tint)
}

// --- Buttons ---------------------------------------------------------------------

enum class BtnStyle { Primary, Secondary, Ghost, Danger, Quiet }

@Composable
fun Btn(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    style: BtnStyle = BtnStyle.Primary,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    loading: Boolean = false,
    large: Boolean = false,
    small: Boolean = false,
) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val reduce = LocalReduceMotion.current
    val (bg, fg, border) = when (style) {
        BtnStyle.Primary -> Triple(C.pine, C.onPine, Color.Transparent)
        BtnStyle.Secondary -> Triple(C.surface, C.ink, C.hairlineStrong)
        BtnStyle.Ghost -> Triple(Color.Transparent, C.pine, Color.Transparent)
        BtnStyle.Danger -> Triple(C.surface, C.bad, C.bad.copy(alpha = 0.5f))
        BtnStyle.Quiet -> Triple(C.surface2, C.ink, Color.Transparent)
    }
    val height = when {
        large -> 52.dp
        small -> 36.dp
        else -> 44.dp
    }
    val active = enabled && !loading
    Row(
        modifier = modifier
            .scale(if (pressed && active && !reduce) 0.98f else 1f)
            .heightIn(min = height)
            .clip(RoundedCornerShape(Radius.md))
            .background(bg)
            .border(1.dp, border, RoundedCornerShape(Radius.md))
            .clickable(interactionSource = interaction, indication = null, enabled = active, role = Role.Button, onClick = onClick)
            .alpha(if (enabled) 1f else 0.45f)
            .padding(horizontal = if (small) 14.dp else 20.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), color = fg, strokeWidth = 2.dp)
        } else if (icon != null) {
            Ico(icon, size = if (small) 16.dp else 18.dp, tint = fg)
        }
        Text(text, style = if (small) T.smallStrong else T.button, color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A text link in pine, with an underline like the website's `.link`. */
@Composable
fun LinkText(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, style: TextStyle = T.small, color: Color = C.pine) {
    Text(
        text,
        style = style.copy(textDecoration = TextDecoration.Underline),
        color = color,
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .clickable(role = Role.Button, onClick = onClick)
            .padding(vertical = 4.dp),
    )
}

/** A round icon button, with an optional count badge (the bag and the bell). */
@Composable
fun IconBtn(
    icon: ImageVector,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    badge: Int = 0,
    alertBadge: Boolean = false,
    tint: Color = C.ink2,
    selected: Boolean = false,
    filled: Boolean = false,
) {
    Box(
        modifier = modifier
            .size(44.dp)
            .clip(CircleShape)
            .then(if (filled) Modifier.background(C.surface) else Modifier)
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = if (badge > 0) "$description, $badge" else description },
        contentAlignment = Alignment.Center,
    ) {
        Ico(icon, size = 22.dp, tint = if (selected) C.pine else tint)
        if (badge > 0) CountBadge(badge, alert = alertBadge, modifier = Modifier.align(Alignment.TopEnd).padding(top = 4.dp, end = 2.dp))
    }
}

@Composable
fun CountBadge(n: Int, alert: Boolean = false, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .defaultMinSize(minWidth = 18.dp, minHeight = 18.dp)
            .clip(Radius.pill)
            .background(if (alert) C.marigold else C.pine)
            .padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(if (n > 99) "99+" else n.toString(), color = if (alert) Color(0xFF1A1206) else C.onPine, fontSize = 11.sp, fontWeight = FontWeight.Bold, style = T.tiny)
    }
}

// --- Chips, pills, segmented, options ---------------------------------------------------

@Composable
fun Chip(
    text: String,
    selected: Boolean = false,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    removable: Boolean = false,
) {
    Row(
        modifier = modifier
            .heightIn(min = 36.dp)
            .clip(Radius.pill)
            .background(if (selected) C.ink else C.surface)
            .border(1.dp, if (selected) C.ink else C.hairlineStrong, Radius.pill)
            .clickable(role = Role.Checkbox, onClick = onClick)
            .semantics { stateDescription = if (selected) "Selected" else "Not selected" }
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val fg = if (selected) C.paper else C.ink2
        if (icon != null) Ico(icon, size = 16.dp, tint = fg)
        Text(text, style = T.small.copy(fontWeight = FontWeight.Medium), color = fg, maxLines = 1)
        if (removable) Ico(Lucide.x, size = 14.dp, tint = fg)
    }
}

enum class Tone { Neutral, Good, Warn, Bad, Info, Sale, Pine }

@Composable
fun toneColors(tone: Tone): Pair<Color, Color> = when (tone) {
    Tone.Neutral -> C.surface2 to C.ink2
    Tone.Good -> C.goodSoft to C.good
    Tone.Warn -> C.warnSoft to C.warn
    Tone.Bad -> C.badSoft to C.bad
    Tone.Info -> C.infoSoft to C.info
    Tone.Sale -> C.saleSoft to C.sale
    Tone.Pine -> C.pineSoft to C.pine
}

/** The colour of a status, as the website's `.pill.status-*` classes. */
fun statusTone(status: String): Tone = when (status) {
    "Delivered", "Refunded", "Paid", "Answered", "paid", "active" -> Tone.Good
    "Shipped", "Approved", "Offer made", "Accepted", "Received" -> Tone.Info
    "Processing", "Requested", "Pending", "Submitted", "Open", "pending" -> Tone.Warn
    "Cancelled", "Rejected", "Declined", "suspended", "refunded" -> Tone.Bad
    else -> Tone.Neutral
}

@Composable
fun Pill(text: String, tone: Tone = Tone.Neutral, modifier: Modifier = Modifier, icon: ImageVector? = null) {
    val (bg, fg) = toneColors(tone)
    Row(
        modifier = modifier.height(24.dp).clip(Radius.pill).background(bg).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (icon != null) Ico(icon, size = 12.dp, tint = fg)
        Text(text, style = T.tiny.copy(fontWeight = FontWeight.SemiBold, fontSize = 13.sp), color = fg, maxLines = 1)
    }
}

@Composable
fun StatusPill(status: String, label: String = status) = Pill(label, statusTone(status))

/** The segmented control: a row of choices on a soft track, the chosen one raised. */
@Composable
fun <K> Segmented(options: List<Pair<K, String>>, selected: K, onSelect: (K) -> Unit, modifier: Modifier = Modifier, icons: Map<K, ImageVector> = emptyMap()) {
    Row(
        modifier = modifier.clip(RoundedCornerShape(11.dp)).background(C.surface2).padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        for ((key, label) in options) {
            val on = key == selected
            Row(
                modifier = Modifier
                    .weight(1f)
                    .heightIn(min = 36.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(if (on) C.surface else Color.Transparent)
                    .clickable(role = Role.Tab) { onSelect(key) }
                    .semantics { stateDescription = if (on) "Selected" else "Not selected" }
                    .padding(horizontal = 8.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                icons[key]?.let { Ico(it, size = 16.dp, tint = if (on) C.ink else C.muted); Spacer(Modifier.width(6.dp)) }
                Text(label, style = T.small.copy(fontWeight = FontWeight.Medium), color = if (on) C.ink else C.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** A radio choice that reads as a card, as `.option` on the website. */
@Composable
fun OptionCard(
    selected: Boolean,
    onClick: () -> Unit,
    title: String,
    modifier: Modifier = Modifier,
    sub: String? = null,
    trailing: String? = null,
    checkbox: Boolean = false,
    extra: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.md))
            .background(if (selected) C.pineSoft else C.surface)
            .border(1.dp, if (selected) C.pine else C.hairlineStrong, RoundedCornerShape(Radius.md))
            .clickable(role = if (checkbox) Role.Checkbox else Role.RadioButton, onClick = onClick)
            .semantics { stateDescription = if (selected) "Selected" else "Not selected" }
            .padding(Space.s4),
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        Box(Modifier.padding(top = 2.dp)) {
            if (checkbox) CheckMark(selected) else RadioMark(selected)
        }
        Column(Modifier.weight(1f)) {
            Row {
                Text(title, style = T.bodyStrong, color = C.ink, modifier = Modifier.weight(1f))
                if (trailing != null) Text(trailing, style = T.bodyStrong, color = C.ink)
            }
            if (sub != null) Text(sub, style = T.small, color = C.muted, modifier = Modifier.padding(top = 2.dp))
            extra?.invoke()
        }
    }
}

@Composable
fun RadioMark(on: Boolean) {
    Box(
        modifier = Modifier.size(20.dp).clip(CircleShape).border(2.dp, if (on) C.pine else C.faint, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (on) Box(Modifier.size(10.dp).clip(CircleShape).background(C.pine))
    }
}

@Composable
fun CheckMark(on: Boolean) {
    Box(
        modifier = Modifier
            .size(20.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(if (on) C.pine else Color.Transparent)
            .border(2.dp, if (on) C.pine else C.faint, RoundedCornerShape(5.dp)),
        contentAlignment = Alignment.Center,
    ) {
        if (on) Ico(Lucide.check, size = 14.dp, tint = C.onPine)
    }
}

/** A tick box with its label, as `.check` on the website. */
@Composable
fun CheckRow(checked: Boolean, onChange: (Boolean) -> Unit, label: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.sm))
            .clickable(role = Role.Checkbox) { onChange(!checked) }
            .semantics { stateDescription = if (checked) "Checked" else "Not checked" }
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        CheckMark(checked)
        Text(label, style = T.body.copy(fontSize = 15.sp), color = C.ink)
    }
}

@Composable
fun SwitchRow(title: String, checked: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier, sub: String? = null) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(role = Role.Switch) { onChange(!checked) }
            .padding(vertical = Space.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s4),
    ) {
        Column(Modifier.weight(1f)) {
            Text(title, style = T.body, color = C.ink)
            if (sub != null) Text(sub, style = T.small, color = C.muted)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedTrackColor = C.pine,
                checkedThumbColor = Color.White,
                uncheckedTrackColor = C.surface3,
                uncheckedThumbColor = Color.White,
                uncheckedBorderColor = Color.Transparent,
                checkedBorderColor = Color.Transparent,
            ),
        )
    }
}

// --- The condition meter: the signature element --------------------------------------------

val CONDITIONS = linkedMapOf(
    "Excellent" to (4 to "As new. No visible wear."),
    "Very Good" to (3 to "Lightly worn. No marks."),
    "Good" to (2 to "Worn. Small marks or fading, noted in the description."),
    "Fair" to (1 to "Visible wear, priced to match."),
)

@Composable
fun ConditionMeter(condition: String, modifier: Modifier = Modifier, label: Boolean = true, large: Boolean = false) {
    val level = CONDITIONS[condition]?.first ?: 0
    Row(
        modifier = modifier.semantics(mergeDescendants = true) { contentDescription = "Condition: $condition, $level of 4" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(if (large) 4.dp else 3.dp)) {
            for (i in 1..4) {
                Box(
                    Modifier
                        .width(if (large) 28.dp else 10.dp)
                        .height(if (large) 8.dp else 6.dp)
                        .clip(RoundedCornerShape(if (large) 3.dp else 2.dp))
                        .background(if (i <= level) C.pine else C.surface3),
                )
            }
        }
        if (label) {
            Text(
                condition,
                style = if (large) T.body.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp) else T.tiny.copy(fontSize = 13.sp),
                color = if (large) C.ink else C.muted,
            )
        }
    }
}

// --- Prices and stars ------------------------------------------------------------------------

@Composable
fun PriceText(price: Double, originalPrice: Double?, onSale: Boolean, modifier: Modifier = Modifier, style: TextStyle = T.price) {
    val sale = onSale && originalPrice != null && originalPrice > price
    val text = buildAnnotatedString {
        withStyle(SpanStyle(color = if (sale) C.sale else C.ink, fontWeight = FontWeight.SemiBold)) { append(formatMoney(price)) }
        if (sale) {
            append("  ")
            withStyle(SpanStyle(color = C.faint, textDecoration = TextDecoration.LineThrough, fontWeight = FontWeight.Normal, fontSize = style.fontSize * 0.82f)) {
                append(formatMoney(originalPrice!!))
            }
        }
    }
    Text(
        text,
        style = style,
        modifier = modifier.semantics {
            contentDescription = if (sale) "${formatMoney(price)}, was ${formatMoney(originalPrice!!)}" else formatMoney(price)
        },
    )
}

@Composable
fun Stars(rating: Double, size: Dp = 16.dp, modifier: Modifier = Modifier) {
    Row(modifier.semantics(mergeDescendants = true) { contentDescription = "Rated ${"%.1f".format(rating)} out of 5" }, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        for (i in 1..5) {
            val filled = i <= kotlin.math.round(rating).toInt()
            Box {
                Ico(if (filled) Lucide.starFilled else Lucide.star, size = size, tint = if (filled) C.marigold else C.surface3)
            }
        }
    }
}

// --- Surfaces ---------------------------------------------------------------------------------

/** `.panel`: a white card with a hairline and large corners. */
@Composable
fun Panel(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(Space.s4), content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .background(C.surface)
            .border(1.dp, C.hairline, RoundedCornerShape(Radius.lg))
            .padding(padding),
        content = content,
    )
}

/** `.list`: rows separated by hairlines inside one card. */
@Composable
fun ListCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.lg))
            .background(C.surface)
            .border(1.dp, C.hairline, RoundedCornerShape(Radius.lg)),
        content = content,
    )
}

@Composable
fun Hairline(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(C.hairline))
}

/** `.list-item`: an icon tile, a title and line under it, and something at the end. */
@Composable
fun ListRow(
    title: String,
    modifier: Modifier = Modifier,
    sub: String? = null,
    icon: ImageVector? = null,
    iconTone: Tone = Tone.Neutral,
    meta: String? = null,
    count: Int? = null,
    chevron: Boolean = true,
    divider: Boolean = false,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    onClick: (() -> Unit)? = null,
) {
    if (divider) Hairline()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp)
            .then(if (onClick != null) Modifier.clickable(role = Role.Button, onClick = onClick) else Modifier)
            .padding(horizontal = Space.s4, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        if (icon != null) IconTile(icon, iconTone)
        Column(Modifier.weight(1f)) {
            Text(title, style = T.body.copy(fontWeight = FontWeight.Medium), color = C.ink)
            if (sub != null) Text(sub, style = T.small, color = C.muted, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        if (meta != null) Text(meta, style = T.small, color = C.muted, textAlign = TextAlign.End)
        if (count != null && count > 0) Pill(count.toString(), Tone.Neutral)
        trailing?.invoke(this)
        if (chevron && onClick != null) Ico(Lucide.chevronRight, size = 18.dp, tint = C.faint)
    }
}

@Composable
fun IconTile(icon: ImageVector, tone: Tone = Tone.Neutral, size: Dp = 36.dp) {
    val (bg, fg) = when (tone) {
        Tone.Neutral -> C.surface2 to C.ink2
        else -> toneColors(tone)
    }
    Box(Modifier.size(size).clip(RoundedCornerShape(10.dp)).background(bg), contentAlignment = Alignment.Center) {
        Ico(icon, size = 18.dp, tint = fg)
    }
}

/** `.callout`: a tinted note with an icon. */
@Composable
fun Callout(text: String, modifier: Modifier = Modifier, tone: Tone = Tone.Neutral, icon: ImageVector = Lucide.info, content: (@Composable ColumnScope.() -> Unit)? = null) {
    val (bg, fg) = toneColors(tone)
    Row(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.md)).background(bg).padding(horizontal = Space.s4, vertical = Space.s3),
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        Ico(icon, size = 18.dp, tint = if (tone == Tone.Neutral) C.ink2 else fg, modifier = Modifier.padding(top = 2.dp))
        Column(Modifier.weight(1f)) {
            Text(text, style = T.body.copy(fontSize = 15.sp), color = if (tone == Tone.Neutral) C.ink2 else fg)
            content?.invoke(this)
        }
    }
}

@Composable
fun SectionHead(title: String, modifier: Modifier = Modifier, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    Row(
        modifier = modifier.fillMaxWidth().padding(bottom = Space.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, style = T.h2, color = C.ink, modifier = Modifier.weight(1f).semantics { heading() })
        if (actionLabel != null && onAction != null) {
            Text(
                actionLabel,
                style = T.small.copy(fontWeight = FontWeight.Medium),
                color = C.pine,
                modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable(role = Role.Button, onClick = onAction).padding(4.dp),
            )
        }
    }
}

/** A small group heading above a list, as `.group-label`. */
@Composable
fun GroupLabel(text: String, modifier: Modifier = Modifier) {
    Text(text, style = T.small.copy(fontWeight = FontWeight.SemiBold), color = C.muted, modifier = modifier.padding(top = Space.s5, bottom = Space.s2).semantics { heading() })
}

@Composable
fun PageHead(title: String, modifier: Modifier = Modifier, sub: String? = null) {
    Column(modifier.fillMaxWidth().padding(bottom = Space.s4)) {
        Text(title, style = T.h1, color = C.ink, modifier = Modifier.semantics { heading() })
        if (sub != null) Text(sub, style = T.body, color = C.muted, modifier = Modifier.padding(top = 6.dp))
    }
}

/** Two values on one line, as the website's `.summary-row`. */
@Composable
fun SummaryRow(label: String, value: String, modifier: Modifier = Modifier, strong: Boolean = false, valueColor: Color? = null) {
    Row(modifier.fillMaxWidth().padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = if (strong) T.h3 else T.body, color = if (strong) C.ink else C.ink2, modifier = Modifier.weight(1f))
        Text(value, style = if (strong) T.h3 else T.body, color = valueColor ?: C.ink)
    }
}

@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier, color: Color = C.pine) {
    Box(modifier.fillMaxWidth().height(6.dp).clip(Radius.pill).background(C.surface3)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).height(6.dp).clip(Radius.pill).background(color))
    }
}

// --- States: loading, empty and error -------------------------------------------------------------

@Composable
fun Skeleton(modifier: Modifier = Modifier, corner: Dp = Radius.md) {
    val reduce = LocalReduceMotion.current
    val alpha = if (reduce) 0.7f else {
        val t = rememberInfiniteTransition(label = "skeleton")
        t.animateFloat(0.45f, 0.9f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "pulse").value
    }
    Box(modifier.clip(RoundedCornerShape(corner)).background(C.surface3).alpha(alpha))
}

@Composable
fun SkeletonPage(modifier: Modifier = Modifier) {
    Column(modifier.fillMaxWidth().padding(Space.s4).semantics { contentDescription = "Loading" }, verticalArrangement = Arrangement.spacedBy(Space.s4)) {
        Skeleton(Modifier.width(220.dp).height(32.dp))
        Skeleton(Modifier.fillMaxWidth().height(120.dp), Radius.lg)
        Skeleton(Modifier.fillMaxWidth().height(120.dp), Radius.lg)
        Skeleton(Modifier.fillMaxWidth().height(80.dp), Radius.lg)
    }
}

@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    text: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    secondaryLabel: String? = null,
    onSecondary: (() -> Unit)? = null,
) {
    Column(
        modifier.fillMaxWidth().padding(horizontal = Space.s5, vertical = Space.s7),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(64.dp).clip(RoundedCornerShape(20.dp)).background(C.surface2), contentAlignment = Alignment.Center) {
            Ico(icon, size = 28.dp, tint = C.muted)
        }
        Spacer(Modifier.height(Space.s4))
        Text(title, style = T.h2, color = C.ink, textAlign = TextAlign.Center, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(6.dp))
        Text(text, style = T.body, color = C.muted, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 360.dp))
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(Space.s5))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                Btn(actionLabel, onAction)
                if (secondaryLabel != null && onSecondary != null) Btn(secondaryLabel, onSecondary, style = BtnStyle.Secondary)
            }
        }
    }
}

@Composable
fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    EmptyState(
        icon = Lucide.wifiOff,
        title = "That did not load",
        text = message,
        modifier = modifier,
        actionLabel = "Try again",
        onAction = onRetry,
    )
}

// --- Text fields --------------------------------------------------------------------------------

/** `.field`: a label, the input, then a hint or an error under it. */
@Composable
fun Field(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    hint: String? = null,
    error: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    onIme: (() -> Unit)? = null,
    password: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
    maxLength: Int? = null,
    enabled: Boolean = true,
    labelAction: (@Composable () -> Unit)? = null,
) {
    var focused by remember { mutableStateOf(false) }
    var reveal by remember { mutableStateOf(false) }
    Column(modifier.fillMaxWidth().padding(bottom = Space.s4)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = T.smallStrong, color = C.ink, modifier = Modifier.weight(1f).padding(bottom = 6.dp))
            labelAction?.invoke()
            if (password) {
                LinkText(if (reveal) "Hide" else "Show", { reveal = !reveal }, modifier = Modifier.padding(bottom = 2.dp))
            }
        }
        val borderColor = when {
            error != null -> C.bad
            focused -> C.pine
            else -> C.hairlineStrong
        }
        BasicTextField(
            value = value,
            onValueChange = { v -> onValueChange(if (maxLength != null) v.take(maxLength) else v) },
            enabled = enabled,
            singleLine = singleLine,
            minLines = if (singleLine) 1 else minLines.coerceAtLeast(3),
            textStyle = T.body.copy(color = C.ink),
            cursorBrush = SolidColor(C.pine),
            visualTransformation = if (password && !reveal) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboardType, imeAction = imeAction),
            keyboardActions = KeyboardActions(onAny = { onIme?.invoke() }),
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused }
                .semantics { if (error != null) stateDescription = "Error: $error" },
            decorationBox = { inner ->
                Box(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radius.md))
                        .background(if (enabled) C.surface else C.surface2)
                        .border(if (focused) 2.dp else 1.dp, borderColor, RoundedCornerShape(Radius.md))
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    contentAlignment = if (singleLine) Alignment.CenterStart else Alignment.TopStart,
                ) {
                    if (value.isEmpty() && placeholder != null) Text(placeholder, style = T.body, color = C.faint)
                    inner()
                }
            },
        )
        if (error != null) {
            Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Ico(Lucide.circleAlert, size = 14.dp, tint = C.bad, modifier = Modifier.padding(top = 2.dp))
                Text(error, style = T.small.copy(fontSize = 13.sp), color = C.bad)
            }
        } else if (hint != null) {
            Text(hint, style = T.small.copy(fontSize = 13.sp), color = C.muted, modifier = Modifier.padding(top = 6.dp))
        }
    }
}

/** The rounded search box from the website's header. */
@Composable
fun SearchBox(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search brands and pieces",
    onSubmit: () -> Unit = {},
    focusModifier: Modifier = Modifier,
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = T.body.copy(color = C.ink, fontSize = 15.sp),
        cursorBrush = SolidColor(C.pine),
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
        modifier = modifier.fillMaxWidth().then(focusModifier),
        decorationBox = { inner ->
            Row(
                Modifier.fillMaxWidth().height(44.dp).clip(Radius.pill).background(C.surface2).padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Ico(Lucide.search, size = 18.dp, tint = C.faint)
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, style = T.body.copy(fontSize = 15.sp), color = C.faint, maxLines = 1)
                    inner()
                }
                if (value.isNotEmpty()) {
                    Box(Modifier.size(28.dp).clip(CircleShape).clickable(role = Role.Button) { onValueChange("") }.semantics { contentDescription = "Clear search" }, contentAlignment = Alignment.Center) {
                        Ico(Lucide.x, size = 16.dp, tint = C.muted)
                    }
                }
            }
        },
    )
}

// --- Images ---------------------------------------------------------------------------------------

/** A product photo from the API, on the soft ground the website uses while it loads. */
@Composable
fun RemoteImage(path: String, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop, description: String? = null) {
    val context = LocalContext.current
    Box(modifier.background(C.surface2)) {
        AsyncImage(
            model = resolveImageUrl(context, path),
            contentDescription = description,
            contentScale = contentScale,
            modifier = Modifier.matchParentSize(),
        )
    }
}

/** A wrapping row of chips or buttons. */
@Composable
fun Wrap(modifier: Modifier = Modifier, spacing: Dp = Space.s2, content: @Composable () -> Unit) {
    FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(spacing), verticalArrangement = Arrangement.spacedBy(spacing)) { content() }
}

@Composable
fun BorderedBox(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(modifier.border(BorderStroke(1.dp, C.hairline), RoundedCornerShape(Radius.md))) { content() }
}
