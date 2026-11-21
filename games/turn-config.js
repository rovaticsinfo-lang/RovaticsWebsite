/* TURN relay for Card Clash online rooms (Metered).
 *
 * Two phones on different mobile networks (carrier-grade NAT) often cannot reach each other directly; the relay fixes that.
 * Replace the username/credential below if you rotate them in the Metered dashboard, then run
 *   node android/arcade/sync-assets.js
 * and rebuild the app. Note: these values are visible to anyone who opens the game, so use a free-tier key and rotate it if abused.
 */
window.RV_ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80',                  username: 'c76c0020b1857c1b46743def', credential: 'rywPwIQP6bQsAjOM' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp',    username: 'c76c0020b1857c1b46743def', credential: 'rywPwIQP6bQsAjOM' },
  { urls: 'turn:global.relay.metered.ca:443',                 username: 'c76c0020b1857c1b46743def', credential: 'rywPwIQP6bQsAjOM' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp',  username: 'c76c0020b1857c1b46743def', credential: 'rywPwIQP6bQsAjOM' }
];
