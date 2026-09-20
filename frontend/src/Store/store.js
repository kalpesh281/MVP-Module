import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { persistStorage } from '../utils/persistStorage';

import scanReducer from '../Features/scanSlice';
import simulatorReducer from '../Features/simulatorSlice';
import uiReducer from '../Features/uiSlice';

// Only the UI preferences are persisted.
//
// A scan result is deliberately NOT persisted. Findings go stale — a
// domain rescanned tomorrow may be a different grade — and restoring
// yesterday's result from disk would present stale findings as live,
// which is the one thing the product must never do. The backend's 6-hour
// cache is the correct place for that, and it labels results with their
// age. docs/database.md section 5
const uiPersist = {
  key: 'ui',
  storage: persistStorage,
  whitelist: ['recentDomains'],
};

export const store = configureStore({
  reducer: {
    scan: scanReducer,
    simulator: simulatorReducer,
    ui: persistReducer(uiPersist, uiReducer),
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/FLUSH',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    }),
});

export const persistor = persistStore(store);
