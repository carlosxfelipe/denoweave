/**
 * DenoWeave Transformation Engine
 * Entry point — Phase 1 demo.
 *
 * Run: deno run src/mod.ts
 */

import { Lexer } from './lexer/lexer.ts';

const src = `payload.users map ((u) -> {
  name: upper(u.name),
  active: u.enabled
})`;

console.log('=== DenoWeave Engine — Lexer Demo ===\n');
console.log('Source:\n', src, '\n');

const tokens = new Lexer(src).tokenize();

console.log('Tokens:');
for (const tok of tokens) {
  if (tok.type !== 'EOF') {
    console.log(`  [${String(tok.line).padStart(2)}:${String(tok.column).padStart(2)}]  ${tok.type.padEnd(14)} "${tok.value}"`);
  }
}
console.log('\n✓ Lexer phase complete.');
