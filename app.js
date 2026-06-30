import { fetchPlaylistTracks, fetchPlaylistInfo, fmtTime, extractPlaylistId } from './js/youtube-api.js';
import { createVinylColorPicker } from './js/vinyl-color.js';
import { attachLongPress } from './js/long-press.js';
import { saveTracksCache, loadTracksCache, savePlaylistInfoCache, loadPlaylistInfoCache } from './js/track-cache.js';
import { openContextMenu } from './js/context-menu.js';
import { listPlaylists, addPlaylist, updatePlaylistTitle, removePlaylist } from './js/playlist-store.js';

if (window.TokEngine) window.TokEngine.init();

const YT_API_KEY = 'AIzaSyCkZpbb-oVsH_s2Yjn5AAql3Pfke0MExTA';
const DEFAULT_PLAYLIST_ID = 'PL9qqRdUh4PoNhlUS4g69SQTxteQKHVAe-';
let PLAYLIST_ID = localStorage.getItem('tok_playlist_id') || DEFAULT_PLAYLIST_ID;
addPlaylist(PLAYLIST_ID);

let tracks = [];
let currentIndex = 0;
let player = null;

let currentCandidates = null;
let history = [];
let playlistInfo = null;
let songModalTrack = null;

let storedOrder = localStorage.getItem('tok_order') || 'sequential';
if (storedOrder === 'shuffle') storedOrder = 'curated';
const state = {
  playing: false, queueOpen: false, armedDir: 'flow', order: storedOrder
};

const els = {
  playBtn: document.getElementById('tokPlayBtn'),
  prevBtn: document.getElementById('tokPrevBtn'),
  nextBtn: document.getElementById('tokNextBtn'),
  vinyl: document.getElementById('tokVinyl'),
  vinylCover: document.getElementById('tokVinylCover'),
  vinylImg: document.getElementById('tokVinylImg'),
  title: document.getElementById('tokNowTitle'),
  artist: document.getElementById('tokNowArtist'),
  status: document.getElementById('tokStatus'),
  wave: document.getElementById('tokWave'),
  vinylWrap: document.querySelector('.tok-vinyl-wrap'),
  nowMeta: document.querySelector('.tok-nowmeta'),
  queueToggle: document.getElementById('tokQueueToggle'),
  backdrop: document.getElementById('tokBackdrop'),
  sheet: document.getElementById('tokSheet'),
  handle: document.getElementById('tokHandle'),
  queue: document.getElementById('tokQueue'),
  queueSearch: document.getElementById('tokQueueSearch'),
  dirs: document.getElementById('tokDirs'),
  refreshDirs: document.getElementById('tokRefreshDirs'),
  changePlaylist: document.getElementById('tokChangePlaylist'),
  playlistBackdrop: document.getElementById('tokPlaylistBackdrop'),
  playlistInput: document.getElementById('tokPlaylistInput'),
  playlistError: document.getElementById('tokPlaylistError'),
  playlistCancel: document.getElementById('tokPlaylistCancel'),
  playlistSave: document.getElementById('tokPlaylistSave'),
  orderToggle: document.getElementById('tokOrderToggle'),
  orderIcon: document.getElementById('tokOrderIcon'),
  orderLabel: document.getElementById('tokOrderLabel'),
  playlistSavedList: document.getElementById('tokPlaylistSavedList'),
  playlistInfo: document.getElementById('tokPlaylistInfo'),
  playlistCover: document.getElementById('tokPlaylistCover'),
  playlistName: document.getElementById('tokPlaylistName'),
  playlistSub: document.getElementById('tokPlaylistSub'),
  songBackdrop: document.getElementById('tokSongBackdrop'),
  songTitle: document.getElementById('tokSongTitle'),
  songArtist: document.getElementById('tokSongArtist'),
  songBpm: document.getElementById('tokSongBpm'),
  songKey: document.getElementById('tokSongKey'),
  songEnergy: document.getElementById('tokSongEnergy'),
  songTags: document.getElementById('tokSongTags'),
  songError: document.getElementById('tokSongError'),
  songCancel: document.getElementById('tokSongCancel'),
  songSave: document.getElementById('tokSongSave'),
  dbToggle: document.getElementById('tokDbToggle'),
  dbDrawer: document.getElementById('tokDbDrawer'),
  dbExport: document.getElementById('tokDbExport'),
  dbImport: document.getElementById('tokDbImport'),
  dbImportFile: document.getElementById('tokDbImportFile'),
  dbStatus: document.getElementById('tokDbStatus')
};

const applyVinylColor = createVinylColorPicker();

// ---------- waveform progress bar ----------

const WAVE_BARS = 40;
function buildWave(){
  let html = '';
  for (let i = 0; i < WAVE_BARS; i++) {
    const h = 25 + Math.round(Math.sin(i * 1.3) * 20 + Math.sin(i * 0.4) * 30 + 30);
    // Each bar gets its own random duration (1.4–3.2 s) and a negative delay so
    // it starts mid-cycle — bars breathe independently from the moment they render.
    const dur   = (1.4 + Math.random() * 1.8).toFixed(2);
    const delay = (-Math.random() * 3).toFixed(2);
    const min   = (0.25 + Math.random() * 0.3).toFixed(2);
    html += '<div class="tok-wave-bar" style="'
      + 'height:' + Math.max(15, Math.min(100, h)) + '%;'
      + '--dur:' + dur + 's;'
      + '--delay:' + delay + 's;'
      + '--wave-min:' + min
      + '"></div>';
  }
  els.wave.innerHTML = html;
}
function setWaveAnimation(playing){
  const state = playing ? 'running' : 'paused';
  const bars = els.wave.children;
  for (let i = 0; i < bars.length; i++) bars[i].style.animationPlayState = state;
}
function updateWaveProgress(pct){
  const bars = els.wave.children;
  const cutoff = Math.round((pct / 100) * bars.length);
  for (let i = 0; i < bars.length; i++) {
    bars[i].classList.toggle('played', i < cutoff);
  }
}

els.wave.addEventListener('click', (e) => {
  if (!player || typeof player.seekTo !== 'function') return;
  const rect = els.wave.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const dur = player.getDuration() || tracks[currentIndex].durationSec || 0;
  if (!dur) return;
  player.seekTo(dur * pct, true);
  updateWaveProgress(pct * 100);
});

// ---------- playlist data ----------

let isOffline = false;

async function fetchPlaylist(){
  try {
    tracks = await fetchPlaylistTracks(YT_API_KEY, PLAYLIST_ID);
    isOffline = false;
    saveTracksCache(PLAYLIST_ID, tracks);
  } catch (err) {
    // No signal / API unreachable — fall back to whatever we last fetched
    // successfully for this playlist instead of leaving the DJ with a dead
    // app mid-set. Only gives up if there's truly nothing cached yet.
    const cached = loadTracksCache(PLAYLIST_ID);
    if (!cached) throw err;
    tracks = cached.tracks;
    isOffline = true;
  }
}

function renderPlaylistInfo(){
  if (!playlistInfo) { els.playlistInfo.style.display = 'none'; return; }
  els.playlistInfo.style.display = 'flex';
  els.playlistCover.style.backgroundImage = '';
  els.playlistCover.textContent = (playlistInfo.title || '?').trim().charAt(0).toUpperCase();
  els.playlistName.textContent = playlistInfo.title || '';
  const count = playlistInfo.count != null ? playlistInfo.count : tracks.length;
  const sub = [playlistInfo.author, count + (count === 1 ? ' pjesma' : ' pjesama')].filter(Boolean).join(' · ');
  els.playlistSub.textContent = sub;
}

async function refreshPlaylist(){
  let fresh;
  try {
    fresh = await fetchPlaylistTracks(YT_API_KEY, PLAYLIST_ID);
  } catch (err) {
    return;
  }
  if (!fresh.length) return;

  const currentTrack = tracks[currentIndex];
  const newIdx = currentTrack ? fresh.findIndex(t => t.id === currentTrack.id) : -1;

  // If the track currently loaded in the player can't be found in the
  // freshly fetched list (removed/reordered out, or a transient API
  // glitch), bail out rather than swap the array — otherwise currentIndex
  // would silently end up pointing at a different song than what's
  // actually playing.
  if (currentTrack && newIdx === -1) return;

  tracks = fresh;
  if (newIdx !== -1) currentIndex = newIdx;
  saveTracksCache(PLAYLIST_ID, fresh);
  if (isOffline) { isOffline = false; els.status.textContent = ''; }

  renderQueue();
}

// ---------- queue sheet ----------

function renderQueue(){
  const query = (els.queueSearch ? els.queueSearch.value : '').trim().toLowerCase();
  const indices = tracks
    .map((t, i) => i)
    .filter(i => !query || (tracks[i].title + ' ' + tracks[i].artist).toLowerCase().includes(query));

  if (!indices.length) {
    const empty = document.createElement('div');
    empty.className = 'tok-queue-empty';
    empty.textContent = 'Nema pjesama za "' + query + '"';
    els.queue.innerHTML = '';
    els.queue.appendChild(empty);
    return;
  }

  const candidateDirByIdx = {};
  if (currentCandidates) {
    ['up', 'flow', 'down'].forEach(dir => {
      candidateDirByIdx[currentCandidates[dir].idx] = dir;
    });
  }
  const CANDIDATE_ICON = { up: '🔥', flow: '🌊', down: '🌙' };

  els.queue.innerHTML = indices.map(i => {
    const t = tracks[i];
    const isCurrent = i === currentIndex;
    const dir = !isCurrent ? candidateDirByIdx[i] : null;
    const isCandidate = !!dir;
    const bpm = window.TokEngine ? window.TokEngine.getBPM(t) : null;
    return '<button class="tok-queue-row' + (isCurrent ? ' current' : '') + (isCandidate ? ' candidate' : '') + '" data-idx="' + i + '">' +
      '<div class="tok-cover--queue" style="background-image:url(\'' + t.thumb + '\')"></div>' +
      '<div class="tok-queue-meta"><div class="tok-queue-title">' + t.title + '</div>' +
      '<div class="tok-queue-artist">' + t.artist + '</div></div>' +
      (bpm ? '<div class="tok-queue-bpm">' + bpm + ' BPM</div>' : '') +
      (isCandidate ? '<div class="tok-queue-candicon">' + CANDIDATE_ICON[dir] + '</div>' : '') +
      '<div class="tok-queue-dur">' + fmtTime(t.durationSec) + '</div></button>';
  }).join('');
}

if (els.queueSearch) {
  els.queueSearch.addEventListener('input', renderQueue);
}

// ---------- local song-database backup (export/import to a JSON file) ----------
// Lets a DJ carry the curated suggestion database between devices, or keep
// an offline backup on the laptop itself — independent of network access.

function showDbStatus(msg){
  if (!els.dbStatus) return;
  els.dbStatus.textContent = msg;
  setTimeout(() => { if (els.dbStatus.textContent === msg) els.dbStatus.textContent = ''; }, 4000);
}

if (els.dbToggle && els.dbDrawer) {
  els.dbToggle.addEventListener('click', () => {
    const open = els.dbDrawer.classList.toggle('open');
    els.dbToggle.classList.toggle('active', open);
  });
}

if (els.dbExport) {
  els.dbExport.addEventListener('click', () => {
    if (!window.TokEngine) return;
    const blob = new Blob([window.TokEngine.exportDatabaseJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tok-baza-pjesama.json';
    a.click();
    URL.revokeObjectURL(url);
    showDbStatus('Baza spremljena.');
  });
}
if (els.dbImport && els.dbImportFile) {
  els.dbImport.addEventListener('click', () => els.dbImportFile.click());
  els.dbImportFile.addEventListener('change', () => {
    const file = els.dbImportFile.files[0];
    els.dbImportFile.value = '';
    if (!file || !window.TokEngine) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const count = window.TokEngine.importDatabaseJSON(reader.result);
        showDbStatus('Učitano ' + count + ' pjesama.');
        if (tracks.length) { renderQueue(); renderDirs(); }
      } catch (err) {
        showDbStatus(String((err && err.message) || err));
      }
    };
    reader.onerror = () => showDbStatus('Greška kod čitanja datoteke.');
    reader.readAsText(file);
  });
}

function scrollQueueToCurrent(){
  const row = els.queue.querySelector('.tok-queue-row.current');
  if (row) row.scrollIntoView({ block: 'center' });
}
function openQueue(){
  state.queueOpen = true;
  els.backdrop.classList.add('open');
  els.sheet.classList.add('open');
  renderPlaylistInfo();
  scrollQueueToCurrent();
  refreshPlaylist().then(scrollQueueToCurrent);
  if (!playlistInfo) {
    playlistInfo = loadPlaylistInfoCache(PLAYLIST_ID);
    if (playlistInfo) renderPlaylistInfo();
    fetchPlaylistInfo(YT_API_KEY, PLAYLIST_ID).then(info => {
      playlistInfo = info;
      savePlaylistInfoCache(PLAYLIST_ID, info);
      updatePlaylistTitle(PLAYLIST_ID, info.title || '');
      renderPlaylistInfo();
    }).catch(() => {});
  }
}
function closeQueue(){
  state.queueOpen = false;
  els.backdrop.classList.remove('open');
  els.sheet.classList.remove('open');
  if (els.queueSearch && els.queueSearch.value) {
    els.queueSearch.value = '';
    renderQueue();
  }
}

els.queueToggle.addEventListener('click', () => state.queueOpen ? closeQueue() : openQueue());
els.backdrop.addEventListener('click', closeQueue);
els.handle.addEventListener('click', closeQueue);
els.queue.addEventListener('click', (e) => {
  const row = e.target.closest('.tok-queue-row');
  if (!row || row.dataset.longPressed === '1') { if (row) delete row.dataset.longPressed; return; }
  const idx = parseInt(row.getAttribute('data-idx'), 10);
  closeQueue();
  if (idx !== currentIndex) switchTrack(idx, true);
});

attachLongPress(els.queue, '.tok-queue-row', (row, pos) => {
  const idx = parseInt(row.getAttribute('data-idx'), 10);
  openContextMenu(pos.x, pos.y, [
    { label: '▶️ Pusti sljedeću', onSelect: () => playNext(idx) },
    { label: '✏️ Detalji pjesme', onSelect: () => openSongModal(idx) }
  ]);
});
if (els.vinylWrap) attachLongPress(els.vinylWrap, '.tok-vinyl-wrap', () => openSongModal(currentIndex));
if (els.nowMeta) attachLongPress(els.nowMeta, '.tok-nowmeta', () => openSongModal(currentIndex));
attachLongPress(els.dirs, '.tok-dir', (card) => {
  const dir = card.getAttribute('data-dir');
  openSongModal(currentCandidates ? currentCandidates[dir].idx : currentIndex);
});

// ---------- song edit modal ----------

function openSongModal(idx){
  const t = tracks[idx];
  if (!t || !window.TokEngine) return;
  songModalTrack = t;
  const { song } = window.TokEngine.getOrCreateSongForTrack(t);
  els.songTitle.textContent = t.title;
  els.songArtist.textContent = t.artist;
  els.songBpm.value = song.bpm || '';
  els.songKey.value = song.key || '';
  els.songEnergy.value = song.energy || '';
  els.songTags.value = (song.tags || []).join(', ');
  els.songError.textContent = '';
  els.songBackdrop.classList.add('open');
}
function closeSongModal(){
  els.songBackdrop.classList.remove('open');
  songModalTrack = null;
}
els.songCancel.addEventListener('click', closeSongModal);
els.songBackdrop.addEventListener('click', (e) => {
  if (e.target === els.songBackdrop) closeSongModal();
});
els.songSave.addEventListener('click', () => {
  if (!songModalTrack) return;
  const bpm = parseInt(els.songBpm.value, 10);
  const energy = parseInt(els.songEnergy.value, 10);
  if (els.songBpm.value && (isNaN(bpm) || bpm <= 0)) {
    els.songError.textContent = 'BPM mora biti pozitivan broj.';
    return;
  }
  if (els.songEnergy.value && (isNaN(energy) || energy < 1 || energy > 5)) {
    els.songError.textContent = 'Energy mora biti broj od 1 do 5.';
    return;
  }
  const tags = els.songTags.value.split(',').map(s => s.trim()).filter(Boolean);
  window.TokEngine.upsertSongForTrack(songModalTrack, {
    bpm: els.songBpm.value ? bpm : null,
    key: els.songKey.value.trim(),
    energy: els.songEnergy.value ? energy : 3,
    tags
  });
  closeSongModal();
  renderQueue();
  if (tracks.length) renderDirs();
  if (tracks[currentIndex] === songModalTrack) {
    const nowBpm = window.TokEngine.getBPM(songModalTrack);
    els.artist.textContent = songModalTrack.artist + (nowBpm ? ' · ' + nowBpm + ' BPM' : '');
  }
});

// ---------- direction picker (fire / wave / moon) ----------

function pickCandidates(){
  return window.TokEngine.getSuggestions({ tracks, currentIndex, mode: state.order, history });
}

function updateDirCards(){
  ['up', 'flow', 'down'].forEach(dir => {
    const card = els.dirs.querySelector('[data-dir="' + dir + '"]');
    const t = currentCandidates[dir].t;
    card.querySelector('.tok-dir-cover').style.backgroundImage = "url('" + t.thumb + "')";
    card.querySelector('.tok-dir-track').textContent = t.title;
    const dirBpm = window.TokEngine ? window.TokEngine.getBPM(t) : null;
    card.querySelector('.tok-dir-artist').textContent = t.artist;
    const dirBpmEl = card.querySelector('.tok-dir-bpm');
    dirBpmEl.textContent = dirBpm ? dirBpm + ' BPM' : '';
    card.classList.toggle('chosen', dir === state.armedDir);
  });
}

function renderDirs(){
  currentCandidates = pickCandidates();
  state.armedDir = 'flow';
  updateDirCards();
}

// Long-press "Play Next" on a queue row: drops that track straight into the
// middle (flow) choice of the 3-card picker, since that's the slot armed by
// default and the one commitEndOfSong() falls back to.
function playNext(idx){
  if (!currentCandidates) return;
  currentCandidates.flow = { idx, t: tracks[idx] };
  state.armedDir = 'flow';
  // If the chosen track was already in up or down, replace that slot
  // so there are no duplicates across the three cards.
  ['up', 'down'].forEach(dir => {
    if (currentCandidates[dir].idx === idx) {
      const forbidden = new Set([
        currentIndex, idx,
        currentCandidates.up.idx,
        currentCandidates.down.idx
      ]);
      const pool = tracks.map((_, i) => i).filter(i => !forbidden.has(i));
      const newIdx = pool.length ? pool[Math.floor(Math.random() * pool.length)] : idx;
      currentCandidates[dir] = { idx: newIdx, t: tracks[newIdx] };
    }
  });
  updateDirCards();
  renderQueue();
  closeQueue();
  const flowCard = els.dirs.querySelector('[data-dir="flow"]');
  if (flowCard) {
    flowCard.classList.remove('tok-dir-replaced');
    void flowCard.offsetWidth;
    flowCard.classList.add('tok-dir-replaced');
  }
  if (navigator.vibrate) navigator.vibrate(14);
}

els.dirs.addEventListener('click', (e) => {
  const card = e.target.closest('.tok-dir');
  if (!card || card.dataset.longPressed === '1') { if (card) delete card.dataset.longPressed; return; }
  state.armedDir = card.getAttribute('data-dir');
  els.dirs.querySelectorAll('.tok-dir').forEach(c => c.classList.toggle('chosen', c === card));
});

if (els.refreshDirs) {
  els.refreshDirs.addEventListener('click', () => {
    if (!tracks.length || !window.TokEngine) return;
    if (navigator.vibrate) navigator.vibrate(10);
    // Exclude current candidates so refresh always picks different songs.
    // Preserve armedDir so the user's chosen direction isn't reset.
    const prevCandidates = currentCandidates;
    const extraHistory = prevCandidates
      ? ['up', 'flow', 'down'].map(d => prevCandidates[d].t)
      : [];
    currentCandidates = window.TokEngine.getSuggestions({
      tracks, currentIndex, mode: state.order,
      history: [...history, ...extraHistory]
    });
    // In sequential mode the engine always picks currentIndex+1 for flow,
    // ignoring history. Force a different pick if it's unchanged.
    if (prevCandidates && currentCandidates.flow.idx === prevCandidates.flow.idx) {
      const forbidden = new Set([
        currentIndex,
        currentCandidates.up.idx,
        currentCandidates.down.idx,
        prevCandidates.flow.idx
      ]);
      const pool = tracks.map((_, i) => i).filter(i => !forbidden.has(i));
      const newIdx = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : currentCandidates.flow.idx;
      currentCandidates.flow = { idx: newIdx, t: tracks[newIdx] };
    }
    updateDirCards();
    // Animate each card with a slight stagger
    ['up', 'flow', 'down'].forEach((dir, i) => {
      const card = els.dirs.querySelector('[data-dir="' + dir + '"]');
      if (!card) return;
      card.classList.remove('refreshing');
      void card.offsetWidth;
      card.style.animationDelay = (i * 120) + 'ms';
      card.classList.add('refreshing');
      card.addEventListener('animationend', () => {
        card.classList.remove('refreshing');
        card.style.animationDelay = '';
      }, { once: true });
    });
    els.refreshDirs.classList.remove('spinning');
    void els.refreshDirs.offsetWidth;
    els.refreshDirs.classList.add('spinning');
    els.refreshDirs.addEventListener('animationend', () => els.refreshDirs.classList.remove('spinning'), { once: true });
  });
}

// ---------- playback order toggle ----------

const ORDER_ICONS = {
  sequential: '<polyline points="9 6 15 12 9 18"></polyline>',
  curated: '<polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line>',
  pure: '<circle cx="6" cy="6" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="18" cy="6" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="6" cy="18" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="18" cy="18" r="1.6" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"></circle>'
};
const ORDER_CYCLE = ['sequential', 'curated', 'pure'];
const ORDER_LABELS = {
  sequential: 'po redu',
  curated: 'preporučeno nasumično',
  pure: 'potpuno nasumično'
};
function setOrder(order){
  state.order = order;
  localStorage.setItem('tok_order', order);
  els.orderIcon.innerHTML = ORDER_ICONS[order];
  if (els.orderLabel) els.orderLabel.textContent = ORDER_LABELS[order];
  if (tracks.length) { renderDirs(); renderQueue(); }
}
els.orderToggle.addEventListener('click', () => {
  const next = ORDER_CYCLE[(ORDER_CYCLE.indexOf(state.order) + 1) % ORDER_CYCLE.length];
  setOrder(next);
});
setOrder(state.order);

function commitEndOfSong(){
  const picked = currentCandidates[state.armedDir];
  history.push(tracks[currentIndex]);
  switchTrack(picked.idx, true);
}

// Swaps in a different playlist's tracks without reloading the page, so the
// song currently playing in the YouTube iframe keeps playing uninterrupted.
// If that song isn't part of the new playlist, it's kept at the front of the
// queue so playback and next/prev navigation stay consistent.
function switchPlaylist(id){
  if (id === PLAYLIST_ID) return;
  const prevId = PLAYLIST_ID;
  const playingTrack = tracks[currentIndex];
  PLAYLIST_ID = id;
  addPlaylist(id);
  localStorage.setItem('tok_playlist_id', id);
  closePlaylistModal();
  closeQueue();
  isOffline = false;
  playlistInfo = loadPlaylistInfoCache(id);
  renderPlaylistInfo();
  fetchPlaylist().then(() => {
    let idx = playingTrack ? tracks.findIndex(t => t.id === playingTrack.id) : -1;
    if (idx === -1 && playingTrack) { tracks = [playingTrack, ...tracks]; idx = 0; }
    currentIndex = idx === -1 ? 0 : idx;
    localStorage.setItem('tok_last_track_id', tracks[currentIndex].id);
    if (window.TokEngine) window.TokEngine.ensureEntriesForTracks(tracks);
    renderQueue();
    renderDirs();
    if (isOffline) els.status.textContent = 'offline način (spremljena lista)';
    fetchPlaylistInfo(YT_API_KEY, id).then(info => {
      playlistInfo = info;
      savePlaylistInfoCache(id, info);
      updatePlaylistTitle(id, info.title || '');
      renderPlaylistInfo();
    }).catch(() => {});
  }).catch(() => {
    PLAYLIST_ID = prevId;
    localStorage.setItem('tok_playlist_id', prevId);
    els.status.textContent = 'Greška kod dohvata nove playliste';
  });
}

// ---------- playlist-switch modal ----------

function renderSavedPlaylistsList(){
  const list = els.playlistSavedList;
  list.textContent = '';
  listPlaylists().forEach(p => {
    const row = document.createElement('div');
    row.className = 'tok-playlist-saved-row';

    const meta = document.createElement('div');
    meta.className = 'tok-playlist-saved-meta';
    const name = document.createElement('div');
    name.className = 'tok-playlist-saved-name';
    name.textContent = (p.id === PLAYLIST_ID ? '✓ ' : '') + (p.title || p.id);
    if (p.id !== PLAYLIST_ID) {
      name.classList.add('tok-playlist-saved-name-clickable');
      name.addEventListener('click', () => switchPlaylist(p.id));
    }
    const link = document.createElement('a');
    link.className = 'tok-playlist-saved-link';
    link.href = 'https://music.youtube.com/playlist?list=' + encodeURIComponent(p.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = link.href;
    meta.appendChild(name);
    meta.appendChild(link);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'tok-playlist-saved-remove';
    removeBtn.setAttribute('aria-label', 'Ukloni playlistu');
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      removePlaylist(p.id);
      if (p.id === PLAYLIST_ID) {
        const remaining = listPlaylists();
        switchPlaylist(remaining.length ? remaining[0].id : DEFAULT_PLAYLIST_ID);
        return;
      }
      renderSavedPlaylistsList();
    });

    row.appendChild(meta);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
}

function openPlaylistModal(){
  els.playlistInput.value = '';
  els.playlistError.textContent = '';
  els.playlistBackdrop.classList.add('open');
  els.playlistInput.focus();
  renderSavedPlaylistsList();
}
function closePlaylistModal(){
  els.playlistBackdrop.classList.remove('open');
}
function savePlaylist(){
  const input = els.playlistInput.value.trim();
  if (!input) { closePlaylistModal(); return; }
  const id = extractPlaylistId(input);
  if (!id) { els.playlistError.textContent = 'Nisam prepoznao playlist ID.'; return; }
  switchPlaylist(id);
}

// Long-press the active-playlist row in the queue sheet to switch between
// every playlist ever added (instead of having to re-paste a link).
attachLongPress(els.playlistInfo, '.tok-playlist-info', (_, pos) => {
  const saved = listPlaylists();
  if (saved.length < 2) return;
  openContextMenu(pos.x, pos.y, saved.map(p => ({
    label: (p.id === PLAYLIST_ID ? '✓ ' : '') + (p.title || p.id),
    onSelect: () => switchPlaylist(p.id)
  })));
});

els.changePlaylist.addEventListener('click', openPlaylistModal);
els.playlistCancel.addEventListener('click', closePlaylistModal);
els.playlistBackdrop.addEventListener('click', (e) => {
  if (e.target === els.playlistBackdrop) closePlaylistModal();
});
els.playlistSave.addEventListener('click', savePlaylist);
els.playlistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') savePlaylist();
});

// ---------- now-playing UI ----------

function setVinylAccent(c){
  document.querySelector('.tok-app').style.setProperty('--vinyl-color', c.bg);
  document.querySelector('.tok-app').style.setProperty('--wave-accent', c.accent);
}

function updateMediaSession(t){
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist, album: 'YouTube Music',
    artwork: [{ src: t.thumb, sizes: '480x360', type: 'image/jpeg' }]
  });
}

function updateNowPlayingUI(t){
  localStorage.setItem('tok_last_track_id', t.id);
  els.vinylImg.src = t.thumb;
  applyVinylColor(t, (track) => tracks[currentIndex] === track, setVinylAccent);
  els.title.textContent = t.title;
  const nowBpm = window.TokEngine ? window.TokEngine.getBPM(t) : null;
  els.artist.textContent = t.artist + (nowBpm ? ' · ' + nowBpm + ' BPM' : '');
  els.status.textContent = '';
  renderQueue();
  renderDirs();
  updateMediaSession(t);
}

function loadCurrentTrack(autoplay){
  const t = tracks[currentIndex];
  updateNowPlayingUI(t);
  if (player && typeof player.loadVideoById === 'function') {
    localStorage.setItem('tok_last_pos', '0');
    if (autoplay) player.loadVideoById(t.id);
    else player.cueVideoById(t.id);
  }
}

function switchTrack(idx, autoplay){
  currentIndex = idx;
  loadCurrentTrack(autoplay);
}

function tapFeedback(btn){
  if (navigator.vibrate) navigator.vibrate(12);
  btn.classList.remove('tok-tap');
  void btn.offsetWidth;
  btn.classList.add('tok-tap');
}

els.prevBtn.addEventListener('click', () => {
  tapFeedback(els.prevBtn);
  if (history.length) {
    const prevTrack = history.pop();
    switchTrack(tracks.findIndex(t => t.id === prevTrack.id), true);
  } else {
    switchTrack((currentIndex - 1 + tracks.length) % tracks.length, true);
  }
});
els.nextBtn.addEventListener('click', () => {
  tapFeedback(els.nextBtn);
  commitEndOfSong();
});
els.playBtn.addEventListener('click', () => {
  tapFeedback(els.playBtn);
  if (!player || typeof player.getPlayerState !== 'function') return;
  if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
});

// ---------- YouTube IFrame player ----------

function savePosition(){
  if (!player || typeof player.getCurrentTime !== 'function') return;
  localStorage.setItem('tok_last_pos', String(player.getCurrentTime() || 0));
}

function onPlayerStateChange(e){
  if (e.target !== player) return;
  if (e.data === YT.PlayerState.PLAYING) {
    state.playing = true;
    els.playBtn.textContent = '❙❙';
    els.vinylCover.classList.add('spinning');
    setWaveAnimation(true);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    localStorage.setItem('tok_was_playing', '1');
  } else if (e.data === YT.PlayerState.PAUSED) {
    state.playing = false;
    els.playBtn.textContent = '▶';
    els.vinylCover.classList.remove('spinning');
    setWaveAnimation(false);
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    localStorage.setItem('tok_was_playing', '0');
    savePosition();
  } else if (e.data === YT.PlayerState.ENDED) {
    localStorage.setItem('tok_last_pos', '0');
    commitEndOfSong();
  }
}

function onPlayerReady(){
  const pos = parseFloat(localStorage.getItem('tok_last_pos') || '0');
  const wasPlaying = localStorage.getItem('tok_was_playing') === '1';
  if (pos > 0) player.seekTo(pos, true);
  if (wasPlaying) player.playVideo();
  else player.pauseVideo();
}

window.onYouTubeIframeAPIReady = function(){
  player = new YT.Player('ytPlayer', {
    height: '1', width: '1',
    videoId: tracks[currentIndex].id,
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, modestbranding: 1, rel: 0, playsinline: 1 },
    events: { onReady: onPlayerReady, onStateChange: onPlayerStateChange }
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => player.playVideo());
    navigator.mediaSession.setActionHandler('pause', () => player.pauseVideo());
    navigator.mediaSession.setActionHandler('previoustrack', () => els.prevBtn.click());
    navigator.mediaSession.setActionHandler('nexttrack', () => els.nextBtn.click());
  }
};

let posSaveCounter = 0;
setInterval(() => {
  if (!player || typeof player.getCurrentTime !== 'function' || !state.playing) return;
  const cur = player.getCurrentTime();
  const dur = player.getDuration() || tracks[currentIndex].durationSec || 0;
  if (!dur) return;
  updateWaveProgress(Math.min(100, (cur / dur) * 100));
  posSaveCounter++;
  if (posSaveCounter % 8 === 0) localStorage.setItem('tok_last_pos', String(cur));
}, 250);

window.addEventListener('beforeunload', savePosition);

setInterval(() => {
  if (tracks.length) refreshPlaylist();
}, 30000);

// ---------- bootstrap ----------

(async function bootstrap(){
  try {
    await fetchPlaylist();
  } catch (err) {
    els.title.textContent = 'Greška kod dohvata playliste';
    els.artist.textContent = String((err && err.message) || err);
    return;
  }
  if (!tracks.length) {
    els.title.textContent = 'Playlist je prazna ili nije javno dostupna';
    return;
  }
  if (window.TokEngine) window.TokEngine.ensureEntriesForTracks(tracks);
  buildWave();
  setWaveAnimation(false); // start paused; onPlayerStateChange drives it from here
  const lastId = localStorage.getItem('tok_last_track_id');
  const lastIdx = lastId ? tracks.findIndex(t => t.id === lastId) : -1;
  currentIndex = lastIdx !== -1 ? lastIdx : Math.floor(Math.random() * tracks.length);
  loadCurrentTrack(false);
  // updateNowPlayingUI() (called by loadCurrentTrack) clears els.status, so
  // the offline notice has to be set after it to actually be visible.
  if (isOffline) els.status.textContent = 'offline način (spremljena lista)';

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
})();
