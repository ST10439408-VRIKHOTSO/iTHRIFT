package com.codecouture.ithrift.ui.orders

import android.content.res.ColorStateList
import android.graphics.drawable.GradientDrawable
import android.graphics.Typeface
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.OrderDetail
import com.codecouture.ithrift.data.OrderDetailResponse
import com.codecouture.ithrift.data.OrderLineItem
import com.codecouture.ithrift.data.ReturnRequestBody
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentOrderDetailBinding
import com.codecouture.ithrift.databinding.ItemOrderLineBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.statusColorRes
import com.codecouture.ithrift.util.timeAgo
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

class OrderDetailFragment : BaseFragment() {

    private var _binding: FragmentOrderDetailBinding? = null
    private val binding get() = _binding!!

    private val orderId: Int by lazy { requireArguments().getInt(ARG_ORDER_ID) }

    /** The reasons a customer may give for a return. Replaced by the server's list once it loads. */
    private var returnReasons: List<String> = listOf(
        "Doesn't fit", "Not as described", "Damaged or faulty", "Changed my mind", "Wrong item received"
    )

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
            val options = safeApiCall { apiService().getOrderOptions() }
            if (options is ApiOutcome.Success && options.data.returnReasons.isNotEmpty()) {
                returnReasons = options.data.returnReasons
            }
            showResult(safeApiCall { apiService().getOrder(orderId) }, null)
        }
    }

    /** Cancelling and returning both answer with the updated order, so one function redraws it. */
    private fun showResult(result: ApiOutcome<OrderDetailResponse>, successMessage: String?) {
        if (_binding == null) return
        when (result) {
            is ApiOutcome.Success -> {
                bindOrder(result.data.order)
                if (successMessage != null) showToast(successMessage)
            }
            is ApiOutcome.Failure -> showToast(result.message)
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
            val sizeSuffix = line.size?.let { " ($it)" } ?: ""
            lineBinding.textLineName.text = "${line.quantity} × ${line.name}$sizeSuffix"
            lineBinding.textLineTotal.text = formatMoney(line.lineTotal)

            val returnStatus = line.returnStatus
            if (returnStatus != null) {
                lineBinding.textReturnStatus.visibility = View.VISIBLE
                lineBinding.textReturnStatus.text = "Return ${returnStatus.lowercase()}"
                ViewCompat.setBackgroundTintList(
                    lineBinding.textReturnStatus,
                    ColorStateList.valueOf(ContextCompat.getColor(requireContext(), statusColorRes(returnStatus)))
                )
            } else {
                lineBinding.textReturnStatus.visibility = View.GONE
            }
            if (line.canReturn) {
                lineBinding.buttonReturn.visibility = View.VISIBLE
                lineBinding.buttonReturn.setOnClickListener { chooseReturnReason(line) }
            } else {
                lineBinding.buttonReturn.visibility = View.GONE
            }

            binding.layoutItems.addView(lineBinding.root)
        }

        // Subtotal, discount and delivery, when the order carries them.
        val breakdown = mutableListOf<String>()
        order.subtotal?.takeIf { it > 0 }?.let { breakdown.add("Subtotal: ${formatMoney(it)}") }
        order.discount?.takeIf { it > 0 }?.let {
            val code = order.promoCode?.let { promo -> " ($promo)" } ?: ""
            breakdown.add("Promo$code: -${formatMoney(it)}")
        }
        order.deliveryFee?.let { fee ->
            breakdown.add("${order.deliveryLabel ?: "Delivery"}: ${if (fee > 0) formatMoney(fee) else "Free"}")
        }
        if (breakdown.isEmpty()) {
            binding.textBreakdown.visibility = View.GONE
        } else {
            binding.textBreakdown.visibility = View.VISIBLE
            binding.textBreakdown.text = breakdown.joinToString("\n")
        }

        binding.textTotal.text = formatMoney(order.total)
        binding.textPayment.text = "${order.payment.method.uppercase()} · ${order.payment.status}"

        if (order.returnWindowOpen) {
            binding.textReturnWindow.visibility = View.VISIBLE
            val days = order.returnDaysLeft
            binding.textReturnWindow.text = "You can return items for $days more ${if (days == 1) "day" else "days"}."
        } else {
            binding.textReturnWindow.visibility = View.GONE
        }

        val address = order.deliveryAddress
        if (address.isNullOrBlank()) {
            binding.layoutDelivery.visibility = View.GONE
        } else {
            binding.layoutDelivery.visibility = View.VISIBLE
            binding.textDeliveryTitle.text = if (order.deliveryMethod == "collection") "Collection" else "Delivery"
            val instructions = order.deliveryInstructions?.takeIf { it.isNotBlank() }?.let { "\nInstructions: $it" } ?: ""
            binding.textDelivery.text = "${order.deliveryLabel ?: "Standard delivery"}\n$address$instructions"
        }

        if (order.canCancel) {
            binding.buttonCancelOrder.visibility = View.VISIBLE
            binding.buttonCancelOrder.setOnClickListener { confirmCancel(order) }
        } else {
            binding.buttonCancelOrder.visibility = View.GONE
        }
    }

    private fun confirmCancel(order: OrderDetail) {
        val refundNote = if (order.payment.status == "paid") " Your payment will be refunded." else ""
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Cancel ${order.ref}?")
            .setMessage("The items go back on sale and this cannot be undone.$refundNote")
            .setNegativeButton("Keep order", null)
            .setPositiveButton("Cancel order") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    showResult(safeApiCall { apiService().cancelOrder(orderId) }, "Your order has been cancelled")
                }
            }
            .show()
    }

    /** A return starts with one tap on a reason, then a confirmation. */
    private fun chooseReturnReason(line: OrderLineItem) {
        val reasons = returnReasons.toTypedArray()
        var picked = 0
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Why are you returning ${line.name}?")
            .setSingleChoiceItems(reasons, picked) { _, which -> picked = which }
            .setNegativeButton("Back", null)
            .setPositiveButton("Request return") { _, _ ->
                val body = ReturnRequestBody(line.orderItemId, reasons[picked], null)
                viewLifecycleOwner.lifecycleScope.launch {
                    showResult(safeApiCall { apiService().requestReturn(orderId, body) }, "Return requested")
                }
            }
            .show()
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
