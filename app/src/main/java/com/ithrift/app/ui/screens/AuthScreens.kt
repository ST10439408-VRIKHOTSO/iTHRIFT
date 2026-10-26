@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.Image
import com.ithrift.app.R
import com.ithrift.app.data.AccountOverview
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.AuthUser
import com.ithrift.app.data.GoogleSignIn
import com.ithrift.app.data.LoginRequest
import com.ithrift.app.data.RegisterRequest
import com.ithrift.app.data.SsoExchangeRequest
import com.ithrift.app.data.StyleRequest
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.AppState
import com.ithrift.app.ui.Caption
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.Callout
import com.ithrift.app.ui.components.Chip
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.Ico
import com.ithrift.app.ui.components.IconTile
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.ListCard
import com.ithrift.app.ui.components.ListRow
import com.ithrift.app.ui.components.Panel
import com.ithrift.app.ui.components.SkeletonPage
import com.ithrift.app.ui.components.Tone
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.Validators
import kotlinx.coroutines.launch

/** Where to go after signing in: back where the customer was, or home (the console for staff). */
private fun afterSignIn(app: AppState, user: AuthUser, next: String) {
    val target = when {
        next.isNotBlank() -> next
        user.type == "customer" -> Routes.HOME
        else -> Routes.CONSOLE
    }
    app.nav.navigate(target) { popUpTo(Routes.HOME) }
}

/**
 * The "or" divider and the Google button, shown when the server has Google
 * sign-in set up. The button opens the website's Google sign-in in a browser
 * tab, and the app picks the result up when the tab sends the customer back
 * (see data/GoogleSignIn.kt and IThriftApp).
 */
@Composable
private fun GoogleButton(next: String, onError: (String) -> Unit) {
    val app = LocalApp.current
    val context = LocalContext.current
    var enabled by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        (safeApiCall { app.api.ssoStatus() } as? ApiOutcome.Success)?.let { enabled = it.data.enabled }
    }
    if (!enabled) return
    Row(Modifier.fillMaxWidth().padding(vertical = Space.s4), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.weight(1f).height(1.dp).background(C.hairline))
        Text("or", style = T.small, color = C.muted, modifier = Modifier.padding(horizontal = Space.s3))
        Box(Modifier.weight(1f).height(1.dp).background(C.hairline))
    }
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .clip(RoundedCornerShape(26.dp))
            .background(C.surface)
            .border(1.dp, C.hairlineStrong, RoundedCornerShape(26.dp))
            .clickable(role = Role.Button) {
                GoogleSignIn.start(context, AppSettings.getServerUrl(app.context), next)?.let(onError)
            },
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Image(painterResource(R.drawable.ic_google), contentDescription = null, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(Space.s3))
        Text("Continue with Google", style = T.button, color = C.ink)
    }
}

/** Finishes a Google sign-in that came back from the browser tab. */
fun finishGoogleSignIn(app: AppState, uri: android.net.Uri) {
    val pending = GoogleSignIn.takePending(app.context)
    val code = uri.getQueryParameter("code")
    if (code == null) return // The customer came back without signing in.
    if (pending == null) {
        app.toast("That Google sign-in has expired. Please try again.", ToastKind.Error)
        return
    }
    val (verifier, next) = pending
    app.run({ safeApiCall { app.api.ssoExchange(SsoExchangeRequest(code, verifier)) } }) { r ->
        app.signIn(r.token, r.user)
        app.toast("Signed in as ${r.user.name.substringBefore(' ')}.", ToastKind.Success)
        afterSignIn(app, r.user, next)
    }
}

@Composable
fun LoginScreen(next: String) {
    val app = LocalApp.current
    var identifier by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var idError by remember { mutableStateOf<String?>(null) }
    var pwError by remember { mutableStateOf<String?>(null) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun submit() {
        idError = Validators.signInIdentifier(identifier)
        pwError = Validators.passwordPresent(password)
        if (idError != null || pwError != null) return
        busy = true
        formError = null
        app.run({ safeApiCall { app.api.login(LoginRequest(identifier.trim(), password)) } }, onDone = { busy = false }, onError = { formError = it }) { r ->
            app.signIn(r.token, r.user)
            app.toast("Signed in as ${r.user.name.substringBefore(' ')}.", ToastKind.Success)
            afterSignIn(app, r.user, next)
        }
    }

    Screen("Sign in") {
        Text("Sign in", style = T.h1, color = C.ink, modifier = Modifier.semantics { heading() })
        Text("Use the email address or cellphone number on your account.", style = T.body, color = C.muted, modifier = Modifier.padding(top = 6.dp, bottom = Space.s5))
        if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s4))
        Field("Email or cellphone number", identifier, { identifier = it; idError = null }, error = idError, keyboardType = KeyboardType.Email)
        Field("Password", password, { password = it; pwError = null }, error = pwError, password = true, imeAction = ImeAction.Done, onIme = { submit() })
        Btn("Sign in", { submit() }, large = true, loading = busy, modifier = Modifier.fillMaxWidth())
        GoogleButton(next) { formError = it }
        Spacer(Modifier.height(Space.s5))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("New to iTHRIFT? ", style = T.small, color = C.ink2)
            LinkText("Create an account", { app.go(Routes.register(next)) })
        }
    }
}

@Composable
fun RegisterScreen(next: String) {
    val app = LocalApp.current
    var first by remember { mutableStateOf("") }
    var last by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    val errors = remember { mutableStateOf(mapOf<String, String>()) }
    var formError by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun submit() {
        val e = mutableMapOf<String, String>()
        if (first.isBlank()) e["first"] = "Enter your first name."
        if (last.isBlank()) e["last"] = "Enter your last name."
        Validators.email(email)?.let { e["email"] = it }
        Validators.cellphone(phone)?.let { e["phone"] = it }
        if (Validators.password(password) != null) e["password"] = "Use at least 8 characters, with an uppercase letter and a number."
        else Validators.confirmPassword(password, confirm)?.let { e["confirm"] = it }
        errors.value = e
        if (e.isNotEmpty()) return
        busy = true
        formError = null
        app.run(
            { safeApiCall { app.api.register(RegisterRequest(first.trim(), last.trim(), email.trim(), password, phone.trim(), confirmPassword = confirm)) } },
            onDone = { busy = false },
            onError = { msg ->
                when {
                    msg.contains("email", ignoreCase = true) -> errors.value = mapOf("email" to msg)
                    msg.contains("cellphone", ignoreCase = true) -> errors.value = mapOf("phone" to msg)
                    msg.contains("match", ignoreCase = true) -> errors.value = mapOf("confirm" to msg)
                    else -> formError = msg
                }
            },
        ) { r ->
            app.signIn(r.token, r.user)
            app.nav.navigate(Routes.welcome(next)) { popUpTo(Routes.HOME) }
        }
    }

    Screen("Create an account") {
        Text("Create an account", style = T.h1, color = C.ink, modifier = Modifier.semantics { heading() })
        Text("You start with 50 Thrift Points.", style = T.body, color = C.muted, modifier = Modifier.padding(top = 6.dp, bottom = Space.s5))
        if (formError != null) Callout(formError!!, tone = Tone.Bad, icon = Lucide.circleAlert, modifier = Modifier.padding(bottom = Space.s4))
        val e = errors.value
        Field("First name", first, { first = it }, error = e["first"])
        Field("Last name", last, { last = it }, error = e["last"])
        Field("Email", email, { email = it }, error = e["email"], keyboardType = KeyboardType.Email)
        Field("Cellphone number", phone, { phone = it }, error = e["phone"], keyboardType = KeyboardType.Phone, placeholder = "082 123 4567", hint = "You can sign in with this number too.")
        Field("Password", password, { password = it }, error = e["password"], password = true, hint = "At least 8 characters, with an uppercase letter and a number.")
        Field("Confirm password", confirm, { confirm = it }, error = e["confirm"], password = true, imeAction = ImeAction.Done, onIme = { submit() })
        Btn("Create account", { submit() }, large = true, loading = busy, modifier = Modifier.fillMaxWidth())
        GoogleButton(next) { formError = it }
        Spacer(Modifier.height(Space.s5))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            Text("Already have an account? ", style = T.small, color = C.ink2)
            LinkText("Sign in", { app.go(Routes.login(next)) })
        }
    }
}

val ALL_SIZES = listOf("XS", "S", "M", "L", "XL", "XXL", "UK 3", "UK 4", "UK 5", "UK 6", "UK 7", "UK 8", "UK 9", "UK 10", "28", "30", "32", "34", "36", "38", "40", "42", "44")

@Composable
fun WelcomeScreen(next: String) {
    val app = LocalApp.current
    val load = rememberLoad<AccountOverview>(app.user?.id) { safeApiCall { app.api.accountOverview() } }
    var step by remember { mutableIntStateOf(0) }
    val sizes = remember { mutableStateListOf<String>() }
    val brands = remember { mutableStateListOf<String>() }
    var seeded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }

    fun finish() {
        AppSettings.setOnboardLater(app.context)
        app.nav.navigate(next.ifBlank { Routes.HOME }) { popUpTo(Routes.HOME) { inclusive = next.isBlank() } }
    }

    Screen(title = "Welcome", back = false) {
        CustomerOnly(Routes.welcome(next), "the welcome steps") {
            when (val s = load.state) {
                is Load.Loading -> SkeletonPage()
                is Load.Failed -> ErrorState(s.message, { load.reload() })
                is Load.Ready -> {
                    val ov = s.data
                    LaunchedEffect(ov) {
                        if (!seeded) {
                            sizes.addAll(ov.style.sizes)
                            brands.addAll(ov.style.brands)
                            seeded = true
                        }
                    }
                    // Progress dots
                    Row(Modifier.fillMaxWidth().padding(bottom = Space.s4), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally)) {
                        for (i in 0..2) Box(Modifier.size(if (i == step) 24.dp else 8.dp, 8.dp).clip(CircleShape).background(if (i == step) C.pine else C.surface3))
                    }
                    Text("Step ${step + 1} of 3", style = T.tiny, color = C.muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = Space.s3))
                    Panel(padding = androidx.compose.foundation.layout.PaddingValues(Space.s5)) {
                        when (step) {
                            0 -> {
                                Text("Welcome to iTHRIFT, ${ov.customer.firstName}.", style = T.h1, color = C.ink)
                                Text(
                                    "Two quick questions, and the shop will put pieces in your sizes and favourite brands first. You can change them any time under Account.",
                                    style = T.body.copy(fontSize = 17.sp, lineHeight = 26.sp), color = C.muted, modifier = Modifier.padding(top = Space.s3, bottom = Space.s4),
                                )
                                for ((icon, text) in listOf(
                                    Lucide.ruler to "Pieces in your sizes, picked out on the home page",
                                    Lucide.bell to "Alerts when a saved piece drops in price",
                                    Lucide.coins to "${ov.points.balance} Thrift Points to start you off",
                                )) {
                                    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                                        IconTile(icon, Tone.Pine)
                                        Text(text, style = T.body, color = C.ink)
                                    }
                                }
                            }
                            1 -> {
                                Text("What sizes do you wear?", style = T.h1, color = C.ink)
                                Text("Choose any that apply.", style = T.body, color = C.muted, modifier = Modifier.padding(top = 6.dp))
                                for ((label, list) in sizeGroups(ALL_SIZES)) {
                                    Text(label, style = T.bodyStrong, color = C.ink, modifier = Modifier.padding(top = Space.s5, bottom = Space.s2))
                                    FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                                        for (v in list) Chip(v, v in sizes, { if (v in sizes) sizes.remove(v) else sizes.add(v) })
                                    }
                                }
                            }
                            else -> {
                                Text("Any favourite brands?", style = T.h1, color = C.ink)
                                Text("We will show these first.", style = T.body, color = C.muted, modifier = Modifier.padding(top = 6.dp, bottom = Space.s4))
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                                    for (b in app.brands.filter { it.name != "Generic" }) Chip(b.name, b.name in brands, { if (b.name in brands) brands.remove(b.name) else brands.add(b.name) })
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(Space.s5))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Btn(if (step == 0) "Not now" else "Back", {
                            if (step > 0) step-- else {
                                app.run({ safeApiCall { app.api.updateStyle(StyleRequest(emptyList(), emptyList(), skip = true)) } }, onError = { finish() }) { finish() }
                            }
                        }, style = BtnStyle.Ghost)
                        Spacer(Modifier.weight(1f))
                        Btn(
                            when (step) {
                                0 -> "Get started"
                                2 -> "Show me the shop"
                                else -> "Continue"
                            },
                            {
                                if (step < 2) step++ else {
                                    busy = true
                                    app.run({ safeApiCall { app.api.updateStyle(StyleRequest(sizes.toList(), brands.toList())) } }, onDone = { busy = false }) {
                                        app.toast("Saved. The shop now starts with your sizes.", ToastKind.Success)
                                        finish()
                                    }
                                }
                            },
                            large = true,
                            loading = busy,
                        )
                    }
                }
            }
        }
    }
}

/** Shared caption under a form. */
@Composable
fun FormFootnote(text: String) = Caption(text, Modifier.padding(top = Space.s3))
