/**
 * WAENN — POST /api/subscribe
 * Brevo Double Opt-In (DOI): mismo contrato de campos que el formulario Sibforms,
 * pero el envío de confirmación lo dispara la API oficial DOI (no /v3/contacts).
 *
 * Env (Vercel):
 *   BREVO_API_KEY (required)
 *   BREVO_LIST_ID (required, número de lista)
 *   BREVO_DOUBLE_OPTIN_TEMPLATE_ID (required, plantilla DOI en Brevo)
 *   BREVO_REDIRECTION_URL (opcional: por defecto https://{Host}/gracias → gracias.html en Vercel)
 * Opcional:
 *   BREVO_LOCALE_ATTRIBUTE — si existe en Brevo como atributo de contacto, se envía el valor es|en
 *   SUBSCRIBE_MAX_BODY_BYTES (default 16384)
 */

const BREVO_DOI_URL = 'https://api.brevo.com/v3/contacts/doubleOptinConfirmation';

const ALLOWED_INTERESTS = new Set([
  'Identity and character',
  'Longevity and quality',
  'A fit that truly works',
]);

const rateBuckets = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_WINDOW = 24;

function readJsonBody(req, maxBytes) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let total = 0;
    let failed = false;
    req.on('data', function (chunk) {
      if (failed) return;
      total += chunk.length;
      if (total > maxBytes) {
        failed = true;
        try {
          req.destroy();
        } catch {
          /* ignore */
        }
        reject(new Error('payload_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', function () {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw || !raw.trim()) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf && typeof xf === 'string') {
    const first = xf.split(',')[0].trim();
    if (first) return first;
  }
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function rateLimitOk(ip) {
  const now = Date.now();
  let arr = rateBuckets.get(ip);
  if (!arr) arr = [];
  arr = arr.filter(function (t) {
    return now - t < RATE_WINDOW_MS;
  });
  if (arr.length >= RATE_MAX_PER_WINDOW) return false;
  arr.push(now);
  rateBuckets.set(ip, arr);
  if (rateBuckets.size > 5000) {
    for (const k of rateBuckets.keys()) {
      rateBuckets.delete(k);
      if (rateBuckets.size < 2000) break;
    }
  }
  return true;
}

function isValidEmail(s) {
  if (!s || typeof s !== 'string' || s.length > 254) return false;
  const t = s.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  return true;
}

function isValidRedirectUrl(u) {
  if (!u || typeof u !== 'string') return false;
  try {
    const x = new URL(u.trim());
    return x.protocol === 'https:' || x.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Quita comillas si alguien pegó "123" en Vercel. */
function trimEnvQuotes(s) {
  if (s == null) return '';
  const t = String(s).trim();
  if (t.length >= 2) {
    const q = t[0];
    if ((q === '"' || q === "'") && t[t.length - 1] === q) return t.slice(1, -1).trim();
  }
  return t;
}

function parsePositiveIntFromEnv(raw) {
  const s = trimEnvQuotes(raw);
  if (!s) return NaN;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? NaN : n;
}

/** Primer env no vacío (por si el nombre en Vercel no coincide). */
function firstEnv(keys) {
  for (let i = 0; i < keys.length; i++) {
    const v = process.env[keys[i]];
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

/** URL de gracias en el mismo dominio que el visitante (Vercel envía Host / X-Forwarded-*). */
function defaultGraciasUrlFromRequest(req) {
  const xfHost = req.headers['x-forwarded-host'];
  let host = '';
  if (typeof xfHost === 'string' && xfHost.trim()) {
    host = xfHost.split(',')[0].trim();
  } else if (req.headers.host) {
    host = String(req.headers.host).trim();
  }
  if (!host) return '';
  const xfProto = req.headers['x-forwarded-proto'];
  let proto = 'https';
  if (typeof xfProto === 'string' && xfProto.trim()) {
    const p = xfProto.split(',')[0].trim().toLowerCase();
    if (p === 'http' || p === 'https') proto = p;
  }
  return `${proto}://${host}/gracias`;
}

function resolveRedirectionUrl(req, envRaw) {
  const fromEnv = trimEnvQuotes(envRaw);
  if (fromEnv && isValidRedirectUrl(fromEnv)) return fromEnv;

  const fromHost = defaultGraciasUrlFromRequest(req);
  if (fromHost && isValidRedirectUrl(fromHost)) return fromHost;

  const vu = process.env.VERCEL_URL ? trimEnvQuotes(process.env.VERCEL_URL) : '';
  if (vu) {
    const hostOnly = vu.replace(/^https?:\/\//i, '').split('/')[0];
    const candidate = `https://${hostOnly}/gracias`;
    if (isValidRedirectUrl(candidate)) return candidate;
  }
  return '';
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

function logBrevoFailure(status, body) {
  try {
    const code = body && typeof body === 'object' ? body.code : '';
    const msg = body && typeof body === 'object' ? body.message : '';
    console.warn('[api/subscribe] brevo non-ok', status, String(code || ''), String(msg || '').slice(0, 200));
  } catch {
    /* ignore */
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    sendJson(res, 405, { ok: false });
    return;
  }

  const apiKey = trimEnvQuotes(firstEnv(['BREVO_API_KEY', 'SENDINBLUE_API_KEY', 'SIB_API_KEY']));
  const listIdSource = firstEnv(['BREVO_LIST_ID', 'LIST_ID', 'BREVO_LISTID', 'SENDINBLUE_LIST_ID']);
  const listIdRaw = trimEnvQuotes(listIdSource);
  const listId = parsePositiveIntFromEnv(listIdSource);
  const templateIdSource = firstEnv([
    'BREVO_DOUBLE_OPTIN_TEMPLATE_ID',
    'BREVO_DOI_TEMPLATE_ID',
    'BREVO_TEMPLATE_ID',
  ]);
  const templateIdRaw = trimEnvQuotes(templateIdSource);
  const templateId = parsePositiveIntFromEnv(templateIdSource);
  const redirectionUrl = resolveRedirectionUrl(req, process.env.BREVO_REDIRECTION_URL);
  const localeAttrName = process.env.BREVO_LOCALE_ATTRIBUTE
    ? trimEnvQuotes(process.env.BREVO_LOCALE_ATTRIBUTE)
    : '';

  const missing = [];
  if (!apiKey) missing.push('BREVO_API_KEY');
  if (!listIdRaw || Number.isNaN(listId) || listId < 1) missing.push('BREVO_LIST_ID');
  if (!templateIdRaw || Number.isNaN(templateId) || templateId < 1) {
    missing.push('BREVO_DOUBLE_OPTIN_TEMPLATE_ID');
  }
  if (!redirectionUrl || !isValidRedirectUrl(redirectionUrl)) {
    missing.push('BREVO_REDIRECTION_URL');
  }

  if (missing.length) {
    console.warn('[api/subscribe] misconfigured', missing.join(','));
    sendJson(res, 503, { ok: false, code: 'misconfigured', missing: missing });
    return;
  }

  const maxBytes = parseInt(process.env.SUBSCRIBE_MAX_BODY_BYTES || '16384', 10) || 16384;
  let body;
  try {
    body = await readJsonBody(req, maxBytes);
  } catch (err) {
    if (err && err.message === 'payload_too_large') {
      sendJson(res, 413, { ok: false });
      return;
    }
    sendJson(res, 400, { ok: false });
    return;
  }

  if (!body || typeof body !== 'object') {
    sendJson(res, 400, { ok: false });
    return;
  }

  const ip = getClientIp(req);
  if (!rateLimitOk(ip)) {
    sendJson(res, 429, { ok: false });
    return;
  }

  if (body.email_address_check) {
    sendJson(res, 200, { ok: true });
    return;
  }

  const nombre = typeof body.NOMBRE === 'string' ? body.NOMBRE.trim().slice(0, 200) : '';
  const email = typeof body.EMAIL === 'string' ? body.EMAIL.trim().toLowerCase() : '';
  const locale = body.locale === 'en' ? 'en' : 'es';
  const marketing = body.ACEPTA_MARKETING === '1' || body.ACEPTA_MARKETING === 1 || body.ACEPTA_MARKETING === true;

  let interests = body.PRENDA_INTERES;
  if (!Array.isArray(interests)) {
    sendJson(res, 400, { ok: false });
    return;
  }
  interests = interests.filter(function (x) {
    return typeof x === 'string' && ALLOWED_INTERESTS.has(x);
  });
  if (interests.length < 1) {
    sendJson(res, 400, { ok: false });
    return;
  }

  if (!nombre || !isValidEmail(email) || !marketing) {
    sendJson(res, 400, { ok: false });
    return;
  }

  const attributes = {
    NOMBRE: nombre,
    PRENDA_INTERES: interests,
    ACEPTA_MARKETING: true,
  };
  if (localeAttrName) {
    attributes[localeAttrName] = locale;
  }

  const brevoPayload = {
    email: email,
    includeListIds: [listId],
    templateId: templateId,
    redirectionUrl: redirectionUrl,
    attributes: attributes,
  };

  try {
    const brevoRes = await fetch(BREVO_DOI_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(brevoPayload),
    });

    if (brevoRes.status === 201 || brevoRes.status === 204) {
      sendJson(res, 200, { ok: true });
      return;
    }

    let errBody = null;
    try {
      errBody = await brevoRes.json();
    } catch {
      /* ignore */
    }
    logBrevoFailure(brevoRes.status, errBody);
    const out = { ok: false, code: 'brevo_rejected', brevoStatus: brevoRes.status };
    if (errBody && typeof errBody === 'object') {
      if (errBody.code != null) out.brevoCode = String(errBody.code);
      if (errBody.message != null) out.brevoMessage = String(errBody.message).slice(0, 220);
    }
    sendJson(res, 502, out);
  } catch (e) {
    console.warn('[api/subscribe] brevo fetch error', e && e.message ? String(e.message).slice(0, 120) : '');
    sendJson(res, 502, { ok: false, code: 'brevo_unreachable' });
  }
};
