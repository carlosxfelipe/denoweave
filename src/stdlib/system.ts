import type { DWFunction, Value } from '../evaluator/environment.ts';
import {
  type Format,
  parse as parseAdapter,
  serialize,
} from '../adapters/index.ts';

// ── Properties store (populated by CLI via setProperties) ────────────────────

let _properties: Record<string, string> = {};

/**
 * Inject a properties map that `p(key)` will read from.
 * Call this before evaluating any script that uses `p()`.
 */
export function setProperties(props: Record<string, string>): void {
  _properties = { ..._properties, ...props };
}

export const SYSTEM_FUNCTIONS: Record<string, Value> = {
  now: (() => new Date()) as DWFunction,

  /**
   * `p(key)` — Read a property by key.
   * Priority: injected properties store → Deno env vars.
   * Returns null (not an error) when the key is not found,
   * so it can be chained with `default`.
   */
  p: ((key: Value): Value => {
    const k = String(key);
    if (Object.prototype.hasOwnProperty.call(_properties, k)) {
      return _properties[k];
    }
    // Fallback: environment variable (if running in Deno/Node with Deno polyfill)
    if (typeof Deno !== 'undefined' && Deno.env) {
      try {
        return Deno.env.get(k) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }) as DWFunction,

  try: ((lambda: Value): Value => {
    if (typeof lambda !== 'function') {
      throw new Error('try: expected a lambda function as argument');
    }
    try {
      const value = (lambda as DWFunction)();
      return { success: true, value };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: { message } };
    }
  }) as DWFunction,

  readUrl: ((urlVal: Value, mimeTypeVal?: Value): Value => {
    let url = String(urlVal);
    if (url.startsWith('classpath://')) {
      url = url.substring('classpath://'.length);
    } else if (url.startsWith('file:')) {
      url = url.substring('file:'.length);
    }

    let format: Format = 'json'; // default fallback
    const mime = mimeTypeVal ? String(mimeTypeVal) : '';

    if (mime.includes('json') || url.endsWith('.json')) {
      format = 'json';
    } else if (mime.includes('csv') || url.endsWith('.csv')) {
      format = 'csv';
    } else if (mime.includes('xml') || url.endsWith('.xml')) {
      format = 'xml';
    } else if (
      mime.includes('yaml') || mime.includes('yml') || url.endsWith('.yaml') ||
      url.endsWith('.yml')
    ) {
      format = 'yaml';
    }

    let content: string | undefined;
    const pathsToTry = [url, 'example/' + url];
    if (url.startsWith('example/')) {
      pathsToTry.push(url.substring('example/'.length));
    }

    let lastErr: unknown;
    if (typeof Deno !== 'undefined' && Deno.readTextFileSync) {
      for (const p of pathsToTry) {
        try {
          content = Deno.readTextFileSync(p);
          break;
        } catch (e) {
          lastErr = e;
        }
      }
    } else {
      lastErr = new Error(
        'File system access is not available in this environment.',
      );
    }

    if (content === undefined) {
      throw new Error(
        `readUrl: Cannot read file "${url}". Details: ${lastErr}`,
      );
    }

    return parseAdapter(content, format);
  }) as DWFunction,

  uuid: (() => crypto.randomUUID()) as DWFunction,

  log: ((prefix: Value, value?: Value): Value => {
    // DataWeave's log(prefix, value) or log(value) returns the value
    if (value === undefined) {
      console.error(prefix);
      return prefix;
    }
    console.error(String(prefix), value);
    return value;
  }) as DWFunction,

  read: ((content: Value, mimeTypeVal?: Value): Value => {
    const str = String(content);
    let format: Format = 'json';
    if (mimeTypeVal) {
      const mime = String(mimeTypeVal);
      if (mime.includes('csv')) format = 'csv';
      else if (mime.includes('xml')) format = 'xml';
      else if (mime.includes('yaml') || mime.includes('yml')) format = 'yaml';
    }
    return parseAdapter(str, format);
  }) as DWFunction,

  write: ((val: Value, mimeTypeVal?: Value): Value => {
    let format: Format = 'json';
    if (mimeTypeVal) {
      const mime = String(mimeTypeVal);
      if (mime.includes('csv')) format = 'csv';
      else if (mime.includes('xml')) format = 'xml';
      else if (mime.includes('yaml') || mime.includes('yml')) format = 'yaml';
    }
    return serialize(val, format);
  }) as DWFunction,
};
