package com.codecouture.ithrift.ui.account

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiClient
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.LoginRequest
import com.codecouture.ithrift.data.LookupCache
import com.codecouture.ithrift.data.RegisterRequest
import com.codecouture.ithrift.data.SessionManager
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentAccountBinding
import com.codecouture.ithrift.ui.BaseFragment
import kotlinx.coroutines.launch

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

        binding.inputServerUrl.setText(SessionManager.getServerUrl(requireContext()))
        binding.buttonSaveServer.setOnClickListener { saveServerUrl() }
        binding.buttonLogin.setOnClickListener { login() }
        binding.buttonRegister.setOnClickListener { register() }
        binding.buttonSignOut.setOnClickListener { signOut() }
        binding.buttonMyOrders.setOnClickListener { mainActivity().selectTab(R.id.nav_orders) }

        refreshUi()
    }

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

    private fun saveServerUrl() {
        val url = binding.inputServerUrl.text?.toString()?.trim().orEmpty()
        if (url.isEmpty()) {
            showToast("Enter a server address first.")
            return
        }
        SessionManager.setServerUrl(requireContext(), url)
        ApiClient.reset()
        LookupCache.clear()
        showToast("Server address saved.")
    }

    private fun login() {
        val identifier = binding.inputLoginEmail.text?.toString()?.trim().orEmpty()
        val password = binding.inputLoginPassword.text?.toString().orEmpty()
        if (identifier.isEmpty() || password.isEmpty()) {
            showError("Please enter your email and password.")
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().login(LoginRequest(identifier, password)) }) {
                is ApiOutcome.Success -> {
                    val user = result.data.user
                    if (user.type != "customer") {
                        showError("The mobile app is for customer accounts. Staff should use the desktop website.")
                        return@launch
                    }
                    SessionManager.saveSession(requireContext(), result.data.token, user)
                    refreshCartBadge()
                    refreshUi()
                    mainActivity().updateHeaderUi()
                    showToast("Welcome back, ${user.name.split(" ").first()}!")
                    mainActivity().selectTab(R.id.nav_shop)
                }
                is ApiOutcome.Failure -> showError(result.message)
            }
        }
    }

    private fun register() {
        val firstName = binding.inputRegisterFirstName.text?.toString()?.trim().orEmpty()
        val lastName = binding.inputRegisterLastName.text?.toString()?.trim().orEmpty()
        val email = binding.inputRegisterEmail.text?.toString()?.trim().orEmpty()
        val password = binding.inputRegisterPassword.text?.toString().orEmpty()

        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || password.isEmpty()) {
            showError("Please fill in all fields to create an account.")
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val request = RegisterRequest(firstName = firstName, lastName = lastName, email = email, password = password)
            when (val result = safeApiCall { apiService().register(request) }) {
                is ApiOutcome.Success -> {
                    SessionManager.saveSession(requireContext(), result.data.token, result.data.user)
                    refreshCartBadge()
                    refreshUi()
                    mainActivity().updateHeaderUi()
                    showToast("Welcome to iTHRIFT, $firstName!")
                    mainActivity().selectTab(R.id.nav_shop)
                }
                is ApiOutcome.Failure -> showError(result.message)
            }
        }
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

    private fun showError(message: String) {
        if (_binding == null) return
        binding.textError.visibility = View.VISIBLE
        binding.textError.text = message
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
