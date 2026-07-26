/**
 * DenoWeave Playground — HTTP Backend
 *
 * Run: deno run --allow-net --allow-read playground/server.ts
 */

import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import type { Value } from '@denoweave/evaluator/environment.ts';
import { type Format, parse, serialize } from '@denoweave/adapters/index.ts';

const PORT = 8787;
const TIMEOUT_MS = 5_000;
const PLAYGROUND_DIR = new URL('.', import.meta.url);

// ── CORS helpers ───────────────────────────────────────────────────────────────

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ── Evaluate handler ───────────────────────────────────────────────────────────

async function handleEvaluate(req: Request): Promise<Response> {
  let body: { code?: string; payloadText?: string; payloadFormat?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { code = '', payloadText = 'null', payloadFormat = 'json' } = body;

  if (typeof code !== 'string' || code.trim() === '') {
    return json({
      error: 'Field "code" is required and must be a non-empty string',
    }, 400);
  }

  let payloadValue: Value = null;
  if (payloadText.trim() !== 'null' && payloadText.trim() !== '') {
    try {
      payloadValue = parse(payloadText, payloadFormat as Format);
    } catch (e) {
      return json({
        error: `Failed to parse payload as ${payloadFormat}: ${
          (e as Error).message
        }`,
      }, 400);
    }
  }

  // Run with a hard timeout to prevent infinite loops
  let result: Value;
  let format = 'json';
  const match = code.match(/output\s+(application|text)\/(xml|csv|yaml|json)/i);
  if (match) {
    format = match[2].toLowerCase();
  }

  try {
    const evaluatePromise = new Promise<Value>((resolve, reject) => {
      try {
        const res = evaluate(
          code,
          { payload: payloadValue },
          {
            moduleResolver: (moduleName: string) => {
              const relPath = moduleName.replace(/::/g, '/') + '.dwl';
              const pathsToTry = [
                relPath,
                `examples/modules/${relPath}`,
              ];
              for (const p of pathsToTry) {
                try {
                  return Deno.readTextFileSync(p);
                } catch {
                  // ignore
                }
              }
              throw new Error(`Could not resolve module: ${moduleName}`);
            },
          },
        );
        resolve(res);
      } catch (e) {
        reject(e);
      }
    });

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Execution timed out (5s limit)')),
        TIMEOUT_MS,
      )
    );

    result = await Promise.race([evaluatePromise, timeout]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 422);
  }

  let serialized = '';
  try {
    serialized = serialize(result, format as Format, { indent: 2 });
  } catch (_err) {
    serialized = JSON.stringify(result, null, 2);
  }

  return json({ result: serialized, format });
}

// ── Static file handler ────────────────────────────────────────────────────────

async function handleStatic(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;

  // Security: prevent path traversal
  if (pathname.includes('..')) {
    return new Response('Forbidden', { status: 403 });
  }

  const filePath = new URL('.' + pathname, PLAYGROUND_DIR);

  try {
    const content = await Deno.readFile(filePath);
    const ext = pathname.split('.').pop() ?? '';
    const mimeTypes: Record<string, string> = {
      html: 'text/html; charset=utf-8',
      js: 'application/javascript',
      css: 'text/css',
      json: 'application/json',
      svg: 'image/svg+xml',
    };
    return new Response(content, {
      headers: {
        'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
        ...corsHeaders(),
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}

async function handleExamples(_req: Request): Promise<Response> {
  const examplesDir = new URL('../examples/', import.meta.url);
  const examples: Record<
    string,
    { script: string; payload: string; payloadFormat: string }
  > = {};

  try {
    const ignoreList = ['connectors', 'pipeline', 'http-server', 'scratch'];

    for await (const entry of Deno.readDir(examplesDir)) {
      if (entry.isDirectory && !ignoreList.includes(entry.name)) {
        const examplePath = new URL(`${entry.name}/`, examplesDir);
        let script = '';
        let payload = 'null';

        let payloadFormat = 'json';

        try {
          script = await Deno.readTextFile(
            new URL('transform.dwl', examplePath),
          );
        } catch {
          try {
            script = await Deno.readTextFile(new URL('main.dwl', examplePath));
          } catch {
            continue; // skip if no transform.dwl or main.dwl
          }
        }

        try {
          payload = await Deno.readTextFile(new URL('input.json', examplePath));
        } catch {
          try {
            payload = await Deno.readTextFile(
              new URL('input.csv', examplePath),
            );
            payloadFormat = 'csv';
          } catch {
            try {
              payload = await Deno.readTextFile(
                new URL('input.xml', examplePath),
              );
              payloadFormat = 'xml';
            } catch {
              // ignore, keep payload as 'null'
            }
          }
        }

        examples[entry.name] = { script, payload, payloadFormat };
      }
    }
    return json(examples);
  } catch (_err) {
    return json({ error: 'Failed to read examples' }, 500);
  }
}

// ── Main router ────────────────────────────────────────────────────────────────

Deno.serve({
  port: PORT,
  onListen: ({ port }) => {
    console.log(
      `\n🦕 DenoWeave Playground running at http://localhost:${port}\n`,
    );
  },
}, async (req: Request): Promise<Response> => {
  const url = new URL(req.url);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (url.pathname === '/evaluate' && req.method === 'POST') {
    return await handleEvaluate(req);
  }

  if (url.pathname === '/examples' && req.method === 'GET') {
    return await handleExamples(req);
  }

  return await handleStatic(req);
});
