import type { Value } from '../evaluator/environment.ts';

/**
 * NDJSON (Newline Delimited JSON) adapter.
 * Each line is an independent JSON value; the whole document is an Array of Values.
 * Spec: https://github.com/ndjson/ndjson-spec
 */

/** Parse an NDJSON string into an Array of Values. */
export function parseNDJSON(input: string): Value {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Value);
}

/** Serialize an Array of Values to NDJSON (one JSON value per line). */
export function toNDJSON(value: Value): string {
  if (!Array.isArray(value)) {
    // Wrap non-arrays in a single line
    return JSON.stringify(value);
  }
  return (value as Value[])
    .map((item) => JSON.stringify(item))
    .join('\n');
}
