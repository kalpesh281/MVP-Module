import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import App from './App.jsx';
import { store, persistor } from './Store/store.js';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      {/* null loading: the only persisted state is a theme preference and a
          recent-domains list. Blocking first paint on localStorage for that
          would be a white flash in exchange for nothing. */}
      <PersistGate loading={null} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  </StrictMode>,
);
