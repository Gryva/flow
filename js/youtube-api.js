// Pure helpers for talking to the YouTube Data API and shaping its responses
// into the plain track objects the rest of the app works with.

export function ytThumb(videoId){
  return 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';
}

export function parseTitleArtist(snippetTitle, channelTitle){
  let artist = (channelTitle || '').replace(/\s*-\s*Topic$/i, '').trim();
  let title = snippetTitle;
  const m = snippetTitle.match(/^(.*?)\s*[-–]\s*(.*)$/);
  if (m && m[1] && m[2]) { artist = m[1].trim(); title = m[2].trim(); }
  return { title, artist: artist || 'Nepoznat izvođač' };
}

export function parseISODuration(iso){
  const m = (iso || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0, 10) * 3600) + (parseInt(m[2] || 0, 10) * 60) + parseInt(m[3] || 0, 10);
}

export function fmtTime(s){
  s = Math.max(0, Math.round(s || 0));
  const m = Math.floor(s / 60), sec = s % 60;
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

export function extractPlaylistId(input){
  const m = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input;
  return null;
}

export async function fetchPlaylistTracks(apiKey, playlistId){
  let items = [];
  let pageToken = '';
  do {
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=' +
      playlistId + '&key=' + apiKey + (pageToken ? '&pageToken=' + pageToken : '');
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
    const url = 'https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=' + ids + '&key=' + apiKey;
    const res = await fetch(url);
    const data = await res.json();
    (data.items || []).forEach(v => {
      const t = result.find(x => x.id === v.id);
      if (t) t.durationSec = parseISODuration(v.contentDetails.duration);
    });
  }
  return result;
}

export async function fetchPlaylistInfo(apiKey, playlistId){
  const url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=' +
    playlistId + '&key=' + apiKey;
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
