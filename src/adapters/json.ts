import type { Value } from '../evaluator/environment.ts';

/**
 * JSON adapter — thin wrapper around the built-in JSON API.
 * Included for symmetry with the other adapters.
 */

/** Parse a JSON string into a runtime Value. */
export function parseJSON(input: string): Value {
  return JSON.parse(input) as Value;
}

/** Serialize a runtime Value to a JSON string. */
export function toJSON(value: Value, indent: number = 2): string {
  return JSON.stringify(value, null, indent);
}
