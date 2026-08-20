#!/usr/bin/env -S deno run --allow-read
/**
 * DenoWeave — CLI entry point
 *
 * Run with:
 *   deno run --allow-read src/cli/main.ts --help
 */

import { detectFormat, HELP_TEXT, parseArgs, VERSION } from './args.ts';
import { evaluate } from '../evaluator/evaluator.ts';
import { parse, serialize } from '../adapters/index.ts';
import { setProperties } from '../stdlib/index.ts';
import type { Format } from '../adapters/index.ts';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);

  // ── Help / version ─────────────────────────────────────────────────────────
  if (args.help) {
    console.log(HELP_TEXT);
    Deno.exit(0);
  }

  if (args.version) {
    console.log(`denoweave v${VERSION}`);
    Deno.exit(0);
  }

  // ── Resolve the DSL expression / script ───────────────────────────────────
  let expression: string | null = args.expr;

  if (!expression && args.script) {
    try {
      expression = await Deno.readTextFile(args.script);
    } catch (e) {
      die(`Cannot read script file "${args.script}": ${(e as Error).message}`);
    }
  }

  if (!expression) {
    die(
      'No expression provided. Use --expr "<dsl>" or --script <file>.\nRun with --help for usage.',
    );
  }

  // ── Read input data ────────────────────────────────────────────────────────
  let rawInput: string;

  if (!args.input || args.input === '-') {
    // Read from stdin
    rawInput = await readStdin();
  } else {
    try {
      rawInput = await Deno.readTextFile(args.input);
    } catch (e) {
      die(`Cannot read input file "${args.input}": ${(e as Error).message}`);
    }
  }

  // ── Detect / resolve input format ─────────────────────────────────────────
  const inFmt = (args.inFormat ??
    (args.input && args.input !== '-' ? detectFormat(args.input) : null) ??
    'json') as Format;

  // ── Parse input ────────────────────────────────────────────────────────────
  let payload: unknown;
  try {
    payload = parse(rawInput!, inFmt, { delimiter: args.delimiter });
  } catch (e) {
    die(
      `Failed to parse ${inFmt.toUpperCase()} input: ${(e as Error).message}`,
    );
  }

  // ── Load properties file for p() ─────────────────────────────────────────
  if (args.props) {
    try {
      const propsContent = await Deno.readTextFile(args.props);
      const ext = args.props.split('.').pop()?.toLowerCase();
      let propsMap: Record<string, string> = {};
      if (ext === 'json') {
        propsMap = JSON.parse(propsContent) as Record<string, string>;
      } else if (ext === 'yaml' || ext === 'yml') {
        // Simple YAML key: value parser (no deps)
        for (const line of propsContent.split('\n')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx < 0 || line.trimStart().startsWith('#')) continue;
          const k = line.slice(0, colonIdx).trim();
          const v = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
          if (k) propsMap[k] = v;
        }
      } else {
        // .properties format: key=value
        for (const line of propsContent.split('\n')) {
          const eqIdx = line.indexOf('=');
          if (eqIdx < 0 || line.trimStart().startsWith('#')) continue;
          const k = line.slice(0, eqIdx).trim();
          const v = line.slice(eqIdx + 1).trim();
          if (k) propsMap[k] = v;
        }
      }
      setProperties(propsMap);
    } catch (e) {
      die(`Cannot read props file "${args.props}": ${(e as Error).message}`);
    }
  }

  // ── Build vars object from --var flags ──────────────────────────────────
  const varsObject: Record<string, unknown> = {};
  for (const entry of args.vars) {
    const eqIdx = entry.indexOf('=');
    if (eqIdx < 0) {
      die(`--var must be in key=value format, got: "${entry}"`);
    }
    const k = entry.slice(0, eqIdx);
    const rawVal = entry.slice(eqIdx + 1);
    try {
      // Try JSON parse first (handles objects, arrays, numbers, booleans)
      varsObject[k] = JSON.parse(rawVal);
    } catch {
      // Plain string
      varsObject[k] = rawVal;
    }
  }

  // ── Extract `output` directive from script header ──────────────────────────
  let scriptOutFormat: string | null = null;
  if (expression) {
    const outputMatch = expression.match(
      /^output\s+(application|text)\/([\w-]+)/m,
    );
    if (outputMatch) {
      const mime = `${outputMatch[1]}/${outputMatch[2]}`;
      if (mime.includes('json')) scriptOutFormat = 'json';
      else if (mime.includes('xml')) scriptOutFormat = 'xml';
      else if (mime.includes('csv')) scriptOutFormat = 'csv';
      else if (mime.includes('yaml') || mime.includes('yml')) {
        scriptOutFormat = 'yaml';
      }
    }
  }

  // ── Evaluate DSL ────────────────────────────────────────────────────────
  let result: unknown;
  try {
    result = evaluate(expression!, {
      payload: payload as import('../evaluator/environment.ts').Value,
      ...(Object.keys(varsObject).length > 0
        ? { vars: varsObject as import('../evaluator/environment.ts').Value }
        : {}),
    });
  } catch (e) {
    die(`Evaluation error: ${(e as Error).message}`);
  }

  // ── Serialize output ───────────────────────────────────────────────────────
  // Use explicit --out flag > script's output directive > default (json)
  const outFmt =
    (args.outFormat !== 'json'
      ? args.outFormat
      : scriptOutFormat ?? args.outFormat) as Format;
  let output: string;
  try {
    output = serialize(
      result as import('../evaluator/environment.ts').Value,
      outFmt,
      { indent: args.pretty ? args.indent : 0, delimiter: args.delimiter },
    );
  } catch (e) {
    die(
      `Failed to serialize ${outFmt.toUpperCase()} output: ${
        (e as Error).message
      }`,
    );
  }

  console.log(output!);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }
  const total = new Uint8Array(chunks.reduce((a, c) => a + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    total.set(chunk, offset);
    offset += chunk.length;
  }
  return decoder.decode(total);
}

function die(message: string): never {
  console.error(`\x1b[31mError:\x1b[0m ${message}`);
  Deno.exit(1);
}

// ── Entry ─────────────────────────────────────────────────────────────────────

main();
