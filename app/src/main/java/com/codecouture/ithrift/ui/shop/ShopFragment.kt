package com.codecouture.ithrift.ui.shop

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import coil.load
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.LookupCache
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentShopBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.product.ProductDetailFragment
import com.google.android.material.chip.Chip
import kotlinx.coroutines.launch

class ShopFragment : BaseFragment() {

    private var _binding: FragmentShopBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: ProductAdapter
    private var selectedCategory: String? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentShopBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Pastimes", showBack = false)

        adapter = ProductAdapter { product ->
            mainActivity().openDetail(ProductDetailFragment.newInstance(product.id))
        }
        binding.recyclerProducts.layoutManager = GridLayoutManager(requireContext(), 2)
        binding.recyclerProducts.adapter = adapter

        // Load hero image
        binding.imageHero.load("https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7?w=1200&q=90") {
            crossfade(true)
            placeholder(R.drawable.bg_image_placeholder)
            error(R.drawable.bg_image_placeholder)
        }

        binding.imageWeeklyDrop.load("https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80") {
            crossfade(true)
        }

        binding.imageStory1.load("https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=600&q=80") {
            crossfade(true)
        }

        binding.imageStory2.load("https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80") {
            crossfade(true)
        }

        binding.swipeRefresh.setOnRefreshListener { loadProducts() }

        viewLifecycleOwner.lifecycleScope.launch {
            LookupCache.ensureLoaded(requireContext())
            setupCategoryChips()
            loadProducts()
            refreshCartBadge()
        }
    }

    private fun setupCategoryChips() {
        binding.chipGroupCategories.removeAllViews()

        val allChip = Chip(requireContext()).apply {
            text = "All"
            isCheckable = true
            isChecked = selectedCategory == null
            tag = null
            setChipBackgroundColorResource(if (isChecked) R.color.ink else R.color.white)
            setTextColor(ContextCompat.getColor(context, if (isChecked) R.color.white else R.color.ink))
            chipStrokeWidth = if (isChecked) 0f else 1f
            setChipStrokeColorResource(R.color.border)
        }
        binding.chipGroupCategories.addView(allChip)

        for (category in LookupCache.categories) {
            val chip = Chip(requireContext()).apply {
                text = category.name
                isCheckable = true
                isChecked = selectedCategory == category.name
                tag = category.name
                setChipBackgroundColorResource(if (isChecked) R.color.ink else R.color.white)
                setTextColor(ContextCompat.getColor(context, if (isChecked) R.color.white else R.color.ink))
                chipStrokeWidth = if (isChecked) 0f else 1f
                setChipStrokeColorResource(R.color.border)
            }
            binding.chipGroupCategories.addView(chip)
        }

        binding.chipGroupCategories.setOnCheckedStateChangeListener { group, checkedIds ->
            val checkedId = checkedIds.firstOrNull()
            val chip = checkedId?.let { group.findViewById<Chip>(it) }
            selectedCategory = chip?.tag as? String
            setupCategoryChips() // Refresh colors
            loadProducts()
        }
    }

    private fun loadProducts() {
        binding.swipeRefresh.isRefreshing = true
        viewLifecycleOwner.lifecycleScope.launch {
            val filters = mutableMapOf<String, String>()
            selectedCategory?.let { filters["category"] = it }

            when (val result = safeApiCall { apiService().getProducts(filters) }) {
                is ApiOutcome.Success -> {
                    adapter.submitList(result.data.products)
                    binding.textEmpty.visibility = if (result.data.products.isEmpty()) View.VISIBLE else View.GONE
                }
                is ApiOutcome.Failure -> showToast(result.message)
            }
            binding.swipeRefresh.isRefreshing = false
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
