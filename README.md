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

## Development

```bash
# Run any .dwl file
deno task cli --script example/example.dwl --input example/order.json

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
./build/denoweave --script example/example.dwl --input example/order.json
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
    case 0                       -> "OUT_OF_STOCK"
    case is Number if ($ > 100) -> "BULK"
    case is Number if ($ > 0)   -> "AVAILABLE"
    else                        -> "UNKNOWN"
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
