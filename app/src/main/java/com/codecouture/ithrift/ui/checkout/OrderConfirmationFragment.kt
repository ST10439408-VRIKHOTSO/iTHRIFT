package com.codecouture.ithrift.ui.checkout

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentOrderConfirmationBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.formatMoney
import kotlinx.coroutines.launch

class OrderConfirmationFragment : BaseFragment() {

    private var _binding: FragmentOrderConfirmationBinding? = null
    private val binding get() = _binding!!

    private val orderId: Int by lazy { requireArguments().getInt(ARG_ORDER_ID) }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOrderConfirmationBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Order placed", showBack = false)

        binding.buttonTrack.setOnClickListener {
            mainActivity().selectTab(R.id.nav_orders)
        }

        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getOrder(orderId) }) {
                is ApiOutcome.Success -> {
                    val order = result.data.order
                    val firstName = order.customer.name.split(" ").firstOrNull().orEmpty()
                    binding.textThanks.text = "Thanks, $firstName!"
                    binding.textSummary.text = "Order ${order.ref} · ${formatMoney(order.total)}"
                }
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_ORDER_ID = "order_id"

        fun newInstance(orderId: Int): Fragment = OrderConfirmationFragment().apply {
            arguments = Bundle().apply { putInt(ARG_ORDER_ID, orderId) }
        }
    }
}
