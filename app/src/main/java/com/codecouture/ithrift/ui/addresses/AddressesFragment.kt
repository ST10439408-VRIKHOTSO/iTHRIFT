package com.codecouture.ithrift.ui.addresses

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.codecouture.ithrift.data.Address
import com.codecouture.ithrift.data.AddressListResponse
import com.codecouture.ithrift.data.AddressRequest
import com.codecouture.ithrift.data.ApiOutcome
import com.codecouture.ithrift.data.safeApiCall
import com.codecouture.ithrift.databinding.FragmentAddressesBinding
import com.codecouture.ithrift.databinding.ItemAddressBinding
import com.codecouture.ithrift.ui.BaseFragment
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.launch

/**
 * The customer's address book: add, edit, delete and choose a default.
 * Checkout offers these addresses, with the default one already selected.
 */
class AddressesFragment : BaseFragment() {

    private var _binding: FragmentAddressesBinding? = null
    private val binding get() = _binding!!

    /** The address being edited, or null while the form is adding a new one. */
    private var editing: Address? = null

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAddressesBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        mainActivity().setToolbarTitle("Addresses", showBack = true)

        binding.buttonSave.setOnClickListener { save() }
        binding.buttonCancelEdit.setOnClickListener { startAdding() }
        loadAddresses()
    }

    private fun loadAddresses() {
        viewLifecycleOwner.lifecycleScope.launch {
            handle(safeApiCall { apiService().getAddresses() }, null)
        }
    }

    /** Every address call answers with the full list, so one function redraws after any of them. */
    private fun handle(result: ApiOutcome<AddressListResponse>, successMessage: String?) {
        if (_binding == null) return
        when (result) {
            is ApiOutcome.Success -> {
                render(result.data.addresses)
                if (successMessage != null) showToast(successMessage)
            }
            is ApiOutcome.Failure -> showError(result.message)
        }
    }

    private fun render(addresses: List<Address>) {
        binding.textEmpty.visibility = if (addresses.isEmpty()) View.VISIBLE else View.GONE
        binding.layoutAddresses.removeAllViews()

        val inflater = LayoutInflater.from(requireContext())
        for (address in addresses) {
            val row = ItemAddressBinding.inflate(inflater, binding.layoutAddresses, false)
            row.textLabel.text = address.label
            row.textDefault.visibility = if (address.isDefault) View.VISIBLE else View.GONE
            val phoneLine = address.phone?.takeIf { it.isNotBlank() }?.let { "\n$it" } ?: ""
            row.textLines.text = address.oneLine() + phoneLine

            row.buttonEdit.setOnClickListener { startEditing(address) }
            row.buttonDefault.visibility = if (address.isDefault) View.GONE else View.VISIBLE
            row.buttonDefault.setOnClickListener {
                viewLifecycleOwner.lifecycleScope.launch {
                    handle(safeApiCall { apiService().makeDefaultAddress(address.id) }, "Default address changed")
                }
            }
            row.buttonDelete.setOnClickListener { confirmDelete(address) }

            binding.layoutAddresses.addView(row.root)
        }
    }

    private fun confirmDelete(address: Address) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Delete this address?")
            .setMessage("${address.label}: ${address.oneLine()}")
            .setNegativeButton("Keep it", null)
            .setPositiveButton("Delete") { _, _ ->
                viewLifecycleOwner.lifecycleScope.launch {
                    handle(safeApiCall { apiService().deleteAddress(address.id) }, "Address deleted")
                    if (editing?.id == address.id) startAdding()
                }
            }
            .show()
    }

    private fun startEditing(address: Address) {
        editing = address
        binding.textError.visibility = View.GONE
        binding.textFormTitle.text = "Edit address"
        binding.buttonSave.text = "Save changes"
        binding.buttonCancelEdit.visibility = View.VISIBLE
        binding.checkDefault.visibility = View.GONE
        binding.inputLabel.setText(address.label)
        binding.inputRecipient.setText(address.recipient)
        binding.inputPhone.setText(address.phone.orEmpty())
        binding.inputLine1.setText(address.line1)
        binding.inputSuburb.setText(address.suburb.orEmpty())
        binding.inputCity.setText(address.city)
        binding.inputPostalCode.setText(address.postalCode)
        binding.inputLabel.requestFocus()
    }

    private fun startAdding() {
        if (_binding == null) return
        editing = null
        binding.textError.visibility = View.GONE
        binding.textFormTitle.text = "Add an address"
        binding.buttonSave.text = "Add address"
        binding.buttonCancelEdit.visibility = View.GONE
        binding.checkDefault.visibility = View.VISIBLE
        binding.checkDefault.isChecked = false
        listOf(
            binding.inputLabel, binding.inputRecipient, binding.inputPhone, binding.inputLine1,
            binding.inputSuburb, binding.inputCity, binding.inputPostalCode
        ).forEach { it.setText("") }
    }

    private fun save() {
        val label = binding.inputLabel.text.toString().trim()
        val recipient = binding.inputRecipient.text.toString().trim()
        val phone = binding.inputPhone.text.toString().trim()
        val line1 = binding.inputLine1.text.toString().trim()
        val suburb = binding.inputSuburb.text.toString().trim()
        val city = binding.inputCity.text.toString().trim()
        val postalCode = binding.inputPostalCode.text.toString().trim()

        // The same rules the server applies, checked here first so the answer is instant.
        val error = when {
            recipient.isEmpty() -> "Enter the name of the person receiving the parcel."
            line1.length < 5 -> "Enter the street address, including the house or building number."
            city.isEmpty() -> "Enter the city or town."
            !Regex("^\\d{4}$").matches(postalCode) -> "A South African postal code has four digits."
            else -> null
        }
        if (error != null) {
            showError(error)
            return
        }

        val request = AddressRequest(
            label = label.ifEmpty { "Home" },
            recipient = recipient,
            phone = phone.ifEmpty { null },
            line1 = line1,
            suburb = suburb.ifEmpty { null },
            city = city,
            postalCode = postalCode,
            isDefault = binding.checkDefault.isChecked
        )
        val current = editing

        binding.textError.visibility = View.GONE
        binding.buttonSave.isEnabled = false
        viewLifecycleOwner.lifecycleScope.launch {
            val result = if (current == null) {
                safeApiCall { apiService().addAddress(request) }
            } else {
                safeApiCall { apiService().updateAddress(current.id, request) }
            }
            if (_binding == null) return@launch
            binding.buttonSave.isEnabled = true
            handle(result, if (current == null) "Address saved" else "Address updated")
            if (result is ApiOutcome.Success) startAdding()
        }
    }

    private fun showError(message: String) {
        if (_binding == null) return
        binding.textError.visibility = View.VISIBLE
        binding.textError.text = message
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
