package com.codecouture.ithrift.ui.product

import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.fragment.app.Fragment
import android.widget.ArrayAdapter
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.AddCartItemRequest
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.ProductSize
import com.codecouture.ithrift.data.Review
import com.codecouture.ithrift.data.ReviewRequest
import com.codecouture.ithrift.data.WishlistAddRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentProductDetailBinding
import com.codecouture.ithrift.databinding.ItemReviewBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.conditionColorRes
import com.codecouture.ithrift.util.priceText
import com.codecouture.ithrift.util.resolveImageUrl
import com.codecouture.ithrift.util.starString
import coil.load
import com.google.android.material.chip.Chip
import kotlinx.coroutines.launch

class ProductDetailFragment : BaseFragment() {

    private var _binding: FragmentProductDetailBinding? = null
    private val binding get() = _binding!!

    private val productId: Int by lazy { requireArguments().getInt(ARG_PRODUCT_ID) }
    private var quantity = 1
    private var stockAvailable = 1
    private var sizes: List<ProductSize> = emptyList()
    private var selectedSize: ProductSize? = null
    private var isSaved = false

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentProductDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Product", showBack = true)
        loadProduct()
    }

    private fun loadProduct() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getProduct(productId) }) {
                is ApiOutcome.Success -> bindProduct(result.data.product)
                is ApiOutcome.Failure -> showToast(result.message)
            }
            loadReviews()
        }
    }

    private fun bindProduct(product: com.codecouture.ithrift.data.Product) {
        if (_binding == null) return
        sizes = product.sizes.orEmpty()
        // With a single size left it is chosen for the customer.
        selectedSize = sizes.singleOrNull()
        stockAvailable = if (sizes.isEmpty()) product.stock else (selectedSize?.stock ?: 0)
        quantity = 1

        binding.textEyebrow.text = "${product.brand} · ${product.ref}"
        binding.textName.text = product.name
        binding.textDescription.text = product.description
        binding.textPrice.text = priceText(requireContext(), product.price, product.originalPrice, product.onSale)
        if (product.onSale && product.percentOff != null) {
            binding.textSaleTag.visibility = View.VISIBLE
            binding.textSaleTag.text = "Sale: ${product.percentOff}% off"
        } else {
            binding.textSaleTag.visibility = View.GONE
        }
        binding.textMeta.text = product.category
        binding.textQty.text = quantity.toString()

        val conditionLabel = if (product.inStock) product.condition else "Out of stock"
        binding.textCondition.text = conditionLabel
        val colorRes = if (product.inStock) conditionColorRes(product.condition) else R.color.muted
        (binding.textCondition.background as? GradientDrawable)?.setColor(
            ContextCompat.getColor(requireContext(), colorRes)
        )

        binding.imageProduct.load(resolveImageUrl(requireContext(), product.image)) {
            crossfade(true)
        }

        if (product.inStock) {
            binding.layoutQtyRow.visibility = View.VISIBLE
            binding.buttonAddToCart.visibility = View.VISIBLE
            binding.textOutOfStock.visibility = View.GONE
            binding.layoutSizes.visibility = if (sizes.isEmpty()) View.GONE else View.VISIBLE
            bindSizes()
            updateStockLabel()
        } else {
            binding.layoutSizes.visibility = View.GONE
            binding.layoutQtyRow.visibility = View.GONE
            binding.buttonAddToCart.visibility = View.GONE
            binding.textOutOfStock.visibility = View.VISIBLE
        }

        binding.buttonQtyMinus.setOnClickListener {
            if (quantity > 1) {
                quantity--
                binding.textQty.text = quantity.toString()
            }
        }
        binding.buttonQtyPlus.setOnClickListener {
            if (quantity < stockAvailable) {
                quantity++
                binding.textQty.text = quantity.toString()
            }
        }
        binding.buttonAddToCart.setOnClickListener {
            if (sizes.isNotEmpty() && selectedSize == null) {
                showToast("Choose a size first.")
                return@setOnClickListener
            }
            requireLogin { addToCart(product.id) }
        }

        binding.buttonWishlist.setOnClickListener { requireLogin { toggleWishlist(product.id) } }
        loadWishlistState(product.id)

        setupReviewForm()
    }

    /** Asks the server whether this piece is already saved, so the button shows the right label. */
    private fun loadWishlistState(productId: Int) {
        updateWishlistButton()
        if (!isLoggedIn()) return
        viewLifecycleOwner.lifecycleScope.launch {
            val result = safeApiCall { apiService().getWishlist() }
            if (result is ApiOutcome.Success) {
                isSaved = result.data.items.any { it.productId == productId }
                updateWishlistButton()
            }
        }
    }

    private fun toggleWishlist(productId: Int) {
        binding.buttonWishlist.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            val result = if (isSaved) {
                safeApiCall { apiService().removeFromWishlist(productId) }
            } else {
                safeApiCall { apiService().addToWishlist(WishlistAddRequest(productId)) }
            }
            if (_binding == null) return@launch
            binding.buttonWishlist.isEnabled = true
            when (result) {
                is ApiOutcome.Success -> {
                    isSaved = result.data.items.any { it.productId == productId }
                    updateWishlistButton()
                    showToast(if (isSaved) "Saved to your wishlist" else "Removed from your wishlist")
                }
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun updateWishlistButton() {
        if (_binding == null) return
        binding.buttonWishlist.text = if (isSaved) "Saved to wishlist (tap to remove)" else "Save to wishlist"
    }

    /** One chip per size in stock; picking one sets how many can be added. */
    private fun bindSizes() {
        binding.chipGroupSizes.setOnCheckedStateChangeListener(null)
        binding.chipGroupSizes.removeAllViews()
        for (size in sizes) {
            val chip = Chip(requireContext()).apply {
                id = View.generateViewId()
                text = size.size
                isCheckable = true
                isCheckedIconVisible = false
                isChecked = selectedSize?.size == size.size
                tag = size
                contentDescription = "Size ${size.size}, ${size.stock} in stock"
            }
            binding.chipGroupSizes.addView(chip)
        }
        binding.chipGroupSizes.setOnCheckedStateChangeListener { group, checkedIds ->
            val chip = checkedIds.firstOrNull()?.let { group.findViewById<Chip>(it) }
            selectedSize = chip?.tag as? ProductSize
            stockAvailable = selectedSize?.stock ?: 0
            quantity = 1
            binding.textQty.text = quantity.toString()
            updateStockLabel()
        }
    }

    private fun updateStockLabel() {
        val size = selectedSize
        binding.textStock.text = when {
            size != null -> "${size.stock} in size ${size.size}"
            sizes.isNotEmpty() -> "Pick a size"
            else -> "$stockAvailable in stock"
        }
    }

    private fun addToCart(productId: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            val request = AddCartItemRequest(productId, quantity, selectedSize?.size)
            when (val result = safeApiCall { apiService().addCartItem(request) }) {
                is ApiOutcome.Success -> {
                    val sizeNote = selectedSize?.let { " (size ${it.size})" } ?: ""
                    showToast("Added to cart$sizeNote")
                    refreshCartBadge()
                }
                is ApiOutcome.Failure -> showToast(result.message)
            }
        }
    }

    private fun setupReviewForm() {
        val ratingLabels = listOf("5 stars", "4 stars", "3 stars", "2 stars", "1 star")
        val spinnerAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, ratingLabels)
        spinnerAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerRating.adapter = spinnerAdapter

        if (isLoggedIn()) {
            binding.layoutReviewForm.visibility = View.VISIBLE
            binding.textSignInToReview.visibility = View.GONE
        } else {
            binding.layoutReviewForm.visibility = View.GONE
            binding.textSignInToReview.visibility = View.VISIBLE
        }

        binding.buttonSubmitReview.setOnClickListener {
            val ratingValue = 5 - binding.spinnerRating.selectedItemPosition
            val comment = binding.inputComment.text?.toString()?.trim().orEmpty()
            viewLifecycleOwner.lifecycleScope.launch {
                when (val result = safeApiCall {
                    apiService().postReview(productId, ReviewRequest(ratingValue, comment.ifEmpty { null }))
                }) {
                    is ApiOutcome.Success -> {
                        showToast("Thanks for your review!")
                        binding.inputComment.setText("")
                        loadReviews()
                    }
                    is ApiOutcome.Failure -> showToast(result.message)
                }
            }
        }
    }

    private fun loadReviews() {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().getReviews(productId) }) {
                is ApiOutcome.Success -> renderReviews(result.data.reviews)
                is ApiOutcome.Failure -> { /* non-critical */ }
            }
        }
    }

    private fun renderReviews(reviews: List<Review>) {
        if (_binding == null) return
        binding.layoutReviews.removeAllViews()
        if (reviews.isEmpty()) return
        val inflater = LayoutInflater.from(requireContext())
        for (review in reviews) {
            val itemBinding = ItemReviewBinding.inflate(inflater, binding.layoutReviews, false)
            itemBinding.textAuthor.text = review.author
            itemBinding.textStars.text = starString(review.rating)
            if (!review.comment.isNullOrBlank()) {
                itemBinding.textComment.visibility = View.VISIBLE
                itemBinding.textComment.text = review.comment
            } else {
                itemBinding.textComment.visibility = View.GONE
            }
            binding.layoutReviews.addView(itemBinding.root)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_PRODUCT_ID = "product_id"

        fun newInstance(productId: Int): Fragment = ProductDetailFragment().apply {
            arguments = Bundle().apply { putInt(ARG_PRODUCT_ID, productId) }
        }
    }
}
