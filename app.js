(function(){
  if (window.TokEngine) window.TokEngine.init();

  const YT_API_KEY = 'AIzaSyCkZpbb-oVsH_s2Yjn5AAql3Pfke0MExTA';
  const DEFAULT_PLAYLIST_ID = 'PL9qqRdUh4PoNhlUS4g69SQTxteQKHVAe-';
  let PLAYLIST_ID = localStorage.getItem('tok_playlist_id') || DEFAULT_PLAYLIST_ID;

  let tracks = [];
  let currentIndex = 0;
  let player = null;

  let currentCandidates = null;
  let history = [];

  let storedOrder = localStorage.getItem('tok_order') || 'sequential';
  if (storedOrder === 'shuffle') storedOrder = 'curated';
  const state = {
    playing:false, queueOpen:false, armedDir:'flow', order: storedOrder
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
    changePlaylist: document.getElementById('tokChangePlaylist'),
    playlistBackdrop: document.getElementById('tokPlaylistBackdrop'),
    playlistInput: document.getElementById('tokPlaylistInput'),
    playlistError: document.getElementById('tokPlaylistError'),
    playlistCancel: document.getElementById('tokPlaylistCancel'),
    playlistSave: document.getElementById('tokPlaylistSave'),
    orderToggle: document.getElementById('tokOrderToggle'),
    orderIcon: document.getElementById('tokOrderIcon'),
    orderLabel: document.getElementById('tokOrderLabel'),
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
    songSave: document.getElementById('tokSongSave')
  };

  const WAVE_BARS = 40;
  function buildWave(){
    let html = '';
    for (let i = 0; i < WAVE_BARS; i++) {
      const h = 25 + Math.round(Math.sin(i * 1.3) * 20 + Math.sin(i * 0.4) * 30 + 30);
      html += '<div class="tok-wave-bar" style="height:' + Math.max(15, Math.min(100, h)) + '%"></div>';
    }
    els.wave.innerHTML = html;
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

  function ytThumb(videoId){
    return 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
  }

  function parseTitleArtist(snippetTitle, channelTitle){
    let artist = (channelTitle || '').replace(/\s*-\s*Topic$/i, '').trim();
    let title = snippetTitle;
    const m = snippetTitle.match(/^(.*?)\s*[-–]\s*(.*)$/);
    if (m && m[1] && m[2]) { artist = m[1].trim(); title = m[2].trim(); }
    return { title, artist: artist || 'Nepoznat izvođač' };
  }

  function parseISODuration(iso){
    const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
  }

  function fmtTime(s){
    s = Math.max(0, Math.round(s || 0));
    const m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  async function fetchPlaylistTracks(){
    let items = [];
    let pageToken = '';
    do {
      const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' +
        PLAYLIST_ID + '&key=' + YT_API_KEY + (pageToken ? '&pageToken=' + pageToken : '');
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error((data.error && data.error.message) || 'YouTube API greška');
      items = items.concat(data.items || []);
      pageToken = data.nextPageToken || '';
    } while (pageToken && items.length < 200);

    const seenIds = new Set();
    const result = items
      .filter(it => it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId &&
        it.snippet.title !== 'Deleted video' && it.snippet.title !== 'Private video')
      .map(it => {
        const vid = it.snippet.resourceId.videoId;
        const parsed = parseTitleArtist(it.snippet.title, it.snippet.videoOwnerChannelTitle);
        return { id: vid, title: parsed.title, artist: parsed.artist, thumb: ytThumb(vid), durationSec: 0 };
      })
      .filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        return true;
      });

    for (let i = 0; i < result.length; i += 50) {
      const batch = result.slice(i, i + 50);
      const ids = batch.map(t => t.id).join(',');
      const url = 'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=' + ids + '&key=' + YT_API_KEY;
      const res = await fetch(url);
      const data = await res.json();
      (data.items || []).forEach(v => {
        const t = result.find(x => x.id === v.id);
        if (t) t.durationSec = parseISODuration(v.contentDetails.duration);
      });
    }
    return result;
  }

  async function fetchPlaylist(){
    tracks = await fetchPlaylistTracks();
  }

  let playlistInfo = null;
  async function fetchPlaylistInfo(){
    const url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=' +
      PLAYLIST_ID + '&key=' + YT_API_KEY;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || 'YouTube API greška');
    const item = (data.items || [])[0];
    if (!item) return null;
    // snippet.thumbnails on a playlist resource is just the first video's
    // thumbnail (the API doesn't expose custom playlist artwork), so we
    // intentionally don't use it here.
    return {
      title: item.snippet.title,
      author: (item.snippet.channelTitle || '').replace(/\s*-\s*Topic$/i, '').trim(),
      count: item.contentDetails ? item.contentDetails.itemCount : null
    };
  }

  function renderPlaylistInfo(){
    if (!playlistInfo) { els.playlistInfo.style.display = 'none'; return; }
    els.playlistInfo.style.display = 'flex';
    els.playlistCover.textContent = (playlistInfo.title || '?').trim().charAt(0).toUpperCase();
    els.playlistName.textContent = playlistInfo.title || '';
    const count = playlistInfo.count != null ? playlistInfo.count : tracks.length;
    const sub = [playlistInfo.author, count + (count === 1 ? ' pjesma' : ' pjesama')].filter(Boolean).join(' · ');
    els.playlistSub.textContent = sub;
  }

  async function refreshPlaylist(){
    let fresh;
    try {
      fresh = await fetchPlaylistTracks();
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

    renderQueue();
  }

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
      fetchPlaylistInfo().then(info => { playlistInfo = info; renderPlaylistInfo(); }).catch(() => {});
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
    if (idx !== currentIndex) jumpToTrack(idx, true);
  });

  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOLERANCE = 12;

  function attachLongPress(container, rowSelector, getIdx){
    let timer = null;
    let activeRow = null;
    let start = null;

    function cancel(){
      if (timer) clearTimeout(timer);
      timer = null;
      activeRow = null;
      start = null;
    }

    container.addEventListener('contextmenu', (e) => {
      if (e.target.closest(rowSelector)) e.preventDefault();
    });
    container.addEventListener('pointerdown', (e) => {
      const row = e.target.closest(rowSelector);
      if (!row) return;
      activeRow = row;
      start = { x: e.clientX, y: e.clientY };
      timer = setTimeout(() => {
        if (!activeRow) return;
        activeRow.dataset.longPressed = '1';
        if (navigator.vibrate) navigator.vibrate(16);
        const idx = getIdx(activeRow);
        openSongModal(idx);
        timer = null;
        activeRow = null;
        start = null;
      }, LONG_PRESS_MS);
    });
    container.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) cancel();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evt => {
      container.addEventListener(evt, cancel);
    });
  }

  attachLongPress(els.queue, '.tok-queue-row', (row) => parseInt(row.getAttribute('data-idx'), 10));
  if (els.vinylWrap) attachLongPress(els.vinylWrap, '.tok-vinyl-wrap', () => currentIndex);
  if (els.nowMeta) attachLongPress(els.nowMeta, '.tok-nowmeta', () => currentIndex);
  attachLongPress(els.dirs, '.tok-dir', (card) => {
    const dir = card.getAttribute('data-dir');
    return currentCandidates ? currentCandidates[dir].idx : currentIndex;
  });

  let songModalTrack = null;
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

  function pickCandidates(){
    return window.TokEngine.getSuggestions({ tracks, currentIndex, mode: state.order, history });
  }

  function renderDirs(){
    currentCandidates = pickCandidates();
    state.armedDir = 'flow';
    ['up','flow','down'].forEach(dir => {
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

  els.dirs.addEventListener('click', (e) => {
    const card = e.target.closest('.tok-dir');
    if (!card || card.dataset.longPressed === '1') { if (card) delete card.dataset.longPressed; return; }
    state.armedDir = card.getAttribute('data-dir');
    els.dirs.querySelectorAll('.tok-dir').forEach(c => c.classList.toggle('chosen', c === card));
  });

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

  function updateMediaSession(t){
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: t.title, artist: t.artist, album: 'YouTube Music',
      artwork: [{ src: t.thumb, sizes: '480x360', type: 'image/jpeg' }]
    });
  }

  function extractPlaylistId(input){
    const m = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
    return null;
  }

  function openPlaylistModal(){
    els.playlistInput.value = PLAYLIST_ID;
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
    if (!id) { els.playlistError.textContent = 'Nisam prepoznao playlist ID.'; return; }
    localStorage.setItem('tok_playlist_id', id);
    location.reload();
  }

  els.changePlaylist.addEventListener('click', openPlaylistModal);
  els.playlistCancel.addEventListener('click', closePlaylistModal);
  els.playlistBackdrop.addEventListener('click', (e) => {
    if (e.target === els.playlistBackdrop) closePlaylistModal();
  });
  els.playlistSave.addEventListener('click', savePlaylist);
  els.playlistInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') savePlaylist();
  });

  const colorCache = {};
  const DEFAULT_VINYL_BG = 'conic-gradient(from 0deg, #FF5A3C, #FFC857, #E2401D, #F0883E, #FF5A3C)';
  const DEFAULT_WAVE_ACCENT = '#FFC857';

  function rgbToHsl(r, g, b){
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d) + (g < b ? 6 : 0);
      else if (max === g) h = ((b - r) / d) + 2;
      else h = ((r - g) / d) + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function setVinylAccent(c){
    document.querySelector('.tok-app').style.setProperty('--vinyl-color', c.bg);
    document.querySelector('.tok-app').style.setProperty('--wave-accent', c.accent);
  }

  function applyVinylColor(t){
    if (colorCache[t.id]) { setVinylAccent(colorCache[t.id]); return; }
    setVinylAccent({ bg: DEFAULT_VINYL_BG, accent: DEFAULT_WAVE_ACCENT });
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        const hsl = rgbToHsl(r / n, g / n, b / n);
        const hue = hsl.h.toFixed(0);
        const c = {
          bg: 'conic-gradient(from 0deg, hsl(' + hue + ',80%,50%), hsl(' + hue + ',85%,68%), hsl(' + hue + ',80%,50%), hsl(' + hue + ',85%,68%), hsl(' + hue + ',80%,50%))',
          accent: 'hsl(' + hue + ',85%,60%)'
        };
        colorCache[t.id] = c;
        if (tracks[currentIndex] === t) setVinylAccent(c);
      } catch (e) { /* tainted canvas (no CORS on thumbnail) — keep default */ }
    };
    img.src = t.thumb;
  }

  function updateNowPlayingUI(t){
    localStorage.setItem('tok_last_track_id', t.id);
    els.vinylImg.src = t.thumb;
    applyVinylColor(t);
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

  function jumpToTrack(idx, autoplay){
    switchTrack(idx, autoplay);
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
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      localStorage.setItem('tok_was_playing', '1');
    } else if (e.data === YT.PlayerState.PAUSED) {
      state.playing = false;
      els.playBtn.textContent = '▶';
      els.vinylCover.classList.remove('spinning');
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
      playerVars: { autoplay:0, controls:0, disablekb:1, modestbranding:1, rel:0, playsinline:1 },
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
    buildWave();
    const lastId = localStorage.getItem('tok_last_track_id');
    const lastIdx = lastId ? tracks.findIndex(t => t.id === lastId) : -1;
    currentIndex = lastIdx !== -1 ? lastIdx : Math.floor(Math.random() * tracks.length);
    els.status.textContent = 'pritisni ▶ za reprodukciju';
    loadCurrentTrack(false);

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  })();
})();
