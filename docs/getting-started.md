# Getting Started with DenoWeave

DenoWeave is an independent implementation of a DataWeave-compatible runtime for
Deno, written from scratch in TypeScript.

This guide will show you how to start a new project, install the DenoWeave
engine from JSR, and use it programmatically in your applications.

## 1. Create a New Project

If you don't have a Deno project set up yet, you can create a new one using the
Deno CLI. Open your terminal and run:

```bash
mkdir my-denoweave-app
cd my-denoweave-app
deno init
```

This will generate a basic project structure with a `main.ts` file and a
`deno.json` configuration file.

## 2. Install DenoWeave

DenoWeave is published to the JSR registry. You can add it to your project with
a single command:

```bash
deno add jsr:@denoweave/engine
```

This updates your `deno.json` to include the `@denoweave/engine` dependency.

## 3. Basic Usage (Evaluating Scripts)

The most common use case is evaluating a DataWeave script against an input
payload. You can use the `evaluate` function for this.

Open your `main.ts` and add the following:

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

// 1. Define your DataWeave script
const script = `
%dw 2.0
output application/json
---
payload.users map ((u) -> { 
  name: upper(u.name), 
  active: u.enabled 
})
`;

// 2. Define your input data
const inputData = {
  payload: {
    users: [
      { name: 'alice', enabled: true },
      { name: 'bob', enabled: false },
    ],
  },
};

// 3. Evaluate the script
const result = evaluate(script, inputData);

console.log(result);
// Output:
// [
//   { name: 'ALICE', active: true },
//   { name: 'BOB', active: false }
// ]
```

Run your code:

```bash
deno run main.ts
```

## 4. Advanced Usage

The `@denoweave/engine` package exports several advanced utilities for handling
multi-output scripts and serialization.

### Working with Multi-output Scripts

DataWeave scripts can generate multiple outputs (e.g., a JSON report and a CSV
summary) in a single file using multiple `output` blocks.

You can parse and separate these blocks using `splitMultiOutputScript`:

```typescript
import { evaluate, splitMultiOutputScript } from 'jsr:@denoweave/engine';

const multiScript = `
%dw 2.0
var items = payload.items

output application/json
---
{ total: sizeOf(items) }

output application/csv
---
items map ((item) -> { name: item.name })
`;

// Split the script into its individual output blocks
const blocks = splitMultiOutputScript(multiScript);

for (const block of blocks) {
  // Evaluate each block independently against the same payload
  const result = evaluate(block.source, {
    payload: { items: [{ name: 'Widget' }] },
  });

  console.log(`Generated Format: ${block.format}`);
  console.log(result);
}
```

### Serializing Data

If you need to serialize the evaluated JavaScript object back into a specific
string format (like CSV or XML), you can use the `serialize` function along with
the `Format` type:

```typescript
import { evaluate, type Format, serialize } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/csv
---
[{ name: "Alice", age: 30 }, { name: "Bob", age: 25 }]
`;

// 1. Evaluate the script (this returns a JS Array/Object directly)
const result = evaluate(script, {});

// 2. Serialize the result back into a string based on the format (CSV)
const csvString = serialize(result, 'application/csv' as Format);

console.log(csvString);
// Output:
// name,age
// Alice,30
// Bob,25
```

## Next Steps

- Explore the [Language Reference](./language-reference.md) to learn more about
  the supported DataWeave syntax.
- Check out the [Formats and Adapters](./formats-and-adapters.md) to see all
  supported data types (XML, XLSX, YAML, etc.).
- See [Examples](./examples.md) for more use cases and scenarios.
- Check the [CLI Usage](./cli.md) to learn how to use the command-line tool.
