/*
 * XSS regression tests for the Team Manager frontend.
 *
 * Run with Node (no dependencies needed):
 *   node tests/xss.test.js
 *
 * Or in a browser: open tests/xss.test.html (requires the app pages to be
 * served from the same origin).
 *
 * Strategy: simulate hostile team/member names and verify that rendering
 * paths use textContent (no HTML parsing) and that escapeHtml neutralizes
 * markup. A minimal DOM stub is used so this runs in Node.
 */
'use strict';

const assert = require('assert');

const fs = require('fs');

// Minimal DOM stub: records whether textContent or innerHTML was used.
function makeElement(tag) {
  const el = {
    tag,
    children: [],
    _textContent: null,
    _innerHTML: null,
    className: '',
    dataset: {},
    style: {},
    textContentSetWith: null,
    get textContent() {
      return this._textContent === null
        ? this.children.map((c) => c.textContent).join('')
        : this._textContent;
    },
    set textContent(v) {
      this._textContent = v;
      this.children = [];
      this.textContentSetWith = 'textContent';
    },
    get innerHTML() {
      return this._innerHTML || '';
    },
    set innerHTML(v) {
      this._innerHTML = v;
      this.textContentSetWith = 'innerHTML';
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener(ev, fn) {
      // Capture handlers so tests can drive them (e.g. form submit).
      this['on_' + ev] = fn;
    },
    classList: {
      toggle() {},
      add() {},
      remove() {},
    },
  };
  return el;
}

const elements = {};
function register(id) {
  elements[id] = makeElement('div');
  return elements[id];
}

[
  'message', 'landing', 'create-team', 'join-team', 'team-view',
  'team-view-name', 'member-count', 'member-list',
].forEach(register);

global.document = {
  getElementById: (id) => elements[id] || register(id),
  createElement: (tag) => makeElement(tag),
  querySelectorAll: () => [],
  addEventListener: () => {},
};

global.window = {};
new Function('window',
  fs.readFileSync(require('path').join(__dirname, '..', 'js', 'config.js'), 'utf8')
)(global.window);

// Load escapeHtml from app.js by extracting it (app.js is an IIFE that also
// wires event listeners; stubs above keep it loadable).
const appSrc = fs.readFileSync(require('path').join(__dirname, '..', 'js', 'app.js'), 'utf8');
// Evaluate in this context; stubs prevent DOM access errors.
function loadApp() {
  if (!global.window.Api) {
    global.window.Api = {
      loadConfig: async () => {},
      createTeam: async () => ({}),
      joinTeam: async () => ({}),
      getTeam: async () => null,
    };
  }
  new Function(appSrc)();
}
loadApp();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
let passed = 0;
const failures = [];
function test(name, fn) {
  // Chain onto a queue so async tests never run concurrently (they share
  // global DOM stubs and window.Api).
  queue = queue.then(async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok - ${name}`);
    } catch (e) {
      failures.push(name);
      console.error(`  FAIL - ${name}`);
      console.error(e.stack);
      process.exitCode = 1;
    }
  });
}
let queue = Promise.resolve();

const PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '"><script>alert(1)</script>',
  "javascript:alert(1)",
  '<iframe src="javascript:alert(1)"></iframe>',
  '&lt;script&gt;alert(1)&lt;/script&gt;',
  '<math><mtext><table><mglyph><style><!--</style><img src--onerror=alert(1)>',
];

console.log('escapeHtml neutralizes payloads:');
PAYLOADS.forEach((p) => {
  test(JSON.stringify(p), () => {
    const out = window.escapeHtml(p);
    assert.ok(!/[<>]/.test(out.replace(/&lt;|&gt;/g, '')), 'raw < or > leaked');
    assert.ok(!out.includes('<script'), 'script tag survived');
    // Event-handler text may appear as inert literal text; what matters is
    // that it can never be parsed as markup (no raw < or > above).
  });
});

console.log('renderTeamView uses textContent (no HTML parsing):');
PAYLOADS.forEach((p) => {
  test(JSON.stringify(p), async () => {
    const team = { name: p, members: [{ username: p }, { username: 'alice' }] };
    // Reset tracking (register elements first via getElementById)
    document.getElementById('team-view-name').textContentSetWith = null;
    document.getElementById('member-list').textContentSetWith = null;
    window.Api = {
      loadConfig: async () => {},
      joinTeam: async () => ({}),
      getTeam: async () => team,
    };
    // Re-run the app so the join-form submit handler is re-registered.
    loadApp();
    // Drive the join flow: submit -> joinTeam -> viewTeam -> renderTeamView.
    document.getElementById('join-name').value = 'X';
    document.getElementById('join-username').value = 'bob';
    await elements['join-form'].on_submit({ preventDefault() {} });
    assert.strictEqual(elements['team-view-name'].textContentSetWith, 'textContent',
      'team name must be set via textContent');
    assert.strictEqual(elements['member-list'].textContentSetWith, 'textContent',
      'member list must be cleared via textContent');
    // The rendered text must contain the payload as literal text, not markup.
    assert.strictEqual(elements['team-view-name'].textContent, p);
  });
});

console.log('showMessage uses textContent:');
PAYLOADS.forEach((p) => {
  test(JSON.stringify(p), async () => {
    elements['message'].textContentSetWith = null;
    // Make joinTeam fail with a hostile message; the app must render it via
    // textContent (never innerHTML).
    window.Api = {
      loadConfig: async () => {},
      joinTeam: async () => { throw new Error(p); },
    };
    loadApp();
    document.getElementById('join-name').value = 'X';
    document.getElementById('join-username').value = 'bob';
    await elements['join-form'].on_submit({ preventDefault() {} });
    assert.strictEqual(elements['message'].textContentSetWith, 'textContent',
      'error message must be set via textContent');
    assert.strictEqual(elements['message'].textContent, p);
  });
});

queue.then(() => {
  console.log(`\n${passed} test(s) passed${process.exitCode ? ' (with failures)' : ''}.`);
});