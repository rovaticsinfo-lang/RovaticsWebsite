/* Rovatics Game Zone game registry. To add a game: append an entry here. Nothing else in the platform mentions a specific game.
   kind 'module': a game module with { mount(host), unmount(), summary(Store) } loaded on demand.  kind 'link': a standalone page. */
export const GAMES = [
  {
    id: 'parallax', kind: 'module', featured: true, title: 'PARALLAX', subtitle: 'The Laws of the Lost Universe', accent: '#ffb347',
    tagline: 'A cinematic 3D puzzle adventure. Five worlds, 100 handcrafted laws to rediscover.',
    about: 'Travel with LUMA, your survey drone, through five fractured worlds: ancient architecture, gravity foundries, a living abyss, a time-broken city and the infinite paradox. Every one of the 100 levels is a real, solvable mechanism: route channels, tilt gravity, steer light, balance pressure, cooperate with your own echo and trace causal circuits. Free hints, undo, checkpoints, no timers, no ads.',
    features: ['5 worlds · 100 levels', 'Offline, free hints, undo and checkpoints', 'Touch, mouse and keyboard', 'Cosmetics earned by play only'],
    loader: () => import('../px/game.js'), cover: r => import('../px/cover.js').then(m => m.renderCover(r))
  },
  {
    id: 'devilhunters', kind: 'link', title: 'Devil Hunters', subtitle: 'Crowd Rush', accent: '#ff5a3c', href: 'crowd-rush.html',
    tagline: 'Lead a running crowd over curving roads and hunt down beasts, devils and the Devil King.',
    about: 'A 3D crowd runner with real running people, guns, bombs and long hilly levels in eight real-world settings.', features: ['Endless variety', 'Touch and keyboard'],
    art: 'radial-gradient(120% 90% at 70% 20%, #ff9a4a 0%, #7a1d12 45%, #12060a 100%)', emoji: '👹'
  }
];
