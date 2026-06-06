import { evaluate } from "../src/evaluator/evaluator.ts";

try {
  // Resolve the path to the example.dwl script relative to this execution file
  const scriptPath = new URL("./example.dwl", import.meta.url);
  const script = Deno.readTextFileSync(scriptPath);

  // Execute using our engine
  const result = evaluate(script);

  // Display the formatted result
  console.log(JSON.stringify(result, null, 2));

  // Ask if the user wants to generate the output file
  const answer = prompt("\nDo you want to generate the output file? (y/n):");
  if (answer && ["y", "yes"].includes(answer.trim().toLowerCase())) {
    const outputPath = new URL("./output.json", import.meta.url);
    Deno.writeTextFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`Output file successfully generated at: ${outputPath.pathname}`);
  }
} catch (error) {
  console.error("Error executing the script:", error);
}
