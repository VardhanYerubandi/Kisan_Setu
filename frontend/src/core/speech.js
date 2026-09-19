import { ALL_CROPS, LOCALE } from './util.js';

export const canSpeak = () => 'speechSynthesis' in window;
export function speak(text, lang) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' ').slice(0, 900));
  u.lang = LOCALE[lang] || 'en-IN'; u.rate = 0.9;
  speechSynthesis.speak(u);
  return true;
}
/** Reads elements marked data-say, or falls back to the visible page text. */
export function screenText() {
  const marked = [...document.querySelectorAll('.page [data-say]')].map(e => e.innerText);
  const page = document.querySelector('.page');
  return marked.length ? marked.join('. ') : page ? page.innerText : '';
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!SR;
/** Voice crop pick: matches the spoken words against crop names in every language. */
export function listenCrop(i18n, lang, onCrop, onFail) {
  if (!SR) return onFail();
  const r = new SR(); r.lang = LOCALE[lang] || 'en-IN'; r.maxAlternatives = 3;
  r.onresult = e => {
    for (const a of e.results[0]) {
      const said = a.transcript.toLowerCase();
      for (const c of ALL_CROPS) for (const l in i18n) { const n = (i18n[l]['crop_' + c] || '').toLowerCase(); if (n && said.includes(n)) return onCrop(c); }
    }
    onFail();
  };
  r.onerror = () => onFail();
  try { r.start(); } catch (_) { onFail(); }
}
