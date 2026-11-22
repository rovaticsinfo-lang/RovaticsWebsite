/* Rovatics Game Zone: player profile and per-game save storage. Every game gets its own namespaced slot; failures never throw. */
const PREFIX = 'rovatics.gz.';
const mem = {};
function raw(key) { try { return localStorage.getItem(PREFIX + key); } catch (e) { return mem[key] ?? null; } }
function put(key, val) { try { localStorage.setItem(PREFIX + key, val); } catch (e) { mem[key] = val; } }

export const Store = {
  load(key, fallback) { try { const s = raw(key); return s ? JSON.parse(s) : fallback; } catch (e) { console.warn('[gz] save damaged:', key, e); return fallback; } },
  save(key, value) { try { put(key, JSON.stringify(value)); return true; } catch (e) { console.warn('[gz] save failed:', key, e); return false; } },
  /* The player profile belongs to the platform and is shared by every Rovatics game. */
  profile() { const p = Store.load('profile', null) || { name: 'Wayfinder', color: '#ffb347', created: Date.now(), seconds: 0 }; return p; },
  saveProfile(p) { Store.save('profile', p); }
};
