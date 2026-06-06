import { evaluate } from "../src/evaluator/evaluator.ts";

try {
  // Resolve the path to the example.dwl script relative to this execution file
  const scriptPath = new URL("./example.dwl", import.meta.url);
  const script = Deno.readTextFileSync(scriptPath);

  // Execute using our engine
  const resultado = evaluate(script);

  // Display the formatted result
  console.log(JSON.stringify(resultado, null, 2));
} catch (error) {
  console.error("Error executing the script:", error);
}
