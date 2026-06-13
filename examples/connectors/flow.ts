import { evaluate } from '../../src/evaluator/evaluator.ts';

// ============================================================================
// 1. THE "CONNECTOR" (e.g. HTTP Request Connector in Mule)
// A native TypeScript async function that fetches the raw data.
// ============================================================================
async function fetchUsers() {
  console.log(
    '📡 [Connector] Fetching raw data from public API (jsonplaceholder)...',
  );
  const response = await fetch('https://jsonplaceholder.typicode.com/users');
  if (!response.ok) throw new Error('API request failed');
  return await response.json();
}

// ============================================================================
// 2. THE "FLOW" (Mule Flow)
// Orchestrates the Connector -> DataWeave -> Output sequence
// ============================================================================
async function main() {
  try {
    // Step 1: Use the connector to get the Original Payload
    const rawPayload = await fetchUsers();
    console.log(`📦 [Flow] Received ${rawPayload.length} users from the API.`);

    // Step 2: The "Transform Message" component (DenoWeave) steps in
    console.log('⚙️  [DataWeave] Processing transformation rules...');
    const scriptPath = new URL('./transform.dwl', import.meta.url);
    const script = Deno.readTextFileSync(scriptPath);

    // Inject the payload from the connector directly into the engine
    const result = evaluate(script, {
      payload: rawPayload,
      attributes: {},
      vars: {},
    });

    // Step 3: The result could be sent to a "Database Connector"
    // Here we'll just simulate the end of the flow by logging it.
    console.log('\n✅ [Flow] Final Transformed Result (Showing first 3):');
    console.log(JSON.stringify((result as unknown[]).slice(0, 3), null, 2));
  } catch (error) {
    console.error('❌ Flow error:', error);
  }
}

// Start the flow
main();
