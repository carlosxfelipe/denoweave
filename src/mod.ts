/**
 * DenoWeave Transformation Engine
 *
 * A lightweight data transformation engine for TypeScript and Deno.
 * @module
 */

export { evaluate, splitMultiOutputScript } from './evaluator/evaluator.ts';

export type { Value } from './evaluator/environment.ts';

export { parse, serialize } from './adapters/index.ts';

export type { Format } from './adapters/index.ts';
