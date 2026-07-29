/**
 * Formatter-only lexer for DataWeave (.dwl) files.
 *
 * This is a self-contained scanner that lives exclusively inside
 * `src/formatter/` and is NEVER imported by the evaluator pipeline.
 * Its single responsibility is to produce a token stream that
 * PRESERVES whitespace structure and comments, which the core
 * lexer intentionally discards.
 *
 * Token kinds emitted:
 *   LINE_COMMENT   // …
 *   BLOCK_COMMENT  /* … *\/
 *   NEWLINE        \n
 *   WHITESPACE     one or more spaces/tabs on a single line
 *   WORD           any other contiguous non-whitespace run
 */

export const enum FmtTok {
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',
  NEWLINE = 'NEWLINE',
  WHITESPACE = 'WHITESPACE',
  // ── structural tokens the pretty-printer cares about ────────────
  LBRACE = 'LBRACE', // {
  RBRACE = 'RBRACE', // }
  LPAREN = 'LPAREN', // (
  RPAREN = 'RPAREN', // )
  LBRACKET = 'LBRACKET', // [
  RBRACKET = 'RBRACKET', // ]
  HEADER_SEP = 'HEADER_SEP', // ---
  WORD = 'WORD', // everything else
  EOF = 'EOF',
}

export interface FmtToken {
  kind: FmtTok;
  text: string;
  line: number;
}

export function tokenizeFmt(source: string): FmtToken[] {
  const tokens: FmtToken[] = [];
  let pos = 0;
  let line = 1;

  function peek(offset = 0): string {
    return source[pos + offset] ?? '';
  }

  function advance(): string {
    const ch = source[pos++];
    return ch;
  }

  function emit(kind: FmtTok, text: string, atLine: number) {
    tokens.push({ kind, text, line: atLine });
  }

  while (pos < source.length) {
    const startLine = line;
    const ch = peek();

    // ── Newline ──────────────────────────────────────────────────────────
    if (ch === '\n') {
      advance();
      emit(FmtTok.NEWLINE, '\n', startLine);
      line++;
      continue;
    }

    // ── Horizontal whitespace ────────────────────────────────────────────
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      let ws = '';
      while (
        pos < source.length &&
        (peek() === ' ' || peek() === '\t' || peek() === '\r')
      ) {
        ws += advance();
      }
      emit(FmtTok.WHITESPACE, ws, startLine);
      continue;
    }

    // ── Line comment // ──────────────────────────────────────────────────
    if (ch === '/' && peek(1) === '/') {
      let text = '';
      while (pos < source.length && peek() !== '\n') {
        text += advance();
      }
      emit(FmtTok.LINE_COMMENT, text, startLine);
      continue;
    }

    // ── Block comment /* … */ ────────────────────────────────────────────
    if (ch === '/' && peek(1) === '*') {
      let text = advance() + advance(); // /*
      while (pos < source.length) {
        if (peek() === '*' && peek(1) === '/') {
          text += advance() + advance(); // */
          break;
        }
        const c = advance();
        if (c === '\n') line++;
        text += c;
      }
      emit(FmtTok.BLOCK_COMMENT, text, startLine);
      continue;
    }

    // ── String literals (preserve verbatim, including quotes) ────────────
    if (ch === '"' || ch === "'") {
      const quote = advance();
      let text = quote;
      while (pos < source.length && peek() !== quote) {
        if (peek() === '\\') {
          text += advance(); // backslash
          text += advance(); // escaped char
        } else {
          const c = advance();
          if (c === '\n') line++;
          text += c;
        }
      }
      if (pos < source.length) text += advance(); // closing quote
      emit(FmtTok.WORD, text, startLine);
      continue;
    }

    // ── Temporal / Period literals |…| ───────────────────────────────────
    if (ch === '|' && peek(1) !== '>') {
      let text = advance(); // opening |
      while (pos < source.length && peek() !== '|') {
        text += advance();
      }
      if (pos < source.length) text += advance(); // closing |
      emit(FmtTok.WORD, text, startLine);
      continue;
    }

    // ── Structural tokens ────────────────────────────────────────────────
    if (ch === '{') {
      advance();
      emit(FmtTok.LBRACE, '{', startLine);
      continue;
    }
    if (ch === '}') {
      advance();
      emit(FmtTok.RBRACE, '}', startLine);
      continue;
    }
    if (ch === '(') {
      advance();
      emit(FmtTok.LPAREN, '(', startLine);
      continue;
    }
    if (ch === ')') {
      advance();
      emit(FmtTok.RPAREN, ')', startLine);
      continue;
    }
    if (ch === '[') {
      advance();
      emit(FmtTok.LBRACKET, '[', startLine);
      continue;
    }
    if (ch === ']') {
      advance();
      emit(FmtTok.RBRACKET, ']', startLine);
      continue;
    }

    // ── Header separator --- ─────────────────────────────────────────────
    if (ch === '-' && peek(1) === '-' && peek(2) === '-') {
      advance();
      advance();
      advance();
      emit(FmtTok.HEADER_SEP, '---', startLine);
      continue;
    }

    // ── Identifiers / keywords: consume a full alphanumeric run as WORD ──
    if (
      (ch >= 'a' && ch <= 'z') ||
      (ch >= 'A' && ch <= 'Z') ||
      ch === '_' ||
      ch === '$'
    ) {
      let text = '';
      while (pos < source.length) {
        const c = peek();
        if (
          (c >= 'a' && c <= 'z') ||
          (c >= 'A' && c <= 'Z') ||
          (c >= '0' && c <= '9') ||
          c === '_' ||
          c === '$'
        ) {
          text += advance();
        } else {
          break;
        }
      }
      emit(FmtTok.WORD, text, startLine);
      continue;
    }

    // ── Everything else: consume a single char as WORD ───────────────────
    emit(FmtTok.WORD, advance(), startLine);
  }

  emit(FmtTok.EOF, '', line);
  return tokens;
}
