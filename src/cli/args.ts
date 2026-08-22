/**
 * CLI argument parser for the DenoWeave engine.
 * Zero-dependency, hand-rolled — no external arg parsing libs needed.
 */

export interface CliArgs {
  /** Input file path (or '-' for stdin) */
  input: string | null;
  /** Inline DSL expression (alternative to --script) */
  expr: string | null;
  /** DSL script file path */
  script: string | null;
  /** Input format: json | csv | xml | yaml (auto-detected from extension if omitted) */
  inFormat: string | null;
  /** Output format: json | csv | xml | yaml (default: json) */
  outFormat: string;
  /** Indentation for JSON/XML output */
  indent: number;
  /** CSV delimiter */
  delimiter: string;
  /** Show help */
  help: boolean;
  /** Show version */
  version: boolean;
  /** Pretty-print output (default: true) */
  pretty: boolean;
  /**
   * Runtime `vars` injected as `vars.key` in the script.
   * Each entry is a raw `key=value` or `key=jsonValue` string.
   */
  vars: string[];
  /** Path to a properties file (.properties, .json, or .yaml) for `p()` */
  props: string | null;
  /** Output targets to route specific blocks to files (e.g. `1:report.json`) */
  targets: string[];
}

export const HELP_TEXT = `
DenoWeave — CLI

USAGE:
  deno run --allow-read src/cli/main.ts [OPTIONS]

OPTIONS:
  -i, --input   <file>      Input data file (use - for stdin)
  -e, --expr    <expr>      Inline DSL expression to evaluate
  -s, --script  <file>      DSL script file to run
      --in      <format>    Input format: json | csv | xml | yaml
                            (auto-detected from file extension if omitted)
  -o, --out     <format>    Output format: json | csv | xml | yaml  [default: json]
      --indent  <n>         Indentation width for JSON/XML output   [default: 2]
      --delimiter <char>    CSV column delimiter                    [default: ,]
      --no-pretty           Disable pretty-printing (compact JSON)
      --var     <key=val>   Inject a vars entry (repeatable). Value can be a
                            JSON literal or a plain string.
                            Example: --var "userId=42" --var 'tags=["a","b"]'
      --props   <file>      Load a properties file (.properties, .json, .yaml)
                            Provides values for the p("key") function.
      --target  <idx:file>  Write the output block at <idx> (1-based) to <file>
                            Requires --allow-write permission. (repeatable)
  -h, --help                Show this help message
  -v, --version             Show version

EXAMPLES:
  # Filter active users from a JSON file
  deno run --allow-read src/cli/main.ts \\
    --input data.json \\
    --expr 'payload.users filter ((u) -> u.active)'

  # Transform CSV to JSON
  deno run --allow-read src/cli/main.ts \\
    --input users.csv --out json \\
    --expr 'payload map ((r) -> { name: upper(r.name), score: r.score })'

  # Read DSL from a script file
  deno run --allow-read src/cli/main.ts \\
    --input data.json --script transform.dw

  # Pipe from stdin
  cat data.json | deno run --allow-read src/cli/main.ts \\
    --expr 'payload map ((u) -> u.name)'

  # JSON → XML
  deno run --allow-read src/cli/main.ts \\
    --input data.json --out xml \\
    --expr 'groupBy(payload, (r) -> r.category)'

  # Script with vars and properties
  echo '{"id":1}' | deno run --allow-read src/cli/main.ts \\
    --script transform.dwl \\
    --var 'env=production' --var 'config={"timeout":30}' \\
    --props app.properties
`.trim();

export const VERSION = '0.1.0';

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: null,
    expr: null,
    script: null,
    inFormat: null,
    outFormat: 'json',
    indent: 2,
    delimiter: ',',
    help: false,
    version: false,
    pretty: true,
    vars: [],
    props: null,
    targets: [],
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '--no-pretty':
        args.pretty = false;
        break;
      case '-i':
      case '--input':
        args.input = argv[++i];
        break;
      case '-e':
      case '--expr':
        args.expr = argv[++i];
        break;
      case '-s':
      case '--script':
        args.script = argv[++i];
        break;
      case '--in':
        args.inFormat = argv[++i];
        break;
      case '-o':
      case '--out':
        args.outFormat = argv[++i];
        break;
      case '--indent':
        args.indent = parseInt(argv[++i], 10);
        break;
      case '--delimiter':
        args.delimiter = argv[++i];
        break;
      case '--var':
        args.vars.push(argv[++i]);
        break;
      case '--props':
        args.props = argv[++i];
        break;
      case '--target':
        args.targets.push(argv[++i]);
        break;
      default:
        // Positional: treat as input file if not yet set
        if (!arg.startsWith('-') && args.input === null) args.input = arg;
    }
    i++;
  }

  return args;
}

/** Detect format from file extension. */
export function detectFormat(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'json';
    case 'csv':
      return 'csv';
    case 'xml':
      return 'xml';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return null;
  }
}
