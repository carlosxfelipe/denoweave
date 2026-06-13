%dw 2.0
output application/json

// Type hints (documentation only — not validated at runtime by Mule 4)
type Item = { name: String, qty: Number, price: Number }
type OrderPayload = { order: { id: String, customer: String, items: Array<Item> } }

var taxRate = 0.10
var currency = "USD"

fun calculateTotal(quantity: Number, unitPrice: Number): Number =
    (quantity * unitPrice) * (1 + taxRate)

fun formatCurrency(value: Number) = {
    value: round(value * 100) / 100,
    currency: currency
}

fun stockStatus(qty: Number) = qty match {
    case 0            -> "OUT_OF_STOCK"
    case q if q > 100 -> "BULK"
    case q if q > 0   -> "AVAILABLE"
    else              -> "UNKNOWN"
}

---
{
  order: {
    id: payload.order.id default "NO-ID",
    customer: upper(payload.order.customer default "UNKNOWN"),
    date: now() as String { format: "yyyy-MM-dd HH:mm:ss" },
    items: (payload.order.items default []) map (item, index) -> do {
      var total = calculateTotal(item.qty, item.price)
      ---
      {
        position: index + 1,
        product: item.name,
        quantity: item.qty,
        status: stockStatus(item.qty),
        unitPrice: formatCurrency(item.price),
        totalWithTax: formatCurrency(total)
      }
    },
    validItems: sizeOf((payload.order.items default []) filter ($.qty > 0)),
    grandTotal: formatCurrency(
      (payload.order.items default [])
        reduce (item, acc = 0) -> acc + calculateTotal(item.qty, item.price)
    )
  }
}
