import { assertEquals, assertThrows } from '@std/assert';
import { ParseError, Parser } from './parser.ts';
import type { Expression } from '../ast/nodes.ts';
import type * as AST from '../ast/nodes.ts';

// ── Helpers ──────────────────────────────────────────────────────────────────

function parse(src: string): Expression {
  return Parser.fromSource(src).parse().body;
}

// ── Literals ─────────────────────────────────────────────────────────────────

Deno.test('Parser: integer literal', () => {
  const node = parse('42');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, 42);
});

Deno.test('Parser: float literal', () => {
  const node = parse('3.14');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, 3.14);
});

Deno.test('Parser: string literal', () => {
  const node = parse('"hello"');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, 'hello');
});

Deno.test('Parser: boolean true', () => {
  const node = parse('true');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, true);
});

Deno.test('Parser: boolean false', () => {
  const node = parse('false');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, false);
});

Deno.test('Parser: null literal', () => {
  const node = parse('null');
  assertEquals(node.type, 'Literal');
  if (node.type === 'Literal') assertEquals(node.value, null);
});

// ── Identifiers ───────────────────────────────────────────────────────────────

Deno.test('Parser: identifier', () => {
  const node = parse('payload');
  assertEquals(node.type, 'Identifier');
  if (node.type === 'Identifier') assertEquals(node.name, 'payload');
});

// ── Member expressions ────────────────────────────────────────────────────────

Deno.test('Parser: simple member access — payload.users', () => {
  const node = parse('payload.users');
  assertEquals(node.type, 'MemberExpression');
  if (node.type === 'MemberExpression') {
    assertEquals(node.object.type, 'Identifier');
    assertEquals((node.object as { name: string }).name, 'payload');
    assertEquals(node.property.name, 'users');
  }
});

Deno.test('Parser: chained member access — a.b.c', () => {
  const node = parse('a.b.c');
  assertEquals(node.type, 'MemberExpression');
  if (node.type === 'MemberExpression') {
    assertEquals(node.property.name, 'c');
    assertEquals(node.object.type, 'MemberExpression');
  }
});

// ── Index expressions ─────────────────────────────────────────────────────────

Deno.test('Parser: index expression — arr[0]', () => {
  const node = parse('arr[0]');
  assertEquals(node.type, 'IndexExpression');
  if (node.type === 'IndexExpression') {
    assertEquals(node.object.type, 'Identifier');
    assertEquals(node.index.type, 'Literal');
    if (node.index.type === 'Literal') assertEquals(node.index.value, 0);
  }
});

// ── Call expressions ──────────────────────────────────────────────────────────

Deno.test('Parser: call with no args — fn()', () => {
  const node = parse('fn()');
  assertEquals(node.type, 'CallExpression');
  if (node.type === 'CallExpression') {
    assertEquals(node.arguments.length, 0);
  }
});

Deno.test('Parser: call with one arg — upper("hello")', () => {
  const node = parse('upper("hello")');
  assertEquals(node.type, 'CallExpression');
  if (node.type === 'CallExpression') {
    assertEquals(node.arguments.length, 1);
    assertEquals(node.arguments[0].type, 'Literal');
  }
});

Deno.test('Parser: call with multiple args — add(1, 2)', () => {
  const node = parse('add(1, 2)');
  assertEquals(node.type, 'CallExpression');
  if (node.type === 'CallExpression') assertEquals(node.arguments.length, 2);
});

Deno.test('Parser: member call — u.name.upper()', () => {
  const node = parse('u.name.upper()');
  assertEquals(node.type, 'CallExpression');
});

// ── Arrow functions ───────────────────────────────────────────────────────────

Deno.test('Parser: single-param arrow — (u) -> u.name', () => {
  const node = parse('(u) -> u.name');
  assertEquals(node.type, 'ArrowFunction');
  if (node.type === 'ArrowFunction') {
    assertEquals(node.params.length, 1);
    assertEquals(node.params[0].name, 'u');
    assertEquals(node.body.type, 'MemberExpression');
  }
});

Deno.test('Parser: multi-param arrow — (acc, x) -> acc + x', () => {
  const node = parse('(acc, x) -> acc + x');
  assertEquals(node.type, 'ArrowFunction');
  if (node.type === 'ArrowFunction') {
    assertEquals(node.params.length, 2);
    assertEquals(node.params[0].name, 'acc');
    assertEquals(node.params[1].name, 'x');
  }
});

Deno.test('Parser: short arrow — x -> x * 2', () => {
  const node = parse('x -> x * 2');
  assertEquals(node.type, 'ArrowFunction');
  if (node.type === 'ArrowFunction') {
    assertEquals(node.params.length, 1);
    assertEquals(node.params[0].name, 'x');
  }
});

Deno.test('Parser: zero-param arrow — () -> 42', () => {
  const node = parse('() -> 42');
  assertEquals(node.type, 'ArrowFunction');
  if (node.type === 'ArrowFunction') assertEquals(node.params.length, 0);
});

Deno.test('Parser: outer-paren arrow — ((u) -> u.name)', () => {
  // DataWeave style: map receives ((u) -> ...)
  const node = parse('((u) -> u.name)');
  assertEquals(node.type, 'ArrowFunction');
});

// ── Object expressions ────────────────────────────────────────────────────────

Deno.test('Parser: empty object — {}', () => {
  const node = parse('{}');
  assertEquals(node.type, 'ObjectExpression');
  if (node.type === 'ObjectExpression') assertEquals(node.properties.length, 0);
});

Deno.test('Parser: object with properties — { name: "Alice", age: 30 }', () => {
  const node = parse('{ name: "Alice", age: 30 }');
  assertEquals(node.type, 'ObjectExpression');
  if (node.type === 'ObjectExpression') {
    assertEquals(node.properties.length, 2);
    const prop1 = node.properties[0] as AST.Property;
    const prop2 = node.properties[1] as AST.Property;
    assertEquals((prop1.key as { name: string }).name, 'name');
    assertEquals(prop2.shorthand, false);
  }
});

Deno.test('Parser: shorthand property — { name }', () => {
  const node = parse('{ name }');
  assertEquals(node.type, 'ObjectExpression');
  if (node.type === 'ObjectExpression') {
    const prop1 = node.properties[0] as AST.Property;
    assertEquals(prop1.shorthand, true);
    assertEquals((prop1.key as { name: string }).name, 'name');
  }
});

Deno.test('Parser: dynamic property key — { ("a" ++ "b"): 1 }', () => {
  const node = parse('{ ("a" ++ "b"): 1 }');
  assertEquals(node.type, 'ObjectExpression');
  if (node.type === 'ObjectExpression') {
    assertEquals(node.properties.length, 1);
    const prop1 = node.properties[0] as AST.Property;
    assertEquals(prop1.key.type, 'BinaryExpression');
  }
});

Deno.test('Parser: dynamic object expansion — { (items) }', () => {
  const node = parse('{ (items) }');
  assertEquals(node.type, 'ObjectExpression');
  if (node.type === 'ObjectExpression') {
    assertEquals(node.properties.length, 1);
    const prop1 = node.properties[0] as AST.DynamicExpansion;
    assertEquals(prop1.type, 'DynamicExpansion');
    assertEquals(prop1.expression.type, 'Identifier');
    assertEquals((prop1.expression as AST.Identifier).name, 'items');
  }
});

// ── Array expressions ─────────────────────────────────────────────────────────

Deno.test('Parser: empty array — []', () => {
  const node = parse('[]');
  assertEquals(node.type, 'ArrayExpression');
  if (node.type === 'ArrayExpression') assertEquals(node.elements.length, 0);
});

Deno.test('Parser: array with elements — [1, 2, 3]', () => {
  const node = parse('[1, 2, 3]');
  assertEquals(node.type, 'ArrayExpression');
  if (node.type === 'ArrayExpression') assertEquals(node.elements.length, 3);
});

// ── Binary expressions ────────────────────────────────────────────────────────

Deno.test('Parser: equality — x == 1', () => {
  const node = parse('x == 1');
  assertEquals(node.type, 'BinaryExpression');
  if (node.type === 'BinaryExpression') assertEquals(node.operator, '==');
});

Deno.test('Parser: arithmetic — a + b * c (precedence)', () => {
  const node = parse('a + b * c');
  // Should parse as a + (b * c)
  assertEquals(node.type, 'BinaryExpression');
  if (node.type === 'BinaryExpression') {
    assertEquals(node.operator, '+');
    assertEquals(node.right.type, 'BinaryExpression');
    if (node.right.type === 'BinaryExpression') {
      assertEquals(node.right.operator, '*');
    }
  }
});

Deno.test('Parser: comparison chain — x > 0 and x < 10', () => {
  const node = parse('x > 0 and x < 10');
  assertEquals(node.type, 'BinaryExpression');
  if (node.type === 'BinaryExpression') assertEquals(node.operator, 'and');
});

// ── Unary expressions ─────────────────────────────────────────────────────────

Deno.test('Parser: unary not — not active', () => {
  const node = parse('not active');
  assertEquals(node.type, 'UnaryExpression');
  if (node.type === 'UnaryExpression') assertEquals(node.operator, 'not');
});

Deno.test('Parser: unary minus — -42', () => {
  const node = parse('-42');
  assertEquals(node.type, 'UnaryExpression');
  if (node.type === 'UnaryExpression') assertEquals(node.operator, '-');
});

// ── If expression ─────────────────────────────────────────────────────────────

Deno.test('Parser: if expression', () => {
  const node = parse('if (x > 0) "positive" else "negative"');
  assertEquals(node.type, 'IfExpression');
  if (node.type === 'IfExpression') {
    assertEquals(node.condition.type, 'BinaryExpression');
    assertEquals(node.consequent.type, 'Literal');
    assertEquals(node.alternate.type, 'Literal');
  }
});

// ── Pipe expression ───────────────────────────────────────────────────────────

Deno.test('Parser: pipe expression — payload |> transform', () => {
  const node = parse('payload |> transform');
  assertEquals(node.type, 'PipeExpression');
  if (node.type === 'PipeExpression') {
    assertEquals(node.left.type, 'Identifier');
    assertEquals(node.right.type, 'Identifier');
  }
});

// ── DSL operators ─────────────────────────────────────────────────────────────

Deno.test('Parser: map expression — payload.users map ((u) -> u.name)', () => {
  const node = parse('payload.users map ((u) -> u.name)');
  assertEquals(node.type, 'MapExpression');
  if (node.type === 'MapExpression') {
    assertEquals(node.source.type, 'MemberExpression');
    const lambda = node.lambda as AST.ArrowFunction;
    assertEquals(lambda.type, 'ArrowFunction');
    assertEquals(lambda.params.length, 1);
    assertEquals(lambda.params[0].name, 'u');
    assertEquals(lambda.body.type, 'MemberExpression');
  }
});

Deno.test('Parser: filter expression — users filter ((u) -> u.active)', () => {
  const node = parse('users filter ((u) -> u.active)');
  assertEquals(node.type, 'FilterExpression');
  if (node.type === 'FilterExpression') {
    assertEquals((node.lambda as AST.ArrowFunction).params[0].name, 'u');
  }
});

Deno.test(
  'Parser: reduce expression — nums reduce ((acc, x) -> acc + x)',
  () => {
    const node = parse('nums reduce ((acc, x) -> acc + x)');
    assertEquals(node.type, 'ReduceExpression');
    if (node.type === 'ReduceExpression') {
      const lambda = node.lambda as AST.ArrowFunction;
      assertEquals(lambda.params.length, 2);
      assertEquals(lambda.params[0].name, 'acc');
      assertEquals(lambda.params[1].name, 'x');
    }
  },
);

// ── Integration: full DataWeave expression ────────────────────────────────────

Deno.test('Parser: full DataWeave expression', () => {
  const src = `payload.users map ((u) -> {
    name: upper(u.name),
    active: u.enabled
  })`;
  const node = parse(src);

  assertEquals(node.type, 'MapExpression');
  if (node.type !== 'MapExpression') return;

  // source: payload.users
  assertEquals(node.source.type, 'MemberExpression');

  const lambda = node.lambda as AST.ArrowFunction;

  // lambda params
  assertEquals(lambda.params[0].name, 'u');

  // body is an object expression
  assertEquals(lambda.body.type, 'ObjectExpression');
  if (lambda.body.type !== 'ObjectExpression') return;

  const props = lambda.body.properties;
  assertEquals(props.length, 2);
  const prop0 = props[0] as AST.Property;
  const prop1 = props[1] as AST.Property;

  assertEquals((prop0.key as AST.Identifier).name, 'name');
  assertEquals((prop1.key as AST.Identifier).name, 'active');

  // name: upper(u.name) — CallExpression
  assertEquals(prop0.value.type, 'CallExpression');

  // active: u.enabled — MemberExpression
  assertEquals(prop1.value.type, 'MemberExpression');
});

// ── Error handling ────────────────────────────────────────────────────────────

Deno.test('Parser: throws on unexpected token', () => {
  assertThrows(() => parse('42 +'), ParseError);
});

Deno.test('Parser: throws on unclosed object', () => {
  assertThrows(() => parse('{ name: "Alice"'), ParseError);
});

Deno.test('Parser: default operator', () => {
  const node = parse('x default "fallback"');
  assertEquals(node.type, 'DefaultExpression');
  if (node.type === 'DefaultExpression') {
    assertEquals(node.expression.type, 'Identifier');
    assertEquals(node.alternate.type, 'Literal');
  }
});

Deno.test('Parser: as casting operator', () => {
  const node = parse('x as String { format: "yyyy" }');
  assertEquals(node.type, 'AsExpression');
  if (node.type === 'AsExpression') {
    assertEquals(node.expression.type, 'Identifier');
    assertEquals(node.targetType, 'String');
    assertEquals(node.properties?.type, 'ObjectExpression');
  }
});

// ── Infix higher-order functions ─────────────────────────────────────────────

Deno.test('Parser: infix groupBy with shorthand lambda', () => {
  const node = parse('payload groupBy $.category');
  assertEquals(node.type, 'InfixFunctionExpression');
  if (node.type === 'InfixFunctionExpression') {
    assertEquals(node.name, 'groupBy');
    assertEquals(node.source.type, 'Identifier');
    assertEquals(node.lambda.type, 'MemberExpression');
  }
});

Deno.test('Parser: infix orderBy with arrow lambda', () => {
  const node = parse('payload orderBy ((item) -> item.age)');
  assertEquals(node.type, 'InfixFunctionExpression');
  if (node.type === 'InfixFunctionExpression') {
    assertEquals(node.name, 'orderBy');
    assertEquals(node.lambda.type, 'ArrowFunction');
  }
});

Deno.test('Parser: chained infix functions', () => {
  const node = parse('payload distinctBy $.id groupBy $.category');
  assertEquals(node.type, 'InfixFunctionExpression');
  if (node.type === 'InfixFunctionExpression') {
    assertEquals(node.name, 'groupBy');
    assertEquals(node.source.type, 'InfixFunctionExpression');
    if (node.source.type === 'InfixFunctionExpression') {
      assertEquals(node.source.name, 'distinctBy');
    }
  }
});

Deno.test('Parser: infix mixes with map/filter', () => {
  const node = parse('payload filter ($.active) groupBy $.role');
  assertEquals(node.type, 'InfixFunctionExpression');
  if (node.type === 'InfixFunctionExpression') {
    assertEquals(node.name, 'groupBy');
    assertEquals(node.source.type, 'FilterExpression');
  }
});

Deno.test(
  'Parser: infix function names still usable as call expressions',
  () => {
    const node = parse('groupBy(payload, (r) -> r.category)');
    assertEquals(node.type, 'CallExpression');
  },
);

Deno.test(
  'Parser: infix function name as plain argument is not misparsed',
  () => {
    const node = parse('f(groupBy)');
    assertEquals(node.type, 'CallExpression');
    if (node.type === 'CallExpression') {
      assertEquals(node.arguments[0].type, 'Identifier');
    }
  },
);

Deno.test('Parser: header declarations and body', () => {
  const src = `%dw 2.0
output application/json
type T = { id: String }
var x = 10
fun f(y) = y * 2
---
f(x)`;
  const prog = Parser.fromSource(src).parse();
  assertEquals(prog.type, 'Program');
  assertEquals(prog.declarations.length, 3);
  assertEquals(prog.declarations[0].type, 'TypeDeclaration');
  assertEquals(prog.declarations[1].type, 'VariableDeclaration');
  assertEquals(prog.declarations[2].type, 'FunctionDeclaration');
  assertEquals(prog.body.type, 'CallExpression');
});
