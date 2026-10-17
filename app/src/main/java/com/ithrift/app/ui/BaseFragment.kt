package com.ithrift.app.ui

import android.widget.Toast
import androidx.fragment.app.Fragment
import com.ithrift.app.MainActivity
import com.ithrift.app.R
import com.ithrift.app.data.ApiClient
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.SessionManager
import com.ithrift.app.data.safeApiCall

/** Shared helpers so every screen doesn't repeat the same boilerplate. */
abstract class BaseFragment : Fragment() {

    protected fun mainActivity(): MainActivity = requireActivity() as MainActivity

    protected fun apiService() = ApiClient.getService(requireContext())

    protected fun showToast(message: String) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_SHORT).show()
    }

    protected fun isLoggedIn(): Boolean = SessionManager.isLoggedIn(requireContext())

    /** Refreshes the little badge on the Cart tab. Safe to call even when signed out. */
    protected suspend fun refreshCartBadge() {
        if (!isLoggedIn()) {
            mainActivity().updateCartBadge(0)
            return
        }
        when (val result = safeApiCall { apiService().getCart() }) {
            is ApiOutcome.Success -> mainActivity().updateCartBadge(result.data.itemCount)
            is ApiOutcome.Failure -> { /* non-critical, leave the badge as-is */ }
        }
    }

    /** Runs [onAuthenticated] if signed in, otherwise nudges the user to the Account tab. */
    protected fun requireLogin(onAuthenticated: () -> Unit) {
        if (isLoggedIn()) {
            onAuthenticated()
        } else {
            showToast("Please sign in first.")
            mainActivity().selectTab(R.id.nav_account)
        }
    }
}
