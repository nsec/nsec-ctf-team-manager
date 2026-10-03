/*
 * API client for the FastAPI backend.
 * All persistence now goes through the backend; no more localStorage.
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

    createTeam(name) {
      return request('POST', '/api/teams', { name });
    },

    joinTeam(name, username) {
      return request('POST', '/api/teams/join', { name, username });
    },

    getTeam(name) {
      return request('GET', `/api/teams/${encodeURIComponent(name)}`);
    },
  };
})();