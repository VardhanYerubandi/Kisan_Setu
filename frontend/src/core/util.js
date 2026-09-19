export const LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN' };
export const LANG_LABEL = { en: 'English', te: 'తెలుగు', hi: 'हिन्दी', ta: 'தமிழ்', kn: 'ಕನ್ನಡ' };
export const EMOJI = { paddy: '🌾', tomato: '🍅', chilli: '🌶️', cotton: '☁️', maize: '🌽', groundnut: '🥜', onion: '🧅', banana: '🍌', other: '🌱' };
export const ALL_CROPS = ['paddy', 'tomato', 'chilli', 'cotton', 'maize', 'groundnut', 'onion', 'banana'];
export const KISAN_CC = '18001801551';

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).replace(/[^A-Za-z0-9_-]/g, '');
export const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
export const tel = n => 'tel:' + String(n).replace(/[^\d+]/g, '');
export const wa = n => 'https://wa.me/91' + String(n).replace(/\D/g, '').slice(-10);

export function haversine(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180, dLa = rad(b.lat - a.lat), dLo = rad(b.lng - a.lng);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Approximate road distance: straight line x 1.3. Null when either point is unknown. */
export const roadKm = (pos, o) => (pos && o && o.lat != null && o.lng != null) ? Math.round(haversine(pos, o) * 1.3) : null;

export const tod = () => { const h = new Date().getHours(); return h >= 5 && h < 8 ? 'dawn' : h >= 8 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'dusk' : 'night'; };
export const reducedMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const fmtDate = (ts, lang) => new Date(ts).toLocaleDateString(LOCALE[lang] || 'en-IN', { day: 'numeric', month: 'short' });
export const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) { /* not supported */ } };
