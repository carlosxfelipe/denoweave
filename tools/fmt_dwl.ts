#!/usr/bin/env -S deno run --allow-read --allow-write
/**
 * DenoWeave DWL Formatter CLI
 *
 * Usage:
 *   deno task fmt:dwl               # formats all *.dwl files in the project
 *   deno task fmt:dwl --check       # exits with code 1 if any file would change
 *   deno task fmt:dwl path/to/file  # formats a specific file
 */

import { format } from '@denoweave/formatter/fmt.ts';
import { walk } from 'jsr:@std/fs@^1.0.0/walk';

const args = Deno.args;
const checkMode = args.includes('--check');
const explicitFiles = args.filter((a) => !a.startsWith('--'));

async function processFile(path: string): Promise<boolean> {
  const original = await Deno.readTextFile(path);
  const formatted = format(original);

  if (original === formatted) return false; // no change

  if (checkMode) {
    console.log(`Would format: ${path}`);
    return true;
  }

  await Deno.writeTextFile(path, formatted);
  console.log(`Formatted: ${path}`);
  return true;
}

let changed = 0;
let total = 0;

if (explicitFiles.length > 0) {
  for (const file of explicitFiles) {
    total++;
    if (await processFile(file)) changed++;
  }
} else {
  for await (
    const entry of walk('.', {
      exts: ['dwl'],
      skip: [/node_modules/, /\.git/],
    })
  ) {
    if (entry.isFile) {
      total++;
      if (await processFile(entry.path)) changed++;
    }
  }
}

if (checkMode && changed > 0) {
  console.error(`\n${changed} file(s) would be reformatted.`);
  Deno.exit(1);
}

console.log(
  `\nChecked ${total} file(s)${
    changed > 0 ? `, formatted ${changed}` : ', no changes'
  }.`,
);
