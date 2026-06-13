/**
 * Runtime value types and lexical Environment (scope chain).
 *
 * The environment forms a linked list of scopes: each ArrowFunction
 * call creates a child scope that extends the caller's scope.
 */

// ── Value types ──────────────────────────────────────────────────────────────

/** A first-class function in the DSL runtime. */
export type DWFunction = (...args: Value[]) => Value;

/** A plain JS object used to represent DSL object literals. */
export type DWObject = { [key: string]: Value };

/**
 * The complete set of values the runtime can produce or consume.
 *
 * Mirrors JSON-like data model plus native functions (used by stdlib).
 */
export type Value =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | Value[]
  | DWObject
  | DWFunction;

// ── Environment ──────────────────────────────────────────────────────────────

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
   * Throws ReferenceError if not found anywhere.
   */
  get(name: string): Value {
    if (this.store.has(name)) return this.store.get(name)!;
    if (this.parent !== null) return this.parent.get(name);
    throw new ReferenceError(`Undefined variable: "${name}"`);
  }

  /** Bind `name` to `value` in THIS scope (not ancestors). */
  set(name: string, value: Value): void {
    this.store.set(name, value);
  }

  /**
   * Create a child scope that inherits from this one and has the
   * given extra bindings (used when calling arrow functions).
   */
  extend(bindings: Record<string, Value>): Environment {
    return new Environment(this, bindings);
  }
}
