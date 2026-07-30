import type { DWObject, Value } from '../evaluator/environment.ts';
import { readZip, writeZip } from './zip.ts';

/**
 * XLSX (Office Open XML Spreadsheet) adapter — pure TypeScript, zero npm.
 *
 * XLSX files are ZIP archives containing XML files following the
 * Office Open XML specification (ECMA-376).
 *
 * Parse: accepts Uint8Array (raw XLSX bytes) → Value (array of objects or arrays)
 * Serialize: accepts Value → Promise<Uint8Array> (XLSX bytes)
 *
 * Supported cell types:
 *   n  = number (default)
 *   s  = shared string (index into sharedStrings.xml)
 *   b  = boolean
 *   str / inlineStr = inline string
 *   e  = error (returned as string)
 */

// ── Namespace ─────────────────────────────────────────────────────────────────

const XMLNS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XMLNS_REL =
  'http://schemas.openxmlformats.org/package/2006/relationships';
const XMLNS_CONTENT =
  'http://schemas.openxmlformats.org/package/2006/content-types';
const XMLNS_WORKBOOK_REL =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet';
const XMLNS_SHARED_STRINGS =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings';

// ── Minimal XML text extractor (no DOM parser needed in Deno) ──────────────────

/** Extract all text content between <tag ...> ... </tag> occurrences. */
function extractTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  const openRe = new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g');
  const closeTag = `</${tag}>`;
  let match: RegExpExecArray | null;
  while ((match = openRe.exec(xml)) !== null) {
    const start = match.index + match[0].length;
    const end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    results.push(xml.slice(start, end));
    openRe.lastIndex = end + closeTag.length;
  }
  return results;
}

/** Extract the value of an XML attribute. */
function attr(tag: string, attrName: string): string {
  const m = new RegExp(`\\b${attrName}="([^"]*)"`, 'i').exec(tag);
  return m ? m[1] : '';
}

/** Extract all self-closing or paired tags with their raw outer XML. */
function extractRawTags(xml: string, tag: string): string[] {
  const results: string[] = [];
  // Match both self-closing <tag .../> and paired <tag ...>...</tag>
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?(?:\\/>|>[\\s\\S]*?<\\/${tag}>)`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[0]);
  }
  return results;
}

/** Strip all XML tags from a string (get text content). */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/** Decode XML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Encode XML entities. */
function encodeEntities(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Column letter ↔ index conversion ─────────────────────────────────────────

/** Convert column letters (A, B, ..., Z, AA, ...) to 0-based index. */
function colLetterToIndex(letters: string): number {
  let result = 0;
  for (const ch of letters.toUpperCase()) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result - 1;
}

/** Convert 0-based column index to letters. */
function indexToColLetter(index: number): string {
  let letters = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** Parse cell reference like "A1" → { col: 0, row: 0 }. */
function parseCellRef(ref: string): { col: number; row: number } {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Invalid cell reference: ${ref}`);
  return { col: colLetterToIndex(m[1]), row: parseInt(m[2], 10) - 1 };
}

// ── XLSX Parser ───────────────────────────────────────────────────────────────

/**
 * Parse an XLSX file (as Uint8Array) into a Value.
 * Returns an array of objects if the first row is a header row,
 * otherwise returns an array of arrays.
 */
export async function parseXLSX(
  bytes: Uint8Array,
  options: { header?: boolean } = {},
): Promise<Value> {
  const entries = await readZip(bytes);
  const dec = new TextDecoder('utf-8');

  // Build a name→content map
  const files = new Map<string, string>();
  for (const e of entries) {
    files.set(e.name, dec.decode(e.data));
  }

  // Parse shared strings
  const sharedStrings: string[] = [];
  const ssXml = files.get('xl/sharedStrings.xml') ?? '';
  if (ssXml) {
    const siBlocks = extractTags(ssXml, 'si');
    for (const si of siBlocks) {
      // Handle both <t> and <r><t> (rich text)
      const tParts = extractTags(si, 't');
      const text = tParts.map((t) => decodeEntities(t)).join('');
      sharedStrings.push(text);
    }
  }

  // Find the first sheet XML
  // Check xl/_rels/workbook.xml.rels for sheet paths
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wbRels = files.get('xl/_rels/workbook.xml.rels') ?? '';
  if (wbRels) {
    const relRe =
      /<Relationship[^>]+Type="[^"]*\/worksheet"[^>]+Target="([^"]+)"/g;
    const m = relRe.exec(wbRels);
    if (m) {
      const target = m[1];
      sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    }
  }

  const sheetXml = files.get(sheetPath) ?? '';
  if (!sheetXml) {
    throw new Error(`XLSX: worksheet not found at "${sheetPath}"`);
  }

  // Parse rows
  // Build a sparse 2D grid: rows[rowIndex][colIndex] = cellValue
  const grid: Map<number, Map<number, Value>> = new Map();
  let maxRow = 0;
  let maxCol = 0;

  const rowTags = extractRawTags(sheetXml, 'row');
  for (const rowTag of rowTags) {
    const rowAttrR = attr(rowTag, 'r');
    const rowIndex = rowAttrR ? parseInt(rowAttrR, 10) - 1 : 0;
    if (rowIndex > maxRow) maxRow = rowIndex;

    const cellTags = extractRawTags(rowTag, 'c');
    for (const cellTag of cellTags) {
      const ref = attr(cellTag, 'r');
      const type = attr(cellTag, 't');
      if (!ref) continue;

      const { col, row } = parseCellRef(ref);
      if (col > maxCol) maxCol = col;

      let value: Value;

      if (type === 's') {
        // Shared string
        const vContent = extractTags(cellTag, 'v')[0] ?? '';
        const idx = parseInt(vContent, 10);
        value = sharedStrings[idx] ?? '';
      } else if (type === 'inlineStr') {
        const isContent = extractTags(cellTag, 'is')[0] ?? '';
        value = decodeEntities(stripTags(isContent));
      } else if (type === 'str') {
        const vContent = extractTags(cellTag, 'v')[0] ?? '';
        value = decodeEntities(vContent);
      } else if (type === 'b') {
        const vContent = extractTags(cellTag, 'v')[0] ?? '0';
        value = vContent.trim() === '1';
      } else if (type === 'e') {
        const vContent = extractTags(cellTag, 'v')[0] ?? '';
        value = `#ERROR: ${vContent}`;
      } else {
        // Number (default)
        const vContent = extractTags(cellTag, 'v')[0] ?? '';
        if (vContent.trim() === '') {
          value = null;
        } else {
          const n = parseFloat(vContent);
          value = isNaN(n) ? vContent : n;
        }
      }

      if (!grid.has(row)) grid.set(row, new Map());
      grid.get(row)!.set(col, value);
    }
  }

  // Convert sparse grid to dense array of arrays
  const rows: Value[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: Value[] = [];
    const rowMap = grid.get(r);
    for (let c = 0; c <= maxCol; c++) {
      row.push(rowMap?.get(c) ?? null);
    }
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const useHeader = options.header !== false;
  if (useHeader && rows.length >= 2) {
    const headers = rows[0].map((h) => (h === null ? '' : String(h)));
    return rows.slice(1).map((row): Value => {
      const obj: DWObject = {};
      headers.forEach((h, i) => {
        obj[h || String(i)] = row[i] ?? null;
      });
      return obj;
    });
  }

  return rows;
}

// ── XLSX Serializer ───────────────────────────────────────────────────────────

/**
 * Serialize a Value to XLSX bytes.
 * Accepts:
 *   - Array of Objects → header row derived from keys, data rows follow
 *   - Array of Arrays  → raw rows (no header inferred)
 *   - Scalar           → single cell in A1
 */
export function toXLSX(value: Value): Promise<Uint8Array> {
  // Normalise to rows: string[][]
  const rawRows: Value[][] = normaliseToRows(value);

  // Collect shared strings (strings are always stored in sharedStrings for
  // correct display of special characters and consistent round-trips)
  const sharedStrings: string[] = [];
  const ssIndex = new Map<string, number>();

  function internString(s: string): number {
    if (ssIndex.has(s)) return ssIndex.get(s)!;
    const idx = sharedStrings.length;
    sharedStrings.push(s);
    ssIndex.set(s, idx);
    return idx;
  }

  // Build cell data for the sheet
  interface CellData {
    ref: string;
    type: string; // 'n' | 's' | 'b' | 'inlineStr'
    value: string;
  }

  const cellMatrix: CellData[][] = rawRows.map((row, rowIdx) =>
    row.map((cell, colIdx): CellData => {
      const ref = `${indexToColLetter(colIdx)}${rowIdx + 1}`;
      if (cell === null || cell === undefined) {
        return { ref, type: 'n', value: '' };
      }
      if (typeof cell === 'boolean') {
        return { ref, type: 'b', value: cell ? '1' : '0' };
      }
      if (typeof cell === 'number') {
        return { ref, type: 'n', value: String(cell) };
      }
      // String
      const idx = internString(String(cell));
      return { ref, type: 's', value: String(idx) };
    })
  );

  // ── Generate XML files ─────────────────────────────────────────────────────

  const enc = new TextEncoder();

  // [Content_Types].xml
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${XMLNS_CONTENT}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  // _rels/.rels
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${XMLNS_REL}">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  // xl/_rels/workbook.xml.rels
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${XMLNS_REL}">
  <Relationship Id="rId1" Type="${XMLNS_WORKBOOK_REL}" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="${XMLNS_SHARED_STRINGS}" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // xl/workbook.xml
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${XMLNS_MAIN}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  // xl/styles.xml (minimal — required for Excel to open the file)
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${XMLNS_MAIN}">
  <fonts><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;

  // xl/sharedStrings.xml
  const ssEntries = sharedStrings
    .map((s) => `  <si><t>${encodeEntities(s)}</t></si>`)
    .join('\n');
  const sharedStringsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="${XMLNS_MAIN}" count="${sharedStrings.length}" uniqueCount="${sharedStrings.length}">
${ssEntries}
</sst>`;

  // xl/worksheets/sheet1.xml
  const sheetRows = cellMatrix
    .map((row, rowIdx) => {
      const cells = row
        .filter((c) => c.value !== '')
        .map((c) => {
          const tAttr = c.type !== 'n' ? ` t="${c.type}"` : '';
          return `      <c r="${c.ref}"${tAttr}><v>${
            encodeEntities(c.value)
          }</v></c>`;
        })
        .join('\n');
      return cells ? `    <row r="${rowIdx + 1}">\n${cells}\n    </row>` : null;
    })
    .filter(Boolean)
    .join('\n');

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${XMLNS_MAIN}">
  <sheetData>
${sheetRows}
  </sheetData>
</worksheet>`;

  // ── Pack into ZIP ──────────────────────────────────────────────────────────

  return writeZip([
    { name: '[Content_Types].xml', data: enc.encode(contentTypes) },
    { name: '_rels/.rels', data: enc.encode(rootRels) },
    { name: 'xl/workbook.xml', data: enc.encode(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRels) },
    { name: 'xl/styles.xml', data: enc.encode(styles) },
    { name: 'xl/sharedStrings.xml', data: enc.encode(sharedStringsXml) },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) },
  ]);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function normaliseToRows(value: Value): Value[][] {
  if (value === null || value === undefined) return [[]];

  if (!Array.isArray(value)) {
    // Scalar or object → single row
    if (typeof value === 'object') {
      const keys = Object.keys(value as DWObject);
      const vals = Object.values(value as DWObject) as Value[];
      return [keys, vals];
    }
    return [[value]];
  }

  const arr = value as Value[];
  if (arr.length === 0) return [];

  const first = arr[0];
  if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
    // Array of objects: first row = keys
    const allKeys = new Set<string>();
    for (const item of arr) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const k of Object.keys(item as DWObject)) allKeys.add(k);
      }
    }
    const keys = [...allKeys];
    const headerRow: Value[] = keys;
    const dataRows: Value[][] = arr.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return keys.map(() => null);
      }
      return keys.map((k) => (item as DWObject)[k] ?? null);
    });
    return [headerRow, ...dataRows];
  }

  if (Array.isArray(first)) {
    // Array of arrays
    return arr as Value[][];
  }

  // Array of scalars → single row
  return [arr];
}
