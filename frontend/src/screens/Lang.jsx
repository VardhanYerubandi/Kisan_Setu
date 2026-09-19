import { useApp } from '../core/store.jsx';
import { LANG_LABEL } from '../core/util.js';
import { Mark } from '../ui/parts.jsx';
import Head from '../ui/Head.jsx';

export default function Lang() {
  const { t, lang, setLang } = useApp();
  return (
    <>
      {lang ? <Head title={t('choose_lang')} /> : (
        <div className="hello">
          <Mark size={78} />
          <h1>{t('app_name')}</h1>
          <p>{t('tagline')}</p>
        </div>
      )}
      <div className="pad">
        <h2 data-say>{t('choose_lang')}</h2>
        <div className="langs">
          {Object.entries(LANG_LABEL).map(([l, label]) => (
            <button key={l} lang={l} data-testid={'lang-' + l} className={l === lang ? 'on' : ''} onClick={() => { setLang(l); location.hash = '#/home'; }}>{label}</button>
          ))}
        </div>
      </div>
    </>
  );
}
