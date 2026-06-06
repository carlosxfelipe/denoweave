import type { DWObject, Value } from '../evaluator/environment.ts';

// ── Data model ────────────────────────────────────────────────────────────────

export interface XmlElement {
  _tag: string;
  _attrs: Record<string, string>;
  _text: string;
  _children: XmlElement[];
}

// ── Parser ────────────────────────────────────────────────────────────────────

/** Parse an XML string into an XmlElement tree (as Value / DWObject). */
export function parseXML(input: string): Value {
  const p = new XmlParser(input.trim());
  return p.parse() as unknown as Value;
}

class XmlParser {
  private src: string;
  private pos: number = 0;

  constructor(src: string) { this.src = src; }

  parse(): XmlElement {
    this.skipProlog();
    return this.parseElement();
  }

  private skipProlog(): void {
    // Skip XML declaration and doctype
    while (this.pos < this.src.length) {
      this.skipWhitespace();
      if (this.src.startsWith('<?', this.pos)) {
        this.pos = this.src.indexOf('?>', this.pos) + 2;
      } else if (this.src.startsWith('<!DOCTYPE', this.pos)) {
        this.pos = this.src.indexOf('>', this.pos) + 1;
      } else break;
    }
  }

  private parseElement(): XmlElement {
    this.skipWhitespace();
    this.consume('<');
    const tag = this.readName();
    const attrs = this.readAttributes();

    if (this.src[this.pos] === '/') {
      this.pos += 2; // />
      return { _tag: tag, _attrs: attrs, _text: '', _children: [] };
    }
    this.consume('>');

    const { text, children } = this.readContent(tag);
    return { _tag: tag, _attrs: attrs, _text: text.trim(), _children: children };
  }

  private readContent(parentTag: string): { text: string; children: XmlElement[] } {
    let text = '';
    const children: XmlElement[] = [];

    while (this.pos < this.src.length) {
      if (this.src.startsWith('</', this.pos)) {
        this.pos += 2;
        this.readName(); // closing tag name (ignored, we trust well-formed XML)
        this.skipWhitespace();
        this.consume('>');
        break;
      } else if (this.src.startsWith('<!--', this.pos)) {
        this.pos = this.src.indexOf('-->', this.pos) + 3;
      } else if (this.src.startsWith('<![CDATA[', this.pos)) {
        const end = this.src.indexOf(']]>', this.pos + 9);
        text += this.src.substring(this.pos + 9, end);
        this.pos = end + 3;
      } else if (this.src[this.pos] === '<') {
        children.push(this.parseElement());
      } else {
        text += this.src[this.pos++];
      }
    }

    return { text, children };
  }

  private readAttributes(): Record<string, string> {
    const attrs: Record<string, string> = {};
    this.skipWhitespace();
    while (this.pos < this.src.length && this.src[this.pos] !== '>' && this.src[this.pos] !== '/') {
      const name = this.readName();
      this.skipWhitespace();
      if (this.src[this.pos] === '=') {
        this.pos++;
        this.skipWhitespace();
        const q = this.src[this.pos++];
        const end = this.src.indexOf(q, this.pos);
        attrs[name] = this.src.substring(this.pos, end);
        this.pos = end + 1;
      } else {
        attrs[name] = name; // boolean attribute
      }
      this.skipWhitespace();
    }
    return attrs;
  }

  private readName(): string {
    const start = this.pos;
    while (this.pos < this.src.length && /[\w\-:.]/i.test(this.src[this.pos])) this.pos++;
    return this.src.substring(start, this.pos);
  }

  private skipWhitespace(): void {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }

  private consume(char: string): void {
    if (this.src[this.pos] !== char) {
      throw new Error(`XML parse error: expected '${char}' at pos ${this.pos}, got '${this.src[this.pos]}'`);
    }
    this.pos++;
  }
}

// ── Serializer ────────────────────────────────────────────────────────────────

/** Serialize a Value (XmlElement-shaped DWObject or plain object) to XML. */
export function toXML(value: Value, indent: number = 2): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const el = value as DWObject;
    if (typeof el['_tag'] === 'string') {
      return serializeElement(el as unknown as XmlElement, 0, indent);
    }
    // Plain object → wrap in <root>
    return serializePlain('root', el, 0, indent);
  }
  if (Array.isArray(value)) {
    const lines = (value as Value[]).map((v, i) =>
      toXML(v, indent).replace('<root>', `<item index="${i}">`)
                      .replace('</root>', '</item>')
    );
    return `<items>\n${lines.join('\n')}\n</items>`;
  }
  return `<value>${escapeXml(String(value))}</value>`;
}

function serializeElement(el: XmlElement, depth: number, indent: number): string {
  const pad = ' '.repeat(depth * indent);
  const attrStr = Object.entries(el._attrs)
    .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
    .join('');

  if (el._children.length === 0 && !el._text) {
    return `${pad}<${el._tag}${attrStr} />`;
  }

  const open = `${pad}<${el._tag}${attrStr}>`;
  const close = `</${el._tag}>`;

  if (el._children.length === 0) {
    return `${open}${escapeXml(el._text)}${close}`;
  }

  const inner = el._children
    .map((c) => serializeElement(c, depth + 1, indent))
    .join('\n');
  return `${open}\n${inner}\n${pad}${close}`;
}

function serializePlain(tag: string, obj: DWObject, depth: number, indent: number): string {
  const pad = ' '.repeat(depth * indent);
  const inner = Object.entries(obj).map(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return serializePlain(k, v as DWObject, depth + 1, indent);
    }
    if (Array.isArray(v)) {
      return (v as Value[]).map((item, i) =>
        typeof item === 'object' && !Array.isArray(item) && item !== null
          ? serializePlain(k, item as DWObject, depth + 1, indent)
          : `${' '.repeat((depth + 1) * indent)}<${k} index="${i}">${escapeXml(String(item))}</${k}>`
      ).join('\n');
    }
    const childPad = ' '.repeat((depth + 1) * indent);
    return `${childPad}<${k}>${escapeXml(String(v ?? ''))}</${k}>`;
  }).join('\n');
  return `${pad}<${tag}>\n${inner}\n${pad}</${tag}>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
