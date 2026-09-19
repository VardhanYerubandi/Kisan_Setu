// Tiny promise wrapper over IndexedDB with an in-memory fallback (private browsing). Stores: cases, listings, requests, outbox, cache.
let dbp = null;
const mem = {};
const keyOf = n => (n === 'cache' ? 'key' : 'id');
const memStore = n => mem[n] || (mem[n] = new Map());

const open = () => dbp || (dbp = new Promise((res, rej) => {
  if (!window.indexedDB) return rej(new Error('no idb'));
  const r = indexedDB.open('kisan-setu', 1);
  r.onupgradeneeded = () => {
    ['cases', 'listings', 'requests', 'outbox'].forEach(n => r.result.createObjectStore(n, { keyPath: 'id' }));
    r.result.createObjectStore('cache', { keyPath: 'key' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));
const wrap = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const store = async (n, mode) => (await open()).transaction(n, mode || 'readonly').objectStore(n);

export const db = {
  put: async (n, v) => { try { return await wrap((await store(n, 'readwrite')).put(v)); } catch (_) { memStore(n).set(v[keyOf(n)], v); } },
  get: async (n, k) => { try { return await wrap((await store(n)).get(k)); } catch (_) { return memStore(n).get(k); } },
  all: async n => { try { return await wrap((await store(n)).getAll()); } catch (_) { return [...memStore(n).values()]; } },
  del: async (n, k) => { try { return await wrap((await store(n, 'readwrite')).delete(k)); } catch (_) { memStore(n).delete(k); } },
};
