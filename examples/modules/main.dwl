%dw 2.0
import * from custom::math
import titleCase as title from custom::strings
---
{
  "sum": add(10, 20),
  "product": mul(5, 5),
  "title": title("hELLO wORLD")
}
