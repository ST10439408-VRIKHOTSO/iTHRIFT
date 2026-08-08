package com.codecouture.ithrift.ui.orders

import android.graphics.drawable.GradientDrawable
import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.OrderDetail
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentOrderDetailBinding
import com.codecouture.ithrift.databinding.ItemOrderLineBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.statusColorRes
import com.codecouture.ithrift.util.timeAgo
import kotlinx.coroutines.launch

class OrderDetailFragment : BaseFragment() {

    private var _binding: FragmentOrderDetailBinding? = null
    private val binding get() = _binding!!

    private val orderId: Int by lazy { requireArguments().getInt(ARG_ORDER_ID) }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOrderDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Order", showBack = true)
        loadOrder()
    }

    private fun loadOrder() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getOrder(orderId) }) {
                is ApiOutcome.Success -> bindOrder(result.data.order)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun bindOrder(order: OrderDetail) {
        if (_binding == null) return

        binding.textRef.text = order.ref
        binding.textStatus.text = order.status
        (binding.textStatus.background as? GradientDrawable)?.setColor(
            ContextCompat.getColor(requireContext(), statusColorRes(order.status))
        )
        binding.textPlaced.text = "Placed ${timeAgo(order.createdAt)}"

        if (order.status == "Cancelled") {
            binding.layoutTracker.visibility = View.GONE
        } else {
            binding.layoutTracker.visibility = View.VISIBLE
            val steps = listOf("Processing", "Shipped", "Delivered")
            val currentIndex = steps.indexOf(order.status)
            val stepViews = listOf(binding.textStepProcessing, binding.textStepShipped, binding.textStepDelivered)
            stepViews.forEachIndexed { index, textView ->
                val reached = index <= currentIndex
                textView.setTypeface(null, if (reached) Typeface.BOLD else Typeface.NORMAL)
                textView.setTextColor(
                    ContextCompat.getColor(requireContext(), if (reached) R.color.accent else R.color.muted)
                )
            }
            if (!order.courierRef.isNullOrBlank()) {
                binding.textCourier.visibility = View.VISIBLE
                binding.textCourier.text = "Courier reference: ${order.courierRef}"
            } else {
                binding.textCourier.visibility = View.GONE
            }
        }

        binding.layoutItems.removeAllViews()
        val inflater = LayoutInflater.from(requireContext())
        for (line in order.items) {
            val lineBinding = ItemOrderLineBinding.inflate(inflater, binding.layoutItems, false)
            lineBinding.textLineName.text = "${line.quantity} × ${line.name}"
            lineBinding.textLineTotal.text = formatMoney(line.lineTotal)
            binding.layoutItems.addView(lineBinding.root)
        }

        binding.textTotal.text = formatMoney(order.total)
        binding.textPayment.text = "${order.payment.method.uppercase()} · ${order.payment.status}"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_ORDER_ID = "order_id"

        fun newInstance(orderId: Int): Fragment = OrderDetailFragment().apply {
            arguments = Bundle().apply { putInt(ARG_ORDER_ID, orderId) }
        }
    }
}
