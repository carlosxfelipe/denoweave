/**
 * DenoWeave Playground — HTTP Backend
 *
 * Run: deno run --allow-net --allow-read playground/server.ts
 */

import { evaluate } from '@denoweave/evaluator/evaluator.ts';
import type { Value } from '@denoweave/evaluator/environment.ts';
import { type Format, parse, serialize } from '@denoweave/adapters/index.ts';
import { parseXLSX, toXLSX } from '@denoweave/adapters/xlsx.ts';
import { format } from '@denoweave/formatter/fmt.ts';

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

// ── Output format detection ────────────────────────────────────────────────────

const OUTPUT_FORMAT_PATTERNS: Array<[RegExp, string]> = [
  [/output\s+application\/json/i, 'json'],
  [/output\s+application\/xml/i, 'xml'],
  [/output\s+text\/xml/i, 'xml'],
  [/output\s+application\/csv/i, 'csv'],
  [/output\s+text\/csv/i, 'csv'],
  [/output\s+application\/yaml/i, 'yaml'],
  [/output\s+text\/yaml/i, 'yaml'],
  [/output\s+text\/plain/i, 'text'],
  [/output\s+application\/ndjson/i, 'ndjson'],
  [/output\s+application\/x-ndjson/i, 'ndjson'],
  [/output\s+application\/x-www-form-urlencoded/i, 'urlencoded'],
  [/output\s+multipart\/form-data/i, 'multipart'],
  [/output\s+application\/dw/i, 'dw'],
  [
    /output\s+application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i,
    'xlsx',
  ],
  [/output\s+application\/xlsx/i, 'xlsx'],
];

function detectOutputFormat(code: string): string {
  for (const [pattern, fmt] of OUTPUT_FORMAT_PATTERNS) {
    if (pattern.test(code)) return fmt;
  }
  return 'json';
}

// ── Evaluate handler ───────────────────────────────────────────────────────────

async function handleEvaluate(req: Request): Promise<Response> {
  let body: {
    code?: string;
    payloadText?: string;
    payloadFormat?: string;
    payloadBase64?: string; // for binary formats (xlsx)
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const {
    code = '',
    payloadText = 'null',
    payloadFormat = 'json',
    payloadBase64,
  } = body;

  if (typeof code !== 'string' || code.trim() === '') {
    return json({
      error: 'Field "code" is required and must be a non-empty string',
    }, 400);
  }

  // ── Parse payload ────────────────────────────────────────────────────────────
  let payloadValue: Value = null;
  const fmt = payloadFormat.toLowerCase();

  if (fmt === 'xlsx') {
    // XLSX: payload arrives as base64
    if (payloadBase64) {
      try {
        const binaryStr = atob(payloadBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        payloadValue = await parseXLSX(bytes);
      } catch (e) {
        return json({
          error: `Failed to parse XLSX payload: ${(e as Error).message}`,
        }, 400);
      }
    }
  } else if (payloadText.trim() !== 'null' && payloadText.trim() !== '') {
    try {
      payloadValue = parse(payloadText, fmt as Format);
    } catch (e) {
      return json({
        error: `Failed to parse payload as ${fmt}: ${(e as Error).message}`,
      }, 400);
    }
  }

  // ── Detect output format ─────────────────────────────────────────────────────
  const outputFormat = detectOutputFormat(code);

  // ── Evaluate ─────────────────────────────────────────────────────────────────
  let result: Value;

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

  // ── Serialize output ─────────────────────────────────────────────────────────

  if (outputFormat === 'xlsx') {
    // Return base64-encoded XLSX bytes
    try {
      const xlsxBytes = await toXLSX(result);
      const base64 = btoa(String.fromCharCode(...xlsxBytes));
      return json({ result: base64, format: 'xlsx', binary: true });
    } catch (err) {
      return json({
        error: `Failed to serialize as XLSX: ${(err as Error).message}`,
      }, 422);
    }
  }

  let serialized = '';
  try {
    serialized = serialize(result, outputFormat as Format, { indent: 2 });
  } catch (_err) {
    serialized = JSON.stringify(result, null, 2);
  }

  return json({ result: serialized, format: outputFormat });
}

// ── Format handler ─────────────────────────────────────────────────────────────

async function handleFormat(req: Request): Promise<Response> {
  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { code = '' } = body;

  if (typeof code !== 'string') {
    return json({
      error: 'Field "code" is required and must be a string',
    }, 400);
  }

  try {
    const formatted = format(code);
    return json({ result: formatted });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 422);
  }
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
              try {
                payload = await Deno.readTextFile(
                  new URL('input.yaml', examplePath),
                );
                payloadFormat = 'yaml';
              } catch {
                // ignore, keep payload as 'null'
              }
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

  if (url.pathname === '/format' && req.method === 'POST') {
    return await handleFormat(req);
  }

  if (url.pathname === '/examples' && req.method === 'GET') {
    return await handleExamples(req);
  }

  return await handleStatic(req);
});
