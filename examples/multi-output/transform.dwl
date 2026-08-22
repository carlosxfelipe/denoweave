%dw 2.0
var sales = payload.sales

fun total(items) = sumBy(items, (s) -> s.qty * s.price)
fun badge(t) = if (t >= 1000) "GOLD" else if (t >= 500) "SILVER" else "BRONZE"
fun topItem(items) = (orderBy(items, (s) -> s.qty * s.price, "desc"))[0]

// ── Output 1: flat JSON with per-item enrichment ──────────────────────────────
output application/json
---
{
  generatedAt: now() as String { format: "yyyy-MM-dd" },
  totalRevenue: round(total(sales) * 100) / 100,
  items: sales map ((s) -> {
      sku: s.sku,
      category: s.category,
      subtotal: round(s.qty * s.price * 100) / 100,
      tier: badge(s.qty * s.price),
      (discount: "10%") if (s.qty > 5)
    })
}

// ── Output 2: CSV flat export for spreadsheet / BI tools ─────────────────────
output application/csv
---
sales map ((s) -> {
    sku: s.sku,
    category: s.category,
    qty: s.qty,
    price: s.price,
    subtotal: s.qty * s.price,
    tier: badge(s.qty * s.price)
  })
