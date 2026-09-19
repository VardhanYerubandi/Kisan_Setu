import { useMemo, useState } from 'react';
import { useApp, useDirectory } from '../core/store.jsx';
import { EMOJI, ALL_CROPS, roadKm, tel, wa } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';
import { Chips } from '../ui/parts.jsx';
import { PlaceBar, StaleTag } from './Prices.jsx';
import AskSheet from './AskSheet.jsx';

export function Contact({ phone, children }) {
  const { t } = useApp();
  return (
    <div className="acts">
      <a className="btn small ghost" href={tel(phone)}><Icon name="phone" />{t('call')}</a>
      <a className="btn small ghost" href={wa(phone)} target="_blank" rel="noopener"><Icon name="chat" />{t('whatsapp')}</a>
      {children}
    </div>
  );
}
export const SampleTag = ({ o }) => { const { t } = useApp(); return o.sample ? <span className="tag sample">{t('sample_tag')}</span> : null; };
const cropItems = t => [{ v: 'all', l: t('f_all') }, ...ALL_CROPS.map(c => ({ v: c, l: `${EMOJI[c]} ${t('crop_' + c)}` }))];

export function Buyers() {
  const { t, pos, openSheet } = useApp();
  const s = useDirectory('buyers');
  const [crop, setCrop] = useState('all'), [type, setType] = useState('all');
  const rows = useMemo(() => {
    const r = s.rows.filter(b => (crop === 'all' || b.crops.includes(crop)) && (type === 'all' || b.type === type)).map(b => ({ ...b, d: roadKm(pos, b) }));
    return pos ? r.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)) : r;
  }, [s.rows, crop, type, pos]);
  return (
    <>
      <Head title={t('buyers_title')} />
      <div className="pad">
        <Chips items={cropItems(t)} value={crop} onPick={setCrop} />
        <div className="row-between"><PlaceBar /><StaleTag s={s} /></div>
        <div className="seg">{['all', 'buyer', 'fpo'].map(k => <button key={k} data-testid={'type-' + k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>{t(k === 'all' ? 'f_all' : 'f_' + k)}</button>)}</div>
        {rows.map(b => (
          <article className="card" key={b.id} data-testid="buyer-card">
            <h4>{b.name}</h4>
            <div className="meta"><span className="tag">{t('type_' + b.type)}</span><SampleTag o={b} /><span>{b.place}</span>{b.d != null && <span><Icon name="pin" />{t('km_away', { d: b.d })}</span>}</div>
            <div className="meta"><span>{t('buys')}: {b.crops.map(c => `${EMOJI[c]} ${t('crop_' + c)}`).join(', ')}</span></div>
            <Contact phone={b.phone}><button className="btn small" data-testid="ask-buyer" onClick={() => openSheet(<AskSheet kind="buyer_interest" id={b.id} name={b.name} crop0={crop !== 'all' ? crop : 'paddy'} />)}>{t('tell_them')}</button></Contact>
          </article>
        ))}
        {!rows.length && <p>{t('no_data')}</p>}
      </div>
    </>
  );
}

export function Storage() {
  const { t, pos, user, openSheet } = useApp();
  const s = useDirectory('storage');
  const [crop, setCrop] = useState('all');
  const rows = useMemo(() => {
    const r = s.rows.filter(x => crop === 'all' || x.crops.includes(crop)).map(x => ({ ...x, d: roadKm(pos, x) }));
    return pos ? r.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)) : r;
  }, [s.rows, crop, pos]);
  const canAsk = !(user && user.role === 'buyer');
  return (
    <>
      <Head title={t('storage_title')} />
      <div className="pad">
        <Chips items={cropItems(t)} value={crop} onPick={setCrop} />
        <div className="row-between"><PlaceBar /><StaleTag s={s} /></div>
        {rows.map(x => (
          <article className="card" key={x.id} data-testid="storage-card">
            <h4>{x.name}</h4>
            <div className="meta"><SampleTag o={x} /><span>{x.place}</span>{x.d != null && <span><Icon name="pin" />{t('km_away', { d: x.d })}</span>}</div>
            <div className="chipstats"><span><Icon name="snow" />{x.temp}</span><span>{t('rate_month', { r: x.rate })}</span><span className="free">{t('space_free', { n: x.free_qtl })}</span></div>
            <div className="meta"><span>{x.crops.map(c => `${EMOJI[c]} ${t('crop_' + c)}`).join(', ')}</span></div>
            <Contact phone={x.phone}>{canAsk && <button className="btn small" data-testid="ask-storage" onClick={() => openSheet(<AskSheet kind="storage_enquiry" id={x.id} name={x.name} crop0={crop !== 'all' ? crop : 'tomato'} />)}>{t('ask_space')}</button>}</Contact>
          </article>
        ))}
        {!rows.length && <p>{t('no_data')}</p>}
      </div>
    </>
  );
}
