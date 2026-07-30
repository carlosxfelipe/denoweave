import type { Value } from '../evaluator/environment.ts';

/**
 * Text / plain-text adapter.
 * Parses plain text as a raw string Value; serializes any Value back to a string.
 */

/** Parse a plain-text string — returned as-is. */
export function parseText(input: string): Value {
  return input;
}

/** Serialize any Value to a plain string. */
export function toText(value: Value): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
}
