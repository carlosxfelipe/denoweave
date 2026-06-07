import { Lexer } from '../lexer/lexer.ts';
import { Token, TokenType, KEYWORDS } from '../lexer/token.ts';
import type * as AST from '../ast/nodes.ts';

// ── Error ────────────────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message: string, public readonly token: Token) {
    super(`[${token.line}:${token.column}] ParseError: ${message} (got "${token.value}")`);
    this.name = 'ParseError';
  }
}

// ── Parser ───────────────────────────────────────────────────────────────────

/**
 * Recursive-descent parser for the DataWeave-inspired DSL.
 *
 * Grammar (simplified, in order of increasing precedence):
 *
 *   program        → expression EOF
 *   expression     → pipe
 *   pipe           → infix ("|>" infix)*
 *   infix          → logical (("map"|"filter"|"reduce") lambda)*
 *   logical        → comparison (("and"|"or") comparison)*
 *   comparison     → range (compOp range)*
 *   range          → additive ("to" additive)*
 *   additive       → multiplicative (("+"|"-") multiplicative)*
 *   multiplicative → unary (("*"|"/") unary)*
 *   unary          → ("not"|"-") unary | postfix
 *   postfix        → primary ("." IDENT | "[" expr "]" | "(" args ")")*
 *   primary        → NUMBER | STRING | BOOLEAN | NULL | IDENT
 *                  | "(" parenOrArrow ")"
 *                  | "{" object "}"
 *                  | "[" array "]"
 *                  | "if" "(" expr ")" expr "else" expr
 */
export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** Convenience factory: lex source and build a parser in one step. */
  static fromSource(source: string): Parser {
    return new Parser(new Lexer(source).tokenize());
  }

  /** Parse the full program and return the root AST node. */
  parse(): AST.Program {
    // Only treat `---` as a header separator if it appears at brace-depth 0.
    // This prevents `do { var x = 1 --- x }` from being misidentified as a header.
    let _depth = 0;
    const hasHeader = this.tokens.some((t) => {
      if (t.type === TokenType.LBRACE) { _depth++; return false; }
      if (t.type === TokenType.RBRACE) { _depth--; return false; }
      return t.type === TokenType.HEADER_SEPARATOR && _depth === 0;
    });
    const declarations: AST.Declaration[] = [];

    if (hasHeader) {
      while (!this.check(TokenType.HEADER_SEPARATOR) && !this.check(TokenType.EOF)) {
        const tok = this.peek();
        if (tok.type === TokenType.PERCENT) {
          this.advance(); // consume %
          const directive = this.expect(TokenType.IDENT); // dw | input | output | ns | ...
          if (directive.value === 'dw') {
            // %dw 2.0 — consume version token
            this.advance();
          } else {
            // %input, %output, %ns, %function, etc.
            // Consume all tokens until the next header-level keyword or separator
            while (
              !this.check(TokenType.EOF) &&
              !this.check(TokenType.HEADER_SEPARATOR) &&
              !this.check(TokenType.PERCENT) &&
              !this.check(TokenType.VAR) &&
              !this.check(TokenType.FUN) &&
              !this.check(TokenType.TYPE)
            ) {
              // Stop if we hit a standalone 'output' identifier at line start
              const cur = this.peek();
              if (cur.type === TokenType.IDENT && cur.value === 'output') break;
              this.advance();
            }
          }
        } else if (tok.type === TokenType.IDENT && tok.value === 'output') {
          this.advance();
          this.expect(TokenType.IDENT); // application
          this.expect(TokenType.SLASH); // /
          this.expect(TokenType.IDENT); // json
        } else if (tok.type === TokenType.VAR) {
          declarations.push(this.parseVarDeclaration());
        } else if (tok.type === TokenType.FUN) {
          declarations.push(this.parseFunDeclaration());
        } else if (tok.type === TokenType.TYPE) {
          declarations.push(this.parseTypeDeclaration());
        } else if (tok.type === TokenType.IDENT && tok.value === 'input') {
          // bare `input payload application/json` — DW 2.0 standalone syntax
          // Consume the full directive: input <name> <mime-type>
          this.advance(); // input
          while (
            !this.check(TokenType.EOF) &&
            !this.check(TokenType.HEADER_SEPARATOR) &&
            !this.check(TokenType.PERCENT) &&
            !this.check(TokenType.VAR) &&
            !this.check(TokenType.FUN) &&
            !this.check(TokenType.TYPE)
          ) {
            const cur = this.peek();
            if (cur.type === TokenType.IDENT && (cur.value === 'output' || cur.value === 'input')) break;
            this.advance();
          }
        } else {
          this.advance();
        }
      }
      this.expect(TokenType.HEADER_SEPARATOR);
    }

    const body = this.parseExpression();
    this.expect(TokenType.EOF);
    return { type: 'Program', declarations, body };
  }

  private parseVarDeclaration(): AST.VariableDeclaration {
    const start = this.expect(TokenType.VAR);
    const name = this.expect(TokenType.IDENT).value;
    if (this.check(TokenType.COLON)) {
      this.advance();
      this.parseTypeAnnotation();
    }
    this.expect(TokenType.ASSIGN);
    const value = this.parseExpression();
    return { type: 'VariableDeclaration', name, value, line: start.line, column: start.column };
  }

  private parseFunDeclaration(): AST.FunctionDeclaration {
    const start = this.expect(TokenType.FUN);
    const name = this.expect(TokenType.IDENT).value;
    this.expect(TokenType.LPAREN);
    const params: AST.Identifier[] = [];
    while (!this.check(TokenType.RPAREN) && !this.check(TokenType.EOF)) {
      const p = this.expect(TokenType.IDENT);
      params.push({ type: 'Identifier', name: p.value, line: p.line, column: p.column });
      if (this.check(TokenType.COLON)) {
        this.advance();
        this.parseTypeAnnotation();
      }
      if (this.check(TokenType.COMMA)) this.advance();
    }
    this.expect(TokenType.RPAREN);
    if (this.check(TokenType.COLON)) {
      this.advance();
      this.parseTypeAnnotation();
    }
    this.expect(TokenType.ASSIGN);
    const body = this.parseExpression();
    return { type: 'FunctionDeclaration', name, params, body, line: start.line, column: start.column };
  }

  private parseTypeDeclaration(): AST.TypeDeclaration {
    const start = this.expect(TokenType.TYPE);
    const name = this.expect(TokenType.IDENT).value;
    this.expect(TokenType.ASSIGN);
    let def = '';
    let braceCount = 0;
    while (!this.check(TokenType.EOF)) {
      const tok = this.peek();
      if (braceCount === 0 && (
        tok.type === TokenType.VAR ||
        tok.type === TokenType.FUN ||
        tok.type === TokenType.TYPE ||
        tok.type === TokenType.HEADER_SEPARATOR
      )) {
        break;
      }
      if (tok.type === TokenType.LBRACE) braceCount++;
      if (tok.type === TokenType.RBRACE) braceCount--;
      def += ' ' + tok.value;
      this.advance();
    }
    return { type: 'TypeDeclaration', name, definition: def.trim(), line: start.line, column: start.column };
  }

  private parseTypeAnnotation(): void {
    let braceCount = 0;
    while (!this.check(TokenType.EOF)) {
      const tok = this.peek();
      if (braceCount === 0 && (
        tok.type === TokenType.ASSIGN ||
        tok.type === TokenType.RPAREN ||
        tok.type === TokenType.COMMA
      )) {
        break;
      }
      if (tok.type === TokenType.LBRACE) braceCount++;
      if (tok.type === TokenType.RBRACE) braceCount--;
      this.advance();
    }
  }

  // ── Precedence levels (low → high) ─────────────────────────────────────

  private parseExpression(): AST.Expression {
    return this.parsePipe();
  }

  /** pipe → infix ("|>" infix)* */
  private parsePipe(): AST.Expression {
    let left = this.parseDefault();
    while (this.check(TokenType.PIPE)) {
      this.advance();
      const right = this.parseDefault();
      left = { type: 'PipeExpression', left, right };
    }
    return left;
  }

  private parseDefault(): AST.Expression {
    let left = this.parseInfix();
    while (this.check(TokenType.DEFAULT)) {
      this.advance();
      const right = this.parseInfix();
      left = { type: 'DefaultExpression', expression: left, alternate: right };
    }
    return left;
  }

  /** infix → comparison (("map"|"filter"|"reduce") lambda)* */
  private parseInfix(): AST.Expression {
    let left = this.parseLogical();

    while (
      this.check(TokenType.MAP) ||
      this.check(TokenType.FILTER) ||
      this.check(TokenType.REDUCE)
    ) {
      const op = this.advance();
      const lambda = this.parseLambda();

      if (op.type === TokenType.MAP) {
        left = { type: 'MapExpression', source: left, lambda };
      } else if (op.type === TokenType.FILTER) {
        left = { type: 'FilterExpression', source: left, lambda };
      } else {
        left = { type: 'ReduceExpression', source: left, lambda };
      }
    }

    return left;
  }

  /** logical → comparison (("and"|"or") comparison)* */
  private parseLogical(): AST.Expression {
    let left = this.parseComparison();
    while (this.check(TokenType.AND) || this.check(TokenType.OR)) {
      const op = this.advance();
      const right = this.parseComparison();
      left = { type: 'BinaryExpression', operator: op.value, left, right };
    }
    return left;
  }

  /** comparison → range (compOp range)* */
  private parseComparison(): AST.Expression {
    let left = this.parseRange();
    while (
      this.check(TokenType.EQ) || this.check(TokenType.NEQ) ||
      this.check(TokenType.LT) || this.check(TokenType.LTE) ||
      this.check(TokenType.GT) || this.check(TokenType.GTE)
    ) {
      const op = this.advance();
      const right = this.parseRange();
      left = { type: 'BinaryExpression', operator: op.value, left, right };
    }
    return left;
  }

  /** range → additive ("to" additive)* */
  private parseRange(): AST.Expression {
    let left = this.parseAdditive();
    while (this.check(TokenType.TO)) {
      const op = this.advance();
      const right = this.parseAdditive();
      left = { type: 'BinaryExpression', operator: op.value, left, right };
    }
    return left;
  }

  /** additive → multiplicative (("+"|"-") multiplicative)* */
  private parseAdditive(): AST.Expression {
    let left = this.parseMultiplicative();
    while (this.check(TokenType.PLUS) || this.check(TokenType.PLUS_PLUS) || this.check(TokenType.MINUS)) {
      const op = this.advance();
      const right = this.parseMultiplicative();
      left = { type: 'BinaryExpression', operator: op.value, left, right };
    }
    return left;
  }

  /** multiplicative → unary (("*"|"/") unary)* */
  private parseMultiplicative(): AST.Expression {
    let left = this.parseUnary();
    while (this.check(TokenType.STAR) || this.check(TokenType.SLASH)) {
      const op = this.advance();
      const right = this.parseUnary();
      left = { type: 'BinaryExpression', operator: op.value, left, right };
    }
    return left;
  }

  /** unary → ("not"|"-") unary | postfix */
  private parseUnary(): AST.Expression {
    if (this.check(TokenType.NOT)) {
      const op = this.advance();
      return { type: 'UnaryExpression', operator: op.value, operand: this.parseUnary() };
    }
    if (this.check(TokenType.MINUS)) {
      this.advance();
      return { type: 'UnaryExpression', operator: '-', operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  /**
   * postfix → primary ("." IDENT | "[" expr "]" | "(" args ")")*
   *
   * Handles member access, computed index, and call expressions
   * with left-associativity.
   */
  private parsePostfix(): AST.Expression {
    let expr = this.parsePrimary();

    while (true) {
      if (this.check(TokenType.DOT)) {
        this.advance();
        const prop = this.expectPropName();
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: { type: 'Identifier', name: prop.value, line: prop.line, column: prop.column },
          line: prop.line,
          column: prop.column,
        };
      } else if (this.check(TokenType.LBRACKET)) {
        this.advance();
        const index = this.parseExpression();
        this.expect(TokenType.RBRACKET);
        expr = { type: 'IndexExpression', object: expr, index };
      } else if (this.check(TokenType.LPAREN)) {
        this.advance();
        const args = this.parseArgList(TokenType.RPAREN);
        this.expect(TokenType.RPAREN);
        expr = { type: 'CallExpression', callee: expr, arguments: args };
      } else if (this.check(TokenType.AS)) {
        const start = this.advance();
        const targetType = this.expect(TokenType.IDENT).value;
        let properties: AST.ObjectExpression | undefined = undefined;
        if (this.check(TokenType.LBRACE)) {
          properties = this.parseObjectExpression();
        }
        expr = { type: 'AsExpression', expression: expr, targetType, properties, line: start.line, column: start.column };
      } else if (this.check(TokenType.MATCH)) {
        const mTok = this.advance(); // consume `match`
        expr = this.parseMatchExpression(expr, mTok.line, mTok.column);
      } else {
        break;
      }
    }

    return expr;
  }

  // ── Primary expressions ─────────────────────────────────────────────────

  private parsePrimary(): AST.Expression {
    const tok = this.peek();

    // Number literal
    if (tok.type === TokenType.NUMBER) {
      this.advance();
      return { type: 'Literal', value: parseFloat(tok.value), raw: tok.value, line: tok.line, column: tok.column };
    }

    // String literal
    if (tok.type === TokenType.STRING) {
      this.advance();
      return { type: 'Literal', value: tok.value, raw: `"${tok.value}"`, line: tok.line, column: tok.column };
    }

    // Boolean literal
    if (tok.type === TokenType.BOOLEAN) {
      this.advance();
      return { type: 'Literal', value: tok.value === 'true', raw: tok.value, line: tok.line, column: tok.column };
    }

    // Null literal
    if (tok.type === TokenType.NULL) {
      this.advance();
      return { type: 'Literal', value: null, raw: 'null', line: tok.line, column: tok.column };
    }

    // Dollar / Double Dollar (Anonymous args)
    if (tok.type === TokenType.DOLLAR || tok.type === TokenType.DOUBLE_DOLLAR) {
      this.advance();
      return { type: 'AnonymousArgExpression', name: tok.value as '$' | '$$', line: tok.line, column: tok.column };
    }

    // Identifier — could also be the start of `ident -> body` (short arrow)
    if (tok.type === TokenType.IDENT) {
      this.advance();
      // Single-param short arrow: `x -> x * 2`
      if (this.check(TokenType.ARROW)) {
        this.advance();
        const body = this.parseExpression();
        return {
          type: 'ArrowFunction',
          params: [{ type: 'Identifier', name: tok.value, line: tok.line, column: tok.column }],
          body,
          line: tok.line,
          column: tok.column,
        };
      }
      return { type: 'Identifier', name: tok.value, line: tok.line, column: tok.column };
    }

    // Parenthesized expression or arrow function: ( ... )
    if (tok.type === TokenType.LPAREN) {
      return this.parseParenOrArrow();
    }

    // Object literal: { ... }
    if (tok.type === TokenType.LBRACE) {
      return this.parseObjectExpression();
    }

    // Array literal: [ ... ]
    if (tok.type === TokenType.LBRACKET) {
      return this.parseArrayExpression();
    }

    // If expression
    if (tok.type === TokenType.IF) {
      return this.parseIfExpression();
    }

    // Do block: do { var ... --- body }
    if (tok.type === TokenType.DO) {
      return this.parseDoExpression();
    }

    throw new ParseError(`Unexpected token "${tok.value}" (${tok.type})`, tok);
  }

  // ── Paren disambiguation ────────────────────────────────────────────────

  /**
   * Ambiguity: `(` can start:
   *   a) A grouped expression:      `(1 + 2)`
   *   b) An arrow function:         `(x) -> x + 1`
   *   c) A multi-param arrow:       `(x, y) -> x + y`
   *   d) The outer wrap in DataWeave style: `((x) -> x.name)`
   *
   * Strategy: speculatively try to parse arrow params. If we can consume
   * `IDENT (, IDENT)* )` and the next token is `->`, we have an arrow.
   * Otherwise backtrack and parse as a grouped expression.
   */
  private parseParenOrArrow(): AST.Expression {
    const openParen = this.expect(TokenType.LPAREN);

    // Empty parens must be an arrow: () -> expr
    if (this.check(TokenType.RPAREN)) {
      this.advance();
      this.expect(TokenType.ARROW);
      const body = this.parseExpression();
      return { type: 'ArrowFunction', params: [], body, line: openParen.line, column: openParen.column };
    }

    // Save position for backtracking
    const savedPos = this.pos;

    // Speculatively parse arrow params: IDENT (, IDENT)* )
    const maybeParams = this.tryParseArrowParams();

    if (maybeParams !== null && this.check(TokenType.ARROW)) {
      // Confirmed arrow function
      this.advance(); // consume ->
      const body = this.parseExpression();
      return { type: 'ArrowFunction', params: maybeParams, body, line: openParen.line, column: openParen.column };
    }

    // Not an arrow function — backtrack and parse as grouped expression
    this.pos = savedPos;
    const expr = this.parseExpression();
    this.expect(TokenType.RPAREN);
    return expr;
  }

  /**
   * Try to consume `IDENT (, IDENT)* )`.
   * Returns the param list on success, or null if the pattern doesn't match.
   * On failure the caller must restore `this.pos` to the saved position.
   */
  private tryParseArrowParams(): AST.Identifier[] | null {
    const params: AST.Identifier[] = [];

    while (true) {
      const tok = this.peek();
      if (tok.type !== TokenType.IDENT) return null;

      const paramNode: AST.Identifier = { type: 'Identifier', name: tok.value, line: tok.line, column: tok.column };
      this.advance();

      if (this.check(TokenType.ASSIGN)) {
        this.advance(); // consume =
        const valTok = this.peek();
        if (valTok.type === TokenType.NUMBER) {
          this.advance();
          paramNode.defaultValue = { type: 'Literal', value: Number(valTok.value), raw: valTok.value, line: valTok.line, column: valTok.column };
        } else if (valTok.type === TokenType.STRING) {
          this.advance();
          paramNode.defaultValue = { type: 'Literal', value: valTok.value, raw: `"${valTok.value}"`, line: valTok.line, column: valTok.column };
        } else if (valTok.type === TokenType.BOOLEAN) {
          this.advance();
          paramNode.defaultValue = { type: 'Literal', value: valTok.value === 'true', raw: valTok.value, line: valTok.line, column: valTok.column };
        } else if (valTok.type === TokenType.NULL) {
          this.advance();
          paramNode.defaultValue = { type: 'Literal', value: null, raw: 'null', line: valTok.line, column: valTok.column };
        } else {
          return null;
        }
      }

      params.push(paramNode);

      if (this.check(TokenType.COMMA)) {
        this.advance();
      } else if (this.check(TokenType.RPAREN)) {
        this.advance(); // consume closing )
        return params;
      } else {
        return null;
      }
    }
  }

  // ── Collection parsers ───────────────────────────────────────────────────

  private parseObjectExpression(): AST.ObjectExpression {
    const open = this.expect(TokenType.LBRACE);
    const properties: AST.Property[] = [];

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      const keyTok = this.peek();
      let key: AST.Identifier | AST.Literal;

      const isProp = keyTok.type === TokenType.IDENT || Object.values(KEYWORDS).includes(keyTok.type);

      if (isProp) {
        this.advance();
        key = { type: 'Identifier', name: keyTok.value, line: keyTok.line, column: keyTok.column };
      } else if (keyTok.type === TokenType.STRING) {
        this.advance();
        key = { type: 'Literal', value: keyTok.value, raw: `"${keyTok.value}"`, line: keyTok.line, column: keyTok.column };
      } else {
        throw new ParseError(`Expected property key (identifier or string)`, keyTok);
      }

      // Shorthand: `{ name }` → `{ name: name }`
      if (!this.check(TokenType.COLON)) {
        if (key.type !== 'Identifier') throw new ParseError('Shorthand only valid for identifier keys', keyTok);
        properties.push({ type: 'Property', key, value: key, shorthand: true });
      } else {
        this.expect(TokenType.COLON);
        const value = this.parseExpression();
        properties.push({ type: 'Property', key, value, shorthand: false });
      }

      if (this.check(TokenType.COMMA)) this.advance();
    }

    this.expect(TokenType.RBRACE);
    return { type: 'ObjectExpression', properties, line: open.line, column: open.column };
  }

  private parseArrayExpression(): AST.ArrayExpression {
    const open = this.expect(TokenType.LBRACKET);
    const elements = this.parseArgList(TokenType.RBRACKET);
    this.expect(TokenType.RBRACKET);
    return { type: 'ArrayExpression', elements, line: open.line, column: open.column };
  }

  private parseIfExpression(): AST.IfExpression {
    const kw = this.expect(TokenType.IF);
    this.expect(TokenType.LPAREN);
    const condition = this.parseExpression();
    this.expect(TokenType.RPAREN);
    const consequent = this.parseExpression();
    this.expect(TokenType.ELSE);
    const alternate = this.parseExpression();
    return { type: 'IfExpression', condition, consequent, alternate, line: kw.line, column: kw.column };
  }

  // ── Lambda helper ────────────────────────────────────────────────────────

  /**
   * Parses a lambda (ArrowFunction) expected after map/filter/reduce.
   * DataWeave allows both:
   *   - `((u) -> u.name)`   — outer parens wrap the arrow function
   *   - `(u) -> u.name`     — direct arrow (no outer parens)
   */
  private parseLambda(): AST.Expression {
    return this.parseExpression();
  }

  // ── do block ────────────────────────────────────────────────────────────────

  /**
   * Parse `do { declarations* --- body }`.
   * Creates a local scope with its own var/fun declarations.
   */
  private parseDoExpression(): AST.DoExpression {
    const start = this.expect(TokenType.DO);
    this.expect(TokenType.LBRACE);
    const declarations: AST.Declaration[] = [];
    while (
      !this.check(TokenType.HEADER_SEPARATOR) &&
      !this.check(TokenType.RBRACE) &&
      !this.check(TokenType.EOF)
    ) {
      if (this.check(TokenType.VAR)) {
        declarations.push(this.parseVarDeclaration());
      } else if (this.check(TokenType.FUN)) {
        declarations.push(this.parseFunDeclaration());
      } else {
        break; // unexpected token — will fail on expect(HEADER_SEPARATOR) below
      }
    }
    this.expect(TokenType.HEADER_SEPARATOR); // consume ---
    const body = this.parseExpression();
    this.expect(TokenType.RBRACE);
    return { type: 'DoExpression', declarations, body, line: start.line, column: start.column };
  }

  // ── match / case ──────────────────────────────────────────────────────────

  /**
   * Parse `match { case pattern (if guard)? -> body ... else -> body }`.
   * The subject has already been parsed; `match` token already consumed.
   *
   * Supported patterns:
   *   case <literal>                -> expr   (value equality)
   *   case is <TypeName>            -> expr   (type check)
   *   case is <TypeName> if (...)   -> expr   (type check + guard; $ = subject)
   *   else                          -> expr   (required catch-all)
   */
  private parseMatchExpression(subject: AST.Expression, line?: number, column?: number): AST.MatchExpression {
    this.expect(TokenType.LBRACE);
    const cases: AST.MatchCase[] = [];
    let elseBody: AST.Expression | null = null;

    while (!this.check(TokenType.RBRACE) && !this.check(TokenType.EOF)) {
      if (this.check(TokenType.ELSE)) {
        this.advance(); // else
        this.expect(TokenType.ARROW);
        elseBody = this.parseExpression();
      } else if (this.check(TokenType.CASE)) {
        this.advance(); // case

        let pattern: AST.MatchPattern;

        if (this.check(TokenType.IS)) {
          // `case is TypeName (if guard)?` — type check
          this.advance(); // is
          const typeName = this.expect(TokenType.IDENT).value;
          pattern = { kind: 'type', typeName };
        } else if (this.check(TokenType.IDENT) && this.peekAhead(1)?.type === TokenType.IF) {
          // `case q if condition` — named capture (binds value to `q` in guard + body)
          const name = this.advance().value;
          pattern = { kind: 'capture', name };
        } else if (this.check(TokenType.IDENT) && this.peekAhead(1)?.type === TokenType.ARROW) {
          // `case q ->` — named capture with no guard (always matches)
          const name = this.advance().value;
          pattern = { kind: 'capture', name };
        } else {
          // `case <literal>` — value equality match
          const value = this.parseAdditive();
          pattern = { kind: 'literal', value };
        }

        // Optional guard: `if (expr)` or `if expr` — name or $ refers to the matched value
        let guard: AST.Expression | undefined;
        if (this.check(TokenType.IF)) {
          this.advance(); // if
          const hasParen = this.check(TokenType.LPAREN);
          if (hasParen) this.advance();
          guard = this.parseExpression();
          if (hasParen) this.expect(TokenType.RPAREN);
        }

        this.expect(TokenType.ARROW);
        const body = this.parseExpression();
        cases.push({ pattern, guard, body });
      } else {
        this.advance(); // skip unexpected token
      }

      if (this.check(TokenType.COMMA)) this.advance();
    }

    this.expect(TokenType.RBRACE);

    if (elseBody === null) {
      throw new ParseError('match expression requires an `else` clause', this.peek());
    }

    return { type: 'MatchExpression', subject, cases, elseBody, line, column };
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  /** Parse a comma-separated list of expressions until `stopToken`. */
  private parseArgList(stopToken: TokenType): AST.Expression[] {
    const args: AST.Expression[] = [];
    while (!this.check(stopToken) && !this.check(TokenType.EOF)) {
      args.push(this.parseExpression());
      if (this.check(TokenType.COMMA)) this.advance();
    }
    return args;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1];
  }

  /** Look ahead by `offset` positions without consuming tokens. */
  private peekAhead(offset: number): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    if (tok.type !== TokenType.EOF) this.pos++;
    return tok;
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private expect(type: TokenType): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      throw new ParseError(`Expected ${type} but got ${tok.type}`, tok);
    }
    return this.advance();
  }

  private expectPropName(): Token {
    const tok = this.peek();
    const isProp = tok.type === TokenType.IDENT || Object.values(KEYWORDS).includes(tok.type);
    if (!isProp) {
      throw new ParseError(`Expected property name but got ${tok.type}`, tok);
    }
    return this.advance();
  }
}
