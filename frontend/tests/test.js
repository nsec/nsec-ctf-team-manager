/*
 * tests for the Team Manager frontend.
 *
 * Run with Node (no dependencies needed):
 *   node tests/test.js
 *
 * Or in a browser: open tests/test.html (requires the app pages to be
 * served from the same origin).
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
    hidden: false,
    disabled: false,
    checked: false,
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
      toggle(className, force) {
        if (className === 'hidden' && force !== undefined) {
          el.hidden = force;
        }
      },
      add(className) {
        if (className === 'hidden') el.hidden = true;
      },
      remove(className) {
        if (className === 'hidden') el.hidden = false;
      },
    },
  };
  return el;
}

const elements = {};
function register(id) {
  elements[id] = makeElement('div');
  return elements[id];
}

function descendantText(element) {
  if (element.children.length === 0) return element.textContent;
  return element.children.map(descendantText).join('');
}

[
  'message', 'landing', 'create-team', 'join-team', 'team-view', 'create-submit',
  'team-view-name', 'member-count', 'member-list', 'delete-team',
  'team-experience-fieldset', 'team-ctf-experience-display',
  'team-experience-creator-hint',
  'team-view-ctf-experience', 'team-experience-status',
  'pending-members-section', 'pending-member-list', 'pending-member-count',
  'create-ctf-experience-regular', 'create-ctf-experience-ai',
  'team-ctf-experience-regular', 'team-ctf-experience-ai',
].forEach(register);
elements['create-ctf-experience-regular'].value = 'regular';
elements['create-ctf-experience-ai'].value = 'ai';
elements['team-ctf-experience-regular'].value = 'regular';
elements['team-ctf-experience-ai'].value = 'ai';

global.document = {
  getElementById: (id) => elements[id] || register(id),
  createElement: (tag) => makeElement(tag),
  querySelector(selector) {
    if (selector === 'input[name="createCtfExperience"]:checked') {
      return ['regular', 'ai']
        .map((value) => elements[`create-ctf-experience-${value}`])
        .find((input) => input.checked);
    }
    return null;
  },
  querySelectorAll(selector) {
    if (selector === 'input[name="teamCtfExperience"]') {
      return ['regular', 'ai'].map((value) => elements[`team-ctf-experience-${value}`]);
    }
    return [];
  },
  addEventListener: () => {},
};

global.window = {};
global.window.confirm = () => true;
const localStorageValues = new Map();
global.window.localStorage = {
  getItem(key) {
    return localStorageValues.has(key) ? localStorageValues.get(key) : null;
  },
  setItem(key, value) {
    localStorageValues.set(key, String(value));
  },
  removeItem(key) {
    localStorageValues.delete(key);
  },
};
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
      t: (key) => key === 'team.admin' ? '[Admin]' : key,
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
      updateTeamExperience: async () => {},
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
      verifyTeam: async () => ({ ...team, is_creator: false }),
    };
    // Re-run the app so the join-form submit handler is re-registered.
    loadApp();
    // Verify a team to drive the rendering path.
    document.getElementById('verify-name').value = 'X';
    document.getElementById('verify-order-code').value = 'QHB8A';
    await elements['verify-form'].on_submit({ preventDefault() {} });
    assert.strictEqual(elements['team-view-name'].textContentSetWith, 'textContent',
      'team name must be set via textContent');
    assert.strictEqual(elements['member-list'].textContentSetWith, 'textContent',
      'member list must be cleared via textContent');
    // The rendered text must contain the payload as literal text, not markup.
    assert.strictEqual(elements['team-view-name'].textContent, p);
    assert.strictEqual(elements['delete-team'].hidden, true);
  });
});

console.log('join team dropdown loads available teams safely:');
test('team names populate dropdown options as text', async () => {
  const teamName = '<img src=x onerror=alert(1)>';
  window.Api = {
    loadConfig: async () => {},
    listTeams: async () => [{ id: 1, name: teamName, ctf_experience: 'regular' }],
  };
  loadApp();
  await elements['btn-show-join'].on_click();
  const select = elements['join-name'];
  assert.strictEqual(select.disabled, false);
  assert.strictEqual(select.children.length, 2);
  assert.strictEqual(select.children[1].value, teamName);
  assert.strictEqual(select.children[1].textContent, `${teamName} — experience.regular`);
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
    listTeams: async () => [{ name: 'Kernel Panic', ctf_experience: 'ai' }],
    verifyTeam: async (name, orderCode) => {
      verified = [name, orderCode];
      return {
        id: 4,
        name,
        ctf_experience: 'ai',
        is_creator: true,
        members: [{ attendee_email: 'alice@example.com', is_creator: true }],
      };
    },
  };
  loadApp();
  await elements['btn-show-verify'].on_click();
  const select = elements['verify-name'];
  assert.strictEqual(select.disabled, false);
  assert.strictEqual(select.children[1].textContent, 'Kernel Panic — experience.ai');
  select.value = 'Kernel Panic';
  document.getElementById('verify-order-code').value = 'QHB8A';
  await elements['verify-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(verified, ['Kernel Panic', 'QHB8A']);
  assert.strictEqual(
    elements['team-view-ctf-experience'].textContent,
    'experience.ai'
  );
  assert.strictEqual(elements['team-experience-fieldset'].hidden, false);
  assert.strictEqual(elements['team-experience-creator-hint'].hidden, true);
  assert.strictEqual(elements['team-ctf-experience-ai'].checked, true);
  assert.strictEqual(elements['team-ctf-experience-ai'].disabled, false);
  assert.strictEqual(descendantText(elements['member-list'].children[0]), 'alice@example.com[Admin]');
  assert.strictEqual(elements['delete-team'].hidden, false);
});

test('team creator can update CTF experience with radio selection', async () => {
  let updateArgs;
  window.Api = {
    loadConfig: async () => {},
    verifyTeam: async (name) => ({
      id: 18,
      name,
      ctf_experience: 'regular',
      members: [{ attendee_email: 'alice@example.com', is_creator: true }],
      is_creator: true,
    }),
    updateTeamExperience: async (...args) => { updateArgs = args; },
  };
  loadApp();
  elements['verify-name'].value = 'Kernel Panic';
  elements['verify-order-code'].value = 'QHB8A';
  await elements['verify-form'].on_submit({ preventDefault() {} });
  elements['team-ctf-experience-ai'].checked = true;
  await elements['team-ctf-experience-ai'].on_change();
  assert.deepStrictEqual(updateArgs, [18, 'QHB8A', 'ai']);
  assert.strictEqual(elements['team-view-ctf-experience'].textContent, 'experience.ai');
  assert.strictEqual(elements['team-experience-status'].textContent, 'experience.saved');
});

test('non-creator sees disabled experience radios and descriptions', async () => {
  window.Api = {
    loadConfig: async () => {},
    verifyTeam: async (name) => ({
      id: 19,
      name,
      ctf_experience: 'ai',
      members: [{ attendee_email: 'alice@example.com', is_creator: true }],
      is_creator: false,
    }),
  };
  loadApp();
  elements['verify-name'].value = 'Kernel Panic';
  elements['verify-order-code'].value = 'JOIN2';
  await elements['verify-form'].on_submit({ preventDefault() {} });
  assert.strictEqual(elements['team-experience-fieldset'].hidden, false);
  assert.strictEqual(elements['team-experience-creator-hint'].hidden, false);
  assert.strictEqual(elements['member-list'].children[0].children.length, 2);
  assert.strictEqual(descendantText(elements['member-list'].children[0]), 'alice@example.com[Admin]');
  assert.strictEqual(elements['team-ctf-experience-display'].hidden, true);
  assert.strictEqual(elements['team-view-ctf-experience'].textContent, 'experience.ai');
  assert.strictEqual(elements['team-ctf-experience-ai'].checked, true);
  assert.strictEqual(elements['team-ctf-experience-ai'].disabled, true);
  assert.strictEqual(elements['team-ctf-experience-regular'].disabled, true);
});

test('creator can delete their team with the verified order code', async () => {
  let deleted;
  window.Api = {
    loadConfig: async () => {},
    verifyTeam: async (name) => ({
      id: 42,
      name,
      ctf_experience: 'regular',
      members: [],
      is_creator: true,
    }),
    deleteTeam: async (...args) => { deleted = args; },
  };
  loadApp();
  elements['verify-name'].value = 'Kernel Panic';
  elements['verify-order-code'].value = 'QHB8A';
  await elements['verify-form'].on_submit({ preventDefault() {} });
  await elements['delete-team'].on_click();
  assert.deepStrictEqual(deleted, [42, 'QHB8A']);
  assert.strictEqual(elements.message.textContent, 'message.teamDeleted');
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
  assert.strictEqual(select.value, email);
  assert.strictEqual(select.children[1].value, email);
  assert.strictEqual(select.children[1].textContent, email);
  assert.strictEqual(select.children[1].textContentSetWith, 'textContent');
});

test('saved order code autofills all three order code inputs', () => {
  localStorageValues.set('nsec-team-manager-pretix-order-code', 'QHB8A');
  loadApp();
  for (const id of ['create-order-code', 'join-order-code', 'verify-order-code']) {
    assert.strictEqual(elements[id].value, 'QHB8A');
  }
});

test('editing an order code syncs and persists all three inputs', () => {
  localStorageValues.clear();
  loadApp();
  const orderIds = ['create-order-code', 'join-order-code', 'verify-order-code'];
  const source = elements['join-order-code'];
  source.value = ' NEW42 ';
  source.on_input();
  for (const id of orderIds) {
    assert.strictEqual(elements[id].value, ' NEW42 ');
  }
  assert.strictEqual(
    localStorageValues.get('nsec-team-manager-pretix-order-code'), 'NEW42'
  );

  source.value = '';
  source.on_input();
  assert.strictEqual(localStorageValues.has('nsec-team-manager-pretix-order-code'), false);
  for (const id of orderIds) assert.strictEqual(elements[id].value, '');
});

test('pressing Enter in either order code input loads attendees', async () => {
  const lookups = [
    ['create-order-code', 'create-attendee-email'],
    ['join-order-code', 'join-attendee-email'],
  ];
  for (const [orderId, emailId] of lookups) {
    let requestedCode;
    window.Api = {
      loadConfig: async () => {},
      getOrderAttendees: async (code) => {
        requestedCode = code;
        return ['alice@example.com'];
      },
    };
    loadApp();
    document.getElementById(orderId).value = ' QHB8A ';
    let defaultPrevented = false;
    await elements[orderId].on_keydown({
      key: 'Enter',
      preventDefault() { defaultPrevented = true; },
    });
    assert.strictEqual(defaultPrevented, true);
    assert.strictEqual(requestedCode, 'QHB8A');
    assert.strictEqual(elements[emailId].value, 'alice@example.com');
  }
});

test('create submission includes order code and selected attendee email', async () => {
  let submitted;
  let verified;
  window.Api = {
    loadConfig: async () => {},
    createTeam: async (...args) => { submitted = args; },
    verifyTeam: async (name, orderCode) => {
      verified = [name, orderCode];
      return {
        id: 7,
        name,
        ctf_experience: 'regular',
        members: [{ attendee_email: 'alice@example.com', is_creator: true }],
        is_creator: true,
      };
    },
  };
  loadApp();
  document.getElementById('create-name').value = 'Kernel Panic';
  document.getElementById('create-ctf-experience-regular').checked = true;
  document.getElementById('create-order-code').value = 'QHB8A';
  document.getElementById('create-attendee-email').value = 'alice@example.com';
  await elements['create-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(submitted, [
    'Kernel Panic', 'QHB8A', 'alice@example.com', 'regular',
  ]);
  assert.deepStrictEqual(verified, ['Kernel Panic', 'QHB8A']);
  assert.strictEqual(elements['team-view-name'].textContent, 'Kernel Panic');
  assert.strictEqual(descendantText(elements['member-list'].children[0]), 'alice@example.com[Admin]');
  assert.strictEqual(elements['delete-team'].hidden, false);
});

test('create submission includes selected AI CTF experience', async () => {
  let submitted;
  window.Api = {
    loadConfig: async () => {},
    createTeam: async (...args) => { submitted = args; },
    verifyTeam: async (name) => ({ name, ctf_experience: 'ai', members: [] }),
  };
  loadApp();
  document.getElementById('create-name').value = 'AI players';
  document.getElementById('create-ctf-experience-ai').checked = true;
  document.getElementById('create-ctf-experience-regular').checked = false;
  document.getElementById('create-order-code').value = 'QHB8A';
  document.getElementById('create-attendee-email').value = 'alice@example.com';
  await elements['create-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(submitted, [
    'AI players', 'QHB8A', 'alice@example.com', 'ai',
  ]);
});

test('create submit button shows pending state and is restored afterward', async () => {
  let finishCreate;
  window.Api = {
    loadConfig: async () => {},
    createTeam: () => new Promise((resolve) => { finishCreate = resolve; }),
    verifyTeam: async (name) => ({ name, members: [] }),
  };
  loadApp();
  document.getElementById('create-name').value = 'Kernel Panic';
  document.getElementById('create-order-code').value = 'QHB8A';
  document.getElementById('create-attendee-email').value = 'alice@example.com';

  const submitButton = elements['create-submit'];
  const submission = elements['create-form'].on_submit({ preventDefault() {} });
  assert.strictEqual(submitButton.disabled, true);
  assert.strictEqual(submitButton.textContent, 'action.creating');

  finishCreate();
  await submission;
  assert.strictEqual(submitButton.disabled, false);
  assert.strictEqual(submitButton.textContent, 'action.create');
});

test('join submission includes only order code and selected attendee email', async () => {
  let submitted;
  let verificationCount = 0;
  window.Api = {
    loadConfig: async () => {},
    joinTeam: async (...args) => { submitted = args; },
    verifyTeam: async () => { verificationCount++; },
  };
  loadApp();
  document.getElementById('join-name').value = 'Kernel Panic';
  document.getElementById('join-order-code').value = 'QHB8A';
  document.getElementById('join-attendee-email').value = 'alice@example.com';
  await elements['join-form'].on_submit({ preventDefault() {} });
  assert.deepStrictEqual(submitted, [
    'Kernel Panic', 'QHB8A', 'alice@example.com',
  ]);
  assert.strictEqual(verificationCount, 0, 'pending applicant must not enter team view');
  assert.strictEqual(elements.message.textContent, 'message.joinRequestSubmitted');
});

test('any verified team member can approve a pending request', async () => {
  let approved;
  let verificationCount = 0;
  window.Api = {
    loadConfig: async () => {},
    verifyTeam: async (name, orderCode) => {
      verificationCount++;
      return {
        id: 55,
        name,
        ctf_experience: 'regular',
        is_creator: false,
        members: [{ id: 1, attendee_email: 'alice@example.com', is_creator: true }],
        pending_members: verificationCount === 1
          ? [{ id: 2, attendee_email: 'bob@example.com' }]
          : [],
      };
    },
    approveMember: async (...args) => { approved = args; },
  };
  loadApp();
  elements['verify-name'].value = 'Kernel Panic';
  elements['verify-order-code'].value = 'JOIN2';
  await elements['verify-form'].on_submit({ preventDefault() {} });

  const pendingItem = elements['pending-member-list'].children[0];
  assert.strictEqual(descendantText(pendingItem.children[0]), 'bob@example.com');
  await pendingItem.children[1].on_click();
  assert.deepStrictEqual(approved, [55, 2, 'JOIN2']);
  assert.strictEqual(verificationCount, 2);
  assert.strictEqual(elements['pending-members-section'].hidden, true);
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