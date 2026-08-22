# CLI Reference

The DenoWeave CLI is available in two ways:

1. **From source** (when working inside the repository):
   ```bash
   deno task cli [OPTIONS]
   ```
2. **As a compiled standalone binary** (no Deno required on target machine):
   ```bash
   deno task compile
   ./build/denoweave [OPTIONS]
   ```

> [!NOTE]
> The CLI is not a named export of `jsr:@denoweave/engine`. It is a standalone
> entrypoint bundled in the source repository. For programmatic use inside your
> own Deno projects, use the `evaluate`, `serialize`, and related functions from
> the library instead. See [Getting Started](./getting-started.md).

---

## Options

| Flag          | Short | Argument     | Description                                                                                         |
| :------------ | :---: | :----------- | :-------------------------------------------------------------------------------------------------- |
| `--input`     | `-i`  | `<file>`     | Input data file. Use `-` to read from **stdin**                                                     |
| `--expr`      | `-e`  | `<expr>`     | Inline DataWeave expression to evaluate                                                             |
| `--script`    | `-s`  | `<file>`     | DataWeave script file (`.dwl`) to run                                                               |
| `--in`        |       | `<format>`   | Input format: `json` \| `csv` \| `xml` \| `yaml`. Auto-detected from file extension if omitted      |
| `--out`       | `-o`  | `<format>`   | Output format: `json` \| `csv` \| `xml` \| `yaml`. Default: `json`                                  |
| `--indent`    |       | `<n>`        | Indentation width for JSON/XML output. Default: `2`                                                 |
| `--delimiter` |       | `<char>`     | CSV column delimiter character. Default: `,`                                                        |
| `--no-pretty` |       |              | Disable pretty-printing (produces compact JSON)                                                     |
| `--var`       |       | `<key=val>`  | Inject a runtime variable (repeatable). Value can be a JSON literal or a plain string               |
| `--props`     |       | `<file>`     | Load a properties file (`.properties`, `.json`, or `.yaml`) to populate the `p()` function          |
| `--target`    |       | `<idx:file>` | Route a specific multi-output block to a file (1-based index, repeatable). Requires `--allow-write` |
| `--help`      | `-h`  |              | Show the help message                                                                               |
| `--version`   | `-v`  |              | Show the version                                                                                    |

---

## Examples

### Filter from a file

```bash
deno task cli \
  --input data.json \
  --expr 'payload.users filter ((u) -> u.active)'
```

### Inline expression with piped stdin

```bash
echo '[{"name":"alice"},{"name":"bob"}]' | deno task cli \
  --expr 'payload map ((u) -> upper(u.name))'
```

### Run a `.dwl` script file

```bash
deno task cli --input data.json --script transform.dwl
```

### CSV → JSON

```bash
deno task cli \
  --input users.csv --out json \
  --expr 'payload map ((r) -> { name: upper(r.name) })'
```

### JSON → XML

```bash
deno task cli \
  --input data.json --out xml \
  --expr 'groupBy(payload, (r) -> r.category)'
```

### Injecting vars and a properties file

```bash
deno task cli \
  --input order.json \
  --script transform.dwl \
  --var 'region=south-america' \
  --var 'agentId=worker-07' \
  --props app.properties
```

Inside the script, access them with `vars.region`, `vars.agentId`, and
`p("store.id")`.

### Multi-output: routing blocks to separate files

When a `.dwl` script contains multiple `output` blocks, use `--target` to route
each block to its own file. The `<idx>` is 1-based.

```bash
deno task cli \
  --allow-write \
  --input data.json \
  --script report.dwl \
  --target 1:report.json \
  --target 2:report.csv
```

Any unmapped blocks are printed to `stdout`.

### Compact output (no indentation)

```bash
deno task cli --no-pretty --input data.json --expr 'payload'
```
