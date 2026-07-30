import type { DWObject, Value } from '../evaluator/environment.ts';

/**
 * application/dw adapter — DataWeave notation serializer.
 *
 * `output application/dw` in MuleSoft outputs the DataWeave literal
 * representation of any value. This is the primary format used for
 * debugging and introspection in DataWeave scripts.
 *
 * Parser: DataWeave notation is a superset of JSON, so we accept
 * JSON as DW input (i.e., parse as JSON).
 *
 * Serializer: Produces idiomatic DataWeave notation:
 *   - Object keys are unquoted if they are valid identifiers
 *   - Strings use double quotes
 *   - null, true, false, numbers are bare literals
 *   - Arrays and Objects are indented
 *   - Temporal literals are wrapped in pipes: |2024-01-01|
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Return true if the key can appear unquoted in DataWeave. */
function isValidIdent(key: string): boolean {
  return IDENT_RE.test(key);
}

function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse DataWeave notation input.
 * DW notation for data (not scripts) is structurally equivalent to JSON,
 * so we delegate to JSON.parse after stripping DW-specific quirks.
 */
export function parseDW(input: string): Value {
  // Attempt JSON parse first (covers most DW literal formats)
  try {
    return JSON.parse(input) as Value;
  } catch {
    // If JSON fails, try to parse as a DW object with unquoted keys
    // by normalising it to JSON first
    const normalised = dwToJson(input.trim());
    return JSON.parse(normalised) as Value;
  }
}

/**
 * Lightweight DW-object-to-JSON normaliser.
 * Handles unquoted identifier keys: `{name: "Alice"}` → `{"name": "Alice"}`
 */
function dwToJson(input: string): string {
  // Quote unquoted object keys (identifiers followed by colon)
  return input.replace(
    /([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)(\s*:)/g,
    '$1"$2"$3',
  );
}

// ── Serializer ────────────────────────────────────────────────────────────────

/** Serialize a Value to DataWeave notation. */
export function toDW(value: Value, indent: number = 2): string {
  return serialise(value, 0, indent);
}

function serialise(value: Value, depth: number, indent: number): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);

  if (typeof value === 'string') {
    // DataWeave temporal literals (ISO dates / periods) use pipe notation
    if (isTemporalString(value)) return `|${value}|`;
    return `"${escapeString(value)}"`;
  }

  const pad = ' '.repeat(depth * indent);
  const childPad = ' '.repeat((depth + 1) * indent);

  if (Array.isArray(value)) {
    if ((value as Value[]).length === 0) return '[]';
    const items = (value as Value[])
      .map((item) => `${childPad}${serialise(item, depth + 1, indent)}`)
      .join(',\n');
    return `[\n${items}\n${pad}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as DWObject);
    if (entries.length === 0) return '{}';
    const fields = entries
      .map(([k, v]) => {
        const key = isValidIdent(k) ? k : `"${escapeString(k)}"`;
        return `${childPad}${key}: ${serialise(v, depth + 1, indent)}`;
      })
      .join(',\n');
    return `{\n${fields}\n${pad}}`;
  }

  return String(value);
}

/**
 * Heuristic: detect ISO 8601 date/time/period strings so they can be
 * rendered as DataWeave temporal literals (|...|).
 */
function isTemporalString(s: string): boolean {
  // ISO 8601 date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  // ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS...
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return true;
  // ISO 8601 period: P[n]Y[n]M[n]DT...
  if (
    /^P(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/.test(s) &&
    s.length > 1
  ) return true;
  return false;
}
