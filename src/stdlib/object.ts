import type { DWFunction, DWObject, Value } from '../evaluator/environment.ts';

export const OBJECT_FUNCTIONS: Record<string, Value> = {
  keys: ((obj: Value): Value => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.keys(obj as DWObject);
    }
    return [];
  }) as DWFunction,

  values: ((obj: Value): Value => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.values(obj as DWObject) as Value[];
    }
    return [];
  }) as DWFunction,

  entries: ((obj: Value): Value => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.entries(obj as DWObject).map(([k, v]) => [k, v] as Value[]);
    }
    return [];
  }) as DWFunction,

  fromEntries: ((entries: Value): Value => {
    if (!Array.isArray(entries)) return {};
    const result: DWObject = {};
    for (const pair of entries as Value[]) {
      if (Array.isArray(pair) && pair.length >= 2) {
        result[String(pair[0])] = pair[1];
      }
    }
    return result;
  }) as DWFunction,

  merge: ((obj1: Value, obj2: Value): Value => {
    const a = (obj1 && typeof obj1 === 'object' && !Array.isArray(obj1))
      ? obj1 as DWObject
      : {};
    const b = (obj2 && typeof obj2 === 'object' && !Array.isArray(obj2))
      ? obj2 as DWObject
      : {};
    return { ...a, ...b };
  }) as DWFunction,

  deepMerge: ((obj1: Value, obj2: Value): Value => {
    function deep(a: DWObject, b: DWObject): DWObject {
      const result = { ...a };
      for (const [k, v] of Object.entries(b)) {
        if (
          v && typeof v === 'object' && !Array.isArray(v) &&
          result[k] && typeof result[k] === 'object' &&
          !Array.isArray(result[k])
        ) {
          result[k] = deep(result[k] as DWObject, v as DWObject);
        } else {
          result[k] = v;
        }
      }
      return result;
    }
    const a = (obj1 && typeof obj1 === 'object' && !Array.isArray(obj1))
      ? obj1 as DWObject
      : {};
    const b = (obj2 && typeof obj2 === 'object' && !Array.isArray(obj2))
      ? obj2 as DWObject
      : {};
    return deep(a, b);
  }) as DWFunction,

  mapObject: ((obj: Value, fn: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const f = fn as DWFunction;
    const result: DWObject = {};
    for (const [k, v] of Object.entries(obj as DWObject)) {
      result[k] = f(v, k);
    }
    return result;
  }) as DWFunction,

  filterObject: ((obj: Value, fn: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const f = fn as DWFunction;
    const result: DWObject = {};
    for (const [k, v] of Object.entries(obj as DWObject)) {
      if (f(v, k)) result[k] = v;
    }
    return result;
  }) as DWFunction,

  pick: ((obj: Value, keys: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const ks = (Array.isArray(keys) ? keys : [keys]).map(String);
    const result: DWObject = {};
    for (const k of ks) result[k] = (obj as DWObject)[k] ?? null;
    return result;
  }) as DWFunction,

  omit: ((obj: Value, keys: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const ks = new Set((Array.isArray(keys) ? keys : [keys]).map(String));
    const result: DWObject = {};
    for (const [k, v] of Object.entries(obj as DWObject)) {
      if (!ks.has(k)) result[k] = v;
    }
    return result;
  }) as DWFunction,

  has: ((obj: Value, key: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
    return Object.prototype.hasOwnProperty.call(obj, String(key));
  }) as DWFunction,

  invert: ((obj: Value): Value => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
    const result: DWObject = {};
    for (const [k, v] of Object.entries(obj as DWObject)) result[String(v)] = k;
    return result;
  }) as DWFunction,
};
