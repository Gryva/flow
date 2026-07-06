// Tiny i18n helper: English is the primary/fallback language, Croatian the
// secondary option. The chosen language persists in localStorage and every
// piece of app-owned UI text re-renders live on switch — track titles and
// artist names are never translated, only our own labels/messages.

const STORAGE_KEY = 'tok_lang';

const translations = {
  en: {
    loadingPlaylist: 'Loading playlist…',
    queueTitle: 'Queue',
    searchPlaceholder: 'Search songs...',
    dbExport: '⤓ Save database',
    dbImport: '⤒ Load database',
    fullscreen: 'Fullscreen',
    settings: 'Settings',
    refreshSuggestions: 'New suggestions',
    openQueue: 'Open queue',
    playOrder: 'Playback order',
    database: 'Database',
    addPlaylistTitle: 'Add playlist',
    addPlaylistText: 'Paste a YouTube Music playlist link or ID. Long-press the playlist name in the queue to switch between saved playlists.',
    cancel: 'Cancel',
    save: 'Save',
    aboutText: 'Flow is a DJ prompter for YouTube Music playlists — it listens to the current song and suggests the next one by tempo, energy and key, so the mix flows smoothly without interruptions.',
    aboutText2: 'Pick a direction, build energy, wind it down, or hold steady, and Flow keeps queuing tracks that fit. Track metadata, playlists and your theme are all saved on this device.',
    madeBy: 'Made by',
    close: 'Close',
    songTitleDefault: 'Song',
    fieldKey: 'Key',
    fieldEnergy: 'Energy (1–5)',
    fieldTags: 'Tags (comma-separated)',
    themeColor: 'Theme color',
    resetDefault: 'Reset to default',
    custom: 'Custom',
    changePlaylist: 'Change playlist',
    language: 'Language',
    langEnglish: 'English',
    langCroatian: 'Hrvatski',
    playNext: 'Play next',
    songDetails: 'Song details',
    noResultsFor: 'No songs found for "{query}"',
    dbSaved: 'Database saved.',
    dbLoadedCount: 'Loaded {count} songs.',
    dbReadError: 'Error reading file.',
    bpmInvalid: 'BPM must be a positive number.',
    energyInvalid: 'Energy must be a number from 1 to 5.',
    playlistIdInvalid: "Couldn't recognize the playlist ID.",
    loadFromDevice: 'Files',
    loadFromFolder: 'Folder',
    orLoadLocal: 'or',
    offlineMode: 'offline mode (saved list)',
    fetchPlaylistError: 'Error fetching the playlist',
    playlistEmpty: 'Playlist is empty or not publicly available',
    'order.sequential': 'in order',
    'order.curated': 'curated shuffle',
    'order.pure': 'full shuffle',
    songCountOne: 'song',
    songCountOther: 'songs'
  },
  hr: {
    loadingPlaylist: 'Učitavanje playliste…',
    queueTitle: 'Red čekanja',
    searchPlaceholder: 'Pretraži pjesme...',
    dbExport: '⤓ Spremi bazu',
    dbImport: '⤒ Učitaj bazu',
    fullscreen: 'Cijeli zaslon',
    settings: 'Postavke',
    refreshSuggestions: 'Novi prijedlozi',
    openQueue: 'Otvori queue',
    playOrder: 'Redoslijed reprodukcije',
    database: 'Baza podataka',
    addPlaylistTitle: 'Dodaj playlistu',
    addPlaylistText: 'Zalijepi YouTube Music playlist link ili ID. Dugi pritisak na naziv playliste u redu čekanja prebacuje između spremljenih playlisti.',
    cancel: 'Odustani',
    save: 'Spremi',
    aboutText: 'Flow je DJ sufler za YouTube Music playliste — sluša trenutnu pjesmu i predlaže sljedeću po brzini, energiji i tonalitetu, kako bi miks tekao glatko bez prekida.',
    aboutText2: 'Odaberi smjer, gradi energiju, smiri je ili drži stabilnom, a Flow nastavlja slagati pjesme koje pašu. Podaci o pjesmama, playliste i tema spremaju se lokalno na uređaju.',
    madeBy: 'Izradio',
    close: 'Zatvori',
    songTitleDefault: 'Pjesma',
    fieldKey: 'Tonalitet',
    fieldEnergy: 'Energija (1–5)',
    fieldTags: 'Tagovi (zarezom)',
    themeColor: 'Boja teme',
    resetDefault: 'Vrati zadano',
    custom: 'Prilagođeno',
    changePlaylist: 'Promijeni playlistu',
    language: 'Jezik',
    langEnglish: 'English',
    langCroatian: 'Hrvatski',
    playNext: 'Pusti sljedeću',
    songDetails: 'Detalji pjesme',
    noResultsFor: 'Nema pjesama za "{query}"',
    dbSaved: 'Baza spremljena.',
    dbLoadedCount: 'Učitano {count} pjesama.',
    dbReadError: 'Greška kod čitanja datoteke.',
    bpmInvalid: 'BPM mora biti pozitivan broj.',
    energyInvalid: 'Energy mora biti broj od 1 do 5.',
    playlistIdInvalid: 'Nisam prepoznao playlist ID.',
    loadFromDevice: 'Datoteke',
    loadFromFolder: 'Mapa',
    orLoadLocal: 'ili',
    offlineMode: 'offline način (spremljena lista)',
    fetchPlaylistError: 'Greška kod dohvata playliste',
    playlistEmpty: 'Playlist je prazna ili nije javno dostupna',
    'order.sequential': 'po redu',
    'order.curated': 'preporučeno nasumično',
    'order.pure': 'potpuno nasumično',
    songCountOne: 'pjesma',
    songCountOther: 'pjesama'
  }
};

let lang = (localStorage.getItem(STORAGE_KEY) === 'hr') ? 'hr' : 'en';
const listeners = [];

export function t(key, vars){
  let str = (translations[lang] && translations[lang][key]) || translations.en[key] || key;
  if (vars) {
    Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
  }
  return str;
}

export function getLang(){ return lang; }

export function applyStaticTranslations(){
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
}

export function setLang(l){
  if (!translations[l] || l === lang) return;
  lang = l;
  localStorage.setItem(STORAGE_KEY, l);
  applyStaticTranslations();
  listeners.forEach(fn => fn(l));
}

export function onLangChange(fn){
  listeners.push(fn);
}
