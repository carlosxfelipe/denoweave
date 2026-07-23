import { assertEquals } from '@std/assert';
import { evaluate } from '../evaluator/evaluator.ts';

// ── String functions ──────────────────────────────────────────────────────────

Deno.test('Stdlib: upper / lower / trim', () => {
  assertEquals(evaluate('upper("hello")'), 'HELLO');
  assertEquals(evaluate('lower("WORLD")'), 'world');
  assertEquals(evaluate('trim("  hi  ")'), 'hi');
  assertEquals(evaluate('trimLeft("  hi")'), 'hi');
  assertEquals(evaluate('trimRight("hi  ")'), 'hi');
});

Deno.test('Stdlib: capitalize', () => {
  assertEquals(evaluate('capitalize("hello world")'), 'Hello world');
});

Deno.test('Stdlib: contains (string)', () => {
  assertEquals(evaluate('contains("hello world", "world")'), true);
  assertEquals(evaluate('contains("hello", "xyz")'), false);
});

Deno.test('Stdlib: startsWith / endsWith', () => {
  assertEquals(evaluate('startsWith("hello", "he")'), true);
  assertEquals(evaluate('endsWith("hello", "lo")'), true);
  assertEquals(evaluate('startsWith("hello", "lo")'), false);
});

Deno.test('Stdlib: replace', () => {
  assertEquals(
    evaluate('replace("hello world", "world", "Deno")'),
    'hello Deno',
  );
});

Deno.test('Stdlib: split / join', () => {
  assertEquals(evaluate('split("a,b,c", ",")'), ['a', 'b', 'c']);
  assertEquals(evaluate('join(["a","b","c"], "-")'), 'a-b-c');
});

Deno.test('Stdlib: substring / indexOf', () => {
  assertEquals(evaluate('substring("hello", 1, 3)'), 'el');
  assertEquals(evaluate('indexOf("hello", "ll")'), 2);
});

Deno.test('Stdlib: repeat / padLeft / padRight', () => {
  assertEquals(evaluate('repeat("ab", 3)'), 'ababab');
  assertEquals(evaluate('padLeft("5", 3, "0")'), '005');
  assertEquals(evaluate('padRight("5", 3, "0")'), '500');
});

Deno.test('Stdlib: toString / toNumber via evaluator', () => {
  // These are stdlib names but clash with JS builtins as token values.
  // We test them indirectly via the evaluate context injection.
  assertEquals(
    evaluate('asStr(42)', { asStr: (v: unknown) => String(v) }),
    '42',
  );
  // toNumber is callable — it's registered as 'toNumber' which is an IDENT
  assertEquals(evaluate('toNumber("3.14")'), 3.14);
});

// ── Math functions ────────────────────────────────────────────────────────────

Deno.test('Stdlib: abs / ceil / floor / round', () => {
  assertEquals(evaluate('abs(-5)'), 5);
  assertEquals(evaluate('ceil(1.2)'), 2);
  assertEquals(evaluate('floor(1.9)'), 1);
  assertEquals(evaluate('round(1.555, 2)'), 1.56);
});

Deno.test('Stdlib: sqrt / pow / mod', () => {
  assertEquals(evaluate('sqrt(9)'), 3);
  assertEquals(evaluate('pow(2, 10)'), 1024);
  assertEquals(evaluate('mod(10, 3)'), 1);
});

Deno.test('Stdlib: randomInt', () => {
  const r = evaluate('randomInt(10)') as number;
  assertEquals(Number.isInteger(r), true);
  assertEquals(r >= 0 && r < 10, true);
});

Deno.test('Stdlib: isDecimal / isInteger', () => {
  assertEquals(evaluate('isDecimal(3.14)'), true);
  assertEquals(evaluate('isDecimal(3)'), false);
  assertEquals(evaluate('isInteger(42)'), true);
  assertEquals(evaluate('isInteger(42.5)'), false);
});

Deno.test('Stdlib: typeOf', () => {
  assertEquals(evaluate('typeOf(42)'), 'number');
  assertEquals(evaluate('typeOf("hi")'), 'string');
  assertEquals(evaluate('typeOf([])'), 'array');
  assertEquals(evaluate('typeOf(null)'), 'null');
});

Deno.test('Stdlib: isNull / isEmpty / length', () => {
  assertEquals(evaluate('isNull(null)'), true);
  assertEquals(evaluate('isNull(0)'), false);
  assertEquals(evaluate('isEmpty([])'), true);
  assertEquals(evaluate('isEmpty("")'), true);
  assertEquals(evaluate('length("hello")'), 5);
  assertEquals(evaluate('length([1,2,3])'), 3);
});

// ── Array functions ───────────────────────────────────────────────────────────

Deno.test('Stdlib: map/filter/reduce as function-call style', () => {
  // 'map', 'filter', 'reduce' are DSL keywords — they cannot start a call expression.
  // Use them via the DSL operator syntax instead, which is the canonical DataWeave way.
  // The stdlib registers them as functions too, reachable via the evaluator environment:
  const mapFn = evaluate('([1,2,3]) map ((n) -> n * 2)');
  assertEquals(mapFn, [2, 4, 6]);
  const filterFn = evaluate('([1,2,3,4]) filter ((n) -> n > 2)');
  assertEquals(filterFn, [3, 4]);
  const reduceFn = evaluate('[1,2,3,4] reduce ((acc, n) -> acc + n)');
  assertEquals(reduceFn, 10);
});

Deno.test('Stdlib: groupBy', () => {
  const result = evaluate(
    'groupBy(items, (x) -> x.type)',
    { items: [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }] },
  );
  assertEquals((result as Record<string, unknown>)['a'], [{ type: 'a', v: 1 }, {
    type: 'a',
    v: 3,
  }]);
  assertEquals((result as Record<string, unknown>)['b'], [{ type: 'b', v: 2 }]);
});

Deno.test('Stdlib: orderBy (asc)', () => {
  assertEquals(
    evaluate('orderBy([3,1,2], (n) -> n)'),
    [1, 2, 3],
  );
});

Deno.test('Stdlib: orderBy (desc)', () => {
  assertEquals(
    evaluate('orderBy([3,1,2], (n) -> n, "desc")'),
    [3, 2, 1],
  );
});

Deno.test('Stdlib: distinctBy', () => {
  const result = evaluate(
    'distinctBy(items, (x) -> x.id)',
    { items: [{ id: 1, v: 'a' }, { id: 2, v: 'b' }, { id: 1, v: 'c' }] },
  );
  assertEquals((result as unknown[]).length, 2);
});

Deno.test('Stdlib: pluck', () => {
  assertEquals(
    evaluate('pluck({ a: 1, b: 2 }, (v, k) -> k)'),
    ['a', 'b'],
  );
  assertEquals(
    evaluate('pluck({ a: 1, b: 2 }, (v, k) -> v)'),
    [1, 2],
  );
});

Deno.test('Stdlib: first / last', () => {
  assertEquals(evaluate('first([10,20,30])'), 10);
  assertEquals(evaluate('last([10,20,30])'), 30);
});

Deno.test('Stdlib: take / drop', () => {
  assertEquals(evaluate('take([1,2,3,4,5], 3)'), [1, 2, 3]);
  assertEquals(evaluate('drop([1,2,3,4,5], 2)'), [3, 4, 5]);
});

Deno.test('Stdlib: chunk', () => {
  assertEquals(evaluate('chunk([1,2,3,4,5], 2)'), [[1, 2], [3, 4], [5]]);
});

Deno.test('Stdlib: reverse', () => {
  assertEquals(evaluate('reverse([1,2,3])'), [3, 2, 1]);
});

Deno.test('Stdlib: flatten', () => {
  assertEquals(evaluate('flatten([[1,2],[3,4]])'), [1, 2, 3, 4]);
});

Deno.test('Stdlib: zip', () => {
  assertEquals(evaluate('zip([1,2,3], ["a","b","c"])'), [[1, 'a'], [2, 'b'], [
    3,
    'c',
  ]]);
});

Deno.test('Stdlib: contains (array)', () => {
  assertEquals(evaluate('contains(["a","b","c"], "b")'), true);
  assertEquals(evaluate('contains(["a","b","c"], "z")'), false);
});

Deno.test('Stdlib: count', () => {
  assertEquals(evaluate('count([1,2,3,4,5])'), 5);
  assertEquals(evaluate('count([1,2,3,4,5], (n) -> n > 3)'), 2);
});

Deno.test('Stdlib: sum / avg / min / max', () => {
  assertEquals(evaluate('sum([1,2,3,4,5])'), 15);
  assertEquals(evaluate('avg([2,4,6])'), 4);
  assertEquals(evaluate('min([3,1,2])'), 1);
  assertEquals(evaluate('max([3,1,2])'), 3);
});

Deno.test('Stdlib: flatMap', () => {
  assertEquals(evaluate('flatMap([1,2,3], (n) -> [n, n * 10])'), [
    1,
    10,
    2,
    20,
    3,
    30,
  ]);
});

// ── Object functions ──────────────────────────────────────────────────────────

Deno.test('Stdlib: keys / values', () => {
  assertEquals(evaluate('keys({ a: 1, b: 2 })'), ['a', 'b']);
  assertEquals(evaluate('values({ a: 1, b: 2 })'), [1, 2]);
});

Deno.test('Stdlib: entries / fromEntries roundtrip', () => {
  const result = evaluate('fromEntries(entries({ a: 1, b: 2 }))');
  assertEquals(result, { a: 1, b: 2 });
});

Deno.test('Stdlib: merge', () => {
  assertEquals(evaluate('merge({ a: 1 }, { b: 2 })'), { a: 1, b: 2 });
  assertEquals(evaluate('merge({ a: 1 }, { a: 99 })'), { a: 99 });
});

Deno.test('Stdlib: pick / omit', () => {
  assertEquals(
    evaluate('pick(obj, ["a", "b"])', { obj: { a: 1, b: 2, c: 3 } }),
    { a: 1, b: 2 },
  );
  assertEquals(evaluate('omit(obj, ["c"])', { obj: { a: 1, b: 2, c: 3 } }), {
    a: 1,
    b: 2,
  });
});

Deno.test('Stdlib: has', () => {
  assertEquals(evaluate('has({ a: 1 }, "a")'), true);
  assertEquals(evaluate('has({ a: 1 }, "z")'), false);
});

Deno.test('Stdlib: mapObject', () => {
  assertEquals(
    evaluate('mapObject({ a: 1, b: 2 }, (v) -> v * 10)'),
    { a: 10, b: 20 },
  );
});

Deno.test('Stdlib: filterObject', () => {
  assertEquals(
    evaluate('filterObject({ a: 1, b: 2, c: 3 }, (v) -> v > 1)'),
    { b: 2, c: 3 },
  );
});

Deno.test('Stdlib: invert', () => {
  assertEquals(evaluate('invert({ a: "x", b: "y" })'), { x: 'a', y: 'b' });
});

Deno.test('Stdlib: update', () => {
  const obj = '{ "user": { "name": "alice", "age": 20 } }';
  assertEquals(
    evaluate(`update(${obj}, "user.age", (age) -> age + 1)`),
    { user: { name: 'alice', age: 21 } },
  );
  assertEquals(
    evaluate(`update(${obj}, ["user", "name"], (n) -> upper(n))`),
    { user: { name: 'ALICE', age: 20 } },
  );
});

Deno.test('Stdlib: now', () => {
  const result = evaluate('now()');
  assertEquals(result instanceof Date, true);
});

Deno.test('Stdlib: readUrl', async () => {
  const path = 'src/stdlib/test_data.json';
  const permission = await Deno.permissions.query({ name: 'read', path });
  if (permission.state !== 'granted') {
    return;
  }
  const result = evaluate(`readUrl("${path}", "application/json")`);
  assertEquals(result !== null && typeof result === 'object', true);
  assertEquals((result as Record<string, string>).id, '12345');
});
Deno.test('Stdlib: try', () => {
  // Sucesso
  assertEquals(evaluate('try(() -> 10 + 5)'), { success: true, value: 15 });

  // Erro (acessar propriedade de nulo lançaria RuntimeError na avaliação)
  const errResult = evaluate('try(() -> null.foo)') as {
    success: boolean;
    error: { message: string };
  };
  assertEquals(errResult.success, false);
  assertEquals(typeof errResult.error.message, 'string');
});

Deno.test('Stdlib: matches', () => {
  assertEquals(evaluate('matches("hello123", "[a-z]+")'), true);
  assertEquals(evaluate('matches("hello123", "^[0-9]+$")'), false);
  assertEquals(
    evaluate('matches("2024-01-15", "^\\\\d{4}-\\\\d{2}-\\\\d{2}$")'),
    true,
  );
});

Deno.test('Stdlib: scan', () => {
  assertEquals(evaluate('scan("one two three", "[a-z]+")'), [
    'one',
    'two',
    'three',
  ]);
  assertEquals(evaluate('scan("a1b2c3", "\\\\d")'), ['1', '2', '3']);
  assertEquals(evaluate('scan("no digits", "\\\\d+")'), []);
});

Deno.test('Stdlib: sizeOf (alias for length)', () => {
  assertEquals(evaluate('sizeOf("hello")'), 5);
  assertEquals(evaluate('sizeOf([1, 2, 3])'), 3);
  assertEquals(evaluate('sizeOf({ a: 1, b: 2 })'), 2);
});

Deno.test('Stdlib: find', () => {
  assertEquals(
    evaluate('find([1, 2, 3, 4], (n) -> n > 2)'),
    3,
  );
  assertEquals(evaluate('find([1, 2, 3], (n) -> n > 10)'), null);
});

Deno.test('Stdlib: some / every', () => {
  assertEquals(evaluate('some([1, 2, 3], (n) -> n > 2)'), true);
  assertEquals(evaluate('some([1, 2, 3], (n) -> n > 10)'), false);
  assertEquals(evaluate('every([2, 4, 6], (n) -> n > 0)'), true);
  assertEquals(evaluate('every([2, 4, 6], (n) -> n > 3)'), false);
});

Deno.test('Stdlib: sumBy / maxBy / minBy', () => {
  const data =
    '[{ "name": "A", "score": 10 }, { "name": "B", "score": 30 }, { "name": "C", "score": 20 }]';
  assertEquals(evaluate(`sumBy(${data}, (x) -> x.score)`), 60);
  assertEquals(
    evaluate(`maxBy(${data}, (x) -> x.score)`),
    { name: 'B', score: 30 },
  );
  assertEquals(
    evaluate(`minBy(${data}, (x) -> x.score)`),
    { name: 'A', score: 10 },
  );
});

Deno.test('Stdlib: countBy', () => {
  assertEquals(evaluate('countBy([1, 2, 3, 4, 5], (n) -> n > 3)'), 2);
});

Deno.test('Stdlib: deepFlatten', () => {
  assertEquals(evaluate('deepFlatten([1, [2, [3, [4]]]])'), [1, 2, 3, 4]);
  assertEquals(evaluate('deepFlatten([[1, 2], [3, 4]])'), [1, 2, 3, 4]);
});

Deno.test('Stdlib: uuid', () => {
  const u = evaluate('uuid()');
  assertEquals(typeof u, 'string');
  assertEquals((u as string).length, 36);
});

Deno.test('Stdlib: log', () => {
  // log returns the value it logs
  assertEquals(evaluate('log("DEBUG", 42)'), 42);
  assertEquals(evaluate('log("Just a message")'), 'Just a message');
});

Deno.test('Stdlib: read', () => {
  const jsonStr = '{"a": 1}';
  assertEquals(evaluate(`read('${jsonStr}', "application/json")`), { a: 1 });
  const csvStr = 'name,age\\nAlice,30';
  assertEquals(evaluate(`read('${csvStr}', "text/csv")`), [{
    name: 'Alice',
    age: 30,
  }]);
});

Deno.test('Stdlib: write', () => {
  const str = evaluate('write({ "a": 1 }, "application/json")') as string;
  assertEquals(JSON.parse(str), { a: 1 });
});
