import { useState } from 'react';
import { useApp } from '../core/store.jsx';
import { api } from '../core/api.js';
import { LANG_LABEL } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';

const ERR = { bad_phone: 'err_phone', bad_pin: 'err_pin', bad_name: 'err_name', bad_business: 'err_name', exists: 'err_exists', bad_login: 'err_login', locked: 'err_locked' };

/** Four-dot PIN entry: the real (numeric) input sits invisibly on top so phone keyboards and autofill still work. */
function PinField({ value, onChange, testid, label, autoComplete }) {
  return (
    <label className="pin">
      <span className="f">{label}</span>
      <span className="dots">{[0, 1, 2, 3].map(i => <i key={i} className={i < value.length ? 'on' : ''} />)}</span>
      <input type="password" inputMode="numeric" maxLength={4} value={value} autoComplete={autoComplete} data-testid={testid} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} />
    </label>
  );
}

export default function Profile() {
  const { t, user, login, logout, lang, pending, syncNow, dark, toggleTheme } = useApp();
  const [tab, setTab] = useState('new'), [role, setRole] = useState('farmer'), [err, setErr] = useState('');
  const [f, setF] = useState({ name: '', village: '', business: '', phone: '', pin: '' });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const submit = async () => {
    const reg = tab === 'new';
    const r = reg ? await api('/api/register', { body: { name: f.name, phone: f.phone, pin: f.pin, role, village: f.village, business: f.business, lang } }) : await api('/api/login', { body: { phone: f.phone, pin: f.pin } });
    if (r.ok) { setErr(''); login(r.data); location.hash = '#/home'; return; }
    setErr(r.status === 0 ? t('offline') : t(ERR[r.data.error] || 'err_generic'));
  };
  if (user) {
    return (
      <>
        <Head title={t('t_profile')} />
        <div className="pad">
          <section className="idcard"><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><h2>{user.name}</h2><div className="meta"><span>{user.phone}</span><span className="tag">{t(user.role === 'buyer' ? 'role_buyer' : 'role_farmer')}</span></div></div></section>
          {user.role === 'buyer' && !user.verified && <div className="note warn">{t('verify_wait')}</div>}
          <button className="btn lime" data-testid="sync-now" onClick={() => syncNow(true)}><Icon name="check" />{t('sync_now')}{pending ? ` (${pending})` : ''}</button>
          <a className="btn ghost" href="#/lang"><Icon name="globe" />{t('language')}: {LANG_LABEL[lang]}</a>
          <button className="btn ghost" onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} />{t('theme')}</button>
          <button className="btn ghost" data-testid="logout" onClick={() => { logout(); location.hash = '#/home'; }}>{t('logout')}</button>
        </div>
      </>
    );
  }
  const reg = tab === 'new';
  return (
    <>
      <Head title={t(reg ? 'reg_title' : 'login_title')} />
      <div className="pad">
        <div className="seg"><button className={reg ? 'on' : ''} data-testid="tab-new" onClick={() => { setTab('new'); setErr(''); }}>{t('new_acct')}</button><button className={!reg ? 'on' : ''} data-testid="tab-login" onClick={() => { setTab('login'); setErr(''); }}>{t('have_acct')}</button></div>
        {reg && <div className="seg"><button className={role === 'farmer' ? 'on' : ''} data-testid="role-farmer" onClick={() => setRole('farmer')}>{t('role_farmer')}</button><button className={role === 'buyer' ? 'on' : ''} data-testid="role-buyer" onClick={() => setRole('buyer')}>{t('role_buyer')}</button></div>}
        {reg && <><label className="f" htmlFor="rn">{t('name')}</label><input id="rn" className="in" data-testid="reg-name" autoComplete="name" maxLength={60} value={f.name} onChange={set('name')} /></>}
        {reg && role === 'buyer' && <><label className="f" htmlFor="rb">{t('business')}</label><input id="rb" className="in" data-testid="reg-business" maxLength={80} value={f.business} onChange={set('business')} /></>}
        {reg && role === 'farmer' && <><label className="f" htmlFor="rv">{t('village')}</label><input id="rv" className="in" data-testid="reg-village" maxLength={60} value={f.village} onChange={set('village')} /></>}
        <label className="f" htmlFor="rp">{t('phone')}</label>
        <input id="rp" className="in" data-testid="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value.replace(/\D/g, '') }))} />
        <PinField value={f.pin} onChange={v => setF(p => ({ ...p, pin: v }))} testid="pin" label={t('pin')} autoComplete={reg ? 'new-password' : 'current-password'} />
        {err && <p className="err" role="alert" data-testid="auth-error">{err}</p>}
        <button className="btn gold big-cta" data-testid="submit" onClick={submit}>{t(reg ? 'register' : 'login')}</button>
      </div>
    </>
  );
}
