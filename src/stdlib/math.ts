import type { DWFunction, Value } from '../evaluator/environment.ts';

export const MATH_FUNCTIONS: Record<string, Value> = {
  abs: ((n: Value): Value => Math.abs(n as number)) as DWFunction,
  ceil: ((n: Value): Value => Math.ceil(n as number)) as DWFunction,
  floor: ((n: Value): Value => Math.floor(n as number)) as DWFunction,
  round: ((n: Value, places?: Value): Value => {
    const p = places != null ? Number(places) : 0;
    const factor = Math.pow(10, p);
    return Math.round((n as number) * factor) / factor;
  }) as DWFunction,
  sqrt: ((n: Value): Value => Math.sqrt(n as number)) as DWFunction,
  pow:
    ((base: Value, exp: Value): Value =>
      Math.pow(base as number, exp as number)) as DWFunction,
  log: ((n: Value): Value => Math.log(n as number)) as DWFunction,
  log10: ((n: Value): Value => Math.log10(n as number)) as DWFunction,
  mod:
    ((a: Value, b: Value): Value =>
      (a as number) % (b as number)) as DWFunction,
  random: ((): Value => Math.random()) as DWFunction,
  PI: Math.PI,
  E: Math.E,

  // Scalar min/max (vs. array min/max in array.ts)
  minOf:
    ((a: Value, b: Value): Value =>
      Math.min(a as number, b as number)) as DWFunction,
  maxOf:
    ((a: Value, b: Value): Value =>
      Math.max(a as number, b as number)) as DWFunction,

  // Type helpers
  isNull: ((v: Value): Value => v === null) as DWFunction,
  isEmpty: ((v: Value): Value => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string' || Array.isArray(v)) {
      return (v as string | Value[]).length === 0;
    }
    if (typeof v === 'object') return Object.keys(v as object).length === 0;
    return false;
  }) as DWFunction,
  typeOf: ((v: Value): Value => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }) as DWFunction,

  // Length (works on strings, arrays, objects)
  length: ((x: Value): Value => {
    if (typeof x === 'string' || Array.isArray(x)) {
      return (x as string | Value[]).length;
    }
    if (x && typeof x === 'object') return Object.keys(x as object).length;
    return 0;
  }) as DWFunction,
  sizeOf: ((x: Value): Value => {
    if (typeof x === 'string' || Array.isArray(x)) {
      return (x as string | Value[]).length;
    }
    if (x && typeof x === 'object') return Object.keys(x as object).length;
    return 0;
  }) as DWFunction,
};
