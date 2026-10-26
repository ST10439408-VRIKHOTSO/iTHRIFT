package com.ithrift.app.ui

import android.app.Activity
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ithrift.app.data.GoogleSignIn
import com.ithrift.app.ui.components.ToastHost
import com.ithrift.app.ui.screens.finishGoogleSignIn
import com.ithrift.app.ui.screens.AboutScreen
import com.ithrift.app.ui.screens.AccountScreen
import com.ithrift.app.ui.screens.AddressesScreen
import com.ithrift.app.ui.screens.AlertsScreen
import com.ithrift.app.ui.screens.BagScreen
import com.ithrift.app.ui.screens.CheckoutScreen
import com.ithrift.app.ui.screens.CompareScreen
import com.ithrift.app.ui.screens.ContactScreen
import com.ithrift.app.ui.screens.HelpScreen
import com.ithrift.app.ui.screens.HomeScreen
import com.ithrift.app.ui.screens.LoginScreen
import com.ithrift.app.ui.screens.MessagesScreen
import com.ithrift.app.ui.screens.NotificationsScreen
import com.ithrift.app.ui.screens.OrderDetailScreen
import com.ithrift.app.ui.screens.OrderPlacedScreen
import com.ithrift.app.ui.screens.OrdersScreen
import com.ithrift.app.ui.screens.PointsScreen
import com.ithrift.app.ui.screens.ProductScreen
import com.ithrift.app.ui.screens.ReceiptScreen
import com.ithrift.app.ui.screens.RegisterScreen
import com.ithrift.app.ui.screens.ReturnsScreen
import com.ithrift.app.ui.screens.SavedSearchesScreen
import com.ithrift.app.ui.screens.SearchScreen
import com.ithrift.app.ui.screens.SellScreen
import com.ithrift.app.ui.screens.SettingsScreen
import com.ithrift.app.ui.screens.ShopScreen
import com.ithrift.app.ui.screens.SizeGuideScreen
import com.ithrift.app.ui.screens.StyleScreen
import com.ithrift.app.ui.screens.ThreadScreen
import com.ithrift.app.ui.screens.WelcomeScreen
import com.ithrift.app.ui.screens.WishlistScreen
import com.ithrift.app.ui.staff.ConsoleScreen
import com.ithrift.app.ui.staff.StaffCollectionsScreen
import com.ithrift.app.ui.staff.StaffCustomersScreen
import com.ithrift.app.ui.staff.StaffInventoryScreen
import com.ithrift.app.ui.staff.StaffListingsScreen
import com.ithrift.app.ui.staff.StaffOrdersScreen
import com.ithrift.app.ui.staff.StaffPromosScreen
import com.ithrift.app.ui.staff.StaffQuestionsScreen
import com.ithrift.app.ui.staff.StaffReturnsScreen
import com.ithrift.app.ui.staff.StaffSellScreen
import com.ithrift.app.ui.staff.StaffSupportScreen
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.IThriftTheme
import kotlinx.coroutines.delay

// The app shell: one NavHost for every screen, the theme, and the shared AppState.
// References: Navigation with Compose, https://developer.android.com/develop/ui/compose/navigation;
// window insets and edge-to-edge in Compose, https://developer.android.com/develop/ui/compose/layouts/insets

/** Screens that are a step of their own, where the tab bar would only distract. */
private val NO_TABS = listOf("checkout", "login", "register", "welcome", "receipt")

@Composable
fun IThriftApp(startRoute: String? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val app = remember { AppState(context.applicationContext, scope) }
    val nav = rememberNavController()
    app.nav = nav

    IThriftTheme(app.themeMode, app.largeText, app.reduceMotion) {
        // Dark icons on the light ground, light icons on the dark one.
        val view = LocalView.current
        val dark = C.isDark
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }

        CompositionLocalProvider(LocalApp provides app) {
            LaunchedEffect(Unit) {
                if (!startRoute.isNullOrBlank()) nav.navigate(startRoute)
                app.loadLookups()
                app.refreshCounts()
            }
            // Back from Google sign-in in the browser tab.
            LaunchedEffect(Unit) {
                GoogleSignIn.returned.collect { uri ->
                    if (uri != null) {
                        GoogleSignIn.returned.value = null
                        finishGoogleSignIn(app, uri)
                    }
                }
            }
            // The website checks for new notifications once a minute; so does the app.
            LaunchedEffect(app.user) {
                while (app.isCustomer) {
                    delay(60_000)
                    app.refreshCounts()
                }
            }

            val entry by nav.currentBackStackEntryAsState()
            val route = entry?.destination?.route ?: ""
            val showTabs = NO_TABS.none { route.startsWith(it) }
            val reduce = app.reduceMotion

            Box(Modifier.fillMaxSize().background(C.paper)) {
                Column(Modifier.fillMaxSize()) {
                    NavHost(
                        navController = nav,
                        startDestination = Routes.HOME,
                        modifier = Modifier.weight(1f).fillMaxWidth(),
                        enterTransition = { if (reduce) EnterTransition.None else fadeIn(tween(180)) },
                        exitTransition = { if (reduce) ExitTransition.None else fadeOut(tween(120)) },
                        popEnterTransition = { if (reduce) EnterTransition.None else fadeIn(tween(180)) },
                        popExitTransition = { if (reduce) ExitTransition.None else fadeOut(tween(120)) },
                    ) {
                        composable(Routes.HOME) { HomeScreen() }
                        composable(Routes.SHOP, arguments = listOf(navArgument("f") { type = NavType.StringType; defaultValue = "" })) {
                            ShopScreen(Routes.parseFilters(it.arguments?.getString("f")))
                        }
                        composable(Routes.SEARCH) { SearchScreen() }
                        composable(Routes.PRODUCT, arguments = listOf(navArgument("id") { type = NavType.IntType })) {
                            ProductScreen(it.arguments?.getInt("id") ?: 0)
                        }
                        composable(Routes.COMPARE) { CompareScreen() }
                        composable(Routes.BAG) { BagScreen() }
                        composable(Routes.CHECKOUT) { CheckoutScreen() }
                        composable(Routes.PLACED, arguments = listOf(navArgument("id") { type = NavType.IntType })) {
                            OrderPlacedScreen(it.arguments?.getInt("id") ?: 0)
                        }
                        composable(Routes.WISHLIST) { WishlistScreen() }
                        composable(Routes.ORDERS) { OrdersScreen() }
                        composable(Routes.ORDER, arguments = listOf(navArgument("id") { type = NavType.IntType })) {
                            OrderDetailScreen(it.arguments?.getInt("id") ?: 0)
                        }
                        composable(
                            Routes.RECEIPT,
                            arguments = listOf(navArgument("id") { type = NavType.IntType }, navArgument("gift") { type = NavType.BoolType; defaultValue = false }),
                        ) {
                            ReceiptScreen(it.arguments?.getInt("id") ?: 0, it.arguments?.getBoolean("gift") ?: false)
                        }
                        composable(Routes.RETURNS) { ReturnsScreen() }
                        composable(Routes.ACCOUNT) { AccountScreen() }
                        composable(Routes.SETTINGS) { SettingsScreen() }
                        composable(Routes.STYLE) { StyleScreen() }
                        composable(Routes.POINTS) { PointsScreen() }
                        composable(Routes.SAVED) { SavedSearchesScreen() }
                        composable(Routes.ALERTS) { AlertsScreen() }
                        composable(Routes.NOTIFICATIONS) { NotificationsScreen() }
                        composable(Routes.ADDRESSES, arguments = listOf(navArgument("pick") { type = NavType.BoolType; defaultValue = false })) {
                            AddressesScreen(it.arguments?.getBoolean("pick") ?: false)
                        }
                        composable(Routes.SELL) { SellScreen() }
                        composable(Routes.HELP, arguments = listOf(navArgument("section") { type = NavType.StringType; defaultValue = "" })) {
                            HelpScreen(it.arguments?.getString("section") ?: "")
                        }
                        composable(Routes.SIZE_GUIDE) { SizeGuideScreen() }
                        composable(Routes.CONTACT, arguments = listOf(navArgument("order") { type = NavType.StringType; defaultValue = "" })) {
                            ContactScreen(it.arguments?.getString("order")?.toIntOrNull())
                        }
                        composable(Routes.MESSAGES) { MessagesScreen() }
                        composable(Routes.THREAD, arguments = listOf(navArgument("id") { type = NavType.IntType })) {
                            ThreadScreen(it.arguments?.getInt("id") ?: 0)
                        }
                        composable(Routes.LOGIN, arguments = listOf(navArgument("next") { type = NavType.StringType; defaultValue = "" })) {
                            LoginScreen(it.arguments?.getString("next") ?: "")
                        }
                        composable(Routes.REGISTER, arguments = listOf(navArgument("next") { type = NavType.StringType; defaultValue = "" })) {
                            RegisterScreen(it.arguments?.getString("next") ?: "")
                        }
                        composable(Routes.WELCOME, arguments = listOf(navArgument("next") { type = NavType.StringType; defaultValue = "" })) {
                            WelcomeScreen(it.arguments?.getString("next") ?: "")
                        }
                        composable(Routes.ABOUT) { AboutScreen() }

                        // The staff console
                        composable(Routes.CONSOLE) { ConsoleScreen() }
                        composable(Routes.STAFF_ORDERS, arguments = listOf(navArgument("status") { type = NavType.StringType; defaultValue = "" })) {
                            StaffOrdersScreen(it.arguments?.getString("status") ?: "")
                        }
                        composable(Routes.STAFF_COLLECTIONS) { StaffCollectionsScreen() }
                        composable(Routes.STAFF_RETURNS) { StaffReturnsScreen() }
                        composable(Routes.STAFF_QUESTIONS) { StaffQuestionsScreen() }
                        composable(Routes.STAFF_SELL) { StaffSellScreen() }
                        composable(Routes.STAFF_SUPPORT) { StaffSupportScreen() }
                        composable(Routes.STAFF_LISTINGS) { StaffListingsScreen() }
                        composable(Routes.STAFF_INVENTORY) { StaffInventoryScreen() }
                        composable(Routes.STAFF_PROMOS) { StaffPromosScreen() }
                        composable(Routes.STAFF_CUSTOMERS) { StaffCustomersScreen() }
                    }
                    if (showTabs) TabBar(app)
                }
                ToastHost(
                    app,
                    Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(bottom = if (showTabs) 76.dp else 88.dp),
                )
            }
        }
    }
}
