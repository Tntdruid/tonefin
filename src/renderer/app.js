'use strict';
/* global jf, Player, TICKS_PER_SECOND */

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

function cleanError(e) {
  const msg = (e && e.message) || String(e);
  return msg.replace(/^Error invoking remote method '[^']+': (\w*Error: )?/, '');
}

async function api(path, query) {
  try {
    return await jf.api(path, query);
  } catch (e) {
    const msg = cleanError(e);
    if (/Login er udløbet/.test(msg)) {
      await jf.logout();
      showLogin('Login er udløbet. Log ind igen.');
    }
    throw new Error(msg);
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

const ticksToSec = (t) => (t || 0) / TICKS_PER_SECOND;

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
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}

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
  btn.textContent = 'Logger ind…';
  $('#login-error').textContent = '';
  try {
    const s = await jf.login($('#login-server').value, $('#login-user').value, $('#login-pass').value);
    $('#login-pass').value = '';
    startApp(s);
  } catch (err) {
    $('#login-error').textContent = cleanError(err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log ind';
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
        $('#login-error').textContent = 'Koden er udløbet. Prøv igen.';
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
  navigate('albums');
  loadSidebarPlaylists();
}

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
  content.replaceChildren(el('div', { class: 'loading' }, 'Henter…'));
  try {
    const node = await views[current.view](current.param);
    if (seq !== renderSeq) return;
    const top = el('div', { class: 'view' });
    if (navStack.length && !['albums', 'artists', 'songs', 'playlists', 'favorites', 'nowplaying'].includes(current.view)) {
      top.append(el('button', { class: 'link back', onclick: back }, '‹ Tilbage'));
    }
    top.append(node);
    content.replaceChildren(top);
    content.scrollTop = 0;
    markPlaying();
  } catch (err) {
    if (seq !== renderSeq) return;
    content.replaceChildren(
      el('div', { class: 'empty' }, el('p', {}, cleanError(err)), el('button', { onclick: render }, 'Prøv igen')),
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
          title: 'Afspil',
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
  if (!cards.length) return el('div', { class: 'empty' }, 'Intet fundet');
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
    if (!lists.length) box.replaceChildren(el('div', { class: 'muted small' }, 'Ingen playlister'));
  } catch {
    box.replaceChildren(el('button', { class: 'muted small', onclick: loadSidebarPlaylists }, 'Kunne ikke hente – prøv igen'));
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
  btn.title = on ? 'Fjern fra favoritter' : 'Tilføj til favoritter';
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

function repaintHearts(id) {
  const on = favOverride.get(id);
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => paintHeart(b, on));
}

async function toggleFav(item) {
  const on = !isFav(item);
  favOverride.set(item.Id, on);
  repaintHearts(item.Id);
  const method = on ? 'POST' : 'DELETE';
  try {
    try {
      await jf.api(`/UserFavoriteItems/${item.Id}`, { userId: session.userId }, method);
    } catch (e) {
      // Servers older than 10.9 only have the old route.
      if (!/ 404 /.test(cleanError(e))) throw e;
      await jf.api(`/Users/${session.userId}/FavoriteItems/${item.Id}`, {}, method);
    }
    toast(on ? `“${item.Name}” er tilføjet til favoritter` : `“${item.Name}” er fjernet fra favoritter`);
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
    if (!items.length) return toast('Ingen numre at afspille');
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

function trackTable(items, { showAlbum = true, numbers = 'index' } = {}) {
  const discs = new Set(items.map((t) => t.ParentIndexNumber || 1));
  const rows = [];
  let lastDisc = null;
  items.forEach((t, i) => {
    if (numbers === 'index' && discs.size > 1 && t.ParentIndexNumber !== lastDisc) {
      lastDisc = t.ParentIndexNumber;
      rows.push(el('div', { class: 'disc' }, `Disk ${lastDisc || 1}`));
    }
    const num = numbers === 'index' ? t.IndexNumber || '' : i + 1;
    rows.push(
      el(
        'div',
        { class: 'track', dataset: { id: t.Id }, ondblclick: () => player.playList(items, i), title: 'Dobbeltklik for at afspille' },
        el('button', { class: 'track-num', onclick: () => player.playList(items, i), title: 'Afspil herfra' }, el('span', {}, num), el('i', {}, '▶')),
        el('div', { class: 'track-main' }, el('div', { class: 'track-title' }, t.Name), el('div', { class: 'muted small' }, artistsOf(t))),
        showAlbum ? el('button', { class: 'link muted track-album', onclick: () => t.AlbumId && navigate('album', t.AlbumId) }, t.Album || '') : el('span'),
        el('span', { class: 'muted track-dur' }, fmtTime(ticksToSec(t.RunTimeTicks))),
        el(
          'span',
          { class: 'track-actions' },
          heart(t),
          el('button', { class: 'icon small', title: 'Afspil som næste', onclick: () => (player.playNext([t]), toast('Afspilles som næste')) }, '⤵'),
          el('button', { class: 'icon small', title: 'Tilføj til kø', onclick: () => (player.enqueue([t]), toast('Tilføjet til køen')) }, '+'),
        ),
      ),
    );
  });
  return el('div', { class: 'tracks' + (showAlbum ? '' : ' no-album') }, rows);
}

function collectionHeader(item, subtitle, tracks) {
  const dur = tracks.reduce((s, t) => s + ticksToSec(t.RunTimeTicks), 0);
  return el(
    'div',
    { class: 'collection-head' },
    cover(item, 400, 'cover big'),
    el(
      'div',
      {},
      el('h1', {}, item.Name),
      subtitle,
      el('p', { class: 'muted' }, `${tracks.length} numre · ${fmtTime(dur)}`),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'primary', onclick: () => player.playList(tracks, 0) }, '▶ Afspil'),
        el('button', { onclick: () => player.playList(tracks, 0, { shuffle: true }) }, '⇄ Bland'),
        el('button', { onclick: () => (player.enqueue(tracks), toast('Tilføjet til køen')) }, '+ Kø'),
        item.Type !== 'Playlist' && tracks.length ? heart(item, 'icon big-heart') : null,
      ),
    ),
  );
}

// ---------- views ----------

const views = {
  async albums() {
    const res = await userItems({ IncludeItemTypes: 'MusicAlbum', SortBy: 'SortName', Fields: 'ProductionYear' });
    return el('div', {}, el('h1', {}, 'Albums'), grid(res.Items.map(albumCard)));
  },

  async artists() {
    const res = await api('/Artists/AlbumArtists', { UserId: session.userId, SortBy: 'SortName', ImageTypeLimit: 1 });
    return el(
      'div',
      {},
      el('h1', {}, 'Kunstnere'),
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
          el('p', { class: 'muted' }, `${albums.Items.length} albums`),
          el(
            'div',
            { class: 'actions' },
            el('button', { class: 'primary', onclick: () => playFrom(() => artistTracks(id)) }, '▶ Afspil alle'),
            el('button', { onclick: () => playFrom(() => artistTracks(id), { shuffle: true }) }, '⇄ Bland'),
            heart(artist, 'icon big-heart'),
          ),
        ),
      ),
      el('h2', {}, 'Albums'),
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
      el('h1', {}, 'Playlister'),
      grid(lists.map((p) => card(p, { onOpen: () => navigate('playlist', p.Id), onPlay: () => playFrom(() => playlistTracks(p.Id)) }))),
    );
  },

  async playlist(id) {
    const [pl, tracks] = await Promise.all([api(`/Users/${session.userId}/Items/${id}`), playlistTracks(id)]);
    return el('div', {}, collectionHeader(pl, el('p', { class: 'muted' }, 'Playliste'), tracks), trackTable(tracks, { numbers: 'position' }));
  },

  async favorites() {
    const [songs, albums, artists] = await Promise.all([
      userItems({ Filters: 'IsFavorite', IncludeItemTypes: 'Audio', SortBy: 'SortName' }),
      userItems({ Filters: 'IsFavorite', IncludeItemTypes: 'MusicAlbum', SortBy: 'SortName', Fields: 'ProductionYear' }),
      api('/Artists', { UserId: session.userId, IsFavorite: true, SortBy: 'SortName', ImageTypeLimit: 1 }),
    ]);
    const parts = [el('h1', {}, 'Favoritter')];
    if (songs.Items.length) {
      const tracks = songs.Items;
      parts.push(
        el(
          'div',
          { class: 'title-row' },
          el('h2', {}, `Sange (${tracks.length})`),
          el('button', { class: 'primary', onclick: () => player.playList(tracks, 0) }, '▶ Afspil'),
          el('button', { onclick: () => player.playList(tracks, 0, { shuffle: true }) }, '⇄ Bland'),
        ),
        trackTable(tracks, { numbers: 'position' }),
      );
    }
    if (albums.Items.length) parts.push(el('h2', {}, `Albums (${albums.Items.length})`), grid(albums.Items.map(albumCard)));
    if (artists.Items.length)
      parts.push(
        el('h2', {}, `Kunstnere (${artists.Items.length})`),
        grid(artists.Items.map((a) => card(a, { round: true, onOpen: () => navigate('artist', a.Id), onPlay: () => playFrom(() => artistTracks(a.Id)) }))),
      );
    if (parts.length === 1)
      parts.push(el('div', { class: 'empty' }, 'Ingen favoritter endnu. Tryk på ♡ ved et nummer, et album eller en kunstner for at tilføje det.'));
    return el('div', {}, parts);
  },

  async songs() {
    const PAGE = 200;
    const res = await userItems({ IncludeItemTypes: 'Audio', SortBy: 'SortName', Limit: PAGE, StartIndex: 0 });
    const items = res.Items.slice();
    const wrap = el('div', {});
    const more = el('button', {}, 'Indlæs flere');
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
      el('div', { class: 'title-row' }, el('h1', {}, 'Sange'), el('span', { class: 'muted' }, `${res.TotalRecordCount} numre`), el('button', { onclick: shuffleAll }, '⇄ Bland alle')),
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
    const parts = [el('h1', {}, `Søgning: “${term}”`)];
    if (artists.Items.length)
      parts.push(el('h2', {}, 'Kunstnere'), grid(artists.Items.map((a) => card(a, { round: true, onOpen: () => navigate('artist', a.Id), onPlay: () => playFrom(() => artistTracks(a.Id)) }))));
    if (albums.Items.length) parts.push(el('h2', {}, 'Albums'), grid(albums.Items.map(albumCard)));
    if (songs.Items.length) parts.push(el('h2', {}, 'Sange'), trackTable(songs.Items, { numbers: 'position' }));
    if (parts.length === 1) parts.push(el('div', { class: 'empty' }, 'Intet fundet'));
    return el('div', {}, parts);
  },

  async nowplaying() {
    const t = player.current;
    if (!t) return el('div', { class: 'empty' }, el('h1', {}, 'Spiller nu'), el('p', { class: 'muted' }, 'Intet spiller. Vælg et album eller en playliste.'));
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
        cover(t, 600, 'cover huge'),
        el(
          'div',
          {},
          el('div', { class: 'muted small' }, 'SPILLER NU'),
          el('h1', {}, t.Name),
          el('p', {}, artistsOf(t)),
          t.AlbumId ? el('button', { class: 'link muted', onclick: () => navigate('album', t.AlbumId) }, t.Album || '') : null,
          el('div', { class: 'actions' }, heart(t, 'icon big-heart')),
        ),
      ),
      el('div', { class: 'title-row' }, el('h2', {}, `Kø (${player.queue.length})`), el('button', { onclick: () => player.shuffleQueue() }, '⇄ Bland'), el('button', { onclick: () => player.clearQueue() }, 'Ryd kø')),
      el('div', { class: 'tracks' }, queue),
    );
  },
};

// ---------- player bar ----------

function markPlaying() {
  const id = player.current && player.current.Id;
  document.querySelectorAll('#content .track[data-id]').forEach((r) => r.classList.toggle('playing', r.dataset.id === id));
}

function updateTrack() {
  const t = player.current;
  $('#bar-title').textContent = t ? t.Name : 'Intet spiller';
  $('#bar-artist').textContent = t ? artistsOf(t) : '';
  const img = $('#bar-cover');
  const url = imageUrl(t, 120);
  img.classList.toggle('hidden', !url);
  if (url) img.src = url;
  const fav = $('#bar-fav');
  fav.classList.toggle('hidden', !t);
  if (t) {
    fav.dataset.fav = t.Id;
    paintHeart(fav, isFav(t));
  }
  markPlaying();
  if (current && current.view === 'nowplaying') render();
  updateMediaSession();
  updateTime();
  document.title = t ? `${t.Name} – ${artistsOf(t)}` : 'Tonefin';
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
  const t = player.current;
  if (!t) {
    navigator.mediaSession.metadata = null;
    return;
  }
  const art = imageUrl(t, 512);
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.Name,
    artist: artistsOf(t),
    album: t.Album || '',
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

$('#btn-play').addEventListener('click', () => player.toggle());
$('#btn-next').addEventListener('click', () => player.next());
$('#btn-prev').addEventListener('click', () => player.prev());
$('#btn-shuffle').addEventListener('click', () => {
  player.shuffleQueue();
  toast('Køen er blandet');
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

function showReportStatus(s) {
  const node = $('#report-status');
  if (!s || !s.lastOk) {
    node.className = 'report-status';
    node.textContent = 'Klar til at rapportere';
    node.title = '';
    return;
  }
  node.className = 'report-status ' + (s.ok ? 'ok' : 'bad');
  const time = new Date(s.lastOk).toLocaleTimeString('da-DK');
  node.textContent = s.ok ? 'Rapporterer til Jellyfin' : 'Jellyfin svarer ikke – prøver igen';
  node.title = s.ok ? `Sidst rapporteret ${time}` : `${s.lastError}\nSidst rapporteret ${time}`;
}
jf.onReportStatus(showReportStatus);
jf.reportStatus().then(showReportStatus);

window.addEventListener('online', () => {
  jf.online();
  setTimeout(() => player.recover(), 1500);
});
jf.onResume(() => setTimeout(() => player.recover(), 3000));

// ---------- start ----------

(async () => {
  const s = await jf.getSession();
  if (s) startApp(s);
  else showLogin();
})();
