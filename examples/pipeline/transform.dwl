%dw 2.0
output application/json
input payload application/json

// Maps the API "Posts" to a simplified model
---
payload map (post) -> {
  recordId: post.id,
  authorId: post.userId,
  // Extracts a short version of the title limited to 15 characters
  shortTitle: upper((post.title default "NO TITLE")[0 to 15]),
  contentLength: sizeOf(post.body default "")
}
