package com.ithrift.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ithrift.app.data.Product
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Radius
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T

/**
 * The product card: a 4 by 5 photo with the save and compare buttons on it,
 * then brand, name, price and the condition meter. The same card as
 * productCard() in the website's app.js.
 *
 * The photo is drawn by RemoteImage (Components.kt), which wraps Coil's AsyncImage.
 * Reference: Coil for Compose, https://coil-kt.github.io/coil/compose/
 */
@Composable
fun ProductCard(p: Product, modifier: Modifier = Modifier) {
    val app = LocalApp.current
    val saved = p.id in app.wishlistIds
    val comparing = p.id in app.compareIds
    val sizes = p.sizes.orEmpty()
    val sizeLine = when {
        !p.inStock -> ""
        sizes.size > 3 -> "${sizes.size} sizes"
        sizes.size == 1 -> "Size ${sizes[0].size}"
        else -> sizes.joinToString(", ") { it.size }
    }
    Column(
        modifier
            .clip(RoundedCornerShape(Radius.img))
            .clickable(role = Role.Button) { app.go(Routes.product(p.id)) }
            .semantics(mergeDescendants = false) { contentDescription = "${p.brand} ${p.name}" },
    ) {
        Box(Modifier.fillMaxWidth().aspectRatio(4f / 5f).clip(RoundedCornerShape(Radius.img))) {
            RemoteImage(p.image, Modifier.fillMaxWidth().aspectRatio(4f / 5f))
            if (!p.inStock) {
                Box(Modifier.matchParentSize().background(C.paper.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                    Text(
                        "Sold out",
                        style = T.smallStrong.copy(fontSize = 13.sp),
                        color = C.ink,
                        modifier = Modifier.shadow(2.dp, Radius.pill).clip(Radius.pill).background(C.surface).padding(horizontal = 12.dp, vertical = 6.dp),
                    )
                }
            }
            if (p.onSale && p.inStock && (p.percentOff ?: 0) > 0) {
                Text(
                    "${p.percentOff}% off",
                    style = T.tiny.copy(fontWeight = FontWeight.SemiBold, fontSize = 13.sp),
                    color = Color(0xFF1A1206),
                    modifier = Modifier.padding(10.dp).clip(Radius.pill).background(C.marigold).padding(horizontal = 10.dp, vertical = 3.dp),
                )
            }
            Column(Modifier.align(Alignment.TopEnd).padding(8.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (!app.isStaff) {
                    RoundToggle(
                        icon = Lucide.heart,
                        on = saved,
                        description = if (saved) "Remove ${p.name} from your wishlist" else "Save ${p.name} to your wishlist",
                        onTint = C.bad,
                    ) { app.toggleWishlist(p.id, p.name) }
                }
                RoundToggle(
                    icon = Lucide.columns3,
                    on = comparing,
                    description = if (comparing) "Remove ${p.name} from compare" else "Add ${p.name} to compare",
                    onTint = C.pine,
                ) { app.toggleCompare(p.id) }
            }
        }
        Column(Modifier.padding(top = Space.s3), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(p.brand, style = T.tiny.copy(fontSize = 13.sp), color = C.muted, maxLines = 1)
            Text(p.name, style = T.body.copy(fontSize = 15.sp, fontWeight = FontWeight.Medium, lineHeight = 19.sp), color = C.ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Row(Modifier.fillMaxWidth().padding(top = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                PriceText(p.price, p.originalPrice, p.onSale, Modifier.weight(1f), T.price.copy(fontSize = 15.sp))
                ConditionMeter(p.condition, label = false)
            }
            if (sizeLine.isNotEmpty()) Text(sizeLine, style = T.tiny.copy(fontSize = 13.sp), color = C.muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
fun RoundToggle(icon: androidx.compose.ui.graphics.vector.ImageVector, on: Boolean, description: String, onTint: Color, onClick: () -> Unit) {
    Box(
        Modifier
            .size(36.dp)
            .shadow(2.dp, CircleShape)
            .clip(CircleShape)
            .background(if (on) onTint else C.surface)
            .clickable(role = Role.Switch, onClick = onClick)
            .semantics {
                contentDescription = description
                stateDescription = if (on) "On" else "Off"
            },
        contentAlignment = Alignment.Center,
    ) {
        Ico(icon, size = 18.dp, tint = if (on) C.surface else C.ink2)
    }
}

/** A sideways-scrolling row of cards, as `.rail` on the website. */
@Composable
fun ProductRail(products: List<Product>, modifier: Modifier = Modifier) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = Space.s4),
        horizontalArrangement = Arrangement.spacedBy(Space.s3),
    ) {
        items(products, key = { it.id }) { p -> ProductCard(p, Modifier.width(168.dp)) }
    }
}

/** A placeholder card while products load. */
@Composable
fun SkeletonCard(modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Skeleton(Modifier.fillMaxWidth().aspectRatio(4f / 5f), Radius.img)
        Skeleton(Modifier.fillMaxWidth(0.4f).height(12.dp))
        Skeleton(Modifier.fillMaxWidth(0.8f).height(14.dp))
        Skeleton(Modifier.fillMaxWidth(0.6f).height(14.dp))
    }
}
