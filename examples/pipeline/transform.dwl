%dw 2.0
output application/json
input payload application/json

// Mapeia os "Posts" da API para um modelo simplificado
---
payload map (post) -> {
    recordId: post.id,
    authorId: post.userId,
    // Extrai o título
    shortTitle: upper(post.title default "NO TITLE"),
    contentLength: sizeOf(post.body default "")
}
