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

    @POST("auth/logout")
    suspend fun logout(): Response<OkResponse>

    @GET("auth/me")
    suspend fun me(): Response<MeResponse>

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
}
