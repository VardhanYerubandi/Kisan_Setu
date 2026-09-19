import { useState } from 'react';
import { useApp } from '../core/store.jsx';
import { db } from '../core/db.js';
import { ALL_CROPS, EMOJI, uid } from '../core/util.js';

/** Bottom sheet that saves a request on the phone first, then queues it for the server. */
export default function AskSheet({ kind, id, name, crop0 = 'paddy', qty0 = '', extra = null, payloadExtra = {} }) {
  const { t, enqueue, closeSheet, notify, token, online } = useApp();
  const [crop, setCrop] = useState(crop0), [qty, setQty] = useState(qty0);
  const send = async () => {
    const q = Number(qty); if (!(q > 0)) return notify(t('err_qty'));
    const payload = { qty: q, ...payloadExtra, ...(kind === 'transport' ? {} : { crop }) };
    const rec = { id: uid(), kind, target_id: id, target_name: name, payload, createdAt: Date.now(), synced: false };
    await db.put('requests', rec);
    await enqueue('request', { client_id: rec.id, kind, target_id: id, target_name: name, payload });
    closeSheet(); notify(online && token ? t('req_saved') : token ? t('offline_saved') : t('need_account'), 4200);
  };
  return (
    <>
      <h2>{name}</h2>
      {kind !== 'transport' && <><label className="f" htmlFor="ac">{t('crop_q')}</label>
        <select id="ac" className="in" data-testid="ask-crop" value={crop} onChange={e => setCrop(e.target.value)}>{ALL_CROPS.map(c => <option key={c} value={c}>{EMOJI[c]} {t('crop_' + c)}</option>)}</select></>}
      <label className="f" htmlFor="aq">{t('qty')}</label>
      <input id="aq" className="in" data-testid="ask-qty" type="number" inputMode="decimal" min="1" value={qty} onChange={e => setQty(e.target.value)} />
      {extra}
      <div className="sp" />
      <div className="row"><button className="btn ghost" onClick={closeSheet}>{t('cancel')}</button><button className="btn gold" data-testid="ask-send" onClick={send}>{t('send')}</button></div>
    </>
  );
}
