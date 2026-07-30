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
    if (globalThis._monacoReady && globalThis._payloadEditor) {
      monaco.editor.setModelLanguage(
        globalThis._payloadEditor.getModel(),
        format === 'xml' || format === 'json' || format === 'yaml'
          ? format
          : 'text',
      );
    }
  },
);

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
    const resp = await fetch('/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, payloadText, payloadFormat }),
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
    } else {
      globalThis._lastOutput = data.result;
      out.style.display = 'none';
      const outEd = document.getElementById('outputEditor');
      outEd.style.display = 'block';
      globalThis._outputEditor.setValue(data.result);
      monaco.editor.setModelLanguage(
        globalThis._outputEditor.getModel(),
        data.format || 'json',
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
