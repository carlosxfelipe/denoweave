%dw 2.0
output application/json
input payload application/json

// Mapeia os "Posts" da API para um modelo simplificado
---
payload map (post) -> {
    recordId: post.id,
    authorId: post.userId,
    // Extrai uma versão curta do título limitando a 15 caracteres
    shortTitle: upper((post.title default "NO TITLE")[0 to 15]),
    contentLength: sizeOf(post.body default "")
}
