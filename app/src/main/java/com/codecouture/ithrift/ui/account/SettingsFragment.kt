package com.codecouture.ithrift.ui.account

import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.BuildConfig
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.AppSettings
import com.codecouture.ithrift.data.ChangePasswordRequest
import com.codecouture.ithrift.data.SessionManager
import com.codecouture.ithrift.data.UpdateProfileRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentSettingsBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.Validators
import kotlinx.coroutines.launch

/**
 * The Settings screen.
 *
 * Reached from the Account tab, signed in or not. The sections that need an
 * account (details, password) are hidden when signed out, and the sections
 * that belong to the phone (appearance, notifications, connection) are always
 * there, because somebody who cannot connect at all needs the connection settings
 * most, and they are by definition not signed in.
 *
 * Account settings are written through the API so the website sees the same
 * values; device settings go to SharedPreferences through AppSettings. See
 * the comment at the top of AppSettings for why that split matters.
 */
class SettingsFragment : BaseFragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Settings", showBack = true)

        bindDeviceSettings()
        bindAccountSettings()

        binding.textVersion.text = getString(
            R.string.version_line,
            BuildConfig.VERSION_NAME,
            BuildConfig.VERSION_CODE
        )
    }

    // ------------------------------------------------------------------
    // Settings that belong to this phone
    // ------------------------------------------------------------------

    private fun bindDeviceSettings() {
        val context = requireContext()

        // Appearance. The listener is attached after the current value is
        // set, so restoring the saved state does not itself count as a change
        // and re-apply the theme (which recreates the activity).
        when (AppSettings.getThemeMode(context)) {
            AppSettings.ThemeMode.SYSTEM -> binding.radioThemeSystem.isChecked = true
            AppSettings.ThemeMode.LIGHT -> binding.radioThemeLight.isChecked = true
            AppSettings.ThemeMode.DARK -> binding.radioThemeDark.isChecked = true
        }
        binding.groupTheme.setOnCheckedChangeListener { _, checkedId ->
            val mode = when (checkedId) {
                R.id.radio_theme_light -> AppSettings.ThemeMode.LIGHT
                R.id.radio_theme_dark -> AppSettings.ThemeMode.DARK
                else -> AppSettings.ThemeMode.SYSTEM
            }
            Log.d(TAG, "Theme changed to ${mode.stored}")
            AppSettings.setThemeMode(context, mode)
        }

        // Notifications.
        binding.switchOrderUpdates.isChecked = AppSettings.orderNotificationsEnabled(context)
        binding.switchOrderUpdates.setOnCheckedChangeListener { _, isChecked ->
            AppSettings.setOrderNotificationsEnabled(context, isChecked)
            showToast(if (isChecked) "Order updates on." else "Order updates off.")
        }
        binding.switchPromotions.isChecked = AppSettings.promotionNotificationsEnabled(context)
        binding.switchPromotions.setOnCheckedChangeListener { _, isChecked ->
            AppSettings.setPromotionNotificationsEnabled(context, isChecked)
        }

        // Connection.
        binding.inputServerUrl.setText(AppSettings.getServerUrl(context))
        binding.buttonSaveServer.setOnClickListener { saveServerUrl() }
        binding.buttonTestConnection.setOnClickListener { testConnection() }

        // Reset.
        binding.buttonClearCache.setOnClickListener {
            AppSettings.clearCachedData(context)
            showMessage(
                "Cached data cleared. Your settings and your session are untouched.",
                isError = false
            )
        }
        binding.buttonSignOut.setOnClickListener { signOut() }
    }

    private fun saveServerUrl() {
        val url = binding.inputServerUrl.text?.toString()?.trim().orEmpty()
        if (url.isEmpty()) {
            showMessage("Enter a server address first.", isError = true)
            return
        }
        AppSettings.setServerUrl(requireContext(), url)
        Log.i(TAG, "Server address saved")
        showMessage("Server address saved.", isError = false)
        // Prove it straight away rather than leaving the customer to find out
        // on their next tap that the address was wrong.
        testConnection()
    }

    /** Calls GET /api and reports what came back, so a bad address is obvious here. */
    private fun testConnection() {
        val status = binding.textConnectionStatus
        status.visibility = View.VISIBLE
        status.setTextColor(ContextCompat.getColor(requireContext(), R.color.muted))
        status.text = getString(R.string.connection_checking)

        viewLifecycleOwner.lifecycleScope.launch {
            // getBrands() is the cheapest authenticated-free endpoint that
            // proves the whole chain: address resolved, server up, API routed,
            // JSON parsed.
            when (val result = safeApiCall { apiService().getBrands() }) {
                is ApiOutcome.Success -> {
                    if (_binding == null) return@launch
                    status.setTextColor(ContextCompat.getColor(requireContext(), R.color.good))
                    status.text = getString(R.string.connection_ok, result.data.brands.size)
                }
                is ApiOutcome.Failure -> {
                    if (_binding == null) return@launch
                    status.setTextColor(ContextCompat.getColor(requireContext(), R.color.bad))
                    status.text = result.message
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Settings that belong to the account
    // ------------------------------------------------------------------

    private fun bindAccountSettings() {
        if (!isLoggedIn()) {
            binding.groupProfile.visibility = View.GONE
            binding.groupPassword.visibility = View.GONE
            binding.buttonSignOut.visibility = View.GONE
            return
        }

        binding.buttonSaveProfile.setOnClickListener { saveProfile() }
        binding.buttonChangePassword.setOnClickListener { changePassword() }
        loadProfile()
    }

    private fun loadProfile() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getProfile() }) {
                is ApiOutcome.Success -> {
                    if (_binding == null) return@launch
                    val profile = result.data.profile
                    binding.textProfileEmail.text = getString(R.string.settings_signed_in_as, profile.email)
                    binding.inputFirstName.setText(profile.firstName)
                    binding.inputLastName.setText(profile.lastName)
                    binding.inputPhone.setText(profile.phone.orEmpty())
                    binding.inputAddress.setText(profile.address.orEmpty())
                    binding.inputCity.setText(profile.city.orEmpty())
                    binding.inputPostalCode.setText(profile.postalCode.orEmpty())

                    // A Google account has no password here, so the section is
                    // removed rather than shown and then rejected by the server.
                    binding.groupPassword.visibility =
                        if (profile.canChangePassword) View.VISIBLE else View.GONE
                }
                is ApiOutcome.Failure -> {
                    if (_binding == null) return@launch
                    showMessage(result.message, isError = true)
                }
            }
        }
    }

    private fun saveProfile() {
        val firstName = binding.inputFirstName.textOrEmpty()
        val lastName = binding.inputLastName.textOrEmpty()
        val phone = binding.inputPhone.textOrEmpty()
        val city = binding.inputCity.textOrEmpty()
        val postalCode = binding.inputPostalCode.textOrEmpty()
        val address = binding.inputAddress.textOrEmpty()

        // Validated here as well as on the server: the same rules, but the
        // customer sees them without waiting for a round trip.
        val firstError = Validators.required(firstName, "First name")
            ?: Validators.required(lastName, "Last name")
            ?: Validators.phone(phone)
            ?: Validators.postalCode(postalCode)

        if (firstError != null) {
            showMessage(firstError, isError = true)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val request = UpdateProfileRequest(
                firstName = firstName,
                lastName = lastName,
                // Blank means "not set", which is null in the database, not "".
                phone = phone.ifBlank { null },
                address = address.ifBlank { null },
                city = city.ifBlank { null },
                postalCode = postalCode.ifBlank { null }
            )
            when (val result = safeApiCall { apiService().updateProfile(request) }) {
                is ApiOutcome.Success -> {
                    if (_binding == null) return@launch
                    // The name is cached in the session for the header, so it
                    // has to be refreshed here too or the old one lingers.
                    SessionManager.saveSession(
                        requireContext(),
                        SessionManager.getToken(requireContext()).orEmpty(),
                        result.data.user
                    )
                    mainActivity().updateHeaderUi()
                    Log.i(TAG, "Profile saved")
                    showMessage("Your details have been saved.", isError = false)
                    loadProfile()
                }
                is ApiOutcome.Failure -> {
                    if (_binding == null) return@launch
                    showMessage(result.message, isError = true)
                }
            }
        }
    }

    private fun changePassword() {
        val current = binding.inputCurrentPassword.text?.toString().orEmpty()
        val next = binding.inputNewPassword.text?.toString().orEmpty()

        val error = Validators.passwordPresent(current) ?: Validators.password(next)
        if (error != null) {
            showMessage(error, isError = true)
            return
        }
        if (current == next) {
            showMessage("Your new password must be different from your current one.", isError = true)
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val request = ChangePasswordRequest(currentPassword = current, newPassword = next)
            when (val result = safeApiCall { apiService().changePassword(request) }) {
                is ApiOutcome.Success -> {
                    if (_binding == null) return@launch
                    // Never leave a password sitting in a field behind a
                    // screen the customer may hand to somebody else.
                    binding.inputCurrentPassword.setText("")
                    binding.inputNewPassword.setText("")
                    Log.i(TAG, "Password changed")
                    showMessage("Your password has been changed.", isError = false)
                }
                is ApiOutcome.Failure -> {
                    if (_binding == null) return@launch
                    showMessage(result.message, isError = true)
                }
            }
        }
    }

    private fun signOut() {
        viewLifecycleOwner.lifecycleScope.launch {
            safeApiCall { apiService().logout() } // best effort; the local session goes either way
            SessionManager.clearSession(requireContext())
            mainActivity().updateCartBadge(0)
            mainActivity().updateHeaderUi()
            showToast("Signed out.")
            mainActivity().selectTab(R.id.nav_shop)
        }
    }

    // ------------------------------------------------------------------

    /** One message banner at the top of the screen, green for success, red for a problem. */
    private fun showMessage(message: String, isError: Boolean) {
        if (_binding == null) return
        val context = requireContext()
        binding.textMessage.visibility = View.VISIBLE
        binding.textMessage.text = message
        binding.textMessage.setBackgroundColor(
            ContextCompat.getColor(context, if (isError) R.color.error_bg else R.color.condition_excellent_bg)
        )
        binding.textMessage.setTextColor(
            ContextCompat.getColor(context, if (isError) R.color.bad else R.color.condition_excellent_text)
        )
    }

    private fun EditText.textOrEmpty(): String = text?.toString()?.trim().orEmpty()

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private companion object {
        const val TAG = "SettingsFragment"
    }
}
