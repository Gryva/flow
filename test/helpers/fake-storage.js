// Minimal in-memory localStorage stand-in for tests running under plain
// Node (no DOM). Supports a quota cap so tests can simulate a full disk
// (e.g. a venue laptop with no space left) without touching real storage.
export function makeFakeStorage(quotaBytes = Infinity){
  const store = new Map();
  let used = 0;
  return {
    getItem(key){
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value){
      value = String(value);
      const prevSize = store.has(key) ? store.get(key).length : 0;
      const nextUsed = used - prevSize + value.length;
      if (nextUsed > quotaBytes) {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      }
      used = nextUsed;
      store.set(key, value);
    },
    removeItem(key){
      if (store.has(key)) { used -= store.get(key).length; store.delete(key); }
    },
    clear(){ store.clear(); used = 0; },
    get _size(){ return used; }
  };
}
