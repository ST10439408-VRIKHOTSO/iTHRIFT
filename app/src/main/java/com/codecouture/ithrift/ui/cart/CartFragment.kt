package com.codecouture.ithrift.ui.cart

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.CartItem
import com.codecouture.ithrift.data.CartResponse
import com.codecouture.ithrift.data.UpdateCartItemRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentCartBinding
import com.codecouture.ithrift.databinding.ItemCartLineBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.checkout.CheckoutFragment
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.resolveImageUrl
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
        itemBinding.textPriceEach.text = "${formatMoney(item.price)} each"
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
