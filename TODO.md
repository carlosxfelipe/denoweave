# DenoWeave — TODO

Gaps identified relative to the official MuleSoft DataWeave 2.x engine.

---

## 🔴 High Priority — Core language correctness

- [x] **Short-circuit evaluation for `and` / `or`**
  - Both sides were always evaluated; now the right side is only evaluated when
    needed.
  - `false and null.foo` returns `false` without throwing. `true or null.foo`
    returns `true`.
  - 4 new tests added to `evaluator_test.ts`.

- [x] **Native `Date` literal type (`|2024-01-15|`) and ISO 8601 Math**
  - DataWeave supports ISO 8601 date/time/period literals using pipe delimiters.
  - **Requirement:** Must implement FULL support, not just basic string parsing.
    This includes:
    - New token types in the Lexer for Date and Period literals.
    - Custom runtime logic to handle ISO 8601 Duration math natively (e.g.,
      adding days/months considering leap years, parsing `P1Y2M3DT4H5M6S`).
  - Example: `|2024-01-15| + |P1D|` → `|2024-01-16|`

- [x] **Descendant selector `..` (deep selector)**
  - Lexer already supports the token `..`.
  - Need to parse it (`payload..users`) and evaluate by recursively traversing
    the tree and returning all values matching the key at any depth.
  - The `..` token already exists in the Lexer but is not parsed or evaluated.

- [x] **`try/catch` expression in the DSL**
  - Added `try` to `SYSTEM_FUNCTIONS` in the stdlib.
  - Matches official DataWeave behavior: returns `{ success: true, value: ... }`
    or `{ success: false, error: { message: ... } }`.
  - Can be used securely to prevent script crashes on fatal evaluations.

---

## 🟡 Medium Priority — Language features

- [x] **`type` declarations with runtime validation**
  - `type PositiveNumber = Number { minimum: 0 }` is now parsed structurally
    (base type + constraint object) and registered at runtime.
  - Constraints (`minimum`, `maximum`, `minLength`, `maxLength`, `pattern`) are
    enforced on `as` expressions and typed function params
    (`fun f(x: PositiveNumber) = ...`). Type aliases chain
    (`type Score = PositiveNumber { maximum: 100 }`).

- [x] **Module system / `import` in DSL**
  - DataWeave supports `import * from dw::core::Strings` and custom module
    files.
  - DenoWeave has no module resolution within the DSL itself.

---

## 🟡 Medium Priority — Missing stdlib functions

### String

- [x] `matches(str, regex)` — regex match, returns boolean
- [x] `scan(str, regex)` — returns all regex matches as array
- [x] `sizeOf` — alias for `length` (DataWeave uses both)

### Array

- [x] `find(array, fn)` — returns first element matching predicate (like JS
      `find`)
- [x] `some(array, fn)` — returns `true` if any element matches
- [x] `every(array, fn)` — returns `true` if all elements match
- [x] `sumBy(array, fn)` — sum by a key extractor function
- [x] `maxBy(array, fn)` — max by a key extractor function
- [x] `minBy(array, fn)` — min by a key extractor function
- [x] `countBy(array, fn)` — count elements that match predicate
- [x] `deepFlatten(array)` — recursively flattens nested arrays

### Object

- [x] `update(obj, path, fn)` — deep update of a nested field

### Math

- [x] `round(n, decimals)` — currently only rounds to integer; should support
      decimal precision
- [x] `randomInt(n)` — returns random integer from 0 to n-1
- [x] `isDecimal(n)` — returns true if number has decimal part
- [x] `isInteger(n)` — returns true if number is a whole number

### System / IO

- [x] `uuid()` — generate a random UUID v4 string
- [x] `write(value, mimeType)` — serialize a value to string inside the DSL
      (e.g. `write(payload, "application/xml")`)
- [x] `read(string, mimeType)` — parse a string into a value inside the DSL
- [x] `log(value, prefix)` — DataWeave's debug log that passes value through
      (different from math `log`)

---

## 🟢 Low Priority — Polish and DX

- [x] **Error messages with source line/column**
  - `RuntimeError` now carries `line`/`column` and prefixes messages with
    `[line:column]`, e.g. `[2:3] RuntimeError: Division by zero`.
  - The evaluator tags bubbling errors with the position of the innermost AST
    node that has one; the parser now populates `line/column` on binary, unary,
    call, index, pipe, default and infix (map/filter/reduce/etc.) nodes.

- [ ] **Badges in README** (CI badge once GitHub Actions is set up)

- [ ] **GitHub Actions CI workflow** (`.github/workflows/ci.yml`)

- [ ] **Publish to JSR** (`deno publish`)
  - Update `deno.json` `name` to `@carlosxfelipe/denoweave` before publishing.
  - Add `./cli` export pointing to `src/cli/main.ts`.

- [ ] **Playground / online demo**
  - A web UI (Monaco Editor + Deno Deploy backend) where users can type
    DataWeave and see output live.

- [ ] **CHANGELOG.md**

- [ ] **CONTRIBUTING.md**

- [ ] **GitHub Issue Templates** (bug report + feature request)

- [ ] **Test coverage report** (`deno coverage`)

---

## ✅ Already implemented (reference)

- `map`, `filter`, `reduce` (infix and function-call style)
- `groupBy`, `orderBy`, `distinctBy`, `flatMap`, `mapObject`, `filterObject`,
  `pluck`
- `match / case` with literal, type, and capture+guard patterns
- `do` blocks with local scope
- `var`, `fun`, `type` header declarations
- `default`, `as` (String, Number, Boolean), `|>` pipe
- `++` concatenation for arrays, strings, objects
- `to` range operator
- `$` and `$$` anonymous args
- Dynamic key selectors `[key]` and array selector on objects
- Adapters: JSON, CSV, XML, YAML
- Full CLI with `--expr`, `--script`, `--input`, `--out`, stdin support
- 241 automated tests across Lexer, Parser, Evaluator, Stdlib, Adapters
