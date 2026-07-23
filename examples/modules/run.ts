import { evaluate } from '@denoweave/evaluator/evaluator.ts';

const transformDwl = await Deno.readTextFile(
  new URL('./main.dwl', import.meta.url),
);

try {
  const result = evaluate(transformDwl, {}, {
    // Provide a basic resolver that maps module paths (e.g. custom::math -> ./custom/math.dwl)
    moduleResolver: (moduleName: string) => {
      const path = new URL(
        `./${moduleName.replace(/::/g, '/')}.dwl`,
        import.meta.url,
      );
      return Deno.readTextFileSync(path);
    },
  });

  console.log('--- Modules Result ---');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error('Failed to run transform:', error);
}
