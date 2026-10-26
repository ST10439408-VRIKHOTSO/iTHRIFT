@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.staff

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.Analytics
import com.ithrift.app.data.AnswerRequest
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.BulkPriceRequest
import com.ithrift.app.data.Collection
import com.ithrift.app.data.InventoryReport
import com.ithrift.app.data.OrderDetail
import com.ithrift.app.data.OrderListItem
import com.ithrift.app.data.OrderStatusRequest
import com.ithrift.app.data.Product
import com.ithrift.app.data.ProductRequest
import com.ithrift.app.data.ProductSize
import com.ithrift.app.data.Promo
import com.ithrift.app.data.PromoActiveRequest
import com.ithrift.app.data.PromoRequest
import com.ithrift.app.data.ReturnItem
import com.ithrift.app.data.SellSubmission
import com.ithrift.app.data.SellUpdateRequest
import com.ithrift.app.data.StaffQuestion
import com.ithrift.app.data.StaffUser
import com.ithrift.app.data.StatusRequest
import com.ithrift.app.data.SupportTicket
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.CONDITIONS
import com.ithrift.app.ui.components.Callout
import com.ithrift.app.ui.components.CheckMark
import com.ithrift.app.ui.components.Chip
import com.ithrift.app.ui.components.ConditionMeter
import com.ithrift.app.ui.components.ConfirmDialog
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.GroupLabel
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.IconBtn
import com.ithrift.app.ui.components.IconTile
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.ListCard
import com.ithrift.app.ui.components.ListRow
import com.ithrift.app.ui.components.OptionCard
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.Pill
import com.ithrift.app.ui.components.PriceText
import com.ithrift.app.ui.components.ProgressBar
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.SearchBox
import com.ithrift.app.ui.components.Segmented
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.StatusPill
import com.ithrift.app.ui.components.SummaryRow
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.components.Wrap
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.screens.LineItem
import com.ithrift.app.ui.screens.OrderRow
import com.ithrift.app.ui.screens.TicketList
import com.ithrift.app.ui.screens.categoryIcon
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.dateLabel
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.plural
import com.ithrift.app.util.timeAgo

/** Shows [content] to staff and the administrator; anyone else is told why not. */
@Composable
fun StaffOnly(content: @Composable () -> Unit) {
    val app = LocalApp.current
    if (app.isStaff) content()
    else EmptyState(Lucide.lock, "Staff only", "Sign in with a staff or administrator account to use the console.", actionLabel = "Sign in", onAction = { app.go(Routes.login(Routes.CONSOLE)) })
}

/* ----------------------------- Console: dashboard and sections ----------------------------- */

@Composable
fun ConsoleScreen() {
    val app = LocalApp.current
    val load = rememberLoad<Analytics>(app.user?.id) { if (app.isStaff) safeApiCall { app.api.analytics() } else ApiOutcome.Failure("Staff only.") }
    Screen("Console", back = false) {
        StaffOnly {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> Dashboard(s.data)
            }
        }
    }
}

@Composable
private fun Dashboard(a: Analytics) {
    val app = LocalApp.current
    val att = a.attention
    PageHead("Dashboard", sub = "Signed in as ${app.user?.name}.")

    GroupLabel("Needs attention", Modifier.padding(top = 0.dp))
    ListCard {
        ListRow("Orders to pack", icon = Lucide.packageIcon, iconTone = if (att.processing > 0) Tone.Warn else Tone.Neutral, meta = "${att.processing}", onClick = { app.go(Routes.staffOrders("Processing")) })
        ListRow("Collections", icon = Lucide.store, meta = if (att.collectionsToday > 0) "${att.collectionsToday} today" else null, divider = true, onClick = { app.go(Routes.STAFF_COLLECTIONS) })
        ListRow("Returns to decide", icon = Lucide.rotateCcw, iconTone = if (att.returnsWaiting > 0) Tone.Warn else Tone.Neutral, meta = "${att.returnsWaiting}", divider = true, onClick = { app.go(Routes.STAFF_RETURNS) })
        ListRow("Support inbox", icon = Lucide.inbox, iconTone = if (att.ticketsOpen > 0) Tone.Warn else Tone.Neutral, meta = "${att.ticketsOpen} open", divider = true, onClick = { app.go(Routes.STAFF_SUPPORT) })
        ListRow("Unanswered questions", icon = Lucide.messageCircle, iconTone = if (att.questionsWaiting > 0) Tone.Warn else Tone.Neutral, meta = "${att.questionsWaiting}", divider = true, onClick = { app.go(Routes.STAFF_QUESTIONS) })
        ListRow("Buy-back offers to action", icon = Lucide.handCoins, iconTone = if (att.sellWaiting > 0) Tone.Warn else Tone.Neutral, meta = "${att.sellWaiting}", divider = true, onClick = { app.go(Routes.STAFF_SELL) })
    }
    GroupLabel("Stock")
    ListCard {
        ListRow("Listings", sub = "Edit pieces, stock per size and markdowns", icon = Lucide.tags, onClick = { app.go(Routes.STAFF_LISTINGS) })
        ListRow("Inventory", sub = "${att.outOfStock} sold out, ${att.lastOne} down to the last piece", icon = Lucide.box, divider = true, onClick = { app.go(Routes.STAFF_INVENTORY) })
        ListRow("Promo codes", icon = Lucide.percent, divider = true, onClick = { app.go(Routes.STAFF_PROMOS) })
        if (app.isAdmin) ListRow("Customers", sub = "Suspend and reactivate accounts", icon = Lucide.users, divider = true, onClick = { app.go(Routes.STAFF_CUSTOMERS) })
    }

    GroupLabel("Last 30 days")
    Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
        Stat("Revenue", formatMoney(a.last30.revenue), delta(a.last30.revenue, a.prev30.revenue), Modifier.weight(1f))
        Stat("Orders", "${a.last30.orders}", delta(a.last30.orders.toDouble(), a.prev30.orders.toDouble()), Modifier.weight(1f))
    }
    Spacer(Modifier.height(Space.s2))
    Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
        Stat("Average order", formatMoney(a.averageOrderValue), "${plural(a.all.orders, "order")} in total" to null, Modifier.weight(1f))
        Stat("Returned", "${a.returnRate}%", "of ${plural(a.itemsSold, "piece")} sold" to null, Modifier.weight(1f))
    }
    Spacer(Modifier.height(Space.s4))
    Panel {
        Text("Revenue per day", style = T.h3, color = C.ink)
        Text("Last 30 days, cancelled orders left out", style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3))
        RevenueChart(a)
    }
    Spacer(Modifier.height(Space.s4))
    Panel {
        Text("Sales by category", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
        Bars(a.categories.map { it.name to it.revenue }) { formatMoney(it) }
    }
    Spacer(Modifier.height(Space.s4))
    Panel {
        Text("Top brands", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
        Bars(a.topBrands.map { it.name to it.revenue }) { formatMoney(it) }
    }
    Spacer(Modifier.height(Space.s4))
    Panel {
        Text("How customers pay", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
        Bars(a.payments.map { (mapOf("card" to "Card", "payfast" to "PayFast", "eft" to "EFT")[it.method] ?: it.method) to it.count.toDouble() }) { plural(it.toInt(), "order") }
        Text("How orders reach customers", style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s5, bottom = Space.s3))
        Bars(a.delivery.map { (mapOf("standard" to "Standard", "express" to "Express", "collection" to "Collection")[it.method] ?: it.method) to it.count.toDouble() }) { plural(it.toInt(), "order") }
    }
    Text("${a.customers} customers, ${a.newCustomers30} new in the last 30 days.", style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s4))
}

private fun delta(now: Double, before: Double): Pair<String, Boolean?> {
    if (before == 0.0) return (if (now > 0) "New this month" else "No sales yet") to (now > 0)
    val pct = Math.round((now - before) / before * 100).toInt()
    return "${if (pct >= 0) "Up" else "Down"} ${kotlin.math.abs(pct)}% on the 30 days before" to (pct >= 0)
}

@Composable
private fun Stat(label: String, value: String, delta: Pair<String, Boolean?>, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(Radius.lg)).background(C.surface).border(1.dp, C.hairline, RoundedCornerShape(Radius.lg)).padding(Space.s4)) {
        Text(label, style = T.small, color = C.muted)
        Text(value, style = T.h2.copy(fontSize = 24.sp), color = C.ink, modifier = Modifier.padding(vertical = 4.dp))
        Text(delta.first, style = T.tiny, color = when (delta.second) { true -> C.good; false -> C.bad; null -> C.muted })
    }
}

/** Daily revenue as columns: an empty day reads as an empty slot, not a line diving to zero. */
@Composable
private fun RevenueChart(a: Analytics) {
    val pine = C.pine
    val grid = C.hairline
    val days = a.days
    val max = (days.maxOfOrNull { it.revenue } ?: 0.0).coerceAtLeast(1.0)
    val best = days.maxByOrNull { it.revenue }
    Canvas(
        Modifier.fillMaxWidth().height(160.dp).semantics {
            contentDescription = "Revenue per day for the last 30 days. Best day ${dateLabel(best?.day, year = false)} with ${formatMoney(best?.revenue ?: 0.0)}."
        },
    ) {
        val slot = size.width / days.size.coerceAtLeast(1)
        for (i in 0..2) {
            val y = size.height * i / 2f
            drawLine(grid, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        }
        days.forEachIndexed { i, d ->
            if (d.revenue <= 0) return@forEachIndexed
            val h = (d.revenue / max).toFloat() * size.height
            drawRoundRect(
                color = if (d == best) pine else pine.copy(alpha = 0.55f),
                topLeft = Offset(i * slot + slot * 0.18f, size.height - h),
                size = Size(slot * 0.64f, h),
                cornerRadius = CornerRadius(4f, 4f),
            )
        }
    }
    Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
        Text(dateLabel(days.firstOrNull()?.day, year = false), style = T.tiny, color = C.muted, modifier = Modifier.weight(1f))
        Text("Top day ${formatMoney(max)}", style = T.tiny, color = C.muted, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Text(dateLabel(days.lastOrNull()?.day, year = false), style = T.tiny, color = C.muted, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.End)
    }
}

@Composable
private fun Bars(rows: List<Pair<String, Double>>, label: (Double) -> String) {
    if (rows.isEmpty()) { Text("No sales yet.", style = T.body, color = C.muted); return }
    val max = rows.maxOf { it.second }.coerceAtLeast(1.0)
    for ((name, v) in rows) {
        Column(Modifier.padding(bottom = Space.s3)) {
            Row {
                Text(name, style = T.small, color = C.ink, modifier = Modifier.weight(1f))
                Text(label(v), style = T.smallStrong, color = C.ink)
            }
            ProgressBar((v / max).toFloat(), Modifier.padding(top = 4.dp))
        }
    }
}

/* ----------------------------- Processing one order ----------------------------- */

/** The Process order panel on an order, as the website's console shows it. */
@Composable
fun ProcessOrderPanel(order: OrderDetail, onDone: () -> Unit) {
    val app = LocalApp.current
    val collect = order.deliveryMethod == "collection"
    val next = order.nextStatuses.orEmpty()
    var status by remember(order.id, order.status) { mutableStateOf(next.firstOrNull()) }
    var courier by remember { mutableStateOf(order.courierRef ?: "") }
    var note by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    Panel {
        Text("Process order", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
        if (next.isEmpty()) {
            Text("This order is ${order.status.lowercase()}, so nothing more can change.", style = T.small, color = C.muted)
            return@Panel
        }
        Text("Move to", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        for (st in next) {
            val label = if (collect) mapOf("Shipped" to "Ready to collect", "Delivered" to "Collected")[st] ?: st else st
            OptionCard(status == st, { status = st }, label, modifier = Modifier.padding(bottom = Space.s2))
        }
        Spacer(Modifier.height(Space.s2))
        if (!collect && status == "Shipped") Field("Courier reference", courier, { courier = it }, placeholder = "For example CR-1042")
        Field("Note for the timeline (optional)", note, { note = it }, maxLength = 200)
        Btn("Update order", {
            val st = status ?: return@Btn
            busy = true
            app.run({ safeApiCall { app.api.setOrderStatus(order.id, OrderStatusRequest(st, courier.ifBlank { null }, note.ifBlank { null })) } }, onDone = { busy = false }) {
                app.toast("Order marked ${st.lowercase()}. The customer has been notified.", ToastKind.Success)
                onDone()
            }
        }, loading = busy, modifier = Modifier.fillMaxWidth())
    }
}

/* ----------------------------- Orders ----------------------------- */

@Composable
fun StaffOrdersScreen(status: String) {
    val app = LocalApp.current
    var st by remember { mutableStateOf(status) }
    var method by remember { mutableStateOf("") }
    val load = rememberLoad<List<OrderListItem>>(st, method, app.user?.id) {
        val f = buildMap { if (st.isNotEmpty()) put("status", st); if (method.isNotEmpty()) put("method", method) }
        when (val r = safeApiCall { app.api.getOrders(f) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.orders)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Orders", back = false) {
        StaffOnly {
            PageHead("Orders", sub = load.data?.let { plural(it.size, "order") + if (st.isNotEmpty()) ", ${st.lowercase()}" else "" })
            Wrap {
                for (v in listOf("", "Processing", "Shipped", "Delivered", "Cancelled")) Chip(v.ifEmpty { "All" }, st == v, { st = v })
            }
            Spacer(Modifier.height(Space.s3))
            Segmented(listOf("" to "Any", "standard" to "Standard", "express" to "Express", "collection" to "Collect"), method, { method = it }, Modifier.fillMaxWidth())
            Spacer(Modifier.height(Space.s4))
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> if (s.data.isEmpty()) EmptyState(Lucide.packageIcon, "No orders here", "Nothing matches this filter.")
                else ListCard { s.data.forEachIndexed { i, o -> OrderRow(o, i > 0, staff = true) { app.go(Routes.order(o.id)) } } }
            }
        }
    }
}

/* ----------------------------- Collections ----------------------------- */

@Composable
fun StaffCollectionsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<Collection>>(app.user?.id) {
        when (val r = safeApiCall { app.api.collections() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.collections)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Collections") {
        StaffOnly {
            PageHead("Store collections", sub = "Orders waiting to be collected from Hatfield, by booked day and slot.")
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> if (s.data.isEmpty()) EmptyState(Lucide.store, "No collections waiting", "Orders placed for collection appear here by day.")
                else for ((day, list) in s.data.groupBy { it.date ?: "" }) {
                    GroupLabel(if (day.isEmpty()) "No slot booked" else dateLabel(day, year = false, weekday = true))
                    ListCard {
                        list.forEachIndexed { i, c ->
                            var busy by remember { mutableStateOf(false) }
                            ListRow(
                                "${c.slot ?: "Any time"}, ${c.ref}",
                                sub = "${c.customer}${c.phone?.let { ", $it" } ?: ""}. ${plural(c.items, "piece")}, ${formatMoney(c.total)}",
                                icon = Lucide.store, iconTone = Tone.Pine, divider = i > 0, chevron = false,
                                onClick = { app.go(Routes.order(c.id)) },
                                trailing = {
                                    Btn("Collected", {
                                        busy = true
                                        app.run({ safeApiCall { app.api.setOrderStatus(c.id, OrderStatusRequest("Delivered", note = "Collected from the Hatfield store")) } }, onDone = { busy = false }) {
                                            app.toast("Marked as collected.", ToastKind.Success)
                                            load.reload()
                                        }
                                    }, style = BtnStyle.Secondary, small = true, loading = busy)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Returns ----------------------------- */

@Composable
fun StaffReturnsScreen() {
    val app = LocalApp.current
    var filter by remember { mutableStateOf("Requested") }
    var rejecting by remember { mutableStateOf<ReturnItem?>(null) }
    val load = rememberLoad<List<ReturnItem>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getReturns() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.returns)
            is ApiOutcome.Failure -> r
        }
    }
    fun set(r: ReturnItem, to: String) {
        app.run({ safeApiCall { app.api.setReturnStatus(r.id, StatusRequest(to)) } }) {
            app.toast("Return ${to.lowercase()}. The customer has been told.", ToastKind.Success)
            load.reload()
        }
    }
    Screen("Returns") {
        StaffOnly {
            PageHead("Returns", sub = "Approve when the parcel is on its way back. Refund once it arrives and passes inspection; the piece goes back on sale in its size.")
            Wrap { for (v in listOf("", "Requested", "Approved", "Rejected", "Refunded")) Chip(v.ifEmpty { "All" }, filter == v, { filter = v }) }
            Spacer(Modifier.height(Space.s4))
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val shown = s.data.filter { filter.isEmpty() || it.status == filter }
                    if (shown.isEmpty()) EmptyState(Lucide.rotateCcw, "No returns here", "Nothing matches this filter.")
                    else Panel {
                        shown.forEachIndexed { i, r ->
                            if (i > 0) Hairline()
                            LineItem(r.image, r.productName + (r.size?.let { ", $it" } ?: ""), "${r.orderRef}, ${r.customer ?: ""}. ${r.reason}", if (r.refundAmount > 0) formatMoney(r.refundAmount) else null, onOpen = { app.go(Routes.order(r.orderId)) }) {
                                if (!r.comment.isNullOrBlank()) Text(r.comment, style = T.small, color = C.muted)
                                Row(Modifier.padding(top = 6.dp)) { StatusPill(r.status) }
                                val next = r.nextStatuses.orEmpty()
                                if (next.isNotEmpty()) Wrap(Modifier.padding(top = Space.s2)) {
                                    for (n in next) {
                                        val label = mapOf("Approved" to "Approve", "Rejected" to "Reject", "Refunded" to "Refund")[n] ?: n
                                        Btn(label, { if (n == "Rejected") rejecting = r else set(r, n) }, style = when (n) { "Rejected" -> BtnStyle.Danger; "Refunded" -> BtnStyle.Primary; else -> BtnStyle.Secondary }, small = true)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    rejecting?.let { r ->
        ConfirmDialog("Reject this return?", "The customer is told it does not meet the returns policy. You can approve it later.", "Reject return", onConfirm = { set(r, "Rejected") }, onDismiss = { rejecting = null }, danger = true)
    }
}

/* ----------------------------- Questions ----------------------------- */

@Composable
fun StaffQuestionsScreen() {
    val app = LocalApp.current
    var status by remember { mutableStateOf("open") }
    val load = rememberLoad<List<StaffQuestion>>(status, app.user?.id) {
        when (val r = safeApiCall { app.api.staffQuestions(status) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.questions)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Questions") {
        StaffOnly {
            PageHead("Product questions", sub = "Answers appear on the product page for everyone, and the customer who asked is notified.")
            Segmented(listOf("open" to "Waiting", "answered" to "Answered", "all" to "All"), status, { status = it }, Modifier.fillMaxWidth())
            Spacer(Modifier.height(Space.s4))
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> if (s.data.isEmpty()) EmptyState(Lucide.messageCircle, if (status == "open") "All questions answered" else "No questions here", "New questions from the product pages appear here.")
                else for (q in s.data) {
                    var answer by remember(q.id) { mutableStateOf("") }
                    var busy by remember(q.id) { mutableStateOf(false) }
                    Panel(Modifier.padding(bottom = Space.s3)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                            RemoteImage(q.image, Modifier.size(56.dp).clip(RoundedCornerShape(Radius.md)))
                            Column(Modifier.weight(1f)) {
                                LinkText(q.productName, { app.go(Routes.product(q.productId)) }, color = C.muted)
                                Text(q.question, style = T.bodyStrong, color = C.ink)
                                Text("${q.customer}, ${timeAgo(q.createdAt)}", style = T.tiny, color = C.muted)
                            }
                        }
                        if (q.answer != null) {
                            Callout(q.answer + "\n" + (q.answeredBy ?: "Staff") + ", " + (q.answeredAt?.let { timeAgo(it) } ?: ""), tone = Tone.Good, icon = Lucide.check, modifier = Modifier.padding(top = Space.s3))
                        } else {
                            Spacer(Modifier.height(Space.s3))
                            Field("Answer", answer, { answer = it }, placeholder = "Write an answer customers will see", singleLine = false, maxLength = 600)
                            Btn("Publish answer", {
                                if (answer.trim().length < 2) return@Btn
                                busy = true
                                app.run({ safeApiCall { app.api.answerQuestion(q.id, AnswerRequest(answer.trim())) } }, onDone = { busy = false }) {
                                    app.toast("Answer published.", ToastKind.Success)
                                    load.reload()
                                }
                            }, loading = busy)
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Buy-back offers ----------------------------- */

@Composable
fun StaffSellScreen() {
    val app = LocalApp.current
    var filter by remember { mutableStateOf("") }
    var offering by remember { mutableStateOf<SellSubmission?>(null) }
    var declining by remember { mutableStateOf<SellSubmission?>(null) }
    val load = rememberLoad<List<SellSubmission>>(filter, app.user?.id) {
        when (val r = safeApiCall { app.api.sellSubmissions(if (filter.isEmpty()) emptyMap() else mapOf("status" to filter)) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.submissions)
            is ApiOutcome.Failure -> r
        }
    }
    fun step(s: SellSubmission, to: String) {
        app.run({ safeApiCall { app.api.updateSell(s.id, SellUpdateRequest(to)) } }) {
            app.toast(if (to == "Declined") "Declined." else "Marked ${to.lowercase()}. The customer has been told.", ToastKind.Success)
            load.reload()
        }
    }
    Screen("Buy-back offers") {
        StaffOnly {
            PageHead("Buy-back offers", sub = "Pieces customers want to sell to the shop. Make an offer, then mark it received and paid.")
            Wrap { for (v in listOf("", "Submitted", "Offer made", "Accepted", "Received", "Paid", "Declined")) Chip(v.ifEmpty { "All" }, filter == v, { filter = v }) }
            Spacer(Modifier.height(Space.s4))
            when (val st = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(st.message, { load.reload() })
                is Load.Ready -> if (st.data.isEmpty()) EmptyState(Lucide.handCoins, "Nothing here", "Offers from customers appear here.")
                else ListCard {
                    st.data.forEachIndexed { i, s ->
                        if (i > 0) Hairline()
                        Row(Modifier.fillMaxWidth().padding(Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                            IconTile(categoryIcon(s.category))
                            Column(Modifier.weight(1f)) {
                                Wrap(spacing = 6.dp) {
                                    Text("${s.brand} ${s.category.lowercase()}, ${s.size}", style = T.bodyStrong, color = C.ink)
                                    StatusPill(s.status)
                                }
                                Text(
                                    "${s.ref} from ${s.customer ?: ""}, ${timeAgo(s.createdAt)}. ${s.condition}." +
                                        (s.askingPrice?.let { " Hopes for ${formatMoney(it)}." } ?: "") +
                                        (s.offerAmount?.let { " Offer ${formatMoney(it)}." } ?: "") +
                                        (s.payoutMethod?.let { " Paid by ${if (it == "points") "points" else "EFT"}." } ?: ""),
                                    style = T.small, color = C.muted, modifier = Modifier.padding(top = 4.dp),
                                )
                                Text(s.description, style = T.small, color = C.ink, modifier = Modifier.padding(top = 6.dp))
                                if (!s.staffNote.isNullOrBlank()) Text("Note: ${s.staffNote}", style = T.small, color = C.muted, modifier = Modifier.padding(top = 4.dp))
                                val next = s.nextStatuses.orEmpty()
                                if (next.isNotEmpty()) Wrap(Modifier.padding(top = Space.s3)) {
                                    if ("Offer made" in next) Btn("Make an offer", { offering = s }, small = true)
                                    if ("Received" in next) Btn("Mark received", { step(s, "Received") }, small = true)
                                    if ("Paid" in next) Btn("Mark paid", { step(s, "Paid") }, small = true)
                                    if ("Declined" in next) Btn("Decline", { declining = s }, style = BtnStyle.Danger, small = true)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    offering?.let { s ->
        var amount by remember(s.id) { mutableStateOf(s.askingPrice?.toInt()?.toString() ?: "") }
        var note by remember(s.id) { mutableStateOf("") }
        var error by remember(s.id) { mutableStateOf<String?>(null) }
        Sheet("Make an offer", onDismiss = { offering = null }, footer = {
            Btn("Send offer", {
                val v = amount.toDoubleOrNull()
                if (v == null || v <= 0) { error = "Enter an offer in rand."; return@Btn }
                app.run({ safeApiCall { app.api.updateSell(s.id, SellUpdateRequest("Offer made", v, note.ifBlank { null })) } }, onError = { error = it }) {
                    offering = null
                    app.toast("Offer sent.", ToastKind.Success)
                    load.reload()
                }
            }, modifier = Modifier.fillMaxWidth())
        }) {
            Field("Offer in rand", amount, { amount = it.filter(Char::isDigit); error = null }, error = error, keyboardType = KeyboardType.Number, hint = "The customer can take it by EFT, or as Thrift Points worth 20 percent more.")
            Field("Note to the customer (optional)", note, { note = it }, placeholder = "Bring it to Hatfield any weekday", maxLength = 300)
        }
    }
    declining?.let { s ->
        ConfirmDialog("Decline this piece?", "The customer is told you cannot take it this time.", "Decline", onConfirm = { step(s, "Declined") }, onDismiss = { declining = null }, danger = true)
    }
}

/* ----------------------------- Support inbox ----------------------------- */

@Composable
fun StaffSupportScreen() {
    val app = LocalApp.current
    var filter by remember { mutableStateOf("") }
    val load = rememberLoad<List<SupportTicket>>(filter, app.user?.id) {
        when (val r = safeApiCall { app.api.tickets(if (filter.isEmpty()) emptyMap() else mapOf("status" to filter)) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.tickets)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Support inbox") {
        StaffOnly {
            PageHead("Support inbox", sub = "Messages from customers. Replying marks a conversation answered and notifies the customer.")
            Wrap { for (v in listOf("", "Open", "Answered", "Closed")) Chip(v.ifEmpty { "All" }, filter == v, { filter = v }) }
            Spacer(Modifier.height(Space.s4))
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> if (s.data.isEmpty()) EmptyState(Lucide.inbox, "Inbox clear", "New messages from customers appear here.") else TicketList(s.data, staff = true)
            }
        }
    }
}

/* ----------------------------- Listings ----------------------------- */

private val STAFF_SIZE_RANGES = mapOf(
    "Footwear" to listOf("UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10"),
    "Trousers" to listOf("28", "30", "32", "34", "36", "38", "40", "42", "44"),
    "Jeans" to listOf("28", "30", "32", "34", "36", "38", "40", "42", "44"),
    "Accessories" to listOf("One Size"),
)
private fun sizeRangeFor(category: String?) = STAFF_SIZE_RANGES[category] ?: listOf("XS", "S", "M", "L", "XL", "XXL")

@Composable
fun StaffListingsScreen() {
    val app = LocalApp.current
    var q by remember { mutableStateOf("") }
    val selected = remember { mutableStateListOf<Int>() }
    var editing by remember { mutableStateOf<Product?>(null) }
    var adding by remember { mutableStateOf(false) }
    var pct by remember { mutableStateOf(20) }
    var bulkBusy by remember { mutableStateOf(false) }
    val load = rememberLoad<List<Product>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getProducts(emptyMap()) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.products)
            is ApiOutcome.Failure -> r
        }
    }
    fun bulk(body: BulkPriceRequest, message: (Int, Int) -> String) {
        bulkBusy = true
        app.run({ safeApiCall { app.api.bulkPrice(body) } }, onDone = { bulkBusy = false }) { r ->
            app.toast(message(r.changed ?: 0, r.alerted ?: 0), ToastKind.Success)
            selected.clear()
            load.reload()
        }
    }
    Screen("Listings", actions = {
        if (app.isStaff) IconBtn(Lucide.plus, "Add a piece", { adding = true })
    }, bottom = if (selected.isNotEmpty()) {
        {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${selected.size} selected", style = T.bodyStrong, color = C.ink, modifier = Modifier.weight(1f))
                    LinkText("Clear", { selected.clear() }, color = C.muted)
                }
                Segmented(listOf(10, 15, 20, 25, 30, 40, 50).map { it to "$it%" }, pct, { pct = it }, Modifier.fillMaxWidth().padding(vertical = Space.s2))
                Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                    Btn("Mark down $pct%", {
                        bulk(BulkPriceRequest(selected.toList(), percentOff = pct)) { changed, alerted ->
                            "${plural(changed, "piece")} marked down." + if (alerted > 0) " ${plural(alerted, "customer")} told about the price drop." else ""
                        }
                    }, loading = bulkBusy, modifier = Modifier.weight(1f))
                    Btn("End sale", { bulk(BulkPriceRequest(selected.toList(), endSale = true)) { changed, _ -> "Sale ended on ${plural(changed, "piece")}." } }, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
                }
            }
        }
    } else null) {
        StaffOnly {
            PageHead("Listings", sub = load.data?.let { "${it.size} listings. Tick several to start or end a sale." })
            SearchBox(q, { q = it }, placeholder = "Filter by name, brand or reference")
            Spacer(Modifier.height(Space.s4))
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val needle = q.trim().lowercase()
                    val shown = s.data.filter { needle.isEmpty() || "${it.name} ${it.brand} ${it.category} ${it.ref}".lowercase().contains(needle) }
                    if (shown.isEmpty()) Text("No listings match that filter.", style = T.body, color = C.muted)
                    else ListCard {
                        shown.forEachIndexed { i, p ->
                            if (i > 0) Hairline()
                            val on = p.id in selected
                            Row(Modifier.fillMaxWidth().clickable { editing = p }.padding(Space.s3), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                                Box(
                                    Modifier.size(44.dp).clip(RoundedCornerShape(Radius.sm)).clickable(role = Role.Checkbox) { if (on) selected.remove(p.id) else selected.add(p.id) }
                                        .semantics { contentDescription = (if (on) "Deselect " else "Select ") + p.name },
                                    contentAlignment = Alignment.Center,
                                ) { CheckMark(on) }
                                RemoteImage(p.image, Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)))
                                Column(Modifier.weight(1f)) {
                                    Text(p.name, style = T.bodyStrong, color = C.ink, maxLines = 1)
                                    Text("${p.brand}, ${p.ref}, ${p.category}", style = T.tiny, color = C.muted, maxLines = 1)
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                                        PriceText(p.price, p.originalPrice, p.onSale, style = T.small.copy(fontWeight = FontWeight.SemiBold))
                                        ConditionMeter(p.condition, label = false)
                                    }
                                }
                                if (p.stock == 0) Pill("Sold out", Tone.Bad) else Text("${p.stock}", style = T.bodyStrong, color = C.ink)
                            }
                        }
                    }
                }
            }
        }
    }
    if (adding || editing != null) {
        ListingEditor(editing, onDismiss = { adding = false; editing = null }) {
            adding = false
            editing = null
            load.reload()
        }
    }
}

@Composable
private fun ListingEditor(p: Product?, onDismiss: () -> Unit, onSaved: () -> Unit) {
    val app = LocalApp.current
    var name by remember { mutableStateOf(p?.name ?: "") }
    var description by remember { mutableStateOf(p?.description ?: "") }
    var brandId by remember { mutableStateOf(p?.brandId ?: app.brands.firstOrNull()?.id ?: 0) }
    var categoryId by remember { mutableStateOf(p?.categoryId ?: app.categories.firstOrNull()?.id ?: 0) }
    var condition by remember { mutableStateOf(p?.condition ?: "Very Good") }
    var price by remember { mutableStateOf(p?.price?.toInt()?.toString() ?: "") }
    var original by remember { mutableStateOf(p?.originalPrice?.toInt()?.toString() ?: "") }
    val catName = app.categories.firstOrNull { it.id == categoryId }?.name
    val sizes = remember {
        mutableStateListOf<ProductSize>().apply {
            if (p != null) addAll(p.allSizes.orEmpty()) else {
                val r = sizeRangeFor(catName)
                add(ProductSize(r[minOf(2, r.lastIndex)], 1))
            }
        }
    }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var pick by remember { mutableStateOf<String?>(null) }
    var delisting by remember { mutableStateOf(false) }

    Sheet(if (p != null) "Edit ${p.name}" else "Add a piece", onDismiss = onDismiss, footer = {
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
            if (p != null) Btn("Delist", { delisting = true }, style = BtnStyle.Danger)
            Btn(if (p != null) "Save changes" else "Add piece", {
                val e = mutableMapOf<String, String>()
                if (name.isBlank()) e["name"] = "Give the piece a name."
                if (description.trim().length < 10) e["description"] = "Describe the piece, including any wear."
                val pr = price.toDoubleOrNull()
                if (pr == null || pr < 0) e["price"] = "Enter a price in rand."
                val orig = original.toDoubleOrNull()
                if (original.isNotBlank() && (orig == null || pr == null || orig <= pr)) e["original"] = "The price before the sale must be higher than the selling price."
                errors = e
                if (sizes.isEmpty()) { formError = "Add at least one size."; return@Btn }
                if (e.isNotEmpty()) return@Btn
                busy = true
                val body = ProductRequest(name.trim(), description.trim(), brandId, categoryId, condition, pr!!, orig, sizes.toList())
                app.run({ safeApiCall { if (p != null) app.api.updateProduct(p.id, body) else app.api.createProduct(body) } }, onDone = { busy = false }, onError = { formError = it }) { r ->
                    app.toast(
                        if (p != null) "Listing saved." else "Piece added." + ((r.savedSearchAlerts ?: 0).takeIf { it > 0 }?.let { " ${plural(it, "customer")} told it matches their saved search." } ?: ""),
                        ToastKind.Success,
                    )
                    onSaved()
                }
            }, loading = busy, modifier = Modifier.weight(1f))
        }
    }) {
        if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3))
        Field("Name", name, { name = it }, error = errors["name"])
        Field("Description", description, { description = it }, error = errors["description"], singleLine = false, placeholder = "Colour, fit, and any wear a buyer should know about")
        Text("Brand", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        OptionCard(true, { pick = "brand" }, app.brands.firstOrNull { it.id == brandId }?.name ?: "Choose", modifier = Modifier.padding(bottom = Space.s4))
        Text("Category", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        OptionCard(true, { pick = "category" }, catName ?: "Choose", modifier = Modifier.padding(bottom = Space.s4))
        Text("Condition", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        Segmented(CONDITIONS.keys.map { it to it }, condition, { condition = it }, Modifier.fillMaxWidth().padding(bottom = Space.s4))
        Field("Selling price (R)", price, { price = it.filter(Char::isDigit) }, error = errors["price"], keyboardType = KeyboardType.Number)
        Field("Price before the sale (R, optional)", original, { original = it.filter(Char::isDigit) }, error = errors["original"], keyboardType = KeyboardType.Number, hint = "Fill in to show the piece as on sale. Lowering the price tells anyone who saved it.")
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = Space.s2)) {
            Text("Stock per size", style = T.smallStrong, color = C.ink, modifier = Modifier.weight(1f))
            LinkText("Add a size", {
                val free = sizeRangeFor(catName).firstOrNull { r -> sizes.none { it.size == r } }
                if (free == null) app.toast("Every size in this category is already listed.", ToastKind.Error) else sizes.add(ProductSize(free, 1))
            })
        }
        sizes.forEachIndexed { i, row ->
            Row(Modifier.padding(bottom = Space.s2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                Text(row.size, style = T.bodyStrong, color = C.ink, modifier = Modifier.width(64.dp))
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    IconBtn(Lucide.minus, "One fewer in size ${row.size}", { if (row.stock > 0) sizes[i] = row.copy(stock = row.stock - 1) })
                    Text("${row.stock}", style = T.bodyStrong, color = C.ink, modifier = Modifier.width(32.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    IconBtn(Lucide.plus, "One more in size ${row.size}", { sizes[i] = row.copy(stock = row.stock + 1) })
                }
                IconBtn(Lucide.trash2, "Remove size ${row.size}", { sizes.removeAt(i) })
            }
        }
        Text("A size at 0 stays listed as sold out, so customers can ask to be told when it is back.", style = T.small, color = C.muted)
    }
    when (pick) {
        "brand" -> Sheet("Brand", onDismiss = { pick = null }) {
            for (b in app.brands) OptionCard(brandId == b.id, { brandId = b.id; pick = null }, b.name, modifier = Modifier.padding(bottom = Space.s2))
        }
        "category" -> Sheet("Category", onDismiss = { pick = null }) {
            for (c in app.categories) OptionCard(categoryId == c.id, {
                categoryId = c.id
                val range = sizeRangeFor(c.name)
                val keep = sizes.filter { it.size in range }
                sizes.clear()
                sizes.addAll(keep.ifEmpty { listOf(ProductSize(range[minOf(2, range.lastIndex)], 1)) })
                pick = null
            }, c.name, modifier = Modifier.padding(bottom = Space.s2))
        }
    }
    if (delisting && p != null) {
        ConfirmDialog("Delist ${p.name}?", "A piece that has been ordered before is kept for order history and set to sold out. Otherwise it is removed.", "Delist", danger = true, onConfirm = {
            app.run({ safeApiCall { app.api.deleteProduct(p.id) } }) { r ->
                app.toast(if (r.note != null) "Set to sold out, kept for order history." else "Listing removed.", ToastKind.Success)
                onSaved()
            }
        }, onDismiss = { delisting = false })
    }
}

/* ----------------------------- Inventory ----------------------------- */

@Composable
fun StaffInventoryScreen() {
    val app = LocalApp.current
    val load = rememberLoad<Pair<InventoryReport, List<Product>>>(app.user?.id) {
        val inv = safeApiCall { app.api.inventory() }
        if (inv !is ApiOutcome.Success) return@rememberLoad inv as ApiOutcome.Failure
        when (val p = safeApiCall { app.api.getProducts(emptyMap()) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(inv.data to p.data.products)
            is ApiOutcome.Failure -> p
        }
    }
    Screen("Inventory") {
        StaffOnly {
            PageHead("Inventory")
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val (inv, products) = s.data
                    Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                        Stat("Pieces in stock", "${products.sumOf { it.stock }}", "" to null, Modifier.weight(1f))
                        Stat("Stock value", formatMoney(products.sumOf { it.price * it.stock }), "at selling price" to null, Modifier.weight(1f))
                    }
                    for ((label, list, empty) in listOf(
                        Triple("Sold out", inv.outOfStock, "Nothing is sold out."),
                        Triple("Low stock (${inv.threshold} or fewer)", inv.lowStock, "Stock levels look healthy."),
                    )) {
                        GroupLabel(label)
                        if (list.isEmpty()) Text(empty, style = T.body, color = C.muted)
                        else ListCard {
                            list.forEachIndexed { i, l ->
                                ListRow(l.name, sub = "${l.brand}, ${l.category}", meta = "${l.stock}", divider = i > 0, onClick = { app.go(Routes.product(l.id)) })
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Promo codes ----------------------------- */

@Composable
fun StaffPromosScreen() {
    val app = LocalApp.current
    var editing by remember { mutableStateOf<Promo?>(null) }
    var adding by remember { mutableStateOf(false) }
    val load = rememberLoad<List<Promo>>(app.user?.id) {
        when (val r = safeApiCall { app.api.promos() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.promos)
            is ApiOutcome.Failure -> r
        }
    }
    val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).apply { timeZone = java.util.TimeZone.getTimeZone("Africa/Johannesburg") }.format(java.util.Date())
    Screen("Promo codes", actions = {
        if (app.isAdmin) IconBtn(Lucide.plus, "New code", { adding = true })
    }) {
        StaffOnly {
            PageHead("Promo codes", sub = if (app.isAdmin) "Codes customers type at checkout. Usage counts orders that were not cancelled." else "Only the administrator can create or change codes.")
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> ListCard {
                    s.data.forEachIndexed { i, p ->
                        if (i > 0) Hairline()
                        val (state, tone) = when {
                            !p.active -> "Off" to Tone.Bad
                            p.expiresAt != null && p.expiresAt < today -> "Ended" to Tone.Bad
                            p.usageLimit != null && p.usedCount >= p.usageLimit -> "Used up" to Tone.Warn
                            else -> "Live" to Tone.Good
                        }
                        Column(Modifier.fillMaxWidth().padding(Space.s4)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(p.code, style = T.bodyStrong, color = C.ink, modifier = Modifier.weight(1f))
                                Pill(state, tone)
                            }
                            Text(p.description, style = T.small, color = C.muted)
                            Text(
                                (if (p.discountType == "percent") "${p.discountValue.toInt()}% off" else "${formatMoney(p.discountValue)} off") +
                                    (if (p.minSpend > 0) ", from ${formatMoney(p.minSpend)}" else "") +
                                    ". Ends ${p.expiresAt?.let { dateLabel(it) } ?: "never"}. Used ${p.usedCount}${p.usageLimit?.let { " of $it" } ?: ""}, ${formatMoney(p.givenAway)} given away.",
                                style = T.small, color = C.ink2, modifier = Modifier.padding(top = 4.dp),
                            )
                            if (app.isAdmin) Row(Modifier.padding(top = Space.s2), horizontalArrangement = Arrangement.spacedBy(Space.s4)) {
                                LinkText("Edit", { editing = p })
                                LinkText(if (p.active) "Switch off" else "Switch on", {
                                    app.run({ safeApiCall { app.api.setPromoActive(p.id, PromoActiveRequest(!p.active)) } }) { r ->
                                        load.set(r.promos)
                                        app.toast(if (p.active) "Code switched off." else "Code switched on.", ToastKind.Success)
                                    }
                                })
                            }
                        }
                    }
                }
            }
        }
    }
    if (adding || editing != null) {
        PromoEditor(editing, onDismiss = { adding = false; editing = null }) { list ->
            load.set(list)
            adding = false
            editing = null
        }
    }
}

@Composable
private fun PromoEditor(p: Promo?, onDismiss: () -> Unit, onSaved: (List<Promo>) -> Unit) {
    val app = LocalApp.current
    var code by remember { mutableStateOf(p?.code ?: "") }
    var type by remember { mutableStateOf(p?.discountType ?: "percent") }
    var value by remember { mutableStateOf(p?.discountValue?.toInt()?.toString() ?: "") }
    var minSpend by remember { mutableStateOf(p?.minSpend?.takeIf { it > 0 }?.toInt()?.toString() ?: "") }
    var ends by remember { mutableStateOf(p?.expiresAt ?: "") }
    var limit by remember { mutableStateOf(p?.usageLimit?.toString() ?: "") }
    var description by remember { mutableStateOf(p?.description ?: "") }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Sheet(if (p != null) "Edit ${p.code}" else "New promo code", onDismiss = onDismiss, footer = {
        Btn(if (p != null) "Save code" else "Create code", {
            val e = mutableMapOf<String, String>()
            if (p == null && !Regex("^[A-Za-z0-9]{3,20}$").matches(code)) e["code"] = "Use 3 to 20 letters and numbers, with no spaces."
            val v = value.toDoubleOrNull()
            if (v == null || v <= 0) e["value"] = "Enter an amount above zero."
            else if (type == "percent" && v > 90) e["value"] = "A percentage cannot be more than 90."
            if (ends.isNotBlank() && !Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(ends)) e["ends"] = "Use a date like 2026-12-31."
            errors = e
            if (e.isNotEmpty()) return@Btn
            busy = true
            val body = PromoRequest(
                code = code.uppercase(), discountType = type, discountValue = v, minSpend = minSpend.toDoubleOrNull() ?: 0.0,
                expiresAt = ends.ifBlank { null }, usageLimit = limit.toIntOrNull(), description = description.ifBlank { null }, active = p?.active ?: true,
            )
            app.run({ safeApiCall { if (p != null) app.api.updatePromo(p.id, body) else app.api.createPromo(body) } }, onDone = { busy = false }, onError = { formError = it }) { r ->
                app.toast(if (p != null) "Code saved." else "Code created.", ToastKind.Success)
                onSaved(r.promos)
            }
        }, loading = busy, modifier = Modifier.fillMaxWidth())
    }) {
        if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3))
        Field("Code", code, { code = it.uppercase() }, error = errors["code"], enabled = p == null, maxLength = 20, hint = "Letters and numbers only. Customers type it at checkout.")
        Text("Discount type", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        OptionCard(type == "percent", { type = "percent" }, "Percentage off the goods", modifier = Modifier.padding(bottom = Space.s2))
        OptionCard(type == "fixed", { type = "fixed" }, "Fixed rand amount off", modifier = Modifier.padding(bottom = Space.s4))
        Field("Amount", value, { value = it.filter(Char::isDigit) }, error = errors["value"], keyboardType = KeyboardType.Number)
        Field("Minimum spend (R)", minSpend, { minSpend = it.filter(Char::isDigit) }, keyboardType = KeyboardType.Number, placeholder = "None")
        Field("Last day (optional)", ends, { ends = it }, error = errors["ends"], placeholder = "2026-12-31")
        Field("Uses allowed (optional)", limit, { limit = it.filter(Char::isDigit) }, keyboardType = KeyboardType.Number, placeholder = "Unlimited")
        Field("Description (optional)", description, { description = it }, maxLength = 80, placeholder = "Written for you if left empty")
    }
}

/* ----------------------------- Customers (administrator only) ----------------------------- */

@Composable
fun StaffCustomersScreen() {
    val app = LocalApp.current
    var q by remember { mutableStateOf("") }
    var suspending by remember { mutableStateOf<StaffUser?>(null) }
    val load = rememberLoad<List<StaffUser>>(app.user?.id) {
        if (!app.isAdmin) ApiOutcome.Failure("Only the administrator can see and suspend customer accounts.") else when (val r = safeApiCall { app.api.users() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.users)
            is ApiOutcome.Failure -> r
        }
    }
    fun set(u: StaffUser, status: String) {
        app.run({ safeApiCall { app.api.setUserStatus(u.id, StatusRequest(status)) } }) {
            app.toast(if (status == "suspended") "Account suspended." else "Account reactivated.", ToastKind.Success)
            load.reload()
        }
    }
    Screen("Customers") {
        if (!app.isAdmin) {
            EmptyState(Lucide.lock, "Administrator only", "Only the administrator can see and suspend customer accounts.")
            return@Screen
        }
        PageHead("Customers", sub = load.data?.let { "${it.size} accounts. A suspended customer cannot sign in." })
        SearchBox(q, { q = it }, placeholder = "Filter by name or email")
        Spacer(Modifier.height(Space.s4))
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> ListCard {
                val needle = q.trim().lowercase()
                s.data.filter { needle.isEmpty() || "${it.firstName} ${it.lastName} ${it.email}".lowercase().contains(needle) }.forEachIndexed { i, u ->
                    ListRow(
                        "${u.firstName} ${u.lastName}", sub = "${u.email}${u.city?.let { ", $it" } ?: ""}. Joined ${dateLabel(u.createdAt)}.",
                        divider = i > 0, chevron = false,
                        trailing = {
                            Column(horizontalAlignment = Alignment.End) {
                                Pill(if (u.status == "active") "Active" else "Suspended", if (u.status == "active") Tone.Good else Tone.Bad)
                                Spacer(Modifier.height(6.dp))
                                if (u.status == "active") Btn("Suspend", { suspending = u }, style = BtnStyle.Danger, small = true)
                                else Btn("Reactivate", { set(u, "active") }, style = BtnStyle.Secondary, small = true)
                            }
                        },
                    )
                }
            }
        }
    }
    suspending?.let { u ->
        ConfirmDialog("Suspend ${u.firstName} ${u.lastName}?", "They will not be able to sign in until you reactivate the account.", "Suspend account", danger = true, onConfirm = { set(u, "suspended") }, onDismiss = { suspending = null })
    }
}
