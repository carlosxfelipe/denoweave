# Examples

All examples below use `jsr:@denoweave/engine` as a library. Each snippet is a
self-contained Deno program you can run directly.

## JSON to JSON — Order Transformation

Demonstrates: `type` hints, `fun`, `var`, `match/case`, `do` blocks, `map`,
`reduce`, `sizeOf`, `now()`.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json

type Item = { name: String, qty: Number, price: Number }

var taxRate = 0.10
var currency = "USD"

fun calculateTotal(quantity: Number, unitPrice: Number): Number =
  (quantity * unitPrice) * (1 + taxRate)

fun stockStatus(qty: Number) = qty match {
  case 0            -> "OUT_OF_STOCK"
  case q if q > 100 -> "BULK"
  case q if q > 0   -> "AVAILABLE"
  else              -> "UNKNOWN"
}

---
{
  order: {
    id: payload.order.id default "NO-ID",
    customer: upper(payload.order.customer default "UNKNOWN"),
    items: (payload.order.items default []) map (item, index) -> do {
      var total = calculateTotal(item.qty, item.price)
      ---
      {
        position: index + 1,
        product: item.name,
        status: stockStatus(item.qty),
        totalWithTax: round(total * 100) / 100
      }
    },
    grandTotal: round(
      ((payload.order.items default [])
       reduce (item, acc = 0) -> acc + calculateTotal(item.qty, item.price)) * 100
    ) / 100
  }
}
`;

const result = evaluate(script, {
  payload: {
    order: {
      id: '12345',
      customer: 'John Doe',
      items: [
        { name: 'Notebook', qty: 1, price: 999.99 },
        { name: 'Mouse', qty: 2, price: 29.99 },
        { name: 'Keyboard', qty: 0, price: 79.99 },
      ],
    },
  },
});

console.log(JSON.stringify(result, null, 2));
```

---

## Error Handling with `try()`

Demonstrates: processing a batch where some records may be malformed. `try()`
returns `{ success: true, value }` or `{ success: false, error: { message } }`,
preventing a single bad record from aborting the entire transformation.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json

fun processRecord(emp) = {
  id: emp.id,
  fullName: upper(emp.name),
  annualSalary: emp.salary * 12,
  dept: emp.department.name
}

---
payload map ((emp) ->
  do {
    var result = try(() -> processRecord(emp))
    ---
    if (result.success)
      { status: "OK",    data:   result.value         }
    else
      { status: "ERROR", id:     emp.id,
                         reason: result.error.message  }
  }
)
`;

const result = evaluate(script, {
  payload: [
    { id: 1, name: 'Alice', salary: 5000, department: { name: 'Engineering' } },
    { id: 2, name: null, salary: 4000, department: { name: 'Marketing' } }, // will fail on upper(null)
    { id: 3, name: 'Bob', salary: 6000, department: { name: 'Product' } },
  ],
});

console.log(JSON.stringify(result, null, 2));
```

---

## Date Math

Demonstrates: ISO 8601 Date and Period literals, date arithmetic, `as Date`,
`as DateTime`, `as Period`.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json
---
{
  hardcoded: {
    start:    |2024-02-28|,
    nextDay:  |2024-02-28| + |P1D|,
    nextYear: |2024-02-29| + |P1Y|
  },
  dynamic: {
    projectStart: payload.start as Date,
    deadline:    (payload.start as Date) + (payload.duration as Period)
  }
}
`;

const result = evaluate(script, {
  payload: {
    start: '2024-03-01',
    duration: 'P3M',
  },
});

console.log(JSON.stringify(result, null, 2));
```

---

## Deep Descendant Selector (`..`)

Demonstrates: recursively extracting a key from an arbitrarily nested structure.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json
---
{
  allNames:   payload..name,
  uniqueRoles: (payload..role) distinctBy $
}
`;

const result = evaluate(script, {
  payload: {
    company: {
      departments: [
        {
          employees: [{ name: 'Alice', role: 'Engineer' }, {
            name: 'Bob',
            role: 'Manager',
          }],
        },
        {
          employees: [{
            name: 'Charlie',
            contacts: [{ name: 'Dave', role: 'Engineer' }],
          }],
        },
      ],
    },
  },
});

console.log(JSON.stringify(result, null, 2));
// → { allNames: ["Alice","Bob","Charlie","Dave"], uniqueRoles: ["Engineer","Manager"] }
```

---

## Module Imports

Demonstrates: importing functions from a local `.dwl` module using `import`.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

// Provide a moduleResolver so the engine can locate custom modules
const moduleResolver = (moduleName: string): string => {
  // moduleName e.g. "custom::math" -> read from disk or inline here
  const modules: Record<string, string> = {
    'custom::math': `
      fun add(a, b) = a + b
      fun mul(a, b) = a * b
    `,
  };
  const mod = modules[moduleName];
  if (!mod) throw new Error(`Module not found: ${moduleName}`);
  return mod;
};

const script = `
%dw 2.0
import * from custom::math
output application/json
---
{ sum: add(10, 20), product: mul(5, 5) }
`;

const result = evaluate(script, {}, { moduleResolver });

console.log(JSON.stringify(result, null, 2));
// → { "sum": 30, "product": 25 }
```

---

## Multi-output Script (JSON + CSV from the same payload)

Demonstrates: `splitMultiOutputScript`, evaluating multiple blocks, `serialize`.

```typescript
import {
  evaluate,
  type Format,
  serialize,
  splitMultiOutputScript,
} from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
var sales = payload.sales

fun badge(t) = if (t >= 1000) "GOLD" else if (t >= 500) "SILVER" else "BRONZE"

output application/json
---
{
  totalRevenue: sales reduce (s, acc = 0) -> acc + (s.qty * s.price),
  items: sales map ((s) -> { sku: s.sku, tier: badge(s.qty * s.price) })
}

output application/csv
---
sales map ((s) -> { sku: s.sku, qty: s.qty, price: s.price })
`;

const payload = {
  sales: [
    { sku: 'A1', qty: 10, price: 120 },
    { sku: 'B2', qty: 3, price: 50 },
  ],
};

const blocks = splitMultiOutputScript(script);

for (const block of blocks) {
  const result = evaluate(block.source, { payload });
  // block.format is a short name: 'json', 'csv', 'xml', etc.
  const output = serialize(result, block.format as Format);
  console.log(`--- ${block.format} ---`);
  console.log(output);
}
```

---

## E-commerce Enrichment with `vars`

Demonstrates: injecting runtime variables via the `context` argument. `vars` is
passed as a regular key inside the context object and accessed inside scripts
with `vars.myKey`.

```typescript
import { evaluate } from 'jsr:@denoweave/engine';

const script = `
%dw 2.0
output application/json
---
{
  region:   vars.region  default "global",
  agentId:  vars.agentId default "system",
  orderId:  payload.id   default "",
  status:   upper(payload.status default "pending"),
  placedAt: (payload.placedAt as Date { format: "dd/MM/yyyy" })
              as String { format: "yyyy-MM-dd" }
}
`;

const result = evaluate(script, {
  payload: {
    id: 'ORD-001',
    status: 'confirmed',
    placedAt: '15/08/2024',
  },
  // Inject vars as a key in the context object
  vars: {
    region: 'south-america',
    agentId: 'worker-07',
  },
});

console.log(JSON.stringify(result, null, 2));
```

> [!NOTE]
> The `p()` function (property lookup) is intended for **CLI usage** via
> `--props`. When using `@denoweave/engine` as a library, use `vars` to inject
> runtime values programmatically instead.
