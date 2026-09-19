import { useMemo, useState } from 'react';
import { useApp, useDirectory } from '../core/store.jsx';
import { estimate } from '../core/kb.js';
import { inr, roadKm } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';
import { PlaceBar, StaleTag } from './Prices.jsx';
import { Contact, SampleTag } from './Directory.jsx';
import AskSheet from './AskSheet.jsx';

export default function Transport() {
  const { t, boot, pos, user, openSheet } = useApp();
  const s = useDirectory('transporters');
  const [tf, setTf] = useState({ qty: 10, dest: '', veh: 'auto' });
  const est = estimate(boot.seed, pos, tf.dest, tf.qty, tf.veh);
  const rows = useMemo(() => {
    const r = s.rows.map(x => ({ ...x, d: roadKm(pos, x) }));
    return pos ? r.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9)) : r;
  }, [s.rows, pos]);
  const canAsk = !(user && user.role === 'buyer');
  const set = k => e => setTf(p => ({ ...p, [k]: e.target.value }));
  return (
    <>
      <Head title={t('transport_title')} />
      <div className="pad">
        <PlaceBar />
        <label className="f" htmlFor="tq">{t('how_much')}</label>
        <input id="tq" className="in" data-testid="tq" type="number" inputMode="decimal" min="1" value={tf.qty} onChange={set('qty')} />
        <label className="f" htmlFor="td">{t('where_to')}</label>
        <select id="td" className="in" data-testid="td" value={tf.dest} onChange={set('dest')}><option value="">{t('pick_place')}</option>{Object.keys(boot.seed.places).map(n => <option key={n}>{n}</option>)}</select>
        <label className="f" htmlFor="tv">{t('vehicle')}</label>
        <select id="tv" className="in" data-testid="tv" value={tf.veh} onChange={set('veh')}><option value="auto">Auto</option>{['tempo', 'pickup', 'truck'].map(v => <option key={v} value={v}>{t('veh_' + v)}</option>)}</select>
        {est ? (
          <section className="estimate" data-testid="estimate">
            <div className="route"><i className="from" /><span className="dash" /><Icon name="truck" className="truck" /><i className="to" /></div>
            <small>{t('est_cost')}</small>
            <b className="bignum">{inr(est.low)} – {inr(est.high)}</b>
            <div className="meta"><span>{t('km_away', { d: est.dist })}</span><span>{t('veh_' + est.veh)}{est.trips > 1 ? ' × ' + est.trips : ''}</span></div>
            <p className="muted">{t('est_note')}</p>
          </section>
        ) : <div className="note">{pos ? t('pick_place') : t('need_place')}</div>}
        <h3>{t('transporters')}</h3><StaleTag s={s} />
        {rows.map(x => (
          <article className="card" key={x.id} data-testid="transporter-card">
            <h4>{x.name}</h4>
            <div className="meta"><SampleTag o={x} /><span>{x.place}</span>{x.d != null && <span><Icon name="pin" />{t('km_away', { d: x.d })}</span>}</div>
            <div className="meta">{x.vehicles.map(v => <span className="tag" key={v}>{t('veh_' + v).split(' (')[0]}</span>)}</div>
            <Contact phone={x.phone}>{canAsk && <button className="btn small" data-testid="ask-transport" onClick={() => openSheet(<AskSheet kind="transport" id={x.id} name={x.name} qty0={tf.qty} payloadExtra={{ dest: tf.dest, vehicle: tf.veh, ...(est ? { km: est.dist } : {}) }} extra={est ? <p className="muted">{t('est_cost')}: {inr(est.low)} – {inr(est.high)}</p> : null} />)}>{t('req_vehicle')}</button>}</Contact>
          </article>
        ))}
      </div>
    </>
  );
}
