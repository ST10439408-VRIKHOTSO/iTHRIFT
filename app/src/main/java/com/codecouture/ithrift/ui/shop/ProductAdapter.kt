package com.codecouture.ithrift.ui.shop

import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.Product
import com.codecouture.ithrift.databinding.ItemProductBinding
import com.codecouture.ithrift.util.conditionColorRes
import com.codecouture.ithrift.util.formatMoney
import com.codecouture.ithrift.util.resolveImageUrl

/** Two-column product grid, used by both ShopFragment and SearchFragment. */
class ProductAdapter(
    private val onClick: (Product) -> Unit
) : ListAdapter<Product, ProductAdapter.ProductViewHolder>(DIFF) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ProductViewHolder {
        val binding = ItemProductBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ProductViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ProductViewHolder, position: Int) {
        holder.bind(getItem(position), onClick)
    }

    class ProductViewHolder(private val binding: ItemProductBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(product: Product, onClick: (Product) -> Unit) {
            val context = binding.root.context

            binding.textBrand.text = product.brand
            binding.textName.text = product.name
            binding.textPrice.text = formatMoney(product.price)
            binding.textMeta.text = "Size ${product.size}"
            binding.textQtyLabel.text = "Qty: ${product.stock}"

            binding.textCondition.text = if (product.inStock) product.condition else "Out of stock"
            val colorRes = if (product.inStock) conditionColorRes(product.condition) else R.color.muted
            (binding.textCondition.background as? GradientDrawable)?.setColor(
                ContextCompat.getColor(context, colorRes)
            )

            binding.imageProduct.load(resolveImageUrl(context, product.image)) {
                crossfade(true)
            }

            binding.root.setOnClickListener { onClick(product) }
            binding.btnDetails.setOnClickListener { onClick(product) }
            binding.btnAddToCart.setOnClickListener { 
                // Normally this would call an addToCart function passed in, 
                // but for now we'll just trigger the same detail click or handle it if we add a callback.
                onClick(product) 
            }
        }
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<Product>() {
            override fun areItemsTheSame(oldItem: Product, newItem: Product) = oldItem.id == newItem.id
            override fun areContentsTheSame(oldItem: Product, newItem: Product) = oldItem == newItem
        }
    }
}
