package com.ithrift.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.OrderListItem
import com.ithrift.app.data.SellRequest
import com.ithrift.app.data.SellRespondRequest
import com.ithrift.app.data.SellSubmission
import com.ithrift.app.data.StatusRequest
import com.ithrift.app.data.SupportCreateRequest
import com.ithrift.app.data.SupportMessageRequest
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
import com.ithrift.app.ui.components.ConditionMeter
import com.ithrift.app.ui.components.ConfirmDialog
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.IconTile
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.ListCard
import com.ithrift.app.ui.components.ListRow
import com.ithrift.app.ui.components.OptionCard
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.SearchBox
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.StatusPill
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.components.Wrap
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.dateLabel
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.timeAgo

/* ----------------------------- Sell to us ----------------------------- */

private val SELL_STEPS = listOf("Submitted", "Offer made", "Accepted", "Received", "Paid")

@Composable
fun SellScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<SellSubmission>>(app.user?.id) {
        if (!app.isCustomer) ApiOutcome.Success(emptyList()) else when (val r = safeApiCall { app.api.sellSubmissions() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.submissions)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Sell to us") {
        PageHead("Sell your clothes to iTHRIFT", sub = "We buy branded pieces in good condition. Tell us about one and we reply with an offer within two working days.")
        if (app.isCustomer) SellForm { load.set(it) }
        else if (!app.isSignedIn) Panel {
            EmptyState(
                Lucide.handCoins, "Sign in to sell to us", "You need an account so we can send you the offer and pay you.",
                actionLabel = "Sign in", onAction = { app.go(Routes.login(Routes.SELL)) },
                secondaryLabel = "Create an account", onSecondary = { app.go(Routes.register(Routes.SELL)) },
            )
        }
        Spacer(Modifier.height(Space.s4))
        Panel {
            Text("How it works", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
            TimelineItem("Tell us about it", "Brand, size, condition and any wear.")
            TimelineItem("Get an offer", "Within two working days, in your notifications.")
            TimelineItem("Accept and drop it off", "At Hatfield Plaza, any weekday.")
            TimelineItem("Get paid", "By EFT, or as Thrift Points with 20 percent extra.", last = true)
            Text("We take Excellent, Very Good and Good pieces from most high-street and sports brands.", style = T.small, color = C.muted)
        }
        val subs = load.data.orEmpty()
        if (subs.isNotEmpty()) {
            Text("Your pieces", style = T.h2, color = C.ink, modifier = Modifier.padding(top = Space.s6, bottom = Space.s3).semantics { heading() })
            ListCard {
                subs.forEachIndexed { i, s ->
                    if (i > 0) Hairline()
                    SellRow(s) { load.set(it) }
                }
            }
        }
    }
}

@Composable
private fun SellForm(onSent: (List<SellSubmission>) -> Unit) {
    val app = LocalApp.current
    var brand by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }
    var size by remember { mutableStateOf("") }
    var asking by remember { mutableStateOf("") }
    var condition by remember { mutableStateOf<String?>(null) }
    var description by remember { mutableStateOf("") }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var busy by remember { mutableStateOf(false) }
    var pickCategory by remember { mutableStateOf(false) }
    Panel {
        Text("Offer us a piece", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s4))
        Field("Brand", brand, { brand = it }, error = errors["brand"], placeholder = "Nike, Zara, Levi's", maxLength = 40)
        Text("Category", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        OptionCard(category != null, { pickCategory = true }, category ?: "Choose", sub = errors["category"])
        Spacer(Modifier.height(Space.s4))
        Field("Size", size, { size = it }, error = errors["size"], placeholder = "M, UK 8 or 32", maxLength = 20)
        Field("What you hope to get (optional)", asking, { asking = it.filter(Char::isDigit) }, placeholder = "R", keyboardType = KeyboardType.Number)
        Text("Condition", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
        if (errors["condition"] != null) Text(errors["condition"]!!, style = T.small, color = C.bad, modifier = Modifier.padding(bottom = 6.dp))
        for ((name, v) in CONDITIONS) {
            OptionCard(condition == name, { condition = name }, name, sub = v.second, modifier = Modifier.padding(bottom = Space.s2), extra = {
                ConditionMeter(name, label = false, modifier = Modifier.padding(top = 6.dp))
            })
        }
        Spacer(Modifier.height(Space.s3))
        Field("Describe it", description, { description = it }, error = errors["description"], placeholder = "Colour, fit, how often it was worn, and any marks or fading", singleLine = false, maxLength = 500)
        Btn("Send for an offer", {
            val e = mutableMapOf<String, String>()
            if (brand.isBlank()) e["brand"] = "Tell us the brand."
            if (category == null) e["category"] = "Choose a category."
            if (size.isBlank()) e["size"] = "Tell us the size on the label."
            if (condition == null) e["condition"] = "Choose the condition that fits best."
            if (description.trim().length < 15) e["description"] = "Tell us a bit more, including any wear (at least 15 characters)."
            errors = e
            if (e.isNotEmpty()) return@Btn
            busy = true
            app.run({ safeApiCall { app.api.sell(SellRequest(brand.trim(), category!!, size.trim(), condition!!, description.trim(), asking.toDoubleOrNull())) } }, onDone = { busy = false }) { r ->
                brand = ""; category = null; size = ""; asking = ""; condition = null; description = ""
                onSent(r.submissions)
                app.toast("Sent. We will reply with an offer within two working days.", ToastKind.Success)
            }
        }, large = true, loading = busy, modifier = Modifier.fillMaxWidth())
        Text("Bring the piece to the Hatfield store once you accept. We check it there before paying.", style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s3))
    }
    if (pickCategory) {
        Sheet("Category", onDismiss = { pickCategory = false }) {
            for (c in app.categories) OptionCard(category == c.name, { category = c.name; pickCategory = false }, c.name, modifier = Modifier.padding(bottom = Space.s2))
        }
    }
}

@Composable
private fun SellRow(s: SellSubmission, onChange: (List<SellSubmission>) -> Unit) {
    val app = LocalApp.current
    var declining by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf<String?>(null) }
    fun respond(accept: Boolean, payout: String?) {
        busy = payout ?: "decline"
        app.run({ safeApiCall { app.api.respondToOffer(s.id, SellRespondRequest(accept, payout)) } }, onDone = { busy = null }) { r ->
            onChange(r.submissions)
            app.toast(if (accept) "Offer accepted. Bring the piece to the store." else "Offer declined.", if (accept) ToastKind.Success else ToastKind.Plain)
        }
    }
    Row(Modifier.fillMaxWidth().padding(Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
        IconTile(categoryIcon(s.category))
        Column(Modifier.weight(1f)) {
            Wrap(spacing = 6.dp) {
                Text("${s.brand} ${s.category.lowercase()}, ${s.size}", style = T.bodyStrong, color = C.ink)
                StatusPill(s.status)
            }
            Text("${s.ref}, sent ${dateLabel(s.createdAt)}. ${s.condition}." + (s.askingPrice?.let { " You asked ${formatMoney(it)}." } ?: ""), style = T.small, color = C.muted, modifier = Modifier.padding(top = 4.dp))
            if (!s.staffNote.isNullOrBlank()) Text(s.staffNote, style = T.small, color = C.ink, modifier = Modifier.padding(top = 6.dp))
            if (s.status != "Declined") Tracker(SELL_STEPS, SELL_STEPS.indexOf(s.status), Modifier.padding(top = Space.s3))
            if (s.status == "Offer made" && s.offerAmount != null) {
                val pts = s.pointsOffer ?: 0
                Callout(
                    "We offer ${formatMoney(s.offerAmount)} by EFT, or $pts Thrift Points (worth ${formatMoney((pts / 100) * 10.0)} in store).",
                    tone = Tone.Info, icon = Lucide.handCoins, modifier = Modifier.padding(top = Space.s3),
                )
                Wrap(Modifier.padding(top = Space.s3)) {
                    Btn("Take $pts points", { respond(true, "points") }, small = true, loading = busy == "points")
                    Btn("Take ${formatMoney(s.offerAmount)} by EFT", { respond(true, "eft") }, style = BtnStyle.Secondary, small = true, loading = busy == "eft")
                    Btn("Decline", { declining = true }, style = BtnStyle.Ghost, small = true)
                }
            }
            if (s.status == "Accepted") {
                Text("Bring it to the Hatfield store with reference ${s.ref}. You chose ${if (s.payoutMethod == "points") "Thrift Points" else "EFT"}.", style = T.small, color = C.ink, modifier = Modifier.padding(top = Space.s2))
            }
        }
    }
    if (declining) {
        ConfirmDialog("Decline this offer?", "You can offer us the piece again later.", "Decline offer", onConfirm = { respond(false, null) }, onDismiss = { declining = false }, danger = true)
    }
}

/* ----------------------------- Help centre ----------------------------- */

private val FAQ = listOf(
    Triple("delivery", "Delivery and collection", listOf(
        "How much is delivery?" to "Standard delivery is R80 and takes 3 to 5 working days. It is free when the goods come to R1,000 or more after discounts. Express is R150 and takes 1 to 2 working days. Collection from the Hatfield store is free.",
        "How do I collect from the store?" to "Choose Collect from the Pretoria store at checkout, then pick a day and a two-hour slot. Bring your order number. The store is in Hatfield Plaza, Burnett Street.",
        "Which days count as working days?" to "Monday to Friday, except South African public holidays. The dates shown at checkout already skip weekends and holidays.",
    )),
    Triple("buying", "Buying", listOf(
        "Does adding to my bag hold a piece?" to "No. Most pieces are one of a kind, so stock is only reserved when you place the order. If someone checks out first, your bag will say the piece has gone.",
        "What do the condition grades mean?" to "Excellent is as new. Very Good is lightly worn with no marks. Good is worn, with small marks or fading noted in the description. Fair has visible wear and is priced to match.",
        "Can I pay by EFT?" to "Yes. Use your order number as the reference. We start packing once the money clears.",
        "How do promo codes and Thrift Points work together?" to "Apply the promo code first, then choose how many points to spend. Points come off in blocks of 100 for R10.",
    )),
    Triple("returns", "Returns and cancelling", listOf(
        "Can I cancel an order?" to "Yes, until it ships. Open the order and choose Cancel this order. Paid orders are refunded and any points you spent come back.",
        "How do I return something?" to "You have 30 days from delivery. Open the order, choose Return this piece and tell us why. Follow it under Account, then Returns.",
        "When do I get my money back?" to "Once the piece is back with us and has been checked, usually within 3 working days.",
    )),
    Triple("selling", "Selling to iTHRIFT", listOf(
        "What do you buy?" to "Branded clothing, shoes and accessories in Good condition or better. We reply to every piece with an offer or a reason.",
        "How am I paid?" to "By EFT, or as Thrift Points worth 20 percent more. You choose when you accept the offer.",
    )),
    Triple("account", "Your account", listOf(
        "I signed up with Google. How do I sign in?" to "Use Continue with Google on the sign-in screen. There is no password on your iTHRIFT account to type.",
        "How do I stop notifications?" to "Account, then Settings. You can switch off order updates and shopping alerts separately.",
        "How do I delete my account?" to "Account, then Settings, then Delete my account. Your personal details are erased at once and you are signed out everywhere. Your orders stay in our records without your name, as the law requires. The privacy policy is at ithrift-api.onrender.com/#/privacy.",
        "Which server does the app use?" to "The hosted iTHRIFT server, the same one the website uses. You can point it at another server under Account, Settings, Connection.",
    )),
)

@Composable
fun HelpScreen(section: String) {
    val app = LocalApp.current
    val context = LocalContext.current
    var q by remember { mutableStateOf("") }
    var open by remember { mutableStateOf(setOf<String>()) }
    var showGrades by remember { mutableStateOf(false) }
    val needle = q.trim().lowercase()
    Screen("Help") {
        PageHead("How can we help?")
        SearchBox(q, { q = it }, placeholder = "Search the answers, for example returns")
        Spacer(Modifier.height(Space.s3))
        Wrap {
            Btn("Message us", { app.go(Routes.contact()) }, icon = Lucide.messageSquare, small = true)
            if (app.isCustomer) Btn("Your conversations", { app.go(Routes.MESSAGES) }, style = BtnStyle.Secondary, small = true)
            Btn("Size guide", { app.go(Routes.SIZE_GUIDE) }, style = BtnStyle.Secondary, small = true, icon = Lucide.ruler)
            Btn("How we grade condition", { showGrades = true }, style = BtnStyle.Secondary, small = true)
        }
        var any = false
        for ((id, title, qs) in FAQ.sortedBy { if (it.first == section) 0 else 1 }) {
            val shown = qs.filter { (question, answer) -> needle.isEmpty() || "$question $answer".lowercase().contains(needle) }
            if (shown.isEmpty()) continue
            any = true
            Text(title, style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s5, bottom = Space.s2).semantics { heading() })
            ListCard {
                shown.forEachIndexed { i, (question, answer) ->
                    if (i > 0) Hairline()
                    val expanded = needle.isNotEmpty() || question in open || (id == section && i == 0 && open.isEmpty())
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clickable(role = Role.Button) { open = if (question in open) open - question else open + question }
                            .semantics { stateDescription = if (expanded) "Expanded" else "Collapsed" }
                            .padding(Space.s4),
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(question, style = T.body.copy(fontWeight = androidx.compose.ui.text.font.FontWeight.Medium), color = C.ink, modifier = Modifier.weight(1f))
                            Ico(if (expanded) Lucide.chevronUp else Lucide.chevronDown, size = 18.dp, tint = C.faint)
                        }
                        if (expanded) Text(answer, style = T.body, color = C.ink2, modifier = Modifier.padding(top = Space.s2))
                    }
                }
            }
        }
        if (!any) {
            EmptyState(Lucide.search, "No answer matches that", "Send us a message and the store team will reply, usually the same working day.", actionLabel = "Message us", onAction = { app.go(Routes.contact()) })
        }
        Spacer(Modifier.height(Space.s5))
        Panel {
            Text("Other ways to reach us", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
            Text("Monday to Friday 09:00 to 17:00. Have your order number ready.", style = T.body, color = C.muted)
            Wrap(Modifier.padding(top = Space.s3)) {
                Btn("Call 012 345 6789", { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:0123456789"))) }, style = BtnStyle.Secondary, small = true, icon = Lucide.phone)
                Btn("Email support", { context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@ithrift.co.za"))) }, style = BtnStyle.Secondary, small = true, icon = Lucide.mail)
            }
        }
    }
    if (showGrades) ConditionGuideSheet { showGrades = false }
}

@Composable
fun SizeGuideScreen() {
    Screen("Size guide") {
        PageHead("Size guide")
        Panel { SizeGuideContent() }
    }
}

/* ----------------------------- Contact and messages ----------------------------- */

@Composable
fun ContactScreen(orderId: Int?) {
    val app = LocalApp.current
    val orders = rememberLoad<List<OrderListItem>>(app.user?.id) {
        if (!app.isCustomer) ApiOutcome.Success(emptyList()) else when (val r = safeApiCall { app.api.getOrders() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.orders)
            is ApiOutcome.Failure -> r
        }
    }
    var topic by remember { mutableStateOf(if (orderId != null) "Order" else "Order") }
    var order by remember { mutableStateOf(orderId) }
    var subject by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var pickOrder by remember { mutableStateOf(false) }
    Screen("Message us") {
        CustomerOnly(Routes.contact(orderId), "messages with the store") {
            PageHead("Message us", sub = "The store team replies in your notifications, usually the same working day.")
            Panel {
                if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3))
                Text("About", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
                Wrap(Modifier.padding(bottom = Space.s4)) {
                    for (t in listOf("Order", "Return", "Selling", "Account", "Other")) {
                        com.ithrift.app.ui.components.Chip(t, topic == t, { topic = t })
                    }
                }
                Text("Order (optional)", style = T.smallStrong, color = C.ink, modifier = Modifier.padding(bottom = 6.dp))
                val chosen = orders.data?.firstOrNull { it.id == order }
                OptionCard(chosen != null, { pickOrder = true }, chosen?.let { "${it.ref}, ${dateLabel(it.createdAt)}" } ?: "None")
                Spacer(Modifier.height(Space.s4))
                Field("Subject", subject, { subject = it }, error = errors["subject"], maxLength = 80)
                Field("Message", message, { message = it }, error = errors["message"], singleLine = false, maxLength = 1000)
                Btn("Send message", {
                    val e = mutableMapOf<String, String>()
                    if (subject.trim().length < 4) e["subject"] = "Add a short subject."
                    if (message.trim().length < 10) e["message"] = "Tell us a little more (at least 10 characters)."
                    errors = e
                    if (e.isNotEmpty()) return@Btn
                    busy = true
                    app.run({ safeApiCall { app.api.createTicket(SupportCreateRequest(topic, subject.trim(), message.trim(), order)) } }, onDone = { busy = false }, onError = { formError = it }) { r ->
                        app.toast("Message sent. We will reply in your notifications.", ToastKind.Success)
                        app.nav.navigate(Routes.thread(r.ticket.id)) { popUpTo(Routes.MESSAGES) { inclusive = false } }
                    }
                }, icon = Lucide.send, loading = busy, modifier = Modifier.fillMaxWidth())
            }
        }
    }
    if (pickOrder) {
        Sheet("Which order?", onDismiss = { pickOrder = false }) {
            OptionCard(order == null, { order = null; pickOrder = false }, "None", modifier = Modifier.padding(bottom = Space.s2))
            for (o in orders.data.orEmpty()) {
                OptionCard(order == o.id, { order = o.id; pickOrder = false }, o.ref, sub = "${dateLabel(o.createdAt)}, ${o.status}", modifier = Modifier.padding(bottom = Space.s2))
            }
        }
    }
}

@Composable
fun MessagesScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<SupportTicket>>(app.user?.id) {
        when (val r = safeApiCall { app.api.tickets() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.tickets)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Messages", actions = {
        if (app.isCustomer) Btn("New", { app.go(Routes.contact()) }, small = true, icon = Lucide.plus, modifier = Modifier.padding(end = 4.dp))
    }) {
        CustomerOnly(Routes.MESSAGES, "your messages") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Messages")
                    if (s.data.isEmpty()) {
                        EmptyState(Lucide.messageSquare, "No messages yet", "Ask about an order, a return or selling to us.", actionLabel = "Message us", onAction = { app.go(Routes.contact()) })
                    } else TicketList(s.data, staff = false)
                }
            }
        }
    }
}

@Composable
fun TicketList(tickets: List<SupportTicket>, staff: Boolean) {
    val app = LocalApp.current
    ListCard {
        tickets.forEachIndexed { i, t ->
            ListRow(
                t.subject,
                sub = (if (staff) "${t.customer}, " else "") + t.topic + (t.orderRef?.let { ", $it" } ?: "") + ". " + (t.lastMessage ?: "").take(70),
                icon = Lucide.messageSquare,
                iconTone = when {
                    staff && t.status == "Open" -> Tone.Sale
                    t.status == "Answered" -> Tone.Pine
                    else -> Tone.Neutral
                },
                divider = i > 0,
                chevron = false,
                onClick = { app.go(Routes.thread(t.id)) },
                trailing = {
                    Column(horizontalAlignment = Alignment.End) {
                        StatusPill(t.status)
                        Text(timeAgo(t.updatedAt), style = T.tiny, color = C.muted, modifier = Modifier.padding(top = 4.dp))
                    }
                },
            )
        }
    }
}

/** One conversation with the store. Customers and staff both use it; each sees their own messages on the right. */
@Composable
fun ThreadScreen(id: Int) {
    val app = LocalApp.current
    val load = rememberLoad<SupportTicket>(id) {
        when (val r = safeApiCall { app.api.ticket(id) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.ticket)
            is ApiOutcome.Failure -> r
        }
    }
    val staff = app.isStaff
    val mine = if (staff) "staff" else "customer"
    var reply by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val t = load.data
    Screen(
        t?.subject ?: "Conversation",
        bottom = if (t != null && (t.status != "Closed" || staff)) {
            {
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                    Field("Reply", reply, { reply = it }, Modifier.weight(1f), placeholder = "Write a reply", singleLine = false, maxLength = 1000)
                    Btn("Send", {
                        if (reply.trim().length < 2) return@Btn
                        busy = true
                        app.run({ safeApiCall { app.api.reply(t.id, SupportMessageRequest(reply.trim())) } }, onDone = { busy = false }) { r ->
                            reply = ""
                            load.set(r.ticket)
                            if (staff) app.toast("Reply sent. The customer has been notified.", ToastKind.Success)
                        }
                    }, icon = Lucide.send, loading = busy, modifier = Modifier.padding(bottom = Space.s4))
                }
            }
        } else null,
    ) {
        when (val s = load.state) {
            is Load.Loading -> SkeletonPage()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> {
                val ticket = s.data
                Text(ticket.subject, style = T.h1.copy(fontSize = 24.sp), color = C.ink)
                Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${ticket.ref}, ${ticket.topic}" + (if (staff) ", from ${ticket.customer}" else ""), style = T.small, color = C.muted)
                    if (ticket.orderRef != null && ticket.orderId != null) {
                        Text(", ", style = T.small, color = C.muted)
                        LinkText(ticket.orderRef, { app.go(Routes.order(ticket.orderId)) })
                    }
                }
                Row(Modifier.padding(top = Space.s3, bottom = Space.s4), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                    StatusPill(ticket.status)
                    if (ticket.status != "Closed") {
                        Btn("Mark as sorted", {
                            app.run({ safeApiCall { app.api.setTicketStatus(ticket.id, StatusRequest("Closed")) } }) { r ->
                                load.set(r.ticket)
                                app.toast("Marked as sorted.", ToastKind.Success)
                            }
                        }, style = BtnStyle.Secondary, small = true)
                    } else if (staff) {
                        Btn("Reopen", { app.run({ safeApiCall { app.api.setTicketStatus(ticket.id, StatusRequest("Open")) } }) { r -> load.set(r.ticket) } }, style = BtnStyle.Secondary, small = true)
                    }
                }
                for (m in ticket.messages.orEmpty()) {
                    val isMine = m.sender == mine
                    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp), contentAlignment = if (isMine) Alignment.CenterEnd else Alignment.CenterStart) {
                        Column(
                            Modifier
                                .widthIn(max = 300.dp)
                                .clip(RoundedCornerShape(topStart = 18.dp, topEnd = 18.dp, bottomStart = if (isMine) 18.dp else 4.dp, bottomEnd = if (isMine) 4.dp else 18.dp))
                                .background(if (isMine) C.pine else C.surface)
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                        ) {
                            Text(m.body, style = T.body, color = if (isMine) C.onPine else C.ink)
                            Text("${if (isMine) "You" else m.author}, ${timeAgo(m.createdAt)}", style = T.tiny, color = if (isMine) C.onPine.copy(alpha = 0.8f) else C.muted, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
                if (ticket.status == "Closed" && !staff) {
                    Row(Modifier.padding(top = Space.s4), verticalAlignment = Alignment.CenterVertically) {
                        Text("This conversation is closed. ", style = T.small, color = C.muted)
                        LinkText("Start a new one", { app.go(Routes.contact()) })
                    }
                }
            }
        }
    }
}
