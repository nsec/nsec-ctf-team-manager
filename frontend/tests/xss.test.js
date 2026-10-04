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
    value: '',
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
  if (!global.window.I18n) {
    global.window.I18n = {
      t: (key) => key,
      translateError: (error) => error.message,
    };
  }
  if (!global.window.Api) {
    global.window.Api = {
      loadConfig: async () => {},
      createTeam: async () => ({}),
      joinTeam: async () => ({}),
      getOrderAttendees: async () => [],
      listTeams: async () => [],
      verifyTeam: async () => null,
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
    const team = {
      name: p,
      members: [{ attendee_email: p }, { attendee_email: 'alice@example.com' }],
    };
    // Reset tracking (register elements first via getElementById)
    document.getElementById('team-view-name').textContentSetWith = null;
    document.getElementById('member-list').textContentSetWith = null;
    window.Api = {
      loadConfig: async () => {},
      joinTeam: async () => ({}),
      verifyTeam: async () => team,
    };
    // Re-run the app so the join-form submit handler is re-registered.
    loadApp();
    // Drive the join flow: submit -> joinTeam -> viewTeam -> renderTeamView.
    document.getElementById('join-name').value = 'X';
    document.getElementById('join-order-code').value = 'QHB8A';
    document.getElementById('join-attendee-email').value = 'bob@example.com';
    await elements['join-form'].on_submit({ preventDefault() {} });
    assert.strictEqual(elements['team-view-name'].textContentSetWith, 'textContent',
      'team name must be set via textContent');
    assert.strictEqual(elements['member-list'].textContentSetWith, 'textContent',
      'member list must be cleared via textContent');
    // The rendered text must contain the payload as literal text, not markup.
    assert.strictEqual(elements['team-view-name'].textContent, p);
  });
});

console.log('join team dropdown loads available teams safely:');
test('team names populate dropdown options as text', async () => {
  const teamName = '<img src=x onerror=alert(1)>';
  window.Api = {
    loadConfig: async () => {},
    listTeams: async () => [{ id: 1, name: teamName }],
  };
  loadApp();
  await elements['btn-show-join'].on_click();
  const select = elements['join-name'];
  assert.strictEqual(select.disabled, false);
  assert.strictEqual(select.children.length, 2);
  assert.strictEqual(select.children[1].value, teamName);
  assert.strictEqual(select.children[1].textContent, teamName);
  assert.strictEqual(select.children[1].textContentSetWith, 'textContent');
});

test('empty team list leaves dropdown disabled and displays a message', async () => {
  window.Api = {
    loadConfig: async () => {},
    listTeams: async () => [],
  };
  loadApp();
  await elements['btn-show-join'].on_click();
  assert.strictEqual(elements['join-name'].disabled, true);
  assert.ok(elements.message.textContent.length > 0);
});

test('verify action loads team names and submits the order code', async () => {
  let verified;
  window.Api = {
    loadConfig: async () => {},
    listTeams: async () => [{ name: 'Kernel Panic' }],
    verifyTeam: async (name, orderCode) => {
      verified = [name, orderCode];
      return { name, members: [{ attendee_email: 'alice@example.com' }] };
    },
  };
  loadApp();
  await elements['btn-show-verify'].on_click();
  const select = elements['verify-name'];
  assert.strictEqual(select.disabled, false);
  assert.strictEqual(select.children[1].textContent, 'Kernel Panic');
  select.value = 'Kernel Panic';
  document.getElementById('verify-order-code').value = 'QHB8A';
  await elements['verify-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(verified, ['Kernel Panic', 'QHB8A']);
  assert.strictEqual(elements['member-list'].children[0].textContent, 'alice@example.com');
});

test('order lookup populates attendee email options as text', async () => {
  const email = '<img src=x onerror=alert(1)>';
  let requestedCode;
  window.Api = {
    loadConfig: async () => {},
    getOrderAttendees: async (code) => {
      requestedCode = code;
      return [email];
    },
  };
  loadApp();
  document.getElementById('create-order-code').value = ' QHB8A ';
  await elements['create-load-attendees'].on_click();
  const select = elements['create-attendee-email'];
  assert.strictEqual(requestedCode, 'QHB8A');
  assert.strictEqual(select.disabled, false);
  assert.strictEqual(select.children[1].value, email);
  assert.strictEqual(select.children[1].textContent, email);
  assert.strictEqual(select.children[1].textContentSetWith, 'textContent');
});

test('create submission includes order code and selected attendee email', async () => {
  let submitted;
  window.Api = {
    loadConfig: async () => {},
    createTeam: async (...args) => { submitted = args; },
    verifyTeam: async (name) => ({ name, members: [] }),
  };
  loadApp();
  document.getElementById('create-name').value = 'Kernel Panic';
  document.getElementById('create-order-code').value = 'QHB8A';
  document.getElementById('create-attendee-email').value = 'alice@example.com';
  await elements['create-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(submitted, ['Kernel Panic', 'QHB8A', 'alice@example.com']);
});

test('join submission includes only order code and selected attendee email', async () => {
  let submitted;
  window.Api = {
    loadConfig: async () => {},
    joinTeam: async (...args) => { submitted = args; },
    verifyTeam: async (name) => ({ name, members: [] }),
  };
  loadApp();
  document.getElementById('join-name').value = 'Kernel Panic';
  document.getElementById('join-order-code').value = 'QHB8A';
  document.getElementById('join-attendee-email').value = 'alice@example.com';
  await elements['join-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(submitted, [
    'Kernel Panic', 'QHB8A', 'alice@example.com',
  ]);
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
    document.getElementById('join-order-code').value = 'QHB8A';
    document.getElementById('join-attendee-email').value = 'bob@example.com';
    await elements['join-form'].on_submit({ preventDefault() {} });
    assert.strictEqual(elements['message'].textContentSetWith, 'textContent',
      'error message must be set via textContent');
    assert.strictEqual(elements['message'].textContent, p);
  });
});

queue.then(() => {
  console.log(`\n${passed} test(s) passed${process.exitCode ? ' (with failures)' : ''}.`);
});