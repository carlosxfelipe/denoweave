import { Parser } from '../parser/parser.ts';
import type * as AST from '../ast/nodes.ts';
import {
  type DWFunction,
  type DWObject,
  Environment,
  type Value,
} from './environment.ts';
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
          if (Array.isArray(idx)) {
            return idx.map((i) => (obj as Value[])[Number(i)] ?? null);
          }
          if (typeof idx !== 'number') {
            throw new RuntimeError(
              `Array index must be a number or array, got ${typeof idx}`,
            );
          }
          return (obj as Value[])[idx] ?? null;
        }

        if (typeof obj === 'string') {
          if (Array.isArray(idx)) {
            return idx.map((i) => obj[Number(i)] ?? '').join('');
          }
          if (typeof idx === 'number') {
            return obj[idx] ?? null;
          }
          throw new RuntimeError(`String index must be a number or array`);
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
          if (prop.type === 'Property') {
            let key: string;
            if (prop.key.type === 'Identifier') {
              key = prop.key.name;
            } else if (prop.key.type === 'Literal') {
              key = String(prop.key.value);
            } else {
              key = String(this.eval(prop.key, env));
            }
            this.addProperty(result, key, this.eval(prop.value, env));
          } else if (prop.type === 'DynamicExpansion') {
            const val = this.eval(prop.expression, env);
            if (Array.isArray(val)) {
              for (const item of val) {
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                  for (const [k, v] of Object.entries(item as DWObject)) {
                    this.addProperty(result, k, v);
                  }
                }
              }
            } else if (val && typeof val === 'object') {
              for (const [k, v] of Object.entries(val as DWObject)) {
                this.addProperty(result, k, v);
              }
            }
          }
        }
        return result;
      }

      case 'ArrayExpression':
        return node.elements.map((el) => this.eval(el, env));

      // Property is only reached through ObjectExpression above.
      // Reaching it directly is a parser bug; we guard anyway.
      case 'Property':
        throw new RuntimeError(
          'Property node should not be evaluated directly',
        );

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
            `Value is not callable (type: ${
              Array.isArray(callee) ? 'array' : typeof callee
            })`,
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
          throw new RuntimeError(
            `map: source must be an array, got ${typeof src}`,
          );
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
          throw new RuntimeError(
            `filter: source must be an array, got ${typeof src}`,
          );
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
          throw new RuntimeError(
            `reduce: source must be an array, got ${typeof src}`,
          );
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

      case 'InfixFunctionExpression': {
        const src = this.eval(node.source, env);
        const fnValue = env.get(node.name);
        if (typeof fnValue !== 'function') {
          throw new RuntimeError(`${node.name}: is not a function`);
        }

        let lambda: DWFunction;
        if (node.lambda.type === 'ArrowFunction') {
          lambda = this.eval(node.lambda, env) as DWFunction;
        } else {
          // Shorthand form: `payload groupBy $.category` — $ is the value,
          // $$ is the index (arrays) or key (objects).
          const lambdaNode = node.lambda;
          lambda = (...args: Value[]): Value => {
            const extended = env.extend({
              $: args[0] ?? null,
              $$: args[1] ?? null,
            });
            return this.eval(lambdaNode, extended);
          };
        }

        return (fnValue as DWFunction)(src, lambda);
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
          case 'not':
            return !operand;
          case '-':
            return -(operand as number);
          default:
            throw new RuntimeError(
              `Unknown unary operator: "${node.operator}"`,
            );
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // Control flow
      // ─────────────────────────────────────────────────────────────────────

      case 'IfExpression': {
        const cond = this.eval(node.condition, env);
        return cond
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
          throw new RuntimeError(
            `|>: right side must be a function, got ${typeof right}`,
          );
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

      // ───────────────────────────────────────────────────────────────────────
      // do block
      // ───────────────────────────────────────────────────────────────────────

      case 'DoExpression': {
        // Create a child scope for the block's local declarations
        const doEnv = env.extend({});
        for (const decl of node.declarations) {
          if (decl.type === 'VariableDeclaration') {
            const val = this.eval(decl.value, doEnv);
            doEnv.set(decl.name, val);
          } else if (decl.type === 'FunctionDeclaration') {
            const fn: DWFunction = (...args: Value[]): Value => {
              const bindings: Record<string, Value> = {};
              decl.params.forEach((p, i) => {
                bindings[p.name] = args[i] ?? null;
              });
              return this.eval(decl.body, doEnv.extend(bindings));
            };
            doEnv.set(decl.name, fn);
          }
        }
        return this.eval(node.body, doEnv);
      }

      // ───────────────────────────────────────────────────────────────────────
      // match / case
      // ───────────────────────────────────────────────────────────────────────

      case 'MatchExpression': {
        const subject = this.eval(node.subject, env);

        for (const arm of node.cases) {
          let matched = false;
          // For capture patterns, the binding is always available in guard + body
          const captureBindings: Record<string, Value> =
            arm.pattern.kind === 'capture'
              ? { $: subject, [arm.pattern.name]: subject }
              : { $: subject };

          if (arm.pattern.kind === 'literal') {
            const patternVal = this.eval(arm.pattern.value, env);
            matched = subject === patternVal;
          } else if (arm.pattern.kind === 'capture') {
            matched = true; // capture always matches; guard narrows
          } else if (arm.pattern.kind === 'type') {
            switch (arm.pattern.typeName) {
              case 'String':
                matched = typeof subject === 'string';
                break;
              case 'Number':
                matched = typeof subject === 'number';
                break;
              case 'Boolean':
                matched = typeof subject === 'boolean';
                break;
              case 'Array':
                matched = Array.isArray(subject);
                break;
              case 'Object':
                matched = subject !== null &&
                  typeof subject === 'object' &&
                  !Array.isArray(subject);
                break;
              case 'Null':
                matched = subject === null;
                break;
              default:
                matched = false;
            }
          }

          if (matched) {
            if (arm.guard) {
              const guardEnv = env.extend(captureBindings);
              if (!this.eval(arm.guard, guardEnv)) continue;
            }
            return this.eval(arm.body, env.extend(captureBindings));
          }
        }

        // No case matched — evaluate else body
        return this.eval(node.elseBody, env.extend({ $: subject }));
      }
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

  // ── Duplicate key helper ──────────────────────────────────────────────────

  /**
   * Adds a property to a DWObject. If the key already exists, groups the values
   * into an array to simulate DataWeave's duplicate key support.
   */
  private addProperty(obj: DWObject, key: string, value: Value): void {
    if (key in obj) {
      const existing = obj[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        obj[key] = [existing, value];
      }
    } else {
      obj[key] = value;
    }
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
      case '++':
        if (Array.isArray(left)) {
          return [...left, ...(Array.isArray(right) ? right : [right])];
        }
        if (left !== null && typeof left === 'object') {
          if (right !== null && typeof right === 'object') {
            return { ...(left as DWObject), ...(right as DWObject) };
          }
          throw new RuntimeError(
            `Cannot concatenate object with ${typeof right}`,
          );
        }
        return String(left) + String(right);
      case '-':
        return (left as number) - (right as number);
      case '*':
        return (left as number) * (right as number);
      case '/': {
        if ((right as number) === 0) throw new RuntimeError('Division by zero');
        return (left as number) / (right as number);
      }

      // Equality (uses ===)
      case '==':
        return left === right;
      case '!=':
        return left !== right;

      // Comparison
      case '<':
        return (left as number) < (right as number);
      case '<=':
        return (left as number) <= (right as number);
      case '>':
        return (left as number) > (right as number);
      case '>=':
        return (left as number) >= (right as number);

      // Range operator
      case 'to': {
        const start = Number(left);
        const end = Number(right);
        if (isNaN(start) || isNaN(end)) {
          throw new RuntimeError('"to" operator requires two numbers');
        }
        const step = start <= end ? 1 : -1;
        const result: number[] = [];
        if (start <= end) {
          for (let i = start; i <= end; i += step) result.push(i);
        } else {
          for (let i = start; i >= end; i += step) result.push(i);
        }
        return result;
      }

      // Logical (short-circuit NOT implemented at AST level, so both sides
      // are already evaluated — acceptable trade-off for Phase 3)
      case 'and':
        return Boolean(left) && Boolean(right);
      case 'or':
        return Boolean(left) || Boolean(right);

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
