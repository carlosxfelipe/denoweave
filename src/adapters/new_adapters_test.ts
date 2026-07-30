import { assertEquals, assertThrows } from '@std/assert';
import { parseNDJSON, toNDJSON } from './ndjson.ts';
import { parseText, toText } from './text.ts';
import { parseURLEncoded, toURLEncoded } from './urlencoded.ts';
import { parseMultipart, toMultipart } from './multipart.ts';
import { parseDW, toDW } from './dw.ts';
import { parseXLSX, toXLSX } from './xlsx.ts';
import { parse, serialize } from './index.ts';
import { evaluate } from '../evaluator/evaluator.ts';

// ── NDJSON ────────────────────────────────────────────────────────────────────

Deno.test('Adapter NDJSON: parse multiple lines', () => {
  const ndjson = '{"a":1}\n{"b":2}\n{"c":3}';
  const result = parseNDJSON(ndjson) as Record<string, unknown>[];
  assertEquals(result.length, 3);
  assertEquals(result[0]['a'], 1);
  assertEquals(result[1]['b'], 2);
  assertEquals(result[2]['c'], 3);
});

Deno.test('Adapter NDJSON: parse skips blank lines', () => {
  const ndjson = '{"x":1}\n\n{"y":2}\n';
  const result = parseNDJSON(ndjson) as unknown[];
  assertEquals(result.length, 2);
});

Deno.test('Adapter NDJSON: parse single line', () => {
  assertEquals(parseNDJSON('"hello"'), ['hello']);
});

Deno.test('Adapter NDJSON: serialize array', () => {
  const result = toNDJSON([{ a: 1 }, { b: 2 }]);
  assertEquals(result, '{"a":1}\n{"b":2}');
});

Deno.test('Adapter NDJSON: serialize non-array wraps as single line', () => {
  assertEquals(toNDJSON({ x: 1 }), '{"x":1}');
});

Deno.test('Adapter NDJSON: roundtrip', () => {
  const original = [{ name: 'Alice', score: 95 }, { name: 'Bob', score: 72 }];
  const parsed = parseNDJSON(toNDJSON(original)) as typeof original;
  assertEquals(parsed[0].name, 'Alice');
  assertEquals(parsed[1].score, 72);
});

// ── TEXT ──────────────────────────────────────────────────────────────────────

Deno.test('Adapter TEXT: parse returns string as-is', () => {
  assertEquals(parseText('Hello, World!'), 'Hello, World!');
  assertEquals(parseText(''), '');
  assertEquals(parseText('  spaces  '), '  spaces  ');
});

Deno.test('Adapter TEXT: serialize string passes through', () => {
  assertEquals(toText('Hello'), 'Hello');
});

Deno.test('Adapter TEXT: serialize converts numbers', () => {
  assertEquals(toText(42), '42');
  assertEquals(toText(3.14), '3.14');
});

Deno.test('Adapter TEXT: serialize converts booleans', () => {
  assertEquals(toText(true), 'true');
  assertEquals(toText(false), 'false');
});

Deno.test('Adapter TEXT: serialize null returns empty string', () => {
  assertEquals(toText(null), '');
});

Deno.test('Adapter TEXT: roundtrip', () => {
  const s = 'line 1\nline 2\nline 3';
  assertEquals(parseText(toText(s)), s);
});

// ── URLENCODED ────────────────────────────────────────────────────────────────

Deno.test('Adapter URLENCODED: parse simple fields', () => {
  const result = parseURLEncoded('name=Alice&age=30') as Record<
    string,
    unknown
  >;
  assertEquals(result['name'], 'Alice');
  assertEquals(result['age'], '30');
});

Deno.test('Adapter URLENCODED: parse multiple values same key', () => {
  const result = parseURLEncoded('tag=admin&tag=user') as Record<
    string,
    unknown
  >;
  assertEquals(result['tag'], ['admin', 'user']);
});

Deno.test('Adapter URLENCODED: parse percent-encoded values', () => {
  const result = parseURLEncoded('q=hello+world&msg=foo%20bar') as Record<
    string,
    unknown
  >;
  assertEquals(result['q'], 'hello world');
  assertEquals(result['msg'], 'foo bar');
});

Deno.test('Adapter URLENCODED: parse empty string', () => {
  assertEquals(parseURLEncoded(''), {});
});

Deno.test('Adapter URLENCODED: serialize object', () => {
  const result = toURLEncoded({ name: 'Bob', score: 95 });
  // URLSearchParams order may vary, so check inclusion
  assertEquals(result.includes('name=Bob'), true);
  assertEquals(result.includes('score=95'), true);
});

Deno.test('Adapter URLENCODED: serialize array values', () => {
  const result = toURLEncoded({ tags: ['admin', 'user'] });
  assertEquals(result.includes('tags=admin'), true);
  assertEquals(result.includes('tags=user'), true);
});

Deno.test('Adapter URLENCODED: roundtrip', () => {
  const original = { name: 'Alice', city: 'São Paulo' };
  const encoded = toURLEncoded(original);
  const parsed = parseURLEncoded(encoded) as Record<string, unknown>;
  assertEquals(parsed['name'], 'Alice');
  assertEquals(parsed['city'], 'São Paulo');
});

// ── MULTIPART ─────────────────────────────────────────────────────────────────

const SAMPLE_MULTIPART =
  '--boundary\r\nContent-Disposition: form-data; name="field1"\r\n\r\nhello world\r\n' +
  '--boundary\r\nContent-Disposition: form-data; name="field2"\r\n\r\nfoo bar\r\n' +
  '--boundary--';

Deno.test('Adapter MULTIPART: parse parts', () => {
  const result = parseMultipart(SAMPLE_MULTIPART, 'boundary') as {
    parts: Record<string, { headers: Record<string, string>; content: string }>;
  };
  assertEquals(result.parts['field1'].content, 'hello world');
  assertEquals(result.parts['field2'].content, 'foo bar');
});

Deno.test('Adapter MULTIPART: parse auto-detects boundary', () => {
  const result = parseMultipart(SAMPLE_MULTIPART) as {
    parts: Record<string, { content: string }>;
  };
  assertEquals(result.parts['field1'].content, 'hello world');
});

Deno.test('Adapter MULTIPART: parse preserves headers', () => {
  const result = parseMultipart(SAMPLE_MULTIPART, 'boundary') as {
    parts: Record<string, { headers: Record<string, string> }>;
  };
  const headers = result.parts['field1'].headers;
  assertEquals(
    headers['content-disposition'],
    'form-data; name="field1"',
  );
});

Deno.test('Adapter MULTIPART: serialize plain object', () => {
  const { body, boundary } = toMultipart({ key: 'value' });
  assertEquals(body.includes(`--${boundary}`), true);
  assertEquals(body.includes('name="key"'), true);
  assertEquals(body.includes('value'), true);
});

Deno.test('Adapter MULTIPART: serialize MultiPart shape', () => {
  const value = {
    parts: {
      greeting: {
        headers: { 'content-disposition': 'form-data; name="greeting"' },
        content: 'Hello!',
      },
    },
  };
  const { body } = toMultipart(value, 'testboundary');
  assertEquals(body.includes('--testboundary'), true);
  assertEquals(body.includes('Hello!'), true);
});

Deno.test('Adapter MULTIPART: throws without recognisable boundary', () => {
  assertThrows(
    () => parseMultipart('not-multipart-at-all'),
    Error,
    'cannot detect boundary',
  );
});

// ── DWL (DataWeave notation) ──────────────────────────────────────────────────

Deno.test('Adapter DW: serialize object with unquoted identifier keys', () => {
  const result = toDW({ name: 'Alice', age: 30 });
  // Keys that are valid identifiers must NOT have quotes
  assertEquals(result.includes('name: "Alice"'), true);
  assertEquals(result.includes('age: 30'), true);
  assertEquals(result.includes('"name"'), false);
});

Deno.test('Adapter DW: serialize object with special keys', () => {
  const result = toDW({ 'Content-Type': 'application/json' });
  // Hyphenated key must be quoted
  assertEquals(result.includes('"Content-Type"'), true);
});

Deno.test('Adapter DW: serialize array', () => {
  const result = toDW([1, 'two', true, null]);
  assertEquals(result.includes('1'), true);
  assertEquals(result.includes('"two"'), true);
  assertEquals(result.includes('true'), true);
  assertEquals(result.includes('null'), true);
});

Deno.test('Adapter DW: serialize booleans and null', () => {
  assertEquals(toDW(true), 'true');
  assertEquals(toDW(false), 'false');
  assertEquals(toDW(null), 'null');
});

Deno.test('Adapter DW: serialize number', () => {
  assertEquals(toDW(42), '42');
  assertEquals(toDW(3.14), '3.14');
});

Deno.test('Adapter DW: serialize ISO date as temporal literal', () => {
  const result = toDW('2024-01-01');
  assertEquals(result, '|2024-01-01|');
});

Deno.test('Adapter DW: serialize ISO period as temporal literal', () => {
  const result = toDW('P1D');
  assertEquals(result, '|P1D|');
});

Deno.test('Adapter DW: serialize regular string with double quotes', () => {
  assertEquals(toDW('hello'), '"hello"');
});

Deno.test('Adapter DW: serialize escapes special chars in strings', () => {
  const result = toDW('say "hi"');
  assertEquals(result, '"say \\"hi\\""');
});

Deno.test('Adapter DW: parse JSON-formatted DW input', () => {
  const parsed = parseDW('{"name":"Alice","age":30}');
  assertEquals(parsed, { name: 'Alice', age: 30 });
});

Deno.test('Adapter DW: parse unquoted-key DW notation', () => {
  const parsed = parseDW('{name: "Alice", age: 30}');
  assertEquals(parsed, { name: 'Alice', age: 30 });
});

Deno.test('Adapter DW: roundtrip object', () => {
  const original = { name: 'Alice', score: 95, active: true };
  const serialized = toDW(original);
  const parsed = parseDW(serialized) as typeof original;
  assertEquals(parsed.name, 'Alice');
  assertEquals(parsed.score, 95);
  assertEquals(parsed.active, true);
});

Deno.test('Adapter DW: roundtrip nested', () => {
  const original = {
    user: { name: 'Bob', tags: ['admin', 'user'] },
    count: 2,
  };
  const parsed = parseDW(toDW(original)) as typeof original;
  assertEquals(parsed.user.name, 'Bob');
  assertEquals(parsed.user.tags.length, 2);
  assertEquals(parsed.count, 2);
});

// ── XLSX ──────────────────────────────────────────────────────────────────────

Deno.test('Adapter XLSX: serialize and parse array of objects', async () => {
  const original = [
    { name: 'Alice', score: 95, pass: true },
    { name: 'Bob', score: 72, pass: false },
    { name: 'Carol', score: 88, pass: true },
  ];
  const bytes = await toXLSX(original);
  assertEquals(bytes instanceof Uint8Array, true);
  // XLSX ZIP must start with PK signature
  assertEquals(bytes[0], 0x50); // P
  assertEquals(bytes[1], 0x4B); // K

  const parsed = await parseXLSX(bytes) as typeof original;
  assertEquals(parsed.length, 3);
  assertEquals(parsed[0].name, 'Alice');
  assertEquals(parsed[0].score, 95);
  assertEquals(parsed[0].pass, true);
  assertEquals(parsed[2].name, 'Carol');
});

Deno.test('Adapter XLSX: serialize and parse array of arrays', async () => {
  const original = [['A', 'B'], [1, 2], [3, 4]];
  const bytes = await toXLSX(original);
  // Without header option, parsed as raw rows
  const parsed = await parseXLSX(bytes, { header: false }) as unknown[][];
  assertEquals(parsed.length, 3);
  assertEquals(parsed[0][0], 'A');
  assertEquals(parsed[1][0], 1);
});

Deno.test('Adapter XLSX: handles null cells', async () => {
  const original = [{ name: 'Alice', note: null }, { name: 'Bob', note: null }];
  const bytes = await toXLSX(original);
  const parsed = await parseXLSX(bytes) as typeof original;
  assertEquals(parsed[0].name, 'Alice');
  assertEquals(parsed[0].note, null);
});

Deno.test('Adapter XLSX: handles boolean values', async () => {
  const original = [{ label: 'yes', flag: true }, { label: 'no', flag: false }];
  const bytes = await toXLSX(original);
  const parsed = await parseXLSX(bytes) as typeof original;
  assertEquals(parsed[0].flag, true);
  assertEquals(parsed[1].flag, false);
});

Deno.test('Adapter XLSX: roundtrip preserves numbers', async () => {
  const original = [{ int: 42, float: 3.14, neg: -7 }];
  const parsed = await parseXLSX(await toXLSX(original)) as typeof original;
  assertEquals(parsed[0].int, 42);
  assertEquals(parsed[0].float, 3.14);
  assertEquals(parsed[0].neg, -7);
});

Deno.test('Adapter XLSX: roundtrip preserves strings with special chars', async () => {
  const original = [{ text: 'Hello & <World> "quoted"' }];
  const parsed = await parseXLSX(await toXLSX(original)) as typeof original;
  assertEquals(parsed[0].text, 'Hello & <World> "quoted"');
});

Deno.test('Adapter XLSX: empty array produces empty sheet', async () => {
  const bytes = await toXLSX([]);
  assertEquals(bytes instanceof Uint8Array, true);
  // Should not throw
});

Deno.test('Adapter XLSX: large dataset roundtrip', async () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    label: `item-${i + 1}`,
    value: (i + 1) * 1.5,
  }));
  const parsed = await parseXLSX(await toXLSX(rows)) as typeof rows;
  assertEquals(parsed.length, 100);
  assertEquals(parsed[0].id, 1);
  assertEquals(parsed[99].id, 100);
  assertEquals(parsed[99].label, 'item-100');
});

// ── Unified API: new formats ──────────────────────────────────────────────────

Deno.test('Adapter unified: parse routes ndjson', () => {
  const result = parse('{"x":1}\n{"y":2}', 'ndjson') as unknown[];
  assertEquals(result.length, 2);
});

Deno.test('Adapter unified: parse routes text', () => {
  assertEquals(parse('hello', 'text'), 'hello');
});

Deno.test('Adapter unified: parse routes urlencoded', () => {
  const result = parse('a=1&b=2', 'urlencoded') as Record<string, unknown>;
  assertEquals(result['a'], '1');
  assertEquals(result['b'], '2');
});

Deno.test('Adapter unified: parse routes multipart', () => {
  const body =
    '--b\r\nContent-Disposition: form-data; name="x"\r\n\r\nhello\r\n--b--';
  const result = parse(body, 'multipart') as {
    parts: Record<string, { content: string }>;
  };
  assertEquals(result.parts['x'].content, 'hello');
});

Deno.test('Adapter unified: parse routes dw', () => {
  assertEquals(parse('"hello"', 'dw'), 'hello');
  assertEquals(parse('42', 'dw'), 42);
});

Deno.test('Adapter unified: serialize routes ndjson', () => {
  const result = serialize([{ a: 1 }, { b: 2 }], 'ndjson');
  assertEquals(result, '{"a":1}\n{"b":2}');
});

Deno.test('Adapter unified: serialize routes text', () => {
  assertEquals(serialize('hello', 'text'), 'hello');
  assertEquals(serialize(99, 'text'), '99');
});

Deno.test('Adapter unified: serialize routes urlencoded', () => {
  const result = serialize({ x: '1' }, 'urlencoded');
  assertEquals(result.includes('x=1'), true);
});

Deno.test('Adapter unified: serialize routes dw', () => {
  const result = serialize({ name: 'Alice' }, 'dw');
  assertEquals(result.includes('name: "Alice"'), true);
});

Deno.test('Adapter unified: xlsx throws on parse (use parseXLSX directly)', () => {
  assertThrows(() => parse('data', 'xlsx'), Error, 'binary format');
});

Deno.test('Adapter unified: xlsx throws on serialize (use toXLSX directly)', () => {
  assertThrows(() => serialize({ a: 1 }, 'xlsx'), Error, 'binary format');
});

// ── Integration: new formats with evaluator ───────────────────────────────────

Deno.test('Integration: NDJSON → DSL filter → NDJSON', () => {
  const ndjson =
    '{"name":"Alice","active":true}\n{"name":"Bob","active":false}';
  const payload = parseNDJSON(ndjson);
  const result = evaluate(
    `payload filter ((r) -> r.active)`,
    { payload },
  );
  const out = toNDJSON(result);
  assertEquals(out.includes('"Alice"'), true);
  assertEquals(out.includes('"Bob"'), false);
});

Deno.test('Integration: URLENCODED → DSL map → JSON', () => {
  const payload = parseURLEncoded('name=alice&score=95');
  const result = evaluate(
    `{ name: upper(payload.name), score: payload.score }`,
    { payload },
  ) as Record<string, unknown>;
  assertEquals(result['name'], 'ALICE');
});

Deno.test('Integration: TEXT → DSL split → JSON', () => {
  const payload = parseText('Alice,Bob,Carol');
  const result = evaluate(
    `split(payload, ",") map ((n) -> upper(n))`,
    { payload },
  ) as string[];
  assertEquals(result.length, 3);
  assertEquals(result[0], 'ALICE');
  assertEquals(result[2], 'CAROL');
});

Deno.test('Integration: XLSX roundtrip via DSL', async () => {
  const rows = [
    { product: 'Notebook', qty: 10, price: 999.99 },
    { product: 'Mouse', qty: 50, price: 59.99 },
  ];
  const payload = await parseXLSX(await toXLSX(rows)) as typeof rows;
  const result = evaluate(
    `payload map ((r) -> { product: upper(r.product), total: r.qty * r.price })`,
    { payload },
  ) as { product: string; total: number }[];
  assertEquals(result[0].product, 'NOTEBOOK');
  assertEquals(result[0].total, 9999.9);
  assertEquals(result[1].product, 'MOUSE');
});
