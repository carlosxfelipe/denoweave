# DenoWeave

> A lightweight data transformation engine compatible with the DataWeave dialect, built from scratch in TypeScript + Deno.

---



## Requirements

- [Deno](https://deno.land/) installed on your system.
- [Deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno) for VS Code (recommended).

---

## Why Deno?

Built on Deno, this engine benefits from modern runtime security and dependency management:

- **Secure by Default (Sandbox):** No file system, network, or environment access is granted unless explicitly allowed (e.g., via the `--allow-read` flag). This prevents compromised dependencies from accessing sensitive host resources.
- **Cryptographic Integrity:** All remote dependencies are locked and verified using a lockfile (`deno.lock`). Any unauthorized modification to the source URL or repository will fail the integrity check and block execution.
- **No Install Scripts:** Unlike Node.js/npm, Deno does not run arbitrary lifecycle scripts (like `postinstall`) upon resolving dependencies, eliminating a major vector for supply chain attacks.

---

## Supported Features

DenoWeave implements a fully-featured parser and evaluator that supports modern DataWeave 2.x syntax:
- **Core Types**: Strings, Numbers, Booleans, Null, Arrays, Objects.
- **Operations**: Arithmetic, logical (`and`, `or`, `not`), comparisons, default (`default`), casting (`as`), array/string/object concatenation (`++`), and range slicing (`to`).
- **Functions & Lambdas**: Named functions (`fun`), single-param lambdas (`(x) -> x`), multi-param lambdas, anonymous lambdas (`$`, `$$`).
- **Variables & Types**: Local variables (`var`), type hints (`type`).
- **Pattern Matching**: `match` / `case` expressions including literal match, type check (`case is Type`), and named capture with guards (`case q if q > 100`).
- **Scoping**: Local scope evaluation via `do { ... }` blocks.
- **Control Flow**: `if / else` expressions.

---

## Development

```bash
# Run any .dwl file
deno task cli --script examples/json-to-json/transform.dwl --input examples/json-to-json/input.json

# CLI
deno task cli --help
```

---

## Compilation / Standalone Build

You can compile DenoWeave into a single, self-contained executable binary that runs on target systems without Deno or Node.js installed.

### Build for your current platform:
```bash
deno task compile
```
This generates the executable binary at `build/denoweave` (or `build/denoweave.exe` on Windows).

### Cross-compiling for other platforms:
You can build for other target operating systems using the `--target` flag:
```bash
# Target Linux (x64)
deno compile --allow-read --target x86_64-unknown-linux-gnu --output build/denoweave-linux src/cli/main.ts

# Target Windows (x64)
deno compile --allow-read --target x86_64-pc-windows-msvc --output build/denoweave-win src/cli/main.ts

# Target macOS (Apple Silicon / M1/M2/M3)
deno compile --allow-read --target aarch64-apple-darwin --output build/denoweave-mac src/cli/main.ts
```

### Running the binary:
```bash
./build/denoweave --script examples/json-to-json/transform.dwl --input examples/json-to-json/input.json
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
%dw 2.0
output application/json

fun stockStatus(qty: Number) = qty match {
    case 0            -> "OUT_OF_STOCK"
    case q if q > 100 -> "BULK"
    case q if q > 0   -> "AVAILABLE"
    else              -> "UNKNOWN"
}

---
payload.items map (item, index) -> do {
    var total = item.qty * item.price * 1.10
    ---
    {
        position: index + 1,
        product: item.name,
        status: stockStatus(item.qty),
        totalWithTax: round(total * 100) / 100
    }
}
```

Output:

```json
[
  { "position": 1, "product": "Notebook", "status": "AVAILABLE", "totalWithTax": 1099.99 },
  { "position": 2, "product": "Mouse",    "status": "AVAILABLE", "totalWithTax": 65.98 },
  { "position": 3, "product": "Keyboard", "status": "OUT_OF_STOCK", "totalWithTax": 0 }
]
```

---

## Running a Complete Example

The project includes practical examples organized by use-cases in the `examples/` folder. Here are the main examples you can run:

### JSON Transformation (Standalone)
Load a data file `input.json`, transform it via `transform.dwl`, and print the formatted result:
```bash
deno run --allow-read examples/json-to-json/run.ts
```

### CSV to XML (CLI)
Transform CSV to XML directly via the CLI:
```bash
deno task cli --script examples/csv-to-xml/transform.dwl --input examples/csv-to-xml/input.csv --out xml
```

### HTTP Server (API Transformation)
Run a Deno web server that accepts POST requests and transforms the incoming JSON payload in real-time:
```bash
deno run --allow-net --allow-read examples/http-server/server.ts
```

### Connectors / ETL Flow
Simulates a classic MuleSoft "Connector" flow by fetching real data from an external HTTP API and transforming it:
```bash
deno run --allow-net --allow-read examples/connectors/flow.ts
```

### Docs-as-Code Pipeline
Demonstrates a fluent, programmable API (like Apache Camel) to orchestrate data extraction, transformation, and loading (`from`, `transform`, `to`):
```bash
deno run --allow-net --allow-read examples/pipeline/run.ts
```

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
