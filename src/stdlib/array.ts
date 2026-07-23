import type { DWFunction, DWObject, Value } from '../evaluator/environment.ts';

/** Helper: assert Value is an array */
function asArray(fn: string, v: Value): Value[] {
  if (!Array.isArray(v)) {
    throw new TypeError(`${fn}: expected array, got ${typeof v}`);
  }
  return v as Value[];
}

/** Helper: assert Value is a function */
function asFunc(fn: string, v: Value): DWFunction {
  if (typeof v !== 'function') throw new TypeError(`${fn}: expected function`);
  return v as DWFunction;
}

export const ARRAY_FUNCTIONS: Record<string, Value> = {
  // ── Higher-order ────────────────────────────────────────────────────────
  map: ((arr: Value, fn: Value): Value => {
    const a = asArray('map', arr);
    const f = asFunc('map', fn);
    return a.map((item, i) => f(item, i));
  }) as DWFunction,

  filter: ((arr: Value, fn: Value): Value => {
    const a = asArray('filter', arr);
    const f = asFunc('filter', fn);
    return a.filter((item, i) => Boolean(f(item, i)));
  }) as DWFunction,

  reduce: ((arr: Value, fn: Value, initial?: Value): Value => {
    const a = asArray('reduce', arr);
    const f = asFunc('reduce', fn);
    if (a.length === 0) return initial ?? null;
    return initial !== undefined
      ? a.reduce((acc, item) => f(acc, item), initial)
      : a.slice(1).reduce((acc, item) => f(acc, item), a[0]);
  }) as DWFunction,

  flatMap: ((arr: Value, fn: Value): Value => {
    const a = asArray('flatMap', arr);
    const f = asFunc('flatMap', fn);
    return a.flatMap((item, i) => {
      const r = f(item, i);
      return Array.isArray(r) ? r : [r];
    }) as Value[];
  }) as DWFunction,

  // ── Grouping / sorting ──────────────────────────────────────────────────
  groupBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('groupBy', arr);
    const f = asFunc('groupBy', fn);
    const groups: DWObject = {};
    for (const [i, item] of a.entries()) {
      const key = String(f(item, i));
      if (!groups[key]) groups[key] = [];
      (groups[key] as Value[]).push(item);
    }
    return groups;
  }) as DWFunction,

  orderBy: ((arr: Value, fn: Value, dir?: Value): Value => {
    const a = asArray('orderBy', arr);
    const f = asFunc('orderBy', fn);
    const desc = dir === 'desc' || dir === 'DESC';
    return [...a].sort((x, y) => {
      const kx = f(x) ?? null;
      const ky = f(y) ?? null;
      if (typeof kx === 'number' && typeof ky === 'number') {
        return desc ? ky - kx : kx - ky;
      }
      const sx = kx === null ? '' : String(kx);
      const sy = ky === null ? '' : String(ky);
      if (sx < sy) return desc ? 1 : -1;
      if (sx > sy) return desc ? -1 : 1;
      return 0;
    });
  }) as DWFunction,

  distinctBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('distinctBy', arr);
    const f = asFunc('distinctBy', fn);
    const seen = new Set<string>();
    return a.filter((item, i) => {
      const key = JSON.stringify(f(item, i));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }) as DWFunction,

  // ── Pluck: object key-value mapper → array ──────────────────────────────
  pluck: ((obj: Value, fn: Value): Value => {
    const f = asFunc('pluck', fn);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.entries(obj as DWObject).map(([k, v]) => f(v, k));
    }
    return [];
  }) as DWFunction,

  // ── Slicing ─────────────────────────────────────────────────────────────
  first: ((arr: Value): Value => {
    const a = asArray('first', arr);
    return a[0] ?? null;
  }) as DWFunction,

  last: ((arr: Value): Value => {
    const a = asArray('last', arr);
    return a[a.length - 1] ?? null;
  }) as DWFunction,

  take:
    ((arr: Value, n: Value): Value =>
      asArray('take', arr).slice(0, Number(n))) as DWFunction,

  drop:
    ((arr: Value, n: Value): Value =>
      asArray('drop', arr).slice(Number(n))) as DWFunction,

  chunk: ((arr: Value, size: Value): Value => {
    const a = asArray('chunk', arr);
    const s = Math.max(1, Number(size));
    const result: Value[] = [];
    for (let i = 0; i < a.length; i += s) result.push(a.slice(i, i + s));
    return result;
  }) as DWFunction,

  reverse:
    ((arr: Value): Value =>
      [...asArray('reverse', arr)].reverse()) as DWFunction,

  flatten:
    ((arr: Value): Value =>
      Array.isArray(arr)
        ? ((arr as Value[]).flat() as Value[])
        : arr) as DWFunction,

  zip: ((a: Value, b: Value): Value => {
    const arr1 = asArray('zip', a);
    const arr2 = asArray('zip', b);
    const len = Math.min(arr1.length, arr2.length);
    return Array.from({ length: len }, (_, i) => [arr1[i], arr2[i]] as Value[]);
  }) as DWFunction,

  // ── Predicates ──────────────────────────────────────────────────────────
  contains: ((arr: Value, item: Value): Value => {
    if (Array.isArray(arr)) return (arr as Value[]).includes(item);
    if (typeof arr === 'string') return arr.includes(String(item));
    return false;
  }) as DWFunction,

  count: ((arr: Value, fn?: Value): Value => {
    const a = asArray('count', arr);
    if (fn == null) return a.length;
    const f = asFunc('count', fn);
    return a.filter((item) => Boolean(f(item))).length;
  }) as DWFunction,

  // ── Aggregates ──────────────────────────────────────────────────────────
  sum: ((arr: Value): Value =>
    asArray('sum', arr).reduce(
      (a, b) => (a as number) + (b as number),
      0,
    )) as DWFunction,

  avg: ((arr: Value): Value => {
    const a = asArray('avg', arr);
    if (a.length === 0) return null;
    const total = a.reduce(
      (s, n) => (s as number) + (n as number),
      0,
    ) as number;
    return total / a.length;
  }) as DWFunction,

  min: ((arr: Value): Value => {
    const a = asArray('min', arr) as number[];
    if (a.length === 0) return null;
    return Math.min(...a);
  }) as DWFunction,

  max: ((arr: Value): Value => {
    const a = asArray('max', arr) as number[];
    if (a.length === 0) return null;
    return Math.max(...a);
  }) as DWFunction,

  // ── Search / Predicate ───────────────────────────────────────────────────
  find: ((arr: Value, fn: Value): Value => {
    const a = asArray('find', arr);
    const f = asFunc('find', fn);
    return a.find((item) => Boolean(f(item))) ?? null;
  }) as DWFunction,

  some: ((arr: Value, fn: Value): Value => {
    const a = asArray('some', arr);
    const f = asFunc('some', fn);
    return a.some((item) => Boolean(f(item)));
  }) as DWFunction,

  every: ((arr: Value, fn: Value): Value => {
    const a = asArray('every', arr);
    const f = asFunc('every', fn);
    return a.every((item) => Boolean(f(item)));
  }) as DWFunction,

  // ── Key-extractor Aggregates ─────────────────────────────────────────────
  sumBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('sumBy', arr);
    const f = asFunc('sumBy', fn);
    return a.reduce((acc, item) => (acc as number) + (f(item) as number), 0);
  }) as DWFunction,

  maxBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('maxBy', arr);
    if (a.length === 0) return null;
    const f = asFunc('maxBy', fn);
    return a.reduce((best, item) =>
      (f(item) as number) > (f(best) as number) ? item : best
    );
  }) as DWFunction,

  minBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('minBy', arr);
    if (a.length === 0) return null;
    const f = asFunc('minBy', fn);
    return a.reduce((best, item) =>
      (f(item) as number) < (f(best) as number) ? item : best
    );
  }) as DWFunction,

  countBy: ((arr: Value, fn: Value): Value => {
    const a = asArray('countBy', arr);
    const f = asFunc('countBy', fn);
    return a.filter((item) => Boolean(f(item))).length;
  }) as DWFunction,

  // ── Deep Flatten ─────────────────────────────────────────────────────────
  deepFlatten: ((arr: Value): Value => {
    const flatten = (a: Value[]): Value[] =>
      a.reduce<Value[]>(
        (acc, item) =>
          Array.isArray(item) ? [...acc, ...flatten(item)] : [...acc, item],
        [],
      );
    return flatten(asArray('deepFlatten', arr));
  }) as DWFunction,
};
