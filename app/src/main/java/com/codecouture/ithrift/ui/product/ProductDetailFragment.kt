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
import com.codecouture.ithrift.data.Review
import com.codecouture.ithrift.data.ReviewRequest
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentProductDetailBinding
import com.codecouture.ithrift.databinding.ItemReviewBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.util.conditionColorRes
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.resolveImageUrl
import com.codecouture.ithrift.util.starString
import coil.load
import kotlinx.coroutines.launch

class ProductDetailFragment : BaseFragment() {

    private var _binding: FragmentProductDetailBinding? = null
    private val binding get() = _binding!!

    private val productId: Int by lazy { requireArguments().getInt(ARG_PRODUCT_ID) }
    private var quantity = 1
    private var stockAvailable = 1

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
        stockAvailable = product.stock
        quantity = 1

        binding.textEyebrow.text = "${product.brand} · ${product.ref}"
        binding.textName.text = product.name
        binding.textDescription.text = product.description
        binding.textPrice.text = formatMoney(product.price)
        binding.textMeta.text = "Size ${product.size} · ${product.category}"
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
            binding.textStock.text = "${product.stock} in stock"
        } else {
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
            requireLogin { addToCart(product.id) }
        }

        setupReviewForm()
    }

    private fun addToCart(productId: Int) {
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().addCartItem(AddCartItemRequest(productId, quantity)) }) {
                is ApiOutcome.Success -> {
                    showToast("Added to cart")
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
