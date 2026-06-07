%dw 2.0
output application/json
input payload application/json

// Payload type definition
type OrderPayload = {
    order: {
            id: String,
            customer: String,
            items: Array<{
                        name: String,
                        qty: Number,
                        price: Number
                    }>
        }
}

// Variables — in a real Mule flow these would come from the flow vars
var taxRate = 0.10
var currency = "USD"

// Calculate item total including tax
fun calculateTotal(quantity: Number, unitPrice: Number): Number =
    (quantity * unitPrice) * (1 + taxRate)

// Create a structured currency object
fun formatCurrency(value: Number) = {
        value: round(value * 100) / 100,
        currency: currency
    }

---
{
    order: {
            id: payload.order.id default "NO-ID",
            customer: upper(payload.order.customer default "UNKNOWN"),
            date: now() as String { format: "yyyy-MM-dd HH:mm:ss" },

            items: (payload.order.items default []) map (item, index) -> {
                                position: index + 1,
                                product: item.name,
                                quantity: item.qty,
                                unitPrice: formatCurrency(item.price),
                                totalWithTax: formatCurrency(calculateTotal(item.qty, item.price))
                            },

            validItems: sizeOf((payload.order.items default []) filter ($.qty > 0)),

            grandTotal: formatCurrency(
                    (payload.order.items default [])
                        reduce ((item, accumulator = 0) ->
                                accumulator + calculateTotal(item.qty, item.price))
        )
        }
}
