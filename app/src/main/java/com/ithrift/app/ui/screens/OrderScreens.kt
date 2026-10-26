package com.ithrift.app.ui.screens

import android.content.Context
import android.util.Log
import android.print.PrintAttributes
import android.print.PrintManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.OrderDetail
import com.ithrift.app.data.OrderListItem
import com.ithrift.app.data.ReturnItem
import com.ithrift.app.data.ReturnRequestBody
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.Callout
import com.ithrift.app.ui.components.ConfirmDialog
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.GroupLabel
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.ListCard
import com.ithrift.app.ui.components.OptionCard
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.Pill
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.Segmented
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.StatusPill
import com.ithrift.app.ui.components.SummaryRow
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.components.statusTone
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.staff.ProcessOrderPanel
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.dateLabel
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.formatMoneyCents
import com.ithrift.app.util.plural
import com.ithrift.app.util.timeAgo
import com.ithrift.app.util.timeLabel

/* ----------------------------- Orders ----------------------------- */

@Composable
fun OrderRow(o: OrderListItem, divider: Boolean, staff: Boolean = false, onClick: () -> Unit) {
    if (divider) Hairline()
    Row(
        Modifier.fillMaxWidth().clickable(role = Role.Button, onClick = onClick).padding(Space.s4),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        RemoteImage(o.image ?: "", Modifier.size(52.dp).clip(RoundedCornerShape(10.dp)))
        Column(Modifier.weight(1f)) {
            Text(o.ref + if (staff) ", ${o.customer}" else "", style = T.bodyStrong, color = C.ink)
            val bits = buildList {
                add(dateLabel(o.createdAt))
                o.itemCount?.let { add(plural(it, "piece")) }
                o.collectionDate?.let { add("collect ${dateLabel(it, year = false, weekday = true)}") }
                if (o.isGift == true) add("gift")
            }
            Text(bits.joinToString(", "), style = T.small, color = C.muted)
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
            StatusPill(o.status)
            Text(formatMoney(o.total), style = T.small, color = C.ink2)
        }
    }
}

@Composable
fun OrdersScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<OrderListItem>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getOrders() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.orders)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Orders", back = false, actions = {
        if (app.isCustomer) Btn("Returns", { app.go(Routes.RETURNS) }, style = BtnStyle.Secondary, small = true, modifier = Modifier.padding(end = 4.dp))
    }) {
        if (app.isStaff) {
            EmptyState(Lucide.packageIcon, "Orders are in the console", "Staff see every order in the console, filtered by status.", actionLabel = "Open the console orders", onAction = { app.go(Routes.staffOrders()) })
            return@Screen
        }
        CustomerOnly(Routes.ORDERS, "your orders") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val orders = s.data
                    if (orders.isEmpty()) {
                        EmptyState(Lucide.packageIcon, "No orders yet", "When you buy something, you can follow it here from packing to your door.", actionLabel = "Start shopping", onAction = { app.go(Routes.shop()) })
                    } else {
                        PageHead("Orders")
                        val active = orders.filter { it.status == "Processing" || it.status == "Shipped" }
                        val past = orders.filter { it !in active }
                        if (active.isNotEmpty()) {
                            GroupLabel("On the way", Modifier.padding(top = 0.dp))
                            ListCard { active.forEachIndexed { i, o -> OrderRow(o, i > 0) { app.go(Routes.order(o.id)) } } }
                        }
                        if (past.isNotEmpty()) {
                            GroupLabel("Earlier")
                            ListCard { past.forEachIndexed { i, o -> OrderRow(o, i > 0) { app.go(Routes.order(o.id)) } } }
                        }
                    }
                }
            }
        }
    }
}

private const val ORDERS_TAG = "Orders"
private val STATUS_FLOW = listOf("Processing", "Shipped", "Delivered")
private val STATUS_WORDS = mapOf("Processing" to "Order placed", "Shipped" to "With the courier", "Delivered" to "Delivered", "Cancelled" to "Cancelled")

/** The three-step progress bar: placed, shipped (or ready), delivered (or collected). */
@Composable
fun Tracker(labels: List<String>, reached: Int, modifier: Modifier = Modifier) {
    Row(modifier.fillMaxWidth().semantics(mergeDescendants = true) { contentDescription = "Step ${reached + 1} of ${labels.size}: ${labels.getOrNull(reached) ?: ""}" }, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
        labels.forEachIndexed { i, label ->
            Column(Modifier.weight(1f)) {
                Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(if (i <= reached) C.pine else C.surface3))
                Text(label, style = T.small.copy(fontWeight = if (i <= reached) FontWeight.SemiBold else FontWeight.Normal), color = if (i <= reached) C.ink else C.muted, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}

/** The vertical timeline of what has happened, ending with what is expected next. */
@Composable
fun TimelineItem(title: String, sub: String, done: Boolean = true, cancelled: Boolean = false, last: Boolean = false) {
    Row(Modifier.fillMaxWidth()) {
        Column(Modifier.width(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                Modifier
                    .padding(top = 5.dp)
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            cancelled -> C.bad
                            done -> C.pine
                            else -> C.surface3
                        },
                    ),
            )
            if (!last) Box(Modifier.width(2.dp).height(40.dp).background(C.hairlineStrong))
        }
        Column(Modifier.weight(1f).padding(start = Space.s2, bottom = Space.s3)) {
            Text(title, style = T.bodyStrong, color = if (done || cancelled) C.ink else C.muted)
            Text(sub, style = T.small, color = C.muted)
        }
    }
}

@Composable
fun OrderDetailScreen(id: Int) {
    val app = LocalApp.current
    val load = rememberLoad<OrderDetail>(id) {
        if (app.options == null) app.loadLookups(force = true)
        when (val r = safeApiCall { app.api.getOrder(id) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.order)
            is ApiOutcome.Failure -> r
        }
    }
    var returning by remember { mutableStateOf<com.ithrift.app.data.OrderLineItem?>(null) }
    var confirmCancel by remember { mutableStateOf(false) }
    val o = load.data
    Screen(o?.ref ?: "Order") {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> {
                val order = s.data
                val staff = app.isStaff
                val collect = order.deliveryMethod == "collection"
                val step = STATUS_FLOW.indexOf(order.status)

                Text(order.ref, style = T.h1, color = C.ink)
                Text(
                    "Placed ${dateLabel(order.createdAt)} at ${timeLabel(order.createdAt)}" + if (staff) " by ${order.customer.name}, ${order.customer.email}" else "",
                    style = T.body, color = C.muted, modifier = Modifier.padding(top = 4.dp),
                )
                Row(Modifier.padding(top = Space.s3, bottom = Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalAlignment = Alignment.CenterVertically) {
                    StatusPill(order.status)
                    Btn("Receipt", { app.go(Routes.receipt(order.id)) }, style = BtnStyle.Secondary, small = true, icon = Lucide.printer)
                }

                if (staff) {
                    ProcessOrderPanel(order) { load.reload() }
                    Spacer(Modifier.height(Space.s4))
                }

                Panel {
                    Text(
                        when {
                            order.status == "Cancelled" -> "This order was cancelled"
                            collect -> "Collection"
                            else -> "Tracking"
                        },
                        style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3),
                    )
                    if (order.status != "Cancelled") {
                        Tracker(
                            STATUS_FLOW.map { if (collect && it == "Shipped") "Ready" else if (collect && it == "Delivered") "Collected" else it },
                            step,
                            Modifier.padding(bottom = Space.s4),
                        )
                    }
                    val history = order.history.orEmpty()
                    val next = order.nextStep
                    history.forEachIndexed { i, h ->
                        TimelineItem(
                            STATUS_WORDS[h.status] ?: h.status,
                            "${dateLabel(h.at, weekday = true)}, ${timeLabel(h.at)}" + (h.note?.let { ". $it" } ?: ""),
                            cancelled = h.status == "Cancelled",
                            last = i == history.lastIndex && next == null,
                        )
                    }
                    if (next != null) {
                        TimelineItem(
                            when (next.status) {
                                "Ready to collect" -> "Ready to collect"
                                "Shipped" -> "Handed to the courier"
                                else -> "Delivery"
                            },
                            "Expected " + (if (next.from != null && next.from != next.date) "${dateLabel(next.from, year = false, weekday = true)} to " else "") +
                                dateLabel(next.date, year = false, weekday = true) + (next.slot?.let { ", $it" } ?: ""),
                            done = false,
                            last = true,
                        )
                    }
                    if (order.courierRef != null) Text("Courier reference ${order.courierRef}", style = T.small, color = C.ink)
                }
                Spacer(Modifier.height(Space.s4))

                Panel {
                    Text(plural(order.items.size, "piece"), style = T.h3, color = C.ink)
                    order.items.forEachIndexed { i, item ->
                        if (i > 0) Hairline()
                        LineItem(
                            item.image, item.name,
                            listOfNotNull(item.brand, item.size?.let { "size $it" }, if (item.quantity > 1) "${item.quantity} pieces" else null).joinToString(", "),
                            formatMoney(item.lineTotal),
                            onOpen = { app.go(Routes.product(item.productId)) },
                        ) {
                            if (item.returnStatus != null) {
                                Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Pill("Return ${item.returnStatus.lowercase()}", statusTone(item.returnStatus))
                                    Text(item.returnReason ?: "", style = T.small, color = C.muted)
                                }
                            }
                            if (!staff && item.canReturn) {
                                Btn("Return this piece", { returning = item }, style = BtnStyle.Secondary, small = true, icon = Lucide.rotateCcw, modifier = Modifier.padding(top = Space.s2))
                            }
                        }
                    }
                    OrderTotals(order)
                    order.vatIncluded?.let { Text("Includes ${formatMoneyCents(it)} VAT.", style = T.tiny, color = C.muted) }
                }
                Spacer(Modifier.height(Space.s4))

                Panel {
                    Text(if (collect) "Collect from" else "Delivery", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
                    Text(order.deliveryLabel ?: "", style = T.body, color = C.ink)
                    Text((order.deliveryAddress ?: "").removePrefix("Collect from: "), style = T.small, color = C.muted)
                    if (order.collectionDate != null) {
                        Text("${dateLabel(order.collectionDate, year = false, weekday = true)}, ${order.collectionSlot}", style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(top = Space.s2))
                    }
                    if (!order.deliveryInstructions.isNullOrBlank()) Text("Instructions: ${order.deliveryInstructions}", style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s2))
                    if (order.isGift == true) {
                        Callout("Gift order" + (order.giftMessage?.let { ": “$it”" } ?: ""), icon = Lucide.gift, modifier = Modifier.padding(top = Space.s3))
                    }
                    Hairline(Modifier.padding(vertical = Space.s3))
                    SummaryRow("Payment", paymentLabel(order.payment))
                    if ((order.pointsEarned ?: 0) > 0) SummaryRow("Points earned", "${order.pointsEarned}")
                }

                if (!staff) {
                    Spacer(Modifier.height(Space.s4))
                    Panel {
                        if (order.canCancel) {
                            Btn("Cancel this order", { confirmCancel = true }, style = BtnStyle.Danger, modifier = Modifier.fillMaxWidth())
                            Text("You can cancel until it ships. Paid orders are refunded and any points come back.", style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s2, bottom = Space.s3))
                        }
                        if (order.returnWindowOpen) Text("You can return pieces for ${plural(order.returnDaysLeft, "more day")}.", style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3))
                        Btn("Ask about this order", { app.go(Routes.contact(order.id)) }, style = BtnStyle.Quiet, icon = Lucide.messageSquare, modifier = Modifier.fillMaxWidth())
                    }
                }

                if (confirmCancel) {
                    ConfirmDialog(
                        title = "Cancel ${order.ref}?",
                        body = "The pieces go back on sale straight away, so you may not get them back. Paid orders are refunded.",
                        confirmLabel = "Cancel order",
                        danger = true,
                        onConfirm = {
                            app.run({ safeApiCall { app.api.cancelOrder(order.id) } }) { r ->
                                Log.i(ORDERS_TAG, "Order ${order.ref} cancelled; the server put the stock back")
                                load.set(r.order)
                                app.toast("Order cancelled.", ToastKind.Success)
                            }
                        },
                        onDismiss = { confirmCancel = false },
                    )
                }
                returning?.let { item -> ReturnSheet(order.id, item.orderItemId, item.name, onDone = { returning = null; load.reload() }, onDismiss = { returning = null }) }
            }
        }
    }
}

@Composable
private fun ReturnSheet(orderId: Int, orderItemId: Int, name: String, onDone: () -> Unit, onDismiss: () -> Unit) {
    val app = LocalApp.current
    val reasons = app.options?.returnReasons ?: listOf("Doesn't fit", "Not as described", "Changed my mind", "Arrived damaged")
    var reason by remember { mutableStateOf<String?>(null) }
    var comment by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Sheet("Return a piece", onDismiss = onDismiss, footer = {
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            Btn("Keep it", onDismiss, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
            Btn("Request return", {
                if (reason == null) { error = "Choose a reason."; return@Btn }
                busy = true
                app.run({ safeApiCall { app.api.requestReturn(orderId, ReturnRequestBody(orderItemId, reason!!, comment.ifBlank { null })) } }, onDone = { busy = false }, onError = { error = it }) {
                    Log.i(ORDERS_TAG, "Return requested for order #$orderId, line #$orderItemId, reason: $reason")
                    app.toast("Return requested. We will let you know once it is approved.", ToastKind.Success)
                    onDone()
                }
            }, loading = busy, modifier = Modifier.weight(1f))
        }
    }) {
        Text(name, style = T.body, color = C.muted, modifier = Modifier.padding(bottom = Space.s3))
        if (error != null) Callout(error!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3))
        Text("Why are you returning it?", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
        for (r in reasons) OptionCard(reason == r, { reason = r; error = null }, r, modifier = Modifier.padding(bottom = Space.s2))
        Spacer(Modifier.height(Space.s3))
        Field("Anything else? (optional)", comment, { comment = it }, singleLine = false, maxLength = 300)
    }
}

/* ----------------------------- Receipt ----------------------------- */

private fun esc(s: String?) = (s ?: "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")

/** The receipt as a printable page, the same layout as the website's print view. */
private fun receiptHtml(o: OrderDetail, gift: Boolean): String {
    val store = o.store
    val rows = o.items.joinToString("") { i ->
        "<tr><td>${esc(i.brand)} ${esc(i.name)}<br><small>${esc(i.productRef)}, pre-loved, ${esc(i.category?.lowercase())}</small></td><td>${esc(i.size)}</td><td>${i.quantity}</td>" +
            (if (gift) "" else "<td class=r>${formatMoneyCents(i.lineTotal)}</td>") + "</tr>"
    }
    val totals = if (gift) "<p class=m>Returns within 30 days of delivery with this slip. The refund goes to the person who paid.</p>" else """
        <table class=t>
        <tr><td>Subtotal</td><td class=r>${formatMoneyCents(o.subtotal ?: o.total)}</td></tr>
        ${if ((o.discount ?: 0.0) > 0) "<tr><td>Promo ${esc(o.promoCode)}</td><td class=r>-${formatMoneyCents(o.discount!!)}</td></tr>" else ""}
        ${if ((o.pointsDiscount ?: 0.0) > 0) "<tr><td>Thrift Points</td><td class=r>-${formatMoneyCents(o.pointsDiscount!!)}</td></tr>" else ""}
        <tr><td>${esc(o.deliveryLabel)}</td><td class=r>${formatMoneyCents(o.deliveryFee ?: 0.0)}</td></tr>
        <tr class=b><td>Total</td><td class=r>${formatMoneyCents(o.total)}</td></tr>
        <tr class=m><td>VAT included at 15%</td><td class=r>${formatMoneyCents(o.vatIncluded ?: 0.0)}</td></tr>
        <tr class=m><td>Paid by</td><td class=r>${esc(paymentLabel(o.payment))}</td></tr>
        </table>"""
    val who = if (gift) esc((o.deliveryAddress ?: "").substringBefore(',')) else "${esc(o.customer.name)}<br>${esc(o.customer.email)}"
    return """<!doctype html><html><head><meta charset=utf-8><style>
        body{font-family:sans-serif;color:#15201b;margin:32px;font-size:14px}
        h1{font-size:24px;margin:0} .head{display:flex;justify-content:space-between}
        .mark{display:inline-block;width:28px;height:28px;border-radius:8px;background:#1e5a43;color:#fff;text-align:center;line-height:28px;font-weight:700;margin-right:8px}
        table{width:100%;border-collapse:collapse;margin-top:24px} th,td{text-align:left;padding:8px 4px;border-bottom:1px solid #dfe3df}
        .r{text-align:right} .t{max-width:320px;margin-left:auto} .t td{border:0;padding:4px} .b td{font-weight:700;font-size:16px} .m,.m td{color:#5c6661;font-size:12px} small{color:#5c6661}
        </style></head><body>
        <div class=head><div><div style="font-weight:700;font-size:18px;margin-bottom:12px"><span class=mark>i</span>iTHRIFT Clothes</div>
        <div class=m>${esc(store?.address)}<br>${esc(store?.email)}, ${esc(store?.phone)}</div></div>
        <div style="text-align:right"><h1>${if (gift) "Gift slip" else "Tax invoice"}</h1><div class=m>${esc(o.ref)}<br>${dateLabel(o.createdAt)}</div></div></div>
        <p><b>${if (gift) "For" else "Customer"}</b><br>$who</p>
        ${if (gift && o.giftMessage != null) "<p style=\"font-size:18px\">&ldquo;${esc(o.giftMessage)}&rdquo;</p>" else ""}
        <table><tr><th>Item</th><th>Size</th><th>Qty</th>${if (gift) "" else "<th class=r>Amount</th>"}</tr>$rows</table>
        $totals
        </body></html>"""
}

/** Sends the receipt to Android's print service, which also offers Save as PDF. */
private fun printReceipt(context: Context, o: OrderDetail, gift: Boolean) {
    val web = WebView(context)
    web.webViewClient = object : WebViewClient() {
        override fun onPageFinished(view: WebView, url: String?) {
            val pm = context.getSystemService(Context.PRINT_SERVICE) as PrintManager
            val name = "iTHRIFT ${if (gift) "gift slip" else "tax invoice"} ${o.ref}"
            pm.print(name, view.createPrintDocumentAdapter(name), PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
        }
    }
    web.loadDataWithBaseURL(null, receiptHtml(o, gift), "text/html", "utf-8", null)
}

@Composable
fun ReceiptScreen(id: Int, gift: Boolean) {
    val app = LocalApp.current
    val context = LocalContext.current
    var giftSlip by remember { mutableStateOf(gift) }
    val load = rememberLoad<OrderDetail>(id) {
        when (val r = safeApiCall { app.api.getOrder(id) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.order)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Receipt") {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> {
                val o = s.data
                Segmented(listOf(false to "Tax invoice", true to "Gift slip"), giftSlip, { giftSlip = it }, Modifier.fillMaxWidth())
                Spacer(Modifier.height(Space.s3))
                Btn("Print or save as PDF", { printReceipt(context, o, giftSlip) }, icon = Lucide.printer, modifier = Modifier.fillMaxWidth())
                Spacer(Modifier.height(Space.s4))
                Panel(padding = androidx.compose.foundation.layout.PaddingValues(Space.s5)) {
                    Row {
                        Column(Modifier.weight(1f)) {
                            com.ithrift.app.ui.Logo()
                            Text(o.store?.address ?: "", style = T.tiny, color = C.muted, modifier = Modifier.padding(top = Space.s3))
                            Text("${o.store?.email ?: ""}, ${o.store?.phone ?: ""}", style = T.tiny, color = C.muted)
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(if (giftSlip) "Gift slip" else "Tax invoice", style = T.h2, color = C.ink)
                            Text(o.ref, style = T.small, color = C.muted)
                            Text(dateLabel(o.createdAt), style = T.small, color = C.muted)
                        }
                    }
                    Spacer(Modifier.height(Space.s5))
                    Text(if (giftSlip) "For" else "Customer", style = T.smallStrong, color = C.ink)
                    if (giftSlip) Text((o.deliveryAddress ?: "").substringBefore(','), style = T.small, color = C.ink2)
                    else {
                        Text(o.customer.name, style = T.small, color = C.ink2)
                        Text(o.customer.email, style = T.small, color = C.ink2)
                    }
                    if (giftSlip && o.giftMessage != null) Text("“${o.giftMessage}”", style = T.h3.copy(fontWeight = FontWeight.Normal), color = C.ink, modifier = Modifier.padding(top = Space.s4))
                    Spacer(Modifier.height(Space.s4))
                    Row(Modifier.fillMaxWidth().padding(bottom = 6.dp)) {
                        Text("Item", style = T.smallStrong, color = C.ink, modifier = Modifier.weight(1f))
                        Text("Size", style = T.smallStrong, color = C.ink, modifier = Modifier.width(52.dp))
                        Text("Qty", style = T.smallStrong, color = C.ink, modifier = Modifier.width(32.dp))
                        if (!giftSlip) Text("Amount", style = T.smallStrong, color = C.ink, modifier = Modifier.width(84.dp), textAlign = TextAlign.End)
                    }
                    for (i in o.items) {
                        Hairline()
                        Row(Modifier.fillMaxWidth().padding(vertical = Space.s2)) {
                            Column(Modifier.weight(1f)) {
                                Text("${i.brand ?: ""} ${i.name}", style = T.small, color = C.ink)
                                Text("${i.productRef}, pre-loved, ${i.category?.lowercase() ?: ""}", style = T.tiny, color = C.muted)
                            }
                            Text(i.size ?: "", style = T.small, color = C.ink, modifier = Modifier.width(52.dp))
                            Text("${i.quantity}", style = T.small, color = C.ink, modifier = Modifier.width(32.dp))
                            if (!giftSlip) Text(formatMoneyCents(i.lineTotal), style = T.small, color = C.ink, modifier = Modifier.width(84.dp), textAlign = TextAlign.End)
                        }
                    }
                    Hairline()
                    Spacer(Modifier.height(Space.s3))
                    if (giftSlip) {
                        Text("Returns within 30 days of delivery with this slip. The refund goes to the person who paid.", style = T.small, color = C.muted)
                    } else {
                        SummaryRow("Subtotal", formatMoneyCents(o.subtotal ?: o.total))
                        if ((o.discount ?: 0.0) > 0) SummaryRow("Promo ${o.promoCode ?: ""}", "-${formatMoneyCents(o.discount!!)}")
                        if ((o.pointsDiscount ?: 0.0) > 0) SummaryRow("Thrift Points", "-${formatMoneyCents(o.pointsDiscount!!)}")
                        SummaryRow(o.deliveryLabel ?: "Delivery", formatMoneyCents(o.deliveryFee ?: 0.0))
                        SummaryRow("Total", formatMoneyCents(o.total), strong = true)
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                            Text("VAT included at 15%", style = T.small, color = C.muted, modifier = Modifier.weight(1f))
                            Text(formatMoneyCents(o.vatIncluded ?: 0.0), style = T.small, color = C.muted)
                        }
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                            Text("Paid by", style = T.small, color = C.muted, modifier = Modifier.weight(1f))
                            Text(paymentLabel(o.payment), style = T.small, color = C.muted)
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Returns ----------------------------- */

@Composable
fun ReturnsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<ReturnItem>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getReturns() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.returns)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Returns") {
        CustomerOnly(Routes.RETURNS, "your returns") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Returns", sub = "Return any piece within 30 days of delivery. Open the order and choose Return this piece.")
                    if (s.data.isEmpty()) {
                        EmptyState(Lucide.rotateCcw, "No returns", "If something is not right, open a delivered order and choose Return this piece.", actionLabel = "Open my orders", onAction = { app.go(Routes.ORDERS) })
                    } else {
                        Panel {
                            s.data.forEachIndexed { i, r ->
                                if (i > 0) Hairline()
                                LineItem(
                                    r.image, r.productName,
                                    "${r.size?.let { "Size $it, " } ?: ""}${r.reason}. Asked ${timeAgo(r.createdAt)} on ${r.orderRef}",
                                    if (r.status == "Refunded") formatMoney(r.refundAmount) else null,
                                    onOpen = { app.go(Routes.order(r.orderId)) },
                                ) {
                                    if (r.status != "Refunded") StatusTag(r.status, Modifier.padding(top = 6.dp))
                                    if (r.status == "Rejected") {
                                        Text("This return was not accepted. Contact us from Help if you think that is wrong.", style = T.small, color = C.bad, modifier = Modifier.padding(top = Space.s2))
                                    } else {
                                        val steps = listOf("Requested", "Approved", "Refunded")
                                        Tracker(steps, steps.indexOf(r.status), Modifier.padding(top = Space.s3))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatusTag(status: String, modifier: Modifier) = Pill(status, statusTone(status), modifier)

/* ----------------------------- About ----------------------------- */

@Composable
fun AboutScreen() {
    val app = LocalApp.current
    val load = rememberLoad<Int>(Unit) {
        when (val r = safeApiCall { app.api.getProducts(mapOf("inStock" to "true")) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.products.size)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("About") {
        Text("A Pretoria shop for clothes that still have years in them.", style = T.h1, color = C.ink)
        Text(
            "iTHRIFT Clothes buys pre-owned branded clothing, checks every piece by hand and sells it on at a price students can manage. We started on WhatsApp and Instagram; this app and the website bring the whole rack online.",
            style = T.body.copy(fontSize = 17.sp, lineHeight = 26.sp), color = C.muted, modifier = Modifier.padding(top = Space.s3),
        )
        RemoteImage("/images/brand/storefront.jpg", Modifier.padding(vertical = Space.s5).fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(Radius.lg)), description = "The iTHRIFT Clothes store front in Hatfield")
        Text("How a piece gets on the rack", style = T.h2, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
        TimelineItem("We buy it", "From customers selling through Sell to us, and from bulk lots.")
        TimelineItem("We check and grade it", "Seams, zips, soles and fading, then a grade from Fair to Excellent. Any flaw is written in the description.")
        TimelineItem("We clean, measure and photograph it", "Every piece is listed in its real size, with stock per size.")
        TimelineItem("It goes on sale", load.data?.let { "Right now there are $it pieces on the rack." } ?: "Every week, new pieces arrive.", last = true)
        Spacer(Modifier.height(Space.s4))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            Btn("Shop the rack", { app.go(Routes.shop()) }, modifier = Modifier.weight(1f))
            Btn("Help and contact", { app.go(Routes.help()) }, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.height(Space.s5))
        Text("Fonts: Instrument Sans (SIL Open Font License). Icons: Lucide (ISC licence).", style = T.tiny, color = C.faint)
    }
}
