/**
 * DataWeave (.dwl) pretty-printer.
 *
 * Strategy
 * ────────
 * 1. Tokenise the source with the formatter-local lexer (preserves comments).
 * 2. Walk the flat token stream and rebuild the file line-by-line, tracking
 *    indentation depth by counting opening / closing brackets/braces/parens
 *    throughout the entire file (header and body alike).
 * 3. "Boosted" blocks: when a line ends with a pending-indent trigger
 *    (`=`, `if (...)`, bare `else`) and the NEXT line starts with an opening
 *    bracket, that bracket is printed at depth+1 AND its depth-slot is marked
 *    as boosted.  The matching closing bracket pops two depth levels so the
 *    surrounding code returns to the correct depth.
 *
 * Pending-indent triggers:
 *   - Line ends with standalone `=`          → function-body continuation
 *   - Line's first token is `if`, last is `)` → if-condition block
 *   - Line's sole content token is `else`     → else branch
 *
 * What it normalises
 * ──────────────────
 * - Consistent 2-space indentation everywhere.
 * - Source blank lines preserved (at most 1 consecutive).
 * - Trailing whitespace stripped from every line.
 * - Single trailing newline at end of file.
 * - ALL comments (line and block) preserved in their original position.
 *
 * What it does NOT change
 * ────────────────────────
 * - Internal spacing within a line (operator spacing, etc.).
 * - String content / Temporal literals.
 */

import { FmtTok, FmtToken, tokenizeFmt } from './lexer.ts';

const INDENT = '  '; // 2 spaces

const OPENERS = new Set([FmtTok.LBRACE, FmtTok.LPAREN, FmtTok.LBRACKET]);
const CLOSERS = new Set([FmtTok.RBRACE, FmtTok.RPAREN, FmtTok.RBRACKET]);

export function format(source: string): string {
  const tokens = tokenizeFmt(source);

  // ── Build logical lines ────────────────────────────────────────────────────
  const sourceLines: FmtToken[][] = [];
  let cur: FmtToken[] = [];
  for (const tok of tokens) {
    if (tok.kind === FmtTok.EOF) break;
    if (tok.kind === FmtTok.NEWLINE) {
      sourceLines.push(cur);
      cur = [];
    } else {
      cur.push(tok);
    }
  }
  if (cur.length > 0) sourceLines.push(cur);

  // ── Pass 1: strip trailing whitespace ─────────────────────────────────────
  const cleanLines = sourceLines.map((line) => {
    while (
      line.length > 0 && line[line.length - 1].kind === FmtTok.WHITESPACE
    ) {
      line.pop();
    }
    return line;
  });

  // ── Pass 2: rebuild with correct indentation ──────────────────────────────
  let depth = 0;
  let pendingIndent = false;
  // For each currently-open bracket: true = opened while pendingIndent was set
  // ("boosted"). The matching closing bracket must pop two depth levels.
  const bracketStack: boolean[] = [];

  let prevWasBlank = false;
  let inHeader = true; // true until first `---` at depth 0

  const outputLines: string[] = [];

  for (const line of cleanLines) {
    const content = line.filter((t) => t.kind !== FmtTok.WHITESPACE);

    // ── Blank line ────────────────────────────────────────────────────────
    if (content.length === 0) {
      if (!prevWasBlank) {
        outputLines.push('');
        prevWasBlank = true;
      }
      continue;
    }
    prevWasBlank = false;

    const first = content[0];
    const last = content[content.length - 1];
    const prev = content.length >= 2 ? content[content.length - 2] : null;

    // ── Detect top-level header separator ─────────────────────────────────
    if (first.kind === FmtTok.HEADER_SEP && depth === 0) {
      inHeader = false;
    }

    // ── Pre-print: adjust depth for first-token closers ───────────────────
    let closerWasBoosted = false;
    if (CLOSERS.has(first.kind)) {
      closerWasBoosted = bracketStack.pop() ?? false;
      depth = Math.max(0, depth - 1);
      pendingIndent = false;
    }

    // ── Apply pendingIndent to this line ──────────────────────────────────
    let extraIndent = 0;
    let boostingThisOpener = false;
    if (
      pendingIndent &&
      first.kind !== FmtTok.HEADER_SEP &&
      !CLOSERS.has(first.kind)
    ) {
      extraIndent = 1;
      pendingIndent = false;
      if (OPENERS.has(first.kind)) {
        boostingThisOpener = true;
      }
    }

    // ── Build line text (collapse inter-token whitespace to single space) ──
    let lineText = '';
    let afterContent = false;
    let prevTokForSpace: FmtToken | null = null;

    for (const tok of line) {
      if (tok.kind === FmtTok.WHITESPACE) {
        if (afterContent && !lineText.endsWith(' ')) lineText += ' ';
        continue;
      }

      // Basic auto-spacing rules for glued tokens
      if (prevTokForSpace) {
        const pText = prevTokForSpace.text;

        if (pText === ',' && !lineText.endsWith(' ')) {
          lineText += ' ';
        } else if (pText === ':') {
          // Do not add space if we are in the middle of or just after a double colon (::)
          if (
            tok.text !== ':' && !lineText.endsWith('::') &&
            !lineText.endsWith(' ')
          ) {
            lineText += ' ';
          }
        }

        // Space inside braces if on the same line
        if (prevTokForSpace.kind === FmtTok.LBRACE && !lineText.endsWith(' ')) {
          lineText += ' ';
        }
        if (
          tok.kind === FmtTok.RBRACE && !lineText.endsWith(' ') && pText !== '{'
        ) {
          lineText += ' ';
        }
      }

      lineText += tok.text;
      afterContent = true;
      prevTokForSpace = tok;
    }

    // ── Emit the line ──────────────────────────────────────────────────────
    outputLines.push(INDENT.repeat(depth + extraIndent) + lineText.trimStart());

    // ── Post-print: update depth & bracketStack ────────────────────────────
    const depthBeforePostLoop = depth;
    for (const tok of content) {
      if (OPENERS.has(tok.kind)) {
        const isBoosted = boostingThisOpener && tok === first;
        bracketStack.push(isBoosted);
        depth++;
        if (isBoosted) depth++; // extra level so content of boosted block indents correctly
        boostingThisOpener = false; // only boost the first opener on the line
      } else if (CLOSERS.has(tok.kind) && tok !== first) {
        const boost = bracketStack.pop() ?? false;
        depth = Math.max(0, depth - 1);
        if (boost) depth = Math.max(0, depth - 1);
      }
    }

    // ── Post-print: extra depth-down for boosted first-token closer ────────
    if (CLOSERS.has(first.kind) && closerWasBoosted) {
      depth = Math.max(0, depth - 1);
    }

    // ── Detect pendingIndent triggers ──────────────────────────────────────
    // Guard for compound operators that end with `=`: ==, !=, <=, >=
    const prevIsCompoundPrefix = prev?.kind === FmtTok.WORD &&
      ['=', '!', '<', '>'].includes(prev.text);
    // Net bracket balance for this line (0 = balanced, >0 = unclosed openers)
    const netDepthChange = depth - depthBeforePostLoop;

    if (
      last.kind === FmtTok.WORD && last.text === '=' && !prevIsCompoundPrefix
    ) {
      // 1. Standalone `=` — function body on next line
      pendingIndent = true;
    } else if (
      first.kind === FmtTok.WORD && first.text === 'if' &&
      last.kind === FmtTok.RPAREN
    ) {
      // 2. `if (condition)` ending this line
      pendingIndent = true;
    } else if (
      content.length === 1 &&
      first.kind === FmtTok.WORD && first.text === 'else'
    ) {
      // 3. Bare `else` on its own line
      pendingIndent = true;
    } else if (
      last.kind === FmtTok.WORD && last.text === '>' &&
      prev?.kind === FmtTok.WORD && prev.text === '-' &&
      netDepthChange === 0
    ) {
      // 4. Lambda `->` at end of line with balanced brackets
      //    (guards against `map ((emp) ->` which leaves an unclosed paren)
      pendingIndent = true;
    }

    // Suppress unused variable warning
    void inHeader;
  }

  // ── Strip trailing blank lines & add single final newline ─────────────────
  while (
    outputLines.length > 0 &&
    outputLines[outputLines.length - 1].trim() === ''
  ) {
    outputLines.pop();
  }

  return outputLines.join('\n') + '\n';
}
