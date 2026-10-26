package com.ithrift.app.data

/*
 * What the staff console reads and sends: the same /api/admin, /api/orders,
 * /api/returns, /api/sell and /api/products routes the website's console
 * uses. Every one of them is checked against the signed-in role on the
 * server, so hiding a screen in the app is a convenience, not the control.
 */

data class DayRevenue(val day: String, val revenue: Double, val orders: Int)
data class Totals(val orders: Int, val revenue: Double)
data class NamedRevenue(val name: String, val revenue: Double, val units: Int)
data class MethodCount(val method: String, val count: Int)

data class Attention(
    val processing: Int,
    val returnsWaiting: Int,
    val questionsWaiting: Int,
    val ticketsOpen: Int,
    val sellWaiting: Int,
    val outOfStock: Int,
    val lastOne: Int,
    val collectionsToday: Int,
)

data class Analytics(
    val days: List<DayRevenue>,
    val last30: Totals,
    val prev30: Totals,
    val all: Totals,
    val averageOrderValue: Double,
    val itemsSold: Int,
    val returnRate: Double,
    val customers: Int,
    val newCustomers30: Int,
    val topBrands: List<NamedRevenue>,
    val categories: List<NamedRevenue>,
    val payments: List<MethodCount>,
    val delivery: List<MethodCount>,
    val attention: Attention,
)

data class StockLine(val id: Int, val name: String, val stock: Int, val brand: String, val category: String)
data class InventoryReport(val threshold: Int, val outOfStock: List<StockLine>, val lowStock: List<StockLine>)

data class Collection(
    val id: Int,
    val ref: String,
    val status: String,
    val date: String?,
    val slot: String?,
    val total: Double,
    val customer: String,
    val phone: String?,
    val items: Int,
)
data class CollectionListResponse(val collections: List<Collection>)

data class Promo(
    val id: Int,
    val code: String,
    val description: String,
    val discountType: String,
    val discountValue: Double,
    val minSpend: Double,
    val active: Boolean,
    val expiresAt: String?,
    val usageLimit: Int?,
    val usedCount: Int,
    val givenAway: Double,
)
data class PromoListResponse(val promos: List<Promo>)
data class PromoRequest(
    val code: String? = null,
    val discountType: String? = null,
    val discountValue: Double? = null,
    val minSpend: Double? = null,
    val expiresAt: String? = null,
    val usageLimit: Int? = null,
    val description: String? = null,
    val active: Boolean? = null,
)
data class PromoActiveRequest(val active: Boolean)

data class StaffUser(val id: Int, val firstName: String, val lastName: String, val email: String, val city: String?, val status: String, val createdAt: String)
data class UserListResponse(val users: List<StaffUser>)

data class StaffQuestion(
    val id: Int,
    val question: String,
    val answer: String?,
    val createdAt: String,
    val answeredAt: String?,
    val productId: Int,
    val productName: String,
    val image: String,
    val customer: String,
    val answeredBy: String?,
)
data class StaffQuestionListResponse(val questions: List<StaffQuestion>)
data class AnswerRequest(val answer: String)

data class OrderStatusRequest(val status: String, val courierRef: String? = null, val note: String? = null)
data class SellUpdateRequest(val status: String, val offerAmount: Double? = null, val staffNote: String? = null)
data class BulkPriceRequest(val productIds: List<Int>, val percentOff: Int? = null, val endSale: Boolean? = null)
data class BulkPriceResponse(val changed: Int?, val alerted: Int?)

data class ProductRequest(
    val name: String,
    val description: String,
    val brandId: Int,
    val categoryId: Int,
    val condition: String,
    val price: Double,
    val originalPrice: Double?,
    val sizes: List<ProductSize>,
)
data class ProductSaveResponse(val product: Product?, val savedSearchAlerts: Int?)
