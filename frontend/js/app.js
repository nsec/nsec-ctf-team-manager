(function () {
  'use strict';

  const cfg = window.TEAM_CONFIG;

  /*
   * XSS defense: all user-controlled data (team names, member names, error
   * messages) is rendered via textContent or this escaper — never raw
   * innerHTML. This helper exists for future code that may need to build
   * markup; it escapes &, <, >, ", and '.
   */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  window.escapeHtml = escapeHtml;

  // --- Section management -------------------------------------------------
  const sections = ['landing', 'create-team', 'join-team', 'verify-team', 'team-view'];

  function show(id) {
    sections.forEach((s) => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    hideMessage();
  }

  // --- Messages -----------------------------------------------------------
  const messageEl = document.getElementById('message');

  function showMessage(text, type) {
    // textContent assignment: message text is never interpreted as HTML.
    messageEl.textContent = text;
    messageEl.className = 'message ' + (type || 'info');
  }

  function hideMessage() {
    messageEl.className = 'message hidden';
    messageEl.textContent = '';
  }

  // --- Config display -----------------------------------------------------
  function renderConfig() {
    document.querySelectorAll('[data-config]').forEach((el) => {
      const key = el.dataset.config;
      if (cfg[key] !== undefined) el.textContent = cfg[key];
    });
  }

  // --- Team view rendering ------------------------------------------------
  function renderTeamView(team) {
    // textContent never parses HTML, so team names and member emails are inert.
    document.getElementById('team-view-name').textContent = team.name;
    document.getElementById('member-count').textContent = team.members.length;
    const list = document.getElementById('member-list');
    list.textContent = '';
    team.members.forEach((m) => {
      const li = document.createElement('li');
      li.textContent = m.attendee_email;
      list.appendChild(li);
    });
    show('team-view');
  }

  // --- View team by name (after create/join) ------------------------------
  async function viewTeam(name, orderCode) {
    try {
      const team = await window.Api.verifyTeam(name, orderCode);
      renderTeamView(team);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
      show('landing');
    }
  }

  // --- Navigation buttons -------------------------------------------------
  document.getElementById('btn-show-create').addEventListener('click', () => show('create-team'));

  function resetOptions(select, placeholder) {
    select.textContent = '';
    const option = document.createElement('option');
    option.value = '';
    option.disabled = true;
    option.selected = true;
    option.textContent = placeholder;
    select.appendChild(option);
  }

  document.getElementById('btn-show-join').addEventListener('click', async () => {
    show('join-team');
    const select = document.getElementById('join-name');
    select.disabled = true;
    resetOptions(select, window.I18n.t('join.loadingTeams'));

    try {
      const teams = await window.Api.listTeams();
      resetOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        select.appendChild(option);
      });
      select.disabled = teams.length === 0;
      if (teams.length === 0) {
        showMessage(window.I18n.t('join.noTeams'), 'info');
      }
    } catch (err) {
      resetOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  document.getElementById('btn-show-verify').addEventListener('click', async () => {
    show('verify-team');
    const select = document.getElementById('verify-name');
    select.disabled = true;
    resetOptions(select, window.I18n.t('join.loadingTeams'));

    try {
      const teams = await window.Api.listTeams();
      resetOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
      teams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team.name;
        option.textContent = team.name;
        select.appendChild(option);
      });
      select.disabled = teams.length === 0;
      if (teams.length === 0) {
        showMessage(window.I18n.t('join.noTeams'), 'info');
      }
    } catch (err) {
      resetOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  async function loadOrderAttendees(orderInput, emailSelect, loadButton) {
    const orderCode = orderInput.value.trim();
    if (!orderCode) {
      showMessage(window.I18n.t('order.enterCode'), 'error');
      return;
    }

    orderInput.disabled = true;
    emailSelect.disabled = true;
    loadButton.disabled = true;
    resetOptions(emailSelect, window.I18n.t('order.loadingAttendees'));
    try {
      const emails = await window.Api.getOrderAttendees(orderCode);
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
      emails.forEach((email) => {
        const option = document.createElement('option');
        option.value = email;
        option.textContent = email;
        emailSelect.appendChild(option);
      });
      emailSelect.disabled = emails.length === 0;
      if (emails.length === 0) {
        showMessage(window.I18n.t('order.noAttendees'), 'info');
      }
    } catch (err) {
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
      showMessage(window.I18n.translateError(err), 'error');
    } finally {
      orderInput.disabled = false;
      loadButton.disabled = false;
    }
  }

  [
    ['create', 'create-order-code', 'create-attendee-email', 'create-load-attendees'],
    ['join', 'join-order-code', 'join-attendee-email', 'join-load-attendees'],
  ].forEach(([, orderId, emailId, buttonId]) => {
    const orderInput = document.getElementById(orderId);
    const emailSelect = document.getElementById(emailId);
    const loadButton = document.getElementById(buttonId);
    orderInput.addEventListener('input', () => {
      emailSelect.disabled = true;
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
    });
    loadButton.addEventListener('click', () => {
      loadOrderAttendees(orderInput, emailSelect, loadButton);
    });
  });

  document.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener('click', () => show('landing'));
  });

  // --- Create form --------------------------------------------------------
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('create-name');
    const orderInput = document.getElementById('create-order-code');
    const emailSelect = document.getElementById('create-attendee-email');
    const name = input.value.trim();
    const orderCode = orderInput.value.trim();
    const attendeeEmail = emailSelect.value;
    if (!attendeeEmail) {
      showMessage(window.I18n.t('order.selectAttendee'), 'error');
      return;
    }
    try {
      await window.Api.createTeam(name, orderCode, attendeeEmail);
      showMessage(`Team "${name}" created!`, 'success');
      input.value = '';
      orderInput.value = '';
      emailSelect.value = '';
      emailSelect.disabled = true;
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
      await viewTeam(name, orderCode);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  // --- Join form ----------------------------------------------------------
  document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('join-name');
    const orderInput = document.getElementById('join-order-code');
    const emailSelect = document.getElementById('join-attendee-email');
    const name = input.value.trim();
    const orderCode = orderInput.value.trim();
    const attendeeEmail = emailSelect.value;
    if (!attendeeEmail) {
      showMessage(window.I18n.t('order.selectAttendee'), 'error');
      return;
    }
    try {
      await window.Api.joinTeam(name, orderCode, attendeeEmail);
      showMessage(`Joined team "${name}"!`, 'success');
      input.value = '';
      orderInput.value = '';
      emailSelect.value = '';
      emailSelect.disabled = true;
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
      await viewTeam(name, orderCode);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  document.getElementById('verify-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamName = document.getElementById('verify-name').value.trim();
    const orderCode = document.getElementById('verify-order-code').value.trim();
    try {
      const team = await window.Api.verifyTeam(teamName, orderCode);
      renderTeamView(team);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  // --- Init ---------------------------------------------------------------
  (async function init() {
    // Pull server-side limits (max members, name lengths) before rendering.
    await window.Api.loadConfig();
    renderConfig();
    show('landing');
  })();
})();