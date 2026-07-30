/**
 * xlsx-to-json example
 *
 * This example generates a sample XLSX file in-memory (no external file
 * needed), then evaluates the DataWeave transform against it.
 *
 * Run: deno run --allow-read examples/xlsx-to-json/run.ts
 */
import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import { serialize } from '@denoweave/adapters/index.ts';
import { parseXLSX, toXLSX } from '@denoweave/adapters/xlsx.ts';

// ── Generate a sample XLSX in memory ─────────────────────────────────────────

const sampleData = [
  {
    region: 'North',
    salesperson: 'Alice',
    product: 'Widget A',
    revenue: 12500,
  },
  { region: 'South', salesperson: 'Bob', product: 'Widget B', revenue: 8750 },
  {
    region: 'North',
    salesperson: 'Carol',
    product: 'Gadget X',
    revenue: 21000,
  },
  { region: 'East', salesperson: 'David', product: 'Widget A', revenue: 6300 },
  { region: 'South', salesperson: 'Eva', product: 'Gadget X', revenue: 15900 },
  { region: 'East', salesperson: 'Frank', product: 'Widget B', revenue: 9200 },
  {
    region: 'North',
    salesperson: 'Grace',
    product: 'Gadget X',
    revenue: 18400,
  },
];

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const script = Deno.readTextFileSync(scriptPath);

  // If an actual .xlsx exists alongside this file, use it; otherwise generate one
  let xlsxBytes: Uint8Array;
  try {
    xlsxBytes = Deno.readFileSync(new URL('./input.xlsx', import.meta.url));
    console.log('Using input.xlsx from disk.');
  } catch {
    console.log('No input.xlsx found — generating sample data in memory...');
    xlsxBytes = await toXLSX(sampleData);
  }

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
