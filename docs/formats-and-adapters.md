# Formats and Adapters

DenoWeave supports a wide array of data formats out-of-the-box. All adapters are
implemented in pure TypeScript/Deno with **zero npm dependencies**, keeping the
core engine lightweight and fast.

## Supported Formats

| Format         | MIME type                                                           | Description                                                                           |
| :------------- | :------------------------------------------------------------------ | :------------------------------------------------------------------------------------ |
| **JSON**       | `application/json`                                                  | The default format for input and output.                                              |
| **CSV**        | `application/csv`                                                   | RFC 4180 compliant. Supports configurable delimiter and quoting.                      |
| **XML**        | `application/xml`                                                   | Hand-written recursive-descent parser for XML data.                                   |
| **YAML**       | `application/yaml`                                                  | Supported via Deno's standard library `@std/yaml`.                                    |
| **NDJSON**     | `application/ndjson`                                                | Newline Delimited JSON. Excellent for logs (one JSON value per line).                 |
| **TEXT**       | `text/plain`                                                        | Raw string pass-through for unstructured text processing.                             |
| **URLENCODED** | `application/x-www-form-urlencoded`                                 | Parses standard form data via native `URLSearchParams`.                               |
| **MULTIPART**  | `multipart/form-data`                                               | RFC 2046 compliant; auto-detects boundaries and extracts files/fields.                |
| **DW**         | `application/dw`                                                    | DataWeave literal notation (e.g., unquoted keys, `\|date\|` pipes).                   |
| **XLSX**       | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Pure TS ZIP + ECMA-376 parser for Microsoft Excel files; no native binaries required. |

## Multi-output Scripts

A powerful feature of DenoWeave is the ability for a single `.dwl` file to
produce multiple outputs in different formats simultaneously.

You can declare several `output <mime> ---` blocks, each with its own body
expression. All blocks share the same header declarations (`%dw`, `var`, `fun`,
`type`).

### Processing Multi-output Programmatically

When using `@denoweave/engine` as a library, you can parse these scripts using
the `splitMultiOutputScript` utility.

```typescript
import {
  evaluate,
  type Format,
  serialize,
  splitMultiOutputScript,
} from 'jsr:@denoweave/engine';

const multiScript = `
%dw 2.0
var items = payload.items

// Output 1: JSON Summary
output application/json
---
{ total: sizeOf(items), ids: items map ($.id) }

// Output 2: CSV Export
output application/csv
---
items map ((item) -> { name: item.name, price: item.price })
`;

// Split the script into its individual output blocks
const blocks = splitMultiOutputScript(multiScript);

// Evaluate and serialize each block independently
for (const block of blocks) {
  const result = evaluate(block.source, {
    payload: { items: [{ id: 1, name: 'Widget', price: 9.99 }] },
  });

  // block.format is a short name like 'json', 'csv', etc. — compatible with Format
  const outputString = serialize(result, block.format as Format);

  console.log(`--- ${block.format} ---`);
  console.log(outputString);
}
```

Output:

```text
--- json ---
{
  "total": 1,
  "ids": [1]
}
--- csv ---
name,price
Widget,9.99
```
