import { evaluate } from '@denoweave/evaluator/evaluator.ts';

const transformDwl = await Deno.readTextFile(
  new URL('./transform.dwl', import.meta.url),
);

try {
  // We don't even need a payload for this example since we are showcasing literals
  const result = evaluate(transformDwl, {
    payload: {},
  });

  console.log('--- Date Math Result ---');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Failed to run transform:', error);
}
