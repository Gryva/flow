import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeFakeStorage } from './helpers/fake-storage.js';
import { saveTracksCache, loadTracksCache, savePlaylistInfoCache, loadPlaylistInfoCache } from '../js/track-cache.js';

beforeEach(() => {
  globalThis.localStorage = makeFakeStorage();
});

describe('track-cache: tracks', () => {
  test('round-trips tracks through save/load, keyed by playlist id', () => {
    const tracks = [{ id: 'a', title: 'A', artist: 'Artist A', thumb: '', durationSec: 100 }];
    saveTracksCache('PL1', tracks);
    const loaded = loadTracksCache('PL1');
    assert.deepEqual(loaded.tracks, tracks);
    assert.equal(typeof loaded.savedAt, 'number');
  });

  test('returns null when nothing is cached for that playlist id', () => {
    assert.equal(loadTracksCache('PL_NOTHING'), null);
  });

  test('different playlist ids do not collide', () => {
    saveTracksCache('PL1', [{ id: 'a', title: 'A', artist: 'X' }]);
    saveTracksCache('PL2', [{ id: 'b', title: 'B', artist: 'Y' }]);
    assert.equal(loadTracksCache('PL1').tracks[0].id, 'a');
    assert.equal(loadTracksCache('PL2').tracks[0].id, 'b');
  });

  test('treats an empty tracks array as "nothing cached"', () => {
    saveTracksCache('PL_EMPTY', []);
    assert.equal(loadTracksCache('PL_EMPTY'), null);
  });

  test('loadTracksCache returns null (not throw) on corrupt stored JSON', () => {
    globalThis.localStorage.setItem('tok_cache_tracks_PL_BAD', '{not json');
    assert.equal(loadTracksCache('PL_BAD'), null);
  });

  test('saveTracksCache does not throw when localStorage is over quota (best-effort)', () => {
    globalThis.localStorage = makeFakeStorage(10); // tiny quota
    const bigTracks = Array.from({ length: 100 }, (_, i) => ({ id: 'id' + i, title: 'Title ' + i, artist: 'Artist ' + i }));
    assert.doesNotThrow(() => saveTracksCache('PL_QUOTA', bigTracks));
  });
});

describe('track-cache: playlist info', () => {
  test('round-trips playlist info through save/load', () => {
    const info = { title: 'My Playlist', author: 'DJ', count: 42 };
    savePlaylistInfoCache('PL1', info);
    assert.deepEqual(loadPlaylistInfoCache('PL1'), info);
  });

  test('returns null when nothing is cached', () => {
    assert.equal(loadPlaylistInfoCache('PL_NOTHING'), null);
  });

  test('savePlaylistInfoCache does not throw when over quota (best-effort)', () => {
    globalThis.localStorage = makeFakeStorage(5);
    assert.doesNotThrow(() => savePlaylistInfoCache('PL_QUOTA', { title: 'x'.repeat(100) }));
  });
});
