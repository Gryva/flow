import { fetchPlaylistTracks, fetchPlaylistInfo, fmtTime, extractPlaylistId } from './js/youtube-api.js';
import { attachLongPress } from './js/long-press.js';
import { saveTracksCache, loadTracksCache, savePlaylistInfoCache, loadPlaylistInfoCache } from './js/track-cache.js';
import { openContextMenu } from './js/context-menu.js';
import { listPlaylists, addPlaylist, updatePlaylistTitle, removePlaylist } from './js/playlist-store.js';
import { t, getLang, setLang, applyStaticTranslations, onLangChange } from './js/i18n.js';
import { filesToTracks, isLocalPlaylistId, getObjectUrl, revokeAll } from './js/local-playlist.js';

applyStaticTranslations();

if (window.TokEngine) window.TokEngine.init();

const YT_API_KEY = 'AIzaSyCkZpbb-oVsH_s2Yjn5AAql3Pfke0MExTA';
const DEFAULT_PLAYLIST_ID = 'PL9qqRdUh4PoNhlUS4g69SQTxteQKHVAe-';
const _storedId = localStorage.getItem('tok_playlist_id') || DEFAULT_PLAYLIST_ID;
// Local playlists are session-only (object URLs don't survive page reloads)
let PLAYLIST_ID = isLocalPlaylistId(_storedId) ? DEFAULT_PLAYLIST_ID : _storedId;
if (isLocalPlaylistId(_storedId)) localStorage.setItem('tok_playlist_id', DEFAULT_PLAYLIST_ID);
addPlaylist(PLAYLIST_ID);

let tracks = [];
let currentIndex = 0;
let player = null;
let localAudio = null;

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
  dirs: document.getElementById('tokDirs'),
  refreshDirs: document.getElementById('tokRefreshDirs'),
  settingsBtn: document.getElementById('tokSettingsBtn'),
  playlistBackdrop: document.getElementById('tokPlaylistBackdrop'),
  playlistInput: document.getElementById('tokPlaylistInput'),
  playlistError: document.getElementById('tokPlaylistError'),
  playlistCancel: document.getElementById('tokPlaylistCancel'),
  playlistSave: document.getElementById('tokPlaylistSave'),
  localLoadBtn: document.getElementById('tokLocalLoadBtn'),
  localFileInput: document.getElementById('tokLocalFileInput'),
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
  backdrop: document.getElementById('tokBackdrop'),
  sheet: document.getElementById('tokSheet'),
  handle: document.getElementById('tokHandle'),
  queue: document.getElementById('tokQueue'),
  queueSearch: document.getElementById('tokQueueSearch'),
  fullscreenToggle: document.getElementById('tokFullscreenToggle'),
  dbToggle: document.getElementById('tokDbToggle'),
  dbDrawer: document.getElementById('tokDbDrawer'),
  dbExport: document.getElementById('tokDbExport'),
  dbImport: document.getElementById('tokDbImport'),
  dbImportFile: document.getElementById('tokDbImportFile'),
  dbStatus: document.getElementById('tokDbStatus'),
  colorMenu: document.getElementById('tokColorMenu'),
  colorSwatches: document.getElementById('tokColorSwatches'),
  colorCustomBtn: document.getElementById('tokColorCustomBtn'),
  colorCustomPanel: document.getElementById('tokColorCustomPanel'),
  colorSL: document.getElementById('tokColorSL'),
  colorSLThumb: document.getElementById('tokColorSLThumb'),
  colorHue: document.getElementById('tokColorHue'),
  colorHexInput: document.getElementById('tokColorHexInput'),
  colorReset: document.getElementById('tokColorReset'),
};

// ---------- waveform progress bar ----------

function buildWave(){
  const N = 38;
  let html = '';
  for (let i = 0; i < N; i++){
    const dur = (1.4 + Math.random() * 1.8).toFixed(2);
    const delay = -(Math.random() * parseFloat(dur)).toFixed(2);
    const minH = 12 + Math.random() * 12;
    const maxH = minH + 20 + Math.random() * 36;
    // Each bar gets its own random duration (1.4–3.2 s) and a negative delay so
    // it starts mid-cycle — bars breathe independently from the moment they render.
    html += '<div class="tok-wave-bar" style="'
      + '--min-h:' + minH.toFixed(1) + 'px;'
      + '--max-h:' + maxH.toFixed(1) + 'px;'
      + 'animation-duration:' + dur + 's;'
      + 'animation-delay:' + delay + 's'
      + '"></div>';
  }
  const M = 12;
  for (let i = 0; i < M; i++){
    const dur = (1.4 + Math.random() * 1.8).toFixed(2);
    const delay = -(Math.random() * parseFloat(dur)).toFixed(2);
    const minH = 10 + Math.random() * 8;
    const maxH = minH + 14 + Math.random() * 22;
    html += '<div class="tok-wave-mini-bar" style="'
      + '--min-h:' + minH.toFixed(1) + 'px;'
      + '--max-h:' + maxH.toFixed(1) + 'px;'
      + 'animation-duration:' + dur + 's;'
      + 'animation-delay:' + delay + 's'
      + '"></div>';
  }
  els.wave.innerHTML = html;
}

function setWaveAnimation(playing){
  const state = playing ? 'running' : 'paused';
  els.wave.children && Array.from(els.wave.children).forEach(b => { b.style.animationPlayState = state; });
  els.queue.querySelectorAll('.tok-wave-mini-bar').forEach(b => { b.style.animationPlayState = state; });
}
function updateWaveProgress(pct){
  const bars = els.wave.children;
  const cutoff = Math.round((pct / 100) * bars.length);
  for (let i = 0; i < bars.length; i++) {
    bars[i].classList.toggle('played', i < cutoff);
  }
}

els.wave.addEventListener('click', (e) => {
  const rect = els.wave.getBoundingClientRect();
  const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  if (isLocalPlaylistId(PLAYLIST_ID)){
    const audio = getLocalAudio();
    const dur = audio.duration || tracks[currentIndex].durationSec || 0;
    if (!dur) return;
    audio.currentTime = dur * pct;
    updateWaveProgress(pct * 100);
    return;
  }
  if (!player || typeof player.seekTo !== 'function') return;
  const dur = player.getDuration() || tracks[currentIndex].durationSec || 0;
  if (!dur) return;
  player.seekTo(dur * pct, true);
  updateWaveProgress(pct * 100);
});

// ---------- playlist data ----------

let isOffline = false;

async function fetchPlaylist(){
  if (isLocalPlaylistId(PLAYLIST_ID)) return; // tracks already loaded in memory
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
  const sub = [playlistInfo.author, count + ' ' + t(count === 1 ? 'songCountOne' : 'songCountOther')].filter(Boolean).join(' · ');
  els.playlistSub.textContent = sub;
}

async function refreshPlaylist(){
  if (isLocalPlaylistId(PLAYLIST_ID)) return;
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
    empty.textContent = t('noResultsFor', { query });
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
      '<div class="tok-cover--queue"' + (t.thumb ? ' style="background-image:url(\'' + t.thumb + '\')"' : '') + '></div>' +
      '<div class="tok-queue-meta"><div class="tok-queue-title">' + t.title + '</div>' +
      '<div class="tok-queue-artist">' + t.artist + '</div></div>' +
      (isCurrent ? '<div class="tok-wave-mini"><div class="tok-wave-mini-bars"></div></div>' : '') +
      (bpm ? '<div class="tok-queue-bpm">' + bpm + ' BPM</div>' : '') +
      (isCandidate ? '<div class="tok-queue-candicon">' + CANDIDATE_ICON[dir] + '</div>' : '') +
      '<div class="tok-queue-dur">' + fmtTime(t.durationSec) + '</div>' +
      '</button>';
  }).join('');

  setWaveAnimation(state.playing);
}

if (els.queueSearch) {
  els.queueSearch.addEventListener('input', renderQueue);
}

// ---------- vinyl + colour ----------

const DEFAULT_COLOR = '#E2401D';
let currentColor = localStorage.getItem('tok_color') || DEFAULT_COLOR;

function applyColor(hex){
  document.documentElement.style.setProperty('--dusk', hex);
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.documentElement.style.setProperty('--dusk-rgb', r + ',' + g + ',' + b);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  const ink = lum > 0.55 ? '#1a0a00' : '#fff8f0';
  document.documentElement.style.setProperty('--ink', ink);
}
applyColor(currentColor);

els.vinyl && window.tokBuildVinyl && window.tokBuildVinyl(els.vinyl);

// ---------- theme colour picker ----------

let themePickerHue = 9, themePickerS = 0.85, themePickerL = 0.5;

function hslToHex(h, s, l){
  h = ((h % 360) + 360) % 360;
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h/30) % 12; const c = l - a*Math.max(Math.min(k-3, 9-k, 1),-1); return Math.round(255*c).toString(16).padStart(2,'0'); };
  return '#' + f(0) + f(8) + f(4);
}
function hexToHsl(hex){
  let r=parseInt(hex.slice(1,3),16)/255, g=parseInt(hex.slice(3,5),16)/255, b=parseInt(hex.slice(5,7),16)/255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
  if(max===min) return {h:0,s:0,l};
  const d=max-min, s=l>0.5?d/(2-max-min):d/(max+min);
  let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:h*60, s, l};
}

function updateSLCanvas(){
  if (!els.colorSL) return;
  els.colorSL.style.background = 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(' + themePickerHue + ',100%,50%))';
  const sl = els.colorSL.getBoundingClientRect();
  if (els.colorSLThumb && sl.width && sl.height){
    els.colorSLThumb.style.left = (themePickerS * sl.width) + 'px';
    els.colorSLThumb.style.top  = ((1 - themePickerL / (1 - themePickerS/2)) * sl.height) + 'px';
  }
}
function slFromEvent(e, rect){
  const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
  themePickerS = x;
  themePickerL = (1 - y) * (1 - x/2);
}
function commitColor(){
  const hex = hslToHex(themePickerHue, themePickerS, themePickerL);
  currentColor = hex;
  localStorage.setItem('tok_color', hex);
  applyColor(hex);
  if (els.colorHexInput) els.colorHexInput.value = hex.toUpperCase();
}

function openThemeColorMenu(){
  els.colorMenu && els.colorMenu.classList.add('open');
  updateSLCanvas();
  if (els.colorHexInput) els.colorHexInput.value = currentColor.toUpperCase();
  if (els.colorHue) {
    const hsl = hexToHsl(currentColor);
    themePickerHue = hsl.h; themePickerS = hsl.s; themePickerL = hsl.l;
    els.colorHue.value = Math.round(hsl.h);
    updateSLCanvas();
  }
}
function closeThemeColorMenu(){
  els.colorMenu && els.colorMenu.classList.remove('open');
}

if (els.colorSL) {
  let dragging = false;
  els.colorSL.addEventListener('pointerdown', e => { dragging = true; els.colorSL.setPointerCapture(e.pointerId); slFromEvent(e, els.colorSL.getBoundingClientRect()); updateSLCanvas(); commitColor(); });
  els.colorSL.addEventListener('pointermove', e => { if (!dragging) return; slFromEvent(e, els.colorSL.getBoundingClientRect()); updateSLCanvas(); commitColor(); });
  els.colorSL.addEventListener('pointerup', () => dragging = false);
}
if (els.colorHue) {
  els.colorHue.addEventListener('input', () => { themePickerHue = +els.colorHue.value; updateSLCanvas(); commitColor(); });
}
if (els.colorHexInput) {
  els.colorHexInput.addEventListener('change', () => {
    const v = els.colorHexInput.value.trim();
    const hex = v.startsWith('#') ? v : '#' + v;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) { els.colorHexInput.value = currentColor.toUpperCase(); return; }
    const hsl = hexToHsl(hex);
    themePickerHue = hsl.h; themePickerS = hsl.s; themePickerL = hsl.l;
    if (els.colorHue) els.colorHue.value = Math.round(hsl.h);
    updateSLCanvas();
    commitColor();
  });
}
if (els.colorSwatches) {
  els.colorSwatches.querySelectorAll('.tok-color-swatch:not(.tok-color-custom)').forEach(btn => {
    btn.addEventListener('click', () => {
      const hex = btn.dataset.color;
      const hsl = hexToHsl(hex);
      themePickerHue = hsl.h; themePickerS = hsl.s; themePickerL = hsl.l;
      if (els.colorHue) { els.colorHue.value = Math.round(hsl.h); }
      updateSLCanvas();
      currentColor = hex;
      localStorage.setItem('tok_color', hex);
      applyColor(hex);
      if (els.colorHexInput) els.colorHexInput.value = hex.toUpperCase();
      closeThemeColorMenu();
    });
  });
}
if (els.colorCustomBtn) {
  els.colorCustomBtn.addEventListener('click', () => {
    els.colorCustomPanel && els.colorCustomPanel.classList.toggle('open');
    updateSLCanvas();
  });
}
if (els.colorReset) {
  els.colorReset.addEventListener('click', () => {
    const hsl = hexToHsl(DEFAULT_COLOR);
    themePickerHue = hsl.h; themePickerS = hsl.s; themePickerL = hsl.l;
    if (els.colorHue) els.colorHue.value = Math.round(hsl.h);
    updateSLCanvas();
    currentColor = DEFAULT_COLOR;
    localStorage.setItem('tok_color', DEFAULT_COLOR);
    applyColor(DEFAULT_COLOR);
    if (els.colorHexInput) els.colorHexInput.value = DEFAULT_COLOR.toUpperCase();
    closeThemeColorMenu();
  });
}

document.addEventListener('click', (e) => {
  if (els.colorMenu && !els.colorMenu.contains(e.target) && e.target !== els.colorMenu) {
    closeThemeColorMenu();
  }
});

// ---------- direction cards ----------

function renderDirs(){
  if (!currentCandidates) return;
  ['up', 'flow', 'down'].forEach(dir => {
    const card = els.dirs.querySelector('[data-dir="' + dir + '"]');
    if (!card) return;
    const cand = currentCandidates[dir];
    const t = tracks[cand.idx];
    if (!t) return;
    const meta = card.querySelector('.tok-dir-meta');
    if (!meta) return;
    meta.querySelector('.tok-dir-track').textContent = t.title;
    meta.querySelector('.tok-dir-artist').textContent = t.artist;
    const bpm = window.TokEngine ? window.TokEngine.getBPM(t) : null;
    meta.querySelector('.tok-dir-bpm').textContent = bpm ? bpm + ' BPM' : '';
    const cover = card.querySelector('.tok-dir-cover');
    if (cover) cover.style.backgroundImage = t.thumb ? 'url(\'' + t.thumb + '\')' : '';
    const isChosen = dir === state.armedDir;
    card.classList.toggle('chosen', isChosen);
  });
}

els.dirs.addEventListener('click', (e) => {
  const card = e.target.closest('.tok-dir');
  if (!card) return;
  const dir = card.dataset.dir;
  if (!dir) return;
  state.armedDir = dir;
  if (navigator.vibrate) navigator.vibrate(10);
  renderDirs();
  if (window.tokPulseDirArrows) window.tokPulseDirArrows(dir);
});

function pickCandidates(){
  if (!tracks.length) return;
  const now = tracks[currentIndex];
  if (window.TokEngine) {
    currentCandidates = window.TokEngine.pick(now, tracks, currentIndex, state.order);
  } else {
    const pick = idx => ({ idx });
    const rand = () => Math.floor(Math.random() * tracks.length);
    currentCandidates = { up: pick(rand()), flow: pick(rand()), down: pick(rand()) };
  }
}

els.refreshDirs.addEventListener('click', () => {
  els.dirs.querySelectorAll('.tok-dir-replaced').forEach(c => c.classList.remove('tok-dir-replaced'));
  if (navigator.vibrate) navigator.vibrate(10);
  pickCandidates();
  renderDirs();
});

function playNext(candidateIdx){
  if (!currentCandidates) return;
  const dir = state.armedDir;
  const cand = currentCandidates[dir];
  const targetIdx = candidateIdx !== undefined ? candidateIdx : cand.idx;
  const card = els.dirs.querySelector('[data-dir="' + dir + '"]');
  if (card) {
    card.classList.remove('tok-dir-replaced');
    void card.offsetWidth;
    card.classList.add('tok-dir-replaced');
  }
  history.push(tracks[currentIndex]);
  switchTrack(targetIdx, true);
  pickCandidates();
  renderDirs();
}

function commitEndOfSong(){
  history.push(tracks[currentIndex]);
  const dir = state.armedDir;
  const cand = currentCandidates ? currentCandidates[dir] : null;
  const nextIdx = cand ? cand.idx : (currentIndex + 1) % tracks.length;
  switchTrack(nextIdx, true);
  pickCandidates();
  renderDirs();
}

// ---------- playback order toggle ----------

const ORDER_MODES = ['sequential', 'curated', 'pure'];
const ORDER_ICONS = {
  sequential: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  curated: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
  pure: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>'
};

function updateOrderUI(){
  if (els.orderIcon) els.orderIcon.innerHTML = ORDER_ICONS[state.order] || '';
  if (els.orderLabel) els.orderLabel.textContent = t('order.' + state.order);
}
updateOrderUI();
onLangChange(() => updateOrderUI());

if (els.orderToggle) {
  els.orderToggle.addEventListener('click', () => {
    const idx = ORDER_MODES.indexOf(state.order);
    state.order = ORDER_MODES[(idx + 1) % ORDER_MODES.length];
    localStorage.setItem('tok_order', state.order);
    updateOrderUI();
    if (tracks.length) { pickCandidates(); renderDirs(); }
  });
}

// ---------- database drawer ----------

function openDbDrawer(){ els.dbDrawer && els.dbDrawer.classList.add('open'); }
function closeDbDrawer(){ els.dbDrawer && els.dbDrawer.classList.remove('open'); }

els.dbToggle && els.dbToggle.addEventListener('click', () => {
  if (els.dbDrawer && els.dbDrawer.classList.contains('open')) closeDbDrawer();
  else openDbDrawer();
});

els.dbExport && els.dbExport.addEventListener('click', () => {
  if (!window.TokEngine) return;
  const json = window.TokEngine.exportDB();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'flow-db.json'; a.click();
  URL.revokeObjectURL(url);
  if (els.dbStatus) { els.dbStatus.textContent = t('dbSaved'); setTimeout(() => { if (els.dbStatus) els.dbStatus.textContent = ''; }, 3000); }
});

els.dbImport && els.dbImport.addEventListener('click', () => els.dbImportFile && els.dbImportFile.click());
els.dbImportFile && els.dbImportFile.addEventListener('change', () => {
  const file = els.dbImportFile.files[0];
  if (!file || !window.TokEngine) return;
  const reader = new FileReader();
  reader.onload = e => {
    const count = window.TokEngine.importDB(e.target.result);
    if (count === null) {
      if (els.dbStatus) els.dbStatus.textContent = t('dbReadError');
    } else {
      if (els.dbStatus) els.dbStatus.textContent = t('dbLoadedCount', { count });
      renderQueue(); renderDirs();
    }
    setTimeout(() => { if (els.dbStatus) els.dbStatus.textContent = ''; }, 3000);
  };
  reader.readAsText(file);
  els.dbImportFile.value = '';
});

// ---------- song-detail modal ----------

function openSongModal(track){
  songModalTrack = track;
  if (els.songTitle) els.songTitle.textContent = track.title || t('songTitleDefault');
  if (els.songArtist) els.songArtist.textContent = track.artist || '';
  const entry = window.TokEngine ? window.TokEngine.getEntry(track) : {};
  if (els.songBpm) els.songBpm.value = entry.bpm || '';
  if (els.songKey) els.songKey.value = entry.key || '';
  if (els.songEnergy) els.songEnergy.value = entry.energy || '';
  if (els.songTags) els.songTags.value = (entry.tags || []).join(', ');
  if (els.songError) els.songError.textContent = '';
  if (els.songBackdrop) els.songBackdrop.classList.add('open');
}
function closeSongModal(){
  if (els.songBackdrop) els.songBackdrop.classList.remove('open');
  songModalTrack = null;
}
els.songCancel && els.songCancel.addEventListener('click', closeSongModal);
els.songBackdrop && els.songBackdrop.addEventListener('click', e => { if (e.target === els.songBackdrop) closeSongModal(); });
els.songSave && els.songSave.addEventListener('click', () => {
  if (!songModalTrack || !window.TokEngine) { closeSongModal(); return; }
  const bpmRaw = els.songBpm ? els.songBpm.value.trim() : '';
  const energyRaw = els.songEnergy ? els.songEnergy.value.trim() : '';
  const bpm = bpmRaw ? parseFloat(bpmRaw) : null;
  const energy = energyRaw ? parseFloat(energyRaw) : null;
  if (bpm !== null && (isNaN(bpm) || bpm <= 0)) { if (els.songError) els.songError.textContent = t('bpmInvalid'); return; }
  if (energy !== null && (isNaN(energy) || energy < 1 || energy > 5)) { if (els.songError) els.songError.textContent = t('energyInvalid'); return; }
  const tagsRaw = els.songTags ? els.songTags.value : '';
  const tags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
  window.TokEngine.setEntry(songModalTrack, { bpm, key: els.songKey ? els.songKey.value.trim() : '', energy, tags });
  closeSongModal();
  renderQueue(); renderDirs();
});

// ---------- queue sheet interaction ----------

function openQueue(){
  els.backdrop.classList.add('open');
  els.sheet.classList.add('open');
  const row = els.queue.querySelector('.tok-queue-row.current');
  if (row) setTimeout(() => row.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  state.queueOpen = true;
}
function closeQueue(){
  els.backdrop.classList.remove('open');
  els.sheet.classList.remove('open');
  state.queueOpen = false;
  if (els.queueSearch && els.queueSearch.value) {
    els.queueSearch.value = '';
    renderQueue();
  }
}

els.backdrop.addEventListener('click', closeQueue);
els.handle.addEventListener('click', closeQueue);
els.queueToggle.addEventListener('click', () => state.queueOpen ? closeQueue() : openQueue());

els.queue.addEventListener('click', (e) => {
  const row = e.target.closest('.tok-queue-row');
  if (!row) return;
  const idx = parseInt(row.dataset.idx, 10);
  switchTrack(idx, true);
  closeQueue();
});

attachLongPress(els.queue, '.tok-queue-row', (row, pos) => {
  const idx = parseInt(row.dataset.idx, 10);
  const track = tracks[idx];
  openContextMenu(pos.x, pos.y, [
    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>', label: t('playNext'), onSelect: () => playNext(idx) },
    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>', label: t('songDetails'), onSelect: () => openSongModal(track) }
  ]);
});

// ---------- sheet drag ----------

let sheetDragStartY = null, sheetDragStartTop = null;
function sheetDragStart(y){
  sheetDragStartY = y;
  sheetDragStartTop = els.sheet.getBoundingClientRect().top;
}
function sheetDragMove(y){
  if (sheetDragStartY === null) return;
  const delta = y - sheetDragStartY;
  if (delta < 0) return;
  els.sheet.style.transform = 'translateY(' + delta + 'px)';
}
function sheetDragEnd(y){
  if (sheetDragStartY === null) return;
  const delta = y - sheetDragStartY;
  els.sheet.style.transform = '';
  sheetDragStartY = null;
  if (delta > 80) closeQueue();
}
els.handle.addEventListener('pointerdown', e => sheetDragStart(e.clientY));
document.addEventListener('pointermove', e => { if (sheetDragStartY !== null) sheetDragMove(e.clientY); });
document.addEventListener('pointerup', e => { if (sheetDragStartY !== null) sheetDragEnd(e.clientY); });

// ---------- playlist-switch modal ----------

function openPlaylistModal(){
  renderSavedPlaylistsList();
  els.playlistInput.value = '';
  els.playlistError.textContent = '';
  els.playlistBackdrop.classList.add('open');
  els.playlistInput.focus();
}

function closePlaylistModal(){
  els.playlistBackdrop.classList.remove('open');
}
function savePlaylist(){
  const input = els.playlistInput.value.trim();
  if (!input) { closePlaylistModal(); return; }
  const id = extractPlaylistId(input);
  if (!id) { els.playlistError.textContent = t('playlistIdInvalid'); return; }
  switchPlaylist(id);
}

// Long-press the active-playlist row in the queue sheet to switch between
// every playlist ever added (instead of having to re-paste a link).
attachLongPress(els.playlistInfo, '.tok-playlist-info', (_, pos) => {
  const saved = listPlaylists();
  if (saved.length < 2) return;
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  openContextMenu(pos.x, pos.y, saved.map(p => ({
    icon: p.id === PLAYLIST_ID ? checkIcon : null,
    label: p.title || p.id,
    onSelect: () => switchPlaylist(p.id)
  })));
});

els.settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  closeThemeColorMenu();
  const rect = els.settingsBtn.getBoundingClientRect();
  const pos = { x: rect.left + rect.width / 2, y: rect.bottom };
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  openContextMenu(pos.x, pos.y, [
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      label: t('changePlaylist'), onSelect: openPlaylistModal
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="0.5" fill="currentColor"/><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor"/><circle cx="8.5" cy="7.5" r="0.5" fill="currentColor"/><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor"/><path d="M12 22a10 10 0 1 1 9-14.5c.4 1-.2 2-1.3 2H17a2 2 0 0 0-2 2c0 1 .5 1.5.5 2.5A2 2 0 0 1 13.5 16a2 2 0 0 0-1.5 2c0 1.5 1 2.5 1 4 0-.3-1 0-1 0z"/></svg>',
      label: t('themeColor'), onSelect: openThemeColorMenu
    },
    {
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
      label: t('language'),
      onSelect: () => openContextMenu(pos.x, pos.y, [
        { icon: getLang() === 'en' ? checkIcon : null, label: t('langEnglish'), onSelect: () => setLang('en') },
        { icon: getLang() === 'hr' ? checkIcon : null, label: t('langCroatian'), onSelect: () => setLang('hr') }
      ])
    }
  ]);
});
els.playlistCancel.addEventListener('click', closePlaylistModal);
els.playlistBackdrop.addEventListener('click', (e) => {
  if (e.target === els.playlistBackdrop) closePlaylistModal();
});
els.playlistSave.addEventListener('click', savePlaylist);
els.playlistInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') savePlaylist();
});

if (els.localLoadBtn && els.localFileInput) {
  els.localLoadBtn.addEventListener('click', () => els.localFileInput.click());
  els.localFileInput.addEventListener('change', async () => {
    const files = Array.from(els.localFileInput.files || []);
    els.localFileInput.value = '';
    if (!files.length) return;
    revokeAll(); // free previous session's object URLs before creating new ones
    const loadedTracks = await filesToTracks(files);
    if (!loadedTracks.length) return;
    const playlistId = 'local:' + Date.now();
    PLAYLIST_ID = playlistId;
    localStorage.setItem('tok_playlist_id', playlistId);
    tracks = loadedTracks;
    currentIndex = 0;
    history.length = 0;
    playlistInfo = { title: 'Local files', author: '', count: tracks.length };
    closePlaylistModal();
    closeQueue();
    renderPlaylistInfo();
    renderQueue();
    renderDirs();
    loadCurrentTrack(false);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => getLocalAudio().play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => getLocalAudio().pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => els.prevBtn.click());
      navigator.mediaSession.setActionHandler('nexttrack', () => els.nextBtn.click());
    }
  });
}

// ---------- now-playing UI ----------

function updateMediaSession(t){
  if (!('mediaSession' in navigator)) return;
  const artwork = t.thumb ? [{ src: t.thumb, sizes: '480x360', type: 'image/jpeg' }] : [];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title, artist: t.artist, album: t.isLocal ? 'Local files' : 'YouTube Music',
    artwork
  });
}

function updateNowPlayingUI(t){
  if (!t.isLocal) localStorage.setItem('tok_last_track_id', t.id);
  els.vinylImg.src = t.thumb || '';
  els.title.removeAttribute('data-i18n');
  els.title.textContent = t.title;
  const nowBpm = window.TokEngine ? window.TokEngine.getBPM(t) : null;
  els.artist.textContent = (t.artist || '') + (nowBpm ? ' · ' + nowBpm + ' BPM' : '');
  els.status.textContent = '';
  renderQueue();
  renderDirs();
  updateMediaSession(t);
}

function getLocalAudio(){
  if (!localAudio){
    localAudio = document.getElementById('tokLocalPlayer');
    localAudio.addEventListener('ended', () => commitEndOfSong());
    localAudio.addEventListener('play', () => {
      state.playing = true;
      els.playBtn.textContent = '❙❙';
      els.vinylCover.classList.add('spinning');
      setWaveAnimation(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    });
    localAudio.addEventListener('pause', () => {
      if (localAudio.ended) return;
      state.playing = false;
      els.playBtn.textContent = '▶';
      els.vinylCover.classList.remove('spinning');
      setWaveAnimation(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
  }
  return localAudio;
}

function loadCurrentTrack(autoplay){
  const t = tracks[currentIndex];
  updateNowPlayingUI(t);
  if (t.isLocal){
    const audio = getLocalAudio();
    const url = getObjectUrl(t.id);
    if (url) audio.src = url;
    if (autoplay && url) audio.play().catch(() => {});
    if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
  } else if (player && typeof player.loadVideoById === 'function') {
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
  if (isLocalPlaylistId(PLAYLIST_ID)){
    const audio = getLocalAudio();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
    return;
  }
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
    videoId: tracks[currentIndex] && !tracks[currentIndex].isLocal ? tracks[currentIndex].id : '',
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
  if (!state.playing) return;
  if (isLocalPlaylistId(PLAYLIST_ID)){
    const audio = localAudio;
    if (!audio) return;
    const cur = audio.currentTime;
    const dur = audio.duration || tracks[currentIndex]?.durationSec || 0;
    if (dur) updateWaveProgress(Math.min(100, (cur / dur) * 100));
    return;
  }
  if (!player || typeof player.getCurrentTime !== 'function') return;
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
    els.title.removeAttribute('data-i18n');
    els.title.textContent = t('fetchPlaylistError');
    els.artist.textContent = String((err && err.message) || err);
    return;
  }
  if (!tracks.length) {
    els.title.removeAttribute('data-i18n');
    els.title.textContent = t('playlistEmpty');
    return;
  }
  if (window.TokEngine) window.TokEngine.ensureEntriesForTracks(tracks);
  buildWave();
  setWaveAnimation(false); // start paused; onPlayerStateChange drives it from here
  const lastId = localStorage.getItem('tok_last_track_id');
  const lastIdx = lastId ? tracks.findIndex(t => t.id === lastId) : -1;
  currentIndex = lastIdx !== -1 ? lastIdx : Math.floor(Math.random() * tracks.length);
  pickCandidates();
  updateNowPlayingUI(tracks[currentIndex]);
  renderPlaylistInfo();

  const id = PLAYLIST_ID;
  playlistInfo = loadPlaylistInfoCache(id);
  if (playlistInfo) renderPlaylistInfo();
  fetchPlaylistInfo(YT_API_KEY, id).then(info => {
    if (PLAYLIST_ID !== id) return;
    playlistInfo = info;
    savePlaylistInfoCache(id, info);
    updatePlaylistTitle(id, info.title || '');
    renderPlaylistInfo();
  }).catch(() => {});

  if (isOffline) els.status.textContent = t('offlineMode');
})();

// ---------- Swaps in a different playlist ----------

function renderSavedPlaylistsList(){
  const list = els.playlistSavedList;
  list.textContent = '';
  listPlaylists().filter(p => !isLocalPlaylistId(p.id)).forEach(p => {
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
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = '↗';
    meta.appendChild(name);
    meta.appendChild(link);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'tok-playlist-saved-remove';
    removeBtn.setAttribute('aria-label', 'Ukloni playlistu');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      const remaining = listPlaylists().filter(x => x.id !== p.id && !isLocalPlaylistId(x.id));
      removePlaylist(p.id);
      if (p.id === PLAYLIST_ID) {
        switchPlaylist(remaining.length ? remaining[0].id : DEFAULT_PLAYLIST_ID);
      } else {
        renderSavedPlaylistsList();
      }
    });

    row.appendChild(meta);
    row.appendChild(removeBtn);
    list.appendChild(row);
  });
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
    if (isOffline) els.status.textContent = t('offlineMode');
    fetchPlaylistInfo(YT_API_KEY, id).then(info => {
      playlistInfo = info;
      savePlaylistInfoCache(id, info);
      updatePlaylistTitle(id, info.title || '');
      renderPlaylistInfo();
    }).catch(() => {});
  }).catch(() => {
    PLAYLIST_ID = prevId;
    localStorage.setItem('tok_playlist_id', prevId);
    els.status.textContent = t('fetchPlaylistError');
  });
}

// ---------- fullscreen ----------

let fsRestoreBanner = null;

function dismissFsRestoreBanner(){
  if (!fsRestoreBanner) return;
  fsRestoreBanner.remove();
  fsRestoreBanner = null;
}

function showFsRestoreBanner(){
  if (fsRestoreBanner) return;
  fsRestoreBanner = document.createElement('button');
  fsRestoreBanner.className = 'tok-fs-restore';
  fsRestoreBanner.textContent = '⛶ Tap to restore fullscreen';
  fsRestoreBanner.addEventListener('click', () => {
    dismissFsRestoreBanner();
    (document.documentElement.requestFullscreen ? document.documentElement : document.body)
      .requestFullscreen().catch(() => {});
  });
  document.body.appendChild(fsRestoreBanner);
  setTimeout(dismissFsRestoreBanner, 8000);
}

function updateFullscreenBtn(){
  if (!els.fullscreenToggle) return;
  els.fullscreenToggle.classList.toggle('active', !!document.fullscreenElement);
}

if (els.fullscreenToggle) {
  els.fullscreenToggle.addEventListener('click', () => {
    if (navigator.vibrate) navigator.vibrate(10);
    if (!document.fullscreenElement) {
      (document.documentElement.requestFullscreen ? document.documentElement : document.body)
        .requestFullscreen().catch(() => {});
    } else {
      localStorage.removeItem('tok_fullscreen');
      document.exitFullscreen().catch(() => {});
    }
  });
  document.addEventListener('fullscreenchange', () => {
    updateFullscreenBtn();
    if (document.fullscreenElement) {
      localStorage.setItem('tok_fullscreen', '1');
      dismissFsRestoreBanner();
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && localStorage.getItem('tok_fullscreen') === '1' && !document.fullscreenElement) {
    showFsRestoreBanner();
  }
});
