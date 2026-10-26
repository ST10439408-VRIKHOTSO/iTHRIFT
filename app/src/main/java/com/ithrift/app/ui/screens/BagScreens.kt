@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.AddCartItemRequest
import com.ithrift.app.data.Address
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.CartItem
import com.ithrift.app.data.CartResponse
import com.ithrift.app.data.CheckoutRequest
import com.ithrift.app.data.OrderDetail
import com.ithrift.app.data.OrderPayment
import com.ithrift.app.data.PointsSummary
import com.ithrift.app.data.QuoteRequest
import com.ithrift.app.data.QuoteResponse
import com.ithrift.app.data.StockAlertRequest
import com.ithrift.app.data.UpdateCartItemRequest
import com.ithrift.app.data.WishlistAddRequest
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
import com.ithrift.app.ui.components.CheckRow
import com.ithrift.app.ui.components.ConditionMeter
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.OptionCard
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.Pill
import com.ithrift.app.ui.components.PriceText
import com.ithrift.app.ui.components.ProgressBar
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.Segmented
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.SummaryRow
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.dateLabel
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.formatMoneyCents
import com.ithrift.app.util.plural
import kotlinx.coroutines.launch

/**
 * Shows [content] to a signed-in customer. Anyone else sees why not and
 * how to get there, as requireCustomer() does on the website.
 */
@Composable
fun CustomerOnly(next: String, what: String, content: @Composable () -> Unit) {
    val app = LocalApp.current
    when {
        app.isCustomer -> content()
        app.isStaff -> EmptyState(Lucide.user, "Customer accounts only", "$what belongs to customer accounts. Sign in as a customer to use it.")
        else -> EmptyState(
            Lucide.user, "Sign in to carry on", "Sign in or create an account to see $what. It only takes a minute.",
            actionLabel = "Sign in", onAction = { app.go(Routes.login(next)) },
            secondaryLabel = "Create an account", onSecondary = { app.go(Routes.register(next)) },
        )
    }
}

fun paymentLabel(p: OrderPayment?): String {
    if (p == null) return ""
    val name = mapOf("card" to "Card", "payfast" to "PayFast", "eft" to "EFT")[p.method] ?: p.method
    val status = mapOf("paid" to "paid", "pending" to "waiting for payment", "refunded" to "refunded")[p.status] ?: p.status
    return "$name, $status"
}

/** Subtotal, discounts, delivery and the total, as orderTotals() on the website. */
@Composable
fun OrderTotals(o: OrderDetail) {
    Hairline(Modifier.padding(vertical = Space.s3))
    SummaryRow("Subtotal", formatMoney(o.subtotal ?: o.total))
    if ((o.discount ?: 0.0) > 0) SummaryRow(o.promoCode ?: "Promo", "-${formatMoney(o.discount!!)}", valueColor = C.good)
    if ((o.pointsDiscount ?: 0.0) > 0) SummaryRow("${o.pointsRedeemed} Thrift Points", "-${formatMoney(o.pointsDiscount!!)}", valueColor = C.good)
    SummaryRow(o.deliveryLabel ?: "Delivery", if ((o.deliveryFee ?: 0.0) > 0) formatMoney(o.deliveryFee!!) else "Free")
    Hairline(Modifier.padding(vertical = Space.s2))
    SummaryRow("Total", formatMoney(o.total), strong = true)
}

@Composable
fun FreeDeliveryMeter(amount: Double, threshold: Double) {
    ProgressBar((amount / threshold).toFloat(), Modifier.padding(vertical = 6.dp))
    Text(
        if (amount >= threshold) "Standard delivery is free on this order." else "Add ${formatMoney(threshold - amount)} more for free standard delivery.",
        style = T.small,
        color = C.muted,
    )
}

/** A product line: photo, name, a line under it, and the price at the end. */
@Composable
fun LineItem(
    image: String,
    title: String,
    sub: String?,
    price: String?,
    onOpen: (() -> Unit)? = null,
    extra: @Composable ColumnScope.() -> Unit = {},
) {
    Row(Modifier.fillMaxWidth().padding(vertical = Space.s3), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
        RemoteImage(
            image,
            Modifier
                .width(80.dp)
                .aspectRatio(4f / 5f)
                .clip(RoundedCornerShape(Radius.md))
                .then(if (onOpen != null) Modifier.clickable(role = Role.Button, onClick = onOpen) else Modifier),
        )
        Column(Modifier.weight(1f)) {
            Row {
                Text(
                    title,
                    style = T.body.copy(fontWeight = FontWeight.Medium),
                    color = C.ink,
                    modifier = Modifier.weight(1f).then(if (onOpen != null) Modifier.clickable(role = Role.Button, onClick = onOpen) else Modifier),
                )
                if (price != null) Text(price, style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(start = Space.s2))
            }
            if (sub != null) Text(sub, style = T.small, color = C.muted, modifier = Modifier.padding(top = 2.dp))
            extra()
        }
    }
}

/* ----------------------------- Compare ----------------------------- */

@Composable
fun CompareScreen() {
    val app = LocalApp.current
    val ids = app.compareIds
    val load = rememberLoad<List<com.ithrift.app.data.Product>>(ids) {
        if (ids.isEmpty()) ApiOutcome.Success(emptyList())
        else when (val r = safeApiCall { app.api.productsByIds(ids.joinToString(",")) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.products)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Compare") {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> {
                val products = s.data
                if (products.isEmpty()) {
                    EmptyState(Lucide.columns3, "Nothing to compare yet", "Tap the compare button on up to four pieces, then come back here to see them side by side.", actionLabel = "Browse the shop", onAction = { app.go(Routes.shop()) })
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        PageHead("Compare", Modifier.weight(1f), "${plural(products.size, "piece")} side by side.")
                        Btn("Clear all", { app.clearCompare() }, style = BtnStyle.Secondary, small = true)
                    }
                    val cheapest = products.minOf { it.price }
                    val bestGrade = products.maxOf { CONDITIONS[it.condition]?.first ?: 0 }
                    val colWidth = 150.dp
                    Panel(padding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
                        Row(Modifier.horizontalScroll(rememberScrollState()).padding(Space.s4)) {
                            Column(Modifier.width(96.dp)) {
                                Spacer(Modifier.height(colWidth * 5 / 4 + Space.s3))
                                for (label in listOf("Piece", "Price", "Saving", "Condition", "Category", "Sizes in stock")) {
                                    Text(label, style = T.smallStrong, color = C.muted, modifier = Modifier.height(64.dp))
                                }
                            }
                            for (p in products) {
                                Column(Modifier.width(colWidth).padding(start = Space.s3)) {
                                    RemoteImage(p.image, Modifier.fillMaxWidth().aspectRatio(4f / 5f).clip(RoundedCornerShape(Radius.md)).clickable { app.go(Routes.product(p.id)) })
                                    Spacer(Modifier.height(Space.s3))
                                    Column(Modifier.height(64.dp)) {
                                        Text(p.brand, style = T.tiny, color = C.muted)
                                        Text(p.name, style = T.smallStrong, color = C.ink, maxLines = 2)
                                    }
                                    Column(Modifier.height(64.dp)) {
                                        PriceText(p.price, p.originalPrice, p.onSale, style = T.small.copy(fontWeight = FontWeight.SemiBold))
                                        if (p.price == cheapest && products.size > 1) Text("Lowest price", style = T.tiny, color = C.good)
                                    }
                                    Text(
                                        if (p.onSale && p.originalPrice != null) "${formatMoney(p.originalPrice - p.price)} (${p.percentOff}% off)" else "Full price",
                                        style = T.small,
                                        color = if (p.onSale) C.ink else C.faint,
                                        modifier = Modifier.height(64.dp),
                                    )
                                    Column(Modifier.height(64.dp)) {
                                        ConditionMeter(p.condition)
                                        if ((CONDITIONS[p.condition]?.first ?: 0) == bestGrade && products.size > 1) Text("Best condition", style = T.tiny, color = C.good)
                                    }
                                    Text(p.category, style = T.small, color = C.ink, modifier = Modifier.height(64.dp))
                                    Text(
                                        if (p.inStock) p.sizes.orEmpty().joinToString(", ") { it.size } else "Sold out",
                                        style = T.small,
                                        color = if (p.inStock) C.ink else C.faint,
                                        modifier = Modifier.height(64.dp),
                                    )
                                    Btn("View piece", { app.go(Routes.product(p.id)) }, small = true, modifier = Modifier.fillMaxWidth())
                                    Btn("Remove", { app.toggleCompare(p.id) }, style = BtnStyle.Ghost, small = true, modifier = Modifier.fillMaxWidth())
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Bag ----------------------------- */

@Composable
fun BagScreen() {
    val app = LocalApp.current
    val load = rememberLoad<CartResponse>(app.user?.id) { safeApiCall { app.api.getCart() } }
    LaunchedEffect(load.data) { load.data?.let { app.cartCount = it.itemCount } }

    fun after(cart: CartResponse, message: String? = null) {
        load.set(cart)
        app.cartCount = cart.itemCount
        if (message != null) app.toast(message, ToastKind.Success)
    }

    val cart = load.data
    val problems = cart?.items?.filter { it.quantity > it.stock }.orEmpty()
    Screen(
        "Your bag",
        back = false,
        bottom = if (app.isCustomer && cart != null && cart.items.isNotEmpty()) {
            {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Total so far", style = T.body, color = C.ink2, modifier = Modifier.weight(1f))
                        Text(formatMoney(cart.subtotal), style = T.h3, color = C.ink)
                    }
                    Spacer(Modifier.height(Space.s2))
                    Btn("Check out", { app.go(Routes.CHECKOUT) }, large = true, enabled = problems.isEmpty(), modifier = Modifier.fillMaxWidth())
                }
            }
        } else null,
    ) {
        CustomerOnly(Routes.BAG, "your bag") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val c = s.data
                    if (c.items.isEmpty()) {
                        EmptyState(
                            Lucide.shoppingBag, "Your bag is empty",
                            "Pieces are one of a kind, and adding one to your bag does not hold it, so check out soon once you find something.",
                            actionLabel = "Start shopping", onAction = { app.go(Routes.shop()) },
                            secondaryLabel = if (app.wishlistIds.isNotEmpty()) "Open your wishlist" else null, onSecondary = { app.go(Routes.WISHLIST) },
                        )
                    } else {
                        PageHead("Your bag", sub = "${plural(c.itemCount, "piece")}. Adding to your bag does not reserve stock.")
                        if (problems.isNotEmpty()) {
                            Callout(
                                "${if (problems.size == 1) "One piece" else "${problems.size} pieces"} changed since you added ${if (problems.size == 1) "it" else "them"}. Fix the lines marked below to check out.",
                                tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3),
                            )
                        }
                        Panel {
                            c.items.forEachIndexed { index, i ->
                                if (index > 0) Hairline()
                                BagLine(i, onCart = { after(it) })
                            }
                        }
                        Spacer(Modifier.height(Space.s4))
                        Panel {
                            Text("Summary", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
                            SummaryRow("Subtotal", formatMoney(c.subtotal))
                            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                                Text("Delivery", style = T.body, color = C.ink2, modifier = Modifier.weight(1f))
                                Text("Chosen at checkout", style = T.body, color = C.muted)
                            }
                            FreeDeliveryMeter(c.subtotal, app.options?.freeDeliveryThreshold ?: 1000.0)
                            Text("Promo codes and Thrift Points go on at checkout.", style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s3))
                            Btn("Keep shopping", { app.go(Routes.shop()) }, style = BtnStyle.Ghost, modifier = Modifier.fillMaxWidth().padding(top = Space.s2))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BagLine(i: CartItem, onCart: (CartResponse) -> Unit) {
    val app = LocalApp.current
    var busy by remember { mutableStateOf(false) }
    fun setQty(q: Int) {
        busy = true
        app.run({ safeApiCall { app.api.updateCartItem(i.id, UpdateCartItemRequest(q)) } }, onDone = { busy = false }) { onCart(it) }
    }
    LineItem(i.image, i.name, "${i.size?.let { "Size $it, " } ?: ""}${formatMoney(i.price)} each", formatMoney(i.price * i.quantity), onOpen = { app.go(Routes.product(i.productId)) }) {
        when {
            i.stock == 0 -> Text("Sold out. Remove it to check out.", style = T.small, color = C.bad, modifier = Modifier.padding(top = 4.dp))
            i.quantity > i.stock -> Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Only ${i.stock} left in this size. ", style = T.small, color = C.bad)
                LinkText("Reduce to ${i.stock}", { setQty(i.stock) }, color = C.bad)
            }
            i.stock <= 1 -> Text("Last one in this size.", style = T.small, color = C.warn, modifier = Modifier.padding(top = 4.dp))
        }
        FlowRow(Modifier.padding(top = Space.s2), horizontalArrangement = Arrangement.spacedBy(Space.s3), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
            if (i.stock > 1) Box(Modifier.height(44.dp)) { QtyStepperSmall(i.quantity, i.stock, enabled = !busy) { setQty(it) } }
            LinkText("Save for later", {
                app.run({
                    val w = safeApiCall { app.api.addToWishlist(WishlistAddRequest(i.productId)) }
                    if (w is ApiOutcome.Failure) w else safeApiCall { app.api.removeCartItem(i.id) }
                }) { cart ->
                    app.wishlistIds = app.wishlistIds + i.productId
                    onCart(cart)
                    app.toast("Moved to your wishlist.", ToastKind.Success)
                }
            }, color = C.muted)
            LinkText("Remove", {
                app.run({ safeApiCall { app.api.removeCartItem(i.id) } }) { cart ->
                    onCart(cart)
                    if (i.stock > 0) {
                        app.toast("Removed from your bag.", ToastKind.Plain, "Undo") {
                            app.run({ safeApiCall { app.api.addCartItem(AddCartItemRequest(i.productId, i.quantity, i.size)) } }) { onCart(it) }
                        }
                    } else app.toast("Removed from your bag.")
                }
            }, color = C.muted)
        }
    }
}

@Composable
private fun QtyStepperSmall(qty: Int, max: Int, enabled: Boolean, onChange: (Int) -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(Radius.md)).border(1.dp, C.hairlineStrong, RoundedCornerShape(Radius.md)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(40.dp).clickable(enabled = enabled && qty > 1) { onChange(qty - 1) }, contentAlignment = Alignment.Center) {
            Ico(Lucide.minus, size = 14.dp, tint = if (qty > 1) C.ink else C.faint, description = "One fewer")
        }
        Text("$qty", style = T.bodyStrong, color = C.ink)
        Box(Modifier.size(40.dp).clickable(enabled = enabled && qty < max) { onChange(qty + 1) }, contentAlignment = Alignment.Center) {
            Ico(Lucide.plus, size = 14.dp, tint = if (qty < max) C.ink else C.faint, description = "One more")
        }
    }
}

/* ----------------------------- Checkout ----------------------------- */

private data class CheckoutData(val cart: CartResponse, val addresses: List<Address>, val points: PointsSummary?)

@Composable
fun CheckoutScreen() {
    val app = LocalApp.current
    val load = rememberLoad<CheckoutData>(app.user?.id) {
        val cart = safeApiCall { app.api.getCart() }
        if (cart !is ApiOutcome.Success) return@rememberLoad cart as ApiOutcome.Failure
        val addresses = (safeApiCall { app.api.getAddresses() } as? ApiOutcome.Success)?.data?.addresses.orEmpty()
        val pts = (safeApiCall { app.api.points() } as? ApiOutcome.Success)?.data
        if (app.options == null) app.loadLookups(force = true)
        ApiOutcome.Success(CheckoutData(cart.data, addresses, pts))
    }
    Screen("Checkout") {
        CustomerOnly(Routes.CHECKOUT, "checkout") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val d = s.data
                    when {
                        d.cart.items.isEmpty() -> EmptyState(Lucide.shoppingBag, "Your bag is empty", "Add something to your bag first.", actionLabel = "Start shopping", onAction = { app.go(Routes.shop()) })
                        d.cart.items.any { it.quantity > it.stock } -> EmptyState(Lucide.circleAlert, "Your bag changed", "Something in your bag sold or changed. Check it before paying.", actionLabel = "Open your bag", onAction = { app.go(Routes.BAG) })
                        app.options == null -> ErrorState("Delivery options did not load.", { load.reload() })
                        else -> CheckoutForm(d, onAddressesChanged = { load.reload() })
                    }
                }
            }
        }
    }
}

@Composable
private fun StepHead(n: Int, title: String, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(bottom = Space.s3), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(28.dp).clip(CircleShape).background(C.ink), contentAlignment = Alignment.Center) {
            Text("$n", style = T.smallStrong, color = C.paper)
        }
        Spacer(Modifier.width(Space.s3))
        Text(title, style = T.h3, color = C.ink, modifier = Modifier.weight(1f).semantics { heading() })
        action?.invoke()
    }
}

@Composable
private fun CheckoutForm(d: CheckoutData, onAddressesChanged: () -> Unit) {
    val app = LocalApp.current
    val options = app.options!!
    var method by remember { mutableStateOf("standard") }
    var addressId by remember { mutableStateOf(d.addresses.firstOrNull { it.isDefault }?.id ?: d.addresses.firstOrNull()?.id) }
    var instructions by remember { mutableStateOf("") }
    var date by remember { mutableStateOf<String?>(null) }
    var slot by remember { mutableStateOf<String?>(null) }
    var slotError by remember { mutableStateOf(false) }
    var gift by remember { mutableStateOf(false) }
    var giftMessage by remember { mutableStateOf("") }
    var pay by remember { mutableStateOf("card") }
    var promoInput by remember { mutableStateOf("") }
    var promo by remember { mutableStateOf("") }
    var promoMsg by remember { mutableStateOf<Pair<String, Boolean>?>(null) }
    var points by remember { mutableIntStateOf(0) }
    var quote by remember { mutableStateOf<QuoteResponse?>(null) }
    var quoteError by remember { mutableStateOf<String?>(null) }
    var placing by remember { mutableStateOf(false) }
    var showPoints by remember { mutableStateOf(false) }
    val rules = options.points
    val balance = d.points?.balance ?: 0
    val maxBlocks = if (rules != null) balance / rules.block else 0

    // The total is always worked out by the server: ask again whenever a choice changes.
    LaunchedEffect(method, promo, points) {
        when (val r = safeApiCall { app.api.getQuote(QuoteRequest(method, promo.ifBlank { null }, points.takeIf { it > 0 })) }) {
            is ApiOutcome.Success -> {
                quote = r.data
                quoteError = null
                if (promo.isNotBlank()) promoMsg = "${promo.uppercase()} applied." to true
            }
            is ApiOutcome.Failure -> when {
                promo.isNotBlank() -> { promoMsg = r.message to false; promo = "" }
                points > 0 -> { app.toast(r.message, ToastKind.Error); points = 0 }
                else -> quoteError = r.message
            }
        }
    }

    // 1. Delivery
    Panel {
        StepHead(1, "Delivery")
        for (m in options.deliveryMethods) {
            OptionCard(
                selected = method == m.id,
                onClick = { method = m.id },
                title = m.label,
                trailing = if (m.fee > 0) formatMoney(m.fee) else "Free",
                sub = "${if (m.id == "collection") "Ready from" else "Arrives"} ${m.arrives?.label ?: m.eta}" + if (m.freeOverThreshold) ". Free from ${formatMoney(options.freeDeliveryThreshold)}" else "",
                modifier = Modifier.padding(bottom = Space.s2),
            )
        }
    }
    Spacer(Modifier.height(Space.s4))

    // 2. Address, or the collection slot
    if (method == "collection") {
        val col = options.collection
        Panel {
            StepHead(2, "Collection time")
            Text("Collect from iTHRIFT Clothes, ${col?.address ?: "Hatfield Plaza, Pretoria"}. Bring your order number.", style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3))
            Text("Day", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2), maxItemsInEachRow = 3) {
                for (day in col?.dates.orEmpty()) {
                    val on = date == day
                    Column(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radius.md))
                            .background(if (on) C.pineSoft else C.surface)
                            .border(if (on) 2.dp else 1.dp, if (on) C.pine else C.hairlineStrong, RoundedCornerShape(Radius.md))
                            .clickable(role = Role.RadioButton) { date = day; slotError = false }
                            .semantics { stateDescription = if (on) "Selected" else "Not selected" }
                            .padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        val label = dateLabel(day, year = false, weekday = true)
                        Text(label.substringBefore(' '), style = T.body.copy(fontSize = 15.sp), color = C.ink)
                        Text(label.substringAfter(' '), style = T.tiny, color = C.muted)
                    }
                }
            }
            Text("Time", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(top = Space.s4, bottom = 6.dp))
            val slots = col?.slots.orEmpty()
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                for (t in slots) com.ithrift.app.ui.components.Chip(t, slot == t, { slot = t; slotError = false }, icon = Lucide.clock)
            }
            if (slotError) Text("Choose a day and a time to collect.", style = T.small, color = C.bad, modifier = Modifier.padding(top = Space.s2))
        }
    } else {
        Panel {
            StepHead(2, "Address") { LinkText("Manage", { app.go(Routes.addresses(pick = true)) }) }
            if (d.addresses.isEmpty()) {
                Callout("No saved address yet. Add a delivery address, or choose collection from the store.", tone = Tone.Info, icon = Lucide.mapPin)
                Btn("Add a delivery address", { app.go(Routes.addresses(pick = true)) }, style = BtnStyle.Secondary, icon = Lucide.plus, modifier = Modifier.padding(top = Space.s3))
            } else {
                for (a in d.addresses) {
                    OptionCard(
                        selected = addressId == a.id,
                        onClick = { addressId = a.id },
                        title = a.label + if (a.isDefault) " (default)" else "",
                        sub = a.oneLine(),
                        modifier = Modifier.padding(bottom = Space.s2),
                    )
                }
            }
            Spacer(Modifier.height(Space.s3))
            Field("Delivery instructions (optional)", instructions, { instructions = it }, placeholder = "For example, leave it with the guard at the gate", maxLength = 200)
        }
    }
    Spacer(Modifier.height(Space.s4))

    // 3. Gift
    Panel {
        StepHead(3, "Is it a gift?")
        CheckRow(gift, { gift = it }, "This is a gift. We will leave the prices off the slip in the parcel.")
        if (gift) {
            Spacer(Modifier.height(Space.s2))
            Field("Gift message (optional)", giftMessage, { giftMessage = it }, placeholder = "Happy birthday!", singleLine = false, maxLength = 200, hint = "${giftMessage.length} of 200 characters")
        }
    }
    Spacer(Modifier.height(Space.s4))

    // 4. Payment
    Panel {
        StepHead(4, "Payment")
        Text("Payments are simulated in this version of iTHRIFT. No money changes hands.", style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3))
        for ((value, title, sub) in listOf(
            Triple("card", "Card", "Visa or Mastercard"),
            Triple("payfast", "PayFast", "Instant EFT, SnapScan or Zapper"),
            Triple("eft", "Bank transfer (EFT)", "We pack your order once the money clears"),
        )) {
            OptionCard(pay == value, { pay = value }, title, sub = sub, modifier = Modifier.padding(bottom = Space.s2))
        }
    }
    Spacer(Modifier.height(Space.s4))

    // Summary
    Panel {
        Text("Order summary", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
        for (i in d.cart.items) {
            SummaryRow("${if (i.quantity > 1) "${i.quantity} x " else ""}${i.name}${i.size?.let { ", $it" } ?: ""}", formatMoney(i.price * i.quantity))
        }
        val q = quote
        if (q != null) {
            Hairline(Modifier.padding(vertical = Space.s3))
            SummaryRow("Subtotal", formatMoney(q.subtotal))
            if (q.discount > 0) SummaryRow(q.promo?.code ?: "Promo", "-${formatMoney(q.discount)}", valueColor = C.good)
            if ((q.pointsDiscount ?: 0.0) > 0) SummaryRow("${q.pointsRedeemed} Thrift Points", "-${formatMoney(q.pointsDiscount!!)}", valueColor = C.good)
            SummaryRow("Delivery", if (q.deliveryFee > 0) formatMoney(q.deliveryFee) else "Free")
            if (method == "standard" && q.freeDeliveryRemaining > 0) FreeDeliveryMeter(options.freeDeliveryThreshold - q.freeDeliveryRemaining, options.freeDeliveryThreshold)
            Hairline(Modifier.padding(vertical = Space.s2))
            SummaryRow("Total", formatMoney(q.total), strong = true)
            Text("Includes ${formatMoneyCents(q.total - q.total / 1.15)} VAT.", style = T.tiny, color = C.muted)
        }
        if (quoteError != null) Callout(quoteError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(top = Space.s3))

        Hairline(Modifier.padding(vertical = Space.s4))
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
            Field("Promo code", promoInput, { promoInput = it; promoMsg = null }, Modifier.weight(1f), placeholder = "For example STUDENT15", maxLength = 30)
            Btn("Apply", {
                if (promoInput.isBlank()) promoMsg = "Type a promo code first." to false
                else { promoMsg = null; promo = promoInput.trim() }
            }, style = BtnStyle.Secondary, modifier = Modifier.padding(bottom = Space.s4))
        }
        promoMsg?.let { (msg, ok) -> Text(msg, style = T.small, color = if (ok) C.good else C.bad, modifier = Modifier.padding(bottom = Space.s3)) }

        if (rules != null) {
            if (maxBlocks > 0) {
                Text("Thrift Points (you have $balance)", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
                OptionCard(
                    selected = points > 0,
                    onClick = { showPoints = true },
                    title = if (points > 0) "$points points for ${formatMoney(points / rules.block * rules.randPerBlock)} off" else "Do not use points",
                    sub = "Tap to choose",
                )
            } else {
                Text("You have $balance Thrift Points. Spend them once you reach ${rules.block}.", style = T.small, color = C.muted)
            }
        }
        Spacer(Modifier.height(Space.s5))
        Btn(
            if (q != null) "Place order, ${formatMoney(q.total)}" else "Place order",
            {
                if (method == "collection" && (date == null || slot == null)) { slotError = true; return@Btn }
                if (method != "collection" && d.addresses.isEmpty()) { app.toast("Add a delivery address first, or choose collection.", ToastKind.Error); return@Btn }
                placing = true
                val collect = method == "collection"
                app.run({
                    safeApiCall {
                        app.api.checkout(
                            CheckoutRequest(
                                method = pay,
                                deliveryMethod = method,
                                addressId = if (collect) null else addressId,
                                instructions = if (collect) null else instructions.ifBlank { null },
                                promoCode = promo.ifBlank { null },
                                pointsToRedeem = points.takeIf { it > 0 },
                                collectionDate = if (collect) date else null,
                                collectionSlot = if (collect) slot else null,
                                isGift = gift,
                                giftMessage = if (gift) giftMessage.ifBlank { null } else null,
                            ),
                        )
                    }
                }, onDone = { placing = false }) { r ->
                    app.scope.launch { app.refreshCounts() }
                    app.nav.navigate(Routes.placed(r.order.id)) { popUpTo(Routes.HOME) }
                }
            },
            large = true,
            loading = placing,
            modifier = Modifier.fillMaxWidth(),
        )
        Text("You earn a Thrift Point for every R10 once your order is delivered.", style = T.tiny, color = C.muted, modifier = Modifier.padding(top = Space.s2))
    }

    if (showPoints && rules != null) {
        Sheet("Spend Thrift Points", onDismiss = { showPoints = false }) {
            OptionCard(points == 0, { points = 0; showPoints = false }, "Do not use points", modifier = Modifier.padding(bottom = Space.s2))
            for (n in (1..minOf(maxBlocks, 30)).map { it * rules.block }) {
                OptionCard(points == n, { points = n; showPoints = false }, "$n points", trailing = "${formatMoney(n / rules.block * rules.randPerBlock)} off", modifier = Modifier.padding(bottom = Space.s2))
            }
        }
    }
}

/* ----------------------------- Order placed ----------------------------- */

@Composable
fun OrderPlacedScreen(id: Int) {
    val app = LocalApp.current
    val load = rememberLoad<OrderDetail>(id) {
        when (val r = safeApiCall { app.api.getOrder(id) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.order)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Order placed") {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> {
                val o = s.data
                Column(Modifier.fillMaxWidth().padding(vertical = Space.s5), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(72.dp).clip(CircleShape).background(C.pineSoft), contentAlignment = Alignment.Center) {
                        Ico(Lucide.check, size = 36.dp, tint = C.pine)
                    }
                    Spacer(Modifier.height(Space.s4))
                    Text("Thank you, ${o.customer.name.substringBefore(' ')}.", style = T.h1, color = C.ink, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(Space.s2))
                    Text(
                        "Your order ${o.ref} is in. " + when {
                            o.collectionDate != null -> "Collect it on ${dateLabel(o.collectionDate, year = false, weekday = true)}, ${o.collectionSlot}."
                            o.nextStep?.date != null -> "We will ship it by ${dateLabel(o.nextStep.date, year = false, weekday = true)}."
                            else -> ""
                        },
                        style = T.body,
                        color = C.muted,
                        textAlign = TextAlign.Center,
                    )
                }
                Panel {
                    for (i in o.items) SummaryRow("${if (i.quantity > 1) "${i.quantity} x " else ""}${i.name}${i.size?.let { ", $it" } ?: ""}", formatMoney(i.lineTotal))
                    OrderTotals(o)
                    Hairline(Modifier.padding(vertical = Space.s3))
                    SummaryRow("Payment", paymentLabel(o.payment))
                    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
                        Text(if (o.deliveryMethod == "collection") "Collection" else "Deliver to", style = T.body, color = C.ink2, modifier = Modifier.weight(1f))
                        Text((o.deliveryAddress ?: "").removePrefix("Collect from: "), style = T.body, color = C.ink, textAlign = TextAlign.End, modifier = Modifier.weight(1.4f))
                    }
                }
                if (o.payment?.status == "pending") {
                    Callout("Pay by EFT using ${o.ref} as the reference. We start packing once the money clears.", tone = Tone.Warn, icon = Lucide.clock, modifier = Modifier.padding(top = Space.s4))
                }
                Callout("You will earn ${(o.total / 10).toInt()} Thrift Points when this order is delivered.", tone = Tone.Good, icon = Lucide.coins, modifier = Modifier.padding(top = Space.s4))
                Spacer(Modifier.height(Space.s5))
                Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                    Btn("Track this order", { app.go(Routes.order(o.id)) }, modifier = Modifier.weight(1f))
                    Btn("Keep shopping", { app.go(Routes.shop()) }, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

/* ----------------------------- Wishlist ----------------------------- */

@Composable
fun WishlistScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<com.ithrift.app.data.WishlistItem>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getWishlist() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.items)
            is ApiOutcome.Failure -> r
        }
    }
    LaunchedEffect(load.data) { load.data?.let { items -> app.wishlistIds = items.map { it.productId }.toSet() } }
    Screen("Wishlist") {
        CustomerOnly(Routes.WISHLIST, "your wishlist") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val items = s.data
                    if (items.isEmpty()) {
                        EmptyState(Lucide.heart, "Nothing saved yet", "Tap the heart on any piece to keep it here. We will tell you if its price drops.", actionLabel = "Browse the shop", onAction = { app.go(Routes.shop()) })
                    } else {
                        PageHead("Wishlist", sub = "${plural(items.size, "saved piece")}. Saving does not hold a piece, and each one is one of a kind.")
                        val drops = items.count { (it.priceDrop ?: 0.0) > 0 }
                        if (drops > 0) {
                            Callout(
                                "${if (drops == 1) "One piece has" else "$drops pieces have"} dropped in price since you saved ${if (drops == 1) "it" else "them"}.",
                                tone = Tone.Sale, icon = Lucide.badgePercent, modifier = Modifier.padding(bottom = Space.s3),
                            )
                        }
                        Panel {
                            items.forEachIndexed { index, i ->
                                if (index > 0) Hairline()
                                var moving by remember { mutableStateOf(false) }
                                LineItem(i.image, i.name, i.brand, null, onOpen = { app.go(Routes.product(i.productId)) }) {
                                    PriceText(i.price, i.originalPrice, i.onSale, Modifier.padding(top = 4.dp), T.body.copy(fontWeight = FontWeight.SemiBold))
                                    FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                        if ((i.priceDrop ?: 0.0) > 0) Pill("${formatMoney(i.priceDrop!!)} less than when you saved it", Tone.Sale, icon = Lucide.badgePercent)
                                        if (i.inStock) Text(if (i.onlySize != null) "Size ${i.onlySize}" else "${i.sizeCount} sizes", style = T.small, color = C.muted)
                                        else Pill("Sold out", Tone.Bad)
                                    }
                                    FlowRow(Modifier.padding(top = Space.s2), horizontalArrangement = Arrangement.spacedBy(Space.s3), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                                        if (i.inStock) {
                                            Btn(if (i.onlySize != null) "Move to bag" else "Choose a size", {
                                                if (i.onlySize == null) { app.go(Routes.product(i.productId)); return@Btn }
                                                moving = true
                                                app.run({
                                                    val c = safeApiCall { app.api.addCartItem(AddCartItemRequest(i.productId, 1, i.onlySize)) }
                                                    if (c is ApiOutcome.Failure) c else {
                                                        app.cartCount = (c as ApiOutcome.Success).data.itemCount
                                                        safeApiCall { app.api.removeFromWishlist(i.productId) }
                                                    }
                                                }, onDone = { moving = false }) { w ->
                                                    load.set(w.items)
                                                    app.toast("Moved to your bag.", ToastKind.Success, "View bag") { app.go(Routes.BAG) }
                                                }
                                            }, small = true, loading = moving)
                                        } else {
                                            Btn("Tell me if it is back", {
                                                app.run({ safeApiCall { app.api.addStockAlert(i.productId, StockAlertRequest(null)) } }) { r ->
                                                    app.toast(r.message ?: "We will let you know.", ToastKind.Success, "My alerts") { app.go(Routes.ALERTS) }
                                                }
                                            }, style = BtnStyle.Secondary, small = true, icon = Lucide.bell)
                                        }
                                        LinkText("Remove", {
                                            app.run({ safeApiCall { app.api.removeFromWishlist(i.productId) } }) { w ->
                                                load.set(w.items)
                                                app.toast("Removed from your wishlist.", ToastKind.Plain, "Undo") {
                                                    app.run({ safeApiCall { app.api.addToWishlist(WishlistAddRequest(i.productId)) } }) { back -> load.set(back.items) }
                                                }
                                            }
                                        }, color = C.muted, modifier = Modifier.heightIn(min = 36.dp))
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
