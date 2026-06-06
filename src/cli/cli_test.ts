import { assertEquals } from '@std/assert';
import { parseArgs, detectFormat } from './args.ts';

// ── parseArgs ─────────────────────────────────────────────────────────────────

Deno.test('CLI args: --help flag', () => {
  const args = parseArgs(['--help']);
  assertEquals(args.help, true);
});

Deno.test('CLI args: -h short flag', () => {
  assertEquals(parseArgs(['-h']).help, true);
});

Deno.test('CLI args: --version flag', () => {
  assertEquals(parseArgs(['--version']).version, true);
});

Deno.test('CLI args: --input and --expr', () => {
  const args = parseArgs(['--input', 'data.json', '--expr', 'payload.users']);
  assertEquals(args.input, 'data.json');
  assertEquals(args.expr, 'payload.users');
});

Deno.test('CLI args: -i and -e short flags', () => {
  const args = parseArgs(['-i', 'data.csv', '-e', 'payload map ((r) -> r.name)']);
  assertEquals(args.input, 'data.csv');
  assertEquals(args.expr, 'payload map ((r) -> r.name)');
});

Deno.test('CLI args: --script', () => {
  const args = parseArgs(['--script', 'transform.dw']);
  assertEquals(args.script, 'transform.dw');
});

Deno.test('CLI args: --in / --out formats', () => {
  const args = parseArgs(['--in', 'csv', '--out', 'xml']);
  assertEquals(args.inFormat, 'csv');
  assertEquals(args.outFormat, 'xml');
});

Deno.test('CLI args: -o short flag', () => {
  assertEquals(parseArgs(['-o', 'yaml']).outFormat, 'yaml');
});

Deno.test('CLI args: --indent', () => {
  assertEquals(parseArgs(['--indent', '4']).indent, 4);
});

Deno.test('CLI args: --delimiter', () => {
  assertEquals(parseArgs(['--delimiter', ';']).delimiter, ';');
});

Deno.test('CLI args: --no-pretty', () => {
  assertEquals(parseArgs(['--no-pretty']).pretty, false);
});

Deno.test('CLI args: positional input file', () => {
  assertEquals(parseArgs(['data.json']).input, 'data.json');
});

Deno.test('CLI args: defaults', () => {
  const args = parseArgs([]);
  assertEquals(args.input, null);
  assertEquals(args.expr, null);
  assertEquals(args.script, null);
  assertEquals(args.inFormat, null);
  assertEquals(args.outFormat, 'json');
  assertEquals(args.indent, 2);
  assertEquals(args.delimiter, ',');
  assertEquals(args.help, false);
  assertEquals(args.version, false);
  assertEquals(args.pretty, true);
});

// ── detectFormat ──────────────────────────────────────────────────────────────

Deno.test('CLI detectFormat: .json', () => {
  assertEquals(detectFormat('data.json'), 'json');
});

Deno.test('CLI detectFormat: .csv', () => {
  assertEquals(detectFormat('users.csv'), 'csv');
});

Deno.test('CLI detectFormat: .xml', () => {
  assertEquals(detectFormat('config.xml'), 'xml');
});

Deno.test('CLI detectFormat: .yaml', () => {
  assertEquals(detectFormat('config.yaml'), 'yaml');
});

Deno.test('CLI detectFormat: .yml', () => {
  assertEquals(detectFormat('config.yml'), 'yaml');
});

Deno.test('CLI detectFormat: unknown extension returns null', () => {
  assertEquals(detectFormat('data.txt'), null);
  assertEquals(detectFormat('noext'), null);
});
