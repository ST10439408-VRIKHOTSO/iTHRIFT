@file:OptIn(ExperimentalLayoutApi::class)

package com.ithrift.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.ithrift.app.data.ApiOutcome
import com.ithrift.app.data.Product
import com.ithrift.app.data.ProductListResponse
import com.ithrift.app.data.SavedSearchRequest
import com.ithrift.app.data.safeApiCall
import com.ithrift.app.ui.Load
import com.ithrift.app.ui.LocalApp
import com.ithrift.app.ui.Routes
import com.ithrift.app.ui.Screen
import com.ithrift.app.ui.ToastKind
import com.ithrift.app.ui.components.Btn
import com.ithrift.app.ui.components.BtnStyle
import com.ithrift.app.ui.components.CONDITIONS
import com.ithrift.app.ui.components.Chip
import com.ithrift.app.ui.components.ConditionMeter
import com.ithrift.app.ui.components.EmptyState
import com.ithrift.app.ui.components.ErrorState
import com.ithrift.app.ui.components.Field
import com.ithrift.app.ui.components.LinkText
import com.ithrift.app.ui.components.PageHead
import com.ithrift.app.ui.components.ProductCard
import com.ithrift.app.ui.components.Sheet
import com.ithrift.app.ui.components.SkeletonCard
import com.ithrift.app.ui.components.SwitchRow
import com.ithrift.app.ui.rememberLoad
import com.ithrift.app.ui.run
import com.ithrift.app.ui.theme.C
import com.ithrift.app.ui.theme.Lucide
import com.ithrift.app.ui.theme.Space
import com.ithrift.app.ui.theme.T
import com.ithrift.app.util.formatMoney
import com.ithrift.app.util.plural

private val LIST_FILTERS = listOf("category", "brand", "size", "condition")
private fun splitList(v: String?): List<String> = v?.split(",")?.map { it.trim() }?.filter { it.isNotEmpty() } ?: emptyList()

/** The filters with some changed; an empty value removes a filter, as shopQueryWith() on the website. */
private fun withChanges(f: Map<String, String>, changes: Map<String, String>): Map<String, String> =
    (f + changes).filterValues { it.isNotBlank() }

private fun shopTitle(f: Map<String, String>): String {
    val cats = splitList(f["category"])
    val brands = splitList(f["brand"])
    return when {
        !f["q"].isNullOrBlank() -> "Results for “${f["q"]}”"
        f["onSale"] == "true" && cats.isEmpty() && brands.isEmpty() -> "Sale"
        brands.size == 1 && cats.isEmpty() -> brands[0]
        cats.size == 1 && brands.isEmpty() -> cats[0]
        brands.size == 1 && cats.size == 1 -> "${brands[0]} ${cats[0].lowercase()}"
        else -> "Shop"
    }
}

private val SORTS = listOf("" to "Featured", "newest" to "Newest", "price_asc" to "Price, low to high", "price_desc" to "Price, high to low", "discount" to "Biggest discount")

private data class ShopData(val result: ProductListResponse, val mySizes: List<String>)

@Composable
fun ShopScreen(filters: Map<String, String>) {
    val app = LocalApp.current
    var showFilters by remember { mutableStateOf(false) }
    var showSort by remember { mutableStateOf(false) }
    var showSave by remember { mutableStateOf(false) }

    val load = rememberLoad<ShopData>(filters, app.user?.id) {
        var mySizes = emptyList<String>()
        if (app.isCustomer) {
            (safeApiCall { app.api.accountOverview() } as? ApiOutcome.Success)?.let { mySizes = it.data.style.sizes }
        }
        val query = filters.toMutableMap()
        query.remove("mine")
        if (filters["mine"] == "1" && mySizes.isNotEmpty()) query["size"] = mySizes.joinToString(",")
        when (val r = safeApiCall { app.api.getProducts(query) }) {
            is ApiOutcome.Success -> ApiOutcome.Success(ShopData(r.data, mySizes))
            is ApiOutcome.Failure -> r
        }
    }

    val go: (Map<String, String>) -> Unit = { next ->
        app.nav.navigate(Routes.shop(next)) {
            popUpTo(Routes.SHOP) { inclusive = true }
            launchSingleTop = true
        }
    }

    val chips = buildList {
        for (k in LIST_FILTERS) for (v in splitList(filters[k])) {
            add((if (k == "size") "Size $v" else v) to withChanges(filters, mapOf(k to splitList(filters[k]).filter { it != v }.joinToString(","))))
        }
        filters["minPrice"]?.let { add("From ${formatMoney(it.toDoubleOrNull() ?: 0.0)}" to withChanges(filters, mapOf("minPrice" to ""))) }
        filters["maxPrice"]?.let { add("Up to ${formatMoney(it.toDoubleOrNull() ?: 0.0)}" to withChanges(filters, mapOf("maxPrice" to ""))) }
        if (filters["onSale"] == "true") add("On sale" to withChanges(filters, mapOf("onSale" to "")))
        if (filters["inStock"] == "true") add("In stock" to withChanges(filters, mapOf("inStock" to "")))
        if (!filters["q"].isNullOrBlank()) add("“${filters["q"]}”" to withChanges(filters, mapOf("q" to "")))
    }
    val activeCount = LIST_FILTERS.sumOf { splitList(filters[it]).size } +
        listOf("minPrice", "maxPrice").count { !filters[it].isNullOrBlank() } +
        listOf("onSale", "inStock").count { filters[it] == "true" }
    val canSave = app.isCustomer && chips.isNotEmpty()
    val title = shopTitle(filters)
    val cats = splitList(filters["category"])

    Screen(title = title, back = true, scroll = false) {
        val data = load.data
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(start = Space.s4, end = Space.s4, top = Space.s4, bottom = Space.s7),
            horizontalArrangement = Arrangement.spacedBy(Space.s3),
            verticalArrangement = Arrangement.spacedBy(Space.s5),
        ) {
            item(span = { GridItemSpan(maxLineSpan) }) {
                Column {
                    PageHead(title)
                    // Filters, my sizes and the category chips, as the website's shop bar.
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(Space.s2)) {
                        item {
                            Chip(if (activeCount > 0) "Filters ($activeCount)" else "Filters", false, { showFilters = true }, icon = Lucide.slidersHorizontal)
                        }
                        val mySizes = data?.mySizes.orEmpty()
                        if (mySizes.isNotEmpty()) item {
                            val on = filters["mine"] == "1"
                            Chip("My sizes", on, { go(withChanges(filters, mapOf("mine" to if (on) "" else "1"))) }, icon = Lucide.ruler)
                        }
                        item { Chip("All", cats.isEmpty(), { go(withChanges(filters, mapOf("category" to ""))) }) }
                        items(app.categories.filter { (it.inStock ?: 0) > 0 }, key = { it.id }) { c ->
                            Chip(c.name, c.name in cats, {
                                go(withChanges(filters, mapOf("category" to if (cats.size == 1 && cats[0] == c.name) "" else c.name)))
                            })
                        }
                    }
                    if (chips.isNotEmpty()) {
                        Spacer(Modifier.height(Space.s3))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                            for ((label, next) in chips) Chip(label, true, { go(next) }, removable = true)
                            LinkText("Clear all", { go(emptyMap()) }, color = C.muted, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
                        }
                    }
                    Spacer(Modifier.height(Space.s3))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        val count = data?.result?.products?.size
                        Text(
                            if (count == null) "Loading" else plural(count, "piece") +
                                if (filters["mine"] == "1" && !data?.mySizes.isNullOrEmpty()) " in ${data?.mySizes.orEmpty().joinToString(", ")}" else "",
                            style = T.small,
                            color = C.muted,
                            modifier = Modifier.weight(1f),
                        )
                        if (canSave) Btn("Save search", { showSave = true }, style = BtnStyle.Ghost, small = true, icon = Lucide.bookmarkPlus)
                        Btn(SORTS.firstOrNull { it.first == (filters["sort"] ?: "") }?.second ?: "Featured", { showSort = true }, style = BtnStyle.Quiet, small = true, icon = Lucide.arrowUpDown)
                    }
                }
            }
            when (val s = load.state) {
                is Load.Loading -> items(6) { SkeletonCard() }
                is Load.Failed -> item(span = { GridItemSpan(maxLineSpan) }) { ErrorState(s.message, { load.reload() }) }
                is Load.Ready -> {
                    val products = s.data.result.products
                    if (products.isEmpty()) {
                        item(span = { GridItemSpan(maxLineSpan) }) {
                            EmptyState(
                                icon = Lucide.search,
                                title = "Nothing matches yet",
                                text = if (canSave) "Pieces come in every week. Save this search and we will tell you when something matching arrives." else "Try fewer filters, or a different word.",
                                actionLabel = if (canSave) "Save this search" else "Clear filters",
                                onAction = { if (canSave) showSave = true else go(emptyMap()) },
                                secondaryLabel = if (canSave) "Clear filters" else null,
                                onSecondary = { go(emptyMap()) },
                            )
                        }
                    } else {
                        items(products, key = { it.id }) { p: Product -> ProductCard(p) }
                    }
                }
            }
        }
    }

    if (showFilters) {
        FiltersSheet(filters, load.data?.result?.priceRange?.min, load.data?.result?.priceRange?.max, onDismiss = { showFilters = false }, onApply = { showFilters = false; go(it) })
    }
    if (showSort) {
        Sheet("Sort", onDismiss = { showSort = false }) {
            for ((value, label) in SORTS) {
                com.ithrift.app.ui.components.OptionCard(
                    selected = (filters["sort"] ?: "") == value,
                    onClick = { showSort = false; go(withChanges(filters, mapOf("sort" to value))) },
                    title = label,
                    modifier = Modifier.padding(bottom = Space.s2),
                )
            }
        }
    }
    if (showSave) {
        SaveSearchSheet(filters, load.data?.result?.summary ?: title) { showSave = false }
    }
}

/** Size buttons grouped the way the website groups them. */
fun sizeGroups(sizes: List<String>): List<Pair<String, List<String>>> {
    val letters = listOf("XS", "S", "M", "L", "XL", "XXL")
    return kotlin.collections.listOf(
        "Tops and dresses" to sizes.filter { it in letters },
        "Shoes" to sizes.filter { it.startsWith("UK ") },
        "Waist" to sizes.filter { it.all(Char::isDigit) },
        "Accessories" to sizes.filter { it == "One Size" },
    ).filter { it.second.isNotEmpty() }
}

@Composable
private fun FiltersSheet(filters: Map<String, String>, minPrice: Double?, maxPrice: Double?, onDismiss: () -> Unit, onApply: (Map<String, String>) -> Unit) {
    val app = LocalApp.current
    val sel = remember { LIST_FILTERS.associateWith { k -> mutableStateListOf<String>().apply { addAll(splitList(filters[k])) } } }
    var min by remember { mutableStateOf(filters["minPrice"] ?: "") }
    var max by remember { mutableStateOf(filters["maxPrice"] ?: "") }
    var onSale by remember { mutableStateOf(filters["onSale"] == "true") }
    var inStock by remember { mutableStateOf(filters["inStock"] == "true") }
    var priceError by remember { mutableStateOf<String?>(null) }
    var showGrades by remember { mutableStateOf(false) }

    fun toggle(k: String, v: String) {
        val list = sel.getValue(k)
        if (v in list) list.remove(v) else list.add(v)
    }

    Sheet(
        "Filters",
        onDismiss = onDismiss,
        footer = {
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                Btn("Clear all", { onApply(if (filters["q"].isNullOrBlank()) emptyMap() else mapOf("q" to filters["q"]!!)) }, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
                Btn("Show results", {
                    val lo = min.toDoubleOrNull()
                    val hi = max.toDoubleOrNull()
                    if (lo != null && hi != null && lo > hi) {
                        priceError = "The lowest price is higher than the highest price."
                    } else {
                        onApply(withChanges(filters, LIST_FILTERS.associateWith { sel.getValue(it).joinToString(",") } + mapOf(
                            "minPrice" to min.trim(), "maxPrice" to max.trim(),
                            "onSale" to if (onSale) "true" else "", "inStock" to if (inStock) "true" else "",
                        )))
                    }
                }, modifier = Modifier.weight(1f))
            }
        },
    ) {
        FilterGroup("Category") {
            for (c in app.categories.filter { (it.inStock ?: 0) > 0 }) Chip(c.name, c.name in sel.getValue("category"), { toggle("category", c.name) })
        }
        Text("Size", style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s4, bottom = Space.s2))
        for ((label, list) in sizeGroups(app.sizes)) {
            Text(label, style = T.small, color = C.muted, modifier = Modifier.padding(top = Space.s2, bottom = 6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                for (v in list) Chip(v, v in sel.getValue("size"), { toggle("size", v) })
            }
        }
        FilterGroup("Condition") {
            for (c in CONDITIONS.keys) {
                val on = c in sel.getValue("condition")
                Chip(c, on, { toggle("condition", c) })
            }
        }
        LinkText("What the grades mean", { showGrades = true }, modifier = Modifier.padding(top = Space.s2))
        FilterGroup("Brand") {
            for (b in app.brands) Chip(b.name, b.name in sel.getValue("brand"), { toggle("brand", b.name) })
        }
        Text("Price", style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s5, bottom = Space.s2))
        Row(horizontalArrangement = Arrangement.spacedBy(Space.s3), verticalAlignment = Alignment.CenterVertically) {
            Field("From", min, { min = it.filter(Char::isDigit); priceError = null }, Modifier.weight(1f), placeholder = minPrice?.let { formatMoney(kotlin.math.floor(it)) }, keyboardType = KeyboardType.Number)
            Field("To", max, { max = it.filter(Char::isDigit); priceError = null }, Modifier.weight(1f), placeholder = maxPrice?.let { formatMoney(kotlin.math.ceil(it)) }, keyboardType = KeyboardType.Number)
        }
        if (priceError != null) Text(priceError!!, style = T.small, color = C.bad)
        SwitchRow("On sale only", onSale, { onSale = it })
        SwitchRow("Hide sold-out pieces", inStock, { inStock = it })
    }
    if (showGrades) ConditionGuideSheet { showGrades = false }
}

@Composable
private fun FilterGroup(title: String, content: @Composable () -> Unit) {
    Text(title, style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s4, bottom = Space.s2))
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) { content() }
}

/** The four grades, each with its meter and what it means. */
@Composable
fun ConditionGuideSheet(onDismiss: () -> Unit) {
    Sheet("How we grade condition", onDismiss = onDismiss) {
        Text("Every piece is checked by hand before it is listed. The meter on each piece shows its grade at a glance.", style = T.body, color = C.muted)
        for ((name, v) in CONDITIONS) {
            Column(Modifier.fillMaxWidth().padding(top = Space.s4)) {
                ConditionMeter(name, large = true)
                Text(v.second, style = T.body, color = C.ink2, modifier = Modifier.padding(top = 6.dp))
            }
        }
        Spacer(Modifier.height(Space.s3))
        Text("Anything that fits differently from its label, or any mark worth knowing about, is written in the description.", style = T.small, color = C.muted)
    }
}

@Composable
private fun SaveSearchSheet(filters: Map<String, String>, summary: String, onDismiss: () -> Unit) {
    val app = LocalApp.current
    var name by remember { mutableStateOf(summary.take(40)) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val criteria: Map<String, Any> = filters.filterKeys { it != "sort" && it != "mine" }.mapValues { (k, v) ->
        when {
            k in LIST_FILTERS -> splitList(v)
            v == "true" -> true
            k == "minPrice" || k == "maxPrice" -> v.toDoubleOrNull() ?: v
            else -> v
        }
    }
    Sheet(
        "Save this search",
        onDismiss = onDismiss,
        footer = {
            Row(horizontalArrangement = Arrangement.spacedBy(Space.s3)) {
                Btn("Cancel", onDismiss, style = BtnStyle.Secondary, modifier = Modifier.weight(1f))
                Btn("Save search", {
                    if (name.isBlank()) { error = "Give the search a name."; return@Btn }
                    busy = true
                    app.run({ safeApiCall { app.api.saveSearch(SavedSearchRequest(name.trim(), criteria)) } }, onDone = { busy = false }, onError = { error = it }) {
                        onDismiss()
                        app.toast("Search saved. We will tell you about new matches.", ToastKind.Success, "View") { app.go(Routes.SAVED) }
                    }
                }, loading = busy, modifier = Modifier.weight(1f))
            }
        },
    ) {
        Text("We will add a notification when a new piece matches: $summary.", style = T.body, color = C.muted, modifier = Modifier.padding(bottom = Space.s4))
        Field("Name", name, { name = it; error = null }, error = error, maxLength = 40)
    }
}

/* ----------------------------- Search ----------------------------- */

@Composable
fun SearchScreen() {
    val app = LocalApp.current
    var q by remember { mutableStateOf("") }
    var recent by remember { mutableStateOf(com.ithrift.app.data.AppSettings.recentSearches(app.context)) }
    val suggest = rememberLoad<com.ithrift.app.data.SuggestResponse>(q.trim()) {
        if (q.trim().isEmpty()) ApiOutcome.Success(com.ithrift.app.data.SuggestResponse(emptyList(), emptyList(), emptyList()))
        else {
            kotlinx.coroutines.delay(200)
            safeApiCall { app.api.suggest(q.trim()) }
        }
    }
    val focus = remember { androidx.compose.ui.focus.FocusRequester() }
    androidx.compose.runtime.LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }

    fun submit(text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        com.ithrift.app.data.AppSettings.addRecentSearch(app.context, t)
        app.go(Routes.shop(mapOf("q" to t)))
    }

    Screen(title = "Search", back = false) {
        PageHead("Search")
        com.ithrift.app.ui.components.SearchBox(
            q, { q = it },
            placeholder = "Brands, pieces, categories",
            onSubmit = { submit(q) },
            focusModifier = Modifier.focusRequester(focus),
        )
        val s = suggest.data
        if (q.isNotBlank() && s != null) {
            Spacer(Modifier.height(Space.s3))
            com.ithrift.app.ui.components.ListCard {
                if (s.products.isEmpty() && s.brands.isEmpty() && s.categories.isEmpty()) {
                    Text("No pieces match “${q.trim()}” yet. Try a brand or a category.", style = T.body, color = C.muted, modifier = Modifier.padding(Space.s4))
                }
                s.products.forEachIndexed { i, p ->
                    Row(
                        Modifier.fillMaxWidth().padding(horizontal = 0.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        com.ithrift.app.ui.components.ListRow(
                            title = p.name,
                            sub = p.brand + if (!p.inStock) ", sold out" else "",
                            meta = formatMoney(p.price),
                            chevron = false,
                            divider = i > 0,
                            onClick = { com.ithrift.app.data.AppSettings.addRecentSearch(app.context, q.trim()); app.go(Routes.product(p.id)) },
                        )
                    }
                }
                for (b in s.brands) {
                    com.ithrift.app.ui.components.ListRow(title = b, sub = "Brand", icon = Lucide.tag, divider = true, onClick = { app.go(Routes.shop(mapOf("brand" to b))) })
                }
                for (c in s.categories) {
                    com.ithrift.app.ui.components.ListRow(title = c, sub = "Category", icon = categoryIcon(c), divider = true, onClick = { app.go(Routes.shop(mapOf("category" to c))) })
                }
                com.ithrift.app.ui.components.ListRow(title = "See all results for “${q.trim()}”", icon = Lucide.search, iconTone = com.ithrift.app.ui.components.Tone.Pine, divider = true, onClick = { submit(q) })
            }
        } else {
            if (recent.isNotEmpty()) {
                Row(Modifier.fillMaxWidth().padding(top = Space.s6, bottom = Space.s3), verticalAlignment = Alignment.CenterVertically) {
                    Text("Recent searches", style = T.h3, color = C.ink, modifier = Modifier.weight(1f))
                    LinkText("Clear", {
                        com.ithrift.app.data.AppSettings.clearRecentSearches(app.context)
                        recent = emptyList()
                    })
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                    for (r in recent) Chip(r, false, { submit(r) }, icon = Lucide.clock)
                }
            }
            Text("Popular brands", style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s6, bottom = Space.s3))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Space.s2), verticalArrangement = Arrangement.spacedBy(Space.s2)) {
                for (b in kotlin.collections.listOf("Nike", "Adidas", "Zara", "Tommy Hilfiger", "Puma", "Guess")) {
                    Chip(b, false, { app.go(Routes.shop(mapOf("brand" to b))) })
                }
            }
            Text("Categories", style = T.h3, color = C.ink, modifier = Modifier.padding(top = Space.s6, bottom = Space.s3))
            com.ithrift.app.ui.components.ListCard {
                app.categories.filter { (it.inStock ?: 0) > 0 }.forEachIndexed { i, c ->
                    com.ithrift.app.ui.components.ListRow(
                        title = c.name,
                        icon = categoryIcon(c.name),
                        meta = (c.inStock ?: 0).toString(),
                        divider = i > 0,
                        onClick = { app.go(Routes.shop(mapOf("category" to c.name))) },
                    )
                }
            }
            if (app.categories.isEmpty()) Spacer(Modifier.width(1.dp))
        }
    }
}
