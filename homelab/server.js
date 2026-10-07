/* Tiny dependency-free static file + JSON sync server for the homelab build of
 * Penny Keeper. Serves index.html (and anything else dropped next to it) and
 * gives GET/PUT/POST /data/penny-keeper-current.json a place to live on disk,
 * so the app can auto-load/auto-save across machines instead of manual export
 * and restore.
 *
 * This has no login of its own - it trusts whatever network it is bound to.
 * Put it behind your own reverse proxy / VPN / auth layer if it is reachable
 * from anywhere you would not also trust with the raw JSON file.
 *
 * AUTH_TOKEN sets a shared-secret check on top of that and is required: the
 * server refuses to start without it unless ALLOW_NO_AUTH=1 says you meant it.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'penny-keeper-current.json');
const DATA_URL_PATH = '/data/penny-keeper-current.json';
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';
const ALLOW_NO_AUTH = process.env.ALLOW_NO_AUTH === '1';
const MAX_BODY_BYTES = 25 * 1024 * 1024;              // generous ceiling for a full export

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Running with no token at all leaves the data file readable and writable by
// anything that can reach the port. That may be what you want on a trusted LAN,
// but it should be a deliberate choice rather than the default you get by
// forgetting to set a variable.
if (!AUTH_TOKEN && !ALLOW_NO_AUTH) {
  console.error('AUTH_TOKEN is not set.');
  console.error('Anyone who can reach this port could read and overwrite your data.');
  console.error('Set AUTH_TOKEN to a shared secret, or set ALLOW_NO_AUTH=1 to run without one.');
  process.exit(1);
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const AUTH_HEADER = Buffer.from('Bearer ' + AUTH_TOKEN, 'utf8');

function authOk(req) {
  if (!AUTH_TOKEN) return true;
  const supplied = req.headers['authorization'];
  if (typeof supplied !== 'string') return false;
  const given = Buffer.from(supplied, 'utf8');
  // timingSafeEqual throws on a length mismatch, so the lengths are compared
  // first. That leaks the token's length, which is not worth protecting; what
  // matters is not leaking its contents one byte at a time.
  if (given.length !== AUTH_HEADER.length) return false;
  return crypto.timingSafeEqual(given, AUTH_HEADER);
}

// Sent on every response, including the static files and the error paths.
// The CSP here carries frame-ancestors only: index.html ships its own meta CSP,
// and two policies both apply, so anything more here would intersect with it.
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "frame-ancestors 'none'"
};

const PUBLIC_DIR_PREFIX = PUBLIC_DIR.endsWith(path.sep) ? PUBLIC_DIR : PUBLIC_DIR + path.sep;
function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? 'index.html' : urlPath.slice(1);
  // Resolve then re-check against PUBLIC_DIR + a trailing separator (not a bare string prefix -
  // "startsWith(PUBLIC_DIR)" alone would wrongly accept a sibling dir like "../public-evil").
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR_PREFIX)) { res.writeHead(400); res.end('Bad path'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* The page will not sync with anything that does not send this header, which is what
 * lets the one index.html be served from GitHub Pages and from here: on a plain static
 * host the probe comes back without it and the page quietly stays on localStorage. It
 * goes on the 401 too, so a wrong AUTH_TOKEN surfaces as a sync error rather than
 * silently looking like an ordinary static host. */
const SYNC_HEADER = { 'X-Penny-Keeper-Sync': '1' };

function readData(req, res) {
  if (!authOk(req)) { res.writeHead(401, SYNC_HEADER); res.end('Unauthorized'); return; }
  fs.readFile(DATA_FILE, (err, data) => {
    if (err) {
      res.writeHead(404, Object.assign({ 'Content-Type': 'application/json' }, SYNC_HEADER));
      res.end('null'); return;
    }
    res.writeHead(200, Object.assign(
      { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, SYNC_HEADER));
    res.end(data);
  });
}

function writeData(req, res) {
  if (!authOk(req)) { res.writeHead(401, SYNC_HEADER); res.end('Unauthorized'); return; }
  let body = [];
  let total = 0;
  let tooLarge = false;
  req.on('data', chunk => {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) { tooLarge = true; req.destroy(); return; }
    body.push(chunk);
  });
  req.on('end', () => {
    if (tooLarge) { res.writeHead(413); res.end('Too large'); return; }
    const text = Buffer.concat(body).toString('utf8');
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { res.writeHead(400); res.end('Invalid JSON'); return; }
    // Sanity check the shape before ever touching disk - this file is the only backup some
    // people will have, so a stray malformed write should be rejected, not silently accepted.
    if (!parsed || typeof parsed !== 'object' || !parsed.years || typeof parsed.years !== 'object') {
      res.writeHead(422); res.end('Does not look like a Penny Keeper backup (missing "years")'); return;
    }
    const tmp = DATA_FILE + '.tmp-' + process.pid + '-' + Date.now();
    fs.writeFile(tmp, text, err => {
      if (err) { res.writeHead(500); res.end('Write failed'); return; }
      fs.rename(tmp, DATA_FILE, err2 => {
        if (err2) { res.writeHead(500); res.end('Write failed'); return; }
        res.writeHead(204); res.end();
      });
    });
  });
  req.on('error', () => { try { res.writeHead(400); res.end('Bad request'); } catch (e) {} });
}

const server = http.createServer((req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  let urlPath;
  try { urlPath = decodeURIComponent(req.url.split('?')[0]); }
  catch (e) { res.writeHead(400); res.end('Bad URL'); return; }
  if (urlPath === DATA_URL_PATH) {
    if (req.method === 'GET') return readData(req, res);
    // POST is accepted alongside PUT because navigator.sendBeacon (used to flush a save
    // on tab-close) can only send POST.
    if (req.method === 'PUT' || req.method === 'POST') return writeData(req, res);
    res.writeHead(405, { Allow: 'GET, PUT, POST' }); res.end('Method not allowed'); return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
  serveStatic(req, res, urlPath);
});

server.listen(PORT, () => {
  console.log('Penny Keeper homelab server listening on :' + PORT);
  console.log('data file: ' + DATA_FILE);
  if (!AUTH_TOKEN) console.log('Running with ALLOW_NO_AUTH=1: anyone who can reach this port can read/write your data file.');
});

/* Node runs as PID 1 in the container, and PID 1 gets no default signal handlers: with
 * nothing registered here, SIGTERM is ignored outright and every `docker compose up -d`
 * sits out the full stop timeout waiting on a SIGKILL before the old container dies.
 * Closing the server also lets a save that is already in flight finish writing. */
function shutdown() {
  server.close(() => process.exit(0));
  // a browser holding a keep-alive connection open should not stall the exit
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
