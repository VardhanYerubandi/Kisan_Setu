import { useApp, useLocalList } from '../core/store.jsx';
import { EMOJI, ALL_CROPS, KISAN_CC } from '../core/util.js';
import { actionText, level } from '../core/kb.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';
import { Ring } from '../ui/parts.jsx';

const TIERS = { free: 'hand', low: 'drop', chem: 'flask' };

export default function Result({ route }) {
  const { t, boot, token, online, notify } = useApp();
  const cases = useLocalList('cases');
  const id = route.parts[0];
  const rec = cases && cases.find(c => c.id === id);
  if (!cases) return <Head title={t('res_title')} />;
  if (!rec) return <><Head title={t('res_title')} /><div className="pad"><p>{t('none_yet')}</p></div></>;

  const crop = rec.crop;
  const head = <div className="chiprow"><span className="tag blue">{EMOJI[crop || 'other']} {t('crop_' + (crop || 'other'))}</span></div>;
  const thumb = rec.thumb ? <img className="thumb" src={rec.thumb} alt="" /> : null;
  const symBtn = crop ? <a className="btn ghost" href={'#/scan/symptoms?crop=' + crop}><Icon name="clip" />{t('or_see')}</a> : null;

  if (rec.source === 'photo' && rec.status === 'pending') {
    const checking = token && online;
    return (
      <>
        <Head title={t('res_title')} />
        <div className="pad" data-testid="result-pending">
          {head}
          <div className="pending">
            {thumb && <span className={'scanwrap' + (checking ? ' scanning' : '')}>{thumb}{checking && <i className="laser" />}</span>}
            <div>
              {!token ? <><div className="note warn">{t('need_account')}</div><a className="btn gold" href="#/profile">{t('reg_title')}</a></>
                : !online ? <div className="note warn">{t('res_pending')}</div> : <><div className="spin" /><p data-say>{t('res_checking')}</p></>}
            </div>
          </div>
          {symBtn}
        </div>
      </>
    );
  }
  if (rec.source === 'photo' && (rec.status === 'ai_off' || rec.status === 'error')) {
    return <><Head title={t('res_title')} /><div className="pad">{head}<div className="pending">{thumb}<p data-say>{rec.status === 'ai_off' ? t('res_ai_off') : t('err_generic')}</p></div>{symBtn}</div></>;
  }

  let list = [], observation = '', healthy = false;
  const viaPhoto = rec.source === 'photo';
  if (viaPhoto && rec.result) {
    const r = rec.result; observation = r.observation || ''; healthy = r.match_id === 'healthy';
    if (boot.kb.problems.some(p => p.id === r.match_id)) list.push({ id: r.match_id, confidence: r.confidence });
    (r.alternatives || []).forEach(a => list.push({ id: a, confidence: null }));
  } else if (rec.result) list = rec.result.matches || [];
  const shown = route.query.get('p') || (list[0] && list[0].id);
  const prob = boot.kb.problems.find(p => p.id === shown);
  const others = list.filter(x => x.id !== shown);
  const conf = (list.find(x => x.id === shown) || {}).confidence;
  const lv = conf != null ? level(conf) : 'med';
  const pct = conf != null ? Math.max(8, Math.round(conf * 100)) : 55;
  const source = t(viaPhoto ? 'res_from_photo' : 'res_from_sym');

  const share = async () => {
    if (!prob) return;
    const free = (prob.tiers.free || []).map(a => '• ' + actionText(t, a)).join('\n');
    const text = `${t('crop_' + (crop || 'other'))}: ${t('n_' + prob.id)}\n${free}\n${t('helpline')} 1800-180-1551`;
    try { if (navigator.share) await navigator.share({ title: t('app_name'), text }); else { await navigator.clipboard.writeText(text); notify(t('done')); } } catch (_) { /* cancelled */ }
  };

  return (
    <>
      <Head title={t('res_title')} />
      <div className="pad result">
        {head}
        {healthy && !prob ? (
          <section className="verdict ok"><div className="v-txt"><small>{source}</small><h2 data-say data-testid="problem-name">{t('res_healthy')}</h2>{observation && <p>{observation}</p>}</div></section>
        ) : !prob ? (
          <section className="verdict"><div className="v-txt"><h2 data-say data-testid="problem-name">{t('unknown_problem')}</h2><p>{t('res_none')}</p>{observation && <p className="muted">{observation}</p>}<small>{source}</small></div></section>
        ) : (
          <>
            <section className="verdict" data-testid="verdict">
              <Ring level={lv} pct={pct} label={t('conf_' + (lv === 'high' ? 'high' : lv === 'med' ? 'med' : 'low'))} />
              <div className="v-txt"><small data-testid="problem-source">{source}</small><h2 data-say data-testid="problem-name">{t('n_' + prob.id)}</h2></div>
            </section>
            {observation && <p className="observe" data-testid="problem-observation"><b>{t('res_note')}:</b> {observation}</p>}
            {['free', 'low', 'chem'].filter(k => prob.tiers[k] && prob.tiers[k].length).map((k, n) => (
              <section key={k} className={'tier ' + k} data-say data-testid={'tier-' + k} style={{ animationDelay: 0.08 * n + 's' }}>
                <h3><Icon name={TIERS[k]} />{t('tier_' + k)}</h3>
                <ul>{prob.tiers[k].map((a, i) => <li key={i}>{actionText(t, a)}</li>)}</ul>
                {k === 'chem' && <p className="muted">{t('safety')}</p>}
              </section>
            ))}
            {others.length > 0 && <><h3>{t('res_more')}</h3><div className="chips">{others.map(o => <a key={o.id} className="chip" href={`#/result/${rec.id}?p=${o.id}`}>{t('n_' + o.id)}</a>)}</div></>}
          </>
        )}
        {!prob && symBtn}
        <div className="note">{t('disclaimer')}</div>
        <a className="btn ghost" href={'tel:' + KISAN_CC}><Icon name="phone" />{t('helpline')} 1800-180-1551</a>
        <div className="row">
          {prob && <button className="btn ghost" data-testid="share" onClick={share}><Icon name="share" />{t('send')}</button>}
          {crop && ALL_CROPS.includes(crop) && <a className="btn gold" data-testid="to-market" href={'#/prices?crop=' + crop}><Icon name="price" />{t('t_prices')}</a>}
        </div>
      </div>
    </>
  );
}
