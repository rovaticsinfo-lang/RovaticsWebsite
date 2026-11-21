/* Optional TURN relay for Card Clash online rooms.
 *
 * Two phones on different mobile networks (carrier-grade NAT) often cannot reach each other directly; a TURN relay
 * fixes that. Public free relays come and go, so you add your own credentials here (free tier at https://www.metered.ca/ ,
 * or Cloudflare / Twilio). Example:
 *
 *   window.RV_ICE_SERVERS = [
 *     { urls: 'turn:global.relay.metered.ca:80',                 username: 'YOUR_USER', credential: 'YOUR_PASS' },
 *     { urls: 'turn:global.relay.metered.ca:443?transport=tcp',  username: 'YOUR_USER', credential: 'YOUR_PASS' },
 *     { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'YOUR_USER', credential: 'YOUR_PASS' }
 *   ];
 *
 * Leave empty to use Google's free STUN only (works when both phones share a Wi-Fi or have ordinary home routers).
 */
window.RV_ICE_SERVERS = [];
