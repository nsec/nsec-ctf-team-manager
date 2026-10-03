/* Lightweight frontend-only English/French translations. */
(function () {
  'use strict';

  const translations = {
    en: {
      'language.switchToFrench': 'Switch language to French',
      'language.switchToEnglish': 'Switch language to English',
      'landing.title': 'Welcome!',
      'landing.prompt': 'What would you like to do?',
      'action.createTeam': 'Create a team',
      'action.joinTeam': 'Join a team',
      'create.title': 'Create a team',
      'form.teamName': 'Team name',
      'form.createNamePlaceholder': 'e.g. Kernel Panic',
      'create.maxLengthHint': 'Maximum length: {max} characters.',
      'action.create': 'Create',
      'action.back': 'Back',
      'join.title': 'Join a team',
      'join.selectTeamPlaceholder': 'Select a team',
      'join.loadingTeams': 'Loading teams…',
      'join.noTeams': 'No teams are available yet.',
      'form.username': 'Your username',
      'form.usernamePlaceholder': 'e.g. alice',
      'join.membersHint': 'Teams can have up to {max} members.',
      'action.join': 'Join',
      'team.title': 'Team: {name}',
      'team.titlePrefix': 'Team: ',
      'team.members': 'Members',
      'footer': 'Source code',
      'message.teamCreated': 'Team "{name}" created!',
      'message.teamJoined': 'Joined team "{name}"!',
      'error.nameMin': 'Team name must be at least {count} characters.',
      'error.nameMax': 'Team name must be at most {count} characters.',
      'error.duplicate': 'A team with this name already exists.',
      'error.usernameRequired': 'Username is required.',
      'error.teamMissing': 'No team found with this name.',
      'error.teamFull': 'This team is full (max {count} members).',
      'error.alreadyMember': 'You are already a member of this team.',
      'error.notFound': 'Team not found.',
      'error.requestFailed': 'Request failed ({status})',
    },
    fr: {
      'language.switchToFrench': 'Passer la langue en français',
      'language.switchToEnglish': 'Passer la langue en anglais',
      'landing.title': 'Bienvenue !',
      'landing.prompt': 'Que souhaitez-vous faire ?',
      'action.createTeam': 'Créer une équipe',
      'action.joinTeam': 'Rejoindre une équipe',
      'create.title': 'Créer une équipe',
      'form.teamName': "Nom de l’équipe",
      'form.createNamePlaceholder': 'p. ex. Kernel Panic',
      'create.maxLengthHint': 'Longueur maximale : {max} caractères.',
      'action.create': 'Créer',
      'action.back': 'Retour',
      'join.title': 'Rejoindre une équipe',
      'join.selectTeamPlaceholder': 'Sélectionnez une équipe',
      'join.loadingTeams': 'Chargement des équipes…',
      'join.noTeams': 'Aucune équipe n’est disponible pour le moment.',
      'form.username': "Votre nom d’utilisateur",
      'form.usernamePlaceholder': 'p. ex. alice',
      'join.membersHint': 'Une équipe peut compter jusqu’à {max} membres.',
      'action.join': 'Rejoindre',
      'team.title': 'Équipe : {name}',
      'team.titlePrefix': 'Équipe : ',
      'team.members': 'Membres',
      'footer': 'Code source',
      'message.teamCreated': 'Équipe « {name} » créée !',
      'message.teamJoined': 'Vous avez rejoint l’équipe « {name} » !',
      'error.nameMin': 'Le nom de l’équipe doit comporter au moins {count} caractères.',
      'error.nameMax': 'Le nom de l’équipe doit comporter au plus {count} caractères.',
      'error.duplicate': 'Une équipe portant ce nom existe déjà.',
      'error.usernameRequired': 'Le nom d’utilisateur est obligatoire.',
      'error.teamMissing': 'Aucune équipe ne porte ce nom.',
      'error.teamFull': 'Cette équipe est complète (maximum : {count} membres).',
      'error.alreadyMember': 'Vous faites déjà partie de cette équipe.',
      'error.notFound': 'Équipe introuvable.',
      'error.requestFailed': 'Échec de la requête ({status})',
    },
  };

  const storageKey = 'nsec-team-manager-language';
  const supportedLanguages = Object.keys(translations);
  let language = 'en';

  function interpolate(message, values) {
    return message.replace(/\{(\w+)\}/g, (_, key) =>
      values && values[key] !== undefined ? String(values[key]) : `{${key}}`
    );
  }

  function t(key, values) {
    const message = translations[language][key] || translations.en[key] || key;
    return interpolate(message, values);
  }

  function translateError(error) {
    const message = error && error.message ? error.message : String(error);
    let key;
    let values = {};
    let match;

    if ((match = message.match(/^Team name must be at least (\d+) characters\.$/))) {
      key = 'error.nameMin';
      values.count = match[1];
    } else if ((match = message.match(/^Team name must be at most (\d+) characters\.$/))) {
      key = 'error.nameMax';
      values.count = match[1];
    } else if ((match = message.match(/^This team is full \(max (\d+) members\)\.$/))) {
      key = 'error.teamFull';
      values.count = match[1];
    } else if ((match = message.match(/^Request failed \((\d+)\)$/))) {
      key = 'error.requestFailed';
      values.status = match[1];
    } else {
      const knownErrors = {
        'A team with this name already exists.': 'error.duplicate',
        'Username is required.': 'error.usernameRequired',
        'No team found with this name.': 'error.teamMissing',
        'You are already a member of this team.': 'error.alreadyMember',
        'Team not found.': 'error.notFound',
      };
      key = knownErrors[message];
    }

    if (key) return t(key, values);
    return message;
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.dataset.i18n;
      const values = {};
      const maxKey = element.dataset.i18nMax;
      if (maxKey && window.TEAM_CONFIG) values.max = window.TEAM_CONFIG[maxKey];
      const countKey = element.dataset.i18nCount;
      if (countKey && window.TEAM_CONFIG) values.count = window.TEAM_CONFIG[countKey];
      element.textContent = t(key, values);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
    });

    document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
      element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
    });

    if (document.documentElement) document.documentElement.lang = language;
    const toggle = document.getElementById('language-toggle');
    if (toggle) {
      const label = document.getElementById('language-toggle-label');
      if (label) label.textContent = language.toUpperCase();
      toggle.setAttribute('aria-label', t(language === 'en'
        ? 'language.switchToFrench'
        : 'language.switchToEnglish'));
    }
  }

  function setLanguage(nextLanguage) {
    if (!supportedLanguages.includes(nextLanguage)) return;
    language = nextLanguage;
    try {
      localStorage.setItem(storageKey, language);
    } catch (_) {
      // Language switching still works when storage is unavailable.
    }
    applyTranslations();
  }

  try {
    const savedLanguage = localStorage.getItem(storageKey);
    if (supportedLanguages.includes(savedLanguage)) language = savedLanguage;
  } catch (_) {
    // Use English when storage is unavailable.
  }

  window.I18n = { t, translateError, applyTranslations, setLanguage };
  applyTranslations();

  const toggle = document.getElementById('language-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => setLanguage(language === 'en' ? 'fr' : 'en'));
  }
})();
