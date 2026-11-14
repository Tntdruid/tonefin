'use strict';
/* global jf, Player, TICKS_PER_SECOND, t, errorText, applyStaticTexts, setLanguage, i18n */

const $ = (sel) => document.querySelector(sel);
const player = new Player();
let session = null;

// ---------- helpers ----------

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** The raw message of an error from the main process (often a code such as "E_HTTP 404 /Items"). */
function rawError(e) {
  const msg = (e && e.message) || String(e);
  return msg.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '');
}

/** Error text for the user, in the chosen language. */
function cleanError(e) {
  return errorText(rawError(e));
}

async function api(path, query) {
  try {
    return await jf.api(path, query);
  } catch (e) {
    const raw = rawError(e);
    if (raw.startsWith('E_AUTH_EXPIRED')) {
      await jf.logout();
      showLogin(t('login.expired'));
    }
    throw new Error(raw);
  }
}

function userItems(query) {
  return api(`/Users/${session.userId}/Items`, { Recursive: true, ImageTypeLimit: 1, ...query });
}

function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const ticksToSec = (ticks) => (ticks || 0) / TICKS_PER_SECOND;

function artistsOf(item) {
  if (item.Artists && item.Artists.length) return item.Artists.join(', ');
  return item.AlbumArtist || '';
}

function imageUrl(item, size = 300) {
  if (!item) return null;
  let id, tag;
  if (item.ImageTags && item.ImageTags.Primary) [id, tag] = [item.Id, item.ImageTags.Primary];
  else if (item.AlbumId && item.AlbumPrimaryImageTag) [id, tag] = [item.AlbumId, item.AlbumPrimaryImageTag];
  if (!id) return null;
  return `${session.server}/Items/${id}/Images/Primary?fillWidth=${size}&fillHeight=${size}&quality=90&tag=${tag}`;
}

function cover(item, size, cls = 'cover') {
  const url = imageUrl(item, size);
  const ph = el('div', { class: `${cls} placeholder` }, '♪');
  if (!url) return ph;
  const img = el('img', { class: cls, src: url, loading: 'lazy', alt: '' });
  img.addEventListener('error', () => img.replaceWith(ph));
  return img;
}

let toastTimer = null;
function toast(msg) {
  const box = $('#toast');
  box.textContent = msg;
  box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), 4000);
}

// Small per-computer settings (stored with the app's data, next to the exe).
const prefs = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('pref:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem('pref:' + key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

// ---------- login ----------

async function showLogin(message) {
  $('#app').classList.add('hidden');
  $('#login').classList.remove('hidden');
  const d = await jf.loginDefaults();
  $('#login-server').value = d.server || 'http://10.10.1.33:8096';
  $('#login-user').value = d.username || '';
  $('#login-pass').value = '';
  $('#login-error').textContent = message || '';
  ($('#login-user').value ? $('#login-pass') : $('#login-user')).focus();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  btn.disabled = true;
  btn.textContent = t('login.busy');
  $('#login-error').textContent = '';
  try {
    const s = await jf.login($('#login-server').value, $('#login-user').value, $('#login-pass').value);
    $('#login-pass').value = '';
    startApp(s);
  } catch (err) {
    $('#login-error').textContent = cleanError(err);
  } finally {
    btn.disabled = false;
    btn.textContent = t('login.btn');
  }
});

// Quick Connect ("Lyn-forbind"): show a code, then poll until it is approved in another Jellyfin app.
let quickTimer = null;
function stopQuick() {
  clearTimeout(quickTimer);
  quickTimer = null;
  $('#quick-box').classList.add('hidden');
  $('#quick-btn').classList.remove('hidden');
  $('#login-form').classList.remove('quick-mode');
}

$('#quick-btn').addEventListener('click', async () => {
  const btn = $('#quick-btn');
  btn.disabled = true;
  $('#login-error').textContent = '';
  try {
    const code = await jf.quickStart($('#login-server').value);
    $('#quick-code').textContent = code;
    $('#quick-box').classList.remove('hidden');
    btn.classList.add('hidden');
    $('#login-form').classList.add('quick-mode');
    const started = Date.now();
    const poll = async () => {
      if (!quickTimer) return;
      try {
        const s = await jf.quickCheck();
        if (s) {
          stopQuick();
          return startApp(s);
        }
      } catch (err) {
        stopQuick();
        $('#login-error').textContent = cleanError(err);
        return;
      }
      if (Date.now() - started > 9 * 60 * 1000) {
        stopQuick();
        $('#login-error').textContent = t('quick.expired');
        return;
      }
      quickTimer = setTimeout(poll, 3000);
    };
    quickTimer = setTimeout(poll, 3000);
  } catch (err) {
    $('#login-error').textContent = cleanError(err);
  } finally {
    btn.disabled = false;
  }
});

$('#quick-cancel').addEventListener('click', () => {
  stopQuick();
  jf.quickCancel();
});

$('#logout').addEventListener('click', async () => {
  forgetQueue();
  player.clearQueue();
  await jf.logout();
  session = null;
  showLogin();
});
$('#open-log').addEventListener('click', () => jf.openLog());

function startApp(s) {
  session = s;
  player.setSession(s);
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#user-line').textContent = `${s.userName} · ${s.server.replace(/^https?:\/\//, '')}`;
  navStack.length = 0;
  restoreQueue();
  navigate('home');
  loadSidebarPlaylists();
  if (prefs.get('autoUpdateCheck', true)) checkForUpdate(false);
}

// ---------- remember the queue ----------

const SAVED_FIELDS = ['Id', 'Name', 'Type', 'Album', 'AlbumId', 'AlbumArtist', 'Artists', 'RunTimeTicks', 'IndexNumber',
  'ParentIndexNumber', 'ImageTags', 'AlbumPrimaryImageTag', 'NormalizationGain'];
const MAX_SAVED = 1000;

function queueKey() {
  return session ? `queue:${session.server}:${session.userId}` : null;
}

function slim(item) {
  const out = {};
  for (const f of SAVED_FIELDS) if (item[f] !== undefined) out[f] = item[f];
  if (item.UserData) out.UserData = { IsFavorite: !!item.UserData.IsFavorite };
  return out;
}

function saveQueue() {
  const key = queueKey();
  if (!key) return;
  try {
    if (!player.queue.length || player.index < 0) return localStorage.removeItem(key);
    let start = 0;
    if (player.queue.length > MAX_SAVED) start = Math.max(0, Math.min(player.index - 100, player.queue.length - MAX_SAVED));
    const queue = player.queue.slice(start, start + MAX_SAVED).map(slim);
    localStorage.setItem(key, JSON.stringify({
      queue,
      index: player.index - start,
      position: player.audio.ended ? 0 : player.audio.currentTime || 0,
      shuffled: player.shuffled,
    }));
  } catch {
    /* not important enough to bother the user */
  }
}

let saveTimer = null;
function saveQueueSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveQueue, 1000);
}

function forgetQueue() {
  const key = queueKey();
  try {
    if (key) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function restoreQueue() {
  const key = queueKey();
  if (!key || player.queue.length) return;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && saved.queue && saved.queue.length) player.restore(saved.queue, saved.index, saved.position, { shuffled: saved.shuffled });
  } catch {
    /* start with an empty queue */
  }
}

// ---------- updates ----------

let updateInfo = null;
async function checkForUpdate(manual) {
  try {
    updateInfo = await jf.checkUpdate();
    const banner = $('#update-banner');
    banner.classList.toggle('hidden', !updateInfo.newer);
    banner.textContent = t('upd.banner', { v: updateInfo.latest });
    if (manual) toast(updateInfo.newer ? t('upd.ready', { v: updateInfo.latest }) : t('upd.latest', { v: updateInfo.current }));
  } catch (e) {
    if (manual) toast(t('upd.failed', { e: cleanError(e) }));
  }
  if (current && current.view === 'settings') render();
}
$('#update-banner').addEventListener('click', () => updateInfo && jf.openRelease(updateInfo.url));
setInterval(() => {
  if (session && prefs.get('autoUpdateCheck', true)) checkForUpdate(false);
}, 6 * 60 * 60 * 1000);

// ---------- navigation ----------

const navStack = [];
let current = null;
let renderSeq = 0;

function navigate(view, param, push = true) {
  if (push && current) navStack.push(current);
  current = { view, param };
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
  render();
}

function back() {
  const prev = navStack.pop();
  if (prev) navigate(prev.view, prev.param, false);
}

async function render() {
  const seq = ++renderSeq;
  const content = $('#content');
  content.replaceChildren(el('div', { class: 'loading' }, t('loading')));
  try {
    const node = await views[current.view](current.param);
    if (seq !== renderSeq) return;
    const top = el('div', { class: 'view' });
    if (navStack.length && !['home', 'albums', 'artists', 'songs', 'playlists', 'favorites', 'nowplaying', 'settings'].includes(current.view)) {
      top.append(el('button', { class: 'link back', onclick: back }, t('back')));
    }
    top.append(node);
    content.replaceChildren(top);
    content.scrollTop = 0;
    markPlaying();
  } catch (err) {
    if (seq !== renderSeq) return;
    content.replaceChildren(
      el('div', { class: 'empty' }, el('p', {}, cleanError(err)), el('button', { onclick: render }, t('retry'))),
    );
  }
}

document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => navigate(b.dataset.nav)));

let searchTimer = null;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const term = e.target.value.trim();
  searchTimer = setTimeout(() => {
    if (term.length >= 2) navigate('search', term, current && current.view !== 'search');
    else if (!term && current && current.view === 'search') back();
  }, 300);
});

// ---------- building blocks ----------

function card(item, { round = false, onOpen, onPlay }) {
  return el(
    'div',
    { class: 'card' + (round ? ' round' : ''), onclick: onOpen, title: item.Name },
    el(
      'div',
      { class: 'card-art' },
      cover(item, 300),
      onPlay &&
        el('button', {
          class: 'card-play',
          title: t('play'),
          onclick: (e) => {
            e.stopPropagation();
            onPlay();
          },
        }, '▶'),
    ),
    el('div', { class: 'card-title' }, item.Name),
    el('div', { class: 'card-sub muted' }, round ? '' : [item.AlbumArtist, item.ProductionYear].filter(Boolean).join(' · ')),
  );
}

function grid(cards) {
  if (!cards.length) return el('div', { class: 'empty' }, t('nothingFound'));
  return el('div', { class: 'grid' }, cards);
}

async function albumTracks(albumId) {
  const res = await userItems({
    ParentId: albumId,
    IncludeItemTypes: 'Audio',
    SortBy: 'ParentIndexNumber,IndexNumber,SortName',
  });
  return res.Items;
}

async function playlistTracks(id) {
  const res = await api(`/Playlists/${id}/Items`, { UserId: session.userId });
  return res.Items;
}

/** Playlists that can hold music. Jellyfin marks many as "Unknown" media type, so only video/photo/book ones are left out. */
async function musicPlaylists() {
  const res = await userItems({ IncludeItemTypes: 'Playlist', SortBy: 'SortName' });
  return res.Items.filter((p) => !['Video', 'Photo', 'Book'].includes(p.MediaType));
}

async function loadSidebarPlaylists() {
  const box = $('#side-playlists');
  try {
    const lists = await musicPlaylists();
    box.replaceChildren(
      ...lists.map((p) => el('button', { title: p.Name, dataset: { id: p.Id }, onclick: () => navigate('playlist', p.Id) }, p.Name)),
    );
    if (!lists.length) box.replaceChildren(el('div', { class: 'muted small' }, t('noPlaylists')));
  } catch {
    box.replaceChildren(el('button', { class: 'muted small', onclick: loadSidebarPlaylists }, t('loadFailed')));
  }
}

// ---------- favorites ----------

const favOverride = new Map(); // item id -> favorite state changed in this session

function isFav(item) {
  if (!item) return false;
  if (favOverride.has(item.Id)) return favOverride.get(item.Id);
  return !!(item.UserData && item.UserData.IsFavorite);
}

function paintHeart(btn, on) {
  btn.textContent = on ? '♥' : '♡';
  btn.classList.toggle('on', on);
  btn.title = on ? t('fav.remove') : t('fav.add');
}

function heart(item, cls = 'icon small') {
  const b = el('button', {
    class: `${cls} heart`,
    dataset: { fav: item.Id },
    onclick: (e) => {
      e.stopPropagation();
      toggleFav(item);
    },
  });
  paintHeart(b, isFav(item));
  return b;
}

function repaintHearts(id, on = favOverride.get(id)) {
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => paintHeart(b, on));
}

const favPending = new Set(); // hearts the user is changing right now

/**
 * Fetches the item's current favorite state from Jellyfin. Server plugins (such as Auto Artist Playlists)
 * can set the heart while a song plays, so what was loaded with the queue goes stale.
 */
async function refreshFav(item) {
  if (!item || !session || favPending.has(item.Id)) return;
  try {
    const fresh = await jf.api(`/Users/${session.userId}/Items/${item.Id}`, {});
    if (favPending.has(item.Id) || !fresh || !fresh.UserData) return;
    item.UserData = { ...(item.UserData || {}), IsFavorite: !!fresh.UserData.IsFavorite };
    favOverride.set(item.Id, !!fresh.UserData.IsFavorite);
    repaintHearts(item.Id);
  } catch {
    /* try again next time */
  }
}

let playlistsRefreshedAt = 0;
function refreshSidebarPlaylistsSoon() {
  if (Date.now() - playlistsRefreshedAt < 60 * 1000) return;
  playlistsRefreshedAt = Date.now();
  setTimeout(loadSidebarPlaylists, 5000);
}

async function toggleFav(item) {
  favPending.add(item.Id);
  try {
    await doToggleFav(item);
  } finally {
    favPending.delete(item.Id);
  }
}

async function doToggleFav(item) {
  const on = !isFav(item);
  favOverride.set(item.Id, on);
  repaintHearts(item.Id);
  const method = on ? 'POST' : 'DELETE';
  try {
    try {
      await jf.api(`/UserFavoriteItems/${item.Id}`, { userId: session.userId }, method);
    } catch (e) {
      // Servers older than 10.9 only have the old route.
      if (!rawError(e).startsWith('E_HTTP 404')) throw e;
      await jf.api(`/Users/${session.userId}/FavoriteItems/${item.Id}`, {}, method);
    }
    toast(t(on ? 'fav.added' : 'fav.removed', { name: item.Name }));
  } catch (e) {
    favOverride.set(item.Id, !on);
    repaintHearts(item.Id);
    toast(cleanError(e));
  }
}

async function artistTracks(id) {
  const res = await userItems({
    ArtistIds: id,
    IncludeItemTypes: 'Audio',
    SortBy: 'ProductionYear,Album,ParentIndexNumber,IndexNumber',
  });
  return res.Items;
}

async function playFrom(loader, opts) {
  try {
    const items = await loader();
    if (!items.length) return toast(t('noTracks'));
    player.playList(items, 0, opts);
  } catch (e) {
    toast(cleanError(e));
  }
}

function albumCard(a) {
  return card(a, {
    onOpen: () => navigate('album', a.Id),
    onPlay: () => playFrom(() => albumTracks(a.Id)),
  });
}

function trackTable(items, { showAlbum = true, numbers = 'index', sub = artistsOf } = {}) {
  const discs = new Set(items.map((tr) => tr.ParentIndexNumber || 1));
  const rows = [];
  let lastDisc = null;
  items.forEach((tr, i) => {
    if (numbers === 'index' && discs.size > 1 && tr.ParentIndexNumber !== lastDisc) {
      lastDisc = tr.ParentIndexNumber;
      rows.push(el('div', { class: 'disc' }, t('disc', { n: lastDisc || 1 })));
    }
    const num = numbers === 'index' ? tr.IndexNumber || '' : i + 1;
    rows.push(
      el(
        'div',
        { class: 'track', dataset: { id: tr.Id }, ondblclick: () => player.playList(items, i), title: t('track.dblclick') },
        el('button', { class: 'track-num', onclick: () => player.playList(items, i), title: t('track.playFromHere') }, el('span', {}, num), el('i', {}, '▶')),
        el('div', { class: 'track-main' }, el('div', { class: 'track-title' }, tr.Name), el('div', { class: 'muted small' }, sub(tr))),
        showAlbum ? el('button', { class: 'link muted track-album', onclick: () => tr.AlbumId && navigate('album', tr.AlbumId) }, tr.Album || '') : el('span'),
        el('span', { class: 'muted track-dur' }, fmtTime(ticksToSec(tr.RunTimeTicks))),
        el(
          'span',
          { class: 'track-actions' },
          heart(tr),
          el('button', { class: 'icon small', title: t('track.playNext'), onclick: () => (player.playNext([tr]), toast(t('track.playNextDone'))) }, '⤵'),
          el('button', { class: 'icon small', title: t('track.addQueue'), onclick: () => (player.enqueue([tr]), toast(t('track.addedQueue'))) }, '+'),
        ),
      ),
    );
  });
  return el('div', { class: 'tracks' + (showAlbum ? '' : ' no-album') }, rows);
}

function collectionHeader(item, subtitle, tracks) {
  const dur = tracks.reduce((sum, tr) => sum + ticksToSec(tr.RunTimeTicks), 0);
  return el(
    'div',
    { class: 'collection-head' },
    cover(item, 400, 'cover big'),
    el(
      'div',
      {},
      el('h1', {}, item.Name),
      subtitle,
      el('p', { class: 'muted' }, `${t('n.tracks', { n: tracks.length })} · ${fmtTime(dur)}`),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'primary', onclick: () => player.playList(tracks, 0) }, t('btn.play')),
        el('button', { onclick: () => player.playList(tracks, 0, { shuffle: true }) }, t('btn.shuffle')),
        el('button', { onclick: () => (player.enqueue(tracks), toast(t('track.addedQueue'))) }, t('btn.queue')),
        item.Type !== 'Playlist' && tracks.length ? heart(item, 'icon big-heart') : null,
      ),
    ),
  );
}

// ---------- views ----------

const views = {
  async home() {
    const [latest, recent, most] = await Promise.all([
      userItems({ IncludeItemTypes: 'MusicAlbum', SortBy: 'DateCreated', SortOrder: 'Descending', Limit: 12, Fields: 'ProductionYear' }),
      userItems({ IncludeItemTypes: 'Audio', SortBy: 'DatePlayed', SortOrder: 'Descending', Filters: 'IsPlayed', Limit: 15 }),
      userItems({ IncludeItemTypes: 'Audio', SortBy: 'PlayCount', SortOrder: 'Descending', Filters: 'IsPlayed', Limit: 15 }),
    ]);
    const plays = (tr) => `${artistsOf(tr)} · ${t('n.plays', { n: (tr.UserData && tr.UserData.PlayCount) || 0 })}`;
    const section = (title, items, node) =>
      items.length
        ? [el('div', { class: 'title-row' }, el('h2', {}, title), el('button', { onclick: () => player.playList(items, 0) }, t('btn.play'))), node]
        : [];
    return el(
      'div',
      {},
      el('h1', {}, t('home.hello', { name: session.userName })),
      latest.Items.length ? [el('h2', {}, t('home.latest')), grid(latest.Items.map(albumCard))] : null,
      section(t('home.recent'), recent.Items, trackTable(recent.Items, { numbers: 'position' })),
      section(t('home.most'), most.Items, trackTable(most.Items, { numbers: 'position', sub: plays })),
      !latest.Items.length && !recent.Items.length ? el('div', { class: 'empty' }, t('home.empty')) : null,
    );
  },

  async albums() {
    const SORTS = {
      name: { label: t('sort.name'), SortBy: 'SortName', SortOrder: 'Ascending' },
      artist: { label: t('sort.artist'), SortBy: 'AlbumArtist,SortName', SortOrder: 'Ascending' },
      year: { label: t('sort.year'), SortBy: 'ProductionYear,SortName', SortOrder: 'Descending' },
      yearOld: { label: t('sort.yearOld'), SortBy: 'ProductionYear,SortName', SortOrder: 'Ascending' },
      added: { label: t('sort.added'), SortBy: 'DateCreated', SortOrder: 'Descending' },
      random: { label: t('sort.random'), SortBy: 'Random', SortOrder: 'Ascending' },
    };
    const sortKey = SORTS[prefs.get('albumSort', 'name')] ? prefs.get('albumSort', 'name') : 'name';
    const genres = await api('/Genres', { UserId: session.userId, IncludeItemTypes: 'MusicAlbum', SortBy: 'SortName', Recursive: true }).catch(() => ({ Items: [] }));
    let genreId = prefs.get('albumGenre', '');
    if (genreId && !genres.Items.some((g) => g.Id === genreId)) genreId = '';
    const { SortBy, SortOrder } = SORTS[sortKey];
    const res = await userItems({ IncludeItemTypes: 'MusicAlbum', SortBy, SortOrder, Fields: 'ProductionYear', GenreIds: genreId || undefined });

    const sortSelect = el('select', {
      title: t('sort.title'),
      onchange: (e) => {
        prefs.set('albumSort', e.target.value);
        render();
      },
    }, Object.entries(SORTS).map(([k, v]) => el('option', { value: k, selected: k === sortKey }, v.label)));
    const genreSelect = el('select', {
      title: t('genre.title'),
      onchange: (e) => {
        prefs.set('albumGenre', e.target.value);
        render();
      },
    }, el('option', { value: '' }, t('genre.all')), genres.Items.map((g) => el('option', { value: g.Id, selected: g.Id === genreId }, g.Name)));
    return el(
      'div',
      {},
      el('div', { class: 'title-row' }, el('h1', {}, t('nav.albums')), el('span', { class: 'muted' }, t('n.albums', { n: res.Items.length })), genreSelect, sortSelect),
      grid(res.Items.map(albumCard)),
    );
  },

  async settings() {
    const norm = prefs.get('normalization', 'track');
    const radio = (value, label, hint) =>
      el('label', { class: 'option' },
        el('input', {
          type: 'radio',
          name: 'norm',
          value,
          checked: norm === value,
          onchange: () => {
            prefs.set('normalization', value);
            player.setNormalization(value);
          },
        }),
        el('span', {}, el('b', {}, label), el('span', { class: 'muted small' }, hint)));
    const auto = el('input', {
      type: 'checkbox',
      checked: prefs.get('autoUpdateCheck', true),
      onchange: (e) => prefs.set('autoUpdateCheck', e.target.checked),
    });
    const version = updateInfo ? updateInfo.current : await jf.appVersion();
    const langSelect = el('select', {
      onchange: (e) => {
        setLanguage(e.target.value);
        languageChanged();
      },
    },
    el('option', { value: 'auto', selected: i18n.setting === 'auto' }, t('set.langAuto')),
    el('option', { value: 'da', selected: i18n.setting === 'da' }, 'Dansk'),
    el('option', { value: 'en', selected: i18n.setting === 'en' }, 'English'));
    return el(
      'div',
      { class: 'settings' },
      el('h1', {}, t('nav.settings')),
      el('h2', {}, t('set.lang')),
      el('p', {}, langSelect),
      el('h2', {}, t('set.norm')),
      el('p', { class: 'muted' }, t('set.normHelp')),
      radio('off', t('set.normOff'), t('set.normOffHint')),
      radio('track', t('set.normTrack'), t('set.normTrackHint')),
      radio('album', t('set.normAlbum'), t('set.normAlbumHint')),
      el('h2', {}, t('set.updates')),
      el('label', { class: 'option' }, auto, el('span', {}, el('b', {}, t('set.autoUpdate')), el('span', { class: 'muted small' }, t('set.autoUpdateHint')))),
      el('p', { class: 'actions' },
        el('button', { onclick: () => checkForUpdate(true) }, t('set.checkNow')),
        updateInfo && updateInfo.newer ? el('button', { class: 'primary', onclick: () => jf.openRelease(updateInfo.url) }, t('set.download', { v: updateInfo.latest })) : null),
      el('p', { class: 'muted small' }, `Tonefin ${version}`),
    );
  },

  async artists() {
    const res = await api('/Artists/AlbumArtists', { UserId: session.userId, SortBy: 'SortName', ImageTypeLimit: 1 });
    return el(
      'div',
      {},
      el('h1', {}, t('nav.artists')),
      grid(res.Items.map((a) => card(a, { round: true, onOpen: () => navigate('artist', a.Id), onPlay: () => playFrom(() => artistTracks(a.Id)) }))),
    );
  },

  async artist(id) {
    const [artist, albums] = await Promise.all([
      api(`/Users/${session.userId}/Items/${id}`),
      userItems({ IncludeItemTypes: 'MusicAlbum', AlbumArtistIds: id, SortBy: 'ProductionYear,SortName', SortOrder: 'Descending', Fields: 'ProductionYear' }),
    ]);
    return el(
      'div',
      {},
      el(
        'div',
        { class: 'collection-head' },
        cover(artist, 400, 'cover big round'),
        el(
          'div',
          {},
          el('h1', {}, artist.Name),
          el('p', { class: 'muted' }, t('n.albums', { n: albums.Items.length })),
          el(
            'div',
            { class: 'actions' },
            el('button', { class: 'primary', onclick: () => playFrom(() => artistTracks(id)) }, t('btn.playAll')),
            el('button', { onclick: () => playFrom(() => artistTracks(id), { shuffle: true }) }, t('btn.shuffle')),
            heart(artist, 'icon big-heart'),
          ),
        ),
      ),
      el('h2', {}, t('nav.albums')),
      grid(albums.Items.map(albumCard)),
    );
  },

  async album(id) {
    const [album, tracks] = await Promise.all([api(`/Users/${session.userId}/Items/${id}`), albumTracks(id)]);
    const artistLinks = (album.AlbumArtists || []).map((a) => el('button', { class: 'link', onclick: () => navigate('artist', a.Id) }, a.Name));
    const subtitle = el('p', {}, ...artistLinks.flatMap((l, i) => (i ? [', ', l] : [l])), album.ProductionYear ? ` · ${album.ProductionYear}` : '');
    return el('div', {}, collectionHeader(album, subtitle, tracks), trackTable(tracks, { showAlbum: false }));
  },

  async playlists() {
    const lists = await musicPlaylists();
    return el(
      'div',
      {},
      el('h1', {}, t('nav.playlists')),
      grid(lists.map((p) => card(p, { onOpen: () => navigate('playlist', p.Id), onPlay: () => playFrom(() => playlistTracks(p.Id)) }))),
    );
  },

  async playlist(id) {
    const [pl, tracks] = await Promise.all([api(`/Users/${session.userId}/Items/${id}`), playlistTracks(id)]);
    return el('div', {}, collectionHeader(pl, el('p', { class: 'muted' }, t('playlist')), tracks), trackTable(tracks, { numbers: 'position' }));
  },

  async favorites() {
    const [songs, albums, artists] = await Promise.all([
      userItems({ Filters: 'IsFavorite', IncludeItemTypes: 'Audio', SortBy: 'SortName' }),
      userItems({ Filters: 'IsFavorite', IncludeItemTypes: 'MusicAlbum', SortBy: 'SortName', Fields: 'ProductionYear' }),
      api('/Artists', { UserId: session.userId, IsFavorite: true, SortBy: 'SortName', ImageTypeLimit: 1 }),
    ]);
    const parts = [el('h1', {}, t('nav.favorites'))];
    if (songs.Items.length) {
      const tracks = songs.Items;
      parts.push(
        el(
          'div',
          { class: 'title-row' },
          el('h2', {}, `${t('nav.songs')} (${tracks.length})`),
          el('button', { class: 'primary', onclick: () => player.playList(tracks, 0) }, t('btn.play')),
          el('button', { onclick: () => player.playList(tracks, 0, { shuffle: true }) }, t('btn.shuffle')),
        ),
        trackTable(tracks, { numbers: 'position' }),
      );
    }
    if (albums.Items.length) parts.push(el('h2', {}, `${t('nav.albums')} (${albums.Items.length})`), grid(albums.Items.map(albumCard)));
    if (artists.Items.length)
      parts.push(
        el('h2', {}, `${t('nav.artists')} (${artists.Items.length})`),
        grid(artists.Items.map((a) => card(a, { round: true, onOpen: () => navigate('artist', a.Id), onPlay: () => playFrom(() => artistTracks(a.Id)) }))),
      );
    if (parts.length === 1)
      parts.push(el('div', { class: 'empty' }, t('favs.empty')));
    return el('div', {}, parts);
  },

  async songs() {
    const PAGE = 200;
    const res = await userItems({ IncludeItemTypes: 'Audio', SortBy: 'SortName', Limit: PAGE, StartIndex: 0 });
    const items = res.Items.slice();
    const wrap = el('div', {});
    const more = el('button', {}, t('songs.more'));
    const draw = () => {
      wrap.replaceChildren(trackTable(items, { numbers: 'position' }));
      more.classList.toggle('hidden', items.length >= res.TotalRecordCount);
      markPlaying();
    };
    more.addEventListener('click', async () => {
      more.disabled = true;
      try {
        const page = await userItems({ IncludeItemTypes: 'Audio', SortBy: 'SortName', Limit: PAGE, StartIndex: items.length });
        items.push(...page.Items);
        draw();
      } catch (e) {
        toast(cleanError(e));
      } finally {
        more.disabled = false;
      }
    });
    draw();
    const shuffleAll = () =>
      playFrom(async () => (await userItems({ IncludeItemTypes: 'Audio', SortBy: 'Random', Limit: 300 })).Items);
    return el(
      'div',
      {},
      el('div', { class: 'title-row' }, el('h1', {}, t('nav.songs')), el('span', { class: 'muted' }, t('n.tracks', { n: res.TotalRecordCount })), el('button', { onclick: shuffleAll }, t('btn.shuffleAll'))),
      wrap,
      el('div', { class: 'more' }, more),
    );
  },

  async search(term) {
    const [artists, albums, songs] = await Promise.all([
      api('/Artists', { UserId: session.userId, SearchTerm: term, Limit: 12, ImageTypeLimit: 1 }),
      userItems({ SearchTerm: term, IncludeItemTypes: 'MusicAlbum', Limit: 24, Fields: 'ProductionYear' }),
      userItems({ SearchTerm: term, IncludeItemTypes: 'Audio', Limit: 50 }),
    ]);
    const parts = [el('h1', {}, t('search.title', { q: term }))];
    if (artists.Items.length)
      parts.push(el('h2', {}, t('nav.artists')), grid(artists.Items.map((a) => card(a, { round: true, onOpen: () => navigate('artist', a.Id), onPlay: () => playFrom(() => artistTracks(a.Id)) }))));
    if (albums.Items.length) parts.push(el('h2', {}, t('nav.albums')), grid(albums.Items.map(albumCard)));
    if (songs.Items.length) parts.push(el('h2', {}, t('nav.songs')), trackTable(songs.Items, { numbers: 'position' }));
    if (parts.length === 1) parts.push(el('div', { class: 'empty' }, t('nothingFound')));
    return el('div', {}, parts);
  },

  async nowplaying() {
    const cur = player.current;
    if (!cur) return el('div', { class: 'empty' }, el('h1', {}, t('nav.nowplaying')), el('p', { class: 'muted' }, t('np.empty')));
    const queue = player.queue.map((q, i) =>
      el(
        'div',
        { class: 'track' + (i === player.index ? ' playing' : '') + (i < player.index ? ' past' : ''), ondblclick: () => player.playIndex(i) },
        el('button', { class: 'track-num', onclick: () => player.playIndex(i) }, el('span', {}, i + 1), el('i', {}, '▶')),
        el('div', { class: 'track-main' }, el('div', { class: 'track-title' }, q.Name), el('div', { class: 'muted small' }, artistsOf(q))),
        el('span', { class: 'muted' }, q.Album || ''),
        el('span', { class: 'muted track-dur' }, fmtTime(ticksToSec(q.RunTimeTicks))),
        el('span'),
      ),
    );
    return el(
      'div',
      { class: 'nowplaying' },
      el(
        'div',
        { class: 'np-hero' },
        cover(cur, 600, 'cover huge'),
        el(
          'div',
          {},
          el('div', { class: 'muted small' }, t('np.label')),
          el('h1', {}, cur.Name),
          el('p', {}, artistsOf(cur)),
          cur.AlbumId ? el('button', { class: 'link muted', onclick: () => navigate('album', cur.AlbumId) }, cur.Album || '') : null,
          el('div', { class: 'actions' }, heart(cur, 'icon big-heart')),
        ),
      ),
      el('div', { class: 'title-row' }, el('h2', {}, t('np.queue', { n: player.queue.length })), el('button', { onclick: () => player.shuffleQueue() }, t('btn.shuffle')), el('button', { onclick: () => player.clearQueue() }, t('np.clear'))),
      el('div', { class: 'tracks' }, queue),
    );
  },
};

// ---------- player bar ----------

function markPlaying() {
  const id = player.current && player.current.Id;
  document.querySelectorAll('#content .track[data-id]').forEach((r) => r.classList.toggle('playing', r.dataset.id === id));
}

let lastTrack = null;
function updateTrack() {
  const cur = player.current;
  if (lastTrack && lastTrack !== cur) {
    // The server may have reacted to the finished track (heart, new artist playlist).
    const prev = lastTrack;
    setTimeout(() => refreshFav(prev), 3000);
    refreshSidebarPlaylistsSoon();
  }
  lastTrack = cur;
  $('#bar-title').textContent = cur ? cur.Name : t('bar.nothing');
  $('#bar-artist').textContent = cur ? artistsOf(cur) : '';
  const img = $('#bar-cover');
  const url = imageUrl(cur, 120);
  img.classList.toggle('hidden', !url);
  if (url) img.src = url;
  const fav = $('#bar-fav');
  fav.classList.toggle('hidden', !cur);
  if (cur) {
    fav.dataset.fav = cur.Id;
    paintHeart(fav, isFav(cur));
  }
  markPlaying();
  if (current && current.view === 'nowplaying') render();
  updateMediaSession();
  updateTime();
  document.title = cur ? `${cur.Name} – ${artistsOf(cur)}` : 'Tonefin';
}

let seeking = false;
function updateTime() {
  const dur = player.duration;
  const pos = player.audio.currentTime || 0;
  $('#time-pos').textContent = fmtTime(pos);
  $('#time-dur').textContent = fmtTime(dur);
  if (!seeking) $('#seek').value = dur ? Math.round((pos / dur) * 1000) : 0;
  if ('mediaSession' in navigator && dur && isFinite(dur)) {
    try {
      navigator.mediaSession.setPositionState({ duration: dur, position: Math.min(pos, dur), playbackRate: 1 });
    } catch {
      /* ignore */
    }
  }
}

function updateState() {
  const playing = player.current && !player.audio.paused;
  $('#btn-play').textContent = playing ? '⏸' : '▶';
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = player.current ? (playing ? 'playing' : 'paused') : 'none';
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const cur = player.current;
  if (!cur) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const art = imageUrl(cur, 512);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: cur.Name,
    artist: artistsOf(cur),
    album: cur.Album || '',
    artwork: art ? [{ src: art, sizes: '512x512', type: 'image/jpeg' }] : [],
  });
}

if ('mediaSession' in navigator) {
  const ms = navigator.mediaSession;
  ms.setActionHandler('play', () => player.toggle());
  ms.setActionHandler('pause', () => player.toggle());
  ms.setActionHandler('previoustrack', () => player.prev());
  ms.setActionHandler('nexttrack', () => player.next());
  ms.setActionHandler('seekto', (d) => player.seek(d.seekTime));
}

player.addEventListener('track', updateTrack);
player.addEventListener('time', updateTime);
player.addEventListener('state', updateState);
player.addEventListener('queue', () => {
  if (current && current.view === 'nowplaying') render();
});
player.addEventListener('error', (e) => toast(e.detail));
player.addEventListener('track', saveQueueSoon);
player.addEventListener('queue', saveQueueSoon);
player.addEventListener('state', saveQueueSoon);
let lastSave = 0;
player.addEventListener('time', () => {
  if (Date.now() - lastSave > 10000) {
    lastSave = Date.now();
    saveQueue();
  }
});
window.addEventListener('beforeunload', saveQueue);

const REPEAT = {
  RepeatNone: { next: 'RepeatAll', text: '↻' },
  RepeatAll: { next: 'RepeatOne', text: '↻' },
  RepeatOne: { next: 'RepeatNone', text: '↻¹' },
};
function paintRepeat() {
  const r = REPEAT[player.repeatMode];
  const b = $('#btn-repeat');
  b.textContent = r.text;
  b.title = t('repeat.' + player.repeatMode);
  b.classList.toggle('on', player.repeatMode !== 'RepeatNone');
}
$('#btn-repeat').addEventListener('click', () => {
  player.setRepeat(REPEAT[player.repeatMode].next);
  prefs.set('repeat', player.repeatMode);
  paintRepeat();
  toast(t('repeat.' + player.repeatMode));
});
player.setRepeat(prefs.get('repeat', 'RepeatNone'));
paintRepeat();

const albumGains = new Map();
player.albumGain = (albumId) => {
  if (!albumGains.has(albumId)) {
    albumGains.set(albumId, api(`/Users/${session.userId}/Items/${albumId}`).then((a) => a.NormalizationGain ?? null));
  }
  return albumGains.get(albumId);
};
player.setNormalization(prefs.get('normalization', 'track'));

player.addEventListener('queueend', (e) => {
  setTimeout(() => refreshFav(e.detail), 3000);
  refreshSidebarPlaylistsSoon();
});

$('#btn-play').addEventListener('click', () => player.toggle());
$('#btn-next').addEventListener('click', () => player.next());
$('#btn-prev').addEventListener('click', () => player.prev());
$('#btn-shuffle').addEventListener('click', () => {
  player.shuffleQueue();
  toast(t('queue.shuffled'));
});
$('#btn-queue').addEventListener('click', () => navigate('nowplaying'));
$('#bar-track').addEventListener('click', () => player.current && navigate('nowplaying'));
$('#bar-fav').addEventListener('click', (e) => {
  e.stopPropagation();
  if (player.current) toggleFav(player.current);
});

const seek = $('#seek');
seek.addEventListener('input', () => {
  seeking = true;
  $('#time-pos').textContent = fmtTime((seek.value / 1000) * player.duration);
});
seek.addEventListener('change', () => {
  player.seek((seek.value / 1000) * player.duration);
  seeking = false;
});

const vol = $('#volume');
let savedVol = 80;
try {
  savedVol = Number(localStorage.getItem('volume') ?? 80);
} catch {
  /* ignore */
}
vol.value = savedVol;
player.setVolume(savedVol);
vol.addEventListener('input', () => {
  player.setVolume(Number(vol.value));
  try {
    localStorage.setItem('volume', vol.value);
  } catch {
    /* ignore */
  }
});

document.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    player.toggle();
  } else if (e.altKey && e.key === 'ArrowLeft') back();
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 3) back();
});

// ---------- reporting status, sleep and network ----------

let lastReportStatus = null;
function showReportStatus(s) {
  lastReportStatus = s;
  const node = $('#report-status');
  if (!s || !s.lastOk) {
    node.className = 'report-status';
    node.textContent = t('report.ready');
    node.title = '';
    return;
  }
  node.className = 'report-status ' + (s.ok ? 'ok' : 'bad');
  const time = new Date(s.lastOk).toLocaleTimeString(i18n.locale());
  node.textContent = s.ok ? t('report.ok') : t('report.bad');
  const last = t('report.last', { t: time });
  node.title = s.ok ? last : `${errorText(s.lastError)}\n${last}`;
}
jf.onReportStatus(showReportStatus);

// While something plays, pick up a heart set on the server (e.g. by a plugin once 70 % is played).
setInterval(() => {
  if (player.current && !player.audio.paused) refreshFav(player.current);
}, 30 * 1000);
jf.reportStatus().then(showReportStatus);

window.addEventListener('online', () => {
  jf.online();
  setTimeout(() => player.recover(), 1500);
});
jf.onResume(() => setTimeout(() => player.recover(), 3000));

// ---------- start ----------

/** Redraws everything that shows text after the language was changed. */
function languageChanged() {
  applyStaticTexts();
  paintRepeat();
  updateTrack();
  showReportStatus(lastReportStatus);
  if (updateInfo) $('#update-banner').textContent = t('upd.banner', { v: updateInfo.latest });
  if (session) {
    loadSidebarPlaylists();
    render();
  }
}

applyStaticTexts();
updateTrack();

(async () => {
  const s = await jf.getSession();
  if (s) startApp(s);
  else showLogin();
})();
