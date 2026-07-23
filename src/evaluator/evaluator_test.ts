import { assertEquals, assertThrows } from '@std/assert';
import { evaluate, RuntimeError } from './evaluator.ts';
import type { Value } from './environment.ts';

// ── Helper ────────────────────────────────────────────────────────────────────

const ctx = (payload: Value) => ({ payload });

// ── Literals ──────────────────────────────────────────────────────────────────

Deno.test('Evaluator: number literal', () => {
  assertEquals(evaluate('42'), 42);
  assertEquals(evaluate('3.14'), 3.14);
});

Deno.test('Evaluator: string literal', () => {
  assertEquals(evaluate('"hello"'), 'hello');
  assertEquals(evaluate("'world'"), 'world');
});

Deno.test('Evaluator: boolean literals', () => {
  assertEquals(evaluate('true'), true);
  assertEquals(evaluate('false'), false);
});

Deno.test('Evaluator: null literal', () => {
  assertEquals(evaluate('null'), null);
});

// ── Arithmetic ────────────────────────────────────────────────────────────────

Deno.test('Evaluator: addition', () => {
  assertEquals(evaluate('1 + 2'), 3);
  assertEquals(evaluate('10 + 20'), 30);
});

Deno.test('Evaluator: subtraction', () => {
  assertEquals(evaluate('10 - 3'), 7);
});

Deno.test('Evaluator: multiplication', () => {
  assertEquals(evaluate('4 * 5'), 20);
});

Deno.test('Evaluator: division', () => {
  assertEquals(evaluate('10 / 4'), 2.5);
});

Deno.test('Evaluator: operator precedence a + b * c', () => {
  // 2 + 3 * 4 = 2 + 12 = 14
  assertEquals(evaluate('2 + 3 * 4'), 14);
});

Deno.test('Evaluator: unary minus', () => {
  assertEquals(evaluate('-5'), -5);
});

Deno.test('Evaluator: division by zero throws', () => {
  assertThrows(() => evaluate('1 / 0'), RuntimeError);
});

// ── String ────────────────────────────────────────────────────────────────────

Deno.test('Evaluator: string concatenation with +', () => {
  assertEquals(evaluate('"hello" + " " + "world"'), 'hello world');
});

Deno.test('Evaluator: number + string coerces to string', () => {
  assertEquals(evaluate('42 + " items"'), '42 items');
});

// ── Comparison ────────────────────────────────────────────────────────────────

Deno.test('Evaluator: equality ==', () => {
  assertEquals(evaluate('1 == 1'), true);
  assertEquals(evaluate('1 == 2'), false);
});

Deno.test('Evaluator: inequality !=', () => {
  assertEquals(evaluate('1 != 2'), true);
  assertEquals(evaluate('1 != 1'), false);
});

Deno.test('Evaluator: less than', () => {
  assertEquals(evaluate('1 < 2'), true);
  assertEquals(evaluate('2 < 1'), false);
});

Deno.test('Evaluator: greater than', () => {
  assertEquals(evaluate('5 > 3'), true);
});

Deno.test('Evaluator: less than or equal', () => {
  assertEquals(evaluate('3 <= 3'), true);
  assertEquals(evaluate('4 <= 3'), false);
});

Deno.test('Evaluator: greater than or equal', () => {
  assertEquals(evaluate('3 >= 3'), true);
});

// ── Logical ───────────────────────────────────────────────────────────────────

Deno.test('Evaluator: and — true and false = false', () => {
  assertEquals(evaluate('true and false'), false);
  assertEquals(evaluate('true and true'), true);
});

Deno.test('Evaluator: or — false or true = true', () => {
  assertEquals(evaluate('false or true'), true);
});

Deno.test('Evaluator: not', () => {
  assertEquals(evaluate('not true'), false);
  assertEquals(evaluate('not false'), true);
});

// ── Context / Identifiers ─────────────────────────────────────────────────────

Deno.test('Evaluator: resolves context variable', () => {
  assertEquals(evaluate('x', { x: 42 }), 42);
});

Deno.test('Evaluator: undefined variable throws', () => {
  assertThrows(() => evaluate('doesNotExist'), ReferenceError);
});

// ── Member access ─────────────────────────────────────────────────────────────

Deno.test('Evaluator: member access — payload.name', () => {
  assertEquals(evaluate('payload.name', ctx({ name: 'Alice' })), 'Alice');
});

Deno.test('Evaluator: chained member — payload.user.name', () => {
  assertEquals(
    evaluate('payload.user.name', ctx({ user: { name: 'Bob' } })),
    'Bob',
  );
});

Deno.test('Evaluator: member returns null for missing key', () => {
  assertEquals(evaluate('payload.missing', ctx({ x: 1 })), null);
});

Deno.test('Evaluator: array selector — payload.users.name', () => {
  // DataWeave: accessing a property on an array plucks from each element
  const result = evaluate(
    'payload.users.name',
    ctx({ users: [{ name: 'Alice' }, { name: 'Bob' }] }),
  );
  assertEquals(result, ['Alice', 'Bob']);
});

// ── Index access ──────────────────────────────────────────────────────────────

Deno.test('Evaluator: index access — arr[0]', () => {
  assertEquals(evaluate('arr[0]', { arr: [10, 20, 30] }), 10);
  assertEquals(evaluate('arr[2]', { arr: [10, 20, 30] }), 30);
});

// ── Object & Array literals ───────────────────────────────────────────────────

Deno.test('Evaluator: object literal', () => {
  assertEquals(evaluate('{ name: "Alice", age: 30 }'), {
    name: 'Alice',
    age: 30,
  });
});

Deno.test('Evaluator: nested object literal', () => {
  const result = evaluate('{ user: { name: "Bob" } }');
  assertEquals(result, { user: { name: 'Bob' } });
});

Deno.test('Evaluator: array literal', () => {
  assertEquals(evaluate('[1, 2, 3]'), [1, 2, 3]);
});

Deno.test('Evaluator: array with expressions', () => {
  assertEquals(evaluate('[1 + 1, 2 * 3]'), [2, 6]);
});

// ── Arrow functions ───────────────────────────────────────────────────────────

Deno.test('Evaluator: arrow function is callable', () => {
  // We call via the evaluate + call expression trick: fn()
  assertEquals(evaluate('((x) -> x * 2)(5)'), 10);
});

Deno.test('Evaluator: arrow function captures scope', () => {
  assertEquals(evaluate('((x) -> x + n)(3)', { n: 10 }), 13);
});

// ── Built-in stdlib functions ─────────────────────────────────────────────────

Deno.test('Evaluator: upper("hello") → "HELLO"', () => {
  assertEquals(evaluate('upper("hello")'), 'HELLO');
});

Deno.test('Evaluator: lower("HELLO") → "hello"', () => {
  assertEquals(evaluate('lower("HELLO")'), 'hello');
});

Deno.test('Evaluator: trim("  hi  ") → "hi"', () => {
  assertEquals(evaluate('trim("  hi  ")'), 'hi');
});

Deno.test('Evaluator: length("hello") = 5', () => {
  assertEquals(evaluate('length("hello")'), 5);
});

Deno.test('Evaluator: length([1,2,3]) = 3', () => {
  assertEquals(evaluate('length([1, 2, 3])'), 3);
});

Deno.test('Evaluator: keys({ a: 1, b: 2 })', () => {
  assertEquals(evaluate('keys({ a: 1, b: 2 })'), ['a', 'b']);
});

Deno.test('Evaluator: values({ a: 1, b: 2 })', () => {
  assertEquals(evaluate('values({ a: 1, b: 2 })'), [1, 2]);
});

Deno.test('Evaluator: flatten([[1,2],[3]])', () => {
  assertEquals(evaluate('flatten([[1, 2], [3]])'), [1, 2, 3]);
});

Deno.test('Evaluator: isEmpty([]) = true', () => {
  assertEquals(evaluate('isEmpty([])'), true);
  assertEquals(evaluate('isEmpty([1])'), false);
});

Deno.test('Evaluator: isNull(null) = true', () => {
  assertEquals(evaluate('isNull(null)'), true);
  assertEquals(evaluate('isNull(1)'), false);
});

// ── DSL operators ─────────────────────────────────────────────────────────────

Deno.test('Evaluator: map — extract names', () => {
  const result = evaluate(
    'payload.users map ((u) -> u.name)',
    ctx({ users: [{ name: 'Alice' }, { name: 'Bob' }] }),
  );
  assertEquals(result, ['Alice', 'Bob']);
});

Deno.test('Evaluator: map — double numbers', () => {
  const result = evaluate('payload map ((n) -> n * 2)', { payload: [1, 2, 3] });
  assertEquals(result, [2, 4, 6]);
});

Deno.test('Evaluator: map — with index param', () => {
  const result = evaluate('payload map ((item, i) -> i)', {
    payload: ['a', 'b', 'c'],
  });
  assertEquals(result, [0, 1, 2]);
});

Deno.test('Evaluator: filter — active users', () => {
  const result = evaluate(
    'payload.users filter ((u) -> u.active)',
    ctx({
      users: [
        { name: 'Alice', active: true },
        { name: 'Bob', active: false },
      ],
    }),
  );
  assertEquals(result, [{ name: 'Alice', active: true }]);
});

Deno.test('Evaluator: filter — numbers greater than 2', () => {
  const result = evaluate('nums filter ((n) -> n > 2)', {
    nums: [1, 2, 3, 4, 5],
  });
  assertEquals(result, [3, 4, 5]);
});

Deno.test('Evaluator: reduce — sum', () => {
  const result = evaluate('nums reduce ((acc, n) -> acc + n)', {
    nums: [1, 2, 3, 4],
  });
  assertEquals(result, 10);
});

Deno.test('Evaluator: reduce — single element returns it', () => {
  assertEquals(
    evaluate('nums reduce ((acc, n) -> acc + n)', { nums: [42] }),
    42,
  );
});

Deno.test('Evaluator: reduce — empty array returns null', () => {
  assertEquals(
    evaluate('nums reduce ((acc, n) -> acc + n)', { nums: [] }),
    null,
  );
});

// ── If expression ─────────────────────────────────────────────────────────────

Deno.test('Evaluator: if true branch', () => {
  assertEquals(evaluate('if (true) "yes" else "no"'), 'yes');
});

Deno.test('Evaluator: if false branch', () => {
  assertEquals(evaluate('if (false) "yes" else "no"'), 'no');
});

Deno.test('Evaluator: if with condition expression', () => {
  const result = evaluate('if (x > 0) "positive" else "non-positive"', {
    x: 5,
  });
  assertEquals(result, 'positive');
});

// ── Short-circuit logical operators ───────────────────────────────────────────

Deno.test('Evaluator: and short-circuits on false left side', () => {
  // If short-circuit works, the right side (null.foo) is never evaluated
  // and should NOT throw a RuntimeError.
  assertEquals(evaluate('false and null.foo'), false);
});

Deno.test('Evaluator: or short-circuits on true left side', () => {
  // If short-circuit works, the right side (null.foo) is never evaluated.
  assertEquals(evaluate('true or null.foo'), true);
});

Deno.test('Evaluator: and evaluates right side when left is true', () => {
  assertEquals(evaluate('true and false'), false);
  assertEquals(evaluate('true and true'), true);
});

Deno.test('Evaluator: or evaluates right side when left is false', () => {
  assertEquals(evaluate('false or false'), false);
  assertEquals(evaluate('false or true'), true);
});

// ── Pipe operator ─────────────────────────────────────────────────────────────

Deno.test('Evaluator: pipe |> applies function', () => {
  assertEquals(evaluate('"hello" |> upper'), 'HELLO');
});

// ── Integration: full DataWeave expression ────────────────────────────────────

Deno.test('Evaluator: target expression from spec', () => {
  // The canonical Phase 3 acceptance criterion
  const result = evaluate(
    `payload.users map ((u) -> u.name)`,
    ctx({ users: [{ name: 'Alice' }, { name: 'Bob' }] }),
  );
  assertEquals(result, ['Alice', 'Bob']);
});

Deno.test('Evaluator: full DataWeave expression — map with object body', () => {
  const src = `payload.users map ((u) -> {
    name: upper(u.name),
    active: u.enabled
  })`;

  const result = evaluate(
    src,
    ctx({
      users: [
        { name: 'john', enabled: true },
        { name: 'jane', enabled: false },
      ],
    }),
  );

  assertEquals(result, [
    { name: 'JOHN', active: true },
    { name: 'JANE', active: false },
  ]);
});

Deno.test('Evaluator: chained map + filter', () => {
  // First map then filter (using pipe)
  const result = evaluate(`(nums map ((n) -> n * 2)) filter ((n) -> n > 4)`, {
    nums: [1, 2, 3, 4, 5],
  });
  assertEquals(result, [6, 8, 10]);
});

Deno.test('Evaluator: default operator', () => {
  assertEquals(evaluate('x default "fallback"', { x: null }), 'fallback');
  assertEquals(evaluate('x default "fallback"', { x: 'actual' }), 'actual');
  // Error handling default
  assertEquals(
    evaluate('payload.nonexistent.key default "fallback"', { payload: null }),
    'fallback',
  );
});

Deno.test('Evaluator: as casting operator', () => {
  assertEquals(evaluate('123 as String'), '123');
  assertEquals(evaluate('"123" as Number'), 123);
  assertEquals(evaluate('"true" as Boolean'), true);
  // date formatting casting
  const dateVal = new Date(2026, 5, 6, 12, 0, 0); // Month is 0-indexed (5 = June)
  const resultStr = evaluate('d as String { format: "yyyy-MM-dd HH:mm:ss" }', {
    d: dateVal,
  });
  assertEquals(resultStr, '2026-06-06 12:00:00');
});

Deno.test('Evaluator: anonymous lambdas using $ and $$', () => {
  // map: $ is item, $$ is index
  assertEquals(evaluate('[1, 2, 3] map ($ * 10)'), [10, 20, 30]);
  assertEquals(evaluate('[1, 2, 3] map ($$ + $)'), [1, 3, 5]);

  // filter: $ is item
  assertEquals(evaluate('[1, 2, 3, 4] filter ($ > 2)'), [3, 4]);

  // reduce: $ is acc, $$ is item
  assertEquals(evaluate('[1, 2, 3, 4] reduce ($ + $$)'), 10);
});

// ── Infix higher-order functions ──────────────────────────────────────────────

Deno.test('Evaluator: infix groupBy with shorthand lambda', () => {
  const result = evaluate('payload groupBy $.category', {
    payload: [
      { name: 'apple', category: 'fruit' },
      { name: 'carrot', category: 'veg' },
      { name: 'banana', category: 'fruit' },
    ],
  });
  assertEquals(result, {
    fruit: [
      { name: 'apple', category: 'fruit' },
      { name: 'banana', category: 'fruit' },
    ],
    veg: [{ name: 'carrot', category: 'veg' }],
  });
});

Deno.test('Evaluator: infix orderBy with arrow lambda (numeric keys)', () => {
  const result = evaluate('payload orderBy ((p) -> p.age)', {
    payload: [
      { name: 'Carol', age: 35 },
      { name: 'Alice', age: 9 },
      { name: 'Bob', age: 25 },
    ],
  });
  assertEquals(result, [
    { name: 'Alice', age: 9 },
    { name: 'Bob', age: 25 },
    { name: 'Carol', age: 35 },
  ]);
});

Deno.test('Evaluator: infix distinctBy', () => {
  const result = evaluate('payload distinctBy $.id', {
    payload: [{ id: 1 }, { id: 2 }, { id: 1 }],
  });
  assertEquals(result, [{ id: 1 }, { id: 2 }]);
});

Deno.test('Evaluator: infix flatMap', () => {
  assertEquals(evaluate('[[1, 2], [3]] flatMap $'), [1, 2, 3]);
});

Deno.test('Evaluator: infix mapObject ($ = value, $$ = key)', () => {
  const result = evaluate('payload mapObject ($ * 2)', {
    payload: { a: 1, b: 2 },
  });
  assertEquals(result, { a: 2, b: 4 });
});

Deno.test('Evaluator: infix filterObject', () => {
  const result = evaluate('payload filterObject ($ > 1)', {
    payload: { a: 1, b: 2, c: 3 },
  });
  assertEquals(result, { b: 2, c: 3 });
});

Deno.test('Evaluator: infix pluck builds array from object', () => {
  const result = evaluate('payload pluck ($$ ++ "=" ++ ($ as String))', {
    payload: { a: 1, b: 2 },
  });
  assertEquals(result, ['a=1', 'b=2']);
});

Deno.test('Evaluator: chained infix filter + groupBy', () => {
  const result = evaluate('payload filter ($.active) groupBy $.role', {
    payload: [
      { name: 'a', role: 'admin', active: true },
      { name: 'b', role: 'user', active: false },
      { name: 'c', role: 'admin', active: true },
    ],
  });
  assertEquals(result, {
    admin: [
      { name: 'a', role: 'admin', active: true },
      { name: 'c', role: 'admin', active: true },
    ],
  });
});

Deno.test('Evaluator: infix function names still callable as functions', () => {
  const result = evaluate('groupBy(payload, (r) -> r.k)', {
    payload: [{ k: 'x' }, { k: 'y' }, { k: 'x' }],
  });
  assertEquals(result, { x: [{ k: 'x' }, { k: 'x' }], y: [{ k: 'y' }] });
});

Deno.test('Evaluator: header declarations', () => {
  const src = `%dw 2.0
output application/json
var x = 10
fun double(n) = n * 2
---
double(x)`;
  assertEquals(evaluate(src), 20);
});

// ── Dynamic Object Expansions & Keys ──────────────────────────────────────────

Deno.test('Evaluator: duplicate keys array-ify', () => {
  const result = evaluate('{ a: 1, a: 2, a: 3 }');
  assertEquals(result, { a: [1, 2, 3] });
});

Deno.test('Evaluator: dynamic key', () => {
  const result = evaluate('{ ("a" ++ "b"): 1 }');
  assertEquals(result, { ab: 1 });
});

Deno.test('Evaluator: dynamic expansion from object', () => {
  const result = evaluate('{ a: 1, ({ b: 2, c: 3 }) }');
  assertEquals(result, { a: 1, b: 2, c: 3 });
});

Deno.test('Evaluator: dynamic expansion from array of objects', () => {
  const result = evaluate('{ a: 1, ( [{b: 2}, {c: 3}] ) }');
  assertEquals(result, { a: 1, b: 2, c: 3 });
});

Deno.test('Evaluator: dynamic expansion with duplicate keys', () => {
  const result = evaluate('{ ( [{a: 1}, {a: 2}] ) }');
  assertEquals(result, { a: [1, 2] });
});

Deno.test('Evaluator: deep descendant selector (..)', () => {
  const payload = {
    user: { name: 'Alice', age: 30 },
    friends: [
      { name: 'Bob' },
      { name: 'Charlie', detail: { name: 'Dave' } },
    ],
  };
  const result = evaluate('payload..name', { payload });
  assertEquals(result, ['Alice', 'Bob', 'Charlie', 'Dave']);
});
