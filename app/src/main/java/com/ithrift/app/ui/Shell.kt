package com.ithrift.app.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import com.ithrift.app.ui.components.CountBadge
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.IconBtn
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T

/**
 * Every screen's address. They follow the website's hash routes, so a link
 * the API sends in a notification ("/orders/22", "/product/34") can be
 * opened here with [Routes.fromWebPath].
 */
object Routes {
    const val HOME = "home"
    const val SHOP = "shop?f={f}"
    const val SEARCH = "search"
    const val PRODUCT = "product/{id}"
    const val COMPARE = "compare"
    const val BAG = "bag"
    const val CHECKOUT = "checkout"
    const val PLACED = "placed/{id}"
    const val WISHLIST = "wishlist"
    const val ORDERS = "orders"
    const val ORDER = "order/{id}"
    const val RECEIPT = "receipt/{id}?gift={gift}"
    const val RETURNS = "returns"
    const val ACCOUNT = "account"
    const val SETTINGS = "settings"
    const val STYLE = "style"
    const val POINTS = "points"
    const val SAVED = "saved"
    const val ALERTS = "alerts"
    const val NOTIFICATIONS = "notifications"
    const val ADDRESSES = "addresses?pick={pick}"
    const val SELL = "sell"
    const val HELP = "help?section={section}"
    const val SIZE_GUIDE = "sizeguide"
    const val CONTACT = "contact?order={order}"
    const val MESSAGES = "messages"
    const val THREAD = "thread/{id}"
    const val LOGIN = "login?next={next}"
    const val REGISTER = "register?next={next}"
    const val WELCOME = "welcome?next={next}"
    const val ABOUT = "about"

    // Staff console
    const val CONSOLE = "console"
    const val STAFF_ORDERS = "staff/orders?status={status}"
    const val STAFF_COLLECTIONS = "staff/collections"
    const val STAFF_RETURNS = "staff/returns"
    const val STAFF_QUESTIONS = "staff/questions"
    const val STAFF_SELL = "staff/sell"
    const val STAFF_SUPPORT = "staff/support"
    const val STAFF_LISTINGS = "staff/listings"
    const val STAFF_INVENTORY = "staff/inventory"
    const val STAFF_PROMOS = "staff/promos"
    const val STAFF_CUSTOMERS = "staff/customers"

    private fun enc(s: String) = Uri.encode(s)

    fun shop(filters: Map<String, String> = emptyMap()): String =
        "shop?f=" + enc(filters.filterValues { it.isNotBlank() }.entries.joinToString("&") { "${enc(it.key)}=${enc(it.value)}" })
    fun product(id: Int) = "product/$id"
    fun placed(id: Int) = "placed/$id"
    fun order(id: Int) = "order/$id"
    fun receipt(id: Int, gift: Boolean = false) = "receipt/$id?gift=$gift"
    fun addresses(pick: Boolean = false) = "addresses?pick=$pick"
    fun help(section: String = "") = "help?section=$section"
    fun contact(orderId: Int? = null) = "contact?order=${orderId ?: ""}"
    fun thread(id: Int) = "thread/$id"
    fun login(next: String = "") = "login?next=${enc(next)}"
    fun register(next: String = "") = "register?next=${enc(next)}"
    fun welcome(next: String = "") = "welcome?next=${enc(next)}"
    fun staffOrders(status: String = "") = "staff/orders?status=$status"

    /** Parses the "f" argument of the shop route back into filters. */
    fun parseFilters(f: String?): Map<String, String> {
        if (f.isNullOrBlank()) return emptyMap()
        return f.split("&").mapNotNull { pair ->
            val i = pair.indexOf('=')
            if (i <= 0) null else Uri.decode(pair.substring(0, i)) to Uri.decode(pair.substring(i + 1))
        }.toMap()
    }

    /** A website path from the API ("/orders/22") as an app route, or null when there is no match. */
    fun fromWebPath(path: String?): String? {
        if (path.isNullOrBlank()) return null
        val clean = path.removePrefix("#").removePrefix("/")
        val (p, query) = clean.split("?", limit = 2).let { it[0] to it.getOrNull(1) }
        val parts = p.split("/").filter { it.isNotEmpty() }
        return when {
            parts.isEmpty() -> HOME
            parts[0] == "product" && parts.size > 1 -> parts[1].toIntOrNull()?.let { product(it) }
            parts[0] == "orders" && parts.size > 1 -> parts[1].toIntOrNull()?.let { order(it) }
            parts[0] == "orders" -> ORDERS
            parts[0] == "help" && parts.getOrNull(1) == "messages" && parts.size > 2 -> parts[2].toIntOrNull()?.let { thread(it) }
            parts[0] == "help" && parts.getOrNull(1) == "messages" -> MESSAGES
            parts[0] == "help" -> help()
            parts[0] == "account" && parts.getOrNull(1) == "points" -> POINTS
            parts[0] == "account" && parts.getOrNull(1) == "saved" -> SAVED
            parts[0] == "account" && parts.getOrNull(1) == "alerts" -> ALERTS
            parts[0] == "account" && parts.getOrNull(1) == "style" -> STYLE
            parts[0] == "account" && parts.getOrNull(1) == "settings" -> SETTINGS
            parts[0] == "account" -> ACCOUNT
            parts[0] == "sell" -> SELL
            parts[0] == "wishlist" -> WISHLIST
            parts[0] == "returns" -> RETURNS
            parts[0] == "notifications" -> NOTIFICATIONS
            parts[0] == "cart" -> BAG
            parts[0] == "shop" -> shop(parseFilters(query))
            else -> null
        }
    }
}

/** The five tabs, as the website's phone tab bar. */
private data class Tab(val route: String, val key: String, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val count: Int = 0)

/** Which tab a screen belongs to, so the right one stays lit. */
private fun tabFor(route: String?): String = when {
    route == null -> "home"
    route.startsWith("staff/orders") -> "staff-orders"
    route.startsWith("console") || route.startsWith("staff/") -> "console"
    route.startsWith("search") -> "search"
    route.startsWith("bag") || route.startsWith("checkout") -> "bag"
    route.startsWith("order") || route.startsWith("receipt") || route.startsWith("returns") || route.startsWith("placed") -> "orders"
    route.startsWith("home") || route.startsWith("shop") || route.startsWith("product") || route.startsWith("compare") -> "home"
    else -> "account"
}

@Composable
fun TabBar(app: AppState) {
    val entry by app.nav.currentBackStackEntryAsState()
    val current = tabFor(entry?.destination?.route).let { if (app.isStaff && it == "orders") "staff-orders" else it }
    val tabs = if (app.isStaff) listOf(
        Tab(Routes.HOME, "home", "Shop", Lucide.house),
        Tab(Routes.SEARCH, "search", "Search", Lucide.search),
        Tab(Routes.CONSOLE, "console", "Console", Lucide.clipboardList),
        Tab(Routes.staffOrders(), "staff-orders", "Orders", Lucide.packageIcon),
        Tab(Routes.ACCOUNT, "account", "Account", Lucide.user),
    ) else listOf(
        Tab(Routes.HOME, "home", "Shop", Lucide.house),
        Tab(Routes.SEARCH, "search", "Search", Lucide.search),
        Tab(Routes.BAG, "bag", "Bag", Lucide.shoppingBag, app.cartCount),
        Tab(Routes.ORDERS, "orders", "Orders", Lucide.packageIcon),
        Tab(if (app.isSignedIn) Routes.ACCOUNT else Routes.login(), "account", if (app.isSignedIn) "Account" else "Sign in", Lucide.user),
    )
    Column(Modifier.fillMaxWidth().background(C.paper.copy(alpha = 0.97f))) {
        Hairline()
        Row(Modifier.fillMaxWidth().height(64.dp), verticalAlignment = Alignment.CenterVertically) {
            for (tab in tabs) {
                val on = tab.key == current
                Column(
                    Modifier
                        .weight(1f)
                        .height(64.dp)
                        .clickable(role = Role.Tab) {
                            app.nav.navigate(tab.route) {
                                popUpTo(app.nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                        .semantics {
                            selected = on
                            contentDescription = if (tab.count > 0) "${tab.label}, ${tab.count}" else tab.label
                        },
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    Box {
                        Ico(tab.icon, size = 24.dp, tint = if (on) C.pine else C.faint)
                        if (tab.count > 0) CountBadge(tab.count, modifier = Modifier.align(Alignment.TopEnd).offset(x = 12.dp, y = (-6).dp))
                    }
                    Spacer(Modifier.height(3.dp))
                    Text(tab.label, style = T.tiny.copy(fontSize = 11.sp, fontWeight = FontWeight.Medium), color = if (on) C.pine else C.faint)
                }
            }
        }
        Spacer(Modifier.navigationBarsPadding())
    }
}

/** The logo: the pine "i" tile and the word mark, as on the website's header. */
@Composable
fun Logo(modifier: Modifier = Modifier) {
    Row(modifier.semantics(mergeDescendants = true) { contentDescription = "iTHRIFT, home" }, verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(30.dp).clip(RoundedCornerShape(9.dp)).background(C.pine), contentAlignment = Alignment.Center) {
            Text("i", style = T.bodyStrong.copy(fontWeight = FontWeight.Bold), color = C.onPine)
        }
        Spacer(Modifier.width(10.dp))
        Text("iTHRIFT", style = T.h3.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.5).sp), color = C.ink)
    }
}

/**
 * The top of every screen. Tab screens show the logo with search and the
 * bell, like the website's phone header; deeper screens show a back button
 * and the screen's title.
 */
@Composable
fun TopBar(app: AppState, title: String?, back: Boolean, actions: @Composable RowScope.() -> Unit = {}) {
    Column(Modifier.fillMaxWidth().background(C.paper.copy(alpha = 0.97f)).statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (back) {
                IconBtn(Lucide.chevronLeft, "Back", { app.back() })
                Text(
                    title ?: "",
                    style = T.h3,
                    color = C.ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f).padding(horizontal = 4.dp).semantics { heading() },
                )
            } else {
                Logo(Modifier.padding(start = 10.dp).clip(RoundedCornerShape(8.dp)).clickable(role = Role.Button) { app.go(Routes.HOME) })
                Spacer(Modifier.weight(1f))
            }
            actions()
            if (!back) {
                IconBtn(Lucide.search, "Search", { app.go(Routes.SEARCH) })
                if (app.isCustomer) {
                    IconBtn(Lucide.bell, "Notifications", { app.go(Routes.NOTIFICATIONS) }, badge = app.unread, alertBadge = true)
                }
            }
        }
        Hairline()
    }
}

/**
 * One screen: the top bar, then the content scrolling under it. Lazy lists
 * pass [scroll] = false and scroll themselves.
 */
@Composable
fun Screen(
    title: String? = null,
    back: Boolean = true,
    scroll: Boolean = true,
    padded: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {},
    bottom: (@Composable () -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val app = LocalApp.current
    Column(Modifier.fillMaxSize().background(C.paper)) {
        TopBar(app, title, back, actions)
        Box(Modifier.weight(1f).fillMaxWidth()) {
            if (scroll) {
                Column(
                    Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(if (padded) PaddingValues(start = Space.s4, end = Space.s4, top = Space.s4, bottom = Space.s7) else PaddingValues(bottom = Space.s7)),
                    content = content,
                )
            } else {
                Column(Modifier.fillMaxSize(), content = content)
            }
        }
        if (bottom != null) {
            Column(Modifier.fillMaxWidth().background(C.surface)) {
                Hairline()
                Box(Modifier.fillMaxWidth().padding(horizontal = Space.s4, vertical = Space.s3)) { bottom() }
            }
        }
    }
}

/** Small centred caption, used under forms. */
@Composable
fun Caption(text: String, modifier: Modifier = Modifier) {
    Text(text, style = T.small, color = C.muted, textAlign = TextAlign.Center, modifier = modifier.fillMaxWidth())
}
