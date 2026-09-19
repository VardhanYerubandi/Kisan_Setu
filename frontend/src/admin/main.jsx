import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './admin.css';

const COLORS = ['#f5b31a', '#3fd08a', '#5ab0ff', '#ff8a7a', '#b39cff'];
const when = ts => new Date(ts * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

function useApi() {
  const [token, setToken] = useState(sessionStorage.getItem('ks_admin'));
  const call = useCallback(async (path, body) => {
    const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401 || r.status === 403) { sessionStorage.removeItem('ks_admin'); setToken(null); throw new Error('auth'); }
    return r;
  }, [token]);
  return { token, setToken, call };
}

function Login({ onToken }) {
  const [phone, setPhone] = useState(''), [pin, setPin] = useState(''), [err, setErr] = useState('');
  const go = async () => {
    const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, pin }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.user || d.user.role !== 'admin') return setErr('Wrong phone or PIN, or not an admin account.');
    sessionStorage.setItem('ks_admin', d.token); onToken(d.token);
  };
  return (
    <div className="login">
      <h2>Control room</h2><div className="muted" style={{ marginBottom: 16 }}>Kisan Setu admin</div>
      <label>Phone</label><input id="p" data-testid="admin-phone" inputMode="numeric" autoComplete="username" value={phone} onChange={e => setPhone(e.target.value)} />
      <label>PIN</label><input id="k" data-testid="admin-pin" type="password" autoComplete="current-password" value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
      <div className="err">{err}</div><button id="go" data-testid="admin-go" onClick={go}>Log in</button>
    </div>
  );
}

const Bars = ({ rows, label, val, fmt }) => {
  const mx = Math.max(1, ...rows.map(r => r[val]));
  return rows.length ? rows.map(r => <div className="bar" key={r[label]}><span>{fmt ? fmt(r[label]) : r[label]}</span><i style={{ width: (r[val] / mx * 100) + '%' }} /><b>{r[val]}</b></div>) : <p className="muted">No data yet.</p>;
};

function Donut({ rows, label, val }) {
  const tot = rows.reduce((a, r) => a + r[val], 0);
  if (!tot) return <p className="muted">No data yet.</p>;
  let off = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 42 42">
        {rows.map((r, i) => { const p = r[val] / tot * 100, c = <circle key={i} r="15.9155" cx="21" cy="21" fill="none" stroke={COLORS[i % 5]} strokeWidth="5.2" strokeDasharray={`${p} ${100 - p}`} strokeDashoffset={-off} transform="rotate(-90 21 21)" />; off += p; return c; })}
        <text x="21" y="23" textAnchor="middle" className="dn">{tot}</text>
      </svg>
      <ul>{rows.map((r, i) => <li key={i}><i style={{ background: COLORS[i % 5] }} />{r[label]} <b>{r[val]}</b></li>)}</ul>
    </div>
  );
}

function Days({ rows }) {
  const mx = Math.max(1, ...rows.map(r => r.n));
  return rows.length ? <><div className="spark">{rows.map(r => <i key={r.d} title={`${r.d}: ${r.n}`} style={{ height: (r.n / mx * 100) + '%' }} />)}</div><div className="muted">Last 14 days</div></> : <p className="muted">No data yet.</p>;
}

function Overview({ call, names }) {
  const [s, setS] = useState(null);
  useEffect(() => { call('/api/admin/stats').then(r => r.json()).then(setS).catch(() => {}); }, [call]);
  if (!s) return <p className="muted">Loading…</p>;
  const u = s.users || {}, reqTotal = Object.values(s.requests_by_kind).reduce((a, b) => a + b, 0);
  const src = Object.entries(s.cases_by_source).map(([k, n]) => ({ k: k === 'photo' ? 'Photo (AI)' : 'Symptoms (offline KB)', n }));
  const req = Object.entries(s.requests_by_kind).map(([k, n]) => ({ k: k.replace('_', ' '), n }));
  return (
    <>
      <div className="stats" data-testid="stats">
        <div className="stat"><b>{u.farmer || 0}</b><span>Farmers</span></div>
        <div className="stat"><b>{u.buyer || 0}</b><span>Buyers / FPOs {s.pending_buyers ? <span className="pill warn">{s.pending_buyers} to approve</span> : null}</span></div>
        <div className="stat"><b>{s.cases}</b><span>Crop checks</span></div>
        <div className="stat"><b>{s.listings}</b><span>Produce listings ({Math.round(s.listing_qtl)} quintal open)</span></div>
        <div className="stat"><b>{reqTotal}</b><span>Buyer / storage / transport requests</span></div>
      </div>
      <div className="panel"><span className={'pill ' + (s.ai_enabled ? '' : 'warn')}>Photo diagnosis: {s.ai_enabled ? 'on' : 'off'}</span> <span className={'pill ' + (s.live_prices ? '' : 'warn')}>Live prices: {s.live_prices ? 'Agmarknet' : 'sample data'}</span></div>
      <div className="grid2">
        <div className="panel"><h2>Most common problems</h2><Bars rows={s.top_problems} label="id" val="n" fmt={id => names[id] || id} /></div>
        <div className="panel"><h2>Checks by crop</h2><Bars rows={s.cases_by_crop} label="crop" val="n" /></div>
        <div className="panel"><h2>Crop checks per day</h2><Days rows={s.cases_per_day} /></div>
        <div className="panel"><h2>Produce listed by crop (quintal)</h2><Bars rows={s.listings_by_crop} label="crop" val="qtl" /></div>
        <div className="panel"><h2>Check source</h2><Donut rows={src} label="k" val="n" /></div>
        <div className="panel"><h2>Requests</h2><Donut rows={req} label="k" val="n" /></div>
      </div>
    </>
  );
}

const Table = ({ cols, rows }) => (
  <div className="panel"><table><thead><tr>{cols.map(c => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((r, i) => <tr key={r.id || i}>{cols.map(c => <td key={c[0]}>{c[1](r)}</td>)}</tr>) : <tr><td colSpan={cols.length} className="muted">Nothing yet.</td></tr>}</tbody></table></div>
);

function Users({ call }) {
  const [rows, setRows] = useState([]);
  const load = useCallback(() => call('/api/admin/users').then(r => r.json()).then(d => setRows(d.users)).catch(() => {}), [call]);
  useEffect(() => { load(); }, [load]);
  const verify = async (id, to) => { await call('/api/admin/verify', { user_id: id, verified: to }); load(); };
  return <Table rows={rows} cols={[['Name', r => r.name], ['Phone', r => r.phone], ['Role', r => <span className="pill">{r.role}</span>], ['Business', r => r.business || ''], ['Village', r => r.village || ''], ['Joined', r => when(r.created_at)],
    ['Status', r => r.role !== 'buyer' ? '' : r.verified ? <><span className="pill">approved</span> <button className="act" onClick={() => verify(r.id, false)}>Revoke</button></> : <><span className="pill warn">pending</span> <button className="act" data-testid="approve" onClick={() => verify(r.id, true)}>Approve</button></>]]} />;
}

function Csv({ call, what }) {
  const dl = async () => { const blob = await (await call(`/api/admin/export/${what}.csv`)).blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = what + '.csv'; a.click(); };
  return <p><button className="act" onClick={dl}>Download {what}.csv</button></p>;
}

function Cases({ call, names }) {
  const [rows, setRows] = useState([]), [img, setImg] = useState(null);
  useEffect(() => { call('/api/admin/cases').then(r => r.json()).then(d => setRows(d.cases)).catch(() => {}); }, [call]);
  const show = async id => { const blob = await (await call('/api/admin/image/' + id)).blob(); setImg(URL.createObjectURL(blob)); };
  return (
    <>
      <Csv call={call} what="cases" />
      <Table rows={rows} cols={[['When', r => when(r.created_at)], ['Farmer', r => r.farmer], ['Crop', r => r.crop || 'other'], ['Source', r => r.source], ['Result', r => names[r.problem_id] || r.problem_id || '—'],
        ['Confidence', r => r.confidence != null ? Math.round(r.confidence * 100) + '%' : ''], ['Status', r => <span className={'pill ' + (r.status === 'done' ? '' : 'warn')}>{r.status}</span>], ['Photo', r => r.has_image ? <button className="act" onClick={() => show(r.id)}>View</button> : '']]} />
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="Case photo" /></div>}
    </>
  );
}

function Simple({ call, what, cols }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { call('/api/admin/' + what).then(r => r.json()).then(d => setRows(d[what])).catch(() => {}); }, [call, what]);
  return <><Csv call={call} what={what} /><Table rows={rows} cols={cols} /></>;
}

const TABS = ['overview', 'users', 'cases', 'listings', 'requests'];

function Admin() {
  const { token, setToken, call } = useApi();
  const [tab, setTab] = useState('overview'), [names, setNames] = useState({});
  useEffect(() => { fetch('/data/kb.json').then(r => r.json()).then(k => setNames(Object.fromEntries(k.problems.map(p => [p.id, p.en])))).catch(() => {}); }, []);
  if (!token) return <Login onToken={setToken} />;
  return (
    <>
      <header><h1>Kisan Setu · Control room</h1><button onClick={() => { sessionStorage.removeItem('ks_admin'); setToken(null); }}>Log out</button></header>
      <main>
        <nav>{TABS.map(k => <button key={k} data-t={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{k[0].toUpperCase() + k.slice(1)}</button>)}</nav>
        {tab === 'overview' && <Overview call={call} names={names} />}
        {tab === 'users' && <Users call={call} />}
        {tab === 'cases' && <Cases call={call} names={names} />}
        {tab === 'listings' && <Simple call={call} what="listings" cols={[['When', r => when(r.created_at)], ['Farmer', r => r.farmer], ['Phone', r => r.phone], ['Crop', r => r.crop], ['Quintal', r => r.qty_qtl], ['Ask ₹/q', r => r.price_expected || ''], ['Village', r => r.village || ''], ['Ready', r => r.ready_date || '']]} />}
        {tab === 'requests' && <Simple call={call} what="requests" cols={[['When', r => when(r.created_at)], ['Farmer', r => r.farmer], ['Phone', r => r.phone], ['Kind', r => <span className="pill">{r.kind.replace('_', ' ')}</span>], ['To', r => r.target_name || ''], ['Details', r => Object.entries(JSON.parse(r.payload || '{}')).map(([k, v]) => k + ': ' + v).join(', ')]]} />}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Admin />);
