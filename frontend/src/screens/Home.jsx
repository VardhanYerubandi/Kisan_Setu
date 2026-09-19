import { useMemo } from 'react';
import { useApp, useDirectory, useLocalList } from '../core/store.jsx';
import { EMOJI, inr, roadKm } from '../core/util.js';
import { Icon } from '../ui/Icon.jsx';
import { ListenButton } from '../ui/Head.jsx';
import { Mark, Spark, Tilt, TimeOrb, Ticker, pctChange } from '../ui/parts.jsx';

export default function Home() {
  const { t, user, pos, toggleTheme, dark, boot } = useApp();
  const prices = useDirectory('prices'), storage = useDirectory('storage'), buyers = useDirectory('buyers');
  const cases = useLocalList('cases'), listings = useLocalList('listings');
  const buyer = user && user.role === 'buyer';
  const h = new Date().getHours(), greet = t(h < 12 ? 'g_morning' : h < 16 ? 'g_afternoon' : h < 20 ? 'g_evening' : 'g_night');

  const top = useMemo(() => prices.rows.filter(r => r.crop === 'chilli').sort((a, b) => b.modal - a.modal)[0], [prices.rows]);
  const nearStore = useMemo(() => {
    const rows = storage.rows.map(s => ({ ...s, d: roadKm(pos, s) }));
    return rows.sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9) || b.free_qtl - a.free_qtl)[0];
  }, [storage.rows, pos]);
  const rate = boot.seed.vehicle_rates.tempo.rate;

  return (
    <div className="home">
      <div className="home-top">
        <div className="brand-s"><Mark size={30} /><div><small data-say>{greet}</small><b>{user ? user.name : t('app_name')}</b></div></div>
        <div className="tools">
          <TimeOrb />
          <ListenButton />
          <a className="ib" href="#/lang" data-testid="tool-lang" aria-label={t('language')}><Icon name="globe" /></a>
          <button className="ib" data-testid="tool-theme" aria-label={t('theme')} onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} /></button>
        </div>
      </div>
      <h1 className="mega" data-say>{t('home_q')}</h1>
      <Ticker rows={prices.rows} />

      <div className="bento">
        {buyer ? (
          <Tilt as="a" href="#/produce" className="tile wide t-scan" data-testid="tile-produce"><span className="pulse-rings"><i /><i /><i /></span><Icon name="wheat" className="tic" /><b className="lb">{t('t_produce')}</b><Icon name="arrow" className="go" /></Tilt>
        ) : (
          <Tilt as="a" href="#/scan" className="tile wide t-scan" data-testid="tile-scan">
            <span className="pulse-rings"><i /><i /><i /></span>
            <span className="scan-ic"><Icon name="scan" /></span>
            <b className="lb">{t('t_scan')}</b><Icon name="arrow" className="go" />
          </Tilt>
        )}
        <Tilt as="a" href="#/prices" className="tile t-prices" data-testid="tile-prices">
          <span className="tl">{t('t_prices')}</span>
          {top ? <><span className="big">{inr(top.modal)}</span><span className="sub">{EMOJI.chilli} {t('crop_chilli')} · {top.market}</span><Spark series={top.trend} /></> : <Icon name="price" className="tic" />}
        </Tilt>
        {buyer ? (
          <Tilt as="a" href="#/storage" className="tile t-store" data-testid="tile-storage"><span className="tl">{t('t_storage')}</span><Icon name="snow" className="tic" />{nearStore && <span className="big">{nearStore.free_qtl}<small> q</small></span>}</Tilt>
        ) : (
          <Tilt as="a" href="#/sell" className="tile t-sell" data-testid="tile-sell"><span className="tl">{t('t_sell')}</span><Icon name="wheat" className="tic" /><span className="big">{listings ? listings.length : 0}</span></Tilt>
        )}
        {!buyer && (
          <Tilt as="a" href="#/buyers" className="tile t-buyers" data-testid="tile-buyers"><span className="tl">{t('t_buyers')}</span><Icon name="shop" className="tic" /><span className="big">{buyers.rows.length}</span></Tilt>
        )}
        {!buyer && (
          <Tilt as="a" href="#/storage" className="tile t-store" data-testid="tile-storage">
            <span className="tl">{t('t_storage')}</span><Icon name="snow" className="tic" />
            {nearStore && <span className="big">{nearStore.free_qtl}<small> q</small></span>}
            {nearStore && <span className="sub">{nearStore.place}{nearStore.d != null ? ' · ' + t('km_away', { d: nearStore.d }) : ''}</span>}
          </Tilt>
        )}
        <Tilt as="a" href="#/transport" className="tile wide t-truck" data-testid="tile-transport">
          <span className="road"><Icon name="truck" className="truck" /></span>
          <span className="tl">{t('t_transport')}</span>
          <span className="big">{inr(rate)}<small> / km</small></span>
        </Tilt>
        {!buyer && (
          <Tilt as="a" href="#/cases" className="tile t-cases" data-testid="tile-cases"><span className="tl">{t('t_cases')}</span><Icon name="clip" className="tic" /><span className="big">{cases ? cases.length : 0}</span></Tilt>
        )}
      </div>
      {(prices.rows.some(r => r.source === 'sample')) && <p className="fine">{t('sample_tag')}: {t('sample_note')}</p>}
    </div>
  );
}
