// Table AI Server (Apps Script Web App)
// Backend: лицензии, прокси к Gemini с КЛЮЧОМ КЛИЕНТА, серверные логи

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const LICENSE_SHEET_NAME = 'Tokens';
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3; // max запросов/сек на токен

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
    const sheetId = (data.sheetId || '').toString(); // ← ДОБАВЛЕНО

    // License gate for all actions except 'status'
    if (action !== 'status') {
      const lic = checkLicense_(token, email, sheetId); // ← ДОБАВЛЕН sheetId
      if (!lic.ok) return json_({ok: false, error: lic.error || 'UNAUTHORIZED'}, 403);
    }

    switch (action) {
    case 'gm': {
      const prompt = (data.prompt || '').toString();
      const maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
      const temperature = data.temperature == null ? 0.7 : +data.temperature;
      const apiKey = (data.apiKey || '').toString();
      if (!apiKey) return json_({ok: false, error: 'NO_CLIENT_KEY'}, 400);
      // rate limit
      if (!rateLimitOk_(token)) return json_({ok: false, error: 'RATE_LIMIT'}, 429);

      const t0 = Date.now();
      let ok = true; let err = null; let text = '';
      try {
        text = serverGM_(prompt, maxTokens, temperature, apiKey);
      } catch (ex) {
        ok = false; err = String(ex && ex.message || ex);
      }
      try {
        serverLog_({action: 'gm', ok: ok, error: err, email: email, token: token, promptLen: prompt.length, ms: Date.now() - t0});
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
      let ok2 = true; let err2 = null; let text2 = '';
      try {
        text2 = serverGMImage_(images, lang, apiKey2, delimiter);
      } catch (ex2) {
        ok2 = false; err2 = String(ex2 && ex2.message || ex2);
      }
      try {
        serverLog_({action: 'gm_image', ok: ok2, error: err2, email: email, token: token, promptLen: images.length, ms: Date.now() - t1});
      } catch (_) {}
      if (!ok2) return json_({ok: false, error: err2}, 500);
      return json_({ok: true, data: text2});
    }
    case 'status': {
      const status = checkLicense_(token, email, sheetId); // ← ДОБАВЛЕН sheetId
      try {
        serverLog_({action: 'status', ok: status.ok, error: status.error || null, email: email, token: token, promptLen: 0, ms: 0});
      } catch (_) {}
      return json_({
        ok: status.ok,
        error: status.error || null,
        until: status.until || null,
        row: status.row || null,
        quota: status.quota || null, // ← ДОБАВЛЕНО
        message: status.message || null, // ← ДОБАВЛЕНО
      });
    }
    default:
      return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }
  } catch (err) {
    return json_({ok: false, error: String(err && err.message || err)}, 500);
  }
}


// ===== License =====
// ===== License (ПОЛНАЯ ВЕРСИЯ с привязкой таблиц) =====
function checkLicense_(token, email, sheetId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    if (!token) return {ok: false, error: 'NO_TOKEN'};
    if (!email) return {ok: false, error: 'NO_EMAIL'};

    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = LICENSE_SHEET_NAME ? ss.getSheetByName(LICENSE_SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return {ok: false, error: 'LICENSE_SHEET_NOT_FOUND'};

    const range = sh.getDataRange();
    const values = range.getValues();
    if (!values || values.length < 2) return {ok: false, error: 'LICENSE_SHEET_EMPTY'};

    const emailL = String(email).toLowerCase().trim();
    const tokenS = String(token).trim();
    const now = new Date();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const em = String(row[0] || '').toLowerCase().trim(); // Email (колонка 0)
      const t = String(row[1] || '').trim(); // Token (колонка 1)
      const dateCell = row[2]; // ExpiredDate (колонка 2)
      const statusCell = String(row[3] || '').toLowerCase().trim(); // Status (колонка 3)
      const sheetIdsCell = String(row[4] || '').trim(); // sheet_ids (колонка 4)
      const copiesCountCell = row[5]; // copies_count (колонка 5)

      if (t && em && t === tokenS && em === emailL) {
        // 1. Проверка статуса
        const active = (statusCell === 'active' || statusCell === 'активен' || statusCell === 'активный');
        if (!active) return {ok: false, error: 'INACTIVE', row: r + 1};

        // 2. Проверка даты истечения
        let untilOk = true;
        let untilIso = null;

        if (dateCell) {
          const dt = (dateCell instanceof Date) ? dateCell : new Date(dateCell);
          untilOk = dt && dt >= now;
          untilIso = dt && dt.toISOString();
        }

        if (!untilOk) return {ok: false, error: 'EXPIRED', until: untilIso, row: r + 1};

        // 3. Проверка системы привязки листов
        const copiesCount = parseInt(String(copiesCountCell || '0').trim()) || 0;

        // Если нет sheetId - работаем без привязки (только квоты)
        if (!sheetId) {
          if (copiesCount <= 0) {
            return {
              ok: false,
              error: 'NO_QUOTA_LEFT',
              row: r + 1,
              quota: {remaining: 0, total: 0},
            };
          }

          return {
            ok: true,
            until: untilIso,
            row: r + 1,
            message: 'NO_SHEET_CONTEXT',
            quota: {remaining: copiesCount, total: copiesCount},
          };
        }

        // 4. ПОЛНАЯ ЛОГИКА ПРИВЯЗКИ ЛИСТОВ

        // Если sheet_ids пустое - новая лицензия, привязываем
        if (!sheetIdsCell) {
          if (copiesCount <= 0) {
            return {
              ok: false,
              error: 'NO_QUOTA_LEFT',
              message: 'Количество копий исчерпано. Обратитесь к создателю: https://vk.com/daoqub',
              row: r + 1,
              quota: {remaining: 0, total: 0},
            };
          }

          // Привязываем текущую таблицу
          try {
            let sheetName = 'Unknown Sheet';
            try {
              sheetName = SpreadsheetApp.openById(sheetId).getName();
            } catch (e) {
              // Название получить не удалось - не критично
            }

            const bindingInfo = sheetId + '\n' + sheetName + ' (' + new Date().toLocaleDateString() + ')';
            const newCopiesCount = copiesCount - 1;

            // Обновляем лицензионную таблицу
            sh.getRange(r + 1, 5).setValue(bindingInfo); // колонка 4 (sheet_ids) = индекс 4, но getRange начинается с 1
            sh.getRange(r + 1, 6).setValue(newCopiesCount); // колонка 5 (copies_count) = индекс 5, но getRange начинается с 1

            return {
              ok: true,
              until: untilIso,
              row: r + 1,
              message: 'SHEET_BOUND',
              quota: {remaining: newCopiesCount, total: copiesCount, used: 1},
            };
          } catch (e) {
            return {ok: false, error: 'SHEET_BINDING_ERROR: ' + e.message, row: r + 1};
          }
        } else {
          // Проверяем привязан ли текущий лист
          const boundSheetIds = sheetIdsCell.split('\n')
            .map(function(line) {
              return line.trim();
            })
            .filter(function(line) {
              return line.length > 0;
            })
            .map(function(line) {
              return line.split(' ')[0].split('\t')[0];
            });

          if (boundSheetIds.indexOf(sheetId) !== -1) {
            // Лист уже привязан - разрешаем
            const usedCopies = boundSheetIds.length;
            const totalCopies = copiesCount + usedCopies;
            return {
              ok: true,
              until: untilIso,
              row: r + 1,
              message: 'SHEET_ALLOWED',
              quota: {remaining: copiesCount, total: totalCopies, used: usedCopies},
            };
          } else {
            // Лист не привязан к этой лицензии
            return {
              ok: false,
              error: 'SHEET_BOUND_TO_OTHER',
              message: 'Эта лицензия привязана к другому аккаунту Google Sheets. Обратитесь к создателю: https://vk.com/daoqub',
              row: r + 1,
            };
          }
        }
      }
    }

    return {ok: false, error: 'NOT_FOUND'};
  } catch (e) {
    return {ok: false, error: 'LICENSE_ERROR: ' + e.message};
  } finally {
    lock.releaseLock();
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
  // images: [{ mimeType, data(base64) }, ...]
  if (!Array.isArray(images) || images.length === 0) throw new Error('NO_IMAGES');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');
  let instruction;
  if (delimiter && delimiter.length) {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой с точным разделителем: ' + delimiter + ' (четыре подчёркивания), лучше на отдельной строке.' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  } else {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы нумерацией (1., 2., 3.).' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  }
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
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true,
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
  // простая очистка
  const t = text
    .replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(_m, code) {
      return '\n' + String(code||'').trim() + '\n';
    })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, function(_m, c) {
      return String(c||'').toUpperCase();
    })
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, function(_m, h) {
      return '\n' + String(h||'').toUpperCase() + ':\n';
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
    cache.put(key, String(n + 1), 2); // TTL 2s
    return true;
  } catch (e) {
    return true;
  }
}

// Server logs to the admin spreadsheet
function serverLog_(info) {
  try {
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
    const headerNeeded = sh.getLastRow() === 0;
    if (headerNeeded) {
      sh.appendRow(['timestamp', 'action', 'ok', 'error', 'email', 'token', 'promptLen', 'ms']);
    }
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const tokenMasked = maskToken_(info.token);
    sh.appendRow([ts, info.action || '', info.ok ? '1' : '0', info.error || '', info.email || '', tokenMasked, info.promptLen || 0, info.ms || 0]);
  } catch (e) {
    // Игнорируем ошибки логирования чтобы не ломать основной функционал
    console.error('serverLog_ ERROR:', e);
  }
}


function maskToken_(t) {
  const s = String(t || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 4) + '****';
}
