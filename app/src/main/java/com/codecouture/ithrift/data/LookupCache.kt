package com.codecouture.ithrift.data

import android.content.Context

/**
 * Brands and categories rarely change, so they're fetched once and shared
 * between ShopFragment and SearchFragment for the lifetime of the process -
 * mirroring state.brands / state.categories in the website's app.js.
 */
object LookupCache {
    var brands: List<Brand> = emptyList()
        private set
    var categories: List<Category> = emptyList()
        private set

    suspend fun ensureLoaded(context: Context) {
        if (brands.isNotEmpty() && categories.isNotEmpty()) return
        val api = ApiClient.getService(context)
        when (val brandResult = safeApiCall { api.getBrands() }) {
            is ApiOutcome.Success -> brands = brandResult.data.brands
            is ApiOutcome.Failure -> { /* leave empty; screens still work without filter chips */ }
        }
        when (val categoryResult = safeApiCall { api.getCategories() }) {
            is ApiOutcome.Success -> categories = categoryResult.data.categories
            is ApiOutcome.Failure -> { /* leave empty */ }
        }
    }

    /** Forces a re-fetch next time ensureLoaded() is called (e.g. after the server address changes). */
    fun clear() {
        brands = emptyList()
        categories = emptyList()
    }
}
