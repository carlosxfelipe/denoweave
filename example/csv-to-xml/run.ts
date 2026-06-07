import { evaluate } from "@denoweave/evaluator/evaluator.ts";
import { parse, serialize } from "@denoweave/adapters/index.ts";

try {
  // Resolve paths relative to this file
  const scriptPath = new URL("./transform.dwl", import.meta.url);
  const payloadPath = new URL("./input.csv", import.meta.url);

  const script = Deno.readTextFileSync(scriptPath);
  const rawCsv = Deno.readTextFileSync(payloadPath);

  // Parse the CSV input into a native JS structure
  const payload = parse(rawCsv, 'csv');

  const attributes = {
    method: "POST",
    requestPath: "/employees",
    headers: {
      "content-type": "text/csv",
      "accept": "application/xml",
    },
    queryParams: {},
  };

  const vars = {};

  // Execute using our engine — payload is injected
  const result = evaluate(script, { payload, attributes, vars });

  // Serialize the result into XML
  const outputXml = serialize(result, 'xml', { indent: 2 });
  console.log(outputXml);

  // Ask if the user wants to generate the output file
  const answer = prompt("\nDo you want to generate the output file? (y/n):");
  if (answer && ["y", "yes"].includes(answer.trim().toLowerCase())) {
    const outputPath = new URL("./output.xml", import.meta.url);
    Deno.writeTextFileSync(outputPath, outputXml);
    console.log(`Output file successfully generated at: ${outputPath.pathname}`);
  }
} catch (error) {
  console.error("Error executing the script:", error);
}
