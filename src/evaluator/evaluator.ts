import { Parser } from '../parser/parser.ts';
import type * as AST from '../ast/nodes.ts';
import { Environment, type DWFunction, type DWObject, type Value } from './environment.ts';
import { STDLIB } from '../stdlib/index.ts';

// ── Runtime error ─────────────────────────────────────────────────────────────

export class RuntimeError extends Error {
  constructor(message: string) {
    super(`RuntimeError: ${message}`);
    this.name = 'RuntimeError';
  }
}


// ── Core evaluator (tree-walker) ──────────────────────────────────────────────

class Evaluator {
  /**
   * Recursively evaluate an AST Expression node in the given environment.
   * Returns the runtime Value it produces.
   */
  eval(node: AST.Expression, env: Environment): Value {
    switch (node.type) {

      // ─────────────────────────────────────────────────────────────────────
      // Leaves
      // ─────────────────────────────────────────────────────────────────────

      case 'Literal':
        return node.value;

      case 'Identifier':
        return env.get(node.name);

      // ─────────────────────────────────────────────────────────────────────
      // Access
      // ─────────────────────────────────────────────────────────────────────

      case 'MemberExpression': {
        const obj = this.eval(node.object, env);
        return this.getProperty(obj, node.property.name);
      }

      case 'IndexExpression': {
        const obj = this.eval(node.object, env);
        const idx = this.eval(node.index, env);

        if (Array.isArray(obj)) {
          if (typeof idx !== 'number') {
            throw new RuntimeError(`Array index must be a number, got ${typeof idx}`);
          }
          return (obj as Value[])[idx] ?? null;
        }

        if (obj && typeof obj === 'object') {
          const key = String(idx);
          return (obj as DWObject)[key] ?? null;
        }

        throw new RuntimeError(`Cannot index into ${typeof obj}`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // Collection literals
      // ─────────────────────────────────────────────────────────────────────

      case 'ObjectExpression': {
        const result: DWObject = {};
        for (const prop of node.properties) {
          const key = prop.key.type === 'Identifier'
            ? prop.key.name
            : String(prop.key.value);
          result[key] = this.eval(prop.value, env);
        }
        return result;
      }

      case 'ArrayExpression':
        return node.elements.map((el) => this.eval(el, env));

      // Property is only reached through ObjectExpression above.
      // Reaching it directly is a parser bug; we guard anyway.
      case 'Property':
        throw new RuntimeError('Property node should not be evaluated directly');

      // ─────────────────────────────────────────────────────────────────────
      // Functions & calls
      // ─────────────────────────────────────────────────────────────────────

      case 'ArrowFunction': {
        // Capture current scope so the closure sees its definition context
        const capturedEnv = env;
        const { params, body } = node;

        const fn: DWFunction = (...args: Value[]): Value => {
          const bindings: Record<string, Value> = {};
          params.forEach((p, i) => {
            let val = args[i];
            if ((val === undefined || val === null) && p.defaultValue) {
              val = this.eval(p.defaultValue, capturedEnv);
            }
            bindings[p.name] = val ?? null;
          });
          return this.eval(body, capturedEnv.extend(bindings));
        };

        return fn;
      }

      case 'CallExpression': {
        const callee = this.eval(node.callee, env);
        if (typeof callee !== 'function') {
          throw new RuntimeError(
            `Value is not callable (type: ${Array.isArray(callee) ? 'array' : typeof callee})`,
          );
        }
        const args = node.arguments.map((arg) => this.eval(arg, env));
        return (callee as DWFunction)(...args);
      }

      // ─────────────────────────────────────────────────────────────────────
      // DSL higher-order operators
      // ─────────────────────────────────────────────────────────────────────

      case 'MapExpression': {
        const src = this.eval(node.source, env);
        if (!Array.isArray(src)) {
          throw new RuntimeError(`map: source must be an array, got ${typeof src}`);
        }
        const arr = src as Value[];
        if (node.lambda.type === 'ArrowFunction') {
          const fn = this.eval(node.lambda, env) as DWFunction;
          return arr.map((item, idx) => fn(item, idx));
        } else {
          return arr.map((item, idx) => {
            const extended = env.extend({ $: item, $$: idx });
            return this.eval(node.lambda, extended);
          });
        }
      }

      case 'FilterExpression': {
        const src = this.eval(node.source, env);
        if (!Array.isArray(src)) {
          throw new RuntimeError(`filter: source must be an array, got ${typeof src}`);
        }
        const arr = src as Value[];
        if (node.lambda.type === 'ArrowFunction') {
          const fn = this.eval(node.lambda, env) as DWFunction;
          return arr.filter((item, idx) => Boolean(fn(item, idx)));
        } else {
          return arr.filter((item, idx) => {
            const extended = env.extend({ $: item, $$: idx });
            return Boolean(this.eval(node.lambda, extended));
          });
        }
      }

      case 'ReduceExpression': {
        const src = this.eval(node.source, env);
        if (!Array.isArray(src)) {
          throw new RuntimeError(`reduce: source must be an array, got ${typeof src}`);
        }
        const arr = src as Value[];
        if (arr.length === 0) return null;
        if (node.lambda.type === 'ArrowFunction') {
          const secondParam = (node.lambda as AST.ArrowFunction).params[1];
          const hasInitVal = secondParam && secondParam.defaultValue;
          const fn = this.eval(node.lambda, env) as DWFunction;

          if (hasInitVal) {
            const initVal = this.eval(secondParam.defaultValue!, env);
            return arr.reduce((acc, item) => fn(item, acc), initVal);
          } else {
            return arr.slice(1).reduce((acc, item) => fn(item, acc), arr[0]);
          }
        } else {
          return arr.slice(1).reduce((acc, item) => {
            const extended = env.extend({ $: acc, $$: item });
            return this.eval(node.lambda, extended);
          }, arr[0]);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Operators
      // ─────────────────────────────────────────────────────────────────────

      case 'BinaryExpression': {
        const left = this.eval(node.left, env);
        const right = this.eval(node.right, env);
        return this.applyBinaryOp(node.operator, left, right);
      }

      case 'UnaryExpression': {
        const operand = this.eval(node.operand, env);
        switch (node.operator) {
          case 'not': return !operand;
          case '-':   return -(operand as number);
          default: throw new RuntimeError(`Unknown unary operator: "${node.operator}"`);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Control flow
      // ─────────────────────────────────────────────────────────────────────

      case 'IfExpression': {
        const cond = this.eval(node.condition, env);
        return Boolean(cond)
          ? this.eval(node.consequent, env)
          : this.eval(node.alternate, env);
      }

      // ─────────────────────────────────────────────────────────────────────
      // Composition
      // ─────────────────────────────────────────────────────────────────────

      case 'PipeExpression': {
        const left = this.eval(node.left, env);
        const right = this.eval(node.right, env);
        if (typeof right !== 'function') {
          throw new RuntimeError(`|>: right side must be a function, got ${typeof right}`);
        }
        return (right as DWFunction)(left);
      }

      case 'DefaultExpression': {
        try {
          const val = this.eval(node.expression, env);
          if (val === null || val === undefined) {
            return this.eval(node.alternate, env);
          }
          return val;
        } catch {
          return this.eval(node.alternate, env);
        }
      }

      case 'AsExpression': {
        const val = this.eval(node.expression, env);
        const target = node.targetType;
        if (target === 'String') {
          if (node.properties) {
            const props = this.eval(node.properties, env) as DWObject;
            if (val instanceof Date) {
              const fmt = String(props['format'] ?? 'yyyy-MM-dd HH:mm:ss');
              return this.formatDate(val, fmt);
            }
          }
          if (val === null || val === undefined) return '';
          if (val instanceof Date) return val.toISOString();
          if (typeof val === 'object') return JSON.stringify(val);
          return String(val);
        }
        if (target === 'Number') {
          const num = Number(val);
          return isNaN(num) ? 0 : num;
        }
        if (target === 'Boolean') {
          return Boolean(val);
        }
        return val;
      }

      case 'AnonymousArgExpression':
        return env.get(node.name);
    }
  }

  // ── Property access helpers ───────────────────────────────────────────────

  /**
   * Access a named property on a runtime value.
   *
   * DataWeave special rules:
   *  - Accessing `.length` on string/array returns the count.
   *  - Accessing `.propName` on an **array** plucks that property from
   *    each element (DataWeave selector behaviour).
   */
  private getProperty(obj: Value, name: string): Value {
    if (obj === null || obj === undefined) {
      throw new RuntimeError(`Cannot access property "${name}" of ${obj}`);
    }

    if (Array.isArray(obj)) {
      if (name === 'length') return (obj as Value[]).length;
      // Array selector: arr.name → arr.map(item => item.name)
      return (obj as Value[]).map((item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          return (item as DWObject)[name] ?? null;
        }
        return null;
      });
    }

    if (typeof obj === 'object') {
      return (obj as DWObject)[name] ?? null;
    }

    if (typeof obj === 'string' && name === 'length') return obj.length;

    return null;
  }

  // ── Binary operator dispatch ──────────────────────────────────────────────

  private applyBinaryOp(op: string, left: Value, right: Value): Value {
    switch (op) {
      // Arithmetic / string concatenation
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return (left as number) + (right as number);
      case '-': return (left as number) - (right as number);
      case '*': return (left as number) * (right as number);
      case '/': {
        if ((right as number) === 0) throw new RuntimeError('Division by zero');
        return (left as number) / (right as number);
      }

      // Equality (uses ===)
      case '==': return left === right;
      case '!=': return left !== right;

      // Comparison
      case '<':  return (left as number) < (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>':  return (left as number) > (right as number);
      case '>=': return (left as number) >= (right as number);

      // Logical (short-circuit NOT implemented at AST level, so both sides
      // are already evaluated — acceptable trade-off for Phase 3)
      case 'and': return Boolean(left) && Boolean(right);
      case 'or':  return Boolean(left) || Boolean(right);

      default:
        throw new RuntimeError(`Unknown binary operator: "${op}"`);
    }
  }

  private formatDate(date: Date, fmt: string): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());

    return fmt
      .replace('yyyy', String(yyyy))
      .replace('MM', MM)
      .replace('dd', dd)
      .replace('HH', HH)
      .replace('mm', mm)
      .replace('ss', ss);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluate a DataWeave-inspired DSL expression against a data context.
 *
 * @param source  DSL source code string **or** a pre-parsed `AST.Program`
 * @param context Key-value map injected into the global scope.
 *                Use `{ payload: ... }` to match DataWeave convention.
 * @returns The computed runtime `Value`
 *
 * @example
 * ```ts
 * import { evaluate } from './evaluator.ts';
 *
 * const result = evaluate(
 *   `payload.users map ((u) -> u.name)`,
 *   { payload: { users: [{ name: 'Alice' }, { name: 'Bob' }] } }
 * );
 * // → ['Alice', 'Bob']
 * ```
 */
export function evaluate(
  source: string | AST.Program,
  context: Record<string, Value> = {},
): Value {
  const ast: AST.Program = typeof source === 'string'
    ? Parser.fromSource(source).parse()
    : source;

  const globalEnv = new Environment(null, { ...STDLIB, ...context });
  const evaluator = new Evaluator();

  if (ast.declarations) {
    for (const decl of ast.declarations) {
      if (decl.type === 'VariableDeclaration') {
        const val = evaluator.eval(decl.value, globalEnv);
        globalEnv.set(decl.name, val);
      } else if (decl.type === 'FunctionDeclaration') {
        const fn: DWFunction = (...args: Value[]): Value => {
          const bindings: Record<string, Value> = {};
          decl.params.forEach((p, i) => {
            bindings[p.name] = args[i] ?? null;
          });
          return evaluator.eval(decl.body, globalEnv.extend(bindings));
        };
        globalEnv.set(decl.name, fn);
      }
    }
  }

  return evaluator.eval(ast.body, globalEnv);
}
