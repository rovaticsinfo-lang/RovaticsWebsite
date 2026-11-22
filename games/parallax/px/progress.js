/* PARALLAX progression, rewards, achievements and cosmetics. Pure functions over a plain save object, so they are unit-tested. */
export const SAVE_VERSION = 2;

export const defaultSave = () => ({
  v: SAVE_VERSION, coins: 0, levels: {}, lore: [], ach: {}, owned: ['shell_amber', 'trail_none', 'skin_parchment'],
  equipped: { shell: 'shell_amber', trail: 'trail_none', skin: 'skin_parchment' },
  stats: { moves: 0, hints: 0, undos: 0, restarts: 0, seconds: 0, plays: 0 }, checkpoints: {}, seenIntro: false,
  settings: { quality: 'auto', music: 0.6, sfx: 0.9, reduceMotion: false, contrast: false, textScale: 1, captions: true }
});

/* Old or damaged saves are repaired rather than rejected. */
export function migrate(raw) {
  const d = defaultSave(); if (!raw || typeof raw !== 'object') return d;
  const s = { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) }, stats: { ...d.stats, ...(raw.stats || {}) }, equipped: { ...d.equipped, ...(raw.equipped || {}) } };
  if (!s.levels || typeof s.levels !== 'object') s.levels = {}; if (!Array.isArray(s.lore)) s.lore = []; if (!Array.isArray(s.owned)) s.owned = d.owned;
  d.owned.forEach(o => { if (!s.owned.includes(o)) s.owned.push(o); }); if (!s.checkpoints || typeof s.checkpoints !== 'object') s.checkpoints = {}; if (!s.ach) s.ach = {};
  s.coins = Math.max(0, Math.floor(+s.coins || 0)); s.v = SAVE_VERSION; return s;
}

export const isDone = (save, n) => !!(save.levels[n] && save.levels[n].done);
export const isUnlocked = (save, n) => n === 1 || isDone(save, n - 1);
export const levelsDone = save => Object.values(save.levels).filter(l => l.done).length;
export const worldDone = (save, w) => { for (let n = (w - 1) * 20 + 1; n <= w * 20; n++) if (!isDone(save, n)) return false; return true; };
export const nextLevel = save => { for (let n = 1; n <= 100; n++) if (!isDone(save, n)) return n; return 100; };
export const totalStars = save => Object.values(save.levels).reduce((a, l) => a + (l.stars || 0), 0);

/* Stars: 1 = solved, 2 = solved without hints, 3 = also within 25% of the solver's own move count. */
export function starsFor({ moves, par, hints }) { let s = 1; if (!hints) { s = 2; if (moves <= Math.ceil(par * 1.25) + 1) s = 3; } return s; }

/* Coins. Everything is paid once per level: the first solve pays completion + tier; mastery and discovery pay the first time they are earned. A repeat pays a small token. */
export function calcReward(brief, prev, run) {
  const stars = starsFor(run), r = { stars, completion: 0, tier: 0, mastery: 0, discovery: 0, replay: 0 };
  const done = !!(prev && prev.done);
  if (!done) { r.completion = brief.rewards.coins; r.tier = brief.rewards.tier; } else r.replay = 10;
  if (stars === 3 && !(prev && prev.stars === 3)) r.mastery = brief.rewards.mastery;
  if (run.discovered && !(prev && prev.discovered)) r.discovery = brief.rewards.discovery;
  r.total = r.completion + r.tier + r.mastery + r.discovery + r.replay; return r;
}

/* Records a finished level into the save and returns the reward. */
export function completeLevel(save, brief, run) {
  const prev = save.levels[brief.n], rw = calcReward(brief, prev, run);
  const bestStars = Math.max(rw.stars, prev ? prev.stars || 0 : 0);
  save.levels[brief.n] = { done: true, stars: bestStars, moves: prev && prev.moves ? Math.min(prev.moves, run.moves) : run.moves, hints: prev && prev.done ? Math.min(prev.hints, run.hints) : run.hints,
    seconds: Math.round(run.seconds || 0), discovered: !!(run.discovered || (prev && prev.discovered)), noHint: !!(run.hints === 0 || (prev && prev.noHint)) };
  if (run.discovered && !save.lore.includes(brief.n)) save.lore.push(brief.n);
  save.coins += rw.total; save.stats.moves += run.moves; save.stats.hints += run.hints; save.stats.seconds += Math.round(run.seconds || 0); save.stats.plays++;
  delete save.checkpoints[brief.n];
  return rw;
}

export const ACHIEVEMENTS = [
  { id: 'first', name: 'First Light', desc: 'Solve your first level.', coins: 50, test: s => levelsDone(s) >= 1 },
  { id: 'ten', name: 'Ten Doors Open', desc: 'Solve 10 levels.', coins: 100, test: s => levelsDone(s) >= 10 },
  { id: 'fifty', name: 'Halfway Home', desc: 'Solve 50 levels.', coins: 300, test: s => levelsDone(s) >= 50 },
  { id: 'hundred', name: 'The Last Law', desc: 'Solve all 100 levels.', coins: 1000, test: s => levelsDone(s) >= 100 },
  ...[1, 2, 3, 4, 5].map(w => ({ id: 'world' + w, name: ['Architect', 'Gravity Smith', 'Abyss Walker', 'Time Weaver', 'Paradox Master'][w - 1], desc: 'Complete world ' + w + '.', coins: 150 + w * 50, test: s => worldDone(s, w) })),
  { id: 'clear', name: 'Clear Mind', desc: 'Solve 10 levels without any hint.', coins: 100, test: s => Object.values(s.levels).filter(l => l.done && l.noHint).length >= 10 },
  { id: 'stars30', name: 'Constellation', desc: 'Collect 30 stars.', coins: 120, test: s => totalStars(s) >= 30 },
  { id: 'stars150', name: 'Night Sky', desc: 'Collect 150 stars.', coins: 300, test: s => totalStars(s) >= 150 },
  { id: 'lore10', name: 'Lorekeeper', desc: 'Find 10 lore fragments.', coins: 100, test: s => s.lore.length >= 10 },
  { id: 'lore50', name: 'Archivist', desc: 'Find 50 lore fragments.', coins: 300, test: s => s.lore.length >= 50 },
  { id: 'rewind', name: 'Second Thoughts', desc: 'Use undo 10 times. Mistakes are how laws are found.', coins: 40, test: s => s.stats.undos >= 10 },
  { id: 'rich', name: 'Collector', desc: 'Own 5 cosmetic items.', coins: 60, test: s => s.owned.length >= 8 }
];
/* Returns newly earned achievements (and credits their coins). */
export function checkAchievements(save, now = Date.now()) {
  const out = []; for (const a of ACHIEVEMENTS) if (!save.ach[a.id] && a.test(save)) { save.ach[a.id] = now; save.coins += a.coins; out.push(a); } return out;
}

/* Cosmetics are earned with coins only. Nothing here changes gameplay. */
export const COSMETICS = [
  { id: 'shell_amber', kind: 'shell', name: 'Amber Shell', price: 0, c1: '#ffb347', c2: '#fff1c9' },
  { id: 'shell_tide', kind: 'shell', name: 'Tide Shell', price: 250, c1: '#3fd3e0', c2: '#d6fbff' },
  { id: 'shell_ember', kind: 'shell', name: 'Ember Shell', price: 400, c1: '#ff5a3c', c2: '#ffd2a0' },
  { id: 'shell_aurora', kind: 'shell', name: 'Aurora Shell', price: 650, c1: '#9d7bff', c2: '#7dffc9' },
  { id: 'shell_void', kind: 'shell', name: 'Void Shell', price: 900, c1: '#1b1038', c2: '#e0a8ff' },
  { id: 'trail_none', kind: 'trail', name: 'No Trail', price: 0 },
  { id: 'trail_sparks', kind: 'trail', name: 'Spark Trail', price: 200, color: '#ffd27a' },
  { id: 'trail_ribbon', kind: 'trail', name: 'Ribbon Trail', price: 450, color: '#7af0ff' },
  { id: 'trail_stars', kind: 'trail', name: 'Star Trail', price: 700, color: '#ffffff' },
  { id: 'skin_parchment', kind: 'skin', name: 'Parchment Journal', price: 0, bg: '#2a2218', fg: '#f2e4c0' },
  { id: 'skin_basalt', kind: 'skin', name: 'Basalt Journal', price: 300, bg: '#1b1e24', fg: '#cfd6e2' },
  { id: 'skin_glass', kind: 'skin', name: 'Glass Journal', price: 600, bg: '#0e2a33', fg: '#bff4ff' }
];
export function buy(save, id) {
  const it = COSMETICS.find(c => c.id === id); if (!it) return { ok: false, why: 'unknown item' };
  if (save.owned.includes(id)) return { ok: false, why: 'already owned' };
  if (save.coins < it.price) return { ok: false, why: 'not enough coins' };
  save.coins -= it.price; save.owned.push(id); return { ok: true };
}
export function equip(save, id) { const it = COSMETICS.find(c => c.id === id); if (!it || !save.owned.includes(id)) return false; save.equipped[it.kind] = id; return true; }
