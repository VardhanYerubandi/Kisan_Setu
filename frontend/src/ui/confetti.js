import { reducedMotion } from '../core/util.js';

/** Pure-JS confetti burst used when produce is posted. No libraries. */
export function confetti() {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:200';
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const g = c.getContext('2d'), colors = ['#c8f169', '#ffb800', '#2fbf71', '#ffffff', '#8fd3ff'];
  const ps = Array.from({ length: 90 }, () => ({ x: c.width / 2, y: c.height * 0.62, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 15 - 4, s: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: colors[(Math.random() * colors.length) | 0] }));
  let t0 = null;
  const step = now => {
    if (t0 == null) t0 = now;
    const el = now - t0; g.clearRect(0, 0, c.width, c.height);
    ps.forEach(p => { p.vy += 0.42; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - el / 1700); g.fillStyle = p.col; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); });
    if (el < 1700) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
