import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from './helpers/load-engine.js';

function track(id, title, artist){
  return { id, title, artist, thumb: '', durationSec: 200 };
}

describe('engine: init & database', () => {
  test('init() seeds localStorage with the default database on first run', async () => {
    const { engine, storage } = await loadEngine();
    engine.init();
    const raw = storage.getItem('tok_database');
    assert.ok(raw, 'expected tok_database to be set');
    const db = JSON.parse(raw);
    assert.ok(Array.isArray(db) && db.length > 0);
  });

  test('init() does not overwrite an existing database', async () => {
    const { engine, storage } = await loadEngine();
    storage.setItem('tok_database', JSON.stringify([{ id: 'custom', title: 'X', artist: 'Y', bpm: 1, key: '', energy: 1, tags: [], suggestions: { speed_up: [], stay: [], slow_down: [] } }]));
    engine.init();
    const db = JSON.parse(storage.getItem('tok_database'));
    assert.equal(db.length, 1);
    assert.equal(db[0].id, 'custom');
  });

  test('getDatabase() falls back to the default database if storage is corrupt', async () => {
    const { engine, storage } = await loadEngine();
    storage.setItem('tok_database', '{not valid json');
    const db = engine.getDatabase();
    assert.ok(Array.isArray(db) && db.length > 0);
  });
});

describe('engine: track <-> song matching', () => {
  test('findSongForTrack matches on exact normalized title + artist overlap', async () => {
    const { engine } = await loadEngine();
    const db = engine.getDatabase();
    const t = track('yt1', 'The World Is a Ghetto', 'George Benson');
    const song = engine.findSongForTrack(t, db);
    assert.ok(song);
    assert.equal(song.id, 'george_benson_the_world_is_a_ghetto');
  });

  test('findSongForTrack is case/diacritic/whitespace insensitive', async () => {
    const { engine } = await loadEngine();
    const db = engine.getDatabase();
    const t = track('yt2', '  THE world IS a ghetto  ', 'george BENSON');
    const song = engine.findSongForTrack(t, db);
    assert.ok(song);
    assert.equal(song.id, 'george_benson_the_world_is_a_ghetto');
  });

  test('KNOWN ISSUE: numeric title suffixes can falsely collide under the substring + token-overlap heuristic', async () => {
    const { engine } = await loadEngine();
    const t1 = track('a', 'Track Title 1', 'Same Artist');
    const t2 = track('b', 'Track Title 10', 'Same Artist');
    const db = [{ id: 't1', title: t1.title, artist: t1.artist, bpm: 1, key: '', energy: 1, tags: [], suggestions: { speed_up: [], stay: [], slow_down: [] } }];
    // "track title 1" is a substring of "track title 10", and the artists
    // are identical, so the second, unrelated track matches the first
    // song's db entry. Documented here so a future matching-algorithm
    // change can consciously decide whether to fix this.
    const matched = engine.findSongForTrack(t2, db);
    assert.equal(matched && matched.id, 't1');
  });

  test('findSongForTrack returns null for a track with no relation to the db', async () => {
    const { engine } = await loadEngine();
    const db = engine.getDatabase();
    const t = track('yt3', 'Completely Unrelated Title Xyz', 'Some Random Artist');
    assert.equal(engine.findSongForTrack(t, db), null);
  });

  test('getBPM returns the matched song bpm, or null when unmatched', async () => {
    const { engine } = await loadEngine();
    const known = track('yt4', 'The World Is a Ghetto', 'George Benson');
    const unknown = track('yt5', 'Nope Nope Nope', 'Nobody');
    assert.equal(engine.getBPM(known), 85);
    assert.equal(engine.getBPM(unknown), null);
  });
});

describe('engine: getOrCreateSongForTrack / upsertSongForTrack', () => {
  test('getOrCreateSongForTrack creates a bare entry for an unmatched track and persists it', async () => {
    const { engine, storage } = await loadEngine();
    engine.init();
    const t = track('yt6', 'Brand New Unreleased Track', 'Fresh Artist');
    const before = engine.getDatabase().length;
    const { db, song } = engine.getOrCreateSongForTrack(t);
    assert.equal(song.title, t.title);
    assert.equal(song.bpm, null);
    assert.equal(db.length, before + 1);
    // not yet saved until caller persists
    assert.equal(JSON.parse(storage.getItem('tok_database')).length, before);
  });

  test('getOrCreateSongForTrack returns the same entry on a second call (no duplicates)', async () => {
    const { engine } = await loadEngine();
    const t = track('yt7', 'Idempotent Track', 'Idempotent Artist');
    const first = engine.getOrCreateSongForTrack(t);
    engine.saveDatabase(first.db);
    const before = engine.getDatabase().length;
    const second = engine.getOrCreateSongForTrack(t);
    assert.equal(second.db.length, before);
    assert.equal(second.song.id, first.song.id);
  });

  test('upsertSongForTrack merges fields into the matched/created song and saves', async () => {
    const { engine, storage } = await loadEngine();
    const t = track('yt8', 'Editable Track', 'Editable Artist');
    const song = engine.upsertSongForTrack(t, { bpm: 128, key: '8A', energy: 5, tags: ['house'] });
    assert.equal(song.bpm, 128);
    assert.equal(song.key, '8A');
    const persisted = JSON.parse(storage.getItem('tok_database'));
    const found = persisted.find(s => s.id === song.id);
    assert.equal(found.bpm, 128);
  });
});

describe('engine: ensureEntriesForTracks (auto-seeding)', () => {
  test('adds bare entries only for tracks without an existing match', async () => {
    const { engine } = await loadEngine();
    const known = track('yt9', 'The World Is a Ghetto', 'George Benson');
    const unknown1 = track('yt10', 'Totally New Song One', 'New Artist One');
    const unknown2 = track('yt11', 'Totally New Song Two', 'New Artist Two');
    const before = engine.getDatabase().length;
    const added = engine.ensureEntriesForTracks([known, unknown1, unknown2]);
    assert.equal(added, 2);
    assert.equal(engine.getDatabase().length, before + 2);
  });

  test('is idempotent: calling twice in a row adds nothing the second time', async () => {
    const { engine } = await loadEngine();
    const tracks = [track('yt12', 'Idempotent Seed A', 'Artist A'), track('yt13', 'Idempotent Seed B', 'Artist B')];
    const firstAdded = engine.ensureEntriesForTracks(tracks);
    const secondAdded = engine.ensureEntriesForTracks(tracks);
    assert.equal(firstAdded, 2);
    assert.equal(secondAdded, 0);
  });

  test('handles an empty/undefined track list as a no-op', async () => {
    const { engine } = await loadEngine();
    assert.equal(engine.ensureEntriesForTracks([]), 0);
    assert.equal(engine.ensureEntriesForTracks(undefined), 0);
  });
});

describe('engine: export/import JSON', () => {
  test('exportDatabaseJSON round-trips through importDatabaseJSON', async () => {
    const { engine } = await loadEngine();
    const json = engine.exportDatabaseJSON();
    const before = engine.getDatabase();
    const count = engine.importDatabaseJSON(json);
    assert.equal(count, before.length);
    assert.deepEqual(engine.getDatabase(), before);
  });

  test('importDatabaseJSON rejects invalid JSON', async () => {
    const { engine } = await loadEngine();
    assert.throws(() => engine.importDatabaseJSON('{not json'), /nije valjan JSON/);
  });

  test('importDatabaseJSON rejects a JSON value that is not a song array', async () => {
    const { engine } = await loadEngine();
    assert.throws(() => engine.importDatabaseJSON(JSON.stringify({ not: 'an array' })), /ne sadrži ispravnu bazu/);
    assert.throws(() => engine.importDatabaseJSON(JSON.stringify([{ noId: true }])), /ne sadrži ispravnu bazu/);
  });

  test('importDatabaseJSON replaces the current database entirely', async () => {
    const { engine } = await loadEngine();
    const replacement = [{ id: 'only_one', title: 'Solo', artist: 'Solo Artist', bpm: 100, key: '1A', energy: 3, tags: [], suggestions: { speed_up: [], stay: [], slow_down: [] } }];
    engine.importDatabaseJSON(JSON.stringify(replacement));
    assert.deepEqual(engine.getDatabase(), replacement);
  });
});

describe('engine: getSuggestions', () => {
  function makePlaylist(n){
    const list = [];
    for (let i = 0; i < n; i++) list.push(track('yt' + i, 'Track ' + i, 'Artist ' + i));
    return list;
  }

  test('returns up/flow/down each mapped to a distinct track when possible', async () => {
    const { engine } = await loadEngine();
    const tracks = makePlaylist(20);
    const result = engine.getSuggestions({ tracks, currentIndex: 0, mode: 'curated', history: [] });
    assert.ok(result.up && result.flow && result.down);
    const idxs = [result.up.idx, result.flow.idx, result.down.idx];
    assert.equal(new Set(idxs).size, 3, 'expected three distinct track indexes');
  });

  test('sequential mode always advances flow to currentIndex + 1 (wrapping)', async () => {
    const { engine } = await loadEngine();
    const tracks = makePlaylist(5);
    const r1 = engine.getSuggestions({ tracks, currentIndex: 3, mode: 'sequential', history: [] });
    assert.equal(r1.flow.idx, 4);
    const r2 = engine.getSuggestions({ tracks, currentIndex: 4, mode: 'sequential', history: [] });
    assert.equal(r2.flow.idx, 0);
  });

  test('does not crash and still returns valid suggestions with a single-track playlist', async () => {
    const { engine } = await loadEngine();
    const tracks = makePlaylist(1);
    const result = engine.getSuggestions({ tracks, currentIndex: 0, mode: 'pure', history: [] });
    assert.equal(result.up.idx, 0);
    assert.equal(result.flow.idx, 0);
    assert.equal(result.down.idx, 0);
  });

  test('avoids suggesting recently played tracks when alternatives exist', async () => {
    const { engine } = await loadEngine();
    const tracks = makePlaylist(10);
    const history = [tracks[1], tracks[2]];
    const result = engine.getSuggestions({ tracks, currentIndex: 0, mode: 'pure', history });
    const recent = new Set([0, 1, 2]);
    assert.ok(!recent.has(result.flow.idx) || tracks.length <= 3);
  });
});
