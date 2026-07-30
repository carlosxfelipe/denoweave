/**
 * xlsx-to-json example
 *
 * This example reads a binary XLSX file and evaluates the DataWeave transform against it.
 *
 * Run: deno run --allow-read examples/xlsx-to-json/run.ts
 */
import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import { serialize } from '@denoweave/adapters/index.ts';
import { parseXLSX } from '@denoweave/adapters/xlsx.ts';

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const payloadPath = new URL('./input.xlsx', import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);
  const xlsxBytes = Deno.readFileSync(payloadPath);

  // Parse the XLSX into an array of objects (first row = header)
  const payload = await parseXLSX(xlsxBytes);

  console.log(`Parsed ${(payload as unknown[]).length} rows from XLSX.\n`);

  const result = evaluate(script, { payload });

  const outputJson = serialize(result, 'json', { indent: 2 });
  console.log(outputJson);

  const answer = prompt('\nDo you want to save output.json? (y/n):');
  if (answer && ['y', 'yes'].includes(answer.trim().toLowerCase())) {
    const outputPath = new URL('./output.json', import.meta.url);
    Deno.writeTextFileSync(outputPath, outputJson);
    console.log(`Saved to: ${outputPath.pathname}`);
  }
} catch (error) {
  console.error('Error executing the script:', error);
}
