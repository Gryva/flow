import { makeFakeStorage } from './fake-storage.js';

const ENGINE_URL = new URL('../../engine.js', import.meta.url);

// engine.js is a classic script that assigns to `window.TokEngine` and reads
// `localStorage` as ambient globals (it's loaded via a plain <script> tag in
// the browser, not as a module). To unit test it under plain Node we stub
// both globals, then re-import the file fresh each time (cache-busted via a
// query string) so each test gets its own isolated module-level dbCache and
// storage instance instead of sharing state across tests.
export async function loadEngine(quotaBytes){
  const storage = makeFakeStorage(quotaBytes);
  globalThis.localStorage = storage;
  globalThis.window = globalThis;
  await import(ENGINE_URL.href + '?t=' + Math.random());
  const engine = globalThis.window.TokEngine;
  return { engine, storage };
}
