import { useMemo, useState } from 'react';
import { useApp, useDirectory } from '../core/store.jsx';
import { EMOJI, ALL_CROPS, LOCALE, roadKm } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';
import Num from '../ui/Num.jsx';
import { AreaChart, Chips, Spark, pctChange } from '../ui/parts.jsx';

export function PlaceBar() {
  const { pos, t } = useApp();
  return (
    <a className="placebar" href="#/place" data-testid="placebar">
      <Icon name="pin" />{pos ? <b>{pos.name || '…'}</b> : <span>{t('set_place')}</span>}<Icon name="arrow" className="go" />
    </a>
  );
}
export const StaleTag = ({ s }) => { const { t } = useApp(); return !s.loading && !s.fresh ? <span className="tag blue">{t('data_saved')}</span> : null; };

export default function Prices({ route }) {
  const { t, pos, lang } = useApp();
  const s = useDirectory('prices');
  const [crop, setCrop] = useState(route.query.get('crop') && ALL_CROPS.includes(route.query.get('crop')) ? route.query.get('crop') : 'chilli');
  const [sort, setSort] = useState('price');
  const [sel, setSel] = useState(null);
  const rows = useMemo(() => s.rows.filter(r => r.crop === crop).map(r => ({ ...r, d: roadKm(pos, r) }))
    .sort(sort === 'near' && pos ? (a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) : (a, b) => b.modal - a.modal), [s.rows, crop, sort, pos]);
  const best = rows.slice().sort((a, b) => b.modal - a.modal)[0];
  const near = pos ? rows.slice().sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))[0] : null;
  const focus = rows.find(r => r.market === sel) || best;
  const labels = focus && focus.trend && focus.trend.length > 1 ? focus.trend.map((_, i, a) => { const d = new Date(); d.setDate(d.getDate() - (a.length - 1 - i)); return d.toLocaleDateString(LOCALE[lang] || 'en-IN', { day: 'numeric', month: 'short' }); }) : null;
  const sample = rows.some(r => r.source === 'sample');
  return (
    <>
      <Head title={t('prices_title')} />
      <div className="pad">
        <Chips items={ALL_CROPS.map(c => ({ v: c, l: `${EMOJI[c]} ${t('crop_' + c)}` }))} value={crop} onPick={c => { setCrop(c); setSel(null); }} />
        <div className="row-between"><PlaceBar /><StaleTag s={s} /></div>
        <p className="muted">{t('per_qtl')}</p>
        {best && (
          <section className="chartcard" data-testid="chartcard">
            <div className="cc-head"><b>{EMOJI[crop]} {focus.market}</b><span className="muted">{focus.state}{focus.d != null ? ' · ' + t('km_away', { d: focus.d }) : ''}</span></div>
            {focus.trend && focus.trend.length > 1 ? <AreaChart series={focus.trend} labels={labels} /> : <Num className="bignum" value={focus.modal} />}
          </section>
        )}
        {best && (
          <div className="summary">
            <div className="card hl" data-testid="best-card"><small>{t('best_price')}</small><Num className="v" value={best.modal} /><span className="muted">{best.market}{best.d != null ? ' · ' + t('km_away', { d: best.d }) : ''}</span></div>
            <div className="card" data-testid="near-card"><small>{t('nearest')}</small>{near ? <><Num className="v" value={near.modal} /><span className="muted">{near.market} · {t('km_away', { d: near.d })}</span></> : <span className="muted">{t('need_place')}</span>}</div>
          </div>
        )}
        <div className="seg"><button className={sort === 'price' ? 'on' : ''} data-testid="sort-price" onClick={() => setSort('price')}>{t('best_price')}</button><button className={sort === 'near' ? 'on' : ''} data-testid="sort-near" onClick={() => setSort('near')}>{t('nearest')}</button></div>
        {rows.map(r => {
          const ch = pctChange(r.trend);
          return (
            <button key={r.market + r.state} className={'card price-row' + (focus && focus.market === r.market ? ' active' : '')} data-testid="price-row" onClick={() => setSel(r.market)}>
              <div className="grow"><h4>{r.market}</h4><div className="meta"><span>{r.state}</span>{r.d != null && <span><Icon name="pin" />{t('km_away', { d: r.d })}</span>}</div><div className="meta"><span>₹{r.min.toLocaleString('en-IN')} – ₹{r.max.toLocaleString('en-IN')}</span></div></div>
              <div className="pr-right"><Num className="big" value={r.modal} /><Spark series={r.trend} />{ch != null && <span className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '▲' : '▼'} {Math.abs(ch)}%</span>}</div>
            </button>
          );
        })}
        {!rows.length && <p>{t('no_data')}</p>}
        {sample && <div className="note warn"><span className="tag sample">{t('sample_tag')}</span> {t('sample_note')}</div>}
      </div>
    </>
  );
}
