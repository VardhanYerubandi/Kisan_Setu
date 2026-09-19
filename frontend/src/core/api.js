import { db } from './db.js';

export async function fetchT(url, opts = {}, ms = 8000) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opts, signal: c.signal }); } finally { clearTimeout(id); }
}

/** Never throws: resolves to {ok, status, data}. status 0 means the network failed. */
export async function api(path, { body, method, token, ms = 15000 } = {}) {
  try {
    const r = await fetchT(path, {
      method: method || (body ? 'POST' : 'GET'), cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined,
    }, ms);
    let data = {}; try { data = await r.json(); } catch (_) { /* empty body */ }
    return { ok: r.ok, status: r.status, data };
  } catch (_) { return { ok: false, status: 0, data: {} }; }
}

/** Directory data: fresh from the server, else the last saved copy, else the bundled sample seed. */
export async function getData(kind, seed) {
  if (navigator.onLine) {
    try {
      const r = await fetchT('/api/' + kind, { cache: 'no-store' }, 6000);
      if (r.ok) { const data = (await r.json())[kind]; await db.put('cache', { key: kind, data, at: Date.now() }); return { data, fresh: true }; }
    } catch (_) { /* fall through */ }
  }
  const c = await db.get('cache', kind);
  if (c) return { data: c.data, fresh: false };
  return { data: (seed && seed[kind]) || [], fresh: false };
}
