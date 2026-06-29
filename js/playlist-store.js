// Keeps the list of playlists the DJ has ever added (id + last-known title),
// independent from `tok_playlist_id` which only tracks the *active* one.
// Lets the queue sheet's long-press dropdown offer quick switching without
// re-pasting a link.

const KEY = 'tok_playlists';

export function listPlaylists(){
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function savePlaylists(list){
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* best-effort */ }
}

export function addPlaylist(id, title){
  const list = listPlaylists();
  const existing = list.find(p => p.id === id);
  if (existing) {
    if (title) existing.title = title;
  } else {
    list.push({ id, title: title || null, addedAt: Date.now() });
  }
  savePlaylists(list);
  return list;
}

export function updatePlaylistTitle(id, title){
  const list = listPlaylists();
  const existing = list.find(p => p.id === id);
  if (!existing || existing.title === title) return;
  existing.title = title;
  savePlaylists(list);
}

export function removePlaylist(id){
  savePlaylists(listPlaylists().filter(p => p.id !== id));
}
