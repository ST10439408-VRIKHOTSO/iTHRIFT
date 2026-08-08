package com.codecouture.ithrift.ui.checkout

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.CheckoutRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentCheckoutBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.formatMoney
import kotlinx.coroutines.launch

class CheckoutFragment : BaseFragment() {

    private var _binding: FragmentCheckoutBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCheckoutBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Checkout", showBack = true)
        loadSummary()

        binding.buttonPlaceOrder.setOnClickListener { placeOrder() }
    }

    private fun loadSummary() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getCart() }) {
                is ApiOutcome.Success -> binding.textTotal.text = formatMoney(result.data.subtotal)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun placeOrder() {
        val method = when (binding.radioGroupPayment.checkedRadioButtonId) {
            R.id.radio_payfast -> "payfast"
            R.id.radio_eft -> "eft"
            else -> "card"
        }

        binding.buttonPlaceOrder.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().checkout(CheckoutRequest(method)) }) {
                is ApiOutcome.Success -> {
                    refreshCartBadge()
                    mainActivity().openDetail(OrderConfirmationFragment.newInstance(result.data.order.id))
                }
                is ApiOutcome.Failure -> {
                    showToast(result.message)
                    if (_binding != null) binding.buttonPlaceOrder.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
