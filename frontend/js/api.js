/*
 * API client for the FastAPI backend.
 * Team data persists through the backend; the frontend stores only the
 * convenience copy of the Pretix order code locally.
 */
(function () {
  'use strict';

  // When served by the backend itself, same origin. Override here if the
  // frontend is served separately (e.g. http://localhost:8000).
  const API_BASE = window.TEAM_CONFIG.apiBase || '';

  async function request(method, path, body) {
    const res = await fetch(API_BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* non-JSON response */
    }
    if (!res.ok) {
      const err = new Error((data && data.detail) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.Api = {
    /** Fetch server-side limits and merge them into TEAM_CONFIG. */
    async loadConfig() {
      try {
        const cfg = await request('GET', '/api/config');
        Object.assign(window.TEAM_CONFIG, cfg);
      } catch (_) {
        /* fall back to local defaults */
      }
    },

    getOrderAttendees(orderCode) {
      return request('GET', `/api/orders/${encodeURIComponent(orderCode)}/attendees`);
    },

    createTeam(name, orderCode, attendeeEmail, ctfExperience) {
      return request('POST', '/api/teams', {
        name,
        ctf_experience: ctfExperience,
        order_code: orderCode,
        attendee_email: attendeeEmail,
      });
    },

    joinTeam(name, orderCode, attendeeEmail) {
      return request('POST', '/api/teams/join', {
        name,
        order_code: orderCode,
        attendee_email: attendeeEmail,
      });
    },

    listTeams() {
      return request('GET', '/api/teams');
    },

    verifyTeam(name, orderCode) {
      return request('POST', '/api/teams/verify', {
        name,
        order_code: orderCode,
      });
    },

    deleteTeam(teamId, orderCode) {
      return request('DELETE', `/api/teams/${encodeURIComponent(teamId)}`, {
        order_code: orderCode,
      });
    },

    updateTeamExperience(teamId, orderCode, ctfExperience) {
      return request('PATCH', `/api/teams/${encodeURIComponent(teamId)}/experience`, {
        order_code: orderCode,
        ctf_experience: ctfExperience,
      });
    },

    approveMember(teamId, memberId, orderCode) {
      return request(
        'POST',
        `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/approve`,
        { order_code: orderCode }
      );
    },

    rejectMember(teamId, memberId, orderCode) {
      return request(
        'POST',
        `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(memberId)}/reject`,
        { order_code: orderCode }
      );
    },

    removeMember(teamId, attendeeEmail, orderCode) {
      return request(
        'DELETE',
        `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(attendeeEmail)}`,
        { order_code: orderCode }
      );
    },
  };
})();