import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ytThumb, parseTitleArtist, parseISODuration, fmtTime, extractPlaylistId } from '../js/youtube-api.js';

describe('ytThumb', () => {
  test('builds the standard hqdefault thumbnail URL for a video id', () => {
    assert.equal(ytThumb('abc123'), 'https://i.ytimg.com/vi/abc123/hqdefault.jpg');
  });
});

describe('parseTitleArtist', () => {
  test('splits "Artist - Title" into separate fields', () => {
    const { title, artist } = parseTitleArtist('Daft Punk - Voyager', 'Daft Punk - Topic');
    assert.equal(artist, 'Daft Punk');
    assert.equal(title, 'Voyager');
  });

  test('strips a trailing " - Topic" suffix from the channel title fallback', () => {
    const { artist } = parseTitleArtist('Some Title With No Dash', 'Some Artist - Topic');
    assert.equal(artist, 'Some Artist');
  });

  test('falls back to "Nepoznat izvođač" when no artist can be determined', () => {
    const { artist, title } = parseTitleArtist('Just A Title', '');
    assert.equal(artist, 'Nepoznat izvođač');
    assert.equal(title, 'Just A Title');
  });

  test('handles an en-dash separator', () => {
    const { title, artist } = parseTitleArtist('Artist Name – Song Title', '');
    assert.equal(artist, 'Artist Name');
    assert.equal(title, 'Song Title');
  });

  test('does not split when the dash has no surrounding content on one side', () => {
    const { title, artist } = parseTitleArtist('- Title Only', 'Channel');
    // m[1] would be empty, so the regex branch should not apply
    assert.equal(artist, 'Channel');
    assert.equal(title, '- Title Only');
  });
});

describe('parseISODuration', () => {
  test('parses hours, minutes, seconds', () => {
    assert.equal(parseISODuration('PT1H2M3S'), 3723);
  });
  test('parses minutes-only', () => {
    assert.equal(parseISODuration('PT3M30S'), 210);
  });
  test('parses seconds-only', () => {
    assert.equal(parseISODuration('PT45S'), 45);
  });
  test('returns 0 for missing/invalid input', () => {
    assert.equal(parseISODuration(''), 0);
    assert.equal(parseISODuration(null), 0);
    assert.equal(parseISODuration('garbage'), 0);
  });
});

describe('fmtTime', () => {
  test('formats seconds as m:ss with zero padding', () => {
    assert.equal(fmtTime(5), '0:05');
    assert.equal(fmtTime(65), '1:05');
    assert.equal(fmtTime(600), '10:00');
  });
  test('clamps negative/undefined input to 0:00', () => {
    assert.equal(fmtTime(-5), '0:00');
    assert.equal(fmtTime(undefined), '0:00');
  });
  test('rounds fractional seconds', () => {
    assert.equal(fmtTime(59.9), '1:00');
  });
});

describe('extractPlaylistId', () => {
  test('extracts the list= param from a full YouTube Music URL', () => {
    assert.equal(
      extractPlaylistId('https://music.youtube.com/playlist?list=PL1234567890abcdef'),
      'PL1234567890abcdef'
    );
  });
  test('extracts list= when other query params are present', () => {
    assert.equal(
      extractPlaylistId('https://www.youtube.com/watch?v=xyz&list=PLabc123def456'),
      'PLabc123def456'
    );
  });
  test('accepts a bare playlist id (no URL)', () => {
    assert.equal(extractPlaylistId('PL1234567890abcdef'), 'PL1234567890abcdef');
  });
  test('returns null for input that is neither a URL with list= nor a bare id', () => {
    assert.equal(extractPlaylistId('not a playlist'), null);
    assert.equal(extractPlaylistId('short'), null);
  });
});
