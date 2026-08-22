/**
 * DenoWeave Transformation Engine
 *
 * A lightweight, fast, and secure data transformation engine for TypeScript and Deno,
 * inspired by DataWeave.
 *
 * ## Overview
 *
 * `@denoweave/engine` allows you to evaluate `.dwl` scripts programmatically in your
 * Deno applications. It is perfect for building ETL pipelines, API gateways, or
 * any service that needs to transform complex JSON/CSV data on the fly.
 *
 * ## Quick Start
 *
 * ### 1. Basic Evaluation
 *
 * The core function is `evaluate`. It takes a DenoWeave script and an environment
 * object containing the `payload`.
 *
 * ```typescript
 * import { evaluate } from "jsr:@denoweave/engine";
 *
 * const script = `
 * %dw 2.0
 * output application/json
 * ---
 * {
 *   greeting: "Hello " ++ payload.name,
 *   ageNextYear: payload.age + 1
 * }
 * `;
 *
 * const result = evaluate(script, {
 *   payload: { name: "Alice", age: 30 }
 * });
 *
 * console.log(result);
 * // => { greeting: "Hello Alice", ageNextYear: 31 }
 * ```
 *
 * ### 2. Multi-output Scripts
 *
 * DenoWeave supports scripts that generate multiple outputs (e.g., a JSON report and a CSV export).
 * Use `splitMultiOutputScript` to parse the blocks, evaluate them, and `serialize` them to text.
 *
 * ```typescript
 * import { evaluate, splitMultiOutputScript, serialize } from "jsr:@denoweave/engine";
 * import type { Format } from "jsr:@denoweave/engine";
 *
 * const script = `
 * %dw 2.0
 * var items = payload.items
 *
 * output application/json
 * ---
 * { total: sizeOf(items) }
 *
 * output application/csv
 * ---
 * items
 * `;
 *
 * const blocks = splitMultiOutputScript(script);
 *
 * for (const block of blocks) {
 *   const result = evaluate(block.source, { payload: { items: [{id: 1}, {id: 2}] } });
 *   const text = serialize(result, block.format as Format, { indent: 2 });
 *
 *   console.log(`=== ${block.format.toUpperCase()} ===`);
 *   console.log(text);
 * }
 * ```
 *
 * @module
 */

export { evaluate, splitMultiOutputScript } from './evaluator/evaluator.ts';

export type { Value } from './evaluator/environment.ts';

export { parse, serialize } from './adapters/index.ts';

export type { Format } from './adapters/index.ts';
