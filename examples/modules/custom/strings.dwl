%dw 2.0
fun titleCase(str) = upper(substring(str, 0, 1)) ++ lower(substring(str, 1, length(str)))
---
null
