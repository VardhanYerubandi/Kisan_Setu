import { useApp } from '../core/store.jsx';
import { screenText, speak } from '../core/speech.js';
import { Icon } from './Icon.jsx';
import { Bridge } from './parts.jsx';

export function ListenButton() {
  const { lang, notify, t } = useApp();
  return <button className="ib" data-testid="tool-speak" aria-label={t('listen')} onClick={() => { if (!speak(screenText(), lang)) notify(t('err_generic')); }}><Icon name="speaker" /></button>;
}

/** Sticky screen header: back, title, listen, language, and the bridge divider that draws itself. */
export default function Head({ title, back = true }) {
  const { t } = useApp();
  return (
    <header className="head">
      <div className="head-row">
        {back && <button className="ib" data-testid="back" aria-label={t('back')} onClick={() => (history.length > 1 ? history.back() : (location.hash = '#/home'))}><Icon name="back" /></button>}
        <h1>{title}</h1>
        <ListenButton />
        <a className="ib" href="#/lang" data-testid="head-lang" aria-label={t('language')}><Icon name="globe" /></a>
      </div>
      <Bridge />
    </header>
  );
}
