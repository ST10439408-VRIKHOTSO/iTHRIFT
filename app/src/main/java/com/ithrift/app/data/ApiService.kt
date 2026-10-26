package com.ithrift.app.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.QueryMap

/**
 * The same REST API the website (public/js) calls. This native app talks to it too, proving the
 * one-database, multiple-clients architecture described in the System
 * Design document. Base path is configured per-environment in ApiClient
 * (it ends in "/api/", so paths below are relative to that, e.g. "auth/login").
 *
 * Reference: Retrofit service interfaces and annotations (@GET, @POST, @Body,
 * @Path, @QueryMap) with suspend functions, https://square.github.io/retrofit/
 */
interface ApiService {

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    /** Exchanges a Google ID token for an iTHRIFT session. The API verifies the token. */
    @POST("auth/sso")
    suspend fun ssoLogin(@Body body: SsoLoginRequest): Response<AuthResponse>

    /** Swaps the code from the website's Google sign-in for a session. */
    @POST("auth/sso/exchange")
    suspend fun ssoExchange(@Body body: SsoExchangeRequest): Response<AuthResponse>

    @GET("auth/sso/status")
    suspend fun ssoStatus(): Response<SsoStatusResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<OkResponse>

    @GET("auth/me")
    suspend fun me(): Response<MeResponse>

    // --- Account settings ---

    @GET("auth/profile")
    suspend fun getProfile(): Response<ProfileResponse>

    @PUT("auth/profile")
    suspend fun updateProfile(@Body body: UpdateProfileRequest): Response<MeResponse>

    @POST("auth/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequest): Response<OkResponse>

    /** Erases the signed-in customer's personal details and ends every session (POPIA; Google Play account deletion). */
    @POST("auth/delete-account")
    suspend fun deleteAccount(@Body body: DeleteAccountRequest): Response<OkResponse>

    @GET("products")
    suspend fun getProducts(@QueryMap filters: Map<String, String>): Response<ProductListResponse>

    @GET("products/{id}")
    suspend fun getProduct(@Path("id") id: Int): Response<ProductResponse>

    @GET("products/brands")
    suspend fun getBrands(): Response<BrandListResponse>

    @GET("products/categories")
    suspend fun getCategories(): Response<CategoryListResponse>

    @GET("products/sizes")
    suspend fun getSizes(): Response<SizeListResponse>

    @GET("products/suggest")
    suspend fun suggest(@Query("q") q: String): Response<SuggestResponse>

    /** Several products in the order asked for: recently viewed, compare, for you. */
    @GET("products/by-ids")
    suspend fun productsByIds(@Query("ids") ids: String): Response<ProductListResponse>

    @GET("products/{id}/similar")
    suspend fun similar(@Path("id") id: Int): Response<ProductListResponse>

    @GET("products/{id}/questions")
    suspend fun getQuestions(@Path("id") id: Int): Response<QuestionListResponse>

    @POST("products/{id}/questions")
    suspend fun askQuestion(@Path("id") id: Int, @Body body: QuestionRequest): Response<OkResponse>

    @POST("products/{id}/alerts")
    suspend fun addStockAlert(@Path("id") id: Int, @Body body: StockAlertRequest): Response<OkResponse>

    @GET("products/{id}/reviews")
    suspend fun getReviews(@Path("id") id: Int): Response<ReviewListResponse>

    @POST("products/{id}/reviews")
    suspend fun postReview(@Path("id") id: Int, @Body body: ReviewRequest): Response<OkResponse>

    @GET("cart")
    suspend fun getCart(): Response<CartResponse>

    @POST("cart/items")
    suspend fun addCartItem(@Body body: AddCartItemRequest): Response<CartResponse>

    @PUT("cart/items/{id}")
    suspend fun updateCartItem(@Path("id") id: Int, @Body body: UpdateCartItemRequest): Response<CartResponse>

    @DELETE("cart/items/{id}")
    suspend fun removeCartItem(@Path("id") id: Int): Response<CartResponse>

    @POST("orders")
    suspend fun checkout(@Body body: CheckoutRequest): Response<OrderDetailResponse>

    @GET("orders")
    suspend fun getOrders(@QueryMap filters: Map<String, String> = emptyMap()): Response<OrderListResponse>

    @GET("orders/{id}")
    suspend fun getOrder(@Path("id") id: Int): Response<OrderDetailResponse>

    // --- Delivery, promo codes, cancelling and returns ---

    @GET("orders/options")
    suspend fun getOrderOptions(): Response<OrderOptionsResponse>

    @POST("orders/quote")
    suspend fun getQuote(@Body body: QuoteRequest): Response<QuoteResponse>

    @PUT("orders/{id}/cancel")
    suspend fun cancelOrder(@Path("id") id: Int): Response<OrderDetailResponse>

    @POST("orders/{id}/returns")
    suspend fun requestReturn(@Path("id") id: Int, @Body body: ReturnRequestBody): Response<OrderDetailResponse>

    @GET("returns")
    suspend fun getReturns(): Response<ReturnListResponse>

    // --- Wishlist ---

    @GET("wishlist")
    suspend fun getWishlist(): Response<WishlistResponse>

    @POST("wishlist")
    suspend fun addToWishlist(@Body body: WishlistAddRequest): Response<WishlistResponse>

    @DELETE("wishlist/{productId}")
    suspend fun removeFromWishlist(@Path("productId") productId: Int): Response<WishlistResponse>

    // --- Address book ---

    @GET("addresses")
    suspend fun getAddresses(): Response<AddressListResponse>

    @POST("addresses")
    suspend fun addAddress(@Body body: AddressRequest): Response<AddressListResponse>

    @PUT("addresses/{id}")
    suspend fun updateAddress(@Path("id") id: Int, @Body body: AddressRequest): Response<AddressListResponse>

    @PUT("addresses/{id}/default")
    suspend fun makeDefaultAddress(@Path("id") id: Int): Response<AddressListResponse>

    @DELETE("addresses/{id}")
    suspend fun deleteAddress(@Path("id") id: Int): Response<AddressListResponse>

    // --- Account hub (release 1.3.0) ---

    @GET("account/overview")
    suspend fun accountOverview(): Response<AccountOverview>

    @PUT("account/preferences")
    suspend fun updatePreferences(@Body body: PreferencesRequest): Response<OkResponse>

    @PUT("account/style")
    suspend fun updateStyle(@Body body: StyleRequest): Response<OkResponse>

    @GET("account/for-you")
    suspend fun forYou(): Response<ForYouResponse>

    @GET("account/points")
    suspend fun points(): Response<PointsSummary>

    @GET("account/impact")
    suspend fun impact(): Response<Impact>

    @GET("account/saved-searches")
    suspend fun savedSearches(): Response<SavedSearchListResponse>

    @POST("account/saved-searches")
    suspend fun saveSearch(@Body body: SavedSearchRequest): Response<SavedSearchListResponse>

    @DELETE("account/saved-searches/{id}")
    suspend fun deleteSavedSearch(@Path("id") id: Int): Response<SavedSearchListResponse>

    @GET("account/alerts")
    suspend fun stockAlerts(): Response<StockAlertListResponse>

    @DELETE("account/alerts/{id}")
    suspend fun deleteStockAlert(@Path("id") id: Int): Response<StockAlertListResponse>

    // --- Notifications ---

    @GET("notifications")
    suspend fun notifications(): Response<NotificationListResponse>

    @GET("notifications/unread-count")
    suspend fun unreadCount(): Response<UnreadResponse>

    @PUT("notifications/read-all")
    suspend fun markAllRead(): Response<NotificationListResponse>

    @PUT("notifications/{id}/read")
    suspend fun markRead(@Path("id") id: Int): Response<NotificationListResponse>

    @DELETE("notifications/{id}")
    suspend fun deleteNotification(@Path("id") id: Int): Response<NotificationListResponse>

    // --- Selling to the shop ---

    @GET("sell")
    suspend fun sellSubmissions(@QueryMap filters: Map<String, String> = emptyMap()): Response<SellListResponse>

    @POST("sell")
    suspend fun sell(@Body body: SellRequest): Response<SellListResponse>

    @PUT("sell/{id}/respond")
    suspend fun respondToOffer(@Path("id") id: Int, @Body body: SellRespondRequest): Response<SellListResponse>

    // --- Support messages ---

    @GET("support")
    suspend fun tickets(@QueryMap filters: Map<String, String> = emptyMap()): Response<SupportListResponse>

    @POST("support")
    suspend fun createTicket(@Body body: SupportCreateRequest): Response<SupportTicketResponse>

    @GET("support/{id}")
    suspend fun ticket(@Path("id") id: Int): Response<SupportTicketResponse>

    @POST("support/{id}/messages")
    suspend fun reply(@Path("id") id: Int, @Body body: SupportMessageRequest): Response<SupportTicketResponse>

    @PUT("support/{id}/status")
    suspend fun setTicketStatus(@Path("id") id: Int, @Body body: StatusRequest): Response<SupportTicketResponse>

    // --- Staff console ---

    @GET("admin/reports/analytics")
    suspend fun analytics(): Response<Analytics>

    @GET("admin/reports/inventory")
    suspend fun inventory(): Response<InventoryReport>

    @GET("admin/collections")
    suspend fun collections(): Response<CollectionListResponse>

    @PUT("orders/{id}/status")
    suspend fun setOrderStatus(@Path("id") id: Int, @Body body: OrderStatusRequest): Response<OrderDetailResponse>

    @PUT("returns/{id}")
    suspend fun setReturnStatus(@Path("id") id: Int, @Body body: StatusRequest): Response<OkResponse>

    @GET("admin/questions")
    suspend fun staffQuestions(@Query("status") status: String): Response<StaffQuestionListResponse>

    @PUT("admin/questions/{id}")
    suspend fun answerQuestion(@Path("id") id: Int, @Body body: AnswerRequest): Response<StaffQuestionListResponse>

    @PUT("sell/{id}")
    suspend fun updateSell(@Path("id") id: Int, @Body body: SellUpdateRequest): Response<OkResponse>

    @GET("admin/promos")
    suspend fun promos(): Response<PromoListResponse>

    @POST("admin/promos")
    suspend fun createPromo(@Body body: PromoRequest): Response<PromoListResponse>

    @PUT("admin/promos/{id}")
    suspend fun updatePromo(@Path("id") id: Int, @Body body: PromoRequest): Response<PromoListResponse>

    @PUT("admin/promos/{id}")
    suspend fun setPromoActive(@Path("id") id: Int, @Body body: PromoActiveRequest): Response<PromoListResponse>

    @GET("admin/users")
    suspend fun users(): Response<UserListResponse>

    @PUT("admin/users/{id}/status")
    suspend fun setUserStatus(@Path("id") id: Int, @Body body: StatusRequest): Response<OkResponse>

    @POST("products")
    suspend fun createProduct(@Body body: ProductRequest): Response<ProductSaveResponse>

    @PUT("products/{id}")
    suspend fun updateProduct(@Path("id") id: Int, @Body body: ProductRequest): Response<ProductSaveResponse>

    @DELETE("products/{id}")
    suspend fun deleteProduct(@Path("id") id: Int): Response<OkResponse>

    @POST("products/bulk-price")
    suspend fun bulkPrice(@Body body: BulkPriceRequest): Response<BulkPriceResponse>
}
