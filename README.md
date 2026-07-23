# DenoWeave

> A lightweight data transformation engine compatible with the DataWeave
> dialect, built from scratch in TypeScript + Deno.

---

## Requirements

- [Deno](https://deno.land/) installed on your system.
- [Deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
  for VS Code (recommended).

### VS Code Setup

If you use VS Code and have the **Prettier** extension installed, it may
conflict with Deno's formatter. To use Deno's formatter automatically on save,
add the following to your `.vscode/settings.json`:

```json
"[typescript]": {
  "editor.defaultFormatter": "denoland.vscode-deno"
}
```

---

## Quick Start

No install needed — run directly from the source:

```bash
echo '[{"name":"alice","active":true},{"name":"bob","active":false}]' | \
  deno run --allow-read src/cli/main.ts \
  --expr 'payload filter ($.active) map ((u) -> { name: upper(u.name) })'
```

Output:

```json
[{ "name": "ALICE" }]
```

Or use a `.dwl` script file:

```bash
deno run --allow-read src/cli/main.ts \
  --script transform.dwl \
  --input data.json
```

Or use as a library in your Deno project:

```ts
import { evaluate } from './src/mod.ts';

const result = evaluate(
  `payload.users map ((u) -> { name: upper(u.name), active: u.enabled })`,
  { payload: { users: [{ name: 'alice', enabled: true }] } },
);
// → [{ name: 'ALICE', active: true }]
```

### Running the Examples

The project includes several practical use-cases in the `examples/` folder. Run
them from the project root:

- **JSON Transformation:** Load and transform a static file.
  ```bash
  deno run --allow-read examples/json-to-json/run.ts
  ```
- **CSV to XML (CLI):** Transform CSV to XML directly via the CLI.
  ```bash
  deno task cli --script examples/csv-to-xml/transform.dwl --input examples/csv-to-xml/input.csv --out xml
  ```
- **Error Handling:** Safely process a batch with malformed records using
  `try()`.
  ```bash
  deno run --allow-read examples/error-handling/run.ts
  ```
- **HTTP Server:** Transform incoming JSON payloads in real-time.
  ```bash
  deno run --allow-net --allow-read examples/http-server/server.ts
  ```
- **Connectors / ETL Flow:** Fetch and transform real data from an external API.
  ```bash
  deno run --allow-net --allow-read examples/connectors/flow.ts
  ```
- **Docs-as-Code Pipeline:** Orchestrate extraction, transformation, and
  loading.
  ```bash
  deno run --allow-net --allow-read examples/pipeline/run.ts
  ```

---

## Why Deno?

Deno provides unique advantages for a lightweight data transformation engine
that Node and Bun don't offer natively:

- **Run from URLs (No Install):** Users can execute DenoWeave directly from a
  URL (e.g., `deno run https://...`) without needing a `package.json`,
  `node_modules`, or an install step.
- **Single-Binary Compilation:** The built-in `deno compile` cross-compiles the
  entire engine into a standalone, zero-dependency executable natively for
  Linux, Mac, or Windows.
- **Strict Sandbox Security:** Unlike Bun, Deno denies file, network, and
  environment access by default. Executing an untrusted data transformation
  script is guaranteed safe unless explicitly granted (e.g., `--allow-read`).

---

## Supported Features

DenoWeave implements a fully-featured parser and evaluator that supports modern
DataWeave 2.x syntax:

- **Core Types**: Strings, Numbers, Booleans, Null, Arrays, Objects.
- **Operations**: Arithmetic, logical with short-circuit evaluation (`and`,
  `or`, `not`), comparisons, default (`default`), casting (`as`),
  array/string/object concatenation (`++`), and range slicing (`to`).
- **Functions & Lambdas**: Named functions (`fun`), single-param lambdas
  (`(x) -> x`), multi-param lambdas, anonymous lambdas (`$`, `$$`).
- **Infix Higher-Order Functions**: `map`, `filter`, `reduce`, plus
  DataWeave-style infix usage of `groupBy`, `orderBy`, `distinctBy`, `flatMap`,
  `mapObject`, `filterObject` and `pluck` (e.g. `payload groupBy $.category`,
  chainable: `payload filter ($.active) groupBy $.role`).
- **Variables & Types**: Local variables (`var`), type hints (`type`).
- **Pattern Matching**: `match` / `case` expressions including literal match,
  type check (`case is Type`), and named capture with guards
  (`case q if q > 100`).
- **Scoping**: Local scope evaluation via `do { ... }` blocks.
- **Control Flow**: `if / else` expressions.

---

## Compilation / Standalone Build

You can compile DenoWeave into a single, self-contained executable binary that
runs on target systems without Deno or Node.js installed.

### Build for your current platform:

```bash
deno task compile
```

This generates the executable binary at `build/denoweave` (or
`build/denoweave.exe` on Windows).

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
  {
    "position": 1,
    "product": "Notebook",
    "status": "AVAILABLE",
    "totalWithTax": 1099.99
  },
  {
    "position": 2,
    "product": "Mouse",
    "status": "AVAILABLE",
    "totalWithTax": 65.98
  },
  {
    "position": 3,
    "product": "Keyboard",
    "status": "OUT_OF_STOCK",
    "totalWithTax": 0
  }
]
```

---

## Stdlib (Selection)

| Category   | Functions                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **String** | `upper`, `lower`, `trim`, `split`, `join`, `replace`, `contains`, `startsWith`, `endsWith`, `padLeft`, `padRight`                     |
| **Array**  | `map`, `filter`, `reduce`, `groupBy`, `orderBy`, `distinctBy`, `pluck`, `first`, `last`, `sum`, `avg`, `min`, `max`, `zip`, `flatten` |
| **Object** | `keys`, `values`, `entries`, `merge`, `deepMerge`, `mapObject`, `filterObject`, `pick`, `omit`, `has`                                 |
| **Math**   | `abs`, `ceil`, `floor`, `round`, `sqrt`, `pow`, `log`, `mod`                                                                          |
| **Type**   | `typeOf`, `isNull`, `isEmpty`, `length`                                                                                               |

---

## Tests

The project includes a suite of more than 200 automated tests to ensure the
correct behavior of all components in the transformation engine.

To run the tests:

```bash
deno task test
```

To run the tests in watch mode:

```bash
deno task test:watch
```

To run the linter:

```bash
deno task lint
```

To format the code:

```bash
deno task fmt
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

## Architectural Notes vs Official DataWeave

Since this is an educational and experimental project, its architecture differs
fundamentally from the official MuleSoft DataWeave implementation:

- **Memory and Streaming:** The official JVM DataWeave engine relies heavily on
  reactive streams, which allows it to process massive files (e.g.,
  multi-gigabyte CSVs) with a very small memory footprint. DenoWeave, by
  contrast, loads the entire payload into memory to build its Abstract Syntax
  Tree (AST). This means DenoWeave will hit V8 memory limits if you attempt to
  process extremely large datasets.
- **Startup Time & Edge Computing:** While the JVM ecosystem relies on
  Ahead-of-Time (AOT) compilation (like GraalVM) to mitigate cold starts in
  serverless environments, DenoWeave runs on the V8 JavaScript engine. This
  natively leverages V8 Isolates, enabling near-instant startup times without
  compilation steps. This makes it an interesting fit for modern Edge
  environments (like Deno Deploy or Cloudflare Workers) where scripts need to
  start and execute in milliseconds, provided the payloads remain reasonably
  small.
- **Future Evolution (Streaming & Wasm):** If someone were to fork or evolve
  this project to handle multi-gigabyte files, the modern Deno ecosystem
  provides excellent native paths. The data adapters and evaluator could be
  refactored to use the Web Streams API and Async Iterators to process data
  chunk-by-chunk with a near-zero memory footprint. Alternatively, the core
  evaluation engine could be rewritten in Rust and compiled to WebAssembly
  (Wasm) to run inside Deno at near-native speeds.

---

## VS Code Extension

Note that using the official MuleSoft DataWeave extension in VS Code may cause
some noise, such as false-positive linting errors and engine incompatibilities.
Because of this, I created my own lightweight syntax highlighting extension for
DenoWeave:

[DataWeave Syntax Extension](https://github.com/carlosxfelipe/dataweave-syntax-extension)

---

## Disclaimer

DenoWeave is an independent, open-source project, implemented from scratch in
TypeScript/Deno with the sole purpose of interoperability and data
compatibility. There is no reuse of proprietary code or reverse engineering of
closed binaries.

_MuleSoft, Anypoint Platform, and DataWeave are registered trademarks of
MuleSoft, LLC, a subsidiary of Salesforce, Inc. This project has no affiliation,
sponsorship, association, or endorsement of any kind with MuleSoft or
Salesforce._

---

## License

MIT
