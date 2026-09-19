import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../core/store.jsx';
import { Icon } from './Icon.jsx';
import { Mark } from './parts.jsx';

const go = to => { location.hash = '#/' + to; };

function Strip() {
  const { t, online, pending, syncing, token, syncNow } = useApp();
  if (!online) return <div className="strip off" role="status"><Icon name="warn" /><b>{t('offline')}{pending ? ' · ' + t('waiting_n', { n: pending }) : ''}</b></div>;
  if (syncing) return <div className="strip wait" role="status"><span className="dotpulse" /><b>{t('syncing')}</b></div>;
  if (pending) return <div className="strip wait" role="status"><b>{t('waiting_n', { n: pending })}</b><button onClick={() => syncNow(true)}>{token ? t('sync_now') : t('register')}</button></div>;
  return null;
}

function Dock({ name }) {
  const { t, user } = useApp();
  const buyer = user && user.role === 'buyer';
  const items = buyer
    ? [['home', 'home', 'app_name'], ['prices', 'price', 't_prices'], ['produce', 'wheat', 't_produce'], ['profile', 'user', 't_profile']]
    : [['home', 'home', 'app_name'], ['prices', 'price', 't_prices'], ['scan', 'scan', 't_scan', true], ['buyers', 'shop', 't_buyers'], ['profile', 'user', 't_profile']];
  return (
    <nav className="dock" aria-label="Main">
      {items.map(([n, ic, label, fab]) => (
        <button key={n} data-testid={'dock-' + n} aria-label={t(label)} className={(fab ? 'fab ' : '') + (name === n || (n === 'scan' && name === 'result') ? 'on' : '')} onClick={() => go(n)}>
          <Icon name={ic} />
        </button>
      ))}
    </nav>
  );
}

function Palette() {
  const { t, setPalette, toggleTheme, dark, user } = useApp();
  const [q, setQ] = useState(''), [i, setI] = useState(0), ref = useRef(null);
  const cmds = useMemo(() => {
    const base = [['home', 'app_name', 'home'], ['scan', 't_scan', 'scan'], ['prices', 't_prices', 'price'], ['buyers', 't_buyers', 'shop'], ['storage', 't_storage', 'snow'],
      ['transport', 't_transport', 'truck'], ['sell', 't_sell', 'wheat'], ['cases', 't_cases', 'clip'], ['profile', 't_profile', 'user'], ['lang', 'language', 'globe']];
    if (user && user.role === 'buyer') base.splice(1, 0, ['produce', 't_produce', 'wheat']);
    return [...base.map(([to, key, ic]) => ({ label: t(key), ic, run: () => go(to) })), { label: t('theme'), ic: dark ? 'sun' : 'moon', run: toggleTheme }];
  }, [t, dark, toggleTheme, user]);
  const list = cmds.filter(c => c.label.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  const run = c => { if (c) { setPalette(false); c.run(); } };
  const key = e => {
    if (e.key === 'Escape') setPalette(false);
    else if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(list.length - 1, x + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(0, x - 1)); }
    else if (e.key === 'Enter') run(list[i]);
  };
  return (
    <div className="palette-scrim" onMouseDown={e => { if (e.target === e.currentTarget) setPalette(false); }}>
      <div className="palette" role="dialog" aria-label="Command palette" data-testid="palette">
        <div className="pal-in"><Icon name="search" /><input ref={ref} value={q} onChange={e => { setQ(e.target.value); setI(0); }} onKeyDown={key} placeholder="Go to…" /><kbd>esc</kbd></div>
        <ul>{list.map((c, n) => <li key={c.label}><button className={n === i ? 'on' : ''} onMouseEnter={() => setI(n)} onClick={() => run(c)}><Icon name={c.ic} />{c.label}</button></li>)}</ul>
      </div>
    </div>
  );
}

function Story() {
  return (
    <aside className="story" aria-hidden="true">
      <div className="story-in">
        <div className="brand"><Mark size={46} /><b>Kisan Setu</b></div>
        <h1>From a sick leaf to the <em>right buyer.</em></h1>
        <p>Crop care and market access for small farmers, in their own language, even with no signal.</p>
        <ul>
          <li><Icon name="camera" /> Photo or picture check, advice in three cost tiers</li>
          <li><Icon name="price" /> Prices, buyers, cold storage and transport in one place</li>
          <li><Icon name="bolt" /> Offline first. Nothing typed is ever lost</li>
        </ul>
        <div className="techchips"><span>Java 21</span><span>React</span><span>PWA</span><span>5 languages</span></div>
        <small>Prototype. Buyers, prices and storage shown are sample data. Press <kbd>Ctrl</kbd> <kbd>K</kbd> to jump anywhere.</small>
      </div>
      <svg className="story-bridge" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice"><path className="b-arc" pathLength="1" d="M-20 150 Q200 -40 420 150" /><line x1="-20" y1="150" x2="420" y2="150" /></svg>
    </aside>
  );
}

export default function Shell({ children, name, chrome }) {
  const { toast, sheet, closeSheet, palette } = useApp();
  const scroller = useRef(null);
  useEffect(() => { scroller.current && scroller.current.scrollTo(0, 0); }, [name]);
  return (
    <div className="stage">
      <Story />
      <div className="device">
        <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
        {chrome && <Strip />}
        <main className="screen" ref={scroller} id="screen">{children}</main>
        {chrome && <Dock name={name} />}
        {toast && <div className="toast" role="status" key={toast.id}>{toast.msg}</div>}
        {sheet && <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget) closeSheet(); }}><div className="sheet" role="dialog" aria-modal="true">{sheet}</div></div>}
      </div>
      {palette && <Palette />}
    </div>
  );
}
