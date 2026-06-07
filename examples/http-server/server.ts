import { evaluate } from "@denoweave/evaluator/evaluator.ts";

// 1. Load the DataWeave script into memory
const scriptPath = new URL("./transform.dwl", import.meta.url);
const script = Deno.readTextFileSync(scriptPath);

console.log("🚀 DenoWeave API Server running at http://localhost:8088");
console.log("💡 Try sending a POST request with JSON to this address!");
console.log("   Example: curl -X POST http://localhost:8088 -d '{\"user\":\"Carlos\", \"age\": 38}'\n");

// 2. Start a high-performance HTTP server
Deno.serve({ port: 8088 }, async (req) => {
  // Only accept POST requests
  if (req.method === "POST") {
    try {
      // Parse the incoming request body as JSON
      const payload = await req.json();
      
      // Transform the payload using the DenoWeave engine
      const result = evaluate(script, { 
        payload, 
        attributes: { method: req.method, url: req.url }, 
        vars: {} 
      });
      
      // Return the transformed JSON with status 200
      return Response.json(result, { status: 200 });

    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 500 });
    }
  }

  // Handle non-POST requests
  return new Response("DenoWeave Server is active. Please send a POST request with a JSON payload.", { status: 405 });
});
