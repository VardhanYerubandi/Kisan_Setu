import { useEffect, useState } from 'react';
import { inr, reducedMotion } from '../core/util.js';

/** Price that counts up from 88% to its value. Always ends on the exact number, even if animation frames are throttled. */
export default function Num({ value, ...rest }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (reducedMotion() || !(value > 0)) { setV(value); return undefined; }
    let raf, t0 = null; const from = Math.round(value * 0.88);
    const step = now => { if (t0 == null) t0 = now; const k = Math.min(1, (now - t0) / 520); setV(from + (value - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(step); };
    setV(from); raf = requestAnimationFrame(step);
    const fin = setTimeout(() => setV(value), 700);
    return () => { cancelAnimationFrame(raf); clearTimeout(fin); };
  }, [value]);
  return <span {...rest}>{inr(v)}</span>;
}
