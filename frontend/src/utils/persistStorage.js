/**
 * The storage engine redux-persist writes through.
 *
 * Not `redux-persist/lib/storage`. That module is CommonJS with an
 * `exports.default`, so the deep import resolves to `{ default: {...} }`
 * under Vite's ESM interop and every call lands on `undefined`:
 *
 *     Uncaught TypeError: storage.getItem is not a function
 *
 * redux-persist 6.0.0 has been unmaintained since 2019, so this will not
 * be fixed upstream. The interface it needs is three async methods, and
 * writing them here buys something the packaged engine does not do:
 * **it survives localStorage throwing.**
 *
 * That matters more than it sounds. Safari in private mode, a browser
 * with site data blocked, and some corporate managed profiles all throw
 * on `localStorage.getItem` rather than returning null. The packaged
 * engine lets that reject, which rejects the rehydrate, which — with a
 * PersistGate in the tree — is a blank page. For a theme preference.
 *
 * Nothing persisted here is load-bearing: a theme and a list of recently
 * checked domains. Losing them silently is the correct failure.
 */

const memory = new Map();

function backend() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Touch it — presence is not the same as permission.
    const probe = '__scorecard_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

const store = backend();

export const persistStorage = {
  getItem(key) {
    try {
      return Promise.resolve(store ? store.getItem(key) : (memory.get(key) ?? null));
    } catch {
      return Promise.resolve(null);
    }
  },

  setItem(key, value) {
    try {
      if (store) store.setItem(key, value);
      else memory.set(key, value);
    } catch {
      // Quota exceeded, or storage revoked mid-session. A preference we
      // could not save is not worth surfacing to anyone.
      memory.set(key, value);
    }
    return Promise.resolve();
  },

  removeItem(key) {
    try {
      if (store) store.removeItem(key);
      else memory.delete(key);
    } catch {
      memory.delete(key);
    }
    return Promise.resolve();
  },
};

export default persistStorage;
