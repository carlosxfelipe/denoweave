# Language Reference

DenoWeave implements a fully-featured parser and evaluator that supports modern
DataWeave 2.x syntax.

## Core Types

- Strings (`"Hello"`, `'World'`)
- Numbers (`42`, `3.14`)
- Booleans (`true`, `false`)
- Null (`null`)
- Arrays (`[1, 2, 3]`)
- Objects (`{ key: "value" }`)

## Dates & Math

Native Temporal API support for ISO 8601 Date and Period literals with full
date/time math capabilities.

```dw
|2024-02-20|
|P1D|
|2024-02-28| + |P1D|
```

Also supports custom date parsing and formatting via
`as Date {format: "dd/MM/yyyy"}`.

## Modules & Namespaces

Full support for `import` statements and encapsulated namespace resolution.

```dw
import * from dw::core::Strings
import sum from custom::Math
```

## Operations

- **Arithmetic**: `+`, `-`, `*`, `/`
- **Logical**: `and`, `or`, `not` (with short-circuit evaluation)
- **Comparisons**: `==`, `!=`, `>`, `<`, `>=`, `<=`
- **Default**: `default`
- **Casting**: `as`
- **Concatenation**: `++` (array, string, object)
- **Range Slicing**: `to` (e.g., `0 to 5`)

## Object Properties

- **Dynamic keys**: `(expr): value`
- **Shorthand**: `{ name }`
- **Conditional properties**: `(key: value) if (cond)`

## Selectors

- **Deep descendant (`..`)**: Traverse and query deeply nested data structures.
- **Field existence (`expr?`)**: Check if a key exists.
- **Optional chaining (`?.`)**: Safe navigation.
- **Non-null assertion (`!`)**: Enforce values.

### Deep Descendant Selector (`..`) Example

The `..` operator allows you to recursively extract all values matching a
specific key from anywhere within a deeply nested structure.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json
var payload = {
  company: {
    departments: [
      { employees: [{ name: "Alice", role: "Engineer" }] },
      { employees: [{ name: "Bob", role: "Manager" }] }
    ]
  }
}
---
payload..name
`;

const result = evaluate(script, {});
console.log(result);
// → ["Alice", "Bob"]
```

## Functions & Lambdas

- **Named functions**: `fun myFunc(x) = x * 2`
- **Lambdas**: `(x) -> x`, `(x, y) -> x + y`
- **Anonymous lambdas**: `$`, `$$`
- **Infix Higher-Order Functions**: `map`, `filter`, `reduce`, `groupBy`,
  `orderBy`, `distinctBy`, `flatMap`, `mapObject`, `filterObject`, `pluck`.

## Scoping and Variables

- **Local variables**: `var myVar = "test"`
- **Type hints**: `type MyString = String`
- **Context variables (`vars`)**: Inject variables into the script's context by
  passing them directly in the `context` argument of `evaluate`. Access them
  inside scripts with `vars.myKey`.
- **Properties (`p()`)**: Call `setProperties({ key: "value" })` before
  evaluating to populate the `p()` function. Access with `p("key")`.
- **Module resolution**: Pass a custom `moduleResolver` via `EvaluateOptions` to
  control how `import` statements resolve module sources.
- **Local scope evaluation**: `do { ... }` blocks for encapsulating local
  variables.

## Pattern Matching

Use `match` / `case` expressions for complex condition handling.

- Literal match: `case "foo" -> ...`
- Type check: `case is String -> ...`
- Named capture with guards: `case q if q > 100 -> ...`

```dw
fun stockStatus(qty: Number) = qty match {
    case 0            -> "OUT_OF_STOCK"
    case q if q > 100 -> "BULK"
    case q if q > 0   -> "AVAILABLE"
    else              -> "UNKNOWN"
}
```

## Control Flow & Error Handling

- `if / else` expressions.
- Safe evaluation using `try()`.

## Smart Error Suggestions

When an undefined variable is referenced, DenoWeave searches all names visible
in the current scope and suggests the closest match using the Levenshtein
distance algorithm. Suggestions only appear when the edit distance is ≤ 3.

```
// Script: payload.users map ((u) -> { name: u.nme })
// RuntimeError: Cannot access property "nme" of null

// Script: paylaod.users map ...
// ReferenceError: Undefined variable: "paylaod". Did you mean: "payload"?
```

## Stdlib Selection

DenoWeave ships with a comprehensive standard library. Here is a selection of
functions available:

- **String**: `upper`, `lower`, `trim`, `trimLeft`, `trimRight`, `capitalize`,
  `split`, `join`, `replace`, `contains`, `startsWith`, `endsWith`, `padLeft`,
  `padRight`, `substring`, `indexOf`, `repeat`, `matches`, `scan`
- **Array**: `map`, `filter`, `reduce`, `flatMap`, `groupBy`, `orderBy`,
  `distinctBy`, `pluck`, `first`, `last`, `take`, `drop`, `chunk`, `reverse`,
  `flatten`, `deepFlatten`, `zip`, `sum`, `avg`, `min`, `max`, `find`, `some`,
  `every`, `count`, `sumBy`, `maxBy`, `minBy`, `countBy`
- **Object**: `keys`, `values`, `entries`, `fromEntries`, `merge`, `deepMerge`,
  `mapObject`, `filterObject`, `pick`, `omit`, `has`, `invert`, `update`
- **Math**: `abs`, `ceil`, `floor`, `round`, `sqrt`, `pow`, `log`, `log10`,
  `mod`, `random`, `randomInt`, `minOf`, `maxOf`, `isDecimal`, `isInteger`
- **Type / System**: `typeOf`, `isNull`, `isEmpty`, `length`, `sizeOf` (alias
  for `length`), `now`, `uuid`, `p`, `try`, `log`, `read`, `write`, `readUrl`
