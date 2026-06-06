import { parse as yamlParse, stringify as yamlStringify } from '@std/yaml';
import type { Value } from '../evaluator/environment.ts';

/** Parse a YAML string into a runtime Value. */
export function parseYAML(input: string): Value {
  return yamlParse(input) as Value;
}

/** Serialize a runtime Value to a YAML string. */
export function toYAML(value: Value): string {
  return yamlStringify(value as Record<string, unknown>);
}
