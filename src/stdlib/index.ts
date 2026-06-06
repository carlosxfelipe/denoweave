/**
 * Unified stdlib registry.
 *
 * Merges all function modules into a single flat record that the
 * evaluator injects into the global scope at runtime.
 *
 * Priority (right overwrites left): math → object → array → string
 * so more specific modules can override generic helpers.
 */
import type { Value } from '../evaluator/environment.ts';
import { STRING_FUNCTIONS } from './string.ts';
import { ARRAY_FUNCTIONS } from './array.ts';
import { OBJECT_FUNCTIONS } from './object.ts';
import { MATH_FUNCTIONS } from './math.ts';
import { SYSTEM_FUNCTIONS } from './system.ts';

export const STDLIB: Record<string, Value> = {
  ...MATH_FUNCTIONS,
  ...OBJECT_FUNCTIONS,
  ...ARRAY_FUNCTIONS,
  ...STRING_FUNCTIONS,
  ...SYSTEM_FUNCTIONS,
};

// Re-export individual modules for direct import
export { STRING_FUNCTIONS } from './string.ts';
export { ARRAY_FUNCTIONS } from './array.ts';
export { OBJECT_FUNCTIONS } from './object.ts';
export { MATH_FUNCTIONS } from './math.ts';
export { SYSTEM_FUNCTIONS } from './system.ts';
