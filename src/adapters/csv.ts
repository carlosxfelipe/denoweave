import type { DWObject, Value } from '../evaluator/environment.ts';

export interface CsvOptions {
  /** Column delimiter. Default: `,` */
  delimiter?: string;
  /** First row is the header row. Default: `true` */
  header?: boolean;
  /** Quote character. Default: `"` */
  quote?: string;
  /** Attempt numeric / boolean type coercion. Default: `true` */
  coerce?: boolean;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/** Parse a CSV string into an array of DWObjects (when header=true) or arrays. */
export function parseCSV(input: string, options: CsvOptions = {}): Value {
  const delimiter = options.delimiter ?? ',';
  const quoteChar = options.quote ?? '"';
  const useHeader = options.header !== false;
  const coerce = options.coerce !== false;

  const rows = parseRows(input, delimiter, quoteChar);
  if (rows.length === 0) return [];

  if (useHeader) {
    const headers = rows[0].map(String);
    return rows.slice(1).map((row): Value => {
      const obj: DWObject = {};
      headers.forEach((h, i) => {
        obj[h] = coerce ? coerceValue(row[i] ?? '') : (row[i] ?? '');
      });
      return obj;
    });
  }

  return rows.map((row): Value =>
    coerce ? row.map((v) => coerceValue(String(v))) : row.map(String)
  );
}

/** Serialize an array of objects (or arrays) to CSV. */
export function toCSV(data: Value, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ',';
  const quoteChar = options.quote ?? '"';
  const useHeader = options.header !== false;

  if (!Array.isArray(data) || (data as Value[]).length === 0) return '';

  const rows = data as Value[];

  // Detect if items are objects or primitives/arrays
  const firstRow = rows[0];
  if (firstRow && typeof firstRow === 'object' && !Array.isArray(firstRow)) {
    // Object rows
    const headers = Object.keys(firstRow as DWObject);
    const lines: string[] = [];
    if (useHeader) {
      lines.push(
        headers.map((h) => quoteField(h, delimiter, quoteChar)).join(delimiter),
      );
    }
    for (const row of rows) {
      const obj = row as DWObject;
      lines.push(
        headers.map((h) =>
          quoteField(String(obj[h] ?? ''), delimiter, quoteChar)
        ).join(delimiter),
      );
    }
    return lines.join('\n');
  } else {
    // Array rows
    return (rows as Value[][]).map((row) =>
      row.map((v) => quoteField(String(v ?? ''), delimiter, quoteChar)).join(
        delimiter,
      )
    ).join('\n');
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function parseRows(
  input: string,
  delimiter: string,
  quoteChar: string,
): string[][] {
  const rows: string[][] = [];
  const q = quoteChar;
  let row: string[] = [];
  let field = '';
  let inQuote = false;
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (inQuote) {
      if (ch === q && input[i + 1] === q) {
        // Escaped quote
        field += q;
        i += 2;
      } else if (ch === q) {
        inQuote = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === q) {
        inQuote = true;
        i++;
      } else if (input.startsWith(delimiter, i)) {
        row.push(field);
        field = '';
        i += delimiter.length;
      } else if (ch === '\r' && input[i + 1] === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i += 2;
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field / row
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function coerceValue(v: string): Value {
  if (v === '' || v.toLowerCase() === 'null') return null;
  if (v.toLowerCase() === 'true') return true;
  if (v.toLowerCase() === 'false') return false;
  const n = Number(v);
  if (!isNaN(n) && v.trim() !== '') return n;
  return v;
}

function quoteField(
  value: string,
  delimiter: string,
  quoteChar: string,
): string {
  if (
    value.includes(delimiter) || value.includes(quoteChar) ||
    value.includes('\n')
  ) {
    return quoteChar + value.replaceAll(quoteChar, quoteChar + quoteChar) +
      quoteChar;
  }
  return value;
}
