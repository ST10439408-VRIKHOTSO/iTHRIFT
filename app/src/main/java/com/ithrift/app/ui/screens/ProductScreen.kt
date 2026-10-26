@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.screens

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.ithrift.app.data.AddCartItemRequest
import com.ithrift.app.data.ApiClient
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.OrderOptionsResponse
import com.ithrift.app.data.Product
import com.ithrift.app.data.ProductQuestion
import com.ithrift.app.data.ProductSize
import com.ithrift.app.data.QuestionRequest
import com.ithrift.app.data.ReviewListResponse
import com.ithrift.app.data.ReviewRequest
import com.ithrift.app.data.StockAlertRequest
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.AppState
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.CONDITIONS
import com.ithrift.app.ui.components.Callout
import com.ithrift.app.ui.components.CloseCircle
import com.ithrift.app.ui.components.ConditionMeter
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.Pill
import com.ithrift.app.ui.components.PriceText
import com.ithrift.app.ui.components.ProductRail
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.SectionHead
import com.ithrift.app.ui.components.Segmented
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.Stars
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.plural
import com.ithrift.app.util.timeAgo

private data class ProductData(
    val product: Product,
    val reviews: ReviewListResponse,
    val questions: List<ProductQuestion>,
    val similar: List<Product>,
    val recent: List<Product>,
)

@Composable
fun ProductScreen(id: Int) {
    val app = LocalApp.current
    val load = rememberLoad<ProductData>(id, app.user?.id) {
        val api = app.api
        val p = safeApiCall { api.getProduct(id) }
        if (p !is ApiOutcome.Success) return@rememberLoad p as ApiOutcome.Failure
        val reviews = (safeApiCall { api.getReviews(id) } as? ApiOutcome.Success)?.data ?: ReviewListResponse(emptyList(), null)
        val questions = (safeApiCall { api.getQuestions(id) } as? ApiOutcome.Success)?.data?.questions.orEmpty()
        val similar = (safeApiCall { api.similar(id) } as? ApiOutcome.Success)?.data?.products.orEmpty()
        val recentIds = AppSettings.recentProducts(app.context).filter { it != id }.take(8)
        val recent = if (recentIds.isEmpty()) emptyList() else (safeApiCall { api.productsByIds(recentIds.joinToString(",")) } as? ApiOutcome.Success)?.data?.products.orEmpty()
        if (app.options == null) app.loadLookups(force = true)
        ApiOutcome.Success(ProductData(p.data.product, reviews, questions, similar, recent))
    }
    LaunchedEffect(id) { AppSettings.addRecentProduct(app.context, id) }

    val p = load.data?.product
    Screen(title = p?.let { "${it.brand} ${it.name}" } ?: "Product", padded = false) {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> ProductContent(s.data, app.options) { load.reload() }
        }
    }
}

@Composable
private fun ProductContent(d: ProductData, options: OrderOptionsResponse?, reload: () -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    val p = d.product
    val sizes = p.allSizes?.takeIf { it.isNotEmpty() } ?: listOf(ProductSize(p.size, p.stock))
    val inStockSizes = sizes.filter { it.stock > 0 }
    var chosen by remember(p.id) { mutableStateOf(if (inStockSizes.size == 1) inStockSizes[0] else null) }
    var qty by remember(p.id) { mutableIntStateOf(1) }
    var sizeNudge by remember { mutableStateOf(false) }
    var adding by remember { mutableStateOf(false) }
    var showPhoto by remember { mutableStateOf(false) }
    var showSizeGuide by remember { mutableStateOf(false) }
    var showGrades by remember { mutableStateOf(false) }
    val saved = p.id in app.wishlistIds

    // Photo
    Box(
        Modifier
            .padding(Space.s4)
            .fillMaxWidth()
            .aspectRatio(1f)
            .clip(RoundedCornerShape(Radius.lg))
            .clickable(role = Role.Button) { showPhoto = true }
            .semantics { contentDescription = "Open the photo of ${p.name} full screen" },
    ) {
        RemoteImage(p.image, Modifier.fillMaxSize(), ContentScale.Crop, "${p.brand} ${p.name}")
        Box(Modifier.align(Alignment.BottomEnd).padding(12.dp).size(40.dp).clip(RoundedCornerShape(20.dp)).background(C.surface), contentAlignment = Alignment.Center) {
            Ico(Lucide.zoomIn, size = 18.dp, tint = C.ink)
        }
    }

    Column(Modifier.padding(horizontal = Space.s4)) {
        Text(
            p.brand,
            style = T.body,
            color = C.muted,
            modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable(role = Role.Button) { app.go(Routes.shop(mapOf("brand" to p.brand))) },
        )
        Text(p.name, style = T.h1, color = C.ink, modifier = Modifier.padding(top = 2.dp).semantics { heading() })
        Row(Modifier.padding(top = Space.s2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            PriceText(p.price, p.originalPrice, p.onSale, style = T.h2.copy(fontSize = 24.sp))
            if (p.onSale && p.originalPrice != null) Pill("Save ${formatMoney(p.originalPrice - p.price)}", Tone.Sale)
        }
        val summary = d.reviews.summary
        if (summary != null && summary.count > 0) {
            Row(Modifier.padding(top = Space.s2), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Stars(summary.average ?: 0.0)
                Text("${summary.average} from ${plural(summary.count, "review")}", style = T.small, color = C.muted)
            }
        }

        // Condition
        Block {
            LabelRow("Condition", "How we grade") { showGrades = true }
            ConditionMeter(p.condition, large = true)
            Text(CONDITIONS[p.condition]?.second ?: "", style = T.small, color = C.muted, modifier = Modifier.padding(top = 8.dp))
        }

        // Sizes
        Block {
            LabelRow(if (!p.inStock) "Sizes" else chosen?.let { "Size ${it.size}" } ?: "Choose a size", "Size guide") { showSizeGuide = true }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                for (s in sizes) {
                    val on = chosen?.size == s.size
                    val out = s.stock <= 0
                    Box(
                        Modifier
                            .heightIn(min = 48.dp)
                            .widthIn(min = 56.dp)
                            .clip(RoundedCornerShape(Radius.md))
                            .background(if (on) C.ink else C.surface)
                            .border(1.dp, if (on) C.ink else C.hairlineStrong, RoundedCornerShape(Radius.md))
                            .clickable(role = Role.RadioButton) {
                                if (out) stockAlert(app, p.id, s.size)
                                else {
                                    chosen = s
                                    qty = 1
                                    sizeNudge = false
                                }
                            }
                            .semantics {
                                contentDescription = if (out) "${s.size}, sold out. Get an alert when it is back" else s.size
                                stateDescription = if (on) "Selected" else "Not selected"
                            }
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            s.size,
                            style = T.body.copy(fontWeight = FontWeight.Medium, textDecoration = if (out) TextDecoration.LineThrough else null),
                            color = when {
                                on -> C.paper
                                out -> C.faint
                                else -> C.ink
                            },
                        )
                    }
                }
            }
            val note = when {
                !p.inStock -> ""
                sizeNudge -> "Choose a size first."
                chosen != null -> if (chosen!!.stock == 1) "Last one in this size." else "${chosen!!.stock} in this size."
                else -> "Crossed-out sizes are sold out. Tap one to get an alert."
            }
            if (note.isNotEmpty()) Text(note, style = T.small, color = if (sizeNudge) C.bad else C.muted, modifier = Modifier.padding(top = 8.dp))
        }

        // Buy row
        Spacer(Modifier.height(Space.s4))
        if (p.inStock) {
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalAlignment = Alignment.CenterVertically) {
                if (!app.isStaff) {
                    if ((chosen?.stock ?: 0) > 1) QtyStepper(qty, max = chosen?.stock ?: 1) { qty = it }
                    Btn("Add to bag", {
                        val c = chosen
                        if (c == null) { sizeNudge = true; return@Btn }
                        if (!app.requireSignIn(Routes.product(p.id))) return@Btn
                        adding = true
                        app.run({ safeApiCall { app.api.addCartItem(AddCartItemRequest(p.id, qty, c.size)) } }, onDone = { adding = false }) { cart ->
                            app.cartCount = cart.itemCount
                            app.toast("Added to your bag, size ${c.size}.", ToastKind.Success, "View bag") { app.go(Routes.BAG) }
                        }
                    }, icon = Lucide.shoppingBag, large = true, loading = adding, modifier = Modifier.weight(1f))
                    WishButton(saved) { app.toggleWishlist(p.id, p.name) }
                }
            }
        } else {
            Callout("This piece has sold. Get an alert if it comes back, or see similar pieces below.", tone = Tone.Warn, icon = Lucide.circleAlert)
            Spacer(Modifier.height(Space.s3))
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                Btn("Tell me if it comes back", { stockAlert(app, p.id, null) }, icon = Lucide.bell, large = true, modifier = Modifier.weight(1f))
                if (!app.isStaff) WishButton(saved) { app.toggleWishlist(p.id, p.name) }
            }
        }

        // Delivery estimates, counted in working days by the server.
        if (options != null) {
            Block {
                for (m in options.deliveryMethods) {
                    Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                        Ico(if (m.id == "collection") Lucide.store else Lucide.truck, size = 18.dp, tint = C.muted, modifier = Modifier.padding(top = 3.dp))
                        Column {
                            Text(
                                "${m.label}, ${if (m.fee > 0) formatMoney(m.fee) else "free"}" + if (m.freeOverThreshold) " (free from ${formatMoney(options.freeDeliveryThreshold)})" else "",
                                style = T.body.copy(fontSize = 15.sp, fontWeight = FontWeight.Medium),
                                color = C.ink,
                            )
                            m.arrives?.label?.let { Text("${if (m.id == "collection") "Ready from" else "Arrives"} $it", style = T.small, color = C.muted) }
                        }
                    }
                }
            }
        }

        // Tools
        Spacer(Modifier.height(Space.s4))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
            Btn("Share", {
                val url = ApiClient.originUrl(context) + "/#/product/${p.id}"
                val text = "${p.brand} ${p.name}, ${formatMoney(p.price)} at iTHRIFT"
                val send = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, text)
                    putExtra(Intent.EXTRA_TEXT, "$text $url")
                }
                context.startActivity(Intent.createChooser(send, "Share this piece"))
            }, style = BtnStyle.Quiet, small = true, icon = Lucide.share2)
            val comparing = p.id in app.compareIds
            Btn(if (comparing) "Comparing" else "Compare", { app.toggleCompare(p.id) }, style = if (comparing) BtnStyle.Secondary else BtnStyle.Quiet, small = true, icon = Lucide.columns3)
            if (app.compareIds.size >= 2) Btn("Open compare (${app.compareIds.size})", { app.go(Routes.COMPARE) }, style = BtnStyle.Ghost, small = true)
        }

        // Description
        Block {
            Text("Description", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
            Text(p.description, style = T.body, color = C.ink2)
            Spacer(Modifier.height(Space.s3))
            Fact("Brand", p.brand)
            Fact("Category", p.category) { app.go(Routes.shop(mapOf("category" to p.category))) }
            Fact("Reference", p.ref)
            Fact("Condition", p.condition)
        }
        Block {
            Text("Returns", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
            Text(
                "Return anything within ${options?.returnWindowDays ?: 30} days of delivery. Open the order, choose the piece and tell us why. We refund once it is back with us.",
                style = T.body,
                color = C.muted,
            )
        }

        Reviews(p.id, d.reviews, reload)
        Questions(p.id, d.questions, reload)
    }

    if (d.similar.isNotEmpty()) {
        Spacer(Modifier.height(Space.s6))
        SectionHead("Similar pieces", Modifier.padding(horizontal = Space.s4))
        ProductRail(d.similar)
    }
    if (d.recent.isNotEmpty()) {
        Spacer(Modifier.height(Space.s6))
        SectionHead("You looked at", Modifier.padding(horizontal = Space.s4))
        ProductRail(d.recent)
    }

    if (showPhoto) Lightbox(p.image, "${p.brand} ${p.name}") { showPhoto = false }
    if (showSizeGuide) {
        Sheet("Size guide", onDismiss = { showSizeGuide = false }) { SizeGuideContent(guideKeyFor(p.category), chosen?.size) }
    }
    if (showGrades) ConditionGuideSheet { showGrades = false }
}

private fun stockAlert(app: AppState, productId: Int, size: String?) {
    if (!app.requireSignIn(Routes.product(productId))) return
    if (!app.isCustomer) {
        app.toast("Alerts are for customer accounts.", ToastKind.Error)
        return
    }
    app.run({ safeApiCall { app.api.addStockAlert(productId, StockAlertRequest(size)) } }) { r ->
        app.toast(r.message ?: "We will let you know if it comes back.", ToastKind.Success, "My alerts") { app.go(Routes.ALERTS) }
    }
}

@Composable
private fun Block(content: @Composable () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = Space.s5)) {
        Hairline(Modifier.padding(bottom = Space.s4))
        content()
    }
}

@Composable
private fun LabelRow(label: String, action: String, onAction: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = Space.s2), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = T.bodyStrong, color = C.ink, modifier = Modifier.weight(1f))
        LinkText(action, onAction)
    }
}

@Composable
private fun Fact(label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(label, style = T.small, color = C.muted, modifier = Modifier.width(110.dp))
        if (onClick != null) LinkText(value, onClick, style = T.small) else Text(value, style = T.small, color = C.ink)
    }
}

@Composable
private fun WishButton(saved: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .size(52.dp)
            .clip(RoundedCornerShape(Radius.md))
            .background(if (saved) C.badSoft else C.surface)
            .border(1.dp, if (saved) C.bad else C.hairlineStrong, RoundedCornerShape(Radius.md))
            .clickable(role = Role.Switch, onClick = onClick)
            .semantics {
                contentDescription = if (saved) "Remove from your wishlist" else "Save to your wishlist"
                stateDescription = if (saved) "Saved" else "Not saved"
            },
        contentAlignment = Alignment.Center,
    ) { Ico(Lucide.heart, size = 20.dp, tint = if (saved) C.bad else C.ink) }
}

@Composable
fun QtyStepper(qty: Int, max: Int, min: Int = 1, onChange: (Int) -> Unit) {
    Row(
        Modifier.height(52.dp).clip(RoundedCornerShape(Radius.md)).border(1.dp, C.hairlineStrong, RoundedCornerShape(Radius.md)).background(C.surface),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(44.dp, 52.dp).clickable(enabled = qty > min, role = Role.Button) { onChange(qty - 1) }.semantics { contentDescription = "One fewer" },
            contentAlignment = Alignment.Center,
        ) { Ico(Lucide.minus, size = 16.dp, tint = if (qty > min) C.ink else C.faint) }
        Text(qty.toString(), style = T.bodyStrong, color = C.ink, modifier = Modifier.semantics { contentDescription = "Quantity $qty" })
        Box(
            Modifier.size(44.dp, 52.dp).clickable(enabled = qty < max, role = Role.Button) { onChange(qty + 1) }.semantics { contentDescription = "One more" },
            contentAlignment = Alignment.Center,
        ) { Ico(Lucide.plus, size = 16.dp, tint = if (qty < max) C.ink else C.faint) }
    }
}

@Composable
private fun Reviews(productId: Int, data: ReviewListResponse, reload: () -> Unit) {
    val app = LocalApp.current
    var order by remember { mutableStateOf("new") }
    var writing by remember { mutableStateOf(false) }
    val summary = data.summary
    Spacer(Modifier.height(Space.s6))
    Hairline(Modifier.padding(bottom = Space.s5))
    SectionHead("Reviews")
    if (summary != null && summary.count > 0) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s5)) {
            Column {
                Text("${summary.average}", style = T.display.copy(fontSize = 40.sp), color = C.ink)
                Stars(summary.average ?: 0.0)
                Text(plural(summary.count, "review"), style = T.small, color = C.muted)
            }
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                for (n in 5 downTo 1) {
                    val c = summary.histogram?.get(n.toString()) ?: 0
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("$n", style = T.small, color = C.muted, modifier = Modifier.width(12.dp))
                        com.ithrift.app.ui.components.ProgressBar(if (summary.count > 0) c.toFloat() / summary.count else 0f, Modifier.weight(1f), C.marigold)
                        Text("$c", style = T.small, color = C.muted, modifier = Modifier.width(20.dp))
                    }
                }
            }
        }
        if (data.reviews.size > 1) {
            Spacer(Modifier.height(Space.s4))
            Segmented(listOf("new" to "Newest", "high" to "Highest", "low" to "Lowest"), order, { order = it })
        }
        val sorted = when (order) {
            "high" -> data.reviews.sortedByDescending { it.rating }
            "low" -> data.reviews.sortedBy { it.rating }
            else -> data.reviews
        }
        for (r in sorted) {
            Column(Modifier.fillMaxWidth().padding(top = Space.s4)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Stars(r.rating.toDouble(), 14.dp)
                    Text(r.author, style = T.smallStrong, color = C.ink)
                    if (r.verified == true) Pill("Bought this piece", Tone.Good, icon = Lucide.check)
                }
                Text(timeAgo(r.createdAt), style = T.tiny, color = C.muted, modifier = Modifier.padding(top = 2.dp))
                if (!r.comment.isNullOrBlank()) Text(r.comment, style = T.body, color = C.ink2, modifier = Modifier.padding(top = 6.dp))
            }
        }
    } else {
        Text("No reviews yet for this piece.", style = T.body, color = C.muted)
    }
    Spacer(Modifier.height(Space.s4))
    when {
        app.isCustomer -> Btn("Write a review", { writing = true }, style = BtnStyle.Secondary, icon = Lucide.pencil)
        !app.isSignedIn -> LinkText("Sign in to write a review", { app.go(Routes.login(Routes.product(productId))) })
    }
    if (writing) {
        var rating by remember { mutableIntStateOf(0) }
        var comment by remember { mutableStateOf("") }
        var error by remember { mutableStateOf<String?>(null) }
        var busy by remember { mutableStateOf(false) }
        Sheet("Write a review", onDismiss = { writing = false }, footer = {
            Btn("Post review", {
                if (rating == 0) { error = "Choose a rating from 1 to 5."; return@Btn }
                busy = true
                app.run({ safeApiCall { app.api.postReview(productId, ReviewRequest(rating, comment.ifBlank { null })) } }, onDone = { busy = false }, onError = { error = it }) {
                    writing = false
                    app.toast("Review posted. Thank you.", ToastKind.Success)
                    reload()
                }
            }, loading = busy, modifier = Modifier.fillMaxWidth())
        }) {
            Text("Your rating", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                for (n in 1..5) {
                    Box(
                        Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(Radius.md))
                            .clickable(role = Role.RadioButton) { rating = n; error = null }
                            .semantics { contentDescription = "$n out of 5"; stateDescription = if (n <= rating) "Selected" else "Not selected" },
                        contentAlignment = Alignment.Center,
                    ) { Ico(if (n <= rating) Lucide.starFilled else Lucide.star, size = 30.dp, tint = if (n <= rating) C.marigold else C.faint) }
                }
            }
            if (error != null) Text(error!!, style = T.small, color = C.bad, modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(Space.s4))
            Field("What did you think? (optional)", comment, { comment = it }, placeholder = "How was the fit? Was the condition as described?", singleLine = false, maxLength = 600)
        }
    }
}

@Composable
private fun Questions(productId: Int, questions: List<ProductQuestion>, reload: () -> Unit) {
    val app = LocalApp.current
    var text by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Spacer(Modifier.height(Space.s6))
    Hairline(Modifier.padding(bottom = Space.s5))
    SectionHead("Questions")
    if (questions.isEmpty()) {
        Text("No questions yet. Ask about fit, fabric or wear and the store team will answer here.", style = T.body, color = C.muted)
    }
    for (q in questions) {
        Column(Modifier.fillMaxWidth().padding(bottom = Space.s4)) {
            Text(q.question, style = T.bodyStrong, color = C.ink)
            if (q.answer != null) {
                Text(q.answer, style = T.body, color = C.ink2, modifier = Modifier.padding(top = 4.dp))
                Text("iTHRIFT answered ${q.answeredAt?.let { timeAgo(it) } ?: ""}", style = T.tiny, color = C.faint, modifier = Modifier.padding(top = 4.dp))
            } else {
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Ico(Lucide.clock, size = 12.dp, tint = C.faint)
                    Text("Waiting for an answer. Only you can see this until we reply.", style = T.tiny, color = C.faint)
                }
            }
        }
    }
    if (app.isCustomer) {
        Field(
            "Your question",
            text,
            { text = it; error = null },
            placeholder = "Ask about fit, fabric or wear",
            error = error,
            maxLength = 300,
            imeAction = androidx.compose.ui.text.input.ImeAction.Send,
        )
        Btn("Ask", {
            busy = true
            app.run({ safeApiCall { app.api.askQuestion(productId, QuestionRequest(text.trim())) } }, onDone = { busy = false }, onError = { error = it }) {
                text = ""
                app.toast("Question sent. We will notify you when the store replies.", ToastKind.Success)
                reload()
            }
        }, icon = Lucide.send, loading = busy)
    } else if (!app.isSignedIn) {
        LinkText("Sign in to ask a question", { app.go(Routes.login(Routes.product(productId))) })
    }
}

/** The full-screen photo: pinch or double tap to zoom, drag to look around. */
@Composable
fun Lightbox(path: String, description: String, onDismiss: () -> Unit) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val state = rememberTransformableState { zoom, pan, _ ->
        scale = (scale * zoom).coerceIn(1f, 4f)
        offset = if (scale == 1f) Offset.Zero else offset + pan
    }
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.92f))) {
            RemoteImage(
                path,
                Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTapGestures(onDoubleTap = {
                            if (scale > 1f) { scale = 1f; offset = Offset.Zero } else scale = 2.5f
                        })
                    }
                    .transformable(state)
                    .graphicsLayer(scaleX = scale, scaleY = scale, translationX = offset.x, translationY = offset.y),
                ContentScale.Fit,
                description,
            )
            CloseCircle(onDismiss, Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(Space.s4))
            Text(
                "Pinch or double tap to zoom. Drag to look around.",
                style = T.small,
                color = Color.White.copy(alpha = 0.8f),
                modifier = Modifier.align(Alignment.BottomCenter).padding(Space.s6),
            )
        }
    }
}

/* ----------------------------- Size guide ----------------------------- */

private data class Guide(val label: String, val title: String, val head: List<String>, val rows: List<List<String>>)

private val SIZE_GUIDE = linkedMapOf(
    "apparel" to Guide(
        "Tops", "Tops, knitwear, jackets and dresses", listOf("Size", "Chest (cm)", "Waist (cm)", "Hips (cm)"),
        listOf(
            listOf("XS", "82 to 86", "66 to 70", "88 to 92"), listOf("S", "87 to 92", "71 to 76", "93 to 98"), listOf("M", "93 to 100", "77 to 84", "99 to 106"),
            listOf("L", "101 to 108", "85 to 92", "107 to 114"), listOf("XL", "109 to 116", "93 to 100", "115 to 122"), listOf("XXL", "117 to 124", "101 to 108", "123 to 130"),
        ),
    ),
    "footwear" to Guide(
        "Shoes", "Shoes", listOf("UK", "EU", "Foot length (cm)"),
        listOf(
            listOf("UK 3", "36", "22.0"), listOf("UK 4", "37", "22.9"), listOf("UK 5", "38", "23.7"), listOf("UK 6", "39", "24.6"),
            listOf("UK 7", "40.5", "25.4"), listOf("UK 8", "42", "26.2"), listOf("UK 9", "43", "27.1"), listOf("UK 10", "44.5", "27.9"),
        ),
    ),
    "waist" to Guide(
        "Waist", "Trousers and jeans", listOf("Waist size", "Waist (cm)", "Waist (inches)"),
        listOf(
            listOf("28", "71", "28"), listOf("30", "76", "30"), listOf("32", "81", "32"), listOf("34", "86", "34"), listOf("36", "91", "36"),
            listOf("38", "97", "38"), listOf("40", "102", "40"), listOf("42", "107", "42"), listOf("44", "112", "44"),
        ),
    ),
)

fun guideKeyFor(category: String?) = when (category) {
    "Footwear" -> "footwear"
    "Trousers", "Jeans" -> "waist"
    else -> "apparel"
}

/** The size charts, with the customer's own size highlighted. */
@Composable
fun SizeGuideContent(initial: String = "apparel", mine: String? = null) {
    var key by remember { mutableStateOf(initial) }
    Segmented(SIZE_GUIDE.map { (k, g) -> k to g.label }, key, { key = it }, Modifier.fillMaxWidth())
    val g = SIZE_GUIDE.getValue(key)
    Text(g.title, style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s4, bottom = Space.s2))
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.md)).border(1.dp, C.hairline, RoundedCornerShape(Radius.md))) {
        Row(Modifier.fillMaxWidth().background(C.surface2).padding(horizontal = Space.s3, vertical = 10.dp)) {
            for (h in g.head) Text(h, style = T.smallStrong, color = C.ink, modifier = Modifier.weight(1f))
        }
        for (r in g.rows) {
            val isMine = mine != null && r[0] == mine
            Hairline()
            Row(Modifier.fillMaxWidth().background(if (isMine) C.pineSoft else C.surface).padding(horizontal = Space.s3, vertical = 10.dp)) {
                r.forEachIndexed { i, c ->
                    Text(c, style = if (i == 0) T.smallStrong else T.small, color = C.ink, modifier = Modifier.weight(1f))
                }
            }
        }
    }
    Text(
        "Measure your body, not a garment. Second-hand pieces can have shrunk or stretched a little, so the description notes anything that fits differently from its label.",
        style = T.small,
        color = C.muted,
        modifier = Modifier.padding(top = Space.s4),
    )
}
