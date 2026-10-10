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
  let currentTeam = null;
  let currentTeamOrderCode = '';
  const orderCodeStorageKey = 'nsec-team-manager-pretix-order-code';
  const orderCodeInputs = [
    'create-order-code',
    'join-order-code',
    'verify-order-code',
  ].map((id) => document.getElementById(id));

  function rememberOrderCode(sourceInput) {
    const orderCode = sourceInput.value;
    orderCodeInputs.forEach((input) => {
      if (input !== sourceInput) input.value = orderCode;
    });

    try {
      if (orderCode.trim()) {
        window.localStorage.setItem(orderCodeStorageKey, orderCode.trim());
      } else {
        window.localStorage.removeItem(orderCodeStorageKey);
      }
    } catch (_) {
      // Order entry still works when browser storage is unavailable.
    }
  }

  try {
    const savedOrderCode = window.localStorage.getItem(orderCodeStorageKey);
    if (savedOrderCode) {
      orderCodeInputs.forEach((input) => {
        input.value = savedOrderCode;
      });
    }
  } catch (_) {
    // Order entry still works when browser storage is unavailable.
  }

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
  function renderTeamView(team, orderCode) {
    currentTeam = team;
    currentTeamOrderCode = orderCode;
    // textContent never parses HTML, so team names and member emails are inert.
    document.getElementById('team-view-name').textContent = team.name;
    const experienceFieldset = document.getElementById('team-experience-fieldset');
    const experienceInputs = document.querySelectorAll('input[name="teamCtfExperience"]');
    const selectedExperience = team.ctf_experience || 'regular';
    const experienceDisplay = document.getElementById('team-view-ctf-experience');
    experienceDisplay.textContent = window.I18n.t(`experience.${selectedExperience}`);
    experienceInputs.forEach((input) => {
      input.checked = input.value === selectedExperience;
      input.disabled = !team.is_creator;
    });
    experienceFieldset.classList.remove('hidden');
    document.getElementById('team-experience-creator-hint').classList.toggle(
      'hidden', team.is_creator
    );
    document.getElementById('team-ctf-experience-display').classList.add('hidden');
    document.getElementById('team-experience-status').textContent = '';
    document.getElementById('member-count').textContent = team.members.length;
    const list = document.getElementById('member-list');
    list.textContent = '';
    team.members.forEach((m) => {
      const li = document.createElement('li');
      const email = document.createElement('span');
      email.textContent = m.attendee_email;
      li.appendChild(email);
      if (m.is_creator) {
        const adminBadge = document.createElement('span');
        adminBadge.className = 'admin-badge';
        adminBadge.textContent = window.I18n.t('team.admin');
        li.appendChild(adminBadge);
      }
      list.appendChild(li);
    });
    document.getElementById('delete-team').classList.toggle('hidden', !team.is_creator);
    show('team-view');
  }

  // --- View team by name (after create/join) ------------------------------
  async function viewTeam(name, orderCode) {
    try {
      const team = await window.Api.verifyTeam(name, orderCode);
      renderTeamView(team, orderCode);
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
        const experience = team.ctf_experience || 'regular';
        option.textContent = `${team.name} — ${window.I18n.t(`experience.${experience}`)}`;
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
        const experience = team.ctf_experience || 'regular';
        option.textContent = `${team.name} — ${window.I18n.t(`experience.${experience}`)}`;
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
      if (emails.length === 1) {
        emailSelect.value = emails[0];
      }
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
      rememberOrderCode(orderInput);
      emailSelect.disabled = true;
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
    });
    orderInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadOrderAttendees(orderInput, emailSelect, loadButton);
      }
    });
    loadButton.addEventListener('click', () => {
      loadOrderAttendees(orderInput, emailSelect, loadButton);
    });
  });

  document.getElementById('verify-order-code').addEventListener('input', () => {
    rememberOrderCode(document.getElementById('verify-order-code'));
  });

  document.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener('click', () => show('landing'));
  });

  // --- Create form --------------------------------------------------------
  document.getElementById('create-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('create-name');
    const experienceInput = document.querySelector('input[name="createCtfExperience"]:checked');
    const orderInput = document.getElementById('create-order-code');
    const emailSelect = document.getElementById('create-attendee-email');
    const name = input.value.trim();
    const orderCode = orderInput.value.trim();
    rememberOrderCode(orderInput);
    const attendeeEmail = emailSelect.value;
    const ctfExperience = experienceInput.value;
    const submitButton = document.getElementById('create-submit');
    if (!attendeeEmail) {
      showMessage(window.I18n.t('order.selectAttendee'), 'error');
      return;
    }
    if (submitButton.disabled) return;

    submitButton.disabled = true;
    submitButton.textContent = window.I18n.t('action.creating');
    try {
      await window.Api.createTeam(name, orderCode, attendeeEmail, ctfExperience);
      showMessage(`Team "${name}" created!`, 'success');
      input.value = '';
      document.getElementById('create-ctf-experience-regular').checked = true;
      emailSelect.value = '';
      emailSelect.disabled = true;
      resetOptions(emailSelect, window.I18n.t('order.selectAttendeePlaceholder'));
      await viewTeam(name, orderCode);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = window.I18n.t('action.create');
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
    rememberOrderCode(orderInput);
    const attendeeEmail = emailSelect.value;
    if (!attendeeEmail) {
      showMessage(window.I18n.t('order.selectAttendee'), 'error');
      return;
    }
    try {
      await window.Api.joinTeam(name, orderCode, attendeeEmail);
      showMessage(`Joined team "${name}"!`, 'success');
      input.value = '';
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
    rememberOrderCode(document.getElementById('verify-order-code'));
    try {
      const team = await window.Api.verifyTeam(teamName, orderCode);
      renderTeamView(team, orderCode);
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    }
  });

  document.querySelectorAll('input[name="teamCtfExperience"]').forEach((input) => {
    input.addEventListener('change', async () => {
      if (!currentTeam || !currentTeam.is_creator || !input.checked) return;
      const status = document.getElementById('team-experience-status');
      const experienceInputs = document.querySelectorAll('input[name="teamCtfExperience"]');
      experienceInputs.forEach((radio) => { radio.disabled = true; });
      status.textContent = window.I18n.t('experience.saving');
      try {
        await window.Api.updateTeamExperience(
          currentTeam.id,
          currentTeamOrderCode,
          input.value
        );
        currentTeam.ctf_experience = input.value;
        document.getElementById('team-view-ctf-experience').textContent =
          window.I18n.t(`experience.${input.value}`);
        status.textContent = window.I18n.t('experience.saved');
      } catch (err) {
        experienceInputs.forEach((radio) => {
          radio.checked = radio.value === currentTeam.ctf_experience;
        });
        status.textContent = window.I18n.translateError(err);
      } finally {
        experienceInputs.forEach((radio) => { radio.disabled = !currentTeam.is_creator; });
      }
    });
  });

  document.getElementById('delete-team').addEventListener('click', async () => {
    const teamName = document.getElementById('team-view-name').textContent;
    if (!currentTeam || !currentTeam.is_creator
      || !window.confirm(window.I18n.t('confirm.deleteTeam', { name: teamName }))) {
      return;
    }

    const button = document.getElementById('delete-team');
    button.disabled = true;
    try {
      await window.Api.deleteTeam(currentTeam.id, currentTeamOrderCode);
      show('landing');
      showMessage(window.I18n.t('message.teamDeleted', { name: teamName }), 'success');
    } catch (err) {
      showMessage(window.I18n.translateError(err), 'error');
    } finally {
      button.disabled = false;
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