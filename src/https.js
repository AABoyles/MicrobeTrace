// Sends a page served over plain HTTP to HTTPS (localhost, for development,
// stays as it is). The server redirects too (server.js); this covers static hosts.
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== 'https:') window.location.replace('https://' + window.location.hostname + window.location.pathname);
