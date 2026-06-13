%dw 2.0
output application/json

// Transforms the large array of complex API objects
// into a clean, standardized list for our mock "database"
---
payload map (user) -> {
  contactId: user.id,
  fullName: user.name,
  // Lowercase the email for standardization
  contactEmail: lower(user.email default ""),
  // Concatenate city and zip code
  cityAndZip: (user.address.city default "Unknown") ++ " - " ++ (user.address.zipcode default "")
}
