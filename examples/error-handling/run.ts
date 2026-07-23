import { evaluate } from '@denoweave/evaluator/evaluator.ts';

// ── Error Handling Example ────────────────────────────────────────────────────
//
// Demonstrates how to use the built-in try() function to safely process
// a batch of records where some may have missing or null fields.
//
// Instead of crashing the entire pipeline when one record is malformed,
// each record is wrapped in try(), producing a Result object:
//
//   { status: "OK",    data: { ... } }          → record processed successfully
//   { status: "ERROR", id: N, reason: "..." }   → record failed gracefully
//
// Run with:
//   deno run --allow-read examples/error-handling/run.ts

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const payloadPath = new URL('./input.json', import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);
  const payload = JSON.parse(Deno.readTextFileSync(payloadPath));

  console.log('⚙️  Processing batch with intentionally malformed records...\n');

  const results = evaluate(script, { payload }) as Array<
    Record<string, unknown>
  >;

  const succeeded = results.filter((r) => r.status === 'OK');
  const failed = results.filter((r) => r.status === 'ERROR');

  console.log('📋 Full result:\n');
  console.log(JSON.stringify(results, null, 2));

  console.log(`\n✅ Processed successfully: ${succeeded.length}`);
  console.log(`❌ Failed (handled gracefully): ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n🔍 Failed records:');
    for (const f of failed) {
      console.log(`   - Record #${f.id}: ${f.reason}`);
    }
  }
} catch (error) {
  console.error('Unexpected engine error:', error);
}
