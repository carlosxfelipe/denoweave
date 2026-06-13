# DenoWeave Connectors Example

This example demonstrates how the concept of "Connectors" and "Flows" from
MuleSoft can be easily recreated using pure TypeScript with the DenoWeave
engine.

Here, we simulate an integration flow (ETL):

1. **Extract:** An "HTTP Connector" performs a native `fetch` in Deno to
   retrieve data from a public API.
2. **Transform:** DenoWeave receives this raw data and converts it into a
   simplified contacts model using `transform.dwl`.
3. **Load:** The flow logs the final data (which could easily be sent to another
   connector, like a Database).

## How to run

Simply execute the `flow.ts` file granting network permission (to access the
external API) and read permission (to read the `.dwl` file):

```bash
deno run --allow-net --allow-read flow.ts
```
