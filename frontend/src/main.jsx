import { createRoot } from 'react-dom/client';
import './base.css';
import './screens.css';
import { AppProvider } from './core/store.jsx';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<AppProvider><App /></AppProvider>);
