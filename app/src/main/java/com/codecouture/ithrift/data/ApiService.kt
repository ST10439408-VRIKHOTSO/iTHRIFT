package com.codecouture.ithrift.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.QueryMap

/**
 * The same REST API the desktop website (public/js) and the mobile PWA
 * (public/mobile/js) call. This native app talks to it too, proving the
 * one-database, multiple-clients architecture described in the System
 * Design document. Base path is configured per-environment in ApiClient
 * (it ends in "/api/", so paths below are relative to that, e.g. "auth/login").
 */
interface ApiService {

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    /** Exchanges a Google ID token for an iTHRIFT session. The API verifies the token. */
    @POST("auth/sso")
    suspend fun ssoLogin(@Body body: SsoLoginRequest): Response<AuthResponse>

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

    @GET("products")
    suspend fun getProducts(@QueryMap filters: Map<String, String>): Response<ProductListResponse>

    @GET("products/{id}")
    suspend fun getProduct(@Path("id") id: Int): Response<ProductResponse>

    @GET("products/brands")
    suspend fun getBrands(): Response<BrandListResponse>

    @GET("products/categories")
    suspend fun getCategories(): Response<CategoryListResponse>

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
    suspend fun getOrders(): Response<OrderListResponse>

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
}
