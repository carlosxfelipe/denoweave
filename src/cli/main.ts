#!/usr/bin/env -S deno run --allow-read
/**
 * DenoWeave — CLI entry point
 *
 * Run with:
 *   deno run --allow-read src/cli/main.ts --help
 */

import { detectFormat, HELP_TEXT, parseArgs, VERSION } from './args.ts';
import { evaluate, splitMultiOutputScript } from '../evaluator/evaluator.ts';
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

  // ── Parse output targets ────────────────────────────────────────────────
  const targetMap = new Map<number, string>();
  for (const t of args.targets) {
    const splitIdx = t.indexOf(':');
    if (splitIdx < 0) {
      die(`--target must be in <idx>:<file> format, got: "${t}"`);
    }
    const idx = parseInt(t.slice(0, splitIdx), 10);
    if (isNaN(idx) || idx < 1) {
      die(
        `--target index must be a positive integer, got: "${
          t.slice(0, splitIdx)
        }"`,
      );
    }
    targetMap.set(idx, t.slice(splitIdx + 1));
  }

  // ── Split script into output blocks (multi-output support) ────────────────
  const outputBlocks = splitMultiOutputScript(expression!);
  const isMultiOutput = outputBlocks.length > 1;

  // Use explicit --out flag as override only for single-output scripts
  const cliOutFmt = args.outFormat as Format;

  const outputs: string[] = [];

  for (const [i, block] of outputBlocks.entries()) {
    // ── Evaluate DSL block ────────────────────────────────────────────────
    let result: unknown;
    try {
      result = evaluate(block.source, {
        payload: payload as import('../evaluator/environment.ts').Value,
        ...(Object.keys(varsObject).length > 0
          ? { vars: varsObject as import('../evaluator/environment.ts').Value }
          : {}),
      });
    } catch (e) {
      die(`Evaluation error: ${(e as Error).message}`);
    }

    // ── Resolve output format ─────────────────────────────────────────────
    // Multi-output: each block uses its own declared format (--out ignored)
    // Single-output: --out > script directive > default json
    let outFmt: Format;
    if (isMultiOutput) {
      outFmt = block.format as Format;
    } else {
      // Extract `output` directive from script header for single-output
      let scriptOutFormat: string | null = null;
      const outputMatch = block.source.match(
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
      outFmt = (cliOutFmt !== 'json'
        ? cliOutFmt
        : scriptOutFormat ?? cliOutFmt) as Format;
    }

    // ── Serialize ─────────────────────────────────────────────────────────
    let serialized: string;
    try {
      serialized = serialize(
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

    // ── Route Output ──────────────────────────────────────────────────────
    const targetFile = targetMap.get(i + 1);
    if (targetFile) {
      try {
        Deno.writeTextFileSync(targetFile, serialized);
        console.error(`Output ${i + 1} (${outFmt}) written to: ${targetFile}`);
      } catch (e) {
        if (e instanceof Deno.errors.PermissionDenied) {
          die(
            `Permission denied writing to ${targetFile}. Please run with --allow-write.`,
          );
        }
        die(`Failed writing to ${targetFile}: ${(e as Error).message}`);
      }
    } else {
      outputs.push(serialized);
    }
  }

  if (outputs.length > 0) {
    console.log(outputs.join('\n\n'));
  }
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
