import { evaluate } from "@denoweave/evaluator/evaluator.ts";

try {
  // Resolve paths relative to this file
  const scriptPath = new URL("./transform.dwl", import.meta.url);
  const payloadPath = new URL("./input.json", import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);

  // Simulate the Mule runtime context:
  // - payload  → the incoming message body (parsed from JSON)
  // - attributes → HTTP metadata (method, headers, query params, etc.)
  // - vars      → Mule flow variables (empty in this standalone example)
  const payload = JSON.parse(Deno.readTextFileSync(payloadPath));

  const attributes = {
    method: "POST",
    requestPath: "/orders",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
    },
    queryParams: {},
  };

  const vars = {};

  // Execute using our engine — payload is injected, never declared in the .dwl
  const result = evaluate(script, { payload, attributes, vars });

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
