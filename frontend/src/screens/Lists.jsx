import { useEffect, useState } from 'react';
import { useApp, useLocalList } from '../core/store.jsx';
import { db } from '../core/db.js';
import { api } from '../core/api.js';
import { ALL_CROPS, EMOJI, inr, fmtDate } from '../core/util.js';
import Head from '../ui/Head.jsx';
import { Chips, Empty } from '../ui/parts.jsx';
import { Contact } from './Directory.jsx';

export function Cases() {
  const { t, boot, lang } = useApp();
  const cases = useLocalList('cases');
  const title = r => {
    const id = r.source === 'photo' ? (r.result && r.result.match_id) : (r.result && r.result.matches && r.result.matches[0] && r.result.matches[0].id);
    return boot.kb.problems.some(p => p.id === id) ? t('n_' + id) : r.status === 'pending' ? t('st_local') : r.result && r.result.match_id === 'healthy' ? t('res_healthy') : t('unknown_problem');
  };
  const rows = (cases || []).slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <>
      <Head title={t('cases_title')} />
      <div className="pad">
        {cases && !rows.length && <Empty text={t('none_yet')} action={<a className="btn lime" href="#/scan">{t('t_scan')}</a>} />}
        {rows.map(r => (
          <a key={r.id} className="card case" href={'#/result/' + r.id} data-testid="case-card">
            {r.thumb ? <img className="thumb sm" src={r.thumb} alt="" /> : <span className="em-lg">{EMOJI[r.crop || 'other']}</span>}
            <div className="grow"><h4>{title(r)}</h4><div className="meta"><span>{t('crop_' + (r.crop || 'other'))}</span><span>{fmtDate(r.createdAt, lang)}</span>{!r.nosync && <span className={'tag' + (r.synced ? '' : ' blue')}>{t(r.synced ? 'st_sent' : 'st_local')}</span>}</div></div>
          </a>
        ))}
      </div>
    </>
  );
}

export function Produce() {
  const { t, token, online, logout } = useApp();
  const [crop, setCrop] = useState('all'), [data, setData] = useState(null), [fresh, setFresh] = useState(false);
  useEffect(() => {
    let live = true;
    (async () => {
      const key = 'produce:' + crop;
      if (token && online) {
        const r = await api('/api/listings' + (crop !== 'all' ? '?crop=' + crop : ''), { token });
        if (r.ok && live) { setData(r.data); setFresh(true); db.put('cache', { key, data: r.data, at: Date.now() }); return; }
        if (r.status === 401) logout();
      }
      const c = await db.get('cache', key);
      if (live) { setData(c ? c.data : { listings: [], verified: false }); setFresh(false); }
    })();
    return () => { live = false; };
  }, [crop, token, online, logout]);
  if (!token) return <><Head title={t('t_produce')} /><div className="pad"><a className="btn" href="#/profile">{t('login')}</a></div></>;
  return (
    <>
      <Head title={t('t_produce')} />
      <div className="pad">
        <Chips items={[{ v: 'all', l: t('f_all') }, ...ALL_CROPS.map(c => ({ v: c, l: `${EMOJI[c]} ${t('crop_' + c)}` }))]} value={crop} onPick={setCrop} />
        {data && !fresh && <span className="tag blue">{t('data_saved')}</span>}
        {data && !data.verified && <div className="note warn" data-testid="verify-note">{t('verify_wait')}</div>}
        {data && data.listings.map(l => (
          <article className="card" key={l.id} data-testid="produce-card">
            <h4>{EMOJI[l.crop]} {t('crop_' + l.crop)} · {l.qty_qtl} q</h4>
            <div className="meta"><span>{l.farmer_name}</span><span>{l.village || ''}</span>{l.price_expected && <span>{inr(l.price_expected)}</span>}{l.ready_date && <span>{l.ready_date}</span>}</div>
            {l.farmer_phone && <Contact phone={l.farmer_phone} />}
          </article>
        ))}
        {data && !data.listings.length && <Empty text={t('no_data')} />}
      </div>
    </>
  );
}
