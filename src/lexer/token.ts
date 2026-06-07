/**
 * Token types for the DataWeave-inspired DSL lexer.
 */

export enum TokenType {
  // ── Literals ──────────────────────────────────────────────
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  NULL = 'NULL',

  // ── Identifiers ───────────────────────────────────────────
  IDENT = 'IDENT',

  // ── Keywords ──────────────────────────────────────────────
  MAP = 'MAP',
  FILTER = 'FILTER',
  REDUCE = 'REDUCE',
  WHERE = 'WHERE',
  AS = 'AS',
  IF = 'IF',
  ELSE = 'ELSE',
  USING = 'USING',
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',
  DEFAULT = 'DEFAULT',
  VAR = 'VAR',
  FUN = 'FUN',
  TYPE = 'TYPE',
  DO = 'DO',
  MATCH = 'MATCH',
  CASE = 'CASE',
  IS = 'IS',
  TO = 'TO',

  // ── Operators ─────────────────────────────────────────────
  DOT = 'DOT',             // .
  DOTDOT = 'DOTDOT',       // ..  (descendant selector)
  ARROW = 'ARROW',         // ->
  FAT_ARROW = 'FAT_ARROW', // =>
  COLON = 'COLON',         // :
  COMMA = 'COMMA',         // ,
  SEMICOLON = 'SEMICOLON', // ;
  PIPE = 'PIPE',           // |>
  PERCENT = 'PERCENT',     // %
  HEADER_SEPARATOR = 'HEADER_SEPARATOR', // ---

  // ── Arithmetic ────────────────────────────────────────────
  PLUS = 'PLUS',           // +
  PLUS_PLUS = 'PLUS_PLUS', // ++
  MINUS = 'MINUS',         // -
  STAR = 'STAR',           // *
  SLASH = 'SLASH',         // /

  // ── Comparison ────────────────────────────────────────────
  EQ = 'EQ',               // ==
  NEQ = 'NEQ',             // !=
  LT = 'LT',               // <
  LTE = 'LTE',             // <=
  GT = 'GT',               // >
  GTE = 'GTE',             // >=

  // ── Assignment ────────────────────────────────────────────
  ASSIGN = 'ASSIGN',       // =

  // ── Grouping / Structure ──────────────────────────────────
  LPAREN = 'LPAREN',       // (
  RPAREN = 'RPAREN',       // )
  LBRACE = 'LBRACE',       // {
  RBRACE = 'RBRACE',       // }
  LBRACKET = 'LBRACKET',   // [
  RBRACKET = 'RBRACKET',   // ]

  // ── Special ───────────────────────────────────────────────
  DOLLAR = 'DOLLAR',       // $
  DOUBLE_DOLLAR = 'DOUBLE_DOLLAR', // $$
  EOF = 'EOF',
  ILLEGAL = 'ILLEGAL',
}

/** Keywords map — identifiers that are reserved words */
export const KEYWORDS: Record<string, TokenType> = {
  map: TokenType.MAP,
  filter: TokenType.FILTER,
  reduce: TokenType.REDUCE,
  where: TokenType.WHERE,
  as: TokenType.AS,
  if: TokenType.IF,
  else: TokenType.ELSE,
  using: TokenType.USING,
  and: TokenType.AND,
  or: TokenType.OR,
  not: TokenType.NOT,
  default: TokenType.DEFAULT,
  var: TokenType.VAR,
  fun: TokenType.FUN,
  type: TokenType.TYPE,
  do: TokenType.DO,
  match: TokenType.MATCH,
  case: TokenType.CASE,
  is: TokenType.IS,
  to: TokenType.TO,
  "$": TokenType.DOLLAR,
  "$$": TokenType.DOUBLE_DOLLAR,
  true: TokenType.BOOLEAN,
  false: TokenType.BOOLEAN,
  null: TokenType.NULL,
};

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/** Creates a Token object. */
export function createToken(
  type: TokenType,
  value: string,
  line: number,
  column: number,
): Token {
  return { type, value, line, column };
}
