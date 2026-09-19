import { useEffect, useState } from 'react';
import { useApp } from './core/store.jsx';
import Shell from './ui/Shell.jsx';
import { Mark } from './ui/parts.jsx';
import Home from './screens/Home.jsx';
import Lang from './screens/Lang.jsx';
import { ScanCrop, ScanPhoto, ScanSymptoms } from './screens/Scan.jsx';
import Result from './screens/Result.jsx';
import Prices from './screens/Prices.jsx';
import Place from './screens/Place.jsx';
import { Buyers, Storage } from './screens/Directory.jsx';
import Transport from './screens/Transport.jsx';
import Sell from './screens/Sell.jsx';
import { Cases, Produce } from './screens/Lists.jsx';
import Profile from './screens/Profile.jsx';

function useRoute() {
  const [h, setH] = useState(location.hash);
  useEffect(() => { const f = () => setH(location.hash); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const [path, qs] = (h.slice(1) || '/home').split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', parts: parts.slice(1), query: new URLSearchParams(qs || ''), key: path };
}

function Splash() {
  return <div className="splash"><Mark size={96} /><b>Kisan Setu</b></div>;
}

const NAMES = { home: Home, lang: Lang, prices: Prices, place: Place, buyers: Buyers, storage: Storage, transport: Transport, sell: Sell, cases: Cases, produce: Produce, profile: Profile, result: Result };

export default function App() {
  const { ready, bootError, lang } = useApp();
  const route = useRoute();
  useEffect(() => { if (ready && !lang && route.name !== 'lang') location.hash = '#/lang'; }, [ready, lang, route.name]);
  if (bootError) return <div className="splash"><Mark size={70} /><p style={{ padding: 24, textAlign: 'center' }}>Open Kisan Setu once with internet so it can be saved on your phone.</p></div>;
  if (!ready) return <Splash />;
  let Screen = NAMES[route.name] || Home;
  if (route.name === 'scan') Screen = route.parts[0] === 'photo' ? ScanPhoto : route.parts[0] === 'symptoms' ? ScanSymptoms : ScanCrop;
  return (
    <Shell name={route.name} chrome={route.name !== 'lang' || !!lang}>
      <div className="page" key={route.key}><Screen route={route} /></div>
    </Shell>
  );
}
