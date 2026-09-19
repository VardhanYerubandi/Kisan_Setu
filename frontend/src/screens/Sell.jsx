import { useState } from 'react';
import { useApp, useDirectory, useLocalList } from '../core/store.jsx';
import { db } from '../core/db.js';
import { ALL_CROPS, EMOJI, inr, roadKm, uid, fmtDate, buzz } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';
import { confetti } from '../ui/confetti.js';

const READY = { r_now: 0, r_week: 7, r_2week: 14, r_month: 30 };

export default function Sell() {
  const { t, pos, user, token, online, enqueue, notify, lang } = useApp();
  const prices = useDirectory('prices');
  const listings = useLocalList('listings');
  const [f, setF] = useState({ crop: 'paddy', qty: '', price: '', village: (user && user.village) || '', ready: 'r_now' });
  const [err, setErr] = useState('');
  const near = prices.rows.filter(p => p.crop === f.crop).map(p => ({ ...p, d: roadKm(pos, p) })).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)).slice(0, 3);
  const usual = near.length ? Math.round(near.reduce((s, p) => s + p.modal, 0) / near.length / 10) * 10 : null;
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const post = async () => {
    const qty = Number(f.qty);
    if (!(qty > 0)) { setErr(t('err_qty')); return; }
    setErr('');
    const ready_date = new Date(Date.now() + READY[f.ready] * 864e5).toISOString().slice(0, 10);
    const rec = { id: uid(), crop: f.crop, qty_qtl: qty, price_expected: Number(f.price) || null, village: f.village || null, ready_date, createdAt: Date.now(), synced: false };
    await db.put('listings', rec);
    await enqueue('listing', { client_id: rec.id, crop: rec.crop, qty_qtl: qty, price_expected: rec.price_expected, village: rec.village, ready_date, lat: pos && pos.lat, lng: pos && pos.lng });
    setF(p => ({ ...p, qty: '', price: '' })); confetti(); buzz(40);
    notify(online && token ? t('listing_ok') : token ? t('offline_saved') : t('need_account'), 4200);
  };
  const mine = (listings || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <>
      <Head title={t('sell_title')} />
      <div className="pad">
        {!token && <div className="note warn">{t('need_account')}</div>}
        <label className="f" htmlFor="sc">{t('crop_q')}</label>
        <select id="sc" className="in" data-testid="sell-crop" value={f.crop} onChange={set('crop')}>{ALL_CROPS.map(c => <option key={c} value={c}>{EMOJI[c]} {t('crop_' + c)}</option>)}</select>
        <label className="f" htmlFor="sq">{t('qty')}</label>
        <input id="sq" className="in" data-testid="sell-qty" type="number" inputMode="decimal" min="1" value={f.qty} onChange={set('qty')} />
        <label className="f" htmlFor="sp">{t('exp_price')}</label>
        <input id="sp" className="in" data-testid="sell-price" type="number" inputMode="numeric" min="1" value={f.price} onChange={set('price')} />
        {usual && <p className="hint"><Icon name="bolt" /> {t('today_price')}: <b>{inr(usual)}</b> {prices.rows[0] && prices.rows[0].source === 'sample' && <span className="tag sample">{t('sample_tag')}</span>}</p>}
        <label className="f" htmlFor="sv">{t('village')}</label>
        <input id="sv" className="in" data-testid="sell-village" maxLength={60} value={f.village} onChange={set('village')} />
        <label className="f">{t('ready')}</label>
        <div className="chips">{Object.keys(READY).map(r => <button key={r} className={'chip' + (f.ready === r ? ' on' : '')} onClick={() => setF(p => ({ ...p, ready: r }))}>{t(r)}</button>)}</div>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn gold big-cta" data-testid="sell-post" onClick={post}><Icon name="wheat" />{t('post')}</button>
        {mine.length > 0 && <><h3>{t('my_produce')}</h3>{mine.map(l => (
          <article className="card" key={l.id} data-testid="my-listing">
            <h4>{EMOJI[l.crop]} {t('crop_' + l.crop)} · {l.qty_qtl} q</h4>
            <div className="meta"><span>{l.price_expected ? inr(l.price_expected) : ''}</span><span>{l.village || ''}</span><span>{fmtDate(l.createdAt, lang)}</span><span className={'tag' + (l.synced ? '' : ' blue')}>{t(l.synced ? 'st_sent' : 'st_local')}</span></div>
          </article>))}</>}
      </div>
    </>
  );
}
