import { createToken, KEYWORDS, Token, TokenType } from './token.ts';

/**
 * Lexer for the DataWeave-inspired DSL.
 *
 * Converts raw source code into a flat list of Tokens.
 * The lexer is a simple single-pass scanner with one character of lookahead.
 */
export class Lexer {
  private readonly source: string;
  private pos: number = 0; // current position (points to current char)
  private line: number = 1;
  private column: number = 1;

  constructor(source: string) {
    this.source = source;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Tokenise the entire source and return all tokens (including EOF). */
  tokenize(): Token[] {
    const tokens: Token[] = [];
    let tok: Token;
    do {
      tok = this.nextToken();
      tokens.push(tok);
    } while (tok.type !== TokenType.EOF);
    return tokens;
  }

  // ── Core scanner ────────────────────────────────────────────────────────

  private nextToken(): Token {
    this.skipWhitespaceAndComments();

    if (this.isEOF()) {
      return this.makeToken(TokenType.EOF, '', this.line, this.column);
    }

    const startLine = this.line;
    const startCol = this.column;
    const ch = this.peek();

    // ── Numbers ───────────────────────────────────────────────────────────
    if (this.isDigit(ch)) return this.readNumber(startLine, startCol);

    // ── Strings ───────────────────────────────────────────────────────────
    if (ch === '"' || ch === "'") return this.readString(startLine, startCol);

    // ── Identifiers and keywords ──────────────────────────────────────────
    if (this.isAlpha(ch)) return this.readIdentOrKeyword(startLine, startCol);

    // ── Multi/single character operators & punctuation ────────────────────
    return this.readSymbol(startLine, startCol);
  }

  // ── Readers ─────────────────────────────────────────────────────────────

  private readNumber(line: number, col: number): Token {
    let value = '';
    while (
      !this.isEOF() && (this.isDigit(this.peek()) || this.peek() === '.')
    ) {
      // Avoid consuming a second dot (e.g. `..` operator)
      if (this.peek() === '.' && this.peekAhead(1) === '.') break;
      value += this.advance();
    }
    return this.makeToken(TokenType.NUMBER, value, line, col);
  }

  private readString(line: number, col: number): Token {
    const quote = this.advance(); // consume opening quote
    let value = '';
    while (!this.isEOF() && this.peek() !== quote) {
      if (this.peek() === '\\') {
        this.advance(); // skip backslash
        const escaped = this.advance();
        value += this.unescape(escaped);
      } else {
        value += this.advance();
      }
    }
    if (!this.isEOF()) this.advance(); // consume closing quote
    return this.makeToken(TokenType.STRING, value, line, col);
  }

  private readIdentOrKeyword(line: number, col: number): Token {
    let value = '';
    while (
      !this.isEOF() && (this.isAlphaNumeric(this.peek()) || this.peek() === '_')
    ) {
      value += this.advance();
    }
    const kwType = KEYWORDS[value];
    if (kwType !== undefined) {
      return this.makeToken(kwType, value, line, col);
    }
    return this.makeToken(TokenType.IDENT, value, line, col);
  }

  private readSymbol(line: number, col: number): Token {
    const ch = this.advance();

    switch (ch) {
      case '.': {
        if (this.peek() === '.') {
          this.advance();
          return this.makeToken(TokenType.DOTDOT, '..', line, col);
        }
        return this.makeToken(TokenType.DOT, '.', line, col);
      }
      case '%':
        return this.makeToken(TokenType.PERCENT, '%', line, col);
      case '-': {
        if (this.peek() === '-' && this.peekAhead(1) === '-') {
          this.advance();
          this.advance();
          return this.makeToken(TokenType.HEADER_SEPARATOR, '---', line, col);
        }
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.ARROW, '->', line, col);
        }
        return this.makeToken(TokenType.MINUS, '-', line, col);
      }
      case '=': {
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.FAT_ARROW, '=>', line, col);
        }
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.EQ, '==', line, col);
        }
        return this.makeToken(TokenType.ASSIGN, '=', line, col);
      }
      case '!': {
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.NEQ, '!=', line, col);
        }
        return this.makeToken(TokenType.ILLEGAL, '!', line, col);
      }
      case '<': {
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.LTE, '<=', line, col);
        }
        return this.makeToken(TokenType.LT, '<', line, col);
      }
      case '>': {
        if (this.peek() === '=') {
          this.advance();
          return this.makeToken(TokenType.GTE, '>=', line, col);
        }
        return this.makeToken(TokenType.GT, '>', line, col);
      }
      case '|': {
        if (this.peek() === '>') {
          this.advance();
          return this.makeToken(TokenType.PIPE, '|>', line, col);
        }

        // Temporal literal (Date or Period)
        let content = '';
        while (!this.isEOF() && this.peek() !== '|') {
          content += this.advance();
        }

        if (this.isEOF()) {
          return this.makeToken(TokenType.ILLEGAL, '|' + content, line, col);
        }

        this.advance(); // consume closing '|'

        // Period literals in ISO 8601 start with P or -P (e.g., P1Y, -P1D)
        const isPeriod = content.startsWith('P') || content.startsWith('-P') ||
          content.startsWith('+P');
        const type = isPeriod
          ? TokenType.PERIOD_LITERAL
          : TokenType.DATE_LITERAL;

        return this.makeToken(type, content, line, col);
      }
      case '+': {
        if (this.peek() === '+') {
          this.advance();
          return this.makeToken(TokenType.PLUS_PLUS, '++', line, col);
        }
        return this.makeToken(TokenType.PLUS, '+', line, col);
      }
      case '*':
        return this.makeToken(TokenType.STAR, '*', line, col);
      case '/':
        return this.makeToken(TokenType.SLASH, '/', line, col);
      case ':':
        return this.makeToken(TokenType.COLON, ':', line, col);
      case ',':
        return this.makeToken(TokenType.COMMA, ',', line, col);
      case ';':
        return this.makeToken(TokenType.SEMICOLON, ';', line, col);
      case '(':
        return this.makeToken(TokenType.LPAREN, '(', line, col);
      case ')':
        return this.makeToken(TokenType.RPAREN, ')', line, col);
      case '{':
        return this.makeToken(TokenType.LBRACE, '{', line, col);
      case '}':
        return this.makeToken(TokenType.RBRACE, '}', line, col);
      case '[':
        return this.makeToken(TokenType.LBRACKET, '[', line, col);
      case ']':
        return this.makeToken(TokenType.RBRACKET, ']', line, col);
      default:
        return this.makeToken(TokenType.ILLEGAL, ch, line, col);
    }
  }

  // ── Whitespace & Comments ────────────────────────────────────────────────

  private skipWhitespaceAndComments(): void {
    while (!this.isEOF()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.advance();
      } else if (ch === '\n') {
        this.advance();
        this.line++;
        this.column = 1;
      } else if (ch === '/' && this.peekAhead(1) === '/') {
        // Single-line comment — skip until end of line
        while (!this.isEOF() && this.peek() !== '\n') this.advance();
      } else if (ch === '/' && this.peekAhead(1) === '*') {
        // Multi-line comment
        this.advance();
        this.advance(); // skip /*
        while (!this.isEOF()) {
          if (this.peek() === '*' && this.peekAhead(1) === '/') {
            this.advance();
            this.advance(); // skip */
            break;
          }
          if (this.peek() === '\n') {
            this.line++;
            this.column = 1;
          }
          this.advance();
        }
      } else {
        break;
      }
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private peek(): string {
    return this.source[this.pos] ?? '';
  }

  private peekAhead(offset: number): string {
    return this.source[this.pos + offset] ?? '';
  }

  private advance(): string {
    const ch = this.source[this.pos++];
    this.column++;
    return ch;
  }

  private isEOF(): boolean {
    return this.pos >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isAlpha(ch: string): boolean {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' ||
      ch === '$';
  }

  private isAlphaNumeric(ch: string): boolean {
    return this.isAlpha(ch) || this.isDigit(ch);
  }

  private unescape(ch: string): string {
    switch (ch) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case '"':
        return '"';
      case "'":
        return "'";
      case '\\':
        return '\\';
      default:
        return ch;
    }
  }

  private makeToken(
    type: TokenType,
    value: string,
    line: number,
    column: number,
  ): Token {
    return createToken(type, value, line, column);
  }
}
