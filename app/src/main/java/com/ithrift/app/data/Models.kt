package com.ithrift.app.data

import com.google.gson.JsonObject

/**
 * Data classes mirroring the JSON returned by the iTHRIFT Clothes REST API,
 * the same API the website calls (see server/routes/ in the Node.js
 * project). Field names match the JSON exactly, so no @SerializedName
 * annotations are needed.
 *
 * Gson does not run Kotlin constructors, so a field missing from a response
 * arrives as null even when its type says otherwise. Every field that an
 * older server might leave out is therefore declared nullable.
 */

// --- Sign in and the account ---

data class AuthUser(
    val type: String, // "customer", "staff" or "admin"
    val id: Int,
    val name: String,
)

data class AuthResponse(val token: String, val user: AuthUser)

data class MeResponse(val user: AuthUser)

/** GET /api/auth/sso/status: lets the app hide a sign-in button the server cannot honour. */
data class SsoStatusResponse(val enabled: Boolean, val provider: String?, val clientId: String? = null)

/** `canChangePassword` is false for an account created through single sign-on. */
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
    val createdAt: String?,
)

data class ProfileResponse(val profile: CustomerProfile)

data class OkResponse(val ok: Boolean? = null, val note: String? = null, val message: String? = null)

data class ErrorResponse(val error: String? = null)

// --- Catalogue ---

/** One size of a product and how many pieces of it are in stock. */
data class ProductSize(val size: String, val stock: Int)

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
    /** Only the sizes with stock. */
    val sizes: List<ProductSize>?,
    /** Every size, sold out ones included, so a customer can ask to be told when one comes back. */
    val allSizes: List<ProductSize>?,
    /** Set when the piece is on sale: the price it was before. */
    val originalPrice: Double?,
    val onSale: Boolean,
    val percentOff: Int?,
)

data class PriceRange(val min: Double?, val max: Double?)

data class ProductListResponse(
    val products: List<Product>,
    val summary: String?,
    val priceRange: PriceRange?,
)

data class ProductResponse(val product: Product)

data class Brand(val id: Int, val name: String)
data class BrandListResponse(val brands: List<Brand>)

data class Category(val id: Int, val name: String, val inStock: Int?)
data class CategoryListResponse(val categories: List<Category>)

data class SizeListResponse(val sizes: List<String>)

data class Suggestion(val id: Int, val name: String, val brand: String, val price: Double, val image: String, val inStock: Boolean)
data class SuggestResponse(val products: List<Suggestion>, val brands: List<String>, val categories: List<String>)

data class Review(
    val id: Int,
    val rating: Int,
    val comment: String?,
    val createdAt: String,
    val firstName: String?,
    val lastName: String?,
    val author: String,
    val verified: Boolean?,
)

data class ReviewSummary(val count: Int, val average: Double?, val histogram: Map<String, Int>?)
data class ReviewListResponse(val reviews: List<Review>, val summary: ReviewSummary?)

data class ProductQuestion(
    val id: Int,
    val question: String,
    val answer: String?,
    val createdAt: String,
    val answeredAt: String?,
    val askedBy: String?,
    val mine: Boolean?,
)

data class QuestionListResponse(val questions: List<ProductQuestion>)

// --- Bag ---

data class CartItem(
    val id: Int,
    val quantity: Int,
    val productId: Int,
    val name: String,
    val price: Double,
    val stock: Int,
    val image: String,
    val size: String?,
)

data class CartResponse(val cartId: Int, val items: List<CartItem>, val subtotal: Double, val itemCount: Int)

// --- Orders ---

data class OrderListItem(
    val id: Int,
    val ref: String,
    val status: String,
    val total: Double,
    val courierRef: String?,
    val createdAt: String,
    val customer: String,
    val itemCount: Int?,
    val image: String?,
    val deliveryMethod: String?,
    val collectionDate: String?,
    val collectionSlot: String?,
    val isGift: Boolean?,
)

data class OrderListResponse(val orders: List<OrderListItem>)

data class OrderCustomer(val id: Int, val name: String, val email: String)

data class OrderLineItem(
    val quantity: Int,
    val unitPrice: Double,
    val productId: Int,
    val name: String,
    val image: String,
    val productRef: String,
    val lineTotal: Double,
    val size: String?,
    val brand: String?,
    val category: String?,
    val orderItemId: Int,
    /** Set once a return has been asked for: Requested, Approved, Rejected or Refunded. */
    val returnStatus: String?,
    val returnReason: String?,
    val canReturn: Boolean,
)

data class OrderPayment(val method: String, val status: String, val amount: Double, val createdAt: String)

/** One status change, for the order timeline. */
data class OrderHistoryEntry(val status: String, val note: String?, val at: String)

/** What happens next, and roughly when. */
data class OrderNextStep(val status: String, val date: String?, val from: String?, val slot: String?)

data class StoreInfo(val name: String, val address: String, val email: String, val phone: String)

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
    val payment: OrderPayment?,
    val subtotal: Double?,
    val discount: Double?,
    val promoCode: String?,
    val pointsRedeemed: Int?,
    val pointsDiscount: Double?,
    val pointsEarned: Int?,
    val deliveryMethod: String?,
    val deliveryLabel: String?,
    val deliveryFee: Double?,
    val deliveryAddress: String?,
    val deliveryInstructions: String?,
    val collectionDate: String?,
    val collectionSlot: String?,
    val isGift: Boolean?,
    val giftMessage: String?,
    val history: List<OrderHistoryEntry>?,
    val nextStep: OrderNextStep?,
    val nextStatuses: List<String>?,
    val vatIncluded: Double?,
    val store: StoreInfo?,
    val canCancel: Boolean,
    val returnWindowOpen: Boolean,
    val returnDaysLeft: Int,
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
    /** The one size left, when there is exactly one, so it can go straight to the bag. */
    val onlySize: String?,
    val sizeCount: Int,
    val savedAt: String?,
    val priceWhenSaved: Double?,
    /** How much cheaper it is now than when it was saved; 0 when it has not dropped. */
    val priceDrop: Double?,
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
    val isDefault: Boolean,
) {
    /** One line for lists and the checkout: "Lerato Mokoena, 14 Jacaranda Street, Pretoria, 0181". */
    fun oneLine(): String = listOfNotNull(recipient, line1, suburb?.takeIf { it.isNotBlank() }, city, postalCode).joinToString(", ")
}

data class AddressListResponse(val addresses: List<Address>)

// --- Delivery, collection, promo codes, points and returns ---

data class Arrival(val from: String?, val to: String?, val label: String?)

data class DeliveryMethod(
    val id: String,
    val label: String,
    val fee: Double,
    val eta: String,
    val freeOverThreshold: Boolean,
    val arrives: Arrival?,
)

data class CollectionInfo(val dates: List<String>, val slots: List<String>, val address: String)

data class PointsRules(val block: Int, val randPerBlock: Double, val earnPerRand: Double)

data class OrderOptionsResponse(
    val deliveryMethods: List<DeliveryMethod>,
    val freeDeliveryThreshold: Double,
    val returnReasons: List<String>,
    val returnWindowDays: Int,
    val collection: CollectionInfo?,
    val points: PointsRules?,
)

data class PromoInfo(val code: String, val description: String)

data class QuoteResponse(
    val subtotal: Double,
    val discount: Double,
    val pointsRedeemed: Int?,
    val pointsDiscount: Double?,
    val deliveryMethod: String,
    val deliveryFee: Double,
    val total: Double,
    val freeDeliveryRemaining: Double,
    val promo: PromoInfo?,
    val pointsBalance: Int?,
    val itemCount: Int,
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
    val image: String,
    val customer: String?,
    val nextStatuses: List<String>?,
)

data class ReturnListResponse(val returns: List<ReturnItem>)

// --- Account hub: style, points, impact, preferences ---

data class OverviewCustomer(val firstName: String, val lastName: String, val email: String, val memberSince: String?, val authProvider: String?)
data class StyleProfile(val sizes: List<String>, val brands: List<String>, val onboarded: Boolean)
data class Preferences(val notifyOrders: Boolean, val notifyAlerts: Boolean)

data class TierNext(val name: String, val pointsToGo: Int)
data class Tier(val name: String, val next: TierNext?)
data class PointsEntry(val id: Int, val points: Int, val reason: String, val orderId: Int?, val createdAt: String)
data class PointsSummary(val balance: Int, val lifetime: Int, val tier: Tier, val history: List<PointsEntry>)

data class ImpactCategory(val category: String, val items: Int)
data class Impact(val items: Int, val waterLitres: Double, val co2Kg: Double, val byCategory: List<ImpactCategory>?, val basis: String?)

data class AccountCounts(
    val orders: Int,
    val activeOrders: Int,
    val wishlist: Int,
    val unread: Int,
    val savedSearches: Int,
    val alerts: Int,
    val openTickets: Int,
    val sellSubmissions: Int,
    val returns: Int,
)

data class AccountOverview(
    val customer: OverviewCustomer,
    val style: StyleProfile,
    val preferences: Preferences,
    val points: PointsSummary,
    val impact: Impact,
    val counts: AccountCounts,
)

data class ForYouResponse(val productIds: List<Int>)

data class PreferencesRequest(val notifyOrders: Boolean, val notifyAlerts: Boolean)
data class StyleRequest(val sizes: List<String>, val brands: List<String>, val skip: Boolean? = null)

// --- Saved searches and back-in-stock alerts ---

data class SavedSearch(val id: Int, val name: String, val criteria: JsonObject?, val summary: String?, val matches: Int?, val createdAt: String)
data class SavedSearchListResponse(val savedSearches: List<SavedSearch>)
data class SavedSearchRequest(val name: String, val criteria: Map<String, Any>)

data class StockAlert(
    val id: Int,
    val productId: Int,
    val size: String?,
    val createdAt: String,
    val fulfilledAt: String?,
    val name: String,
    val image: String,
    val price: Double,
    val brand: String,
)

data class StockAlertListResponse(val alerts: List<StockAlert>)
data class StockAlertRequest(val size: String?)

data class QuestionRequest(val question: String)

// --- Notifications ---

data class AppNotification(
    val id: Int,
    val type: String,
    val title: String,
    val body: String,
    val link: String?,
    val isRead: Boolean,
    val createdAt: String,
)

data class NotificationListResponse(val notifications: List<AppNotification>, val unread: Int)
data class UnreadResponse(val unread: Int)

// --- Selling to the shop ---

data class SellSubmission(
    val id: Int,
    val ref: String,
    val brand: String,
    val category: String,
    val size: String,
    val condition: String,
    val description: String,
    val askingPrice: Double?,
    val offerAmount: Double?,
    val pointsOffer: Int?,
    val payoutMethod: String?,
    val staffNote: String?,
    val status: String,
    val createdAt: String,
    val updatedAt: String?,
    val customer: String?,
    val nextStatuses: List<String>?,
)

data class SellListResponse(val submissions: List<SellSubmission>)

data class SellRequest(
    val brand: String,
    val category: String,
    val size: String,
    val condition: String,
    val description: String,
    val askingPrice: Double?,
)

data class SellRespondRequest(val accept: Boolean, val payoutMethod: String?)

// --- Support messages ---

data class SupportMessage(val id: Int, val sender: String, val author: String, val body: String, val createdAt: String)

data class SupportTicket(
    val id: Int,
    val ref: String,
    val topic: String,
    val subject: String,
    val orderId: Int?,
    val orderRef: String?,
    val status: String,
    val createdAt: String,
    val updatedAt: String,
    val customer: String?,
    val lastMessage: String?,
    val messageCount: Int?,
    val messages: List<SupportMessage>?,
)

data class SupportListResponse(val tickets: List<SupportTicket>, val topics: List<String>?)
data class SupportTicketResponse(val ticket: SupportTicket)
data class SupportCreateRequest(val topic: String, val subject: String, val message: String, val orderId: Int?)
data class SupportMessageRequest(val message: String)
data class StatusRequest(val status: String)

// --- Request bodies ---

data class RegisterRequest(
    val firstName: String,
    val lastName: String,
    val email: String,
    val password: String,
    val phone: String? = null,
    val address: String? = null,
    val city: String? = null,
    val postalCode: String? = null,
    val confirmPassword: String? = null,
)

data class LoginRequest(val identifier: String, val password: String)

/** The Google ID token, for the API to verify. The app never inspects it. */
data class SsoLoginRequest(val idToken: String)

/** The single-use code from the browser tab and the secret only this app holds. */
data class SsoExchangeRequest(val code: String, val verifier: String)

data class UpdateProfileRequest(
    val firstName: String,
    val lastName: String,
    val phone: String?,
    val address: String?,
    val city: String?,
    val postalCode: String?,
)

data class ChangePasswordRequest(val currentPassword: String, val newPassword: String)

data class AddCartItemRequest(val productId: Int, val quantity: Int, val size: String?)

data class UpdateCartItemRequest(val quantity: Int)

/** Null fields are left out of the JSON, and the server falls back to its defaults. */
data class CheckoutRequest(
    val method: String,
    val deliveryMethod: String,
    val addressId: Int?,
    val instructions: String?,
    val promoCode: String?,
    val pointsToRedeem: Int? = null,
    val collectionDate: String? = null,
    val collectionSlot: String? = null,
    val isGift: Boolean? = null,
    val giftMessage: String? = null,
)

data class QuoteRequest(val deliveryMethod: String, val promoCode: String?, val pointsToRedeem: Int? = null)

data class WishlistAddRequest(val productId: Int)

data class AddressRequest(
    val label: String,
    val recipient: String,
    val phone: String?,
    val line1: String,
    val suburb: String?,
    val city: String,
    val postalCode: String,
    val isDefault: Boolean,
)

data class ReturnRequestBody(val orderItemId: Int, val reason: String, val comment: String?)

data class ReviewRequest(val rating: Int, val comment: String?)
