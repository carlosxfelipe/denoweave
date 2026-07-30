import type { DWObject, Value } from '../evaluator/environment.ts';

/**
 * multipart/form-data adapter — pure TypeScript, no dependencies.
 *
 * The parsed Value mirrors the MuleSoft DataWeave MultiPart type:
 * {
 *   parts: {
 *     <partName>: {
 *       headers: { <header-name>: <header-value>, ... },
 *       content: <string>
 *     },
 *     ...
 *   }
 * }
 *
 * If a part has no "name" in Content-Disposition, the index is used as key.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MultipartPart {
  headers: Record<string, string>;
  content: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalise line-endings to \n. */
function normalise(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/** Extract boundary from first line (e.g. "--myboundary"). */
function detectBoundary(body: string): string {
  const firstLine = body.split('\n')[0].trim();
  if (firstLine.startsWith('--')) return firstLine.slice(2);
  throw new Error(
    'multipart/form-data: cannot detect boundary. ' +
      'First line must start with "--<boundary>".',
  );
}

/** Parse the headers block of a single part. */
function parsePartHeaders(headerBlock: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of headerBlock.split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers[name] = value;
  }
  return headers;
}

/** Extract "name" parameter from a Content-Disposition header value. */
function extractName(headerValue: string, fallback: string): string {
  const m = headerValue.match(/\bname="([^"]+)"/);
  if (m) return m[1];
  const m2 = headerValue.match(/\bname=([^\s;]+)/);
  if (m2) return m2[1];
  return fallback;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/** Parse a multipart/form-data body string into a structured Value. */
export function parseMultipart(input: string, boundary?: string): Value {
  const body = normalise(input);
  const bnd = boundary ?? detectBoundary(body);
  const delimiter = '--' + bnd;

  const parts: Record<string, Value> = {};
  let partIndex = 0;

  // Split body on delimiter boundaries
  const segments = body.split(delimiter);

  for (const segment of segments) {
    const trimmed = segment.trimStart();
    // Skip preamble and final boundary
    if (trimmed === '' || trimmed.startsWith('--') || trimmed === '\n') {
      continue;
    }

    // Remove leading newline after boundary
    const content = trimmed.startsWith('\n') ? trimmed.slice(1) : trimmed;

    // Split headers from body at the first blank line
    const blankLine = content.indexOf('\n\n');
    if (blankLine === -1) continue;

    const headerBlock = content.slice(0, blankLine);
    let partBody = content.slice(blankLine + 2);

    // Trim trailing newline from part body
    if (partBody.endsWith('\n')) {
      partBody = partBody.slice(0, -1);
    }

    const headers = parsePartHeaders(headerBlock);
    const disposition = headers['content-disposition'] ?? '';
    const name = extractName(disposition, String(partIndex));

    const part: DWObject = {
      headers: headers as unknown as Value,
      content: partBody,
    };

    parts[name] = part;
    partIndex++;
  }

  return { parts } as Value;
}

// ── Serializer ────────────────────────────────────────────────────────────────

/** Generate a random alphanumeric boundary string. */
function randomBoundary(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let b = '';
  for (let i = 0; i < 28; i++) {
    b += chars[Math.floor(Math.random() * chars.length)];
  }
  return b;
}

/**
 * Serialize a Value to a multipart/form-data body string.
 *
 * Accepts:
 *  - An Object with a "parts" key (DataWeave MultiPart shape)
 *  - A plain Object whose entries become individual parts
 *  - An Array whose elements become individual parts
 *
 * Returns { body, boundary } so the caller can set the Content-Type header.
 */
export function toMultipart(
  value: Value,
  boundary?: string,
): { body: string; boundary: string } {
  const bnd = boundary ?? randomBoundary();
  const delimiter = '--' + bnd;
  const lines: string[] = [];

  function writePart(
    name: string,
    content: Value,
    extraHeaders?: Record<string, string>,
  ): void {
    lines.push(delimiter);
    lines.push(`Content-Disposition: form-data; name="${name}"`);
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        if (k.toLowerCase() !== 'content-disposition') {
          lines.push(`${k}: ${v}`);
        }
      }
    }
    lines.push('');
    lines.push(
      typeof content === 'string' ? content : JSON.stringify(content, null, 2),
    );
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as DWObject;

    if ('parts' in obj && obj['parts'] && typeof obj['parts'] === 'object') {
      // DataWeave MultiPart shape
      const partsObj = obj['parts'] as DWObject;
      for (const [partName, partVal] of Object.entries(partsObj)) {
        const part = partVal as DWObject;
        const headers = (part['headers'] as Record<string, string>) ?? {};
        const content = (part['content'] ?? '') as Value;
        writePart(partName, content, headers);
      }
    } else {
      // Plain object
      for (const [key, val] of Object.entries(obj)) {
        writePart(key, val);
      }
    }
  } else if (Array.isArray(value)) {
    let i = 0;
    for (const item of value as Value[]) {
      writePart(String(i++), item);
    }
  } else {
    writePart('value', value);
  }

  lines.push(delimiter + '--');
  return { body: lines.join('\r\n'), boundary: bnd };
}
