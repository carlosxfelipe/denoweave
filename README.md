# DenoWeave

> A lightweight data transformation engine compatible with the DataWeave dialect, built from scratch in TypeScript + Deno.

---

## Tests

The project includes a suite of 219 automated tests to ensure the correct behavior of all components in the transformation engine.

To run the tests:

```bash
deno task test
```

To run the tests in watch mode:

```bash
deno task test:watch
```

---

## Prerequisites

- [Deno](https://deno.land/) v2+

---

## Development

```bash
# Run any .dwl file
deno task cli --script example/example.dwl --input example/order.json

# CLI
deno task cli --help
```

---

## CLI

```bash
# Filter active users from a JSON file
deno task cli --input data.json \
  --expr 'payload.users filter ((u) -> u.active)'

# Transform CSV → JSON with upper() and if
printf 'name,score\nAlice,95\nBob,72' | deno task cli \
  --in csv --out json \
  --expr 'payload map ((r) -> { name: upper(r.name), pass: if (r.score >= 80) true else false })'

# CSV → XML
deno task cli --input data.csv --out xml \
  --expr 'groupBy(payload, (r) -> r.category)'

# Run DSL script from a .dwl file
deno task cli --script script.dwl --input data.json
```

---

## DSL Example

```dw
payload.users map ((u) -> {
  name: upper(u.name),
  active: u.enabled
})
```

Output:

```json
[
  { "name": "JOHN", "active": true },
  { "name": "JANE", "active": false }
]
```

---

## Running a Complete Example

The project includes a practical, complete example that demonstrates a more complex transformation using variables, custom functions, external file reading, and standard library functions.

To run the example script located at `example/run.ts`, use the following command:

```bash
deno run --allow-read example/run.ts
```

This script loads the data file `example/order.json` via the script `example/example.dwl` and displays the formatted result in the console.

---

## Stdlib (Selection)

| Category | Functions |
|-----------|-----------|
| **String** | `upper`, `lower`, `trim`, `split`, `join`, `replace`, `contains`, `startsWith`, `endsWith`, `padLeft`, `padRight` |
| **Array** | `map`, `filter`, `reduce`, `groupBy`, `orderBy`, `distinctBy`, `pluck`, `first`, `last`, `sum`, `avg`, `min`, `max`, `zip`, `flatten` |
| **Object** | `keys`, `values`, `entries`, `merge`, `deepMerge`, `mapObject`, `filterObject`, `pick`, `omit`, `has` |
| **Math** | `abs`, `ceil`, `floor`, `round`, `sqrt`, `pow`, `log`, `mod` |
| **Type** | `typeOf`, `isNull`, `isEmpty`, `length` |

---

## Architecture

```
DSL Code
    ↓ Lexer          (src/lexer/)
Tokens
    ↓ Parser         (src/parser/)
AST
    ↓ Evaluator      (src/evaluator/)
Value
    ↓ Adapter        (src/adapters/)
JSON / CSV / XML / YAML
```

---

## Disclaimer

DenoWeave is an independent, open-source project, implemented from scratch in TypeScript/Deno with the sole purpose of interoperability and data compatibility. There is no reuse of proprietary code or reverse engineering of closed binaries.

*MuleSoft, Anypoint Platform, and DataWeave are registered trademarks of MuleSoft, LLC, a subsidiary of Salesforce, Inc. This project has no affiliation, sponsorship, association, or endorsement of any kind with MuleSoft or Salesforce.*

---

## License

MIT
