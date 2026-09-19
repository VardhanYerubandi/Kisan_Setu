import { useRef, useState } from 'react';
import { useApp } from '../core/store.jsx';
import { EMOJI, ALL_CROPS, inr, reducedMotion } from '../core/util.js';
import { Icon } from './Icon.jsx';

/** Bridge (setu) arc: the brand mark. */
export function Mark({ size = 34 }) {
  return (
    <svg className="mark" width={size} height={size * 0.62} viewBox="0 0 60 37" aria-hidden="true">
      <path d="M3 30 Q30 -8 57 30" pathLength="1" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {[13, 21, 30, 39, 47].map(x => { const u = (x - 3) / 54, y = (1 - u) ** 2 * 30 + 2 * (1 - u) * u * -8 + u * u * 30; return <line key={x} x1={x} y1={y + 1} x2={x} y2="30" stroke="currentColor" strokeWidth="2" opacity=".7" />; })}
      <line x1="0" y1="30" x2="60" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Thin bridge divider that draws itself under screen titles. */
export function Bridge() {
  const hangers = Array.from({ length: 15 }, (_, i) => { const u = (i + 1) / 16, x = u * 320, y = (1 - u) ** 2 * 34 + 2 * (1 - u) * u * -4 + u * u * 34; return <line key={i} x1={x} y1={y} x2={x} y2="34" />; });
  return (
    <svg className="bridge" viewBox="0 0 320 38" preserveAspectRatio="none" aria-hidden="true">
      <path className="b-arc" pathLength="1" d="M0 34 Q160 -4 320 34" />
      <g className="b-hang">{hangers}</g>
      <line className="b-deck" x1="0" y1="34" x2="320" y2="34" />
    </svg>
  );
}

/** Sun or moon orb that follows the phone clock. */
export function TimeOrb() {
  const h = new Date().getHours() + new Date().getMinutes() / 60, night = h < 5.5 || h >= 19;
  return <span className={'orb ' + (night ? 'night' : h < 8 ? 'dawn' : h < 16 ? 'day' : 'dusk')} aria-hidden="true"><i /></span>;
}

/** 3D tilt with a glare that follows the pointer (mouse and pen only; touch gets a press effect from CSS). */
export function Tilt({ as: Tag = 'div', className = '', children, max = 8, ...rest }) {
  const ref = useRef(null);
  const move = e => {
    if (e.pointerType === 'touch' || reducedMotion() || !ref.current) return;
    const r = ref.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, s = ref.current.style;
    s.setProperty('--rx', ((0.5 - y) * max).toFixed(2) + 'deg'); s.setProperty('--ry', ((x - 0.5) * max).toFixed(2) + 'deg');
    s.setProperty('--gx', (x * 100).toFixed(0) + '%'); s.setProperty('--gy', (y * 100).toFixed(0) + '%');
  };
  const leave = () => { const s = ref.current && ref.current.style; if (s) { s.setProperty('--rx', '0deg'); s.setProperty('--ry', '0deg'); } };
  return <Tag ref={ref} className={'tilt ' + className} onPointerMove={move} onPointerLeave={leave} {...rest}>{children}<i className="glare" /></Tag>;
}

/** Confidence ring: the arc sweeps to the value; the words say what it means. */
export function Ring({ level, pct, label }) {
  const cls = level === 'high' ? '' : level === 'med' ? 'med' : 'low';
  return (
    <div className={'ring ' + cls} role="img" aria-label={label}>
      <svg viewBox="0 0 44 44"><circle className="tr" cx="22" cy="22" r="18" /><circle className="fg" cx="22" cy="22" r="18" pathLength="100" strokeDasharray={`${pct} 100`} /></svg>
      <span>{label}</span>
    </div>
  );
}

export function Spark({ series, up }) {
  if (!series || series.length < 2) return null;
  const w = 84, h = 28, mn = Math.min(...series), mx = Math.max(...series), rg = mx - mn || 1;
  const pts = series.map((v, i) => `${(i * (w - 4) / (series.length - 1) + 2).toFixed(1)},${(h - 3 - (v - mn) / rg * (h - 6)).toFixed(1)}`).join(' ');
  const rising = up != null ? up : series[series.length - 1] >= series[0];
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><polyline pathLength="100" points={pts} className={rising ? 'up' : 'down'} /></svg>;
}

export const pctChange = series => (series && series.length > 1 ? Math.round((series[series.length - 1] - series[0]) / series[0] * 100) : null);

/** Scrubbable area chart: drag a finger or the mouse across it to read each day's price. */
export function AreaChart({ series, labels }) {
  const [idx, setIdx] = useState(null);
  const ref = useRef(null);
  if (!series || series.length < 2) return null;
  const W = 320, H = 130, pad = 14, mn = Math.min(...series) * 0.985, mx = Math.max(...series) * 1.015, rg = mx - mn || 1;
  const X = i => pad + i * (W - 2 * pad) / (series.length - 1), Y = v => H - 22 - (v - mn) / rg * (H - 48);
  const line = series.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(series.length - 1)} ${H - 22} L${X(0)} ${H - 22} Z`;
  const act = idx == null ? series.length - 1 : idx;
  const pick = e => { const r = ref.current.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; setIdx(Math.max(0, Math.min(series.length - 1, Math.round((x - pad) / ((W - 2 * pad) / (series.length - 1)))))); };
  return (
    <div className="chart" data-testid="area-chart">
      <div className="chart-val"><b>{inr(series[act])}</b><span>{labels ? labels[act] : ''}</span></div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setIdx(null)} role="img" aria-label="price chart">
        <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--lime)" stopOpacity=".55" /><stop offset="1" stopColor="var(--lime)" stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#ag)" className="c-area" /><path d={line} className="c-line" pathLength="100" />
        <line x1={X(act)} y1="8" x2={X(act)} y2={H - 22} className="c-cross" />
        <circle cx={X(act)} cy={Y(series[act])} r="5.5" className="c-dot" />
        {labels && [0, Math.floor(series.length / 2), series.length - 1].map(i => <text key={i} x={X(i)} y={H - 4} textAnchor={i === 0 ? 'start' : i === series.length - 1 ? 'end' : 'middle'} className="c-lab">{labels[i]}</text>)}
      </svg>
    </div>
  );
}

/** Scrolling best-price-per-crop ticker (sample data is tagged). */
export function Ticker({ rows }) {
  const { t } = useApp();
  const items = ALL_CROPS.map(c => {
    const r = rows.filter(x => x.crop === c).sort((a, b) => b.modal - a.modal)[0]; if (!r) return null;
    const ch = pctChange(r.trend);
    return <span className="it" key={c}>{EMOJI[c]} {t('crop_' + c)} <b>{inr(r.modal)}</b>{ch != null && <span className={ch >= 0 ? 'up' : 'down'}>{ch >= 0 ? '▲' : '▼'}{Math.abs(ch)}%</span>}</span>;
  }).filter(Boolean);
  if (!items.length) return null;
  const tag = rows.some(r => r.source === 'sample') ? <span className="it"><span className="tag sample">{t('sample_tag')}</span></span> : null;
  return <div className="ticker" aria-label={t('prices_title')}><div className="ticker-track">{tag}{items}{tag}{items}</div></div>;
}

export function Chips({ items, value, onPick, all }) {
  return (
    <div className="chips">
      {items.map(c => <button key={c.v} data-testid={'chip-' + c.v} className={'chip' + (value === c.v ? ' on' : '')} onClick={() => onPick(c.v)}>{c.l}</button>)}
    </div>
  );
}

export function Empty({ text, action }) {
  return <div className="empty"><Icon name="wheat" size={38} /><p>{text}</p>{action}</div>;
}
