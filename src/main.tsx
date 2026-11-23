import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('clavehogar:pwa-offline-ready'));
  },
});

createRoot(document.getElementById('root')!).render(<App />);
