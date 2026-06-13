# DenoWeave Pipeline Orchestration

This example demonstrates how to build a **fluent, Docs-as-Code integration
pipeline** around the DenoWeave engine.

Instead of defining integration flows in heavy XML files (like traditional ESBs
such as MuleSoft), this approach allows developers to orchestrate integrations
programmatically using modern, type-safe TypeScript.

## The Architecture

The pipeline follows a classic ETL (Extract, Transform, Load) pattern using a
fluent builder API:

1. **`.from()`**: The source connector. It fetches raw data from anywhere (e.g.,
   HTTP APIs, databases, files).
2. **`.transform()`**: The DenoWeave component. It takes a `.dwl` file path and
   processes the incoming payload.
3. **`.to()`**: The destination connector. It receives the transformed data and
   sends it to the target system.

### Example Syntax:

```typescript
const flow = new Pipeline()
  .from(fetchPosts)
  .transform('./transform.dwl')
  .to(saveToDatabase);

await flow.execute();
```

## How to run

Simply execute the `run.ts` file granting network permission (to access the
external API) and read permission (to read the `.dwl` script):

```bash
deno run --allow-net --allow-read run.ts
```
