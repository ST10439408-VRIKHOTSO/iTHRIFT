package com.codecouture.ithrift.ui.returns

import android.content.res.ColorStateList
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.ReturnItem
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentReturnsBinding
import com.codecouture.ithrift.databinding.ItemReturnBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.orders.OrderDetailFragment
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.statusColorRes
import com.codecouture.ithrift.util.timeAgo
import kotlinx.coroutines.launch

/** Every return the customer has asked for, and where each one stands. */
class ReturnsFragment : BaseFragment() {

    private var _binding: FragmentReturnsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentReturnsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Returns", showBack = true)

        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getReturns() }) {
                is ApiOutcome.Success -> render(result.data.returns)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun render(returns: List<ReturnItem>) {
        if (_binding == null) return
        binding.textEmpty.visibility = if (returns.isEmpty()) View.VISIBLE else View.GONE
        binding.layoutItems.removeAllViews()

        val inflater = LayoutInflater.from(requireContext())
        for (item in returns) {
            val row = ItemReturnBinding.inflate(inflater, binding.layoutItems, false)
            val sizeNote = item.size?.let { ", size $it" } ?: ""
            row.textName.text = item.productName + sizeNote
            row.textStatus.text = item.status
            ViewCompat.setBackgroundTintList(
                row.textStatus,
                ColorStateList.valueOf(ContextCompat.getColor(requireContext(), statusColorRes(item.status)))
            )
            val refundNote = if (item.status == "Refunded") "\nRefunded ${formatMoney(item.refundAmount)}" else ""
            row.textMeta.text = "${item.reason}\n${item.orderRef}, requested ${timeAgo(item.createdAt)}$refundNote"
            row.root.setOnClickListener {
                mainActivity().openDetail(OrderDetailFragment.newInstance(item.orderId))
            }
            binding.layoutItems.addView(row.root)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
