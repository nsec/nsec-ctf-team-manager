/*
 * Team Manager configuration.
 * Tweak these values to change frontend behaviour.
 * When a backend is added, this can be served/validated server-side too.
 */
window.TEAM_CONFIG = {
  // Base URL of the backend API. Empty string = same origin (recommended:
  // serve the frontend from the FastAPI app). Example: 'http://localhost:8000'.
  apiBase: '',

  // Maximum number of members allowed per team.
  // Overridden at runtime by GET /api/config when the backend is reachable.
  maxMembersPerTeam: 8,

  // Maximum length of a team name, in characters.
  maxTeamNameLength: 128,

  // Minimum length of a team name, in characters.
  minTeamNameLength: 1,

  // Whether team names are case-insensitive when joining.
  caseInsensitiveTeamNames: true,

  // Whether a user may be a member of multiple teams at once.
  allowMultipleTeams: false,

  // Whether team names must be unique (enforced locally for now).
  uniqueTeamNames: true,
};