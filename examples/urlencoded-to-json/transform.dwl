%dw 2.0
output application/json

// Decode a URL-encoded form submission and normalise it
---
{
  customer: {
    name: payload.name,
    email: lower(payload.email default ""),
    phone: payload.phone default "N/A"
  },
  order: {
    product: payload.product,
    quantity: toNumber(payload.quantity default "1"),
    gift: payload.gift == "on"
  },
  tags: payload.tag default [],
  submittedAt: now() as String { format: "yyyy-MM-dd'T'HH:mm:ss'Z'" }
}
