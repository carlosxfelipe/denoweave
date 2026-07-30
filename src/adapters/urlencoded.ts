import type { DWObject, Value } from '../evaluator/environment.ts';

/**
 * application/x-www-form-urlencoded adapter.
 * Uses the native URLSearchParams Web API (available in Deno and modern browsers).
 * Keys that appear multiple times are collapsed into an Array.
 */

/** Parse a URL-encoded string into a DWObject. */
export function parseURLEncoded(input: string): Value {
  const params = new URLSearchParams(input);
  const obj: DWObject = {};

  for (const key of params.keys()) {
    const values = params.getAll(key);
    obj[key] = values.length === 1 ? values[0] : values;
  }

  return obj;
}

/** Serialize a Value (Object or Array) to URL-encoded form. */
export function toURLEncoded(value: Value): string {
  if (value === null || value === undefined) return '';

  const params = new URLSearchParams();

  if (typeof value === 'object' && !Array.isArray(value)) {
    // Object: each key becomes a field
    for (const [key, val] of Object.entries(value as DWObject)) {
      if (Array.isArray(val)) {
        for (const item of val as Value[]) {
          params.append(key, item === null ? '' : String(item));
        }
      } else {
        params.append(key, val === null ? '' : String(val));
      }
    }
  } else if (Array.isArray(value)) {
    // Array of [key, value] pairs
    for (const item of value as Value[]) {
      if (
        item && typeof item === 'object' && !Array.isArray(item)
      ) {
        const obj = item as DWObject;
        const keys = Object.keys(obj);
        if (keys.length >= 2) {
          params.append(String(obj[keys[0]] ?? ''), String(obj[keys[1]] ?? ''));
        } else if (keys.length === 1) {
          params.append(keys[0], String(obj[keys[0]] ?? ''));
        }
      }
    }
  } else {
    // Scalar
    params.append('value', String(value));
  }

  return params.toString();
}
