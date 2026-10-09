/* Lightweight frontend-only English/French translations. */
(function () {
  'use strict';

  const translations = {
    en: {
      'language.switchToFrench': 'Switch language to French',
      'language.switchToEnglish': 'Switch language to English',
      'action.createTeam': 'Create a team',
      'action.joinTeam': 'Join a team',
      'action.verifyMembers': 'Verify team members',
      'action.verify': 'Verify',
      'create.title': 'Create a team',
      'form.teamName': 'Team name',
      'form.ctfExperience': 'CTF experience',
      'experience.regular': 'Regular CTF',
      'experience.ai': 'AI CTF',
      'experience.regularHelp': 'Regular CTF: Generative AI is allowed only when no challenge context is provided (like a teacher or to write code).',
      'experience.aiHelp': 'AI CTF: Any generative AI is allowed without restrictions.',
      'experience.details': 'Details about the two CTF experiences',
      'form.createNamePlaceholder': 'e.g. Kernel Panic',
      'create.maxLengthHint': 'Maximum length: {max} characters.',
      'action.create': 'Create',
      'action.creating': 'Creating…',
      'action.back': 'Back',
      'join.title': 'Join a team',
      'join.selectTeamPlaceholder': 'Select a team',
      'join.loadingTeams': 'Loading teams…',
      'join.noTeams': 'No teams are available yet.',
      'form.orderCode': 'Pretix order code',
      'form.orderCodePlaceholder': 'e.g. QHB8A',
      'order.codeHelp': 'Your Pretix order number is the 5 characters in the subject of the email containing your tickets. Look for a subject containing "Your Northsec order".',
      'form.attendeeEmail': 'Attendee email',
      'action.findAttendees': 'Find attendees',
      'order.selectAttendeePlaceholder': 'Enter an order code and find attendees',
      'order.loadingAttendees': 'Loading attendees…',
      'order.noAttendees': 'No attendees found for this order code.',
      'order.enterCode': 'Enter your Pretix order code first.',
      'order.selectAttendee': 'Load the order and select your attendee email first.',
      'join.membersHint': 'Teams can have up to {max} members.',
      'verify.title': 'Verify team members',
      'action.join': 'Join',
      'team.title': 'Team: {name}',
      'team.titlePrefix': 'Team: ',
      'team.members': 'Members',
      'team.ctfExperience': 'CTF experience:',
      'footer': 'Source code',
      'message.teamCreated': 'Team "{name}" created!',
      'message.teamJoined': 'Joined team "{name}"!',
      'error.nameMin': 'Team name must be at least {count} characters.',
      'error.nameMax': 'Team name must be at most {count} characters.',
      'error.duplicate': 'A team with this name already exists.',
      'error.attendeeEmailRequired': 'Attendee email is required.',
      'error.teamMissing': 'No team found with this name.',
      'error.teamFull': 'This team is full (max {count} members).',
      'error.emailAlreadyMember': 'This email already belongs to a team.',
      'error.notFound': 'Team not found.',
      'error.requestFailed': 'Request failed ({status})',
      'error.invalidOrderAttendee': 'Invalid order code or attendee email.',
      'error.orderValidationUnavailable': 'Order validation is temporarily unavailable. Please try again.',
      'error.orderLookupUnavailable': 'Order lookup is temporarily unavailable. Please try again.',
      'error.orderCodeMismatch': 'That order code does not match a member of this team.',
    },
    fr: {
      'language.switchToFrench': 'Passer la langue en français',
      'language.switchToEnglish': 'Passer la langue en anglais',
      'landing.title': 'Bienvenue !',
      'landing.prompt': 'Que souhaitez-vous faire ?',
      'action.createTeam': 'Créer une équipe',
      'action.joinTeam': 'Rejoindre une équipe',
      'action.verifyMembers': 'Vérifier les membres',
      'action.verify': 'Vérifier',
      'create.title': 'Créer une équipe',
      'form.teamName': "Nom de l’équipe",
      'form.ctfExperience': 'Expérience CTF',
      'experience.regular': 'CTF régulier',
      'experience.ai': 'CTF IA',
      'experience.regularHelp': 'CTF régulier : l’IA générative est permise uniquement si aucun contexte du défi ne lui est fourni (comme un enseignant ou pour écrire du code).',
      'experience.aiHelp': 'CTF IA : toute IA générative est permise sans restriction.',
      'experience.details': 'Détails sur les deux expériences CTF',
      'form.createNamePlaceholder': 'ex. Kernel Panic',
      'create.maxLengthHint': 'Longueur maximale : {max} caractères.',
      'action.create': 'Créer',
      'action.creating': 'Création…',
      'action.back': 'Retour',
      'join.title': 'Rejoindre une équipe',
      'join.selectTeamPlaceholder': 'Sélectionnez une équipe',
      'join.loadingTeams': 'Chargement des équipes…',
      'join.noTeams': 'Aucune équipe n’est disponible pour le moment.',
      'form.orderCode': 'Code de commande Pretix',
      'form.orderCodePlaceholder': 'ex. QHB8A',
      'order.codeHelp': 'Votre numéro de commande Pretix correspond aux 5 caractères dans l’objet du courriel contenant vos billets. Recherchez un objet contenant « Your Northsec order ».',
      'form.attendeeEmail': 'Courriel du participant',
      'action.findAttendees': 'Trouver les participants',
      'order.selectAttendeePlaceholder': 'Saisissez un code de commande et trouvez les participants',
      'order.loadingAttendees': 'Chargement des participants…',
      'order.noAttendees': 'Aucun participant trouvé pour ce code de commande.',
      'order.enterCode': 'Saisissez d’abord votre code de commande Pretix.',
      'order.selectAttendee': 'Chargez la commande et sélectionnez d’abord le courriel du participant.',
      'join.membersHint': 'Une équipe peut compter jusqu’à {max} membres.',
      'verify.title': 'Vérifier les membres',
      'action.join': 'Rejoindre',
      'team.title': 'Équipe : {name}',
      'team.titlePrefix': 'Équipe : ',
      'team.members': 'Membres',
      'team.ctfExperience': 'Expérience CTF:',
      'footer': 'Code source',
      'message.teamCreated': 'Équipe « {name} » créée !',
      'message.teamJoined': 'Vous avez rejoint l’équipe « {name} » !',
      'error.nameMin': 'Le nom de l’équipe doit comporter au moins {count} caractères.',
      'error.nameMax': 'Le nom de l’équipe doit comporter au plus {count} caractères.',
      'error.duplicate': 'Une équipe portant ce nom existe déjà.',
      'error.attendeeEmailRequired': 'Le courriel du participant est obligatoire.',
      'error.teamMissing': 'Aucune équipe ne porte ce nom.',
      'error.teamFull': 'Cette équipe est complète (maximum : {count} membres).',
      'error.emailAlreadyMember': 'Ce courriel appartient déjà à une équipe.',
      'error.notFound': 'Équipe introuvable.',
      'error.requestFailed': 'Échec de la requête ({status})',
      'error.invalidOrderAttendee': 'Code de commande ou courriel du participant invalide.',
      'error.orderValidationUnavailable': 'La validation de la commande est temporairement indisponible. Veuillez réessayer.',
      'error.orderLookupUnavailable': 'La recherche de commande est temporairement indisponible. Veuillez réessayer.',
      'error.orderCodeMismatch': 'Ce code de commande ne correspond à aucun membre de cette équipe.',
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
        'Attendee email is required.': 'error.attendeeEmailRequired',
        'No team found with this name.': 'error.teamMissing',
        'This email already belongs to a team.': 'error.emailAlreadyMember',
        'Team not found.': 'error.notFound',
        'Invalid order code or attendee email.': 'error.invalidOrderAttendee',
        'Order validation is temporarily unavailable. Please try again.': 'error.orderValidationUnavailable',
        'Order lookup is temporarily unavailable. Please try again.': 'error.orderLookupUnavailable',
        'Order code does not match a member of this team.': 'error.orderCodeMismatch',
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
