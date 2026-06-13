%dw 2.0
output application/json

---
{
  message: "Hello from DenoWeave API!",
  originalUser: payload.user default "Anonymous",
  status: if ((payload.age default 0) >= 18) "ADULT" else "MINOR",
  processedAt: now() as String { format: "yyyy-MM-dd HH:mm:ss" }
}
