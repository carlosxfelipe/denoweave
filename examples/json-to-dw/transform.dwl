%dw 2.0
output application/dw

// Serialize a product catalog as DataWeave literal notation.
// The result can be pasted directly into another .dwl file as a constant.
var discount = 0.15

fun applyDiscount(price: Number) =
  round(price * (1 - discount) * 100) / 100

---
{
  generatedAt: now(),
  catalog: payload.products map (p) -> {
    id: p.id,
    name: p.name,
    category: p.category,
    originalPrice: p.price,
    discountedPrice: applyDiscount(p.price),
    inStock: p.stock > 0,
    tags: p.tags default []
  }
}
