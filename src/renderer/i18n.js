'use strict';
/**
 * Danish and English texts. A value is a string with {placeholders} or a function of the variables.
 * The language follows Windows unless chosen under Settings.
 */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const STRINGS = {
  da: {
    'nav.home': 'Hjem',
    'nav.albums': 'Albums',
    'nav.artists': 'Kunstnere',
    'nav.songs': 'Sange',
    'nav.playlists': 'Playlister',
    'nav.favorites': 'Favoritter',
    'nav.nowplaying': 'Spiller nu',
    'nav.settings': 'Indstillinger',
    'side.playlists': 'PLAYLISTER',
    'search.placeholder': 'Søg…',
    'logout': 'Log ud',
    'showLog': 'Vis log',

    'login.tagline': 'En musikafspiller til Jellyfin',
    'login.server': 'Server',
    'login.user': 'Brugernavn',
    'login.pass': 'Kodeord',
    'login.btn': 'Log ind',
    'login.busy': 'Logger ind…',
    'login.or': 'eller',
    'login.quick': 'Log ind med Lyn-forbind',
    'login.note': 'Kodeordet gemmes ikke. Appen husker kun den adgangsnøgle, Jellyfin giver ved login.',
    'login.expired': 'Login er udløbet. Log ind igen.',
    'quick.label': 'Din kode til Lyn-forbind',
    'quick.help': 'Åbn Jellyfin i browseren eller på telefonen, hvor du er logget ind. Gå til <b>Brugermenu → Lyn-forbind</b>, skriv koden og tryk <b>Tillad</b>. Appen logger selv ind bagefter.',
    'quick.cancel': 'Annullér',
    'quick.expired': 'Koden er udløbet. Prøv igen.',

    'bar.nothing': 'Intet spiller',
    'bar.shuffle': 'Bland køen',
    'bar.prev': 'Forrige',
    'bar.play': 'Afspil/pause',
    'bar.next': 'Næste',
    'bar.queue': 'Kø',
    'repeat.RepeatNone': 'Gentag: fra',
    'repeat.RepeatAll': 'Gentag: hele køen',
    'repeat.RepeatOne': 'Gentag: dette nummer',
    'queue.shuffled': 'Køen er blandet',

    'fav.add': 'Tilføj til favoritter',
    'fav.remove': 'Fjern fra favoritter',
    'fav.added': '“{name}” er tilføjet til favoritter',
    'fav.removed': '“{name}” er fjernet fra favoritter',

    'loading': 'Henter…',
    'back': '‹ Tilbage',
    'retry': 'Prøv igen',
    'nothingFound': 'Intet fundet',
    'noPlaylists': 'Ingen playlister',
    'loadFailed': 'Kunne ikke hente – prøv igen',
    'play': 'Afspil',
    'btn.play': '▶ Afspil',
    'btn.playAll': '▶ Afspil alle',
    'btn.shuffle': '⇄ Bland',
    'btn.shuffleAll': '⇄ Bland alle',
    'btn.queue': '+ Kø',
    'noTracks': 'Ingen numre at afspille',
    'track.playFromHere': 'Afspil herfra',
    'track.dblclick': 'Dobbeltklik for at afspille',
    'track.playNext': 'Afspil som næste',
    'track.playNextDone': 'Afspilles som næste',
    'track.addQueue': 'Tilføj til kø',
    'track.addedQueue': 'Tilføjet til køen',
    'disc': 'Disk {n}',
    'n.tracks': ({ n }) => plural(n, 'nummer', 'numre'),
    'n.albums': ({ n }) => plural(n, 'album', 'albums'),
    'n.plays': ({ n }) => plural(n, 'afspilning', 'afspilninger'),
    'playlist': 'Playliste',

    'home.hello': 'Hej {name}',
    'home.latest': 'Senest tilføjet',
    'home.recent': 'Senest afspillet',
    'home.most': 'Mest afspillet',
    'home.empty': 'Intet endnu. Gå til Albums og start noget musik.',

    'sort.title': 'Sortér',
    'sort.name': 'Navn',
    'sort.artist': 'Kunstner',
    'sort.year': 'År (nyeste først)',
    'sort.yearOld': 'År (ældste først)',
    'sort.added': 'Senest tilføjet',
    'sort.random': 'Tilfældig',
    'genre.title': 'Genre',
    'genre.all': 'Alle genrer',

    'favs.empty': 'Ingen favoritter endnu. Tryk på ♡ ved et nummer, et album eller en kunstner for at tilføje det.',
    'songs.more': 'Indlæs flere',
    'search.title': 'Søgning: “{q}”',
    'np.empty': 'Intet spiller. Vælg et album eller en playliste.',
    'np.label': 'SPILLER NU',
    'np.queue': 'Kø ({n})',
    'np.clear': 'Ryd kø',

    'set.lang': 'Sprog',
    'set.langAuto': 'Automatisk (som Windows)',
    'set.norm': 'Ens lydstyrke',
    'set.normHelp': 'Bruger Jellyfins lydstyrkeanalyse, så numre og albums spiller lige højt. Det kræver, at Jellyfins planlagte opgave "Audio Normalization" har kørt. Numre, der ikke er analyseret, spiller uændret.',
    'set.normOff': 'Fra',
    'set.normOffHint': 'Spil numrene, som de er',
    'set.normTrack': 'Pr. nummer',
    'set.normTrackHint': 'Alle numre spiller lige højt. Godt til blandede playlister.',
    'set.normAlbum': 'Pr. album',
    'set.normAlbumHint': 'Albummet beholder sin forskel mellem stille og høje numre',
    'set.updates': 'Opdateringer',
    'set.autoUpdate': 'Tjek automatisk for nye versioner',
    'set.autoUpdateHint': 'Ved opstart og hver 6. time. Spørger kun GitHub om nyeste version.',
    'set.checkNow': 'Søg efter opdateringer nu',
    'set.download': 'Hent {v}',

    'upd.banner': 'Ny version {v} – hent den',
    'upd.ready': 'Tonefin {v} er klar',
    'upd.latest': 'Du har den nyeste version ({v})',
    'upd.failed': 'Kunne ikke tjekke for opdateringer: {e}',

    'report.ready': 'Klar til at rapportere',
    'report.ok': 'Rapporterer til Jellyfin',
    'report.bad': 'Jellyfin svarer ikke – prøver igen',
    'report.last': 'Sidst rapporteret {t}',

    'player.netLost': 'Mistede forbindelsen til Jellyfin – prøver igen',
    'player.cantPlay': 'Kunne ikke afspille "{name}"',

    'err.E_UNREACHABLE': 'Jellyfin kunne ikke nås ({arg})',
    'err.E_TIMEOUT': 'Jellyfin svarede ikke i tide ({arg})',
    'err.E_AUTH_EXPIRED': 'Login er udløbet eller forkert',
    'err.E_BAD_LOGIN': 'Forkert brugernavn eller kodeord',
    'err.E_HTTP': 'Jellyfin svarede {arg}',
    'err.E_NO_SERVER': 'Skriv serverens adresse',
    'err.E_BAD_URL': 'Ugyldig serveradresse',
    'err.E_QC_DISABLED': 'Lyn-forbind er slået fra på serveren',
    'err.E_QC_NOT_STARTED': 'Lyn-forbind er ikke startet',
    'err.E_NOT_LOGGED_IN': 'Ikke logget ind',
    'err.E_GITHUB': 'GitHub svarede {arg}',
    'err.E_DLNA': 'Netværksafspilleren svarede med en fejl ({arg})',
    'err.E_DLNA_NONE': 'Ingen netværksafspiller er valgt',
    'err.E_UPDATE_DOWNLOAD': 'Opdateringen kunne ikke hentes {arg}',
    'err.E_UPDATE_CHECKSUM': 'Den hentede fil passede ikke med GitHubs checksum og er slettet',
    'err.E_UPDATE_NO_ASSET': 'Udgivelsen på GitHub har ingen Tonefin-exe',
    'err.E_UPDATE_NO_CHECKSUM': 'Udgivelsen på GitHub har ingen checksum, så filen kan ikke tjekkes',
    'err.E_UPDATE_NOT_PORTABLE': 'Selvopdatering virker kun i den portable exe',
    'upd.bannerInstall': 'Ny version {v} – opdatér nu',
    'upd.install': 'Opdatér nu',
    'upd.installVersion': 'Opdatér til {v}',
    'upd.confirmTitle': 'Opdatér til Tonefin {v}?',
    'upd.confirmText': 'Tonefin henter den nye version fra GitHub, tjekker at filen er ægte, og genstarter. Musikken stopper et øjeblik, og din kø og dit login bliver gemt.',
    'upd.downloading': 'Henter opdatering… {pct} %',
    'upd.restarting': 'Genstarter…',
    'upd.installFailed': 'Opdateringen mislykkedes: {e}',
    'out.title': 'Afspil på',
    'out.button': 'Vælg hvor musikken spiller',
    'out.this': 'Denne computer',
    'out.searching': 'Søger efter afspillere på netværket…',
    'out.none': 'Ingen netværksafspillere fundet. Tjek at enheden er tændt, og at netværk i standby er slået til.',
    'out.rescan': 'Søg igen',
    'out.switched': 'Spiller nu på {name}',
    'out.local': 'Spiller nu på denne computer',
    'out.failed': 'Kunne ikke skifte til {name}: {e}',

    'pause': 'Pause',
    'ok': 'OK',
    'cancel': 'Annullér',
    'mix.title': 'Start en uendelig Instant Mix ud fra dette',
    'btn.mix': '◎ Instant Mix',
    'mix.started': 'Instant Mix ud fra “{name}”',
    'btn.toPlaylist': '≡ Til playliste',
    'np.radio': 'Radio',
    'np.saveQueue': 'Gem som playliste',
    'pl.addTo': 'Tilføj til playliste',
    'pl.removeFrom': 'Fjern fra playlisten',
    'pl.new': '+ Ny playliste',
    'pl.newTitle': 'Ny playliste',
    'pl.newDots': '+ Ny playliste…',
    'pl.create': 'Opret',
    'pl.created': 'Playlisten “{name}” er oprettet',
    'pl.namePlaceholder': 'Navn på playlisten',
    'pl.addOne': 'Tilføj “{name}” til playliste',
    'pl.addMany': ({ n }) => `Tilføj ${plural(n, 'nummer', 'numre')} til playliste`,
    'pl.added': 'Tilføjet til “{name}”',
    'pl.removed': '“{name}” er fjernet fra playlisten',
    'pl.rename': 'Omdøb',
    'pl.delete': 'Slet',
    'pl.deleteTitle': 'Slet playlisten “{name}”?',
    'pl.deleteText': 'Playlisten slettes i Jellyfin. Selve sangene bliver ikke slettet.',
    'pl.deleted': 'Playlisten “{name}” er slettet',
  },

  en: {
    'nav.home': 'Home',
    'nav.albums': 'Albums',
    'nav.artists': 'Artists',
    'nav.songs': 'Songs',
    'nav.playlists': 'Playlists',
    'nav.favorites': 'Favorites',
    'nav.nowplaying': 'Now playing',
    'nav.settings': 'Settings',
    'side.playlists': 'PLAYLISTS',
    'search.placeholder': 'Search…',
    'logout': 'Log out',
    'showLog': 'Show log',

    'login.tagline': 'A music player for Jellyfin',
    'login.server': 'Server',
    'login.user': 'Username',
    'login.pass': 'Password',
    'login.btn': 'Log in',
    'login.busy': 'Logging in…',
    'login.or': 'or',
    'login.quick': 'Log in with Quick Connect',
    'login.note': 'Your password is not stored. The app only keeps the access key Jellyfin hands out at login.',
    'login.expired': 'Your login has expired. Please log in again.',
    'quick.label': 'Your Quick Connect code',
    'quick.help': 'Open Jellyfin in the browser or on your phone, where you are logged in. Go to <b>User menu → Quick Connect</b>, enter the code and press <b>Authorize</b>. The app logs in by itself afterwards.',
    'quick.cancel': 'Cancel',
    'quick.expired': 'The code has expired. Try again.',

    'bar.nothing': 'Nothing playing',
    'bar.shuffle': 'Shuffle the queue',
    'bar.prev': 'Previous',
    'bar.play': 'Play/pause',
    'bar.next': 'Next',
    'bar.queue': 'Queue',
    'repeat.RepeatNone': 'Repeat: off',
    'repeat.RepeatAll': 'Repeat: whole queue',
    'repeat.RepeatOne': 'Repeat: this song',
    'queue.shuffled': 'Queue shuffled',

    'fav.add': 'Add to favorites',
    'fav.remove': 'Remove from favorites',
    'fav.added': '“{name}” added to favorites',
    'fav.removed': '“{name}” removed from favorites',

    'loading': 'Loading…',
    'back': '‹ Back',
    'retry': 'Try again',
    'nothingFound': 'Nothing found',
    'noPlaylists': 'No playlists',
    'loadFailed': 'Couldn’t load – try again',
    'play': 'Play',
    'btn.play': '▶ Play',
    'btn.playAll': '▶ Play all',
    'btn.shuffle': '⇄ Shuffle',
    'btn.shuffleAll': '⇄ Shuffle all',
    'btn.queue': '+ Queue',
    'noTracks': 'No songs to play',
    'track.playFromHere': 'Play from here',
    'track.dblclick': 'Double-click to play',
    'track.playNext': 'Play next',
    'track.playNextDone': 'Playing next',
    'track.addQueue': 'Add to queue',
    'track.addedQueue': 'Added to the queue',
    'disc': 'Disc {n}',
    'n.tracks': ({ n }) => plural(n, 'song', 'songs'),
    'n.albums': ({ n }) => plural(n, 'album', 'albums'),
    'n.plays': ({ n }) => plural(n, 'play', 'plays'),
    'playlist': 'Playlist',

    'home.hello': 'Hi {name}',
    'home.latest': 'Recently added',
    'home.recent': 'Recently played',
    'home.most': 'Most played',
    'home.empty': 'Nothing yet. Go to Albums and start some music.',

    'sort.title': 'Sort',
    'sort.name': 'Name',
    'sort.artist': 'Artist',
    'sort.year': 'Year (newest first)',
    'sort.yearOld': 'Year (oldest first)',
    'sort.added': 'Recently added',
    'sort.random': 'Random',
    'genre.title': 'Genre',
    'genre.all': 'All genres',

    'favs.empty': 'No favorites yet. Press ♡ next to a song, an album or an artist to add it.',
    'songs.more': 'Load more',
    'search.title': 'Search: “{q}”',
    'np.empty': 'Nothing is playing. Pick an album or a playlist.',
    'np.label': 'NOW PLAYING',
    'np.queue': 'Queue ({n})',
    'np.clear': 'Clear queue',

    'set.lang': 'Language',
    'set.langAuto': 'Automatic (same as Windows)',
    'set.norm': 'Equal loudness',
    'set.normHelp': 'Uses Jellyfin’s loudness analysis so songs and albums play equally loud. Jellyfin’s scheduled task "Audio Normalization" must have run. Songs that haven’t been analysed play unchanged.',
    'set.normOff': 'Off',
    'set.normOffHint': 'Play the songs as they are',
    'set.normTrack': 'Per song',
    'set.normTrackHint': 'Every song plays equally loud. Good for mixed playlists.',
    'set.normAlbum': 'Per album',
    'set.normAlbumHint': 'The album keeps its difference between quiet and loud songs',
    'set.updates': 'Updates',
    'set.autoUpdate': 'Check for new versions automatically',
    'set.autoUpdateHint': 'At startup and every 6 hours. Only asks GitHub for the latest version.',
    'set.checkNow': 'Check for updates now',
    'set.download': 'Download {v}',

    'upd.banner': 'New version {v} – get it',
    'upd.ready': 'Tonefin {v} is available',
    'upd.latest': 'You have the latest version ({v})',
    'upd.failed': 'Couldn’t check for updates: {e}',

    'report.ready': 'Ready to report',
    'report.ok': 'Reporting to Jellyfin',
    'report.bad': 'Jellyfin isn’t responding – retrying',
    'report.last': 'Last reported {t}',

    'player.netLost': 'Lost the connection to Jellyfin – retrying',
    'player.cantPlay': 'Couldn’t play "{name}"',

    'err.E_UNREACHABLE': 'Couldn’t reach Jellyfin ({arg})',
    'err.E_TIMEOUT': 'Jellyfin didn’t respond in time ({arg})',
    'err.E_AUTH_EXPIRED': 'Login expired or invalid',
    'err.E_BAD_LOGIN': 'Wrong username or password',
    'err.E_HTTP': 'Jellyfin responded {arg}',
    'err.E_NO_SERVER': 'Enter the server’s address',
    'err.E_BAD_URL': 'Invalid server address',
    'err.E_QC_DISABLED': 'Quick Connect is turned off on the server',
    'err.E_QC_NOT_STARTED': 'Quick Connect hasn’t been started',
    'err.E_NOT_LOGGED_IN': 'Not logged in',
    'err.E_GITHUB': 'GitHub responded {arg}',
    'err.E_DLNA': 'The network player responded with an error ({arg})',
    'err.E_DLNA_NONE': 'No network player is selected',
    'err.E_UPDATE_DOWNLOAD': 'The update could not be downloaded {arg}',
    'err.E_UPDATE_CHECKSUM': 'The downloaded file did not match GitHub’s checksum and was deleted',
    'err.E_UPDATE_NO_ASSET': 'The GitHub release has no Tonefin exe',
    'err.E_UPDATE_NO_CHECKSUM': 'The GitHub release has no checksum, so the file can’t be checked',
    'err.E_UPDATE_NOT_PORTABLE': 'Self-update only works in the portable exe',
    'upd.bannerInstall': 'New version {v} – update now',
    'upd.install': 'Update now',
    'upd.installVersion': 'Update to {v}',
    'upd.confirmTitle': 'Update to Tonefin {v}?',
    'upd.confirmText': 'Tonefin downloads the new version from GitHub, checks that the file is genuine and restarts. The music stops for a moment, and your queue and login are kept.',
    'upd.downloading': 'Downloading update… {pct}%',
    'upd.restarting': 'Restarting…',
    'upd.installFailed': 'The update failed: {e}',
    'out.title': 'Play on',
    'out.button': 'Choose where the music plays',
    'out.this': 'This computer',
    'out.searching': 'Looking for players on the network…',
    'out.none': 'No network players found. Check that the device is on and that network standby is enabled.',
    'out.rescan': 'Search again',
    'out.switched': 'Now playing on {name}',
    'out.local': 'Now playing on this computer',
    'out.failed': 'Couldn’t switch to {name}: {e}',

    'pause': 'Pause',
    'ok': 'OK',
    'cancel': 'Cancel',
    'mix.title': 'Start an endless Instant Mix based on this',
    'btn.mix': '◎ Instant Mix',
    'mix.started': 'Instant Mix based on “{name}”',
    'btn.toPlaylist': '≡ To playlist',
    'np.radio': 'Radio',
    'np.saveQueue': 'Save as playlist',
    'pl.addTo': 'Add to playlist',
    'pl.removeFrom': 'Remove from the playlist',
    'pl.new': '+ New playlist',
    'pl.newTitle': 'New playlist',
    'pl.newDots': '+ New playlist…',
    'pl.create': 'Create',
    'pl.created': 'Created the playlist “{name}”',
    'pl.namePlaceholder': 'Playlist name',
    'pl.addOne': 'Add “{name}” to a playlist',
    'pl.addMany': ({ n }) => `Add ${plural(n, 'song', 'songs')} to a playlist`,
    'pl.added': 'Added to “{name}”',
    'pl.removed': 'Removed “{name}” from the playlist',
    'pl.rename': 'Rename',
    'pl.delete': 'Delete',
    'pl.deleteTitle': 'Delete the playlist “{name}”?',
    'pl.deleteText': 'The playlist is deleted in Jellyfin. The songs themselves are not deleted.',
    'pl.deleted': 'Deleted the playlist “{name}”',
  },
};

function systemLang() {
  return /^da\b/i.test(navigator.language || '') ? 'da' : 'en';
}

let langSetting = 'auto';
try {
  langSetting = JSON.parse(localStorage.getItem('pref:lang') || '"auto"');
} catch {
  /* auto */
}
let lang = langSetting === 'da' || langSetting === 'en' ? langSetting : systemLang();

function t(key, vars = {}) {
  const v = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  if (typeof v === 'function') return v(vars);
  return v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m));
}

/** Error messages from the main process are codes such as "E_HTTP 404 /Items"; turn them into text. */
function errorText(message) {
  const m = /^(E_[A-Z_]+)(?: (.*))?$/.exec(String(message || ''));
  if (!m) return String(message || '');
  return t('err.' + m[1], { arg: m[2] || '' });
}

/** Fills in elements marked data-i18n (text), data-i18n-html, data-i18n-title and data-i18n-placeholder. */
function applyStaticTexts(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((n) => (n.textContent = t(n.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((n) => (n.innerHTML = t(n.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-title]').forEach((n) => (n.title = t(n.dataset.i18nTitle)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach((n) => (n.placeholder = t(n.dataset.i18nPlaceholder)));
  document.documentElement.lang = lang;
}

function setLanguage(setting) {
  langSetting = setting === 'da' || setting === 'en' ? setting : 'auto';
  try {
    localStorage.setItem('pref:lang', JSON.stringify(langSetting));
  } catch {
    /* ignore */
  }
  lang = langSetting === 'auto' ? systemLang() : langSetting;
  applyStaticTexts();
}

const i18n = {
  get lang() {
    return lang;
  },
  get setting() {
    return langSetting;
  },
  locale: () => (lang === 'da' ? 'da-DK' : 'en-GB'),
  keys: (l) => Object.keys(STRINGS[l]),
};

window.t = t;
window.errorText = errorText;
window.applyStaticTexts = applyStaticTexts;
window.setLanguage = setLanguage;
window.i18n = i18n;
