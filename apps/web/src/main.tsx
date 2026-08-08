import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/anybody';
import '@fontsource-variable/familjen-grotesk';
import '@fontsource-variable/spline-sans-mono';

import './styles/tokens.css';
import './styles/app.css';

import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
