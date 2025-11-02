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
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000); // 10 секунд ожидания
    
    if (!token) return {ok: false, error: 'NO_TOKEN'};
    if (!email) return {ok: false, error: 'NO_EMAIL'};

    // Получаем ID текущей таблицы из запроса (если доступен)
    let currentSheetId = null;
    try {
      // Пытаемся получить ID из контекста, если запрос идет из таблицы
      currentSheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    } catch (e) {
      // В server.gs может не быть активной таблицы, получим ID другим способом
      // ID будет передан в requestData или получен из referrer
      console.log('Cannot get active spreadsheet in server context');
    }
    
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = LICENSE_SHEET_NAME ? ss.getSheetByName(LICENSE_SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return {ok: false, error: 'LICENSE_SHEET_NOT_FOUND'};

    const range = sh.getDataRange();
    const values = range.getValues();
    if (!values || values.length < 2) return {ok: false, error: 'LICENSE_SHEET_EMPTY'};

    const header = values[0].map(function(x) {
      return String(x || '').toLowerCase().trim();
    });

    // Ищем колонки (поддерживаем и старый и новый формат)
    const colEmail = findHeader_(header, ['email', 'e-mail', 'почта', 'емейл']);
    const colToken = findHeader_(header, ['token', 'токен']);
    const colUntil = findHeader_(header, ['until', 'expiry', 'expires', 'дата окончания', 'окончание', 'срок', 'expireddate']);
    const colStatus = findHeader_(header, ['status', 'статус']);
    
    // Новые колонки для привязки листов
    const colSheetIds = findHeader_(header, ['sheet_ids', 'sheets', 'айди таблиц', 'таблицы']);
    const colCopiesCount = findHeader_(header, ['copies_count', 'copies', 'количество копий', 'копии']);

    if (colToken < 0 || colEmail < 0 || colStatus < 0) {
      return {ok: false, error: 'LICENSE_HEADERS_MISSING'};
    }

    // Если нет колонок для привязки - работаем в старом режиме (без проверки листов)
    const hasSheetBinding = (colSheetIds >= 0 && colCopiesCount >= 0);

    const emailL = String(email).toLowerCase().trim();
    const tokenS = String(token).trim();
    const now = new Date();

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const em = String(row[colEmail] || '').toLowerCase().trim();
      const t = String(row[colToken] || '').trim();
      
      if (t && em && t === tokenS && em === emailL) {
        // Базовые проверки статуса
        const status = String(row[colStatus] || '').toLowerCase().trim();
        const active = (status === 'active' || status === 'активен' || status === 'активный');
        if (!active) return {ok: false, error: 'INACTIVE', row: r + 1};

        // Проверка даты истечения
        let untilOk = true; let untilIso = null;
        if (colUntil >= 0) {
          const cell = row[colUntil];
          if (cell) {
            const dt = (cell instanceof Date) ? cell : new Date(cell);
            untilOk = dt && dt >= now;
            untilIso = dt && dt.toISOString();
          }
        }
        if (!untilOk) return {ok: false, error: 'EXPIRED', until: untilIso, row: r + 1};

        // Если нет системы привязки листов - просто разрешаем
        if (!hasSheetBinding) {
          return {ok: true, until: untilIso, row: r + 1, message: 'NO_SHEET_BINDING'};
        }

        // Если нет ID текущей таблицы - разрешаем (может быть системный запрос)
        if (!currentSheetId) {
          return {ok: true, until: untilIso, row: r + 1, message: 'NO_SHEET_CONTEXT'};
        }

        // Работа с привязкой листов
        const sheetIds = String(row[colSheetIds] || '').trim();
        const copiesCount = parseInt(row[colCopiesCount] || '0');

        // Если поле sheet_ids пустое - новая лицензия
        if (!sheetIds) {
          // Проверяем остались ли копии
          if (copiesCount <= 0) {
            return {
              ok: false, 
              error: 'NO_QUOTA_LEFT', 
              message: 'Количество копий исчерпано. Обратитесь к создателю для обновления лицензии: https://vk.com/daoqub',
              row: r + 1,
              quota: {remaining: 0, total: copiesCount}
            };
          }
          
          // Привязываем текущую таблицу
          try {
            const sheetName = SpreadsheetApp.openById(currentSheetId).getName();
            const bindingInfo = currentSheetId + '\n' + sheetName + ' (' + new Date().toLocaleDateString() + ')';
            const newCopiesCount = copiesCount - 1;
            
            // Обновляем лицензионную таблицу
            sh.getRange(r + 1, colSheetIds + 1).setValue(bindingInfo);
            sh.getRange(r + 1, colCopiesCount + 1).setValue(newCopiesCount);
            
            return {
              ok: true, 
              until: untilIso, 
              row: r + 1, 
              message: 'SHEET_BOUND',
              quota: {remaining: newCopiesCount, total: copiesCount, used: 1}
            };
          } catch (e) {
            return {ok: false, error: 'SHEET_BINDING_ERROR: ' + e.message, row: r + 1};
          }
        } else {
          // Проверяем привязан ли текущий лист
          const boundSheetIds = sheetIds.split('\n')
            .map(function(line) { return line.trim(); })
            .filter(function(line) { return line.length > 0; })
            .map(function(line) { 
              // Извлекаем ID (первая часть до пробела или переноса)
              return line.split(' ')[0].split('\t')[0]; 
            });
          
          if (boundSheetIds.indexOf(currentSheetId) !== -1) {
            // Лист уже привязан - разрешаем
            const usedCopies = boundSheetIds.length;
            const totalCopies = copiesCount + usedCopies;
            return {
              ok: true, 
              until: untilIso, 
              row: r + 1, 
              message: 'SHEET_ALLOWED',
              quota: {remaining: copiesCount, total: totalCopies, used: usedCopies}
            };
          } else {
            // Лист не привязан к этой лицензии
            return {
              ok: false, 
              error: 'SHEET_BOUND_TO_OTHER',
              message: 'Эта лицензия привязана к другому аккаунту Google Sheets. Обратитесь к создателю: https://vk.com/daoqub',
              row: r + 1
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
  const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
  const sh = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
  const headerNeeded = sh.getLastRow() === 0;
  if (headerNeeded) {
    sh.appendRow(['timestamp', 'action', 'ok', 'error', 'email', 'token', 'promptLen', 'ms']);
  }
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  const tokenMasked = maskToken_(info.token);
  sh.appendRow([ts, info.action || '', info.ok ? '1' : '0', info.error || '', info.email || '', tokenMasked, info.promptLen || 0, info.ms || 0]);
}

function maskToken_(t) {
  const s = String(t || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 4) + '****';
}
