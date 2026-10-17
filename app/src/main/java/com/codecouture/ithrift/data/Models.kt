package com.codecouture.ithrift.data

/**
 * Data classes mirroring the JSON returned by the iTHRIFT Clothes REST API
 * (the same API the desktop website and the PWA call; see server/routes/
 * in the Node.js project). Field names match the API's JSON exactly so no
 * Gson @SerializedName annotations are needed.
 */

data class AuthUser(
    val type: String, // "customer", "staff" or "admin"
    val id: Int,
    val name: String
)

data class AuthResponse(
    val token: String,
    val user: AuthUser
)

data class MeResponse(val user: AuthUser)

/** GET /api/auth/sso/status: lets the app hide a sign-in button the server cannot honour. */
data class SsoStatusResponse(
    val enabled: Boolean,
    val provider: String?
)

/**
 * The customer's own account details, shown on the Settings screen.
 * `canChangePassword` is false for an account created through single sign-on,
 * which has no password on this system to change.
 */
data class CustomerProfile(
    val id: Int,
    val firstName: String,
    val lastName: String,
    val email: String,
    val phone: String?,
    val address: String?,
    val city: String?,
    val postalCode: String?,
    val authProvider: String,
    val canChangePassword: Boolean,
    val createdAt: String?
)

data class ProfileResponse(val profile: CustomerProfile)

data class OkResponse(
    val ok: Boolean? = null,
    val note: String? = null
)

data class ErrorResponse(val error: String? = null)

/** One size of a product and how many pieces of it are in stock. */
data class ProductSize(
    val size: String,
    val stock: Int
)

data class Product(
    val id: Int,
    val ref: String,
    val name: String,
    val description: String,
    val brand: String,
    val brandId: Int,
    val category: String,
    val categoryId: Int,
    val size: String,
    val condition: String,
    val price: Double,
    val stock: Int,
    val inStock: Boolean,
    val image: String,
    val createdAt: String,
    // Only the sizes with stock. Nullable because Gson ignores Kotlin defaults.
    val sizes: List<ProductSize>?,
    // Set when the piece is on sale: the price it was before.
    val originalPrice: Double?,
    val onSale: Boolean,
    val percentOff: Int?
)

data class ProductListResponse(val products: List<Product>)
data class ProductResponse(val product: Product)

data class Brand(val id: Int, val name: String)
data class BrandListResponse(val brands: List<Brand>)

data class Category(val id: Int, val name: String)
data class CategoryListResponse(val categories: List<Category>)

data class Review(
    val id: Int,
    val rating: Int,
    val comment: String?,
    val createdAt: String,
    val firstName: String,
    val lastName: String,
    val author: String
)

data class ReviewListResponse(val reviews: List<Review>)

data class CartItem(
    val id: Int,
    val quantity: Int,
    val productId: Int,
    val name: String,
    val price: Double,
    val stock: Int,
    val image: String,
    val size: String?
)

data class CartResponse(
    val cartId: Int,
    val items: List<CartItem>,
    val subtotal: Double,
    val itemCount: Int
)

data class OrderListItem(
    val id: Int,
    val ref: String,
    val status: String,
    val total: Double,
    val courierRef: String?,
    val createdAt: String,
    val customer: String
)

data class OrderListResponse(val orders: List<OrderListItem>)

data class OrderCustomer(
    val id: Int,
    val name: String,
    val email: String
)

data class OrderLineItem(
    val quantity: Int,
    val unitPrice: Double,
    val productId: Int,
    val name: String,
    val image: String,
    val productRef: String,
    val lineTotal: Double,
    val size: String?,
    val orderItemId: Int,
    // Set once a return has been asked for: Requested, Approved, Rejected or Refunded.
    val returnStatus: String?,
    val returnReason: String?,
    val canReturn: Boolean
)

data class OrderPayment(
    val method: String,
    val status: String,
    val amount: Double,
    val createdAt: String
)

data class OrderDetail(
    val id: Int,
    val ref: String,
    val status: String,
    val total: Double,
    val courierRef: String?,
    val createdAt: String,
    val updatedAt: String,
    val customer: OrderCustomer,
    val items: List<OrderLineItem>,
    val payment: OrderPayment,
    val subtotal: Double?,
    val discount: Double?,
    val promoCode: String?,
    val deliveryMethod: String?,
    val deliveryLabel: String?,
    val deliveryFee: Double?,
    val deliveryAddress: String?,
    val deliveryInstructions: String?,
    val canCancel: Boolean,
    val returnWindowOpen: Boolean,
    val returnDaysLeft: Int
)

data class OrderDetailResponse(val order: OrderDetail)

// --- Wishlist ---

data class WishlistItem(
    val productId: Int,
    val name: String,
    val brand: String,
    val price: Double,
    val originalPrice: Double?,
    val stock: Int,
    val image: String,
    val condition: String,
    val inStock: Boolean,
    val onSale: Boolean,
    // The one size left, when there is exactly one, so it can go straight to the cart.
    val onlySize: String?,
    val sizeCount: Int
)

data class WishlistResponse(val items: List<WishlistItem>)

// --- Address book ---

data class Address(
    val id: Int,
    val label: String,
    val recipient: String,
    val phone: String?,
    val line1: String,
    val suburb: String?,
    val city: String,
    val postalCode: String,
    val isDefault: Boolean
) {
    /** One line for lists and the checkout: "Lerato Mokoena, 14 Jacaranda Street, Pretoria, 0181". */
    fun oneLine(): String = listOfNotNull(recipient, line1, suburb?.takeIf { it.isNotBlank() }, city, postalCode).joinToString(", ")
}

data class AddressListResponse(val addresses: List<Address>)

// --- Delivery, promo codes and returns ---

data class DeliveryMethod(
    val id: String,
    val label: String,
    val fee: Double,
    val eta: String,
    val freeOverThreshold: Boolean
)

data class OrderOptionsResponse(
    val deliveryMethods: List<DeliveryMethod>,
    val freeDeliveryThreshold: Double,
    val returnReasons: List<String>,
    val returnWindowDays: Int
)

data class PromoInfo(val code: String, val description: String)

data class QuoteResponse(
    val subtotal: Double,
    val discount: Double,
    val deliveryMethod: String,
    val deliveryFee: Double,
    val total: Double,
    val freeDeliveryRemaining: Double,
    val promo: PromoInfo?,
    val itemCount: Int
)

data class ReturnItem(
    val id: Int,
    val reason: String,
    val comment: String?,
    val status: String,
    val refundAmount: Double,
    val createdAt: String,
    val orderId: Int,
    val orderRef: String,
    val productName: String,
    val size: String?,
    val image: String
)

data class ReturnListResponse(val returns: List<ReturnItem>)

// --- Request bodies ---

data class RegisterRequest(
    val firstName: String,
    val lastName: String,
    val email: String,
    val password: String,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val postalCode: String? = null
)

data class LoginRequest(
    val identifier: String,
    val password: String
)

/** The Google ID token, for the API to verify. The app never inspects it. */
data class SsoLoginRequest(
    val idToken: String
)

data class UpdateProfileRequest(
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val address: String?,
    val city: String?,
    val postalCode: String?
)

data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String
)

data class AddCartItemRequest(
    val productId: Int,
    val quantity: Int,
    val size: String?
)

data class UpdateCartItemRequest(
    val quantity: Int
)

/** Null fields are left out of the JSON, and the server falls back to its defaults. */
data class CheckoutRequest(
    val method: String,
    val deliveryMethod: String,
    val addressId: Int?,
    val instructions: String?,
    val promoCode: String?
)

data class QuoteRequest(
    val deliveryMethod: String,
    val promoCode: String?
)

data class WishlistAddRequest(val productId: Int)

data class AddressRequest(
    val label: String,
    val recipient: String,
    val phone: String?,
    val line1: String,
    val suburb: String?,
    val city: String,
    val postalCode: String,
    val isDefault: Boolean
)

data class ReturnRequestBody(
    val orderItemId: Int,
    val reason: String,
    val comment: String?
)

data class ReviewRequest(
    val rating: Int,
    val comment: String?
)
