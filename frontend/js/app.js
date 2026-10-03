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
  const sections = ['landing', 'create-team', 'join-team', 'team-view'];

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
    // textContent never parses HTML, so team/member names are inert.
    document.getElementById('team-view-name').textContent = team.name;
    document.getElementById('member-count').textContent = team.members.length;
    const list = document.getElementById('member-list');
    list.textContent = '';
    team.members.forEach((m) => {
      const li = document.createElement('li');
      li.textContent = m.username;
      list.appendChild(li);
    });
    show('team-view');
  }

  // --- View team by name (after create/join) ------------------------------
  async function viewTeam(name) {
    try {
      const team = await window.Api.getTeam(name);
      renderTeamView(team);
    } catch (err) {
      showMessage(err.message, 'error');
      show('landing');
    }
  }

  // --- Navigation buttons -------------------------------------------------
  document.getElementById('btn-show-create').addEventListener('click', () => show('create-team'));

  function resetTeamOptions(select, placeholder) {
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
    resetTeamOptions(select, window.I18n.t('join.loadingTeams'));

    try {
      const teams = await window.Api.listTeams();
      resetTeamOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
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
      resetTeamOptions(select, window.I18n.t('join.selectTeamPlaceholder'));
      showMessage(err.message, 'error');
    }
  });

  document.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener('click', () => show('landing'));
  });

  // --- Create form --------------------------------------------------------
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('create-name');
    const name = input.value.trim();
    try {
      await window.Api.createTeam(name);
      showMessage(`Team "${name}" created!`, 'success');
      input.value = '';
      viewTeam(name);
    } catch (err) {
      showMessage(err.message, 'error');
    }
  });

  // --- Join form ----------------------------------------------------------
  document.getElementById('join-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('join-name');
    const name = input.value.trim();
    const username = (document.getElementById('join-username') || {}).value || 'you';
    try {
      await window.Api.joinTeam(name, username.trim());
      showMessage(`Joined team "${name}"!`, 'success');
      input.value = '';
      viewTeam(name);
    } catch (err) {
      showMessage(err.message, 'error');
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