/**
 * Unified adapter API.
 * Detects or routes by format name, providing a single parse/serialize entry point.
 */
import type { Value } from '../evaluator/environment.ts';
import { parseJSON, toJSON } from './json.ts';
import { type CsvOptions, parseCSV, toCSV } from './csv.ts';
import { parseXML, toXML } from './xml.ts';
import { parseYAML, toYAML } from './yaml.ts';

export type Format = 'json' | 'csv' | 'xml' | 'yaml';

/** Parse input string into a runtime Value, routing by format. */
export function parse(
  input: string,
  format: Format,
  options?: CsvOptions,
): Value {
  switch (format) {
    case 'json':
      return parseJSON(input);
    case 'csv':
      return parseCSV(input, options);
    case 'xml':
      return parseXML(input);
    case 'yaml':
      return parseYAML(input);
  }
}

/** Serialize a runtime Value to a string, routing by format. */
export function serialize(
  value: Value,
  format: Format,
  options?: { indent?: number } & CsvOptions,
): string {
  switch (format) {
    case 'json':
      return toJSON(value, options?.indent ?? 2);
    case 'csv':
      return toCSV(value, options);
    case 'xml':
      return toXML(value, options?.indent ?? 2);
    case 'yaml':
      return toYAML(value);
  }
}

// Named re-exports for direct import
export { parseJSON, toJSON } from './json.ts';
export { parseCSV, toCSV } from './csv.ts';
export { parseXML, toXML } from './xml.ts';
export { parseYAML, toYAML } from './yaml.ts';
