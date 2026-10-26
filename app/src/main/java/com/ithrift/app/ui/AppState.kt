package com.ithrift.app.ui

import android.content.Context
import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.navigation.NavHostController
import com.ithrift.app.data.ApiClient
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.ApiService
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.AuthUser
import com.ithrift.app.data.Brand
import com.ithrift.app.data.Category
import com.ithrift.app.data.OrderOptionsResponse
import com.ithrift.app.data.SessionManager
import com.ithrift.app.data.WishlistAddRequest
import com.ithrift.app.data.safeApiCall
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How a toast is coloured: plain, a success tick, or an error. */
enum class ToastKind { Plain, Success, Error }

data class Toast(
    val id: Long,
    val message: String,
    val kind: ToastKind,
    val actionLabel: String? = null,
    val onAction: (() -> Unit)? = null,
)

/**
 * Everything the whole app shares, in one place: who is signed in, the
 * counts on the bag and the bell, the wishlist and compare tray, the
 * appearance settings and the toasts. It plays the part `state` plays in the
 * website's public/js/app.js.
 *
 * Because every screen goes through this class to navigate, sign in or out
 * and run an API action, it is also where the app's Logcat trail is written
 * (tag "AppState"): a developer can follow a customer's path through the
 * app from the log alone. Identities are logged by role and id only, never
 * by name, email or token.
 *
 * References:
 *  - State in Compose (mutableStateOf, @Stable): https://developer.android.com/develop/ui/compose/state
 *  - Navigation with Compose: https://developer.android.com/develop/ui/compose/navigation
 *  - CompositionLocal: https://developer.android.com/develop/ui/compose/compositionlocal
 */
@Stable
class AppState(val context: Context, val scope: CoroutineScope) {

    var user by mutableStateOf(SessionManager.getUser(context))
        private set
    var cartCount by mutableIntStateOf(0)
    var unread by mutableIntStateOf(0)
    var wishlistIds by mutableStateOf(emptySet<Int>())
    var compareIds by mutableStateOf(AppSettings.compareProducts(context))
        private set

    var themeMode by mutableStateOf(AppSettings.getThemeMode(context).stored)
        private set
    var largeText by mutableStateOf(AppSettings.largeText(context))
        private set
    var reduceMotion by mutableStateOf(AppSettings.reduceMotion(context))
        private set

    var brands by mutableStateOf(emptyList<Brand>())
    var categories by mutableStateOf(emptyList<Category>())
    var sizes by mutableStateOf(emptyList<String>())
    var options by mutableStateOf<OrderOptionsResponse?>(null)

    val toasts = mutableStateListOf<Toast>()
    private var toastSeq = 0L

    lateinit var nav: NavHostController

    val api: ApiService get() = ApiClient.getService(context)

    val isSignedIn: Boolean get() = user != null
    val isCustomer: Boolean get() = user?.type == "customer"
    val isStaff: Boolean get() = user?.type == "staff" || user?.type == "admin"
    val isAdmin: Boolean get() = user?.type == "admin"
    val firstName: String get() = user?.name?.substringBefore(' ') ?: ""

    // --- Navigation -----------------------------------------------------------

    fun go(route: String) {
        Log.d(TAG, "Navigate to $route")
        nav.navigate(route) { launchSingleTop = true }
    }

    fun back() {
        if (!nav.popBackStack()) go(Routes.HOME)
    }

    /** Opens the sign-in screen and comes back to [next] afterwards. */
    fun requireSignIn(next: String): Boolean {
        if (isSignedIn) return true
        Log.i(TAG, "Sign-in required before $next")
        go(Routes.login(next))
        return false
    }

    // --- Session --------------------------------------------------------------

    fun signIn(token: String, signedIn: AuthUser) {
        SessionManager.saveSession(context, token, signedIn)
        user = signedIn
        Log.i(TAG, "Signed in: ${signedIn.type} #${signedIn.id}")
        scope.launch { refreshCounts() }
    }

    fun signOut() {
        val hadToken = SessionManager.getToken(context) != null
        Log.i(TAG, "Signing out ${user?.type ?: "guest"} #${user?.id ?: "-"}")
        scope.launch {
            if (hadToken) safeApiCall { api.logout() }
            SessionManager.clearSession(context)
            user = null
            cartCount = 0
            unread = 0
            wishlistIds = emptySet()
        }
    }

    /** Called when any request finds the session gone (the server restarted, say). */
    fun noticeLostSession() {
        if (user != null && !SessionManager.isLoggedIn(context)) {
            Log.w(TAG, "Session lost on the server; showing the app signed out")
            user = null
            cartCount = 0
            unread = 0
            wishlistIds = emptySet()
            toast("You have been signed out. Sign in again to carry on.", ToastKind.Error)
        }
    }

    /** The bag count, the unread count and the wishlist, for the header and tab bar. */
    suspend fun refreshCounts() {
        if (!isCustomer) {
            cartCount = 0
            unread = 0
            wishlistIds = emptySet()
            return
        }
        when (val cart = safeApiCall { api.getCart() }) {
            is ApiOutcome.Success -> cartCount = cart.data.itemCount
            is ApiOutcome.Failure -> noticeLostSession()
        }
        (safeApiCall { api.unreadCount() } as? ApiOutcome.Success)?.let { unread = it.data.unread }
        (safeApiCall { api.getWishlist() } as? ApiOutcome.Success)?.let { r -> wishlistIds = r.data.items.map { it.productId }.toSet() }
    }

    /** Brands, categories, sizes and delivery options: fetched once, used by many screens. */
    suspend fun loadLookups(force: Boolean = false) {
        if (!force && brands.isNotEmpty() && categories.isNotEmpty()) return
        (safeApiCall { api.getBrands() } as? ApiOutcome.Success)?.let { brands = it.data.brands }
        (safeApiCall { api.getCategories() } as? ApiOutcome.Success)?.let { categories = it.data.categories }
        (safeApiCall { api.getSizes() } as? ApiOutcome.Success)?.let { sizes = it.data.sizes }
        (safeApiCall { api.getOrderOptions() } as? ApiOutcome.Success)?.let { options = it.data }
        Log.d(TAG, "Lookups loaded: ${brands.size} brands, ${categories.size} categories, ${sizes.size} sizes")
    }

    // --- Wishlist and compare --------------------------------------------------

    fun toggleWishlist(productId: Int, name: String) {
        if (!requireSignIn(Routes.product(productId))) return
        val saved = productId in wishlistIds
        Log.d(TAG, if (saved) "Wishlist: removing product #$productId" else "Wishlist: saving product #$productId")
        // Optimistic update: the heart changes at once and is put back if the API refuses.
        wishlistIds = if (saved) wishlistIds - productId else wishlistIds + productId
        scope.launch {
            val result = if (saved) safeApiCall { api.removeFromWishlist(productId) }
            else safeApiCall { api.addToWishlist(WishlistAddRequest(productId)) }
            when (result) {
                is ApiOutcome.Success -> {
                    wishlistIds = result.data.items.map { it.productId }.toSet()
                    if (saved) toast("Removed $name from your wishlist.")
                    else toast("Saved to your wishlist. We will tell you if the price drops.", ToastKind.Success, "View") { go(Routes.WISHLIST) }
                }
                is ApiOutcome.Failure -> {
                    wishlistIds = if (saved) wishlistIds + productId else wishlistIds - productId
                    toast(result.message, ToastKind.Error)
                }
            }
        }
    }

    fun toggleCompare(productId: Int) {
        val ids = compareIds
        compareIds = when {
            productId in ids -> ids - productId
            ids.size >= 3 -> {
                toast("You can compare three pieces at a time. Remove one first.", ToastKind.Error)
                ids
            }
            else -> ids + productId
        }
        AppSettings.setCompareProducts(context, compareIds)
    }

    fun clearCompare() {
        compareIds = emptyList()
        AppSettings.setCompareProducts(context, emptyList())
    }

    // --- Appearance ------------------------------------------------------------

    fun setTheme(mode: AppSettings.ThemeMode) {
        AppSettings.setThemeMode(context, mode)
        themeMode = mode.stored
        Log.i(TAG, "Theme set to ${mode.stored}")
    }

    fun updateLargeText(on: Boolean) {
        AppSettings.setLargeText(context, on)
        largeText = on
        Log.i(TAG, "Larger text ${if (on) "on" else "off"}")
    }

    fun updateReduceMotion(on: Boolean) {
        AppSettings.setReduceMotion(context, on)
        reduceMotion = on
        Log.i(TAG, "Reduced motion ${if (on) "on" else "off"}")
    }

    // --- Toasts ------------------------------------------------------------------

    fun toast(message: String, kind: ToastKind = ToastKind.Plain, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
        val t = Toast(++toastSeq, message, kind, actionLabel, onAction)
        toasts.add(t)
        while (toasts.size > 3) toasts.removeAt(0)
        scope.launch {
            delay(if (actionLabel != null) 6000 else 3600)
            toasts.remove(t)
        }
    }

    fun dismissToast(t: Toast) {
        toasts.remove(t)
    }

    private companion object {
        const val TAG = "AppState"
    }
}

private const val LOAD_TAG = "ScreenLoad"
private const val ACTION_TAG = "AppAction"

val LocalApp = staticCompositionLocalOf<AppState> { error("AppState not provided") }

// --- Loading data for a screen ---------------------------------------------------

sealed interface Load<out T> {
    data object Loading : Load<Nothing>
    data class Ready<T>(val data: T) : Load<T>
    data class Failed(val message: String) : Load<Nothing>
}

@Stable
class LoadHandle<T> {
    var state by mutableStateOf<Load<T>>(Load.Loading)
    var version by mutableIntStateOf(0)
        private set

    /** True while a reload runs on top of data already shown. */
    var refreshing by mutableStateOf(false)

    val data: T? get() = (state as? Load.Ready<T>)?.data

    fun reload() {
        version++
    }

    /** Replaces the data in place, after an action returned the new version of it. */
    fun set(value: T) {
        state = Load.Ready(value)
    }
}

/**
 * Loads a screen's data from the API, again whenever [keys] change or
 * [LoadHandle.reload] is called. A reload keeps the old data on screen while
 * it runs, so nothing flickers.
 *
 * Reference: LaunchedEffect and other side effects in Compose,
 * https://developer.android.com/develop/ui/compose/side-effects
 */
@Composable
fun <T> rememberLoad(vararg keys: Any?, block: suspend () -> ApiOutcome<T>): LoadHandle<T> {
    val app = LocalApp.current
    val handle = remember(*keys) { LoadHandle<T>() }
    val current by rememberUpdatedState(block)
    LaunchedEffect(handle, handle.version) {
        val hadData = handle.state is Load.Ready
        if (hadData) handle.refreshing = true else handle.state = Load.Loading
        val result = current()
        handle.state = when (result) {
            is ApiOutcome.Success -> Load.Ready(result.data)
            is ApiOutcome.Failure -> {
                Log.w(LOAD_TAG, "Screen data failed to ${if (hadData) "refresh" else "load"}: ${result.message}")
                app.noticeLostSession()
                if (hadData) {
                    app.toast(result.message, ToastKind.Error)
                    handle.state
                } else Load.Failed(result.message)
            }
        }
        handle.refreshing = false
    }
    return handle
}

/** Runs an API action from a button and reports a failure as a toast. */
fun <T> AppState.run(
    block: suspend () -> ApiOutcome<T>,
    onDone: () -> Unit = {},
    onError: ((String) -> Unit)? = null,
    onSuccess: suspend (T) -> Unit,
) {
    scope.launch {
        when (val r = block()) {
            is ApiOutcome.Success -> onSuccess(r.data)
            is ApiOutcome.Failure -> {
                Log.w(ACTION_TAG, "Action refused: ${r.message}")
                noticeLostSession()
                if (onError != null) onError(r.message) else toast(r.message, ToastKind.Error)
            }
        }
        onDone()
    }
}
