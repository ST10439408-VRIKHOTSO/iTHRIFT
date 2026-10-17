package com.ithrift.app.ui.cart

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.CartItem
import com.ithrift.app.data.CartResponse
import com.ithrift.app.data.UpdateCartItemRequest
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.databinding.FragmentCartBinding
import com.ithrift.app.databinding.ItemCartLineBinding
import com.ithrift.app.ui.BaseFragment
import com.ithrift.app.ui.checkout.CheckoutFragment
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.resolveImageUrl
import coil.load
import kotlinx.coroutines.launch

class CartFragment : BaseFragment() {

    private var _binding: FragmentCartBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCartBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Cart", showBack = false)
        loadCart()
    }

    private fun loadCart() {
        if (!isLoggedIn()) {
            showEmpty("Sign in to view your cart.")
            return
        }
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getCart() }) {
                is ApiOutcome.Success -> renderCart(result.data)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun renderCart(cart: CartResponse) {
        if (_binding == null) return
        if (cart.items.isEmpty()) {
            showEmpty("Your cart is empty")
            return
        }

        binding.textEmpty.visibility = View.GONE
        binding.layoutLines.visibility = View.VISIBLE
        binding.layoutSummary.visibility = View.VISIBLE

        binding.layoutLines.removeAllViews()
        val inflater = LayoutInflater.from(requireContext())
        for (item in cart.items) {
            val itemBinding = ItemCartLineBinding.inflate(inflater, binding.layoutLines, false)
            bindLine(itemBinding, item)
            binding.layoutLines.addView(itemBinding.root)
        }

        binding.textSubtotal.text = formatMoney(cart.subtotal)
        binding.buttonCheckout.setOnClickListener {
            mainActivity().openDetail(CheckoutFragment())
        }
    }

    private fun bindLine(itemBinding: ItemCartLineBinding, item: CartItem) {
        itemBinding.textName.text = item.name
        val sizePrefix = item.size?.let { "Size $it · " } ?: ""
        itemBinding.textPriceEach.text = "$sizePrefix${formatMoney(item.price)} each"
        itemBinding.textQty.text = item.quantity.toString()
        itemBinding.imageThumb.load(resolveImageUrl(requireContext(), item.image)) {
            crossfade(true)
        }
        itemBinding.buttonMinus.setOnClickListener { changeQuantity(item, item.quantity - 1) }
        itemBinding.buttonPlus.setOnClickListener { changeQuantity(item, item.quantity + 1) }
    }

    private fun changeQuantity(item: CartItem, newQuantity: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            val outcome = if (newQuantity < 1) {
                safeApiCall { apiService().removeCartItem(item.id) }
            } else {
                safeApiCall { apiService().updateCartItem(item.id, UpdateCartItemRequest(newQuantity)) }
            }
            when (outcome) {
                is ApiOutcome.Success -> {
                    renderCart(outcome.data)
                    refreshCartBadge()
                }
                is ApiOutcome.Failure -> showToast(outcome.message)
            }
        }
    }

    private fun showEmpty(message: String) {
        if (_binding == null) return
        binding.textEmpty.visibility = View.VISIBLE
        binding.textEmpty.text = message
        binding.layoutLines.visibility = View.GONE
        binding.layoutSummary.visibility = View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
