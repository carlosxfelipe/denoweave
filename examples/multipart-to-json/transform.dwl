%dw 2.0
output application/json

// Extract fields from a multipart/form-data upload
var p = payload.parts

---
{
  profile: {
    username: p.username.content,
    email: lower(p.email.content default ""),
    bio: trim(p.bio.content default "")
  },
  avatar: {
    provided: has(p, "avatar"),
    contentType: p.avatar.headers."content-type" default "N/A"
  },
  metadata: {
    processedAt: now() as String { format: "yyyy-MM-dd'T'HH:mm:ss'Z'" }
  }
}
