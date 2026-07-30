/**
 * Pure TypeScript / Deno ZIP reader and writer.
 * Zero npm dependencies — uses only the Web Streams API (DecompressionStream /
 * CompressionStream) which is available natively in Deno.
 *
 * Supports:
 *   - Reading: stored (method=0) and DEFLATE (method=8) entries
 *   - Writing: stored or DEFLATE entries (with CRC-32)
 */

// ── CRC-32 ────────────────────────────────────────────────────────────────────

const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── Little-endian helpers ─────────────────────────────────────────────────────

function readU16LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readU32LE(buf: Uint8Array, offset: number): number {
  return (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)) >>> 0;
}

function writeU16LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xFF;
  buf[offset + 1] = (value >>> 8) & 0xFF;
}

function writeU32LE(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xFF;
  buf[offset + 1] = (value >>> 8) & 0xFF;
  buf[offset + 2] = (value >>> 16) & 0xFF;
  buf[offset + 3] = (value >>> 24) & 0xFF;
}

// ── Async decompressor / compressor ──────────────────────────────────────────

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as Uint8Array<
      ArrayBuffer
    >,
  );
  writer.close();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value!);
  }
  return concat(chunks);
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();
  writer.write(
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) as Uint8Array<
      ArrayBuffer
    >,
  );
  writer.close();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value!);
  }
  return concat(chunks);
}

function concat(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ── ZIP Reader ────────────────────────────────────────────────────────────────

export interface ZipEntry {
  name: string;
  data: Uint8Array; // uncompressed
}

const SIG_LOCAL = 0x04034B50;
const SIG_CENTRAL = 0x02014B50;
const SIG_EOCD = 0x06054B50;

/** Read all entries from a ZIP archive (as Uint8Array). */
export async function readZip(zipData: Uint8Array): Promise<ZipEntry[]> {
  // Find EOCD by scanning backwards
  let eocdOffset = -1;
  for (let i = zipData.length - 22; i >= 0; i--) {
    if (readU32LE(zipData, i) === SIG_EOCD) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP: EOCD not found');

  const cdOffset = readU32LE(zipData, eocdOffset + 16);
  const cdCount = readU16LE(zipData, eocdOffset + 10);

  const entries: ZipEntry[] = [];
  let cdPos = cdOffset;

  for (let i = 0; i < cdCount; i++) {
    if (readU32LE(zipData, cdPos) !== SIG_CENTRAL) {
      throw new Error(
        `Invalid ZIP: expected Central Directory entry at ${cdPos}`,
      );
    }
    const method = readU16LE(zipData, cdPos + 10);
    const compressedSize = readU32LE(zipData, cdPos + 20);
    const uncompressedSize = readU32LE(zipData, cdPos + 24);
    const nameLen = readU16LE(zipData, cdPos + 28);
    const extraLen = readU16LE(zipData, cdPos + 30);
    const commentLen = readU16LE(zipData, cdPos + 32);
    const localHeaderOffset = readU32LE(zipData, cdPos + 42);

    const name = new TextDecoder().decode(
      zipData.slice(cdPos + 46, cdPos + 46 + nameLen),
    );
    cdPos += 46 + nameLen + extraLen + commentLen;

    // Skip directories
    if (name.endsWith('/')) continue;

    // Read local file header to get actual data offset
    if (readU32LE(zipData, localHeaderOffset) !== SIG_LOCAL) {
      throw new Error(
        `Invalid ZIP: expected Local File Header at ${localHeaderOffset}`,
      );
    }
    const localNameLen = readU16LE(zipData, localHeaderOffset + 26);
    const localExtraLen = readU16LE(zipData, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

    const compressedData = zipData.slice(
      dataOffset,
      dataOffset + compressedSize,
    );

    let uncompressedData: Uint8Array;
    if (method === 0) {
      // Stored
      uncompressedData = compressedData;
    } else if (method === 8) {
      // DEFLATE
      uncompressedData = await inflateRaw(compressedData);
    } else {
      throw new Error(`Unsupported ZIP compression method: ${method}`);
    }

    if (
      uncompressedData.length !== uncompressedSize && uncompressedSize !== 0
    ) {
      // Some ZIPs have 0 for size in central dir when using data descriptor — accept
    }

    entries.push({ name, data: uncompressedData });
  }

  return entries;
}

// ── ZIP Writer ────────────────────────────────────────────────────────────────

export interface ZipWriteEntry {
  name: string;
  data: Uint8Array; // uncompressed
  compress?: boolean; // default true
}

/** Build a ZIP archive from an array of entries. Returns the ZIP bytes. */
export async function writeZip(files: ZipWriteEntry[]): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // DOS epoch (1980-01-01 00:00:00) for modification time
  const dosDate = 0x4A21; // 2021-01-01
  const dosTime = 0x0000;

  interface LocalEntry {
    name: Uint8Array;
    method: number;
    crc: number;
    compressedData: Uint8Array;
    uncompressedSize: number;
    localOffset: number;
  }

  const localEntries: LocalEntry[] = [];
  const parts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const uncompressedSize = file.data.length;
    const checksum = crc32(file.data);

    let method: number;
    let compressedData: Uint8Array;

    if (file.compress !== false && uncompressedSize > 0) {
      compressedData = await deflateRaw(file.data);
      // If deflate made it larger, fall back to stored
      if (compressedData.length >= uncompressedSize) {
        method = 0;
        compressedData = file.data;
      } else {
        method = 8;
      }
    } else {
      method = 0;
      compressedData = file.data;
    }

    localEntries.push({
      name: nameBytes,
      method,
      crc: checksum,
      compressedData,
      uncompressedSize,
      localOffset,
    });

    // Local File Header (30 bytes + name)
    const lfh = new Uint8Array(30 + nameBytes.length);
    writeU32LE(lfh, 0, SIG_LOCAL);
    writeU16LE(lfh, 4, 20); // version needed
    writeU16LE(lfh, 6, 0); // flags
    writeU16LE(lfh, 8, method);
    writeU16LE(lfh, 10, dosTime);
    writeU16LE(lfh, 12, dosDate);
    writeU32LE(lfh, 14, checksum);
    writeU32LE(lfh, 18, compressedData.length);
    writeU32LE(lfh, 22, uncompressedSize);
    writeU16LE(lfh, 26, nameBytes.length);
    writeU16LE(lfh, 28, 0); // extra field length
    lfh.set(nameBytes, 30);

    parts.push(lfh, compressedData);
    localOffset += lfh.length + compressedData.length;
  }

  // Central Directory
  const cdParts: Uint8Array[] = [];
  const cdOffset = localOffset;

  for (const e of localEntries) {
    const cde = new Uint8Array(46 + e.name.length);
    writeU32LE(cde, 0, SIG_CENTRAL);
    writeU16LE(cde, 4, 20); // version made by
    writeU16LE(cde, 6, 20); // version needed
    writeU16LE(cde, 8, 0); // flags
    writeU16LE(cde, 10, e.method);
    writeU16LE(cde, 12, dosTime);
    writeU16LE(cde, 14, dosDate);
    writeU32LE(cde, 16, e.crc);
    writeU32LE(cde, 20, e.compressedData.length);
    writeU32LE(cde, 24, e.uncompressedSize);
    writeU16LE(cde, 28, e.name.length);
    writeU16LE(cde, 30, 0); // extra field
    writeU16LE(cde, 32, 0); // comment
    writeU16LE(cde, 34, 0); // disk start
    writeU16LE(cde, 36, 0); // internal attr
    writeU32LE(cde, 38, 0); // external attr
    writeU32LE(cde, 42, e.localOffset);
    cde.set(e.name, 46);
    cdParts.push(cde);
  }

  const cdData = concat(cdParts);

  // End of Central Directory
  const eocd = new Uint8Array(22);
  writeU32LE(eocd, 0, SIG_EOCD);
  writeU16LE(eocd, 4, 0); // disk number
  writeU16LE(eocd, 6, 0); // start disk
  writeU16LE(eocd, 8, localEntries.length);
  writeU16LE(eocd, 10, localEntries.length);
  writeU32LE(eocd, 12, cdData.length);
  writeU32LE(eocd, 16, cdOffset);
  writeU16LE(eocd, 20, 0); // comment length

  return concat([...parts, cdData, eocd]);
}
