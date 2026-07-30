/**
 * Unified adapter API.
 * Detects or routes by format name, providing a single parse/serialize entry point.
 *
 * Supported formats:
 *   Text-based  : json | csv | xml | yaml | ndjson | text | urlencoded | dw
 *   Structured  : multipart
 *   Binary      : xlsx  (use parseXLSX / toXLSX directly — they are async and binary)
 */
import type { Value } from '../evaluator/environment.ts';
import { parseJSON, toJSON } from './json.ts';
import { type CsvOptions, parseCSV, toCSV } from './csv.ts';
import { parseXML, toXML } from './xml.ts';
import { parseYAML, toYAML } from './yaml.ts';
import { parseNDJSON, toNDJSON } from './ndjson.ts';
import { parseText, toText } from './text.ts';
import { parseURLEncoded, toURLEncoded } from './urlencoded.ts';
import { parseMultipart, toMultipart } from './multipart.ts';
import { parseDW, toDW } from './dw.ts';

export type Format =
  | 'json'
  | 'csv'
  | 'xml'
  | 'yaml'
  | 'ndjson'
  | 'text'
  | 'urlencoded'
  | 'multipart'
  | 'dw'
  | 'xlsx'; // xlsx is binary — handled separately via parseXLSX / toXLSX

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
    case 'ndjson':
      return parseNDJSON(input);
    case 'text':
      return parseText(input);
    case 'urlencoded':
      return parseURLEncoded(input);
    case 'multipart':
      return parseMultipart(input);
    case 'dw':
      return parseDW(input);
    case 'xlsx':
      throw new Error(
        'XLSX is a binary format. Use parseXLSX(Uint8Array) instead.',
      );
  }
}

export interface SerializeOptions extends CsvOptions {
  indent?: number;
  boundary?: string; // for multipart
}

/** Serialize a runtime Value to a string, routing by format. */
export function serialize(
  value: Value,
  format: Format,
  options?: SerializeOptions,
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
    case 'ndjson':
      return toNDJSON(value);
    case 'text':
      return toText(value);
    case 'urlencoded':
      return toURLEncoded(value);
    case 'multipart': {
      const { body } = toMultipart(value, options?.boundary);
      return body;
    }
    case 'dw':
      return toDW(value, options?.indent ?? 2);
    case 'xlsx':
      throw new Error(
        'XLSX is a binary format. Use toXLSX(Value) → Promise<Uint8Array> instead.',
      );
  }
}

// ── Named re-exports for direct import ────────────────────────────────────────

export { parseJSON, toJSON } from './json.ts';
export { parseCSV, toCSV } from './csv.ts';
export { parseXML, toXML } from './xml.ts';
export { parseYAML, toYAML } from './yaml.ts';
export { parseNDJSON, toNDJSON } from './ndjson.ts';
export { parseText, toText } from './text.ts';
export { parseURLEncoded, toURLEncoded } from './urlencoded.ts';
export { parseMultipart, toMultipart } from './multipart.ts';
export { parseDW, toDW } from './dw.ts';
export { parseXLSX, toXLSX } from './xlsx.ts';
