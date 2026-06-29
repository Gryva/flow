import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine } from '../helpers/load-engine.js';
import { makeFakeStorage } from '../helpers/fake-storage.js';
import { saveTracksCache, loadTracksCache } from '../../js/track-cache.js';
import { parseTitleArtist, extractPlaylistId } from '../../js/youtube-api.js';

// Titles/artists are built from unique words rather than shared numeric
// suffixes -- "Track Title 1" vs "Track Title 10" would otherwise collide
// under the fuzzy matcher's substring/token-overlap heuristic (see the
// dedicated collision test in engine.test.js), which would make these scale
// tests measure false-match noise instead of raw throughput.
function makeTrack(i){
  return { id: 'yt' + i, title: 'Zzqx' + i.toString(36) + 'Title', artist: 'Wbrk' + (i % 500).toString(36) + 'Artist', thumb: '', durationSec: 180 };
}

// A real YouTube Music playlist can run into the thousands of items, and a
// venue laptop's curated db can grow unbounded over many gigs via
// ensureEntriesForTracks. These tests check the app's data layer doesn't
// fall over (correctness + reasonable runtime) at sizes well past normal use.

describe('stress: ensureEntriesForTracks at scale', () => {
  // findSongForTrack does a full linear scan of the db, and
  // ensureEntriesForTracks calls it once per track while the db is growing --
  // i.e. it's O(n^2). 800 tracks (a large-but-plausible playlist) already
  // takes a few seconds; 10,000 extrapolates to minutes. That quadratic
  // blowup is itself the noteworthy stress-test finding -- kept at 800 here
  // so the suite stays fast while still exercising scale.
  test('seeds 800 unmatched tracks correctly and stays reasonably fast', async () => {
    const { engine } = await loadEngine();
    const tracks = Array.from({ length: 800 }, (_, i) => makeTrack(i));
    const before = engine.getDatabase().length;

    const start = performance.now();
    const added = engine.ensureEntriesForTracks(tracks);
    const elapsedMs = performance.now() - start;

    assert.equal(added, 800);
    assert.equal(engine.getDatabase().length, before + 800);
    assert.ok(elapsedMs < 15000, `ensureEntriesForTracks took too long: ${elapsedMs}ms`);
  });

  test('re-running on an already-seeded 800-track playlist adds nothing', async () => {
    const { engine } = await loadEngine();
    const tracks = Array.from({ length: 800 }, (_, i) => makeTrack(i));
    engine.ensureEntriesForTracks(tracks);
    const secondPass = engine.ensureEntriesForTracks(tracks);
    assert.equal(secondPass, 0);
  });
});

describe('stress: getSuggestions on a huge playlist', () => {
  test('produces valid suggestions across many random current-index draws on a 5,000-track playlist', async () => {
    // Deliberately not seeded via ensureEntriesForTracks (that's covered, at
    // its own realistic scale, by the suite above) -- getSuggestions must
    // hold up on a huge playlist regardless of how much of it is matched in
    // the curated db, including the common case where most of it isn't.
    const { engine } = await loadEngine();
    const tracks = Array.from({ length: 5000 }, (_, i) => makeTrack(i));

    for (let trial = 0; trial < 200; trial++) {
      const currentIndex = Math.floor(Math.random() * tracks.length);
      const mode = ['sequential', 'curated', 'pure'][trial % 3];
      const result = engine.getSuggestions({ tracks, currentIndex, mode, history: [] });
      for (const dir of ['up', 'flow', 'down']) {
        assert.ok(result[dir].t, `${dir} should resolve to a track`);
        assert.ok(result[dir].idx >= 0 && result[dir].idx < tracks.length);
      }
    }
  });
});

describe('stress: track-cache under load', () => {
  test('caches and restores a 20,000-track playlist intact', () => {
    globalThis.localStorage = makeFakeStorage();
    const tracks = Array.from({ length: 20000 }, (_, i) => makeTrack(i));
    saveTracksCache('PL_BIG', tracks);
    const loaded = loadTracksCache('PL_BIG');
    assert.equal(loaded.tracks.length, 20000);
    assert.equal(loaded.tracks[19999].id, 'yt19999');
  });

  test('gracefully no-ops (never throws) writing many playlists into a tightly quota-capped store', () => {
    globalThis.localStorage = makeFakeStorage(50000);
    for (let p = 0; p < 50; p++) {
      const tracks = Array.from({ length: 500 }, (_, i) => makeTrack(i));
      assert.doesNotThrow(() => saveTracksCache('PL_' + p, tracks));
    }
  });
});

describe('stress: youtube-api parsing helpers on malformed/adversarial input', () => {
  test('parseTitleArtist never throws across 1,000 randomized weird title strings', () => {
    const weirdChars = ['-', '–', '—', '', ' ', '  -  ', '- - -', ' ', '\u{1F3B5}', 'A'.repeat(5000)];
    for (let i = 0; i < 1000; i++) {
      const title = weirdChars[i % weirdChars.length] + ' ' + i;
      assert.doesNotThrow(() => parseTitleArtist(title, weirdChars[(i + 1) % weirdChars.length]));
    }
  });

  test('extractPlaylistId never throws across a batch of malformed URL-like strings', () => {
    const inputs = [
      '', ' ', 'http://', 'list=', '?list=', '&list=&list=', 'PL'.padEnd(500, 'x'),
      'javascript:alert(1)?list=PLxxxxxxxxxx', 'https://x.com/?list=' + 'a'.repeat(10000)
    ];
    for (const input of inputs) {
      assert.doesNotThrow(() => extractPlaylistId(input));
    }
  });
});

describe('stress: concurrent-style rapid save/load on engine database', () => {
  test('100 rapid sequential upserts each persist correctly with no lost writes', async () => {
    const { engine } = await loadEngine();
    const songs = [];
    for (let i = 0; i < 100; i++) {
      const t = makeTrack(100000 + i);
      const song = engine.upsertSongForTrack(t, { bpm: 100 + i, key: (i % 12) + 'A', energy: (i % 5) + 1 });
      songs.push(song);
    }
    const db = engine.getDatabase();
    for (const song of songs) {
      const found = db.find(s => s.id === song.id);
      assert.ok(found, `expected ${song.id} to be persisted`);
      assert.equal(found.bpm, song.bpm);
    }
  });
});
