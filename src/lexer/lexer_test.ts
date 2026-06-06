import { assertEquals } from '@std/assert';
import { Lexer } from './lexer.ts';
import { TokenType } from './token.ts';

// ── Helper ──────────────────────────────────────────────────────────────────

function types(src: string): TokenType[] {
  return new Lexer(src).tokenize().map((t) => t.type);
}

function values(src: string): string[] {
  return new Lexer(src).tokenize().map((t) => t.value);
}

// ── Literals ─────────────────────────────────────────────────────────────────

Deno.test('Lexer: integer number', () => {
  assertEquals(types('42'), [TokenType.NUMBER, TokenType.EOF]);
  assertEquals(values('42'), ['42', '']);
});

Deno.test('Lexer: float number', () => {
  assertEquals(types('3.14'), [TokenType.NUMBER, TokenType.EOF]);
  assertEquals(values('3.14'), ['3.14', '']);
});

Deno.test('Lexer: double-quoted string', () => {
  const toks = new Lexer('"hello world"').tokenize();
  assertEquals(toks[0].type, TokenType.STRING);
  assertEquals(toks[0].value, 'hello world');
});

Deno.test('Lexer: single-quoted string', () => {
  const toks = new Lexer("'hello'").tokenize();
  assertEquals(toks[0].type, TokenType.STRING);
  assertEquals(toks[0].value, 'hello');
});

Deno.test('Lexer: escape sequences in string', () => {
  const toks = new Lexer('"line1\\nline2"').tokenize();
  assertEquals(toks[0].value, 'line1\nline2');
});

Deno.test('Lexer: boolean true', () => {
  assertEquals(types('true'), [TokenType.BOOLEAN, TokenType.EOF]);
  assertEquals(values('true'), ['true', '']);
});

Deno.test('Lexer: boolean false', () => {
  assertEquals(types('false'), [TokenType.BOOLEAN, TokenType.EOF]);
});

Deno.test('Lexer: null', () => {
  assertEquals(types('null'), [TokenType.NULL, TokenType.EOF]);
});

// ── Identifiers & Keywords ───────────────────────────────────────────────────

Deno.test('Lexer: identifier', () => {
  assertEquals(types('payload'), [TokenType.IDENT, TokenType.EOF]);
  assertEquals(values('payload'), ['payload', '']);
});

Deno.test('Lexer: keyword map', () => {
  assertEquals(types('map'), [TokenType.MAP, TokenType.EOF]);
});

Deno.test('Lexer: keyword filter', () => {
  assertEquals(types('filter'), [TokenType.FILTER, TokenType.EOF]);
});

Deno.test('Lexer: keyword reduce', () => {
  assertEquals(types('reduce'), [TokenType.REDUCE, TokenType.EOF]);
});

Deno.test('Lexer: keyword where', () => {
  assertEquals(types('where'), [TokenType.WHERE, TokenType.EOF]);
});

// ── Operators ────────────────────────────────────────────────────────────────

Deno.test('Lexer: dot operator', () => {
  assertEquals(types('.'), [TokenType.DOT, TokenType.EOF]);
});

Deno.test('Lexer: double dot (descendant)', () => {
  assertEquals(types('..'), [TokenType.DOTDOT, TokenType.EOF]);
});

Deno.test('Lexer: arrow ->', () => {
  assertEquals(types('->'), [TokenType.ARROW, TokenType.EOF]);
});

Deno.test('Lexer: fat arrow =>', () => {
  assertEquals(types('=>'), [TokenType.FAT_ARROW, TokenType.EOF]);
});

Deno.test('Lexer: equality ==', () => {
  assertEquals(types('=='), [TokenType.EQ, TokenType.EOF]);
});

Deno.test('Lexer: inequality !=', () => {
  assertEquals(types('!='), [TokenType.NEQ, TokenType.EOF]);
});

Deno.test('Lexer: less than <', () => {
  assertEquals(types('<'), [TokenType.LT, TokenType.EOF]);
});

Deno.test('Lexer: less than or equal <=', () => {
  assertEquals(types('<='), [TokenType.LTE, TokenType.EOF]);
});

Deno.test('Lexer: greater than >', () => {
  assertEquals(types('>'), [TokenType.GT, TokenType.EOF]);
});

Deno.test('Lexer: greater than or equal >=', () => {
  assertEquals(types('>='), [TokenType.GTE, TokenType.EOF]);
});

Deno.test('Lexer: pipe operator |>', () => {
  assertEquals(types('|>'), [TokenType.PIPE, TokenType.EOF]);
});

Deno.test('Lexer: arithmetic operators', () => {
  assertEquals(types('+ - * /'), [
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.STAR,
    TokenType.SLASH,
    TokenType.EOF,
  ]);
});

// ── Punctuation ──────────────────────────────────────────────────────────────

Deno.test('Lexer: punctuation ( ) { } [ ] , : ;', () => {
  assertEquals(types('(){}[],: ;'), [
    TokenType.LPAREN,
    TokenType.RPAREN,
    TokenType.LBRACE,
    TokenType.RBRACE,
    TokenType.LBRACKET,
    TokenType.RBRACKET,
    TokenType.COMMA,
    TokenType.COLON,
    TokenType.SEMICOLON,
    TokenType.EOF,
  ]);
});

// ── Comments ─────────────────────────────────────────────────────────────────

Deno.test('Lexer: single-line comment is ignored', () => {
  assertEquals(types('// this is a comment\n42'), [TokenType.NUMBER, TokenType.EOF]);
});

Deno.test('Lexer: multi-line comment is ignored', () => {
  assertEquals(types('/* hello */ 42'), [TokenType.NUMBER, TokenType.EOF]);
});

// ── Line / Column tracking ───────────────────────────────────────────────────

Deno.test('Lexer: tracks line and column', () => {
  const toks = new Lexer('hello\nworld').tokenize();
  assertEquals(toks[0].line, 1);
  assertEquals(toks[0].column, 1);
  assertEquals(toks[1].line, 2);
  assertEquals(toks[1].column, 1);
});

// ── Integration: DataWeave expression ───────────────────────────────────────

Deno.test('Lexer: payload.users map ((u) -> u.name)', () => {
  const src = 'payload.users map ((u) -> u.name)';
  const toks = new Lexer(src).tokenize();
  const expectedTypes = [
    TokenType.IDENT,    // payload
    TokenType.DOT,      // .
    TokenType.IDENT,    // users
    TokenType.MAP,      // map
    TokenType.LPAREN,   // (
    TokenType.LPAREN,   // (
    TokenType.IDENT,    // u
    TokenType.RPAREN,   // )
    TokenType.ARROW,    // ->
    TokenType.IDENT,    // u
    TokenType.DOT,      // .
    TokenType.IDENT,    // name
    TokenType.RPAREN,   // )
    TokenType.EOF,
  ];
  assertEquals(toks.map((t) => t.type), expectedTypes);
});

Deno.test('Lexer: object expression { name: upper(u.name), active: u.enabled }', () => {
  const src = '{ name: upper(u.name), active: u.enabled }';
  const toks = new Lexer(src).tokenize();
  assertEquals(toks[0].type, TokenType.LBRACE);
  assertEquals(toks[1].type, TokenType.IDENT);
  assertEquals(toks[1].value, 'name');
  assertEquals(toks[2].type, TokenType.COLON);
});

Deno.test('Lexer: number does not consume .. operator', () => {
  // "1..10" should tokenize as NUMBER("1"), DOTDOT, NUMBER("10")
  const toks = new Lexer('1..10').tokenize();
  assertEquals(toks[0].type, TokenType.NUMBER);
  assertEquals(toks[0].value, '1');
  assertEquals(toks[1].type, TokenType.DOTDOT);
  assertEquals(toks[2].type, TokenType.NUMBER);
  assertEquals(toks[2].value, '10');
});

Deno.test('Lexer: new tokens %, ---, default, as, var, fun, type, $, $$', () => {
  const src = '% --- default as var fun type $ $$';
  assertEquals(types(src), [
    TokenType.PERCENT,
    TokenType.HEADER_SEPARATOR,
    TokenType.DEFAULT,
    TokenType.AS,
    TokenType.VAR,
    TokenType.FUN,
    TokenType.TYPE,
    TokenType.DOLLAR,
    TokenType.DOUBLE_DOLLAR,
    TokenType.EOF
  ]);
});
