# DenoWeave HTTP Server Example

This example demonstrates how to use DenoWeave as a high-performance HTTP API Server, acting much like an HTTP Listener in Mule. It accepts incoming JSON payloads, processes them through a `.dwl` script on the fly, and returns the transformed JSON.

## How to run

1. Start the server (make sure you allow network and read permissions):
```bash
deno run --allow-net --allow-read server.ts
```

2. Open another terminal window and send a POST request using `curl`:
```bash
curl -X POST http://localhost:8088 \
  -H "Content-Type: application/json" \
  -d '{"user": "Carlos", "age": 38}'
```

You should instantly receive a response transformed by the `transform.dwl` script!
