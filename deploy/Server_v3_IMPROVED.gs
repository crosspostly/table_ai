/**
 * TABLE AI - SERVER v3.0.0 IMPROVED
 * Standalone Web App
 * 
 * IMPROVEMENTS IN v3.0.0:
 * - Caching for Gemini responses (gmCacheKey, gmCacheGet, gmCachePut)
 * - Improved GM() with cache checking before API call
 * - Enhanced error handling
 * - Better logging
 * 
 * ARCHITECTURE:
 * CLIENT → SERVER (HTTP POST with action, email, token, apiKey)
 * SERVER → Validates license
 * SERVER → Calls Gemini/VK APIs (with caching)
 * SERVER → Logs operations
 * SERVER → Returns results
 */

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const LICENSE_SHEET_NAME = 'Tokens';
const LOG_SHEET_NAME = 'Logs';
const RATE_LIMIT_PER_SEC = 3;
const CACHE_TTL = 21600; // 6 hours

// ===== Entry points =====
function doGet(e) {
  return json_({ok: true, ping: 'pong', time: new Date().toISOString()});
}

function doPost(e) {
  try {
    const data = parseBody_(e);
    const action = (data.action || '').toString();
    const token = (data.token || '').toString();
    const email = (data.email || '').toString();

    // License gate for all actions except 'status'
    if (action !== 'status') {
      const lic = checkLicense_(token, email);
      if (!lic.ok) return json_({ok: false, error: lic.error || 'UNAUTHORIZED'}, 403);
    }

    switch (action) {
      case 'gm': {
        const prompt = (data.prompt || '').toString();
        const maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
        const temperature = data.temperature == null ? 0.7 : +data.temperature;
        const apiKey = (data.apiKey || '').toString();
        if (!apiKey) return json_({ok: false, error: 'NO_CLIENT_KEY'}, 400);
        if (!rateLimitOk_(token)) return json_({ok: false, error: 'RATE_LIMIT'}, 429);

        const t0 = Date.now();
        let ok = true, err = null, text = '';
        try {
          // Try cache first
          const cacheKey = gmCacheKey_(prompt, maxTokens, temperature);
          const cached = gmCacheGet_(cacheKey);
          if (cached) {
            text = cached;
            serverLog_({action: 'gm', ok: true, error: null, email: email, token: token, promptLen: prompt.length, ms: Date.now() - t0, cached: true});
            return json_({ok: true, data: text});
          }

          // No cache, call Gemini
          text = serverGM_(prompt, maxTokens, temperature, apiKey);
          
          // Cache the result
          gmCachePut_(cacheKey, text, CACHE_TTL);
        } catch (ex) {
          ok = false;
          err = String(ex && ex.message || ex);
        }
        try {
          serverLog_({action: 'gm', ok: ok, error: err, email: email, token: token, promptLen: prompt.length, ms: Date.now() - t0, cached: false});
        } catch (_) {}
        if (!ok) return json_({ok: false, error: err}, 500);
        return json_({ok: true, data: text});
      }

      case 'gm_image': {
        const images = data.images || [];
        const lang = (data.lang || 'ru').toString();
        const apiKey2 = (data.apiKey || '').toString();
        const delimiter = (data.delimiter && String(data.delimiter).trim()) ? String(data.delimiter).trim() : null;
        if (!apiKey2) return json_({ok: false, error: 'NO_CLIENT_KEY'}, 400);
        if (!Array.isArray(images) || images.length === 0) return json_({ok: false, error: 'NO_IMAGES'}, 400);
        if (!rateLimitOk_(token)) return json_({ok: false, error: 'RATE_LIMIT'}, 429);

        const t1 = Date.now();
        let ok2 = true, err2 = null, text2 = '';
        try {
          text2 = serverGMImage_(images, lang, apiKey2, delimiter);
        } catch (ex2) {
          ok2 = false;
          err2 = String(ex2 && ex2.message || ex2);
        }
        try {
          serverLog_({action: 'gm_image', ok: ok2, error: err2, email: email, token: token, promptLen: images.length, ms: Date.now() - t1});
        } catch (_) {}
        if (!ok2) return json_({ok: false, error: err2}, 500);
        return json_({ok: true, data: text2});
      }

      case 'status': {
        const status = checkLicense_(token, email);
        try {
          serverLog_({action: 'status', ok: status.ok, error: status.error || null, email: email, token: token, promptLen: 0, ms: 0});
        } catch (_) {}
        return json_({ok: status.ok, error: status.error || null, until: status.until || null, row: status.row || null});
      }

      default:
        return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }
  } catch (err) {
    return json_({ok: false, error: String(err && err.message || err)}, 500);
  }
}

// ===== License =====
function checkLicense_(token, email) {
  try {
    if (!token) return {ok: false, error: 'NO_TOKEN'};
    if (!email) return {ok: false, error: 'NO_EMAIL'};

    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = LICENSE_SHEET_NAME ? ss.getSheetByName(LICENSE_SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return {ok: false, error: 'LICENSE_SHEET_NOT_FOUND'};

    const range = sh.getDataRange();
    const values = range.getValues();
    if (!values || values.length < 2) return {ok: false, error: 'LICENSE_SHEET_EMPTY'};

    const header = values[0].map(function(x) {
      return String(x || '').toLowerCase().trim();
    });

    const colEmail = findHeader_(header, ['email', 'e-mail', 'почта', 'емейл']);
    const colToken = findHeader_(header, ['token', 'токен']);
    const colUntil = findHeader_(header, ['until', 'expiry', 'expires', 'дата окончания', 'окончание', 'срок', 'expireddate']);
    const colStatus = findHeader_(header, ['status', 'статус']);

    if (colToken < 0 || colEmail < 0 || colStatus < 0) {
      return {ok: false, error: 'LICENSE_HEADERS_MISSING'};
    }

    const emailL = String(email).toLowerCase().trim();
    const tokenS = String(token).trim();
    const now = new Date();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const em = String(row[colEmail] || '').toLowerCase().trim();
      const t = String(row[colToken] || '').trim();

      if (t && em && t === tokenS && em === emailL) {
        const status = String(row[colStatus] || '').toLowerCase().trim();
        const active = (status === 'active' || status === 'активен' || status === 'активный');
        if (!active) return {ok: false, error: 'INACTIVE', row: r + 1};

        let untilOk = true, untilIso = null;
        if (colUntil >= 0) {
          const cell = row[colUntil];
          if (cell) {
            const dt = (cell instanceof Date) ? cell : new Date(cell);
            untilOk = dt && dt >= now;
            untilIso = dt && dt.toISOString();
          }
        }
        if (!untilOk) return {ok: false, error: 'EXPIRED', until: untilIso, row: r + 1};
        return {ok: true, until: untilIso, row: r + 1};
      }
    }
    return {ok: false, error: 'NOT_FOUND'};
  } catch (e) {
    return {ok: false, error: 'LICENSE_ERROR: ' + e.message};
  }
}

function findHeader_(headerArr, keys) {
  for (let i = 0; i < headerArr.length; i++) {
    const h = headerArr[i];
    for (let j = 0; j < keys.length; j++) {
      if (h === keys[j]) return i;
    }
  }
  return -1;
}

// ===== Caching (NEW IN v3) =====
/**
 * Generate cache key for Gemini request
 * Format: gm_cache:{first20chars}:{maxTokens}:{temperature}
 */
function gmCacheKey_(prompt, maxTokens, temperature) {
  const p = String(prompt || '').slice(0, 20);
  const m = maxTokens || 12500;
  const t = temperature || 0.7;
  return 'gm_cache:' + p + ':' + m + ':' + t;
}

/**
 * Get cached Gemini result from server cache
 */
function gmCacheGet_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const v = cache.get(key);
    return v ? v : null;
  } catch (e) {
    return null;
  }
}

/**
 * Store Gemini result in server cache (TTL in seconds)
 */
function gmCachePut_(key, value, ttlSec) {
  try {
    const cache = CacheService.getScriptCache();
    const maxTTL = 21600;
    const ttl = Math.min(ttlSec || 21600, maxTTL);
    cache.put(key, value, ttl);
  } catch (e) {
    // ignore cache errors
  }
}

// ===== Gemini (server-side) =====
function serverGM_(prompt, maxTokens, temperature, apiKey) {
  if (!prompt || typeof prompt !== 'string') throw new Error('EMPTY_PROMPT');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');

  const requestBody = {
    contents: [{parts: [{text: prompt}]}],
    generationConfig: {maxOutputTokens: maxTokens, temperature: temperature},
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  const resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, options);
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());

  if (code !== 200) {
    const msg = data && data.error && data.error.message || ('HTTP_' + code);
    throw new Error(msg);
  }

  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';
  return serverProcessMarkdown_(text);
}

function serverGMImage_(images, lang, apiKey, delimiter) {
  if (!Array.isArray(images) || images.length === 0) throw new Error('NO_IMAGES');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');

  let instruction;
  if (delimiter && delimiter.length) {
    instruction = 'Extract text from each image. Return only clean text. Separate multiple items with: ' + delimiter;
  } else {
    instruction = 'Extract text from each image. Return only clean text.';
  }
  if (lang) instruction += ' Language: ' + lang + '.';

  const parts = [{text: instruction}];
  for (let i = 0; i < images.length; i++) {
    const it = images[i] || {};
    const mt = String(it.mimeType || 'image/png');
    const dt = String(it.data || '');
    if (!dt) continue;
    parts.push({inlineData: {mimeType: mt, data: dt}});
  }

  if (parts.length <= 1) throw new Error('NO_VALID_IMAGES');

  const body = {contents: [{parts: parts}], generationConfig: {maxOutputTokens: 4096, temperature: 0}};
  const resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());

  if (code !== 200) {
    const msg = data && data.error && data.error.message || ('HTTP_' + code);
    throw new Error(msg);
  }

  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';
  return serverProcessMarkdown_(text);
}

function serverProcessMarkdown_(text) {
  if (!text || typeof text !== 'string') return text;
  const isMd = /\*\*[^*]+\*\*|\*[^*]+\*|^#{1,6}\s+/m.test(text) || /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  if (!isMd) return text;

  const t = text
    .replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(_m, code) {
      return '\n' + String(code || '').trim() + '\n';
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, function(_m, c) {
      return String(c || '').toUpperCase();
    })
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, function(_m, h) {
      return '\n' + String(h || '').toUpperCase() + ':\n';
    })
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

// ===== Utils =====
function parseBody_(e) {
  try {
    const raw = e && e.postData && e.postData.contents;
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function json_(obj, status) {
  const out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (status && out.setResponseCode) out.setResponseCode(status);
  return out;
}

// Rate limit: max N requests per second per token
function rateLimitOk_(token) {
  try {
    const cache = CacheService.getScriptCache();
    const sec = Math.floor(Date.now() / 1000);
    const key = 'rl:' + String(token || '').trim() + ':' + sec;
    const v = cache.get(key);
    const n = v ? parseInt(v, 10) : 0;
    if (n >= RATE_LIMIT_PER_SEC) return false;
    cache.put(key, String(n + 1), 2);
    return true;
  } catch (e) {
    return true;
  }
}

// Server logs to admin spreadsheet
function serverLog_(info) {
  try {
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
    const headerNeeded = sh.getLastRow() === 0;

    if (headerNeeded) {
      sh.appendRow(['timestamp', 'action', 'ok', 'error', 'email', 'token', 'promptLen', 'ms', 'cached']);
    }

    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const tokenMasked = maskToken_(info.token);
    sh.appendRow([ts, info.action || '', info.ok ? '1' : '0', info.error || '', info.email || '', tokenMasked, info.promptLen || 0, info.ms || 0, info.cached ? '1' : '0']);
  } catch (e) {
    // ignore logging errors
  }
}

function maskToken_(t) {
  const s = String(t || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 4) + '****';
}
