package com.ithrift.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.AppSettings
import com.ithrift.app.data.Product
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.IconTile
import com.ithrift.app.ui.components.ProductRail
import com.ithrift.app.ui.components.RemoteImage
import com.ithrift.app.ui.components.SectionHead
import com.ithrift.app.ui.components.Skeleton
import com.ithrift.app.ui.components.SkeletonCard
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.plural

/** The icon for a category tile, as categoryIcon() on the website. */
fun categoryIcon(name: String) = when (name) {
    "Footwear" -> Lucide.footprints
    "Accessories" -> Lucide.gem
    "Dresses" -> Lucide.sparkles
    else -> Lucide.shirt
}

private data class HomeData(
    val inStock: List<Product>,
    val sale: List<Product>,
    val forYou: List<Product>,
    val recent: List<Product>,
    val needsOnboarding: Boolean,
)

@Composable
fun HomeScreen() {
    val app = LocalApp.current
    var recentVersion by remember { mutableStateOf(0) }
    val load = rememberLoad<HomeData>(app.user?.id, recentVersion) {
        val api = app.api
        val all = safeApiCall { api.getProducts(mapOf("inStock" to "true", "sort" to "newest")) }
        if (all is ApiOutcome.Failure) return@rememberLoad all
        val inStock = (all as ApiOutcome.Success).data.products
        val sale = (safeApiCall { api.getProducts(mapOf("onSale" to "true", "inStock" to "true", "sort" to "discount")) } as? ApiOutcome.Success)?.data?.products.orEmpty()
        var forYou = emptyList<Product>()
        var needsOnboarding = false
        if (app.isCustomer) {
            val byId = inStock.associateBy { it.id }
            (safeApiCall { api.forYou() } as? ApiOutcome.Success)?.let { r -> forYou = r.data.productIds.mapNotNull { byId[it] } }
            (safeApiCall { api.accountOverview() } as? ApiOutcome.Success)?.let { r ->
                needsOnboarding = !r.data.style.onboarded && !AppSettings.onboardLater(app.context)
            }
        }
        val recentIds = AppSettings.recentProducts(app.context)
        val recent = if (recentIds.isEmpty()) emptyList() else
            (safeApiCall { api.productsByIds(recentIds.joinToString(",")) } as? ApiOutcome.Success)?.data?.products.orEmpty()
        ApiOutcome.Success(HomeData(inStock, sale, forYou, recent, needsOnboarding))
    }

    // A customer who has never set up their style profile is offered it once.
    LaunchedEffect(load.data?.needsOnboarding) {
        if (load.data?.needsOnboarding == true) app.go(Routes.welcome())
    }

    Screen(back = false, padded = false) {
        when (val s = load.state) {
            is Load.Loading -> HomeSkeleton()
            is Load.Failed -> ErrorState(s.message, { load.reload() })
            is Load.Ready -> HomeContent(s.data, onClearRecent = {
                AppSettings.clearRecentProducts(app.context)
                recentVersion++
            })
        }
    }
}

@Composable
private fun HomeContent(d: HomeData, onClearRecent: () -> Unit) {
    val app = LocalApp.current
    val rackCats = listOf("Footwear", "Dresses", "Knitwear", "Tees", "Jackets", "Jeans")
    val rack = rackCats.mapNotNull { c -> d.inStock.firstOrNull { it.category == c } }.take(5)
    val minPrice = d.inStock.minOfOrNull { it.price } ?: 0.0

    // Hero
    Column(Modifier.padding(horizontal = Space.s4, vertical = Space.s5)) {
        Text("Branded pieces, second time round.", style = T.display, color = C.ink, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(Space.s3))
        Text(
            "Every piece is checked, graded and sized by hand at our Pretoria store. When it is gone, it is gone.",
            style = T.body.copy(fontSize = 17.sp, lineHeight = 26.sp),
            color = C.muted,
        )
        Spacer(Modifier.height(Space.s5))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            Btn("Shop everything", { app.go(Routes.shop()) }, large = true, modifier = Modifier.weight(1f))
            Btn("Sell your clothes", { app.go(Routes.SELL) }, style = BtnStyle.Secondary, large = true, modifier = Modifier.weight(1f))
        }
        Spacer(Modifier.height(Space.s5))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s5)) {
            HeroFact(d.inStock.size.toString(), "pieces in stock")
            HeroFact(d.sale.size.toString(), "on sale now")
            HeroFact(formatMoney(minPrice), "is where prices start")
        }
    }

    // The rack: one piece from each of the busiest categories.
    if (rack.isNotEmpty()) {
        LazyRow(contentPadding = PaddingValues(horizontal = Space.s4), horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            items(rack, key = { it.id }) { p ->
                Box(
                    Modifier
                        .width(150.dp)
                        .aspectRatio(3f / 4f)
                        .clip(RoundedCornerShape(Radius.lg))
                        .clickable(role = Role.Button) { app.go(Routes.product(p.id)) }
                        .semantics { contentDescription = "${p.brand} ${p.name}" },
                ) {
                    RemoteImage(p.image, Modifier.fillMaxWidth().aspectRatio(3f / 4f))
                    Text(
                        p.category,
                        style = T.tiny.copy(fontSize = 13.sp, fontWeight = FontWeight.Medium),
                        color = C.ink,
                        modifier = Modifier.align(Alignment.BottomStart).padding(10.dp).clip(RoundedCornerShape(99.dp)).background(C.surface.copy(alpha = 0.92f)).padding(horizontal = 10.dp, vertical = 4.dp),
                    )
                }
            }
        }
    }

    Spacer(Modifier.height(Space.s6))
    if (d.forYou.isNotEmpty()) {
        SectionHead("Picked for your sizes", Modifier.padding(horizontal = Space.s4), "Edit sizes") { app.go(Routes.STYLE) }
        ProductRail(d.forYou)
    } else {
        SectionHead("Just in", Modifier.padding(horizontal = Space.s4), "See everything") { app.go(Routes.shop(mapOf("sort" to "newest"))) }
        ProductRail(d.inStock.take(10))
    }

    Spacer(Modifier.height(Space.s6))
    SectionHead("Shop by category", Modifier.padding(horizontal = Space.s4))
    val cats = app.categories.filter { (it.inStock ?: 0) > 0 }
    Column(Modifier.padding(horizontal = Space.s4), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
        cats.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                pair.forEach { c ->
                    Row(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radius.md))
                            .background(C.surface)
                            .clickable(role = Role.Button) { app.go(Routes.shop(mapOf("category" to c.name))) }
                            .padding(Space.s3),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(Space.s3),
                    ) {
                        IconTile(categoryIcon(c.name))
                        Column {
                            Text(c.name, style = T.body.copy(fontWeight = FontWeight.Medium, fontSize = 15.sp), color = C.ink)
                            Text(plural(c.inStock ?: 0, "piece"), style = T.tiny.copy(fontSize = 13.sp), color = C.muted)
                        }
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }

    if (d.sale.isNotEmpty()) {
        Spacer(Modifier.height(Space.s6))
        SectionHead("Biggest markdowns", Modifier.padding(horizontal = Space.s4), "All sale pieces") {
            app.go(Routes.shop(mapOf("onSale" to "true", "sort" to "discount")))
        }
        ProductRail(d.sale.take(10))
    }

    if (d.recent.isNotEmpty()) {
        Spacer(Modifier.height(Space.s6))
        SectionHead("You looked at", Modifier.padding(horizontal = Space.s4), "Clear", onClearRecent)
        ProductRail(d.recent)
    }

    // The selling band
    Spacer(Modifier.height(Space.s6))
    Column(
        Modifier
            .padding(horizontal = Space.s4)
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.xl))
            .background(C.pine)
            .padding(Space.s5),
    ) {
        Text("Clear your wardrobe, get paid for it.", style = T.h2.copy(fontSize = 22.sp), color = C.onPine, modifier = Modifier.semantics { heading() })
        Spacer(Modifier.height(Space.s2))
        Text(
            "We buy branded pieces in good condition. Take the offer as cash by EFT, or as Thrift Points with 20 percent extra to spend in store.",
            style = T.body,
            color = C.onPine.copy(alpha = 0.85f),
        )
        Spacer(Modifier.height(Space.s4))
        listOf(
            "Tell us the brand, size and condition.",
            "We send you an offer within two working days.",
            "Drop it at the Hatfield store and get paid.",
        ).forEachIndexed { i, step ->
            Row(Modifier.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                Box(Modifier.size(26.dp).clip(CircleShape).background(C.onPine.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                    Text("${i + 1}", style = T.smallStrong, color = C.onPine)
                }
                Text(step, style = T.body.copy(fontSize = 15.sp), color = C.onPine)
            }
        }
        Spacer(Modifier.height(Space.s4))
        Btn("Offer us a piece", { app.go(Routes.SELL) }, style = BtnStyle.Secondary)
    }
    Spacer(Modifier.height(Space.s5))
}

@Composable
private fun HeroFact(value: String, label: String) {
    Column {
        Text(value, style = T.h2, color = C.ink)
        Text(label, style = T.tiny.copy(fontSize = 13.sp), color = C.muted)
    }
}

@Composable
private fun HomeSkeleton() {
    Column(Modifier.padding(Space.s4), verticalArrangement = Arrangement.spacedBy(Space.s3)) {
        Skeleton(Modifier.fillMaxWidth(0.9f).height(40.dp))
        Skeleton(Modifier.fillMaxWidth(0.7f).height(40.dp))
        Skeleton(Modifier.fillMaxWidth().height(48.dp))
        Spacer(Modifier.height(Space.s3))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
            SkeletonCard(Modifier.weight(1f))
            SkeletonCard(Modifier.weight(1f))
        }
    }
}
