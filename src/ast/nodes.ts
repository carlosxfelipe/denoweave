/**
 * AST Node type definitions for the DataWeave-inspired DSL.
 *
 * Every node is a discriminated union on the `type` field, allowing
 * exhaustive pattern-matching in the evaluator and any future visitor.
 */

// ── Node type tags ──────────────────────────────────────────────────────────

export type NodeType =
  | 'Program'
  | 'Identifier'
  | 'Literal'
  | 'MemberExpression'
  | 'IndexExpression'
  | 'CallExpression'
  | 'ObjectExpression'
  | 'Property'
  | 'ArrayExpression'
  | 'ArrowFunction'
  | 'MapExpression'
  | 'FilterExpression'
  | 'ReduceExpression'
  | 'InfixFunctionExpression'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'IfExpression'
  | 'PipeExpression'
  | 'VariableDeclaration'
  | 'FunctionDeclaration'
  | 'TypeDeclaration'
  | 'DefaultExpression'
  | 'AsExpression'
  | 'DoExpression'
  | 'MatchExpression'
  | 'AnonymousArgExpression'
  | 'DynamicExpansion';

// ── Shared base ─────────────────────────────────────────────────────────────

export interface BaseNode {
  type: NodeType;
  /** Source line (1-indexed), populated by the parser. */
  line?: number;
  /** Source column (1-indexed), populated by the parser. */
  column?: number;
}

// ── Leaf nodes ───────────────────────────────────────────────────────────────

/** A resolved name: `payload`, `u`, `name` */
export interface Identifier extends BaseNode {
  type: 'Identifier';
  name: string;
  defaultValue?: Expression;
}

/** A constant value: `42`, `"hello"`, `true`, `null` */
export interface Literal extends BaseNode {
  type: 'Literal';
  value: string | number | boolean | null;
  /** Original source representation, useful for error messages. */
  raw: string;
}

// ── Access expressions ───────────────────────────────────────────────────────

/** `object.property` */
export interface MemberExpression extends BaseNode {
  type: 'MemberExpression';
  object: Expression;
  property: Identifier;
}

/** `object[index]` — computed member access */
export interface IndexExpression extends BaseNode {
  type: 'IndexExpression';
  object: Expression;
  index: Expression;
}

// ── Call ────────────────────────────────────────────────────────────────────

/** `callee(arg1, arg2)` */
export interface CallExpression extends BaseNode {
  type: 'CallExpression';
  callee: Expression;
  arguments: Expression[];
}

// ── Collection literals ──────────────────────────────────────────────────────

/** `{ key: value, ... }` */
export interface ObjectExpression extends BaseNode {
  type: 'ObjectExpression';
  properties: (Property | DynamicExpansion)[];
}

/** A single key:value pair inside an ObjectExpression. */
export interface Property extends BaseNode {
  type: 'Property';
  key: Identifier | Literal | Expression;
  value: Expression;
  /** Shorthand: `{ name }` equivalent to `{ name: name }` */
  shorthand: boolean;
}

/** `{ (expr) }` — dynamic object property expansion */
export interface DynamicExpansion extends BaseNode {
  type: 'DynamicExpansion';
  expression: Expression;
}

/** `[elem1, elem2, ...]` */
export interface ArrayExpression extends BaseNode {
  type: 'ArrayExpression';
  elements: Expression[];
}

// ── Functions ────────────────────────────────────────────────────────────────

/** `(param1, param2) -> body` */
export interface ArrowFunction extends BaseNode {
  type: 'ArrowFunction';
  params: Identifier[];
  body: Expression;
}

// ── Higher-order DSL operators ───────────────────────────────────────────────

/** `source map lambda` */
export interface MapExpression extends BaseNode {
  type: 'MapExpression';
  source: Expression;
  lambda: Expression; // Can be ArrowFunction or a shorthand expression containing $
}

/** `source filter lambda` */
export interface FilterExpression extends BaseNode {
  type: 'FilterExpression';
  source: Expression;
  lambda: Expression; // Can be ArrowFunction or a shorthand expression containing $
}

/** `source reduce lambda` */
export interface ReduceExpression extends BaseNode {
  type: 'ReduceExpression';
  source: Expression;
  lambda: Expression; // Can be ArrowFunction or a shorthand expression containing $
}

/**
 * `source <fn> lambda` — generic infix application of a stdlib higher-order
 * function, DataWeave style: `payload groupBy $.category`,
 * `payload orderBy $.age`, `obj mapObject ((v, k) -> ...)`, etc.
 *
 * The function is resolved by name at runtime (stdlib or user-defined).
 */
export interface InfixFunctionExpression extends BaseNode {
  type: 'InfixFunctionExpression';
  name: string;
  source: Expression;
  lambda: Expression; // Can be ArrowFunction or a shorthand expression containing $ / $$
}

// ── Operators ────────────────────────────────────────────────────────────────

/**
 * `left op right`
 *
 * Operators: `+` `-` `*` `/` `==` `!=` `<` `<=` `>` `>=` `and` `or`
 */
export interface BinaryExpression extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
  left: Expression;
  right: Expression;
}

/** `not operand` | `-operand` */
export interface UnaryExpression extends BaseNode {
  type: 'UnaryExpression';
  operator: string;
  operand: Expression;
}

// ── Control flow ─────────────────────────────────────────────────────────────

/** `if (condition) consequent else alternate` */
export interface IfExpression extends BaseNode {
  type: 'IfExpression';
  condition: Expression;
  consequent: Expression;
  alternate: Expression;
}

// ── Composition ──────────────────────────────────────────────────────────────

/** `left |> right` — pipe the result of left into right */
export interface PipeExpression extends BaseNode {
  type: 'PipeExpression';
  left: Expression;
  right: Expression;
}

// ── DataWeave Specific Expressions ───────────────────────────────────────────

/** `expression default alternate` */
export interface DefaultExpression extends BaseNode {
  type: 'DefaultExpression';
  expression: Expression;
  alternate: Expression;
}

/** `expression as targetType { properties }` */
export interface AsExpression extends BaseNode {
  type: 'AsExpression';
  expression: Expression;
  targetType: string;
  properties?: ObjectExpression;
}

/** `$` or `$$` */
export interface AnonymousArgExpression extends BaseNode {
  type: 'AnonymousArgExpression';
  name: '$' | '$$';
}

// ── do block ────────────────────────────────────────────────────────────────

/**
 * `do { var x = expr --- body }` — local scope block.
 * Creates a child environment with its own declarations, then evaluates body.
 */
export interface DoExpression extends BaseNode {
  type: 'DoExpression';
  declarations: Declaration[];
  body: Expression;
}

// ── match / case ─────────────────────────────────────────────────────────────

/** Pattern inside a `case` clause */
export type MatchPattern =
  | { kind: 'literal'; value: Expression }
  | { kind: 'type'; typeName: string }
  | { kind: 'capture'; name: string } // `case q if q > 0` — binds the value to `q`
  | { kind: 'else' };

/** A single `case pattern (if guard)? -> body` arm */
export interface MatchCase {
  pattern: MatchPattern;
  /** Optional guard expression — evaluated with `$` bound to the subject */
  guard?: Expression;
  body: Expression;
}

/**
 * `subject match { case ... else -> expr }`
 *
 * DataWeave pattern matching. Cases are tested in order;
 * the first matching arm wins. An `else` arm is required.
 */
export interface MatchExpression extends BaseNode {
  type: 'MatchExpression';
  subject: Expression;
  cases: MatchCase[];
  /** Body for the `else` catch-all arm */
  elseBody: Expression;
}

// ── Header Declarations ──────────────────────────────────────────────────────

export interface VariableDeclaration extends BaseNode {
  type: 'VariableDeclaration';
  name: string;
  value: Expression;
}

export interface FunctionDeclaration extends BaseNode {
  type: 'FunctionDeclaration';
  name: string;
  params: Identifier[];
  body: Expression;
}

export interface TypeDeclaration extends BaseNode {
  type: 'TypeDeclaration';
  name: string;
  definition: string; // Stored raw representation of type for now
}

export type Declaration =
  | VariableDeclaration
  | FunctionDeclaration
  | TypeDeclaration;

// ── Root ─────────────────────────────────────────────────────────────────────

/** The root node returned by the parser. */
export interface Program extends BaseNode {
  type: 'Program';
  declarations: Declaration[];
  body: Expression;
}

// ── Union types ───────────────────────────────────────────────────────────────

export type Expression =
  | Identifier
  | Literal
  | MemberExpression
  | IndexExpression
  | CallExpression
  | ObjectExpression
  | Property
  | ArrayExpression
  | ArrowFunction
  | MapExpression
  | FilterExpression
  | ReduceExpression
  | InfixFunctionExpression
  | BinaryExpression
  | UnaryExpression
  | IfExpression
  | PipeExpression
  | DefaultExpression
  | AsExpression
  | AnonymousArgExpression
  | DoExpression
  | MatchExpression;

export type AnyNode =
  | Program
  | Expression
  | Declaration
  | Property
  | DynamicExpansion;
