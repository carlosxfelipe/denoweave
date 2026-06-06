import type { DWFunction, Value } from '../evaluator/environment.ts';

export const STRING_FUNCTIONS: Record<string, Value> = {
  upper:     ((s: Value): Value => typeof s === 'string' ? s.toUpperCase() : s) as DWFunction,
  lower:     ((s: Value): Value => typeof s === 'string' ? s.toLowerCase() : s) as DWFunction,
  trim:      ((s: Value): Value => typeof s === 'string' ? s.trim() : s) as DWFunction,
  trimLeft:  ((s: Value): Value => typeof s === 'string' ? s.trimStart() : s) as DWFunction,
  trimRight: ((s: Value): Value => typeof s === 'string' ? s.trimEnd() : s) as DWFunction,

  capitalize: ((s: Value): Value => {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  }) as DWFunction,

  contains: ((s: Value, sub: Value): Value => {
    if (Array.isArray(s)) return (s as Value[]).includes(sub);
    if (typeof s === 'string') return s.includes(String(sub));
    return false;
  }) as DWFunction,

  startsWith: ((s: Value, prefix: Value): Value =>
    typeof s === 'string' ? s.startsWith(String(prefix)) : false) as DWFunction,

  endsWith: ((s: Value, suffix: Value): Value =>
    typeof s === 'string' ? s.endsWith(String(suffix)) : false) as DWFunction,

  replace: ((s: Value, pattern: Value, replacement: Value): Value =>
    typeof s === 'string' ? s.replaceAll(String(pattern), String(replacement)) : s) as DWFunction,

  split: ((s: Value, delimiter: Value): Value =>
    typeof s === 'string' ? s.split(String(delimiter)) as Value[] : [s]) as DWFunction,

  join: ((arr: Value, delimiter: Value): Value => {
    if (!Array.isArray(arr)) return String(arr);
    return (arr as Value[]).map(String).join(String(delimiter ?? ''));
  }) as DWFunction,

  substring: ((s: Value, start: Value, end?: Value): Value => {
    if (typeof s !== 'string') return s;
    return end !== undefined && end !== null
      ? s.substring(Number(start), Number(end))
      : s.substring(Number(start));
  }) as DWFunction,

  indexOf: ((s: Value, sub: Value): Value =>
    typeof s === 'string' ? s.indexOf(String(sub)) : -1) as DWFunction,

  repeat: ((s: Value, n: Value): Value =>
    typeof s === 'string' ? s.repeat(Math.max(0, Number(n))) : s) as DWFunction,

  padLeft: ((s: Value, n: Value, char?: Value): Value =>
    typeof s === 'string' ? s.padStart(Number(n), char != null ? String(char) : ' ') : s) as DWFunction,

  padRight: ((s: Value, n: Value, char?: Value): Value =>
    typeof s === 'string' ? s.padEnd(Number(n), char != null ? String(char) : ' ') : s) as DWFunction,

  charCodeAt: ((s: Value, idx: Value): Value =>
    typeof s === 'string' ? s.charCodeAt(Number(idx)) : null) as DWFunction,

  toString: ((v: Value): Value => String(v)) as DWFunction,
  toNumber: ((v: Value): Value => Number(v)) as DWFunction,
};
