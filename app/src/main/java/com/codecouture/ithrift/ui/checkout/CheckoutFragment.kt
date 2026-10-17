package com.codecouture.ithrift.ui.checkout

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.R
import com.codecouture.ithrift.data.Address
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.CheckoutRequest
import com.codecouture.ithrift.data.OrderOptionsResponse
import com.codecouture.ithrift.data.QuoteRequest
import com.codecouture.ithrift.data.QuoteResponse
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentCheckoutBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.codecouture.ithrift.ui.addresses.AddressesFragment
import com.codecouture.ithrift.util.formatMoney
import com.google.android.material.radiobutton.MaterialRadioButton
import kotlinx.coroutines.launch

/**
 * Checkout: how the order is delivered, where to, how it is paid for and an
 * optional promo code. The app never works out a price itself. Every change
 * asks the server for a fresh quote and shows what comes back, so the total
 * on this screen is always the total the order will be placed for.
 */
class CheckoutFragment : BaseFragment() {

    private var _binding: FragmentCheckoutBinding? = null
    private val binding get() = _binding!!

    // Kept on the fragment so the choices survive a trip to the address book and back.
    private var deliveryMethod = "standard"
    private var selectedAddressId: Int? = null
    private var promoCode: String? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentCheckoutBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Checkout", showBack = true)

        binding.buttonPlaceOrder.setOnClickListener { placeOrder() }
        binding.buttonManageAddresses.setOnClickListener { mainActivity().openDetail(AddressesFragment()) }
        binding.buttonApplyPromo.setOnClickListener { applyPromo() }

        updateAddressVisibility()
        load()
    }

    private fun load() {
        viewLifecycleOwner.lifecycleScope.launch {
            val options = safeApiCall { apiService().getOrderOptions() }
            val addresses = safeApiCall { apiService().getAddresses() }
            if (_binding == null) return@launch

            when (options) {
                is ApiOutcome.Success -> bindDeliveryMethods(options.data)
                is ApiOutcome.Failure -> showToast(options.message)
            }
            when (addresses) {
                is ApiOutcome.Success -> bindAddresses(addresses.data.addresses)
                is ApiOutcome.Failure -> showToast(addresses.message)
            }
            refreshQuote(announcePromo = false)
        }
    }

    private fun bindDeliveryMethods(options: OrderOptionsResponse) {
        val group = binding.radioGroupDelivery
        group.setOnCheckedChangeListener(null)
        group.removeAllViews()

        for (method in options.deliveryMethods) {
            val fee = if (method.fee > 0) formatMoney(method.fee) else "Free"
            val freeNote = if (method.freeOverThreshold) ", free from ${formatMoney(options.freeDeliveryThreshold)}" else ""
            val button = MaterialRadioButton(requireContext()).apply {
                id = View.generateViewId()
                text = "${method.label} ($fee$freeNote)\n${method.eta}"
                tag = method.id
                setTextColor(ContextCompat.getColor(context, R.color.ink))
                val gap = (8 * resources.displayMetrics.density).toInt()
                setPadding(paddingLeft, gap, paddingRight, gap)
            }
            group.addView(button)
            if (method.id == deliveryMethod) group.check(button.id)
        }

        group.setOnCheckedChangeListener { radioGroup, checkedId ->
            val picked = radioGroup.findViewById<View>(checkedId)?.tag as? String
            if (picked != null && picked != deliveryMethod) {
                deliveryMethod = picked
                updateAddressVisibility()
                refreshQuote(announcePromo = false)
            }
        }
    }

    private fun bindAddresses(addresses: List<Address>) {
        val group = binding.radioGroupAddress
        group.setOnCheckedChangeListener(null)
        group.removeAllViews()
        binding.textNoAddress.visibility = if (addresses.isEmpty()) View.VISIBLE else View.GONE

        // Keep the earlier choice if that address still exists; otherwise use the default one.
        val chosen = addresses.firstOrNull { it.id == selectedAddressId }
            ?: addresses.firstOrNull { it.isDefault }
            ?: addresses.firstOrNull()
        selectedAddressId = chosen?.id

        for (address in addresses) {
            val defaultNote = if (address.isDefault) " (default)" else ""
            val button = MaterialRadioButton(requireContext()).apply {
                id = View.generateViewId()
                text = "${address.label}$defaultNote\n${address.oneLine()}"
                tag = address.id
                setTextColor(ContextCompat.getColor(context, R.color.ink))
                val gap = (8 * resources.displayMetrics.density).toInt()
                setPadding(paddingLeft, gap, paddingRight, gap)
            }
            group.addView(button)
            if (address.id == selectedAddressId) group.check(button.id)
        }

        group.setOnCheckedChangeListener { radioGroup, checkedId ->
            val picked = radioGroup.findViewById<View>(checkedId)?.tag as? Int
            if (picked != null) selectedAddressId = picked
        }
    }

    /** Collection needs no address, so the address card makes way for the store details. */
    private fun updateAddressVisibility() {
        if (_binding == null) return
        val collecting = deliveryMethod == "collection"
        binding.layoutAddressCard.visibility = if (collecting) View.GONE else View.VISIBLE
        binding.textCollectionNote.visibility = if (collecting) View.VISIBLE else View.GONE
    }

    private fun applyPromo() {
        val code = binding.inputPromo.text.toString().trim()
        if (code.isEmpty()) {
            showPromoMessage("Type a promo code first.", isError = true)
            return
        }
        promoCode = code
        refreshQuote(announcePromo = true)
    }

    private fun refreshQuote(announcePromo: Boolean) {
        viewLifecycleOwner.lifecycleScope.launch {
            val result = safeApiCall { apiService().getQuote(QuoteRequest(deliveryMethod, promoCode)) }
            if (_binding == null) return@launch
            when (result) {
                is ApiOutcome.Success -> bindQuote(result.data, announcePromo)
                is ApiOutcome.Failure -> {
                    if (promoCode != null) {
                        // The code does not apply: say why, drop it, and show the plain total.
                        promoCode = null
                        showPromoMessage(result.message, isError = true)
                        refreshQuote(announcePromo = false)
                    } else {
                        showToast(result.message)
                    }
                }
            }
        }
    }

    private fun bindQuote(quote: QuoteResponse, announcePromo: Boolean) {
        binding.textSubtotal.text = formatMoney(quote.subtotal)

        val promo = quote.promo
        if (quote.discount > 0 && promo != null) {
            binding.layoutDiscountRow.visibility = View.VISIBLE
            binding.textDiscountLabel.text = "Promo ${promo.code}"
            binding.textDiscount.text = "-${formatMoney(quote.discount)}"
            if (announcePromo) showPromoMessage("${promo.code} applied. ${promo.description}", isError = false)
        } else {
            binding.layoutDiscountRow.visibility = View.GONE
        }

        binding.textDeliveryFee.text = if (quote.deliveryFee > 0) formatMoney(quote.deliveryFee) else "Free"
        if (quote.deliveryMethod == "standard") {
            binding.textFreeDelivery.visibility = View.VISIBLE
            binding.textFreeDelivery.text = if (quote.freeDeliveryRemaining > 0) {
                "Add ${formatMoney(quote.freeDeliveryRemaining)} more for free standard delivery."
            } else {
                "You qualify for free standard delivery."
            }
        } else {
            binding.textFreeDelivery.visibility = View.GONE
        }

        binding.textTotal.text = formatMoney(quote.total)
        binding.buttonPlaceOrder.text = "Place order: ${formatMoney(quote.total)}"
    }

    private fun showPromoMessage(message: String, isError: Boolean) {
        if (_binding == null) return
        binding.textPromoMessage.visibility = View.VISIBLE
        binding.textPromoMessage.text = message
        binding.textPromoMessage.setTextColor(
            ContextCompat.getColor(requireContext(), if (isError) R.color.bad else R.color.good)
        )
    }

    private fun placeOrder() {
        val method = when (binding.radioGroupPayment.checkedRadioButtonId) {
            R.id.radio_payfast -> "payfast"
            R.id.radio_eft -> "eft"
            else -> "card"
        }
        val collecting = deliveryMethod == "collection"
        val instructions = binding.inputInstructions.text.toString().trim()
        val request = CheckoutRequest(
            method = method,
            deliveryMethod = deliveryMethod,
            addressId = if (collecting) null else selectedAddressId,
            instructions = if (collecting || instructions.isEmpty()) null else instructions,
            promoCode = promoCode
        )

        binding.buttonPlaceOrder.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            when (val result = safeApiCall { apiService().checkout(request) }) {
                is ApiOutcome.Success -> {
                    refreshCartBadge()
                    mainActivity().openDetail(OrderConfirmationFragment.newInstance(result.data.order.id))
                }
                is ApiOutcome.Failure -> {
                    showToast(result.message)
                    if (_binding != null) binding.buttonPlaceOrder.isEnabled = true
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
