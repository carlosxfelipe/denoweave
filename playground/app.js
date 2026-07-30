// ── Monaco setup ─────────────────────────────────────────────────────────────
require.config({
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' },
});

require(['vs/editor/editor.main'], function () {
  // ── Register a minimal DataWeave language for syntax highlighting ──────────
  monaco.languages.register({ id: 'dataweave' });
  monaco.languages.setMonarchTokensProvider('dataweave', {
    keywords: [
      '%dw',
      'output',
      'var',
      'fun',
      'type',
      'import',
      'from',
      'as',
      'if',
      'else',
      'do',
      'match',
      'case',
      'default',
      'using',
      'null',
      'true',
      'false',
      'not',
      'and',
      'or',
      'is',
      'in',
      'map',
      'filter',
      'reduce',
      'groupBy',
      'orderBy',
      'distinctBy',
      'flatMap',
      'pluck',
      'mapObject',
      'filterObject',
      'update',
      'replace',
      'when',
      'unless',
    ],
    tokenizer: {
      root: [
        [/%dw\s+[\d.]+/, 'keyword'],
        [/\/\/.*$/, 'comment'],
        [/---/, 'delimiter'],
        [/"(?:[^"\\]|\\.)*"/, 'string'],
        [/\|[^|]+\|/, 'string.temporal'],
        [/\b(true|false|null)\b/, 'constant'],
        [/\b\d+(\.\d+)?\b/, 'number'],
        [
          /\b(var|fun|type|output|import|from|as|if|else|do|match|case|default|using)\b/,
          'keyword',
        ],
        [
          /\b(map|filter|reduce|groupBy|orderBy|flatMap|pluck|mapObject|filterObject|distinctBy|update)\b/,
          'keyword.operator',
        ],
        [/[a-zA-Z_$][\w$]*(?=\s*\()/, 'entity.name.function'],
        [/[a-zA-Z_$][\w$.]*/, 'identifier'],
        [/[=><!~?:&|+\-*\/\^%]+/, 'operator'],
        [/[{}()\[\]]/, 'delimiter.bracket'],
      ],
    },
  });

  monaco.languages.setLanguageConfiguration('dataweave', {
    comments: { lineComment: '//' },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
  });

  // ── Theme ──────────────────────────────────────────────────────────────────
  monaco.editor.defineTheme('playground-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'keyword.operator', foreground: '56b6c2' },
      { token: 'string', foreground: '98c379' },
      { token: 'string.temporal', foreground: 'e5c07b' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'constant', foreground: 'd19a66' },
      { token: 'operator', foreground: 'abb2bf' },
      { token: 'delimiter', foreground: 'e06c75', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '61afef' },
      { token: 'identifier', foreground: 'abb2bf' },
    ],
    colors: {
      'editor.background': '#0d0f1a',
      'editor.foreground': '#abb2bf',
      'editorLineNumber.foreground': '#3d4052',
      'editorCursor.foreground': '#528bff',
      'editor.selectionBackground': '#1c2140',
      'editor.lineHighlightBackground': '#131628',
      'editorIndentGuide.background1': '#252940',
      'editorGutter.background': '#0d0f1a',
      'scrollbarSlider.background': '#252940',
    },
  });

  monaco.editor.defineTheme('playground-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: 'a0a1a7', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'a626a4' },
      { token: 'keyword.operator', foreground: '0184bc' },
      { token: 'string', foreground: '50a14f' },
      { token: 'string.temporal', foreground: '986801' },
      { token: 'number', foreground: '986801' },
      { token: 'constant', foreground: '986801' },
      { token: 'operator', foreground: '383a42' },
      { token: 'delimiter', foreground: 'e45649', fontStyle: 'bold' },
      { token: 'entity.name.function', foreground: '4078f2' },
      { token: 'identifier', foreground: '383a42' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#383a42',
      'editorLineNumber.foreground': '#9d9d9f',
      'editorCursor.foreground': '#526fff',
      'editor.selectionBackground': '#e5e5e6',
      'editor.lineHighlightBackground': '#f3f3f4',
      'editorIndentGuide.background1': '#e4e4e4',
      'editorGutter.background': '#ffffff',
      'scrollbarSlider.background': '#e4e4e4',
    },
  });

  const prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)');
  const getTheme = () =>
    prefersDark.matches ? 'playground-dark' : 'playground-light';

  const editorOptions = {
    theme: getTheme(),
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontLigatures: true,
    lineHeight: 22,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    padding: { top: 12, bottom: 12 },
    renderLineHighlight: 'line',
    lineDecorationsWidth: 0,
    glyphMargin: false,
    folding: true,
    automaticLayout: true,
  };

  // Listen for system theme changes
  prefersDark.addEventListener('change', () => {
    monaco.editor.setTheme(getTheme());
  });

  // ── Create editors ─────────────────────────────────────────────────────────
  const transformEditor = monaco.editor.create(
    document.getElementById('transformEditor'),
    {
      ...editorOptions,
      language: 'dataweave',
      value:
        '%dw 2.0\noutput application/json\n\n---\n{\n  message: "Hello DenoWeave!",\n  payload: payload\n}\n',
    },
  );

  const payloadEditor = monaco.editor.create(
    document.getElementById('payloadEditor'),
    {
      ...editorOptions,
      language: 'json',
      value: '{\n  "user": "Developer"\n}',
      lineNumbers: 'off',
    },
  );

  // ── Ctrl+Enter shortcut ────────────────────────────────────────────────────
  [transformEditor, payloadEditor].forEach((ed) => {
    ed.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
      () => runScript(),
    );
  });

  transformEditor.addCommand(
    monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
    () => formatScript(),
  );

  const outputEditor = monaco.editor.create(
    document.getElementById('outputEditor'),
    {
      ...editorOptions,
      readOnly: true,
      language: 'json',
      value: '',
      lineNumbers: 'off',
    },
  );
  globalThis._outputEditor = outputEditor;
  globalThis._transformEditor = transformEditor;
  globalThis._payloadEditor = payloadEditor;
  globalThis._monacoReady = true;
  if (globalThis._pendingRun) runScript();
});

// ── Examples ──────────────────────────────────────────────────────────────────
let EXAMPLES = {};
fetch('/examples')
  .then((res) => res.json())
  .then((data) => {
    if (data.error) return;
    EXAMPLES = data;
    const select = document.getElementById('exampleSelect');
    for (const key of Object.keys(EXAMPLES)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = key.replace(/-/g, ' ').replace(
        /\w/g,
        (l) => l.toUpperCase(),
      );
      select.appendChild(opt);
    }
  })
  .catch((err) => console.error('Failed to load examples:', err));

// ── Example selector ──────────────────────────────────────────────────────────
document.getElementById('exampleSelect').addEventListener(
  'change',
  function () {
    const key = this.value;
    if (!key || !EXAMPLES[key]) return;
    if (!globalThis._monacoReady) return;
    const ex = EXAMPLES[key];
    globalThis._transformEditor.setValue(ex.script);
    globalThis._payloadEditor.setValue(ex.payload);

    globalThis._payloadFormat = ex.payloadFormat || 'json';
    monaco.editor.setModelLanguage(
      globalThis._payloadEditor.getModel(),
      globalThis._payloadFormat,
    );

    // Update Payload Format Select
    const payloadSelect = document.getElementById('payloadFormatSelect');
    if (payloadSelect) {
      payloadSelect.value = globalThis._payloadFormat;
    }

    this.value = '';
    setStatus(
      'idle',
      `Loaded example: ${this.options[this.selectedIndex]?.text || key}`,
    );
  },
);

// ── Payload Format Selector ───────────────────────────────────────────────────
document.getElementById('payloadFormatSelect').addEventListener(
  'change',
  function () {
    const format = this.value;
    globalThis._payloadFormat = format;
    globalThis._xlsxBase64 = null; // reset binary payload on format change

    const uploadBar = document.getElementById('xlsxUploadBar');
    const payloadEditorEl = document.getElementById('payloadEditor');

    if (format === 'xlsx') {
      uploadBar.style.display = 'block';
      payloadEditorEl.style.display = 'none';
    } else {
      uploadBar.style.display = 'none';
      payloadEditorEl.style.display = 'block';
    }

    if (globalThis._monacoReady && globalThis._payloadEditor) {
      const monacoLang = formatToMonacoLang(format);
      monaco.editor.setModelLanguage(
        globalThis._payloadEditor.getModel(),
        monacoLang,
      );
    }
  },
);

// ── XLSX file upload ──────────────────────────────────────────────────────────
document.getElementById('xlsxFileInput').addEventListener(
  'change',
  function () {
    const file = this.files && this.files[0];
    const nameEl = document.getElementById('xlsxFileName');
    if (!file) {
      nameEl.textContent = 'No file chosen';
      nameEl.classList.remove('loaded');
      return;
    }
    nameEl.textContent = `${file.name}  (${(file.size / 1024).toFixed(1)} KB)`;
    nameEl.classList.add('loaded');
    const reader = new FileReader();
    reader.onload = function (e) {
      const arrayBuffer = e.target.result;
      const bytes = new Uint8Array(arrayBuffer);
      // Encode to base64 (chunked to avoid call stack overflow on large files)
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          bytes.subarray(i, i + chunkSize),
        );
      }
      globalThis._xlsxBase64 = btoa(binary);
      setStatus(
        'idle',
        `XLSX loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
      );
    };
    reader.readAsArrayBuffer(file);
  },
);

/** Map adapter format id to Monaco editor language id. */
function formatToMonacoLang(format) {
  switch (format) {
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    case 'yaml':
      return 'yaml';
    case 'csv':
      return 'plaintext';
    case 'ndjson':
      return 'json';
    case 'text':
      return 'plaintext';
    case 'urlencoded':
      return 'plaintext';
    case 'multipart':
      return 'plaintext';
    case 'dw':
      return 'dataweave';
    case 'xlsx':
      return 'plaintext';
    default:
      return 'plaintext';
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(state, message, time) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  const ts = document.getElementById('statusTime');
  dot.className = 'status-dot ' +
    (state === 'ok'
      ? 'ok'
      : state === 'error'
      ? 'error'
      : state === 'running'
      ? 'running'
      : '');
  text.textContent = message;
  ts.textContent = time ? `${time}ms` : '';
}

// ── JSON syntax highlight ─────────────────────────────────────────────────────

// ── Run script ────────────────────────────────────────────────────────────────
async function runScript() {
  if (!globalThis._monacoReady) {
    globalThis._pendingRun = true;
    return;
  }

  const btn = document.getElementById('runBtn');
  const out = document.getElementById('outputContainer');
  const copy = document.getElementById('copyBtn');

  const code = globalThis._transformEditor.getValue();
  const payloadText = globalThis._payloadEditor.getValue().trim();

  const payloadFormat = globalThis._payloadFormat || 'json';

  btn.disabled = true;
  btn.innerHTML = `<div class="spinner"></div> Running…`;
  setStatus('running', 'Evaluating…');
  copy.style.display = 'none';
  out.style.display = 'block';
  document.getElementById('outputEditor').style.display = 'none';
  out.innerHTML = '';

  const t0 = performance.now();

  try {
    const reqBody = { code, payloadText, payloadFormat };
    // Attach base64 XLSX payload if the format is xlsx
    if (payloadFormat === 'xlsx' && globalThis._xlsxBase64) {
      reqBody.payloadBase64 = globalThis._xlsxBase64;
      reqBody.payloadText = 'null';
    }

    const resp = await fetch('/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });

    const elapsed = Math.round(performance.now() - t0);
    const data = await resp.json();

    if (!resp.ok || data.error) {
      const msg = data.error || 'Unknown error';
      out.innerHTML =
        `<div class="output-error anim-in"><div class="output-error-label">✖ Runtime Error</div>${
          escapeHtml(msg)
        }</div>`;
      setStatus('error', 'Evaluation failed', elapsed);
    } else if (data.binary && data.format === 'xlsx') {
      // Binary XLSX output: offer a download link
      out.style.display = 'block';
      document.getElementById('outputEditor').style.display = 'none';
      const base64 = data.result;
      const blob = base64ToBlob(
        base64,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const url = URL.createObjectURL(blob);
      out.innerHTML = `
        <div class="output-xlsx-result anim-in">
          <div style="font-size:32px;margin-bottom:12px;">📊</div>
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px;">
            XLSX output generated successfully
          </div>
          <a id="xlsxDownloadLink" href="${url}" download="output.xlsx"
            class="btn btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download output.xlsx
          </a>
        </div>`;
      setStatus('ok', 'XLSX generated successfully', elapsed);
    } else {
      globalThis._lastOutput = data.result;
      out.style.display = 'none';
      const outEd = document.getElementById('outputEditor');
      outEd.style.display = 'block';
      globalThis._outputEditor.setValue(data.result);
      monaco.editor.setModelLanguage(
        globalThis._outputEditor.getModel(),
        formatToMonacoLang(data.format || 'json'),
      );
      setStatus('ok', 'Evaluated successfully', elapsed);
      copy.style.display = '';
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    out.innerHTML =
      `<div class="output-error anim-in"><div class="output-error-label">✖ Network Error</div>${
        escapeHtml(String(err))
      }</div>`;
    setStatus('error', 'Request failed', elapsed);
  }

  btn.disabled = false;
  btn.innerHTML =
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run`;
}

// ── Format script ─────────────────────────────────────────────────────────────
async function formatScript() {
  if (!globalThis._monacoReady) return;

  const btn = document.getElementById('formatBtn');
  const code = globalThis._transformEditor.getValue();

  btn.disabled = true;
  setStatus('running', 'Formatting…');

  const t0 = performance.now();

  try {
    const resp = await fetch('/format', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const elapsed = Math.round(performance.now() - t0);
    const data = await resp.json();

    if (!resp.ok || data.error) {
      const msg = data.error || 'Unknown error';
      setStatus('error', `Format failed: ${msg}`, elapsed);
    } else {
      globalThis._transformEditor.setValue(data.result);
      setStatus('ok', 'Formatted successfully', elapsed);
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    setStatus(
      'error',
      `Request failed: ${err.message || String(err)}`,
      elapsed,
    );
  }

  btn.disabled = false;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert a base64 string to a Blob (for binary downloads). */
function base64ToBlob(base64, mimeType) {
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

// ── Copy button ───────────────────────────────────────────────────────────────
document.getElementById('copyBtn').addEventListener('click', async function () {
  if (!globalThis._lastOutput) return;
  try {
    await navigator.clipboard.writeText(globalThis._lastOutput);
    this.textContent = '✓ Copied!';
    setTimeout(() => {
      this.innerHTML =
        `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy`;
    }, 1800);
  } catch { /* ignore */ }
});

// ── Run button ────────────────────────────────────────────────────────────────
document.getElementById('runBtn').addEventListener('click', runScript);

// ── Format button ─────────────────────────────────────────────────────────────
document.getElementById('formatBtn').addEventListener('click', formatScript);
