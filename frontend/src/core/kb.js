/** Symptom matching, confidence levels and treatment text: all on the phone, no network. */
export function matchSymptoms(kb, crop, syms) {
  const out = [];
  for (const p of kb.problems.filter(p => p.crop === crop)) {
    const total = Object.values(p.sym).reduce((a, b) => a + b, 0);
    let hit = 0, miss = 0;
    for (const s of syms) { const w = p.sym[s] || 0; if (w) hit += w; else miss++; }
    if (!hit) continue;
    let conf = 0.55 * (hit / total) + 0.45 * (hit / (syms.length * 3)) - 0.05 * miss;
    conf *= Math.min(1, 0.55 + 0.15 * syms.length);                 // one or two symptoms can never read "very likely"
    conf = Math.max(0, Math.min(0.95, conf));
    if (conf >= 0.15) out.push({ id: p.id, confidence: Math.round(conf * 100) / 100 });
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

export const level = c => (c >= 0.65 ? 'high' : c >= 0.4 ? 'med' : 'low');

export function actionText(t, a) {
  let s = t('a_' + a[0]);
  if (a[0] === 'spray') { const p = a[1].startsWith('@') ? t('p_' + a[1].slice(1)) : a[1]; s = s.split('{p}').join(p).split('{d}').join(a[2]); }
  return s;
}

/** Transport cost: max(min charge, km x rate) x trips, shown as -10% .. +15%. */
export function estimate(seed, pos, dest, qtyRaw, vehRaw) {
  if (!pos || !dest || !seed.places[dest]) return null;
  const qty = Math.max(0.1, Number(qtyRaw) || 0), veh = vehRaw === 'auto' ? (qty <= 10 ? 'tempo' : qty <= 20 ? 'pickup' : 'truck') : vehRaw;
  const R = 6371, rad = x => x * Math.PI / 180, b = seed.places[dest];
  const h = Math.sin(rad(b.lat - pos.lat) / 2) ** 2 + Math.cos(rad(pos.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - pos.lng) / 2) ** 2;
  const dist = Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.3), r = seed.vehicle_rates[veh], trips = Math.ceil(qty / r.cap);
  const base = Math.max(r.min, dist * r.rate) * trips, r50 = x => Math.round(x / 50) * 50;
  return { veh, dist, trips, low: r50(base * 0.9), high: r50(base * 1.15) };
}
