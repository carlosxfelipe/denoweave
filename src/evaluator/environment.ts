/**
 * Runtime value types and lexical Environment (scope chain).
 *
 * The environment forms a linked list of scopes: each ArrowFunction
 * call creates a child scope that extends the caller's scope.
 */

import type { TemporalValue } from './temporal.ts';

// ── Levenshtein distance for error suggestions ───────────────────────────────

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used to generate "Did you mean: X?" suggestions in ReferenceErrors.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from(
    { length: m + 1 },
    (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Maximum edit distance to consider a name as a suggestion. */
const MAX_SUGGESTION_DISTANCE = 3;

// ── Value types ──────────────────────────────────────────────────────────────

/** A first-class function in the DSL runtime. */
export type DWFunction = (...args: Value[]) => Value;

/** A plain JS object used to represent DSL object literals. */
export type DWObject = { [key: string]: Value };

/**
 * The complete set of values the runtime can produce or consume.
 *
 * Mirrors JSON-like data model plus native functions (used by stdlib)
 * and Temporal objects for date/time arithmetic.
 */
export type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | TemporalValue
  | Value[]
  | DWObject
  | DWFunction;

// ── Environment ──────────────────────────────────────────────────────────────

/** Sentinel value returned by `lookupWithSentinel` when a name is not found. */
const NOT_FOUND: unique symbol = Symbol('NOT_FOUND');

/**
 * Lexical scope.
 *
 * Lookup walks the parent chain, so inner scopes shadow outer ones.
 * The global scope is the root (parent === null) and holds all stdlib
 * functions plus the user-supplied context (payload, vars, etc.).
 */
export class Environment {
  private readonly store: Map<string, Value>;
  private readonly parent: Environment | null;

  constructor(
    parent: Environment | null = null,
    bindings: Record<string, Value> = {},
  ) {
    this.parent = parent;
    this.store = new Map(Object.entries(bindings));
  }

  /**
   * Look up `name` in this scope or any ancestor scope.
   * Throws ReferenceError with a "Did you mean" hint if not found.
   */
  get(name: string): Value {
    const result = this.lookupWithSentinel(name);
    if (result !== NOT_FOUND) return result as Value;
    // Build suggestion from all names visible in the full scope chain
    const allNames = this.allVisibleNames();
    let best: string | null = null;
    let bestDist = MAX_SUGGESTION_DISTANCE + 1;
    for (const candidate of allNames) {
      const d = levenshtein(name, candidate);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    const hint = best !== null && bestDist <= MAX_SUGGESTION_DISTANCE
      ? ` Did you mean: "${best}"?`
      : '';
    throw new ReferenceError(`Undefined variable: "${name}".${hint}`);
  }

  /** Internal non-throwing lookup — returns NOT_FOUND sentinel when not found. */
  private lookupWithSentinel(name: string): Value | typeof NOT_FOUND {
    if (this.store.has(name)) return this.store.get(name)!;
    if (this.parent !== null) return this.parent.lookupWithSentinel(name);
    return NOT_FOUND;
  }

  /** Bind `name` to `value` in THIS scope (not ancestors). */
  set(name: string, value: Value): void {
    this.store.set(name, value);
  }

  /** Gets all local bindings in this scope (used for module exports). */
  exportStore(): Record<string, Value> {
    const exports: Record<string, Value> = {};
    for (const [k, v] of this.store.entries()) {
      exports[k] = v;
    }
    return exports;
  }

  /**
   * Collect all variable names visible from this scope upward.
   * Used for generating error suggestions in child scopes.
   */
  allVisibleNames(): string[] {
    const names = new Set<string>(this.store.keys());
    let env: Environment | null = this.parent;
    while (env !== null) {
      for (const k of env.store.keys()) names.add(k);
      env = env.parent;
    }
    return Array.from(names);
  }

  /**
   * Create a child scope that inherits from this one and has the
   * given extra bindings (used when calling arrow functions).
   */
  extend(bindings: Record<string, Value>): Environment {
    return new Environment(this, bindings);
  }
}
