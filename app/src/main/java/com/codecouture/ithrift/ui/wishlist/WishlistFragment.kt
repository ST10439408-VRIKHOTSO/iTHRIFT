package com.codecouture.ithrift.ui.wishlist

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import coil.load
import com.codecouture.ithrift.data.AddCartItemRequest
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.WishlistItem
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentWishlistBinding
import com.codecouture.ithrift.databinding.ItemWishlistBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.product.ProductDetailFragment
import com.codecouture.ithrift.util.priceText
import com.codecouture.ithrift.util.resolveImageUrl
import kotlinx.coroutines.launch

/**
 * Pieces the customer saved for later. The list lives on the server, so the
 * same wishlist shows on the website and in this app.
 */
class WishlistFragment : BaseFragment() {

    private var _binding: FragmentWishlistBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentWishlistBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Wishlist", showBack = true)
        loadWishlist()
    }

    private fun loadWishlist() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getWishlist() }) {
                is ApiOutcome.Success -> render(result.data.items)
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun render(items: List<WishlistItem>) {
        if (_binding == null) return
        binding.textCount.text = if (items.size == 1) "1 saved item" else "${items.size} saved items"
        binding.textEmpty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        binding.layoutItems.removeAllViews()

        val inflater = LayoutInflater.from(requireContext())
        for (item in items) {
            val row = ItemWishlistBinding.inflate(inflater, binding.layoutItems, false)
            row.textBrand.text = item.brand
            row.textName.text = item.name
            row.textPrice.text = priceText(requireContext(), item.price, item.originalPrice, item.onSale)
            row.textMeta.text = when {
                !item.inStock -> "Sold out"
                item.onlySize != null -> "Size ${item.onlySize}"
                else -> "${item.sizeCount} sizes available"
            }
            row.imageThumb.load(resolveImageUrl(requireContext(), item.image)) { crossfade(true) }

            row.layoutOpen.setOnClickListener {
                mainActivity().openDetail(ProductDetailFragment.newInstance(item.productId))
            }

            if (item.inStock) {
                row.buttonMove.visibility = View.VISIBLE
                // With several sizes in stock the customer picks one on the product screen.
                row.buttonMove.text = if (item.onlySize != null) "Move to cart" else "Choose size"
                row.buttonMove.setOnClickListener {
                    val size = item.onlySize
                    if (size == null) {
                        mainActivity().openDetail(ProductDetailFragment.newInstance(item.productId))
                    } else {
                        moveToCart(item.productId, size)
                    }
                }
            } else {
                row.buttonMove.visibility = View.GONE
            }
            row.buttonRemove.setOnClickListener { remove(item.productId) }

            binding.layoutItems.addView(row.root)
        }
    }

    private fun moveToCart(productId: Int, size: String) {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val added = safeApiCall { apiService().addCartItem(AddCartItemRequest(productId, 1, size)) }) {
                is ApiOutcome.Success -> {
                    when (val removed = safeApiCall { apiService().removeFromWishlist(productId) }) {
                        is ApiOutcome.Success -> render(removed.data.items)
                        is ApiOutcome.Failure -> loadWishlist()
                    }
                    showToast("Moved to your cart")
                    refreshCartBadge()
                }
                is ApiOutcome.Failure -> showToast(added.message)
            }
        }
    }

    private fun remove(productId: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().removeFromWishlist(productId) }) {
                is ApiOutcome.Success -> {
                    render(result.data.items)
                    showToast("Removed from your wishlist")
                }
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
