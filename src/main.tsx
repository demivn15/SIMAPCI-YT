import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ensureFloatingSchoolLogosDecoded } from './assets/schoolLogos';
import './index.css';

// The seven logos alone gate the welcome; the two leading mascots download concurrently.
void ensureFloatingSchoolLogosDecoded();

createRoot(document.getElementById('root')!).render(<App />);
