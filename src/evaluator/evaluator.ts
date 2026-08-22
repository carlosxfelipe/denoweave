import { Parser } from '../parser/parser.ts';
import type * as AST from '../ast/nodes.ts';
import {
  type DWFunction,
  type DWObject,
  Environment,
  type Value,
} from './environment.ts';
import { STDLIB } from '../stdlib/index.ts';
import { temporal } from './temporal.ts';

// ── Runtime error ─────────────────────────────────────────────────────────────

export class RuntimeError extends Error {
  /** Source line (1-indexed) where the error originated, when known. */
  line?: number;
  /** Source column (1-indexed) where the error originated, when known. */
  column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(`RuntimeError: ${message}`);
    this.name = 'RuntimeError';
    if (line !== undefined) this.attachPosition(line, column);
  }

  /** Prefix the message with `[line:column]` once, keeping the position. */
  attachPosition(line: number, column?: number): void {
    if (this.line !== undefined) return;
    this.line = line;
    this.column = column;
    this.message = `[${line}:${column ?? '?'}] ${this.message}`;
  }
}

// ── Core evaluator (tree-walker) ──────────────────────────────────────────────

class Evaluator {
  /** Registered `type` declarations, e.g. `type PositiveNumber = Number { minimum: 0 }`. */
  private typeRegistry = new Map<
    string,
    { baseType: string; constraints?: DWObject }
  >();

  /** Register a declared type so `as` casts and param checks can enforce it. */
  registerType(name: string, baseType: string, constraints?: DWObject): void {
    this.typeRegistry.set(name, { baseType, constraints });
  }

  /**
   * Recursively evaluate an AST Expression node in the given environment.
   * Returns the runtime Value it produces.
   *
   * RuntimeErrors bubbling up without a source position are tagged with the
   * position of the innermost node that has one.
   */
  eval(node: AST.Expression, env: Environment): Value {
    try {
      return this.evalNode(node, env);
    } catch (e) {
      if (
        e instanceof RuntimeError &&
        e.line === undefined &&
        node.line !== undefined
      ) {
        e.attachPosition(node.line, node.column);
      }
      throw e;
    }
  }

  private evalNode(node: AST.Expression, env: Environment): Value {
    switch (node.type) {
      // ─────────────────────────────────────────────────────────────────────
      // Leaves
      // ─────────────────────────────────────────────────────────────────────

      case 'Literal':
        return node.value;

      case 'TemporalLiteral':
        if (node.temporalType === 'period') {
          return temporal.durationFrom(node.value);
        }
        // Simple ISO 8601 parsing logic
        if (node.value.includes('T')) {
          if (node.value.includes('Z') || node.value.match(/[+-]\d\d:\d\d$/)) {
            return temporal.instantFrom(node.value);
          }
          return temporal.plainDateTimeFrom(node.value);
        }
        return temporal.plainDateFrom(node.value);

      case 'Identifier':
        return env.get(node.name);

      // ─────────────────────────────────────────────────────────────────────
      // Access
      // ─────────────────────────────────────────────────────────────────────

      case 'MemberExpression': {
        const obj = this.eval(node.object, env);
        if (node.optional && (obj === null || obj === undefined)) {
          return null;
        }
        if (node.isDeep) {
          return this.getDeepProperty(obj, node.property.name);
        }
        return this.getProperty(obj, node.property.name);
      }

      case 'NonNullExpression': {
        const val = this.eval(node.argument, env);
        if (val === null || val === undefined) {
          throw new RuntimeError(`Value is null but asserted non-null (!)`);
        }
        return val;
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
        // Short-circuit: evaluate right side only when needed
        if (node.operator === 'and') {
          const left = this.eval(node.left, env);
          if (!left) return false;
          return Boolean(this.eval(node.right, env));
        }
        if (node.operator === 'or') {
          const left = this.eval(node.left, env);
          if (left) return true;
          return Boolean(this.eval(node.right, env));
        }
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
        const props = node.properties
          ? (this.eval(node.properties, env) as DWObject)
          : undefined;
        return this.castValue(val, node.targetType, props);
      }

      case 'KeyExistenceExpression': {
        const innerExpr = node.expression;
        // For MemberExpression: check the parent object has the key
        if (innerExpr.type === 'MemberExpression') {
          const parentObj = this.eval(innerExpr.object, env);
          if (parentObj === null || parentObj === undefined) return false;
          if (typeof parentObj === 'object' && !Array.isArray(parentObj)) {
            return Object.prototype.hasOwnProperty.call(
              parentObj,
              innerExpr.property.name,
            );
          }
          return false;
        }
        // For Identifier: check it's defined and non-null in the env
        if (innerExpr.type === 'Identifier') {
          try {
            const v = env.get(innerExpr.name);
            return v !== null && v !== undefined;
          } catch {
            return false;
          }
        }
        // Generic fallback: evaluate and check non-null
        try {
          const v = this.eval(innerExpr, env);
          return v !== null && v !== undefined;
        } catch {
          return false;
        }
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
                const val = args[i] ?? null;
                if (p.typeAnnotation) {
                  this.validateParamType(
                    val,
                    p.typeAnnotation,
                    p.name,
                    decl.name,
                  );
                }
                bindings[p.name] = val;
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

    if (typeof obj === 'string' && name === 'length') {
      return obj.length;
    }

    return null;
  }

  /**
   * Deep descendant selector (`..`).
   * Recursively traverses the object/array and collects all values matching the key.
   */
  private getDeepProperty(obj: Value, name: string): Value[] {
    const results: Value[] = [];

    const traverse = (current: Value) => {
      if (current === null || current === undefined) return;

      if (Array.isArray(current)) {
        for (const item of current) traverse(item);
        return;
      }

      if (typeof current === 'object') {
        const dict = current as DWObject;
        for (const [k, v] of Object.entries(dict)) {
          if (k === name) results.push(v);
          traverse(v);
        }
      }
    };

    traverse(obj);
    return results;
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
    const mathOps = ['+', '-', '*', '/', '<', '<=', '>', '>='];
    if (mathOps.includes(op) && (left === null || right === null)) {
      throw new RuntimeError(`Cannot perform ${op} on Null`);
    }

    switch (op) {
      // Arithmetic / string concatenation
      case '+': {
        // Temporal Math
        if (temporal.isAvailable()) {
          const isTempLeft = temporal.isTemporal(left);
          const isTempRight = temporal.isTemporal(right);

          if (isTempLeft && isTempRight) {
            if (temporal.isDuration(left)) {
              if (temporal.isDuration(right)) return left.add(right);
              return right.add(left); // Duration + Date -> Date + Duration
            }
            return left.add(right);
          }
        }

        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right);
        }
        return (left as number) + (right as number);
      }
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
      case '-': {
        // Temporal Math
        if (temporal.isAvailable()) {
          const isTempLeft = temporal.isTemporal(left);
          const isTempRight = temporal.isTemporal(right);

          if (isTempLeft && isTempRight) {
            return left.subtract(right);
          }
        }
        return (left as number) - (right as number);
      }
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

      // Logical (short-circuit handled in BinaryExpression before reaching here)
      case 'and':
        return Boolean(left) && Boolean(right);
      case 'or':
        return Boolean(left) || Boolean(right);

      default:
        throw new RuntimeError(`Unknown binary operator: "${op}"`);
    }
  }

  // ── Type casting & runtime validation ────────────────────────────────────

  /** Cast a value to a target type, enforcing declared type constraints. */
  private castValue(val: Value, target: string, props?: DWObject): Value {
    if (val === null || val === undefined) {
      throw new Error(`Cannot coerce Null to ${target}`);
    }
    if (this.typeRegistry.has(target)) {
      const { baseType, constraintsChain } = this.resolveType(target);
      const result = this.castValue(val, baseType, props);
      for (const constraints of constraintsChain) {
        this.validateConstraints(result, constraints, target);
      }
      return result;
    }
    if (target === 'String') {
      if (props && val instanceof Date) {
        const fmt = String(props['format'] ?? 'yyyy-MM-dd HH:mm:ss');
        return this.formatDate(val, fmt);
      }
      if (val instanceof Date) return val.toISOString();
      // Temporal objects with optional format
      if (temporal.isTemporal(val)) {
        if (props?.format) {
          return this.formatTemporalDate(val, String(props.format));
        }
        return val.toString();
      }
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }
    if (target === 'Number') {
      const num = Number(val);
      if (isNaN(num)) {
        throw new Error(`Cannot coerce ${typeof val} to Number`);
      }
      return num;
    }
    if (target === 'Boolean') {
      return Boolean(val);
    }
    // ── Temporal type coercions ─────────────────────────────────────────────
    if (temporal.isAvailable()) {
      const str = typeof val === 'string' ? val : String(val);
      try {
        switch (target) {
          case 'Date':
          case 'LocalDate': {
            // If a custom format is provided (e.g. "dd/MM/yyyy"), parse it first
            const isoStr = props?.format
              ? this.parseWithFormat(str, String(props.format))
              : str;
            return temporal.plainDateFrom(isoStr);
          }
          case 'DateTime':
          case 'LocalDateTime': {
            const isoStr = props?.format
              ? this.parseWithFormat(str, String(props.format))
              : str;
            if (!isoStr.includes('T')) {
              return temporal.plainDateTimeFrom(isoStr + 'T00:00:00');
            }
            if (isoStr.includes('Z') || isoStr.match(/[+-]\d\d:\d\d$/)) {
              return temporal.instantFrom(isoStr);
            }
            return temporal.plainDateTimeFrom(isoStr);
          }
          case 'LocalTime':
          case 'Time':
            return temporal.plainTimeFrom(str);
          case 'Period':
          case 'Duration':
            return temporal.durationFrom(str);
        }
      } catch {
        throw new RuntimeError(
          `Cannot coerce "${val}" to type ${target}: invalid format.`,
        );
      }
    }
    return val;
  }

  /**
   * Resolve a type name through the registry, following aliases to a base
   * type and collecting every constraint object along the chain.
   */
  private resolveType(
    name: string,
  ): { baseType: string; constraintsChain: DWObject[] } {
    const constraintsChain: DWObject[] = [];
    const seen = new Set<string>();
    let current = name;
    while (this.typeRegistry.has(current)) {
      if (seen.has(current)) {
        throw new RuntimeError(`Circular type definition: "${current}"`);
      }
      seen.add(current);
      const info = this.typeRegistry.get(current)!;
      if (info.constraints) constraintsChain.push(info.constraints);
      current = info.baseType;
    }
    return { baseType: current, constraintsChain };
  }

  /**
   * Validate a function argument against its declared param type.
   * Throws a RuntimeError when the value does not conform.
   */
  validateParamType(
    val: Value,
    typeName: string,
    paramName: string,
    fnName: string,
  ): void {
    const { baseType, constraintsChain } = this.resolveType(typeName);
    if (this.matchesBaseType(val, baseType) === false) {
      throw new RuntimeError(
        `${fnName}: parameter "${paramName}" expects ${typeName}, got ${
          this.describeType(val)
        }`,
      );
    }
    for (const constraints of constraintsChain) {
      this.validateConstraints(val, constraints, typeName);
    }
  }

  /**
   * Check a value against a built-in base type name.
   * Returns null for unknown type names (no check possible).
   */
  private matchesBaseType(val: Value, base: string): boolean | null {
    switch (base) {
      case 'String':
        return typeof val === 'string';
      case 'Number':
        return typeof val === 'number';
      case 'Boolean':
        return typeof val === 'boolean';
      case 'Array':
        return Array.isArray(val);
      case 'Object':
        return val !== null && typeof val === 'object' && !Array.isArray(val);
      case 'Null':
        return val === null;
      case 'Any':
        return true;
      default:
        return null;
    }
  }

  private describeType(val: Value): string {
    if (val === null || val === undefined) return 'Null';
    if (Array.isArray(val)) return 'Array';
    if (typeof val === 'string') return 'String';
    if (typeof val === 'number') return 'Number';
    if (typeof val === 'boolean') return 'Boolean';
    if (typeof val === 'function') return 'Function';
    return 'Object';
  }

  /** Enforce basic constraints: minimum/maximum, minLength/maxLength, pattern. */
  private validateConstraints(
    val: Value,
    constraints: DWObject,
    typeName: string,
  ): void {
    for (const [key, expected] of Object.entries(constraints)) {
      switch (key) {
        case 'minimum':
          if (typeof val === 'number' && val < Number(expected)) {
            throw new RuntimeError(
              `Type ${typeName}: value ${val} violates constraint minimum: ${expected}`,
            );
          }
          break;
        case 'maximum':
          if (typeof val === 'number' && val > Number(expected)) {
            throw new RuntimeError(
              `Type ${typeName}: value ${val} violates constraint maximum: ${expected}`,
            );
          }
          break;
        case 'minLength': {
          const len = typeof val === 'string' || Array.isArray(val)
            ? val.length
            : null;
          if (len !== null && len < Number(expected)) {
            throw new RuntimeError(
              `Type ${typeName}: length ${len} violates constraint minLength: ${expected}`,
            );
          }
          break;
        }
        case 'maxLength': {
          const len = typeof val === 'string' || Array.isArray(val)
            ? val.length
            : null;
          if (len !== null && len > Number(expected)) {
            throw new RuntimeError(
              `Type ${typeName}: length ${len} violates constraint maxLength: ${expected}`,
            );
          }
          break;
        }
        case 'pattern':
          if (
            typeof val === 'string' &&
            !new RegExp(String(expected)).test(val)
          ) {
            throw new RuntimeError(
              `Type ${typeName}: value "${val}" violates constraint pattern: ${expected}`,
            );
          }
          break;
        default:
          // Unknown constraint keys are ignored.
          break;
      }
    }
  }

  private formatDate(date: Date, fmt: string): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const pad3 = (n: number) => String(n).padStart(3, '0');
    const yyyy = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const HH = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const SSS = pad3(date.getMilliseconds());

    return fmt
      .replace('yyyy', String(yyyy))
      .replace('MM', MM)
      .replace('dd', dd)
      .replace('HH', HH)
      .replace('mm', mm)
      .replace('SSS', SSS)
      .replace('ss', ss);
  }

  /**
   * Format a Temporal PlainDate/PlainDateTime-like object to a string
   * using a DataWeave format pattern (e.g. "yyyy-MM-dd HH:mm:ss.SSS").
   */
  private formatTemporalDate(val: unknown, fmt: string): string {
    // Extract fields via toString() — Temporal always produces ISO 8601
    const iso = String(val);
    // ISO: yyyy-MM-ddTHH:mm:ss or yyyy-MM-dd
    const [datePart, timePart] = iso.split('T');
    const [yyyy, MM, dd] = (datePart ?? '').split('-');
    const [HH, mm, ssFull] = (timePart ?? '00:00:00').split(':');
    const [ss, msFull] = (ssFull ?? '00').split('.');
    const SSS = (msFull ?? '000').padStart(3, '0').slice(0, 3);

    return fmt
      .replace('yyyy', yyyy ?? '')
      .replace('MM', (MM ?? '').padStart(2, '0'))
      .replace('dd', (dd ?? '').padStart(2, '0'))
      .replace('HH', (HH ?? '00').padStart(2, '0'))
      .replace('mm', (mm ?? '00').padStart(2, '0'))
      .replace('SSS', SSS)
      .replace('ss', (ss ?? '00').padStart(2, '0'));
  }

  /**
   * Parse a date string using a DataWeave format pattern into an ISO 8601 string.
   * Supports patterns like "dd/MM/yyyy", "MM-dd-yyyy", "dd/MM/yyyy HH:mm:ss".
   */
  private parseWithFormat(value: string, format: string): string {
    // Build a regex from the format tokens
    const tokenRe = /(yyyy|MM|dd|HH|mm|SSS|ss)/g;
    let regexStr = '';
    let lastIdx = 0;
    const fields: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(format)) !== null) {
      // Escape literal text between tokens
      regexStr += format.slice(lastIdx, match.index).replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );
      regexStr += '(\\d+)';
      fields.push(match[1]);
      lastIdx = match.index + match[1].length;
    }
    regexStr += format.slice(lastIdx).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const re = new RegExp('^' + regexStr + '$');
    const m = value.match(re);
    if (!m) {
      throw new RuntimeError(
        `Cannot parse "${value}" with format "${format}"`,
      );
    }

    const parts: Record<string, string> = {};
    fields.forEach((f, i) => {
      parts[f] = m[i + 1];
    });

    const yyyy = parts['yyyy'] ?? '1970';
    const MM = (parts['MM'] ?? '01').padStart(2, '0');
    const dd = (parts['dd'] ?? '01').padStart(2, '0');
    const HH = (parts['HH'] ?? '00').padStart(2, '0');
    const mm = (parts['mm'] ?? '00').padStart(2, '0');
    const ss = (parts['ss'] ?? '00').padStart(2, '0');

    const hasTime = format.includes('HH') || format.includes('mm');
    return hasTime
      ? `${yyyy}-${MM}-${dd}T${HH}:${mm}:${ss}`
      : `${yyyy}-${MM}-${dd}`;
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
export interface EvaluateOptions {
  /**
   * Function to resolve a module name (e.g. `dw::core::Strings`) to its source code.
   * If not provided, a default resolver will attempt to read from the local filesystem
   * (replacing `::` with `/` and appending `.dwl`).
   */
  moduleResolver?: (moduleName: string) => string;
}

export function evaluate(
  source: string | AST.Program,
  context: Record<string, Value> = {},
  options: EvaluateOptions = {},
): Value {
  const ast: AST.Program = typeof source === 'string'
    ? Parser.fromSource(source).parse()
    : source;

  const globalEnv = new Environment(null, { ...STDLIB, ...context });
  const evaluator = new Evaluator();

  function evalDeclarations(
    declarations: AST.Declaration[],
    env: Environment,
    evaluator: Evaluator,
    options: EvaluateOptions,
  ) {
    for (const decl of declarations) {
      if (decl.type === 'VariableDeclaration') {
        const val = evaluator.eval(decl.value, env);
        env.set(decl.name, val);
      } else if (decl.type === 'FunctionDeclaration') {
        const fn: DWFunction = (...args: Value[]): Value => {
          const bindings: Record<string, Value> = {};
          decl.params.forEach((p, i) => {
            const val = args[i] ?? null;
            if (p.typeAnnotation) {
              evaluator.validateParamType(
                val,
                p.typeAnnotation,
                p.name,
                decl.name,
              );
            }
            bindings[p.name] = val;
          });
          return evaluator.eval(decl.body, env.extend(bindings));
        };
        env.set(decl.name, fn);
      } else if (decl.type === 'TypeDeclaration') {
        if (decl.baseType) {
          const constraints = decl.constraints
            ? (evaluator.eval(decl.constraints, env) as DWObject)
            : undefined;
          evaluator.registerType(decl.name, decl.baseType, constraints);
        }
      } else if (decl.type === 'ImportDeclaration') {
        let modSrc = '';
        if (options.moduleResolver) {
          modSrc = options.moduleResolver(decl.moduleName);
        } else {
          // Default resolver using Deno
          const path = decl.moduleName.replace(/::/g, '/') + '.dwl';
          try {
            modSrc = Deno.readTextFileSync(path);
          } catch (e) {
            throw new Error(
              `Failed to resolve module ${decl.moduleName} at ${path}: ${
                (e as Error).message
              }`,
            );
          }
        }

        const modAst = Parser.fromSource(modSrc).parse();
        const modEnv = new Environment(null, { ...STDLIB });
        if (modAst.declarations) {
          evalDeclarations(modAst.declarations, modEnv, evaluator, options);
        }

        if (decl.imports === '*') {
          for (const [key, value] of Object.entries(modEnv.exportStore())) {
            // Don't leak stdlib
            if (!(key in STDLIB)) {
              env.set(key, value);
            }
          }
        } else if (decl.imports === 'namespace') {
          const modNameParts = decl.moduleName.split('::');
          const localName = modNameParts[modNameParts.length - 1];
          const nsObject: DWObject = {};
          for (const [key, value] of Object.entries(modEnv.exportStore())) {
            if (!(key in STDLIB)) {
              nsObject[key] = value;
            }
          }
          env.set(localName, nsObject);
        } else {
          for (const imp of decl.imports) {
            try {
              const val = modEnv.get(imp.name);
              env.set(imp.alias || imp.name, val);
            } catch {
              throw new Error(
                `Module ${decl.moduleName} does not export ${imp.name}`,
              );
            }
          }
        }
      }
    }
  }

  if (ast.declarations) {
    evalDeclarations(ast.declarations, globalEnv, evaluator, options);
  }

  return evaluator.eval(ast.body, globalEnv);
}

// ── Multi-output support ──────────────────────────────────────────────────────

/**
 * Describes a single output block extracted from a multi-output script.
 */
export interface OutputBlock {
  /** MIME-based format string, e.g. `"json"`, `"csv"`, `"xml"`, `"yaml"`, `"text"`. */
  format: string;
  /** The full DSL source for this block (including any shared header declarations). */
  source: string;
}

/**
 * Split a DataWeave script that contains multiple `output ... ---` blocks into
 * individual {@link OutputBlock} items, each with its own format and body.
 *
 * A multi-output script looks like:
 * ```
 * %dw 2.0
 * var shared = payload.items
 * output application/json
 * ---
 * { count: sizeOf(shared) }
 * output application/csv
 * ---
 * shared map ((item) -> { name: item.name })
 * ```
 *
 * If the script has only one output block (or none), returns a single-element
 * array so callers can always iterate uniformly.
 *
 * @param source  The full DWL script source.
 * @returns       Array of {@link OutputBlock}s (at least one element).
 */
export function splitMultiOutputScript(source: string): OutputBlock[] {
  // Normalise line endings
  const src = source.replace(/\r\n/g, '\n');

  // Regex that matches an `output <mime>` line followed (possibly after other
  // header tokens) by a `---` separator on its own line.
  // We collect every occurrence as a potential block boundary.
  const outputLineRe =
    /^[ \t]*output[ \t]+(application|text)\/([a-zA-Z0-9+\-_.]+)[^\n]*$/gm;

  interface RawBlock {
    outputLine: number; // index of the `output` line in `lines`
    format: string;
    separatorLine: number; // index of the `---` line that follows
  }

  const lines = src.split('\n');
  const rawBlocks: RawBlock[] = [];

  let m: RegExpExecArray | null;
  while ((m = outputLineRe.exec(src)) !== null) {
    const mime = `${m[1]}/${m[2]}`;
    // Map character offset → line index
    const charsBefore = src.slice(0, m.index);
    const outputLineIdx = charsBefore.split('\n').length - 1;

    // Look for the next `---` separator after this output line
    let sepLineIdx = -1;
    for (let i = outputLineIdx + 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i])) {
        sepLineIdx = i;
        break;
      }
      // If we hit another `output` directive before `---`, bail out
      if (/^[ \t]*output[ \t]/.test(lines[i])) break;
    }
    if (sepLineIdx === -1) continue; // no matching `---`, skip

    rawBlocks.push({
      outputLine: outputLineIdx,
      format: mimeToFormat(mime),
      separatorLine: sepLineIdx,
    });
  }

  // No multi-output markers found — return the whole script as-is
  if (rawBlocks.length <= 1) {
    const format = rawBlocks.length === 1 ? rawBlocks[0].format : 'json';
    return [{ format, source: src }];
  }

  // Extract the shared header (everything before the first `output` line)
  const sharedHeaderLines = lines.slice(0, rawBlocks[0].outputLine);
  // Keep %dw directive if present; ensure header ends with a placeholder separator
  // We'll re-add it per block.
  const sharedHeader = sharedHeaderLines.join('\n');

  const blocks: OutputBlock[] = [];
  for (let bi = 0; bi < rawBlocks.length; bi++) {
    const current = rawBlocks[bi];
    const nextOutputLine = bi + 1 < rawBlocks.length
      ? rawBlocks[bi + 1].outputLine
      : lines.length;

    // Body lines are everything after the `---` separator up to the next block
    const bodyLines = lines.slice(current.separatorLine + 1, nextOutputLine);
    // Remove trailing empty lines from body
    while (
      bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === ''
    ) {
      bodyLines.pop();
    }

    // Compose a standalone script: shared header + output directive + --- + body
    const outputDirective = lines[current.outputLine];
    const blockSource = [
      sharedHeader,
      outputDirective,
      '---',
      ...bodyLines,
    ].filter((l, i) => i > 0 || l.trim() !== '').join('\n');

    blocks.push({ format: current.format, source: blockSource });
  }

  return blocks;
}

/** Convert a MIME type string to a format key recognised by the adapters. */
function mimeToFormat(mime: string): string {
  if (mime.includes('json')) return 'json';
  if (mime.includes('csv')) return 'csv';
  if (mime.includes('xml')) return 'xml';
  if (mime.includes('yaml') || mime.includes('yml')) return 'yaml';
  if (mime.includes('ndjson') || mime.includes('x-ndjson')) return 'ndjson';
  if (mime.includes('urlencoded')) return 'urlencoded';
  if (mime.includes('multipart')) return 'multipart';
  return 'text';
}
