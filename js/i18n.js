// Vertalingen voor de app: Nederlands, Engels, Duits.
const I18N_STRINGS = {
  nl: {
    undo: '↺ Ongedaan maken',
    reset: 'Reset',
    today: 'Vandaag',
    perHour: 'Per uur',
    last: 'Laatste',
    historyHeading: 'Geschiedenis',
    emptyState: 'Nog geen Schorles gelogd. Proost! 🥂',
    groupHeading: 'Groep',
    groupHint: 'Speel samen: zie de tussenstand van je vrienden op de Wurstmarkt.',
    createGroupBtn: 'Groep aanmaken',
    joinGroupBtn: 'Groep joinen',
    createGroupNamePlaceholder: 'Naam groep (bv. Wurstmarkt 2026)',
    yourNamePlaceholder: 'Jouw naam',
    createSubmit: 'Aanmaken',
    joinCodePlaceholder: 'Groepscode',
    joinSubmit: 'Meedoen',
    codeLabel: 'Code:',
    copyLink: 'kopieer link',
    copyLinkDone: 'gekopieerd!',
    leave: 'Verlaten',
    youSuffix: ' (jij)',
    resetConfirm: 'Weet je zeker dat je jouw teller wilt resetten? Dit kan niet ongedaan gemaakt worden.',
    leaveConfirm: 'Groep verlaten? Je eigen tellingen blijven bewaard in de groep, maar je ziet de tussenstand niet meer.',
    errorGeneric: 'Er ging iets mis: {msg}. Controleer je internetverbinding en probeer opnieuw.',
    errorNoGroupCode: 'Geen groep gevonden met deze code.',
    errorGroupsNotConfigured: 'Groepen zijn niet ingesteld voor deze app.',
    errorNoUniqueCode: 'Kon geen unieke groepscode genereren.',
    promptCopyLink: 'Kopieer deze link:',
  },
  en: {
    undo: '↺ Undo',
    reset: 'Reset',
    today: 'Today',
    perHour: 'Per hour',
    last: 'Last',
    historyHeading: 'History',
    emptyState: 'No Schorles logged yet. Cheers! 🥂',
    groupHeading: 'Group',
    groupHint: "Play together: see your friends' standings at the Wurstmarkt.",
    createGroupBtn: 'Create group',
    joinGroupBtn: 'Join group',
    createGroupNamePlaceholder: 'Group name (e.g. Wurstmarkt 2026)',
    yourNamePlaceholder: 'Your name',
    createSubmit: 'Create',
    joinCodePlaceholder: 'Group code',
    joinSubmit: 'Join',
    codeLabel: 'Code:',
    copyLink: 'copy link',
    copyLinkDone: 'copied!',
    leave: 'Leave',
    youSuffix: ' (you)',
    resetConfirm: 'Are you sure you want to reset your counter? This cannot be undone.',
    leaveConfirm: "Leave the group? Your own tally stays saved in the group, but you'll no longer see the standings.",
    errorGeneric: 'Something went wrong: {msg}. Check your internet connection and try again.',
    errorNoGroupCode: 'No group found with this code.',
    errorGroupsNotConfigured: 'Groups are not set up for this app.',
    errorNoUniqueCode: 'Could not generate a unique group code.',
    promptCopyLink: 'Copy this link:',
  },
  de: {
    undo: '↺ Rückgängig',
    reset: 'Zurücksetzen',
    today: 'Heute',
    perHour: 'Pro Stunde',
    last: 'Letzte',
    historyHeading: 'Verlauf',
    emptyState: 'Noch keine Schorle geloggt. Prost! 🥂',
    groupHeading: 'Gruppe',
    groupHint: 'Spielt zusammen: seht die Rangliste eurer Freunde auf dem Wurstmarkt.',
    createGroupBtn: 'Gruppe erstellen',
    joinGroupBtn: 'Gruppe beitreten',
    createGroupNamePlaceholder: 'Gruppenname (z. B. Wurstmarkt 2026)',
    yourNamePlaceholder: 'Dein Name',
    createSubmit: 'Erstellen',
    joinCodePlaceholder: 'Gruppencode',
    joinSubmit: 'Beitreten',
    codeLabel: 'Code:',
    copyLink: 'Link kopieren',
    copyLinkDone: 'kopiert!',
    leave: 'Verlassen',
    youSuffix: ' (du)',
    resetConfirm: 'Bist du sicher, dass du deinen Zähler zurücksetzen willst? Das kann nicht rückgängig gemacht werden.',
    leaveConfirm: 'Gruppe verlassen? Deine eigenen Zählungen bleiben in der Gruppe gespeichert, aber du siehst die Rangliste nicht mehr.',
    errorGeneric: 'Etwas ist schiefgelaufen: {msg}. Überprüfe deine Internetverbindung und versuche es erneut.',
    errorNoGroupCode: 'Keine Gruppe mit diesem Code gefunden.',
    errorGroupsNotConfigured: 'Gruppen sind für diese App nicht eingerichtet.',
    errorNoUniqueCode: 'Konnte keinen eindeutigen Gruppencode erzeugen.',
    promptCopyLink: 'Kopiere diesen Link:',
  },
};

const I18n = (() => {
  const LANG_KEY = 'schorle-lang';
  const LOCALE_MAP = { nl: 'nl-NL', en: 'en-US', de: 'de-DE' };

  let lang = loadLang();

  function loadLang() {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved && I18N_STRINGS[saved]) return saved;
    } catch {}
    const browserLang = (navigator.language || 'nl').slice(0, 2);
    return I18N_STRINGS[browserLang] ? browserLang : 'nl';
  }

  function setLang(l) {
    if (!I18N_STRINGS[l] || l === lang) return;
    lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch {}
    document.documentElement.lang = l;
    applyStaticTranslations();
  }

  function getLang() {
    return lang;
  }

  function locale() {
    return LOCALE_MAP[lang] || 'nl-NL';
  }

  function t(key, vars) {
    let str = (I18N_STRINGS[lang] && I18N_STRINGS[lang][key]) || I18N_STRINGS.nl[key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        str = str.replace(`{${k}}`, vars[k]);
      });
    }
    return str;
  }

  function applyStaticTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
  }

  document.documentElement.lang = lang;

  return { t, setLang, getLang, locale, applyStaticTranslations };
})();
