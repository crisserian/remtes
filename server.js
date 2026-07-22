const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;
const APP_VERSION = require('./package.json').version;

// DIR (the install/app folder) may not be writable - e.g. a per-machine
// install under "C:\Program Files\..." requires admin rights to write into.
// Anything we need to read/write at runtime (tokens, sessions) goes in the
// OS's per-user app-data folder instead, which is always writable; only
// read-only bundled assets (binaries, keys, static HTML) stay under DIR.
let DATA_DIR = DIR;
try {
  const electron = require('electron');
  if (electron && electron.app && typeof electron.app.getPath === 'function') {
    DATA_DIR = electron.app.getPath('userData');
  }
} catch {}
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const TOKENS_FILE = path.join(DATA_DIR, 'tokens.json');
// app-secret.txt / ftp-config.json are only present on the "relay" install
// (the developer's own PC, feeding grumpylabs.ro/teslaapp for other users'
// browsers). A standalone distributable install has neither: it runs fully
// locally for one person, with no tunnel and nothing to authenticate remotely.
let APP_SECRET = null;
try {
  APP_SECRET = fs.readFileSync(path.join(DIR, 'app-secret.txt'), 'utf8').trim();
} catch {}
const CLIENT_ID = '750c9467-3412-44de-8853-ff78025f0a2b';
// Not committed to source control (see .gitignore) - required for the OAuth
// authorization_code exchange. Create this file yourself with your own
// Tesla developer app's client secret if building from source.
const CLIENT_SECRET = fs.readFileSync(path.join(DIR, 'client-secret.txt'), 'utf8').trim();
const OAUTH_REDIRECT_URI = 'https://testrace.netlify.app/callback';
const PROXY_PORT = 4443;
const APP_PORT = 5750;
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);

// cloudflared always forwards tunnel traffic to us over loopback, so the
// socket address alone can't tell local browser requests apart from requests
// that arrived over the internet through the tunnel. Cloudflare's edge stamps
// every request that passes through it with a "cf-ray" header - a client
// cannot remove or forge this from outside Cloudflare's network, and a
// request that never went through Cloudflare will never have it. That's the
// signal we trust instead of the (spoofable-by-forwarding) socket address.
function isLocal(req) {
  return !req.headers['cf-ray'] && !req.headers['cf-connecting-ip'];
}

function isAuthorized(req) {
  if (isLocal(req)) return true;
  return APP_SECRET !== null && req.headers['x-app-secret'] === APP_SECRET;
}

// Any webpage the user visits in their normal browser can silently POST to
// http://localhost:5750 (a "blind" cross-site request - the browser still
// sends it even though it can't read the response). A custom header forces
// the browser into a CORS preflight first; since we never answer preflights
// with an Access-Control-Allow-* header, the browser blocks the real request
// for any page that isn't served by this app itself. Combined with an Origin
// check as defense in depth. Only applies to local requests - the remote
// relay path (if ever used) is already gated by APP_SECRET.
function passesLocalCsrfCheck(req) {
  if (!isLocal(req)) return true;
  const origin = req.headers['origin'];
  if (origin && origin !== `http://localhost:${APP_PORT}`) return false;
  return req.headers['x-requested-with'] === 'RemTes';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function loadTokens() {
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
}
function saveTokens(t) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(t, null, 2));
}

function tokenRequest(bodyParams) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(bodyParams).toString();
    const req = https.request(
      'https://auth.tesla.com/oauth2/v3/token',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error('token request failed: ' + data));
          resolve(JSON.parse(data));
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function tokensFromJson(json, previousRefreshToken) {
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token || previousRefreshToken,
    expires_at: Math.floor(Date.now() / 1000) + (json.expires_in || 28800) - 60,
  };
}

async function refreshToken(tokens) {
  const json = await tokenRequest({
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: tokens.refresh_token,
  });
  const newTokens = Object.assign({}, tokens, tokensFromJson(json, tokens.refresh_token));
  saveTokens(newTokens);
  return newTokens;
}

async function getAccessToken() {
  let tokens = loadTokens();
  if (Math.floor(Date.now() / 1000) >= tokens.expires_at) {
    tokens = await refreshToken(tokens);
  }
  return tokens.access_token;
}

function hasValidTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return false;
  try {
    return !!loadTokens().refresh_token;
  } catch {
    return false;
  }
}

const OAUTH_STATE_FILE = path.join(DATA_DIR, '.oauth-state.txt');

// A fresh random state per login attempt, checked on /oauth-callback, closes
// the "login CSRF" gap where a malicious page could otherwise redirect the
// local app into completing a login with an authorization code that isn't
// the user's own (session fixation).
function buildLocalLoginUrl() {
  const state = 'local-' + require('crypto').randomBytes(16).toString('hex');
  fs.writeFileSync(OAUTH_STATE_FILE, state);
  return 'https://auth.tesla.com/oauth2/v3/authorize?' + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid offline_access vehicle_device_data vehicle_cmds vehicle_charging_cmds',
    state,
  }).toString();
}

function loginPageHtml() {
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8" />
  <style>
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#09090f;color:#e8e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
    .card{background:#12121e;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:2rem;max-width:380px;text-align:center;}
    a.btn{display:inline-block;margin-top:1.25rem;background:#6c63ff;color:#fff;border-radius:10px;padding:.9rem 1.5rem;font-weight:700;text-decoration:none;}
  </style></head><body>
  <div class="card"><h1>RemTes</h1><p>Conectează-ți contul Tesla</p>
  <a class="btn" href="${buildLocalLoginUrl()}">Login cu Tesla</a></div>
  </body></html>`;
}

function vehiclePickerHtml(vehicles) {
  const items = vehicles.map((v) =>
    `<a class="veh" href="/select-vehicle?vin=${encodeURIComponent(v.vin)}">${escapeHtml(v.display_name || v.vin)}<small>${escapeHtml(v.access_type)} · ${escapeHtml(v.vin)}</small></a>`
  ).join('');
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="UTF-8" />
  <style>
    body{font-family:'Segoe UI',system-ui,sans-serif;background:#09090f;color:#e8e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
    .card{background:#12121e;border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:2rem;max-width:380px;width:100%;text-align:center;}
    .veh{display:block;background:#1a1a2e;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:1rem;margin-bottom:.6rem;color:#e8e8f0;text-decoration:none;font-weight:600;text-align:left;}
    .veh small{display:block;color:#888899;font-weight:400;font-size:.78rem;margin-top:.2rem;}
  </style></head><body>
  <div class="card"><h1>🚗 Alege mașina</h1>${items}</div>
  </body></html>`;
}

// ── Per-user sessions (public multi-user login via "Sign in with Tesla") ──
function sessionFile(id) {
  return path.join(SESSIONS_DIR, id + '.json');
}
function loadSession(id) {
  if (!/^[a-f0-9]+$/.test(id)) return null;
  const file = sessionFile(id);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function saveSession(id, data) {
  fs.writeFileSync(sessionFile(id), JSON.stringify(data, null, 2));
}

async function getAccessTokenForSession(session, sessionId) {
  if (Math.floor(Date.now() / 1000) >= session.expires_at) {
    const json = await tokenRequest({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: session.refresh_token,
    });
    Object.assign(session, tokensFromJson(json, session.refresh_token));
    saveSession(sessionId, session);
  }
  return session.access_token;
}

async function exchangeCodeForTokens(code) {
  const json = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    redirect_uri: OAUTH_REDIRECT_URI,
  });
  return tokensFromJson(json, null);
}

async function fetchVehicleList(accessToken) {
  const r = await proxyRequest('GET', '/api/1/vehicles', accessToken);
  const json = JSON.parse(r.body);
  if (!json.response) throw new Error(json.error || 'could not list vehicles');
  return json.response.map((v) => ({ vin: v.vin, display_name: v.display_name, access_type: v.access_type }));
}

function proxyRequest(method, urlPath, accessToken, bodyObj) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'localhost',
        port: PROXY_PORT,
        path: urlPath,
        method,
        rejectUnauthorized: false,
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on('error', reject);
    if (method === 'POST') req.write(JSON.stringify(bodyObj || {}));
    req.end();
  });
}

const MIN_TEMP = 15;
const MAX_TEMP = 28;
const TEMP_STEP = 0.5;
const CHARGE_LIMIT_STEP = 5;

async function adjustTemp(accessToken, vin, delta) {
  const dataRes = await proxyRequest('GET', `/api/1/vehicles/${vin}/vehicle_data`, accessToken);
  const data = JSON.parse(dataRes.body);
  if (!data.response || !data.response.climate_state) {
    return { status: dataRes.status, body: dataRes.body };
  }
  const current = data.response.climate_state.driver_temp_setting;
  const next = Math.min(MAX_TEMP, Math.max(MIN_TEMP, Math.round((current + delta) * 2) / 2));
  const r = await proxyRequest('POST', `/api/1/vehicles/${vin}/command/set_temps`, accessToken, {
    driver_temp: next,
    passenger_temp: next,
  });
  return { status: r.status, body: r.body, newTemp: next };
}

async function adjustChargeLimit(accessToken, vin, delta) {
  const dataRes = await proxyRequest('GET', `/api/1/vehicles/${vin}/vehicle_data`, accessToken);
  const data = JSON.parse(dataRes.body);
  if (!data.response || !data.response.charge_state) {
    return { status: dataRes.status, body: dataRes.body };
  }
  const cs = data.response.charge_state;
  const min = cs.charge_limit_soc_min || 50;
  const max = cs.charge_limit_soc_max || 100;
  const next = Math.min(max, Math.max(min, cs.charge_limit_soc + delta));
  const r = await proxyRequest('POST', `/api/1/vehicles/${vin}/command/set_charge_limit`, accessToken, {
    percent: next,
  });
  return { status: r.status, body: r.body, newLimit: next };
}

// ── Battery range history: Tesla doesn't expose a battery-health/degradation
// percentage through the Fleet API, so this opportunistically logs the rated
// range at 100% charge (the same number owners track manually over time to
// estimate degradation) whenever a status refresh happens to catch the car
// fully charged - no extra API calls beyond what the dashboard already makes.
const BATTERY_HISTORY_FILE = path.join(DATA_DIR, 'battery-history.json');

function loadBatteryHistory() {
  try {
    return JSON.parse(fs.readFileSync(BATTERY_HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function recordBatteryRangeIfFull(chargeState) {
  if (!chargeState || chargeState.battery_level !== 100) return;
  const history = loadBatteryHistory();
  const today = new Date().toISOString().slice(0, 10);
  if (history.length && history[history.length - 1].date === today) return;
  history.push({
    date: today,
    battery_range: chargeState.battery_range,
    ideal_battery_range: chargeState.ideal_battery_range,
  });
  fs.writeFileSync(BATTERY_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Resolves {accessToken, vin} for a request: the owner's own car when used
// locally (the Electron desktop app, always trusted), or a per-user session
// for anyone using the public grumpylabs.ro/teslaapp login-with-Tesla flow.
async function resolveContext(req) {
  if (isLocal(req)) {
    const accessToken = await getAccessToken();
    const tokens = loadTokens();
    if (!tokens.vin) throw Object.assign(new Error('no vehicle selected'), { statusCode: 400 });
    return { accessToken, vin: tokens.vin };
  }
  const sessionId = req.headers['x-session-id'];
  if (!sessionId) throw Object.assign(new Error('missing session'), { statusCode: 401 });
  const session = loadSession(sessionId);
  if (!session) throw Object.assign(new Error('invalid or expired session'), { statusCode: 401 });
  if (!session.vin) throw Object.assign(new Error('no vehicle selected for this session'), { statusCode: 400 });
  const accessToken = await getAccessTokenForSession(session, sessionId);
  return { accessToken, vin: session.vin };
}

const COMMANDS = {
  lock: { cmd: 'door_lock' },
  unlock: { cmd: 'door_unlock' },
  honk: { cmd: 'honk_horn' },
  flash: { cmd: 'flash_lights' },
  climate_on: { cmd: 'auto_conditioning_start' },
  climate_off: { cmd: 'auto_conditioning_stop' },
  vent_windows: { cmd: 'window_control', body: { command: 'vent', lat: 0, lon: 0 } },
  close_windows: { cmd: 'window_control', body: { command: 'close', lat: 0, lon: 0 } },
  charge_start: { cmd: 'charge_start' },
  charge_stop: { cmd: 'charge_stop' },
  charge_port_open: { cmd: 'charge_port_door_open' },
  charge_port_close: { cmd: 'charge_port_door_close' },
  trunk_rear: { cmd: 'actuate_trunk', body: { which_trunk: 'rear' } },
  trunk_front: { cmd: 'actuate_trunk', body: { which_trunk: 'front' } },
  sentry_on: { cmd: 'set_sentry_mode', body: { on: true } },
  sentry_off: { cmd: 'set_sentry_mode', body: { on: false } },
  seat_heater_on: { cmd: 'remote_seat_heater_request', body: { seat_position: 0, level: 3 } },
  seat_heater_off: { cmd: 'remote_seat_heater_request', body: { seat_position: 0, level: 0 } },
  steering_heater_on: { cmd: 'remote_steering_wheel_heater_request', body: { on: true } },
  steering_heater_off: { cmd: 'remote_steering_wheel_heater_request', body: { on: false } },
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      if (!isLocal(req)) {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('RemTes API.');
        return;
      }
      if (!hasValidTokens()) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(loginPageHtml());
        return;
      }
      const tokens = loadTokens();
      if (!tokens.vin && tokens.vehicles && tokens.vehicles.length > 1) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(vehiclePickerHtml(tokens.vehicles));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(path.join(DIR, 'public', 'index.html')));
      return;
    }

    if (req.method === 'GET' && req.url === '/logout' && isLocal(req)) {
      if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/oauth-callback') && isLocal(req)) {
      const u = new URL(req.url, 'http://localhost');
      const code = u.searchParams.get('code');
      const state = u.searchParams.get('state');
      const expectedState = fs.existsSync(OAUTH_STATE_FILE) ? fs.readFileSync(OAUTH_STATE_FILE, 'utf8') : null;
      if (fs.existsSync(OAUTH_STATE_FILE)) fs.unlinkSync(OAUTH_STATE_FILE); // single-use
      if (!expectedState || state !== expectedState) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<p>Login invalid sau expirat. Reia procesul.</p><a href="/">Înapoi</a>`);
        return;
      }
      try {
        const tokens = await exchangeCodeForTokens(code);
        const vehicles = await fetchVehicleList(tokens.access_token);
        const vin = vehicles.length === 1 ? vehicles[0].vin : null;
        saveTokens({ ...tokens, vehicles, vin });
        res.writeHead(302, { Location: '/' });
        res.end();
      } catch (err) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<p>Login eșuat: ${escapeHtml(err.message || err)}</p><a href="/">Înapoi</a>`);
      }
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/select-vehicle') && isLocal(req)) {
      const u = new URL(req.url, 'http://localhost');
      const vin = u.searchParams.get('vin');
      const tokens = loadTokens();
      if (!Array.isArray(tokens.vehicles) || !tokens.vehicles.some((v) => v.vin === vin)) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<p>Mașină necunoscută pentru acest cont.</p><a href="/">Înapoi</a>');
        return;
      }
      tokens.vin = vin;
      saveTokens(tokens);
      res.writeHead(302, { Location: '/' });
      res.end();
      return;
    }

    if (!isAuthorized(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (!passesLocalCsrfCheck(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden' }));
      return;
    }

    // ── Public multi-user login: exchange an OAuth code for tokens, list
    // that account's vehicles, and create a session. Only reachable with
    // the shared APP_SECRET (i.e. relayed through grumpylabs.ro), same as
    // every other remote route. ──
    if (req.method === 'POST' && req.url === '/session/create') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', async () => {
        try {
          const { code } = JSON.parse(body || '{}');
          const tokens = await exchangeCodeForTokens(code);
          const vehicles = await fetchVehicleList(tokens.access_token);
          const sessionId = require('crypto').randomBytes(16).toString('hex');
          const session = { ...tokens, vehicles, vin: vehicles.length === 1 ? vehicles[0].vin : null };
          saveSession(sessionId, session);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ session_id: sessionId, vehicles, vin: session.vin }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err.message || err) }));
        }
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/session/select-vehicle') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const { session_id, vin } = JSON.parse(body || '{}');
        const session = loadSession(session_id);
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid session' }));
          return;
        }
        if (!session.vehicles.some((v) => v.vin === vin)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'vehicle not in this account' }));
          return;
        }
        session.vin = vin;
        saveSession(session_id, session);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/command/')) {
      const name = req.url.split('/').pop();
      const { accessToken, vin } = await resolveContext(req);

      if (name === 'wake') {
        const r = await proxyRequest('POST', `/api/1/vehicles/${vin}/wake_up`, accessToken);
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(r.body);
        return;
      }

      if (name === 'temp_up' || name === 'temp_down') {
        const r = await adjustTemp(accessToken, vin, name === 'temp_up' ? TEMP_STEP : -TEMP_STEP);
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...JSON.parse(r.body), newTemp: r.newTemp }));
        return;
      }

      if (name === 'charge_limit_up' || name === 'charge_limit_down') {
        const r = await adjustChargeLimit(accessToken, vin, name === 'charge_limit_up' ? CHARGE_LIMIT_STEP : -CHARGE_LIMIT_STEP);
        res.writeHead(r.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...JSON.parse(r.body), newLimit: r.newLimit }));
        return;
      }

      // Seat/steering heaters only work once climate is on ("cabin comfort
      // remote settings not enabled" otherwise) - turn it on first.
      if (name === 'seat_heater_on' || name === 'steering_heater_on') {
        await proxyRequest('POST', `/api/1/vehicles/${vin}/command/auto_conditioning_start`, accessToken);
      }

      const entry = COMMANDS[name];
      if (!entry) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'unknown command' }));
        return;
      }
      const r = await proxyRequest('POST', `/api/1/vehicles/${vin}/command/${entry.cmd}`, accessToken, entry.body);
      res.writeHead(r.status, { 'Content-Type': 'application/json' });
      res.end(r.body);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/status') {
      const { accessToken, vin } = await resolveContext(req);
      const r = await proxyRequest('GET', `/api/1/vehicles/${vin}/vehicle_data`, accessToken);
      try {
        const json = JSON.parse(r.body);
        if (json.response) recordBatteryRangeIfFull(json.response.charge_state);
      } catch {}
      res.writeHead(r.status, { 'Content-Type': 'application/json' });
      res.end(r.body);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/battery-history') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(loadBatteryHistory()));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/app-version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ version: APP_VERSION }));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
});

// Start the signing proxy as a child process
const proxy = spawn(
  path.join(DIR, 'tesla-http-proxy.exe'),
  [
    '-port', String(PROXY_PORT),
    '-cert', path.join(DIR, 'proxy-tls-cert.pem'),
    '-tls-key', path.join(DIR, 'proxy-tls-key.pem'),
    '-key-file', path.join(DIR, 'tesla-private-key.pem'),
  ],
  { cwd: DIR }
);
proxy.stdout.on('data', (d) => process.stdout.write('[proxy] ' + d));
proxy.stderr.on('data', (d) => process.stderr.write('[proxy] ' + d));
proxy.on('exit', (code) => console.log('[proxy] exited with code', code));

process.on('exit', () => proxy.kill());
process.on('SIGINT', () => { proxy.kill(); if (tunnel) tunnel.kill(); process.exit(); });

setTimeout(() => {
  server.listen(APP_PORT, '127.0.0.1', () => {
    console.log(`RemTes running at http://localhost:${APP_PORT}`);
  });
}, 1500);

// ── Alert notifications: lightly polls recent_alerts while the app is
// running and shows a native Windows notification for anything new (e.g.
// the car's alarm/Sentry Mode firing). Local single-user install only -
// remote sessions (grumpylabs.ro/teslaapp) don't get desktop notifications
// since there's no local machine to show them on. ──
const ALERT_STATE_FILE = path.join(DATA_DIR, '.last-alert-seen.json');
const ALERT_POLL_INTERVAL_MS = 120000;

function loadAlertState() {
  try {
    return JSON.parse(fs.readFileSync(ALERT_STATE_FILE, 'utf8'));
  } catch {
    return null;
  }
}
function saveAlertState(vin, time) {
  fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify({ vin, time: time.toISOString() }));
}

function notifyAlert(alert) {
  console.log('[alerts]', alert.name, '-', alert.user_text || '');
  try {
    const { Notification } = require('electron');
    if (Notification && Notification.isSupported()) {
      new Notification({
        title: 'RemTes — alertă mașină',
        body: alert.user_text || alert.name,
      }).show();
    }
  } catch {}
}

async function checkForNewAlerts() {
  if (!hasValidTokens()) return;
  const tokens = loadTokens();
  if (!tokens.vin) return;
  try {
    const accessToken = await getAccessToken();
    const r = await proxyRequest('GET', `/api/1/vehicles/${tokens.vin}/recent_alerts`, accessToken);
    const json = JSON.parse(r.body);
    const alerts = (json.response && json.response.recent_alerts) || [];
    if (!alerts.length) return;

    const state = loadAlertState();
    const lastSeen = state && state.vin === tokens.vin ? new Date(state.time) : null;
    // recent_alerts is newest-first.
    const newAlerts = lastSeen ? alerts.filter((a) => new Date(a.time) > lastSeen) : [];
    saveAlertState(tokens.vin, new Date(alerts[0].time));
    // On the very first check (no baseline yet, or after switching cars),
    // just record the baseline instead of notifying about the car's entire
    // alert history at once.
    if (lastSeen) newAlerts.reverse().forEach(notifyAlert);
  } catch (err) {
    console.error('[alerts] check failed:', err.message || err);
  }
}

setInterval(checkForNewAlerts, ALERT_POLL_INTERVAL_MS);
setTimeout(checkForNewAlerts, 5000);

// ── Cloudflare quick tunnel: exposes this server publicly under a random
// *.trycloudflare.com URL, then uploads that URL to grumpylabs.ro via FTP
// so the PHP page there knows where to forward requests. Only runs on the
// developer's own relay install - a standalone distributable has no
// ftp-config.json and simply skips this (fully local, single-user use). ──
const CLOUDFLARED = 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe';
let ftpConfig = null;
try {
  ftpConfig = JSON.parse(fs.readFileSync(path.join(DIR, 'ftp-config.json'), 'utf8'));
} catch {}
let tunnel = null;
let tunnelUrlUploaded = null;

function uploadTunnelUrl(url) {
  if (url === tunnelUrlUploaded) return;
  const tmpFile = path.join(DATA_DIR, '.tunnel-url.tmp');
  fs.writeFileSync(tmpFile, url);
  const { execFile } = require('child_process');
  const ftpUrl = `ftp://${ftpConfig.host}/${ftpConfig.remotePath}`;
  execFile('curl.exe', [
    '-T', tmpFile,
    '--user', `${ftpConfig.user}:${ftpConfig.pass}`,
    ftpUrl,
    '--ftp-create-dirs', '-sS',
  ], (err, stdout, stderr) => {
    if (err) {
      console.error('[tunnel] FTP upload failed:', stderr || err.message);
    } else {
      tunnelUrlUploaded = url;
      console.log('[tunnel] Public URL uploaded to grumpylabs.ro:', url);
    }
  });
}

function startTunnel() {
  tunnel = spawn(CLOUDFLARED, ['tunnel', '--url', `http://localhost:${APP_PORT}`, '--no-autoupdate'], { cwd: DIR });
  const urlPattern = /https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/;
  const onData = (d) => {
    const text = d.toString();
    process.stdout.write('[tunnel] ' + text);
    const match = text.match(urlPattern);
    if (match) uploadTunnelUrl(match[0]);
  };
  tunnel.stdout.on('data', onData);
  tunnel.stderr.on('data', onData);
  tunnel.on('exit', (code) => console.log('[tunnel] exited with code', code));
}

if (ftpConfig) {
  setTimeout(startTunnel, 2000);
} else {
  console.log('[tunnel] ftp-config.json not found - running standalone, no tunnel.');
}
