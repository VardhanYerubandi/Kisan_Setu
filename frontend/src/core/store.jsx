import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db } from './db.js';
import { api, getData } from './api.js';
import { tod } from './util.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const ENDPOINT = { case: '/api/cases', listing: '/api/listings', request: '/api/requests' };
const STORE_OF = { case: 'cases', listing: 'listings', request: 'requests' };
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };

export function AppProvider({ children }) {
  const [boot, setBoot] = useState(null);                    // { i18n, kb, seed }
  const [bootError, setBootError] = useState(false);
  const [lang, setLangState] = useState(localStorage.getItem('ks_lang'));
  const [theme, setThemeState] = useState(localStorage.getItem('ks_theme') || 'auto');
  const [sysDark, setSysDark] = useState(window.matchMedia ? matchMedia('(prefers-color-scheme: dark)').matches : false);
  const [token, setTokenState] = useState(localStorage.getItem('ks_token'));
  const [user, setUserState] = useState(read('ks_user', null));
  const [pos, setPosState] = useState(read('ks_pos', null));
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [palette, setPalette] = useState(false);
  const [ver, setVer] = useState(0);                          // bumps whenever local data changes, so screens re-read IndexedDB
  const tokenRef = useRef(token); tokenRef.current = token;
  const busy = useRef(false);
  const toastTimer = useRef(null);

  const t = useCallback((k, vars) => {
    if (!boot) return k;
    let s = (boot.i18n[lang] && boot.i18n[lang][k]) || boot.i18n.en[k] || k;
    if (vars) for (const a in vars) s = s.split('{' + a + '}').join(vars[a]);
    return s;
  }, [boot, lang]);
  const tRef = useRef(t); tRef.current = t;

  const notify = useCallback((msg, ms = 3200) => {
    setToast({ msg, id: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const bump = useCallback(() => setVer(v => v + 1), []);
  const refreshPending = useCallback(async () => setPending((await db.all('outbox')).length), []);

  const logoutLocal = useCallback(() => {
    localStorage.removeItem('ks_token'); localStorage.removeItem('ks_user');
    setTokenState(null); setUserState(null); tokenRef.current = null;
  }, []);

  const syncNow = useCallback(async manual => {
    if (busy.current) return;
    const items = (await db.all('outbox')).sort((a, b) => a.ts - b.ts);
    setPending(items.length);
    if (!items.length) { if (manual) notify(tRef.current('all_sent')); return; }
    if (!tokenRef.current) { if (manual) location.hash = '#/profile'; return; }
    if (!navigator.onLine) { if (manual) notify(tRef.current('offline')); return; }
    busy.current = true; setSyncing(true);
    for (const it of items) {
      const r = await api(ENDPOINT[it.kind], { body: it.payload, token: tokenRef.current, ms: it.kind === 'case' ? 60000 : 15000 });
      if (r.status === 0 || r.status >= 500) break;            // network trouble: keep the item, try again later
      if (r.status === 401) { logoutLocal(); break; }           // login expired: keep the queue until the next login
      const rec = await db.get(STORE_OF[it.kind], it.payload.client_id);
      if (rec) {
        rec.synced = true;
        if (r.ok) {
          if (it.kind === 'case' && r.data.case) { rec.status = r.data.case.status; if (rec.source === 'photo') rec.result = r.data.case.result; }
        } else { if (it.kind === 'case') rec.status = 'error'; rec.error = r.data.error || 'error'; }   // rejected for good: do not loop
        await db.put(STORE_OF[it.kind], rec);
      }
      await db.del('outbox', it.id);
    }
    busy.current = false; setSyncing(false);
    await refreshPending(); bump();
  }, [notify, logoutLocal, refreshPending, bump]);

  const enqueue = useCallback(async (kind, payload) => {
    await db.put('outbox', { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()), kind, payload, ts: Date.now() });
    await refreshPending(); bump(); syncNow();
  }, [refreshPending, bump, syncNow]);

  const login = useCallback(data => {
    localStorage.setItem('ks_token', data.token); localStorage.setItem('ks_user', JSON.stringify(data.user));
    setTokenState(data.token); setUserState(data.user); tokenRef.current = data.token;
    setTimeout(() => syncNow(), 0);
  }, [syncNow]);

  const setLang = useCallback(l => { localStorage.setItem('ks_lang', l); setLangState(l); }, []);
  const setPos = useCallback(p => { localStorage.setItem('ks_pos', JSON.stringify(p)); setPosState(p); }, []);
  const dark = theme === 'dark' || (theme === 'auto' && sysDark);
  const toggleTheme = useCallback(() => { const n = dark ? 'light' : 'dark'; localStorage.setItem('ks_theme', n); setThemeState(n); }, [dark]);

  // boot: data files
  useEffect(() => {
    Promise.all(['i18n', 'kb', 'seed'].map(n => fetch('/data/' + n + '.json').then(r => r.json())))
      .then(([i18n, kb, seed]) => setBoot({ i18n, kb, seed })).catch(() => setBootError(true));
  }, []);

  // theme + time of day on <html>
  useEffect(() => {
    const r = document.documentElement; r.dataset.theme = dark ? 'dark' : 'light'; r.dataset.tod = tod();
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', dark ? '#06120d' : '#0d3b2a');
  }, [dark]);
  useEffect(() => { document.documentElement.lang = lang || 'en'; }, [lang]);

  // connectivity, sync triggers, service worker, keyboard
  useEffect(() => {
    if (!boot) return undefined;
    const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    const onSys = e => setSysDark(e.matches);
    const on = () => { setOnline(true); syncNow(); if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => r.sync && r.sync.register('ks-outbox')).catch(() => {}); };
    const off = () => setOnline(false);
    const vis = () => { if (!document.hidden) syncNow(); };
    const key = e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(p => !p); } };
    const swMsg = m => { if (m.data === 'sync') syncNow(); };
    mq && mq.addEventListener('change', onSys);
    window.addEventListener('online', on); window.addEventListener('offline', off); document.addEventListener('visibilitychange', vis); window.addEventListener('keydown', key);
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js').catch(() => {}); navigator.serviceWorker.addEventListener('message', swMsg); }
    const timer = setInterval(() => syncNow(), 60000);
    refreshPending().then(() => syncNow());
    return () => {
      mq && mq.removeEventListener('change', onSys);
      window.removeEventListener('online', on); window.removeEventListener('offline', off); document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', key);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', swMsg);
      clearInterval(timer);
    };
  }, [boot, syncNow, refreshPending]);

  const value = useMemo(() => ({
    boot, bootError, ready: !!boot, t, lang, setLang, theme, dark, toggleTheme, token, user, login, logout: logoutLocal, pos, setPos,
    pending, syncing, online, syncNow, enqueue, toast, notify, sheet, openSheet: setSheet, closeSheet: () => setSheet(null),
    palette, setPalette, ver, bump,
  }), [boot, bootError, t, lang, setLang, theme, dark, toggleTheme, token, user, login, logoutLocal, pos, setPos, pending, syncing, online, syncNow, enqueue, toast, notify, sheet, palette, ver, bump]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Directory data (prices, buyers, storage, transporters) with offline fallback. */
export function useDirectory(kind) {
  const { boot, online } = useApp();
  const [s, setS] = useState({ rows: (boot && boot.seed[kind]) || [], fresh: false, loading: true });
  useEffect(() => {
    let live = true;
    if (!boot) return undefined;
    getData(kind, boot.seed).then(r => { if (live) setS({ rows: r.data, fresh: r.fresh, loading: false }); });
    return () => { live = false; };
  }, [kind, online, boot]);
  return s;
}

/** Everything in one IndexedDB store, refreshed whenever local data changes. */
export function useLocalList(name) {
  const { ver } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => { let live = true; db.all(name).then(r => { if (live) setRows(r); }); return () => { live = false; }; }, [name, ver]);
  return rows;
}
