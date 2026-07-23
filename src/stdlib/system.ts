import type { DWFunction, Value } from '../evaluator/environment.ts';
import { type Format, parse as parseAdapter } from '../adapters/index.ts';

export const SYSTEM_FUNCTIONS: Record<string, Value> = {
  now: (() => new Date()) as DWFunction,

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
    for (const p of pathsToTry) {
      try {
        content = Deno.readTextFileSync(p);
        break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (content === undefined) {
      throw new Error(
        `readUrl: Cannot read file "${url}". Details: ${lastErr}`,
      );
    }

    return parseAdapter(content, format);
  }) as DWFunction,
};
