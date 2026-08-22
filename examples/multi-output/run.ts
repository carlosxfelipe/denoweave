/**
 * Multi-output example — DenoWeave
 *
 * Demonstrates a single .dwl script that produces multiple outputs in
 * different formats from the same payload, using:
 *
 *   - Multi-output blocks (output application/json + output application/csv)
 *   - groupBy with robust string keys
 *   - Conditional properties via `(field: value) if (expr?)`
 *   - Named functions (fun) shared across both output blocks
 *
 * Run with:
 *   deno run --allow-read --allow-write examples/multi-output/run.ts
 *
 * Or via the CLI directly (routing outputs to files):
 *   deno task cli --allow-write \
 *                 --script examples/multi-output/transform.dwl \
 *                 --input  examples/multi-output/input.json \
 *                 --target 1:out.json \
 *                 --target 2:out.csv
 */

import {
  evaluate,
  splitMultiOutputScript,
} from '@denoweave/evaluator/evaluator.ts';
import { serialize } from '@denoweave/adapters/index.ts';
import type { Format } from '@denoweave/adapters/index.ts';

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const inputPath = new URL('./input.json', import.meta.url);

  const source = Deno.readTextFileSync(scriptPath);
  const payload = JSON.parse(Deno.readTextFileSync(inputPath));

  // Split the script into individual output blocks
  const blocks = splitMultiOutputScript(source);

  console.log(
    `\nRunning multi-output script — ${blocks.length} output blocks found\n`,
  );
  console.log('='.repeat(60));

  const generatedFiles: string[] = [];

  for (const [i, block] of blocks.entries()) {
    const result = evaluate(block.source, { payload });

    // Serialize each block with its own declared format
    const outFmt = block.format as Format;
    const serialized = serialize(result, outFmt, { indent: 2 });

    console.log(`\n── Block ${i + 1}: ${outFmt.toUpperCase()} ──`);
    console.log(serialized);

    const outputPath = new URL(`./output_${i + 1}.${outFmt}`, import.meta.url);
    Deno.writeTextFileSync(outputPath, serialized);
    generatedFiles.push(outputPath.pathname);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Files automatically generated:`);
  for (const file of generatedFiles) {
    console.log(`  - ${file}`);
  }
} catch (error) {
  console.error('Error executing the script:', error);
}
