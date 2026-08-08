package com.codecouture.ithrift.ui.search

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.LookupCache
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentSearchBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.product.ProductDetailFragment
import com.codecouture.ithrift.ui.shop.ProductAdapter
import com.google.android.material.chip.Chip
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class SearchFragment : BaseFragment() {

    private var _binding: FragmentSearchBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: ProductAdapter
    private var selectedBrand: String? = null
    private var searchJob: Job? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSearchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Search", showBack = false)

        adapter = ProductAdapter { product ->
            mainActivity().openDetail(ProductDetailFragment.newInstance(product.id))
        }
        binding.recyclerResults.layoutManager = GridLayoutManager(requireContext(), 2)
        binding.recyclerResults.adapter = adapter

        binding.inputSearch.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                scheduleSearch()
            }
        })

        viewLifecycleOwner.lifecycleScope.launch {
            LookupCache.ensureLoaded(requireContext())
            setupBrandChips()
            refreshCartBadge()
        }
    }

    private fun setupBrandChips() {
        binding.chipGroupBrands.removeAllViews()
        for (brand in LookupCache.brands) {
            val chip = Chip(requireContext()).apply {
                text = brand.name
                isCheckable = true
                tag = brand.name
            }
            binding.chipGroupBrands.addView(chip)
        }
        binding.chipGroupBrands.setOnCheckedStateChangeListener { group, checkedIds ->
            val checkedId = checkedIds.firstOrNull()
            val chip = checkedId?.let { group.findViewById<Chip>(it) }
            selectedBrand = chip?.tag as? String
            scheduleSearch()
        }
    }

    private fun scheduleSearch() {
        searchJob?.cancel()
        searchJob = viewLifecycleOwner.lifecycleScope.launch {
            delay(300)
            runSearch()
        }
    }

    private fun runSearch() {
        val query = binding.inputSearch.text?.toString()?.trim().orEmpty()
        if (query.isEmpty() && selectedBrand == null) {
            binding.recyclerResults.visibility = View.GONE
            binding.textHint.visibility = View.VISIBLE
            binding.textHint.text = "Type to search, or pick a brand above."
            return
        }

        viewLifecycleOwner.lifecycleScope.launch {
            val filters = mutableMapOf<String, String>()
            if (query.isNotEmpty()) filters["q"] = query
            selectedBrand?.let { filters["brand"] = it }

            when (val result = safeApiCall { apiService().getProducts(filters) }) {
                is ApiOutcome.Success -> {
                    adapter.submitList(result.data.products)
                    if (result.data.products.isEmpty()) {
                        binding.recyclerResults.visibility = View.GONE
                        binding.textHint.visibility = View.VISIBLE
                        binding.textHint.text = "No matches."
                    } else {
                        binding.recyclerResults.visibility = View.VISIBLE
                        binding.textHint.visibility = View.GONE
                    }
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
