import { useRef, useState } from 'react';
import { useApp } from '../core/store.jsx';
import { db } from '../core/db.js';
import { EMOJI, uid } from '../core/util.js';
import { compress } from '../core/image.js';
import { canListen, listenCrop } from '../core/speech.js';
import { matchSymptoms } from '../core/kb.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';

const go = to => { location.hash = '#/' + to; };
let draft = null;   // the photo being prepared survives navigation inside the session

export function ScanCrop() {
  const { t, boot, lang, notify } = useApp();
  const crops = [...boot.kb.crops, 'other'];
  return (
    <>
      <Head title={t('t_scan')} />
      <div className="pad">
        <h2 data-say>{t('crop_q')}</h2>
        {canListen && <button className="btn ghost mic" data-testid="mic" onClick={() => { notify(t('speak_now'), 4000); listenCrop(boot.i18n, lang, c => go('scan/photo?crop=' + c), () => notify(t('mic_fail'))); }}><Icon name="mic" />{t('speak_now').replace('…', '')}<span className="wave"><i /><i /><i /><i /></span></button>}
        <div className="orbs">
          {crops.map(c => <a key={c} href={'#/scan/photo?crop=' + c} data-testid={'crop-' + c} className="orb-btn"><span className="em">{EMOJI[c]}</span><b>{t('crop_' + c)}</b></a>)}
        </div>
      </div>
    </>
  );
}

export function ScanPhoto({ route }) {
  const { t, lang, pos, enqueue, notify } = useApp();
  const crop = route.query.get('crop');
  const [d, setD] = useState(draft && draft.crop === crop ? draft : null);
  const cam = useRef(null), gal = useRef(null);
  const onFile = async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { const c = await compress(f); draft = { crop, ...c }; setD(draft); } catch (_) { notify(t('err_generic')); }
  };
  const check = async () => {
    const id = uid(), c = crop === 'other' ? null : crop;
    await db.put('cases', { id, crop: c, source: 'photo', createdAt: Date.now(), status: 'pending', thumb: d.thumb, synced: false });
    const image = d.image; draft = null;
    await enqueue('case', { client_id: id, crop: c, source: 'photo', image, lang, lat: pos && pos.lat, lng: pos && pos.lng });
    go('result/' + id);
  };
  return (
    <>
      <Head title={`${EMOJI[crop] || ''} ${t('crop_' + crop)}`} />
      <div className="pad">
        <p data-say>{t('photo_tip')}</p>
        <div className={'finder' + (d ? ' has' : '')}>
          <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          {d ? <><img src={d.image} alt="" data-testid="photo-preview" /><i className="laser" /></> : <div className="finder-hint"><Icon name="camera" size={44} /></div>}
        </div>
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden data-testid="file-cam" onChange={onFile} />
        <input ref={gal} type="file" accept="image/*" hidden data-testid="file-gal" onChange={onFile} />
        <div className="row">
          <button className="btn gold" data-testid="shutter" onClick={() => cam.current.click()}><Icon name="camera" />{t('photo_take')}</button>
          <button className="btn ghost" data-testid="pick" onClick={() => gal.current.click()}><Icon name="image" />{t('photo_pick')}</button>
        </div>
        {d && <button className="btn lime big-cta" data-testid="photo-check" onClick={check}><Icon name="bolt" />{t('photo_check')}</button>}
        {crop !== 'other' && <><div className="or"><span>{t('or_see')}</span></div><a className="btn ghost" data-testid="go-symptoms" href={'#/scan/symptoms?crop=' + crop}><Icon name="clip" />{t('sym_q')}</a></>}
      </div>
    </>
  );
}

export function ScanSymptoms({ route }) {
  const { t, boot, token, lang, pos, enqueue } = useApp();
  const crop = route.query.get('crop');
  const [sel, setSel] = useState(() => new Set());
  const toggle = s => setSel(p => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const done = async () => {
    const syms = [...sel], id = uid(), matches = matchSymptoms(boot.kb, crop, syms);
    await db.put('cases', { id, crop, source: 'symptoms', symptoms: syms, createdAt: Date.now(), status: 'done', result: { engine: 'on-device-kb', matches }, synced: false, nosync: !token });
    if (token) await enqueue('case', { client_id: id, crop, source: 'symptoms', symptoms: syms, local_result: { matches }, lang, lat: pos && pos.lat, lng: pos && pos.lng });
    go('result/' + id);
  };
  return (
    <>
      <Head title={`${EMOJI[crop] || ''} ${t('crop_' + crop)}`} />
      <div className="pad">
        <h2 data-say>{t('sym_q')}</h2>
        <p className="muted">{t('sym_hint')}</p>
        <div className="symgrid">
          {boot.kb.symptoms.map(s => (
            <button key={s} data-testid={'sym-' + s} className={sel.has(s) ? 'on' : ''} onClick={() => toggle(s)} aria-pressed={sel.has(s)}>
              <Icon name={'s_' + s} /><span>{t('sym_' + s)}</span><i className="tick"><Icon name="check" /></i>
            </button>
          ))}
        </div>
        <button className="btn lime big-cta sticky-cta" data-testid="sym-done" disabled={!sel.size} onClick={done}>{t('see_result')}<Icon name="arrow" /></button>
      </div>
    </>
  );
}
