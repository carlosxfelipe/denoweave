%dw 2.0
output application/json
---
/*
 * Example: E-commerce order enrichment
 *
 * Demonstrates:
 *   - vars context (injected via --var)
 *   - p("key") property function (via --props)
 *   - expr? key-existence check for optional fields
 *   - as Date {format: "..."} custom date parsing
 *   - as String {format: "..."} custom date formatting
 *   - default, map, filter, if
 */
{
  // ── Store metadata ──────────────────────────────────────────────────────
  storeId: p("store.id") default "UNKNOWN",
  storeName: p("store.name") default "My Store",
  region: vars.region default "global",

  // ── Order header ────────────────────────────────────────────────────────
  orderId: payload.id default "",
  status: upper(payload.status default "pending"),
  currency: payload.currency default "BRL",

  // ── Date: parse dd/MM/yyyy → ISO yyyy-MM-dd ─────────────────────────────
  placedAt: (payload.placedAt as Date { format: "dd/MM/yyyy" }) as String { format: "yyyy-MM-dd" },

  // ── Customer block ──────────────────────────────────────────────────────
  customer: {
    name: payload.customer.name default "",
    email: payload.customer.email default "",
    // vip flag only emitted when present in payload
    (vip: payload.customer.vip) if (payload.customer.vip?),
    // loyaltyPoints only emitted when present and non-null
    (loyaltyPoints: payload.customer.loyaltyPoints) if (payload.customer.loyaltyPoints?)
  },

  // ── Line items ──────────────────────────────────────────────────────────
  items: (payload.items default []) map (item) -> {
    sku: item.sku default "",
    description: item.description default "",
    quantity: item.quantity default 0,
    unitPrice: item.unitPrice default 0,
    subtotal: (item.quantity default 0) * (item.unitPrice default 0),
    // optional discount, only when present
    (discount: item.discount) if (item.discount?),
    // optional notes, only when present
    (notes: item.notes) if (item.notes?)
  },

  // ── Totals ──────────────────────────────────────────────────────────────
  totals: {
    itemCount: sizeOf(payload.items default []),
    subtotal: payload.totals.subtotal default 0,
    shipping: payload.totals.shipping default 0,
    total: payload.totals.total default 0
  },

  // ── Enrichment from vars ─────────────────────────────────────────────────
  processedBy: vars.agentId default "system"
}
