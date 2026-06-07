import { Pipeline } from "./pipeline.ts";

// ============================================================================
// CONNECTORS DEFINITION
// ============================================================================

// A mock "HTTP Request Connector"
async function fetchPosts() {
  const response = await fetch("https://jsonplaceholder.typicode.com/posts");
  const data = await response.json();
  // Let's grab only 3 posts to keep our terminal clean
  return data.slice(0, 3);
}

// A mock "Database Insert Connector" or "Logger Connector"
function saveToDatabase(data: unknown) {
  console.log("\n✅ [Database] Data successfully saved!");
  console.log(JSON.stringify(data, null, 2));
}

// ============================================================================
// PIPELINE ORCHESTRATION (Docs-as-Code)
// ============================================================================

console.log("🚀 Starting Integration Pipeline...\n");

// Look how elegant and readable the flow becomes!
const flow = new Pipeline()
  .from(fetchPosts)
  .transform("./transform.dwl")
  .to(saveToDatabase);

// Execute the pipeline
await flow.execute();

console.log("\n🎉 Pipeline execution finished!");
