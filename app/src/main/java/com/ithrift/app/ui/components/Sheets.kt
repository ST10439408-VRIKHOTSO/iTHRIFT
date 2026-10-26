@file:OptIn(ExperimentalMaterial3Api::class)

package com.ithrift.app.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.ui.AppState
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.LocalReduceMotion
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T

/**
 * The bottom sheet every form and picker opens in, as `.sheet` on the
 * website's phone layout: a title with a close button, a scrolling body and
 * an optional footer for the buttons.
 *
 * Reference: Bottom sheets in Material 3 for Compose,
 * https://developer.android.com/develop/ui/compose/components/bottom-sheets
 */
@Composable
fun Sheet(
    title: String,
    onDismiss: () -> Unit,
    footer: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = state,
        containerColor = C.surface,
        scrimColor = C.scrim,
        shape = RoundedCornerShape(topStart = Radius.xl, topEnd = Radius.xl),
        dragHandle = {
            Box(Modifier.padding(top = 10.dp).width(36.dp).height(5.dp).clip(RoundedCornerShape(3.dp)).background(C.surface3))
        },
    ) {
        Column(Modifier.fillMaxWidth().imePadding()) {
            Row(Modifier.fillMaxWidth().padding(start = Space.s5, end = Space.s3, top = Space.s2, bottom = Space.s2), verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = T.h2, color = C.ink, modifier = Modifier.weight(1f).semantics { heading() })
                IconBtn(Lucide.x, "Close", onDismiss)
            }
            Hairline()
            Column(
                Modifier
                    .weight(1f, fill = false)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Space.s5, vertical = Space.s4),
                content = content,
            )
            if (footer != null) {
                Hairline()
                Box(Modifier.fillMaxWidth().padding(horizontal = Space.s5, vertical = Space.s3).navigationBarsPadding()) { footer() }
            } else {
                Spacer(Modifier.navigationBarsPadding())
            }
        }
    }
}

/** The confirm dialog for anything that cannot be undone: cancel, delete, sign out. */
@Composable
fun ConfirmDialog(
    title: String,
    body: String,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    danger: Boolean = false,
    cancelLabel: String = "Keep it",
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = C.surface,
        shape = RoundedCornerShape(Radius.lg),
        title = { Text(title, style = T.h2, color = C.ink) },
        text = { Text(body, style = T.body, color = C.ink2) },
        confirmButton = {
            Btn(confirmLabel, { onConfirm(); onDismiss() }, style = if (danger) BtnStyle.Danger else BtnStyle.Primary)
        },
        dismissButton = { Btn(cancelLabel, onDismiss, style = BtnStyle.Secondary) },
    )
}

/** The toasts, stacked at the bottom of the screen above the tab bar. */
@Composable
fun ToastHost(app: AppState, modifier: Modifier = Modifier) {
    val reduce = LocalReduceMotion.current
    Column(modifier.fillMaxWidth().padding(horizontal = Space.s4), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
        for (t in app.toasts.toList()) {
            AnimatedVisibility(
                visible = true,
                enter = if (reduce) fadeIn() else fadeIn() + slideInVertically { it / 2 },
                exit = if (reduce) fadeOut() else fadeOut() + slideOutVertically { it / 2 },
            ) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .shadow(8.dp, RoundedCornerShape(Radius.md))
                        .clip(RoundedCornerShape(Radius.md))
                        .background(C.toast)
                        .heightIn(min = 52.dp)
                        .clickable { app.dismissToast(t) }
                        .semantics { liveRegion = LiveRegionMode.Polite }
                        .padding(horizontal = Space.s4, vertical = Space.s3),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Space.s3),
                ) {
                    when (t.kind) {
                        ToastKind.Success -> Ico(Lucide.circleCheck, size = 20.dp, tint = if (C.isDark) androidx.compose.ui.graphics.Color(0xFF1F7A4D) else androidx.compose.ui.graphics.Color(0xFF6FD19D))
                        ToastKind.Error -> Ico(Lucide.circleAlert, size = 20.dp, tint = if (C.isDark) androidx.compose.ui.graphics.Color(0xFFB3261E) else androidx.compose.ui.graphics.Color(0xFFFF8A80))
                        ToastKind.Plain -> {}
                    }
                    Text(t.message, style = T.body.copy(fontSize = 15.sp), color = C.onToast, modifier = Modifier.weight(1f))
                    if (t.actionLabel != null) {
                        Text(
                            t.actionLabel,
                            style = T.body.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold, textDecoration = TextDecoration.Underline),
                            color = C.onToast,
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .clickable(role = Role.Button) {
                                    app.dismissToast(t)
                                    t.onAction?.invoke()
                                }
                                .padding(6.dp),
                        )
                    }
                }
            }
        }
    }
}

/** A small round close button on a coloured ground, used on the lightbox. */
@Composable
fun CloseCircle(onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier.size(44.dp).clip(CircleShape).background(C.surface).clickable(role = Role.Button, onClick = onClick).semantics { contentDescription = "Close" },
        contentAlignment = Alignment.Center,
    ) { Ico(Lucide.x, size = 22.dp, tint = C.ink) }
}
