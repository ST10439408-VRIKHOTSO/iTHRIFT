package com.codecouture.ithrift.ui.orders

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.OrderListItem
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentOrdersBinding
import com.codecouture.ithrift.databinding.ItemOrderBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.statusColorRes
import com.codecouture.ithrift.util.timeAgo
import kotlinx.coroutines.launch

class OrdersFragment : BaseFragment() {

    private var _binding: FragmentOrdersBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentOrdersBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("My orders", showBack = false)
        loadOrders()
    }

    private fun loadOrders() {
        if (!isLoggedIn()) {
            showEmpty("Sign in to view your orders.")
            return
        }
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getOrders() }) {
                is ApiOutcome.Success -> renderOrders(result.data.orders)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun renderOrders(orders: List<OrderListItem>) {
        if (_binding == null) return
        if (orders.isEmpty()) {
            showEmpty("No orders yet")
            return
        }
        binding.textEmpty.visibility = View.GONE
        binding.layoutOrders.visibility = View.VISIBLE
        binding.layoutOrders.removeAllViews()

        val inflater = LayoutInflater.from(requireContext())
        for (order in orders) {
            val itemBinding = ItemOrderBinding.inflate(inflater, binding.layoutOrders, false)
            itemBinding.textRef.text = order.ref
            itemBinding.textStatus.text = order.status
            (itemBinding.textStatus.background as? GradientDrawable)?.setColor(
                ContextCompat.getColor(requireContext(), statusColorRes(order.status))
            )
            itemBinding.textDate.text = timeAgo(order.createdAt)
            itemBinding.textTotal.text = formatMoney(order.total)
            itemBinding.root.setOnClickListener {
                mainActivity().openDetail(OrderDetailFragment.newInstance(order.id))
            }
            binding.layoutOrders.addView(itemBinding.root)
        }
    }

    private fun showEmpty(message: String) {
        if (_binding == null) return
        binding.textEmpty.visibility = View.VISIBLE
        binding.textEmpty.text = message
        binding.layoutOrders.visibility = View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
