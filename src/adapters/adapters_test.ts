import { assertEquals, assertThrows } from '@std/assert';
import { parseJSON, toJSON } from './json.ts';
import { parseCSV, toCSV } from './csv.ts';
import { parseXML, toXML } from './xml.ts';
import { parseYAML, toYAML } from './yaml.ts';
import { parse, serialize } from './index.ts';
import { evaluate } from '../evaluator/evaluator.ts';

// ── JSON ──────────────────────────────────────────────────────────────────────

Deno.test('Adapter JSON: parse', () => {
  assertEquals(parseJSON('{"name":"Alice","age":30}'), { name: 'Alice', age: 30 });
  assertEquals(parseJSON('[1,2,3]'), [1, 2, 3]);
});

Deno.test('Adapter JSON: serialize', () => {
  const json = toJSON({ name: 'Alice' });
  assertEquals(JSON.parse(json), { name: 'Alice' });
});

Deno.test('Adapter JSON: roundtrip', () => {
  const obj = { users: [{ name: 'Alice', active: true }] };
  assertEquals(parseJSON(toJSON(obj)), obj);
});

// ── CSV ───────────────────────────────────────────────────────────────────────

Deno.test('Adapter CSV: parse with header', () => {
  const csv = `name,age,active\nAlice,30,true\nBob,25,false`;
  const result = parseCSV(csv) as Record<string, unknown>[];
  assertEquals(result.length, 2);
  assertEquals(result[0]['name'], 'Alice');
  assertEquals(result[0]['age'], 30);          // coerced to number
  assertEquals(result[0]['active'], true);      // coerced to boolean
  assertEquals(result[1]['name'], 'Bob');
  assertEquals(result[1]['active'], false);
});

Deno.test('Adapter CSV: parse without coercion', () => {
  const csv = `x,y\n1,2`;
  const result = parseCSV(csv, { coerce: false }) as Record<string, unknown>[];
  assertEquals(result[0]['x'], '1'); // stays string
});

Deno.test('Adapter CSV: parse quoted fields with commas', () => {
  const csv = `name,bio\nAlice,"Loves Deno, TypeScript"`;
  const result = parseCSV(csv) as Record<string, unknown>[];
  assertEquals(result[0]['bio'], 'Loves Deno, TypeScript');
});

Deno.test('Adapter CSV: parse null values', () => {
  const csv = `x,y\n1,null`;
  const result = parseCSV(csv) as Record<string, unknown>[];
  assertEquals(result[0]['y'], null);
});

Deno.test('Adapter CSV: serialize objects', () => {
  const data = [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }];
  const csv = toCSV(data);
  assertEquals(csv, 'name,age\nAlice,30\nBob,25');
});

Deno.test('Adapter CSV: roundtrip', () => {
  const original = [{ name: 'Alice', score: 10 }, { name: 'Bob', score: 20 }];
  const csv = toCSV(original);
  const parsed = parseCSV(csv) as Record<string, unknown>[];
  assertEquals(parsed[0]['name'], 'Alice');
  assertEquals(parsed[0]['score'], 10);
});

Deno.test('Adapter CSV: custom delimiter', () => {
  const csv = `name;age\nAlice;30`;
  const result = parseCSV(csv, { delimiter: ';' }) as Record<string, unknown>[];
  assertEquals(result[0]['name'], 'Alice');
});

// ── XML ───────────────────────────────────────────────────────────────────────

Deno.test('Adapter XML: parse simple element', () => {
  const xml = `<name>Alice</name>`;
  const result = parseXML(xml) as Record<string, unknown>;
  assertEquals(result['_tag'], 'name');
  assertEquals(result['_text'], 'Alice');
});

Deno.test('Adapter XML: parse with attributes', () => {
  const xml = `<user id="1" active="true"><name>Alice</name></user>`;
  const result = parseXML(xml) as Record<string, unknown>;
  assertEquals(result['_tag'], 'user');
  assertEquals((result['_attrs'] as Record<string, string>)['id'], '1');
  assertEquals((result['_children'] as unknown[]).length, 1);
});

Deno.test('Adapter XML: parse self-closing tag', () => {
  const xml = `<item id="1" />`;
  const result = parseXML(xml) as Record<string, unknown>;
  assertEquals(result['_tag'], 'item');
  assertEquals((result['_attrs'] as Record<string, string>)['id'], '1');
  assertEquals((result['_children'] as unknown[]).length, 0);
});

Deno.test('Adapter XML: parse with XML declaration', () => {
  const xml = `<?xml version="1.0"?><root><child>text</child></root>`;
  const result = parseXML(xml) as Record<string, unknown>;
  assertEquals(result['_tag'], 'root');
});

Deno.test('Adapter XML: serialize plain object', () => {
  const xml = toXML({ name: 'Alice', age: 30 });
  assertEquals(xml.includes('<name>Alice</name>'), true);
  assertEquals(xml.includes('<age>30</age>'), true);
});

Deno.test('Adapter XML: serialize array', () => {
  const xml = toXML([{ name: 'Alice' }, { name: 'Bob' }]);
  assertEquals(xml.includes('<items>'), true);
});

// ── YAML ──────────────────────────────────────────────────────────────────────

Deno.test('Adapter YAML: parse', () => {
  const yaml = `name: Alice\nage: 30\nactive: true`;
  const result = parseYAML(yaml) as Record<string, unknown>;
  assertEquals(result['name'], 'Alice');
  assertEquals(result['age'], 30);
  assertEquals(result['active'], true);
});

Deno.test('Adapter YAML: serialize', () => {
  const yaml = toYAML({ name: 'Alice', age: 30 });
  assertEquals(yaml.includes('name: Alice'), true);
});

Deno.test('Adapter YAML: roundtrip', () => {
  const obj = { users: [{ name: 'Alice', score: 10 }] };
  const parsed = parseYAML(toYAML(obj)) as typeof obj;
  assertEquals(parsed.users[0].name, 'Alice');
});

// ── Unified API ───────────────────────────────────────────────────────────────

Deno.test('Adapter unified: parse routing', () => {
  assertEquals(parse('42', 'json'), 42);
  assertEquals((parse('x\n1', 'csv') as unknown[])[0], { x: 1 });
});

Deno.test('Adapter unified: serialize routing', () => {
  assertEquals(typeof serialize({ a: 1 }, 'json'), 'string');
  assertEquals(typeof serialize([{ a: 1 }], 'csv'), 'string');
  assertEquals(typeof serialize({ a: 1 }, 'xml'), 'string');
  assertEquals(typeof serialize({ a: 1 }, 'yaml'), 'string');
});

// ── Integration: CSV → DSL → JSON (Phase 5 criterion) ────────────────────────

Deno.test('Integration: CSV → DSL filter → JSON', () => {
  const csvInput = `name,age,active\nAlice,30,true\nBob,25,false\nCharlie,35,true`;
  const payload = parseCSV(csvInput);

  const result = evaluate(
    `payload filter ((r) -> r.active)`,
    { payload }
  ) as Record<string, unknown>[];

  assertEquals(result.length, 2);
  assertEquals(result[0]['name'], 'Alice');
  assertEquals(result[1]['name'], 'Charlie');

  const json = toJSON(result as unknown as import('../evaluator/environment.ts').Value);
  assertEquals(JSON.parse(json).length, 2);
});

Deno.test('Integration: CSV → DSL map → JSON', () => {
  const csvInput = `name,score\nAlice,80\nBob,90\nCarlos,95`;
  const payload = parseCSV(csvInput);

  const result = evaluate(
    `payload map ((r) -> { name: upper(r.name), score: r.score, grade: if (r.score >= 90) "A" else "B" })`,
    { payload }
  );

  const json = toJSON(result);
  const parsed = JSON.parse(json) as Record<string, unknown>[];
  assertEquals(parsed[0]['name'], 'ALICE');
  assertEquals(parsed[0]['grade'], 'B');
  assertEquals(parsed[2]['grade'], 'A');
});

Deno.test('Integration: JSON → DSL groupBy → XML', () => {
  const jsonInput = toJSON([
    { category: 'fruit', name: 'Apple' },
    { category: 'veggie', name: 'Carrot' },
    { category: 'fruit', name: 'Banana' },
  ]);
  const payload = parseJSON(jsonInput);

  const grouped = evaluate(
    `groupBy(payload, (item) -> item.category)`,
    { payload }
  );

  const xml = toXML(grouped);
  assertEquals(xml.includes('<fruit>'), true);
  assertEquals(xml.includes('<veggie>'), true);
});
