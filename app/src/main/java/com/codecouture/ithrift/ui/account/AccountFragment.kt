package com.codecouture.ithrift.ui.account

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.AuthResponse
import com.codecouture.ithrift.data.GoogleSignIn
import com.codecouture.ithrift.data.LoginRequest
import com.codecouture.ithrift.data.RegisterRequest
import com.codecouture.ithrift.data.SessionManager
import com.codecouture.ithrift.data.SsoLoginRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentAccountBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.addresses.AddressesFragment
import com.codecouture.ithrift.ui.returns.ReturnsFragment
import com.codecouture.ithrift.ui.wishlist.WishlistFragment
import com.codecouture.ithrift.util.Validators
import kotlinx.coroutines.launch

/**
 * The Account tab: sign in, sign in with Google, register, and the way
 * through to Settings, Help and Orders.
 *
 * Three routes into a session, all ending in the same place: an API-issued
 * bearer token in SessionManager. The screen does not care which route was
 * taken after that point, which is what keeps the rest of the app free of
 * "was this a Google user?" checks.
 */
class AccountFragment : BaseFragment() {

    private var _binding: FragmentAccountBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAccountBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Account", showBack = false)

        binding.buttonLogin.setOnClickListener { login() }
        binding.buttonRegister.setOnClickListener { register() }
        binding.buttonGoogleSignIn.setOnClickListener { signInWithGoogle() }
        binding.buttonSignOut.setOnClickListener { signOut() }
        binding.buttonMyOrders.setOnClickListener { mainActivity().selectTab(R.id.nav_orders) }
        binding.buttonWishlist.setOnClickListener { mainActivity().openDetail(WishlistFragment()) }
        binding.buttonAddresses.setOnClickListener { mainActivity().openDetail(AddressesFragment()) }
        binding.buttonReturns.setOnClickListener { mainActivity().openDetail(ReturnsFragment()) }

        binding.buttonSettings.setOnClickListener { openSettings() }
        binding.buttonSettingsLoggedOut.setOnClickListener { openSettings() }
        binding.buttonHelp.setOnClickListener { openHelp() }
        binding.buttonHelpLoggedOut.setOnClickListener { openHelp() }

        refreshUi()
        checkSsoAvailability()
    }

    private fun openSettings() = mainActivity().openDetail(SettingsFragment())

    private fun openHelp() = mainActivity().openDetail(HelpFragment())

    private fun refreshUi() {
        if (_binding == null) return
        binding.textError.visibility = View.GONE
        if (isLoggedIn()) {
            binding.groupLoggedIn.visibility = View.VISIBLE
            binding.groupLoggedOut.visibility = View.GONE
            binding.textUserName.text = SessionManager.getUser(requireContext())?.name.orEmpty()
        } else {
            binding.groupLoggedIn.visibility = View.GONE
            binding.groupLoggedOut.visibility = View.VISIBLE
        }
    }

    /**
     * The Google button appears only when both ends can honour it: this build
     * has a client id, and the server it is pointed at is configured to verify
     * the resulting token. A button that always fails is worse than no button,
     * and the two halves are configured separately, so both are checked.
     */
    private fun checkSsoAvailability() {
        if (!GoogleSignIn.isConfigured) {
            Log.i(TAG, "No Google client id in this build; hiding single sign-on")
            binding.groupSso.visibility = View.GONE
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val enabled = when (val result = safeApiCall { apiService().ssoStatus() }) {
                is ApiOutcome.Success -> result.data.enabled
                // If we cannot reach the server we cannot know. Show the
                // button: the customer has a working password route on the
                // same screen either way, and hiding it would be misleading
                // once the server comes back.
                is ApiOutcome.Failure -> true
            }
            if (_binding == null) return@launch
            binding.groupSso.visibility = if (enabled) View.VISIBLE else View.GONE
        }
    }

    // ------------------------------------------------------------------
    // The three ways in
    // ------------------------------------------------------------------

    private fun login() {
        val identifier = binding.inputLoginEmail.text?.toString()?.trim().orEmpty()
        val password = binding.inputLoginPassword.text?.toString().orEmpty()

        // Staff sign in with a username rather than an email, so the identifier
        // is only checked for being present. The server tells the two apart.
        val error = Validators.required(identifier, "Email") ?: Validators.passwordPresent(password)
        if (error != null) {
            showError(error)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            setBusy(true)
            when (val result = safeApiCall { apiService().login(LoginRequest(identifier, password)) }) {
                is ApiOutcome.Success -> onSignedIn(result.data)
                is ApiOutcome.Failure -> {
                    setBusy(false)
                    showError(result.message)
                }
            }
        }
    }

    private fun signInWithGoogle() {
        viewLifecycleOwner.lifecycleScope.launch {
            setBusy(true)
            // requireActivity(), not requireContext(): Credential Manager
            // shows a system sheet over the activity and needs its context.
            when (val credential = GoogleSignIn.requestIdToken(requireActivity())) {
                is GoogleSignIn.Result.Cancelled -> {
                    // The customer changed their mind. Silence is the right response.
                    setBusy(false)
                }
                is GoogleSignIn.Result.Failure -> {
                    setBusy(false)
                    showError(credential.message)
                }
                is GoogleSignIn.Result.Token -> {
                    // The token means nothing until the API has verified it
                    // with Google, which is where the account is created or
                    // matched. See server/routes/auth.js.
                    val request = SsoLoginRequest(idToken = credential.idToken)
                    when (val result = safeApiCall { apiService().ssoLogin(request) }) {
                        is ApiOutcome.Success -> {
                            Log.i(TAG, "Signed in through Google")
                            onSignedIn(result.data)
                        }
                        is ApiOutcome.Failure -> {
                            setBusy(false)
                            showError(result.message)
                        }
                    }
                }
            }
        }
    }

    private fun register() {
        val firstName = binding.inputRegisterFirstName.text?.toString()?.trim().orEmpty()
        val lastName = binding.inputRegisterLastName.text?.toString()?.trim().orEmpty()
        val email = binding.inputRegisterEmail.text?.toString()?.trim().orEmpty()
        val password = binding.inputRegisterPassword.text?.toString().orEmpty()

        val error = Validators.required(firstName, "First name")
            ?: Validators.required(lastName, "Last name")
            ?: Validators.email(email)
            ?: Validators.password(password)

        if (error != null) {
            showError(error)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            setBusy(true)
            val request = RegisterRequest(firstName = firstName, lastName = lastName, email = email, password = password)
            when (val result = safeApiCall { apiService().register(request) }) {
                is ApiOutcome.Success -> onSignedIn(result.data, welcomeNewCustomer = true)
                is ApiOutcome.Failure -> {
                    setBusy(false)
                    showError(result.message)
                }
            }
        }
    }

    /** The single path every successful sign-in takes, whichever route got here. */
    private suspend fun onSignedIn(auth: AuthResponse, welcomeNewCustomer: Boolean = false) {
        val user = auth.user
        if (user.type != "customer") {
            // Staff and administrator work happens in the console on the
            // website; there are no admin screens in this app to send them to.
            setBusy(false)
            showError("The mobile app is for customer accounts. Staff should use the desktop website.")
            return
        }

        SessionManager.saveSession(requireContext(), auth.token, user)
        refreshCartBadge()
        setBusy(false)
        refreshUi()
        mainActivity().updateHeaderUi()

        val firstName = user.name.split(" ").first()
        showToast(if (welcomeNewCustomer) "Welcome to iTHRIFT, $firstName!" else "Welcome back, $firstName!")
        mainActivity().selectTab(R.id.nav_shop)
    }

    private fun signOut() {
        viewLifecycleOwner.lifecycleScope.launch {
            safeApiCall { apiService().logout() } // best effort; proceed regardless of the result
            SessionManager.clearSession(requireContext())
            if (_binding != null) {
                refreshUi()
                mainActivity().updateHeaderUi()
                showToast("Signed out.")
            }
            mainActivity().updateCartBadge(0)
            mainActivity().selectTab(R.id.nav_shop)
        }
    }

    // ------------------------------------------------------------------

    /** Disables the sign-in controls while a request is in flight, so nothing is submitted twice. */
    private fun setBusy(busy: Boolean) {
        if (_binding == null) return
        binding.buttonLogin.isEnabled = !busy
        binding.buttonRegister.isEnabled = !busy
        binding.buttonGoogleSignIn.isEnabled = !busy
    }

    private fun showError(message: String) {
        if (_binding == null) return
        binding.textError.visibility = View.VISIBLE
        binding.textError.text = message
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private companion object {
        const val TAG = "AccountFragment"
    }
}
