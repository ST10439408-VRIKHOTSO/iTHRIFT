package com.codecouture.ithrift

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.codecouture.ithrift.data.SessionManager
import com.codecouture.ithrift.databinding.ActivityMainBinding
import com.codecouture.ithrift.ui.account.AccountFragment
import com.codecouture.ithrift.ui.cart.CartFragment
import com.codecouture.ithrift.ui.orders.OrdersFragment
import com.codecouture.ithrift.ui.search.SearchFragment
import com.codecouture.ithrift.ui.shop.ShopFragment

/**
 * Single-Activity shell: a toolbar, a fragment container, and a bottom
 * navigation bar with the same five tabs as the mobile PWA (Shop, Search,
 * Cart, Orders, Account). Each fragment is responsible for setting its own
 * toolbar title and back-arrow visibility in onViewCreated(), so the
 * toolbar is always correct however a screen was reached (tab tap, forward
 * navigation, or the system back button popping the fragment back stack).
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayShowTitleEnabled(false)

        binding.bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                R.id.nav_shop -> { showRootFragment(ShopFragment()); true }
                R.id.nav_search -> { showRootFragment(SearchFragment()); true }
                R.id.nav_cart -> { showRootFragment(CartFragment()); true }
                R.id.nav_orders -> { showRootFragment(OrdersFragment()); true }
                R.id.nav_account -> { showRootFragment(AccountFragment()); true }
                else -> false
            }
        }

        binding.btnLoginHeader.setOnClickListener { selectTab(R.id.nav_account) }

        if (savedInstanceState == null) {
            binding.bottomNav.selectedItemId = R.id.nav_shop
        }
    }

    override fun onResume() {
        super.onResume()
        updateHeaderUi()
    }

    fun updateHeaderUi() {
        val user = SessionManager.getUser(this)
        if (user != null) {
            binding.btnLoginHeader.text = "Account"
        } else {
            binding.btnLoginHeader.text = "Login"
        }
    }

    /** Switches to one of the five bottom-tab root screens, clearing any detail screens on the back stack. */
    private fun showRootFragment(fragment: Fragment) {
        supportFragmentManager.popBackStack(BACKSTACK_ROOT, androidx.fragment.app.FragmentManager.POP_BACK_STACK_INCLUSIVE)
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .commit()
    }

    /** Opens a detail screen (product, checkout, order detail, ...) on top of the current tab. */
    fun openDetail(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.fragment_container, fragment)
            .addToBackStack(BACKSTACK_ROOT)
            .commit()
    }

    fun goBack() {
        supportFragmentManager.popBackStack()
    }

    /** Called by every fragment in onViewCreated() so the toolbar always reflects the current screen. */
    fun setToolbarTitle(title: String, showBack: Boolean) {
        // With the custom header design, we might not want to change the title text every time.
        // But for deep navigation, we can show a back button.
        if (showBack) {
            binding.toolbar.setNavigationIcon(R.drawable.ic_back)
            binding.toolbar.setNavigationOnClickListener { goBack() }
        } else {
            binding.toolbar.navigationIcon = null
            binding.toolbar.setNavigationOnClickListener(null)
        }
    }

    /** Jumps to a bottom tab programmatically (e.g. after checkout, after sign-out). */
    fun selectTab(itemId: Int) {
        binding.bottomNav.selectedItemId = itemId
    }

    fun updateCartBadge(count: Int) {
        val badge = binding.bottomNav.getOrCreateBadge(R.id.nav_cart)
        if (count > 0) {
            badge.isVisible = true
            badge.number = count
        } else {
            badge.isVisible = false
        }
    }

    companion object {
        private const val BACKSTACK_ROOT = "root"
    }
}
