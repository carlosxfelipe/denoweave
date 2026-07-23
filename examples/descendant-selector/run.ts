import { evaluate } from '@denoweave/evaluator/evaluator.ts';

const inputJson = await Deno.readTextFile(
  new URL('./input.json', import.meta.url),
);
const transformDwl = await Deno.readTextFile(
  new URL('./transform.dwl', import.meta.url),
);

try {
  const result = evaluate(transformDwl, {
    payload: JSON.parse(inputJson),
  });

  console.log('--- Result ---');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Failed to run transform:', error);
}
