import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import { parse, serialize } from '@denoweave/adapters/index.ts';

try {
  const scriptPath = new URL('./transform.dwl', import.meta.url);
  const payloadPath = new URL('./input.json', import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);
  const rawJson = Deno.readTextFileSync(payloadPath);

  const payload = parse(rawJson, 'json');

  const result = evaluate(script, { payload });

  // Serialize into DataWeave literal notation (application/dw)
  // Produces unquoted identifier keys, |date| temporal pipes, etc.
  const outputDw = serialize(result, 'dw', { indent: 2 });
  console.log(outputDw);

  const answer = prompt('\nDo you want to generate the output file? (y/n):');
  if (answer && ['y', 'yes'].includes(answer.trim().toLowerCase())) {
    const outputPath = new URL('./output.dw', import.meta.url);
    Deno.writeTextFileSync(outputPath, outputDw);
    console.log(
      `Output file successfully generated at: ${outputPath.pathname}`,
    );
  }
} catch (error) {
  console.error('Error executing the script:', error);
}
