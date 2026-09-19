import { useApp } from '../core/store.jsx';
import { haversine } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import Head from '../ui/Head.jsx';

export default function Place() {
  const { t, boot, setPos, notify } = useApp();
  const places = boot.seed.places;
  const done = () => history.back();
  const gps = () => {
    if (!navigator.geolocation) return notify(t('err_generic'));
    navigator.geolocation.getCurrentPosition(p => {
      const me = { lat: p.coords.latitude, lng: p.coords.longitude };
      let best = null; for (const [n, c] of Object.entries(places)) { const d = haversine(me, c); if (!best || d < best[0]) best = [d, n]; }
      setPos({ ...me, name: best ? best[1] : '' }); done();
    }, () => notify(t('or_city')), { timeout: 10000, maximumAge: 600000 });
  };
  return (
    <>
      <Head title={t('set_place')} />
      <div className="pad">
        <button className="btn gold" data-testid="gps" onClick={gps}><Icon name="pin" />{t('use_gps')}</button>
        <div className="or"><span>{t('or_city')}</span></div>
        <div className="citygrid">
          {Object.keys(places).map(n => <button key={n} data-testid={'city-' + n} onClick={() => { setPos({ lat: places[n].lat, lng: places[n].lng, name: n }); done(); }}>{n}</button>)}
        </div>
      </div>
    </>
  );
}
