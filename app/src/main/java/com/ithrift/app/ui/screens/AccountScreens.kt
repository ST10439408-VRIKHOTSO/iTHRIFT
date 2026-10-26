@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.screens

import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.BuildConfig
import com.ithrift.app.data.AccountOverview
import com.ithrift.app.data.Address
import com.ithrift.app.data.AddressRequest
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.AppNotification
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.ApiClient
import com.ithrift.app.data.ChangePasswordRequest
import com.ithrift.app.data.DeleteAccountRequest
import com.ithrift.app.data.CustomerProfile
import com.ithrift.app.data.NotificationListResponse
import com.ithrift.app.data.PointsSummary
import com.ithrift.app.data.PreferencesRequest
import com.ithrift.app.data.SavedSearch
import com.ithrift.app.data.StockAlert
import com.ithrift.app.data.StyleRequest
import com.ithrift.app.data.UpdateProfileRequest
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.Callout
import com.ithrift.app.ui.components.CheckRow
import com.ithrift.app.ui.components.Chip
import com.ithrift.app.ui.components.ConfirmDialog
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.GroupLabel
import com.ithrift.app.ui.components.Hairline
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.IconBtn
import com.ithrift.app.ui.components.IconTile
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.ListCard
import com.ithrift.app.ui.components.ListRow
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.Pill
import com.ithrift.app.ui.components.ProgressBar
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.Segmented
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.SwitchRow
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.ApiUrl
import com.ithrift.app.util.Validators
import com.ithrift.app.util.dateLabel
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.parseApiDate
import com.ithrift.app.util.plural
import com.ithrift.app.util.timeAgo
import java.util.Calendar
import kotlinx.coroutines.launch

private const val SETTINGS_TAG = "Settings"

private fun groupThousands(n: Long) = String.format(java.util.Locale.US, "%,d", n)

/* ----------------------------- Account hub ----------------------------- */

@Composable
private fun AccountHead(initial: String, name: String, sub: String) {
    Row(Modifier.padding(bottom = Space.s5), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(56.dp).clip(CircleShape).background(C.pineSoft), contentAlignment = Alignment.Center) {
            Text(initial, style = T.h2, color = C.pine)
        }
        Column(Modifier.padding(start = Space.s4).weight(1f)) {
            Text(name, style = T.h1.copy(fontSize = 24.sp), color = C.ink)
            Text(sub, style = T.small, color = C.muted)
        }
    }
}

@Composable
fun AccountScreen() {
    val app = LocalApp.current
    var confirmOut by remember { mutableStateOf(false) }
    val load = rememberLoad<AccountOverview?>(app.user?.id) {
        if (!app.isCustomer) ApiOutcome.Success(null) else when (val r = safeApiCall { app.api.accountOverview() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Account", back = false) {
        when {
            !app.isSignedIn -> EmptyState(
                Lucide.user, "Sign in to iTHRIFT", "See your orders, saved pieces, Thrift Points and messages with the store.",
                actionLabel = "Sign in", onAction = { app.go(Routes.login(Routes.ACCOUNT)) },
                secondaryLabel = "Create an account", onSecondary = { app.go(Routes.register(Routes.ACCOUNT)) },
            )
            app.isStaff -> {
                AccountHead(app.user!!.name.take(1), app.user!!.name, if (app.isAdmin) "Administrator account" else "Staff account")
                ListCard {
                    ListRow("Staff console", icon = Lucide.clipboardList, iconTone = Tone.Pine, onClick = { app.go(Routes.CONSOLE) })
                    ListRow("Appearance and connection", icon = Lucide.settings, divider = true, onClick = { app.go(Routes.SETTINGS) })
                    ListRow("Help centre", icon = Lucide.circleHelp, divider = true, onClick = { app.go(Routes.help()) })
                    ListRow("Sign out", icon = Lucide.logOut, divider = true, chevron = false, onClick = { confirmOut = true })
                }
            }
            else -> when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val ov = s.data ?: return@Screen
                    val c = ov.counts
                    AccountHead(ov.customer.firstName.take(1), "${ov.customer.firstName} ${ov.customer.lastName}", "${ov.customer.email}. Member since ${dateLabel(ov.customer.memberSince)}.")
                    Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                        Tile("${ov.points.balance}", "Thrift Points, ${ov.points.tier.name}", Modifier.weight(1f)) { app.go(Routes.POINTS) }
                        Tile("${c.activeOrders}", if (c.activeOrders == 1) "Order on the way" else "Orders on the way", Modifier.weight(1f)) { app.go(Routes.ORDERS) }
                        Tile("${c.unread}", if (c.unread == 1) "Unread notification" else "Unread notifications", Modifier.weight(1f)) { app.go(Routes.NOTIFICATIONS) }
                    }
                    GroupLabel("Shopping")
                    ListCard {
                        ListRow("Orders", icon = Lucide.packageIcon, meta = "${c.orders}", onClick = { app.go(Routes.ORDERS) })
                        ListRow("Wishlist", icon = Lucide.heart, meta = "${c.wishlist}", divider = true, onClick = { app.go(Routes.WISHLIST) })
                        ListRow("Saved searches", icon = Lucide.bookmark, meta = "${c.savedSearches}", divider = true, onClick = { app.go(Routes.SAVED) })
                        ListRow("Back-in-stock alerts", icon = Lucide.bell, meta = "${c.alerts}", divider = true, onClick = { app.go(Routes.ALERTS) })
                        ListRow("Returns", icon = Lucide.rotateCcw, meta = "${c.returns}", divider = true, onClick = { app.go(Routes.RETURNS) })
                    }
                    GroupLabel("Selling and help")
                    ListCard {
                        ListRow("Sell to us", icon = Lucide.handCoins, meta = "${c.sellSubmissions}", onClick = { app.go(Routes.SELL) })
                        ListRow("Messages with iTHRIFT", icon = Lucide.messageSquare, meta = if (c.openTickets > 0) "${c.openTickets} open" else null, divider = true, onClick = { app.go(Routes.MESSAGES) })
                        ListRow("Help centre", icon = Lucide.circleHelp, divider = true, onClick = { app.go(Routes.help()) })
                    }
                    GroupLabel("Your impact")
                    Panel {
                        val im = ov.impact
                        if (im.items > 0) {
                            Text("Buying ${plural(im.items, "piece")} second-hand instead of new saved roughly:", style = T.body, color = C.ink, modifier = Modifier.padding(bottom = Space.s3))
                            Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                                Impact(Lucide.droplets, "${groupThousands(Math.round(im.waterLitres))} L", "of water", Modifier.weight(1f))
                                Impact(Lucide.leaf, "${groupThousands(Math.round(im.co2Kg))} kg", "of CO2", Modifier.weight(1f))
                                Impact(Lucide.shirt, "${im.items}", if (im.items == 1) "piece kept in use" else "pieces kept in use", Modifier.weight(1f))
                            }
                            Text("${im.basis ?: ""} Rough figures, for a sense of scale.", style = T.tiny, color = C.muted, modifier = Modifier.padding(top = Space.s3))
                        } else {
                            Text("Once your first order is delivered, we will show roughly how much water and CO2 buying second-hand saved.", style = T.body, color = C.muted)
                        }
                    }
                    GroupLabel("Settings")
                    ListCard {
                        ListRow("Details, password and notifications", icon = Lucide.settings, onClick = { app.go(Routes.SETTINGS) })
                        ListRow(
                            "Your sizes and brands", icon = Lucide.ruler, divider = true,
                            meta = if (ov.style.sizes.isEmpty()) "Not set" else ov.style.sizes.take(3).joinToString(", ") + if (ov.style.sizes.size > 3) "..." else "",
                            onClick = { app.go(Routes.STYLE) },
                        )
                        ListRow("Delivery addresses", icon = Lucide.mapPin, divider = true, onClick = { app.go(Routes.addresses()) })
                        ListRow("About iTHRIFT", icon = Lucide.info, divider = true, onClick = { app.go(Routes.ABOUT) })
                        ListRow("Sign out", icon = Lucide.logOut, divider = true, chevron = false, onClick = { confirmOut = true })
                    }
                }
            }
        }
        if (confirmOut) {
            ConfirmDialog(
                "Sign out?", "You can sign in again any time. Your bag and wishlist are kept on your account.", "Sign out",
                onConfirm = {
                    app.signOut()
                    app.toast("Signed out.")
                    app.nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } }
                },
                onDismiss = { confirmOut = false },
                cancelLabel = "Stay signed in",
            )
        }
    }
}

@Composable
private fun Tile(value: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier
            .clip(RoundedCornerShape(Radius.lg))
            .background(C.surface)
            .clickable(role = Role.Button, onClick = onClick)
            .padding(Space.s3),
    ) {
        Text(value, style = T.h2.copy(fontSize = 24.sp), color = C.ink)
        Text(label, style = T.tiny.copy(fontSize = 12.sp), color = C.muted)
    }
}

@Composable
private fun Impact(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String, modifier: Modifier) {
    Column(modifier.clip(RoundedCornerShape(Radius.md)).background(C.goodSoft).padding(Space.s3)) {
        Ico(icon, size = 18.dp, tint = C.good)
        Text(value, style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(top = 6.dp))
        Text(label, style = T.tiny, color = C.muted)
    }
}

/* ----------------------------- Settings ----------------------------- */

private data class SettingsData(val profile: CustomerProfile, val overview: AccountOverview)

@Composable
fun SettingsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<SettingsData?>(app.user?.id) {
        if (!app.isCustomer) ApiOutcome.Success(null) else {
            val p = safeApiCall { app.api.getProfile() }
            if (p !is ApiOutcome.Success) return@rememberLoad p as ApiOutcome.Failure
            when (val o = safeApiCall { app.api.accountOverview() }) {
                is ApiOutcome.Success -> ApiOutcome.Success(SettingsData(p.data.profile, o.data))
                is ApiOutcome.Failure -> o
            }
        }
    }
    Screen("Settings") {
        PageHead("Settings")
        if (app.isCustomer) {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> s.data?.let { d ->
                    ProfileSection(d.profile)
                    PasswordSection(d.profile)
                    NotificationSection(d.overview)
                }
            }
        }
        AppearanceSection()
        ConnectionSection()
        load.data?.let { DeleteAccountSection(it.profile) }
        Spacer(Modifier.height(Space.s5))
        Text("iTHRIFT ${BuildConfig.VERSION_NAME} (build ${BuildConfig.VERSION_CODE})", style = T.tiny, color = C.faint)
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable () -> Unit) {
    Text(title, style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s5, bottom = Space.s3))
    Panel { content() }
}

@Composable
private fun ProfileSection(p: CustomerProfile) {
    val app = LocalApp.current
    var first by remember { mutableStateOf(p.firstName) }
    var last by remember { mutableStateOf(p.lastName) }
    var phone by remember { mutableStateOf(p.phone ?: "") }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var busy by remember { mutableStateOf(false) }
    SettingsGroup("Your details") {
        Field("First name", first, { first = it }, error = errors["first"])
        Field("Last name", last, { last = it }, error = errors["last"])
        Field("Email", p.email, {}, enabled = false, hint = "You sign in with your email or cellphone number. Contact us to change your email.")
        Field("Cellphone number", phone, { phone = it }, error = errors["phone"], keyboardType = KeyboardType.Phone, placeholder = "082 123 4567")
        Btn("Save details", {
            val e = mutableMapOf<String, String>()
            if (first.isBlank()) e["first"] = "Enter your first name."
            if (last.isBlank()) e["last"] = "Enter your last name."
            Validators.cellphone(phone)?.let { e["phone"] = it }
            errors = e
            if (e.isNotEmpty()) return@Btn
            busy = true
            app.run(
                { Log.i(SETTINGS_TAG, "Saving profile details"); safeApiCall { app.api.updateProfile(UpdateProfileRequest(first.trim(), last.trim(), phone.trim(), p.address, p.city, p.postalCode)) } },
                onDone = { busy = false },
                onError = { msg -> if (msg.contains("cellphone", ignoreCase = true)) errors = mapOf("phone" to msg) else app.toast(msg, ToastKind.Error) },
            ) {
                app.toast("Details saved.", ToastKind.Success)
            }
        }, loading = busy)
    }
}

@Composable
private fun PasswordSection(p: CustomerProfile) {
    val app = LocalApp.current
    if (!p.canChangePassword) {
        Spacer(Modifier.height(Space.s5))
        Callout("You sign in with Google, so there is no iTHRIFT password to change.", tone = Tone.Info)
        return
    }
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var busy by remember { mutableStateOf(false) }
    SettingsGroup("Password") {
        Field("Current password", current, { current = it }, error = errors["current"], password = true)
        Field("New password", next, { next = it }, error = errors["new"], password = true, hint = "At least 8 characters, with an uppercase letter and a number.")
        Btn("Change password", {
            val e = mutableMapOf<String, String>()
            Validators.passwordPresent(current)?.let { e["current"] = "Enter your current password." }
            Validators.password(next)?.let { e["new"] = it }
            errors = e
            if (e.isNotEmpty()) return@Btn
            busy = true
            app.run(
                { Log.i(SETTINGS_TAG, "Changing the account password"); safeApiCall { app.api.changePassword(ChangePasswordRequest(current, next)) } },
                onDone = { busy = false },
                onError = { msg -> errors = if (msg.contains("current", ignoreCase = true)) mapOf("current" to msg) else mapOf("new" to msg) },
            ) {
                current = ""
                next = ""
                app.toast("Password changed.", ToastKind.Success)
            }
        }, loading = busy)
    }
}

/**
 * Deleting the account, as Google Play requires of any app that lets people
 * create one, and as POPIA gives every customer the right to ask. The server
 * erases the personal details, keeps the order records the law requires
 * without them, refuses while an order is on its way, and ends every session.
 */
@Composable
private fun DeleteAccountSection(p: CustomerProfile) {
    val app = LocalApp.current
    val uri = LocalUriHandler.current
    var secret by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var confirming by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    SettingsGroup("Delete your account") {
        Text(
            "This erases your name, email, cellphone number, addresses, wishlist, alerts and messages, and you will not be able to sign in again. Your orders stay in our accounts without your details, as the law requires.",
            style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3),
        )
        LinkText("Read the privacy policy", { uri.openUri("${ApiClient.originUrl(app.context)}/#/privacy") })
        Spacer(Modifier.height(Space.s3))
        if (p.canChangePassword) Field("Your password", secret, { secret = it; error = null }, error = error, password = true)
        else Field("Type DELETE to confirm", secret, { secret = it; error = null }, error = error)
        Btn("Delete my account", {
            error = when {
                p.canChangePassword && secret.isEmpty() -> "Enter your password."
                !p.canChangePassword && secret.trim().uppercase() != "DELETE" -> "Type DELETE to confirm."
                else -> null
            }
            if (error == null) confirming = true
        }, style = BtnStyle.Danger, loading = busy)
    }
    if (confirming) {
        ConfirmDialog(
            "Delete your account?", "This cannot be undone. Your Thrift Points and saved pieces go with it.", "Delete my account",
            onConfirm = {
                confirming = false
                busy = true
                val body = if (p.canChangePassword) DeleteAccountRequest(password = secret) else DeleteAccountRequest(confirm = secret.trim())
                app.run(
                    { Log.i(SETTINGS_TAG, "Deleting the account"); safeApiCall { app.api.deleteAccount(body) } },
                    onDone = { busy = false },
                    onError = { msg -> error = msg },
                ) {
                    Log.i(SETTINGS_TAG, "Account deleted; signing out on this phone")
                    app.signOut()
                    app.toast("Your account has been deleted.", ToastKind.Success)
                    app.nav.navigate(Routes.HOME) { popUpTo(Routes.HOME) { inclusive = true } }
                }
            },
            onDismiss = { confirming = false },
            danger = true,
            cancelLabel = "Keep my account",
        )
    }
}

@Composable
private fun NotificationSection(ov: AccountOverview) {
    val app = LocalApp.current
    var orders by remember { mutableStateOf(ov.preferences.notifyOrders) }
    var alerts by remember { mutableStateOf(ov.preferences.notifyAlerts) }
    fun save(o: Boolean, a: Boolean) {
        orders = o
        alerts = a
        app.run({ safeApiCall { app.api.updatePreferences(PreferencesRequest(o, a)) } }) { app.toast("Notification settings saved.", ToastKind.Success) }
    }
    SettingsGroup("Notifications") {
        SwitchRow("Orders and requests", orders, { save(it, alerts) }, sub = "Order updates, returns, replies from support and offers on pieces you sell us.")
        Hairline()
        SwitchRow("Shopping alerts", alerts, { save(orders, it) }, sub = "Price drops on saved pieces, sizes coming back and new matches for saved searches.")
    }
}

@Composable
private fun AppearanceSection() {
    val app = LocalApp.current
    SettingsGroup("Appearance") {
        Text("Theme", style = T.body, color = C.ink)
        Text("Saved on this phone.", style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s2))
        Segmented(
            listOf(AppSettings.ThemeMode.LIGHT to "Light", AppSettings.ThemeMode.DARK to "Dark", AppSettings.ThemeMode.SYSTEM to "Automatic"),
            AppSettings.ThemeMode.fromStored(app.themeMode),
            { app.setTheme(it) },
            Modifier.fillMaxWidth(),
            icons = mapOf(AppSettings.ThemeMode.LIGHT to Lucide.sun, AppSettings.ThemeMode.DARK to Lucide.moon, AppSettings.ThemeMode.SYSTEM to Lucide.monitor),
        )
        Spacer(Modifier.height(Space.s3))
        Hairline()
        SwitchRow("Larger text", app.largeText, { app.updateLargeText(it) }, sub = "Makes everything about an eighth bigger.")
        Hairline()
        SwitchRow("Reduce motion", app.reduceMotion, { app.updateReduceMotion(it) }, sub = "Turns off sliding and fading.")
    }
}

@Composable
private fun ConnectionSection() {
    val app = LocalApp.current
    var url by remember { mutableStateOf(AppSettings.getServerUrl(app.context)) }
    var status by remember { mutableStateOf<Pair<String, Boolean>?>(null) }
    var testing by remember { mutableStateOf(false) }
    SettingsGroup("Connection") {
        Text(
            "Which iTHRIFT server this app talks to. The hosted server is ${ApiUrl.DEFAULT_SERVER_URL}. For a server on your own computer, use http://10.0.2.2:3000 in the emulator, or the computer's network address on a phone.",
            style = T.small, color = C.muted, modifier = Modifier.padding(bottom = Space.s3),
        )
        Field("Server address", url, { url = it; status = null }, keyboardType = KeyboardType.Uri)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
            Btn("Save and test", {
                AppSettings.setServerUrl(app.context, url)
                Log.i(SETTINGS_TAG, "Server address set to $url; testing the connection")
                testing = true
                status = "Checking. The hosted server can take up to a minute to wake." to true
                app.run({ safeApiCall { app.api.getBrands() } }, onDone = { testing = false }, onError = { status = it to false }) { r ->
                    status = "Connected. The server returned ${r.brands.size} brands." to true
                    Log.i(SETTINGS_TAG, "Connection test passed: ${r.brands.size} brands returned")
                    app.scope.launch { app.loadLookups(force = true); app.refreshCounts() }
                }
            }, loading = testing, small = true)
            Btn("Use the hosted server", { url = ApiUrl.DEFAULT_SERVER_URL; AppSettings.setServerUrl(app.context, url); status = null }, style = BtnStyle.Secondary, small = true)
            Btn("Clear cached data", {
                AppSettings.clearCachedData(app.context)
                app.toast("Cached data cleared. You are still signed in.", ToastKind.Success)
            }, style = BtnStyle.Quiet, small = true)
        }
        status?.let { (msg, ok) -> Text(msg, style = T.small, color = if (ok) C.good else C.bad, modifier = Modifier.padding(top = Space.s3)) }
    }
}

/* ----------------------------- Style profile ----------------------------- */

@Composable
fun StyleScreen() {
    val app = LocalApp.current
    val load = rememberLoad<AccountOverview>(app.user?.id) { safeApiCall { app.api.accountOverview() } }
    val sizes = remember { mutableStateListOf<String>() }
    val brands = remember { mutableStateListOf<String>() }
    var busy by remember { mutableStateOf(false) }
    LaunchedEffect(load.data) {
        load.data?.let { ov ->
            sizes.clear(); sizes.addAll(ov.style.sizes)
            brands.clear(); brands.addAll(ov.style.brands)
        }
    }
    Screen("Your sizes and brands", bottom = if (load.data != null) {
        {
            Btn("Save", {
                busy = true
                app.run({ safeApiCall { app.api.updateStyle(StyleRequest(sizes.toList(), brands.toList())) } }, onDone = { busy = false }) {
                    app.toast("Saved.", ToastKind.Success, "See your picks") { app.go(Routes.HOME) }
                }
            }, large = true, loading = busy, modifier = Modifier.fillMaxWidth())
        }
    } else null) {
        CustomerOnly(Routes.STYLE, "your style profile") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Your sizes and brands", sub = "The home page picks pieces in these sizes, and the My sizes filter uses them.")
                    Panel {
                        for ((label, list) in sizeGroups(ALL_SIZES)) {
                            Text(label, style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
                            FlowRow(Modifier.padding(bottom = Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                                for (v in list) Chip(v, v in sizes, { if (v in sizes) sizes.remove(v) else sizes.add(v) })
                            }
                        }
                        Text("Favourite brands", style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                            for (b in app.brands.filter { it.name != "Generic" }) Chip(b.name, b.name in brands, { if (b.name in brands) brands.remove(b.name) else brands.add(b.name) })
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Thrift Points ----------------------------- */

@Composable
fun PointsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<PointsSummary>(app.user?.id) { safeApiCall { app.api.points() } }
    Screen("Thrift Points") {
        CustomerOnly(Routes.POINTS, "your Thrift Points") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val pts = s.data
                    val next = pts.tier.next
                    val floor = mapOf("Bronze" to 0, "Silver" to 500, "Gold" to 1500)[pts.tier.name] ?: 0
                    val pct = if (next != null) (pts.lifetime - floor).toFloat() / (pts.lifetime - floor + next.pointsToGo).coerceAtLeast(1) else 1f
                    PageHead("Thrift Points")
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(Radius.xl)).background(C.pine).padding(Space.s5)) {
                        Text("${pts.tier.name} member", style = T.small, color = C.onPine.copy(alpha = 0.85f))
                        Text("${pts.balance}", style = T.display.copy(fontSize = 52.sp, lineHeight = 56.sp), color = C.onPine, modifier = Modifier.padding(top = Space.s2))
                        Text("points, worth ${formatMoney((pts.balance / 100) * 10.0)} off your next order.", style = T.body, color = C.onPine)
                        if (next != null) {
                            ProgressBar(pct, Modifier.padding(top = Space.s5, bottom = Space.s2), color = C.onPine)
                            Text("${next.pointsToGo} more points earned to reach ${next.name}.", style = T.small, color = C.onPine)
                        } else {
                            Text("You are at the top tier. Thank you for shopping second-hand.", style = T.small, color = C.onPine, modifier = Modifier.padding(top = Space.s3))
                        }
                    }
                    Spacer(Modifier.height(Space.s4))
                    Panel {
                        Text("How points work", style = T.h3, color = C.ink, modifier = Modifier.padding(bottom = Space.s2))
                        for ((icon, text) in listOf(
                            Lucide.coins to "Earn 1 point for every R10 you spend, once your order is delivered.",
                            Lucide.tag to "Spend 100 points for R10 off at checkout.",
                            Lucide.handCoins to "Sell us a piece and take the payment as points to get 20 percent extra.",
                            Lucide.star to "Silver from 500 points earned, Gold from 1,500.",
                        )) {
                            Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                                Ico(icon, size = 18.dp, tint = C.ink2, modifier = Modifier.padding(top = 2.dp))
                                Text(text, style = T.body, color = C.ink)
                            }
                        }
                    }
                    GroupLabel("History")
                    ListCard {
                        pts.history.forEachIndexed { i, h ->
                            ListRow(
                                h.reason, sub = dateLabel(h.createdAt), icon = if (h.points > 0) Lucide.plus else Lucide.minus,
                                iconTone = if (h.points > 0) Tone.Pine else Tone.Neutral, divider = i > 0, chevron = false,
                                trailing = { Text("${if (h.points > 0) "+" else ""}${h.points}", style = T.bodyStrong, color = if (h.points > 0) C.good else C.ink) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Saved searches ----------------------------- */

/** A saved search's criteria as shop filters, lists joined with commas. */
private fun criteriaToFilters(c: com.google.gson.JsonObject?): Map<String, String> {
    if (c == null) return emptyMap()
    return c.entrySet().associate { (k, v) ->
        k to if (v.isJsonArray) v.asJsonArray.joinToString(",") { it.asString } else v.asString
    }
}

@Composable
fun SavedSearchesScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<SavedSearch>>(app.user?.id) {
        when (val r = safeApiCall { app.api.savedSearches() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.savedSearches)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Saved searches") {
        CustomerOnly(Routes.SAVED, "your saved searches") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Saved searches", sub = "When a new piece matches one of these, it appears in your notifications.")
                    if (s.data.isEmpty()) {
                        EmptyState(Lucide.bookmark, "No saved searches", "Search or filter the shop, then choose Save search. We will tell you when something new matches.", actionLabel = "Go to the shop", onAction = { app.go(Routes.shop()) })
                    } else ListCard {
                        s.data.forEachIndexed { i, ss ->
                            ListRow(
                                ss.name,
                                sub = "${ss.summary ?: ""}. " + if ((ss.matches ?: 0) > 0) "${plural(ss.matches!!, "piece")} in stock now" else "Nothing in stock right now",
                                icon = Lucide.bookmark, iconTone = Tone.Pine, divider = i > 0, chevron = false,
                                onClick = { app.go(Routes.shop(criteriaToFilters(ss.criteria))) },
                                trailing = {
                                    IconBtn(Lucide.trash2, "Delete saved search ${ss.name}", {
                                        app.run({ safeApiCall { app.api.deleteSavedSearch(ss.id) } }) { r ->
                                            load.set(r.savedSearches)
                                            app.toast("Saved search deleted.", ToastKind.Success)
                                        }
                                    })
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

/* ----------------------------- Back-in-stock alerts ----------------------------- */

@Composable
fun AlertsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<List<StockAlert>>(app.user?.id) {
        when (val r = safeApiCall { app.api.stockAlerts() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.alerts)
            is ApiOutcome.Failure -> r
        }
    }
    Screen("Back-in-stock alerts") {
        CustomerOnly(Routes.ALERTS, "your alerts") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Back-in-stock alerts", sub = "Tap a crossed-out size on any piece to be told if it comes back.")
                    if (s.data.isEmpty()) {
                        EmptyState(Lucide.bell, "No alerts", "On a sold-out piece or size, choose Tell me if it comes back.", actionLabel = "Go to the shop", onAction = { app.go(Routes.shop()) })
                    } else {
                        val waiting = s.data.filter { it.fulfilledAt == null }
                        val sent = s.data.filter { it.fulfilledAt != null }
                        for ((label, list) in listOf("Waiting" to waiting, "Sent" to sent)) {
                            if (list.isEmpty()) continue
                            GroupLabel(label)
                            ListCard {
                                list.forEachIndexed { i, a ->
                                    if (i > 0) Hairline()
                                    Row(
                                        Modifier.fillMaxWidth().clickable { app.go(Routes.product(a.productId)) }.padding(Space.s3),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(Space.s3),
                                    ) {
                                        RemoteImage(a.image, Modifier.size(48.dp).clip(RoundedCornerShape(10.dp)))
                                        Column(Modifier.weight(1f)) {
                                            Text(a.brand, style = T.tiny, color = C.muted)
                                            Text(a.name + (a.size?.let { ", size $it" } ?: ""), style = T.bodyStrong, color = C.ink)
                                            Text(if (a.fulfilledAt != null) "Back in stock, told you ${timeAgo(a.fulfilledAt)}" else "Waiting since ${dateLabel(a.createdAt)}", style = T.small, color = C.muted)
                                        }
                                        IconBtn(Lucide.trash2, "Delete alert for ${a.name}", {
                                            app.run({ safeApiCall { app.api.deleteStockAlert(a.id) } }) { r ->
                                                load.set(r.alerts)
                                                app.toast("Alert deleted.", ToastKind.Success)
                                            }
                                        })
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

/* ----------------------------- Notifications ----------------------------- */

private fun noteIcon(type: String) = when (type) {
    "order" -> Lucide.packageIcon
    "return" -> Lucide.rotateCcw
    "price_drop" -> Lucide.badgePercent
    "back_in_stock" -> Lucide.bell
    "saved_search" -> Lucide.bookmark
    "question" -> Lucide.messageCircle
    "sell" -> Lucide.handCoins
    "support" -> Lucide.messageSquare
    "points" -> Lucide.coins
    "welcome" -> Lucide.sparkles
    else -> Lucide.bell
}

@Composable
fun NotificationsScreen() {
    val app = LocalApp.current
    val load = rememberLoad<NotificationListResponse>(app.user?.id) { safeApiCall { app.api.notifications() } }
    LaunchedEffect(load.data) { load.data?.let { app.unread = it.unread } }
    fun update(r: NotificationListResponse) {
        load.set(r)
        app.unread = r.unread
    }
    Screen("Notifications", actions = {
        if ((load.data?.unread ?: 0) > 0) Btn("Mark all read", { app.run({ safeApiCall { app.api.markAllRead() } }) { update(it) } }, style = BtnStyle.Ghost, small = true)
    }) {
        CustomerOnly(Routes.NOTIFICATIONS, "your notifications") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val d = s.data
                    Text("Notifications", style = T.h1, color = C.ink)
                    Row(Modifier.padding(top = 6.dp, bottom = Space.s3), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (d.unread > 0) "${d.unread} unread. " else "All caught up. ", style = T.body, color = C.muted)
                        LinkText("Choose what you hear about", { app.go(Routes.SETTINGS) }, style = T.body)
                    }
                    if (d.notifications.isEmpty()) {
                        EmptyState(Lucide.bell, "Nothing yet", "Order updates, price drops on saved pieces and replies from the store will appear here.")
                    } else {
                        val startOfToday = Calendar.getInstance().apply {
                            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
                        }.timeInMillis
                        val groups = d.notifications.groupBy { n ->
                            val t = parseApiDate(n.createdAt)?.time ?: 0L
                            when {
                                t >= startOfToday -> "Today"
                                t >= startOfToday - 6 * 86_400_000L -> "This week"
                                else -> "Earlier"
                            }
                        }
                        for (label in listOf("Today", "This week", "Earlier")) {
                            val list = groups[label] ?: continue
                            GroupLabel(label)
                            ListCard {
                                list.forEachIndexed { i, n ->
                                    if (i > 0) Hairline()
                                    NoteRow(n, onOpen = {
                                        if (!n.isRead) app.run({ safeApiCall { app.api.markRead(n.id) } }) { update(it) }
                                        Routes.fromWebPath(n.link)?.let { app.go(it) }
                                    }, onDelete = {
                                        app.run({ safeApiCall { app.api.deleteNotification(n.id) } }) { update(it) }
                                    })
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
private fun NoteRow(n: AppNotification, onOpen: () -> Unit, onDelete: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().background(if (n.isRead) C.surface else C.pineSoft.copy(alpha = 0.5f)).clickable(role = Role.Button, onClick = onOpen).padding(Space.s4),
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        IconTile(noteIcon(n.type), if (n.type == "price_drop") Tone.Sale else Tone.Pine)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!n.isRead) Box(Modifier.padding(end = 6.dp).size(8.dp).clip(CircleShape).background(C.pine))
                Text(n.title, style = T.bodyStrong.copy(fontWeight = if (n.isRead) FontWeight.Medium else FontWeight.SemiBold), color = C.ink)
            }
            Text(n.body, style = T.body.copy(fontSize = 15.sp), color = C.ink2, modifier = Modifier.padding(top = 2.dp))
            Text(timeAgo(n.createdAt), style = T.tiny, color = C.muted, modifier = Modifier.padding(top = 4.dp))
        }
        IconBtn(Lucide.x, "Delete notification", onDelete)
    }
}

/* ----------------------------- Addresses ----------------------------- */

@Composable
fun AddressesScreen(pick: Boolean) {
    val app = LocalApp.current
    val load = rememberLoad<List<Address>>(app.user?.id) {
        when (val r = safeApiCall { app.api.getAddresses() }) {
            is ApiOutcome.Success -> ApiOutcome.Success(r.data.addresses)
            is ApiOutcome.Failure -> r
        }
    }
    var editing by remember { mutableStateOf<Address?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Address?>(null) }
    Screen("Delivery addresses", actions = {
        if (app.isCustomer && (load.data?.size ?: 0) < 10) IconBtn(Lucide.plus, "Add address", { adding = true })
    }) {
        CustomerOnly(Routes.addresses(pick), "your addresses") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    PageHead("Delivery addresses", sub = "Up to ten. The default is picked first at checkout.")
                    if (s.data.isEmpty()) {
                        EmptyState(Lucide.mapPin, "No saved addresses", "Add one so checkout is quicker. Res, campus and work addresses all work.", actionLabel = "Add an address", onAction = { adding = true })
                    } else ListCard {
                        s.data.forEachIndexed { i, a ->
                            if (i > 0) Hairline()
                            Row(Modifier.fillMaxWidth().padding(Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                                IconTile(Lucide.mapPin, if (a.isDefault) Tone.Pine else Tone.Neutral)
                                Column(Modifier.weight(1f)) {
                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                        Text(a.label, style = T.bodyStrong, color = C.ink)
                                        if (a.isDefault) Pill("Default", Tone.Pine)
                                    }
                                    Text(a.recipient + (a.phone?.let { ", $it" } ?: ""), style = T.small, color = C.muted)
                                    Text(listOfNotNull(a.line1, a.suburb?.takeIf { it.isNotBlank() }, a.city, a.postalCode).joinToString(", "), style = T.small, color = C.muted)
                                    Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(Space.s4)) {
                                        LinkText("Edit", { editing = a })
                                        if (!a.isDefault) LinkText("Make default", {
                                            app.run({ safeApiCall { app.api.makeDefaultAddress(a.id) } }) { r ->
                                                load.set(r.addresses)
                                                app.toast("Default address changed.", ToastKind.Success)
                                            }
                                        })
                                        LinkText("Delete", { deleting = a }, color = C.bad)
                                    }
                                }
                            }
                        }
                    }
                    if (pick && s.data.isNotEmpty()) {
                        Btn("Back to checkout", { app.back() }, modifier = Modifier.fillMaxWidth().padding(top = Space.s4))
                    }
                }
            }
        }
        if (adding || editing != null) {
            AddressSheet(editing, onDismiss = { adding = false; editing = null }) { list ->
                load.set(list)
                adding = false
                editing = null
                if (pick) app.back()
            }
        }
        deleting?.let { a ->
            ConfirmDialog("Delete ${a.label}?", "${a.line1}, ${a.city}", "Delete address", danger = true, onConfirm = {
                app.run({ safeApiCall { app.api.deleteAddress(a.id) } }) { r ->
                    load.set(r.addresses)
                    app.toast("Address deleted.", ToastKind.Success)
                }
            }, onDismiss = { deleting = null })
        }
    }
}

@Composable
private fun AddressSheet(current: Address?, onDismiss: () -> Unit, onSaved: (List<Address>) -> Unit) {
    val app = LocalApp.current
    var label by remember { mutableStateOf(current?.label ?: "") }
    var recipient by remember { mutableStateOf(current?.recipient ?: app.user?.name ?: "") }
    var phone by remember { mutableStateOf(current?.phone ?: "") }
    var line1 by remember { mutableStateOf(current?.line1 ?: "") }
    var suburb by remember { mutableStateOf(current?.suburb ?: "") }
    var city by remember { mutableStateOf(current?.city ?: "") }
    var postal by remember { mutableStateOf(current?.postalCode ?: "") }
    var isDefault by remember { mutableStateOf(current?.isDefault ?: false) }
    var errors by remember { mutableStateOf(mapOf<String, String>()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    Sheet(if (current != null) "Edit address" else "Add an address", onDismiss = onDismiss, footer = {
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            Btn("Cancel", onDismiss, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
            Btn(if (current != null) "Save changes" else "Add address", {
                val e = mutableMapOf<String, String>()
                if (recipient.isBlank()) e["recipient"] = "Enter the name of the person receiving the parcel."
                if (line1.trim().length < 5) e["line1"] = "Enter the street address with the house or building number."
                if (city.isBlank()) e["city"] = "Enter the city or town."
                if (!Regex("^\\d{4}$").matches(postal.trim())) e["postal"] = "A South African postal code has four digits."
                Validators.phone(phone)?.let { e["phone"] = it }
                errors = e
                if (e.isNotEmpty()) return@Btn
                busy = true
                val body = AddressRequest(label.ifBlank { "Home" }, recipient.trim(), phone.ifBlank { null }, line1.trim(), suburb.ifBlank { null }, city.trim(), postal.trim(), isDefault)
                app.run({
                    safeApiCall { if (current != null) app.api.updateAddress(current.id, body) else app.api.addAddress(body) }
                }, onDone = { busy = false }, onError = { formError = it }) { r ->
                    app.toast(if (current != null) "Address saved." else "Address added.", ToastKind.Success)
                    onSaved(r.addresses)
                }
            }, loading = busy, modifier = Modifier.weight(1f))
        }
    }) {
        if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s3))
        Field("Label", label, { label = it }, placeholder = "Home, Res, Campus, Work", maxLength = 30)
        Field("Who receives it", recipient, { recipient = it }, error = errors["recipient"])
        Field("Phone for the courier (optional)", phone, { phone = it }, error = errors["phone"], keyboardType = KeyboardType.Phone, placeholder = "082 123 4567")
        Field("Street address", line1, { line1 = it }, error = errors["line1"], placeholder = "12 Jacaranda Street, or Res name and room")
        Field("Suburb (optional)", suburb, { suburb = it })
        Field("City or town", city, { city = it }, error = errors["city"])
        Field("Postal code", postal, { postal = it.filter(Char::isDigit) }, error = errors["postal"], keyboardType = KeyboardType.Number, maxLength = 4)
        if (current == null) CheckRow(isDefault, { isDefault = it }, "Make this my default address")
    }
}
