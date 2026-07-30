import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import { parse, serialize } from '@denoweave/adapters/index.ts';

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const payloadPath = new URL('./input.multipart', import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);
  const rawBody = Deno.readTextFileSync(payloadPath);

  // Parse multipart/form-data — auto-detects the boundary line
  const payload = parse(rawBody, 'multipart');

  const result = evaluate(script, { payload });

  const outputJson = serialize(result, 'json', { indent: 2 });
  console.log(outputJson);

  const answer = prompt('\nDo you want to generate the output file? (y/n):');
  if (answer && ['y', 'yes'].includes(answer.trim().toLowerCase())) {
    const outputPath = new URL('./output.json', import.meta.url);
    Deno.writeTextFileSync(outputPath, outputJson);
    console.log(
      `Output file successfully generated at: ${outputPath.pathname}`,
    );
  }
} catch (error) {
  console.error('Error executing the script:', error);
}
