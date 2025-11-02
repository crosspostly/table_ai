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
  return json_({ ok: true, ping: 'pong', time: new Date().toISOString() });
}

function doPost(e) {
  try {
    var data = parseBody_(e);
    var action = (data.action || '').toString();
    var token = (data.token || '').toString();
    var email = (data.email || '').toString();
    var sheetId = (data.sheetId || '').toString();  // ← ДОБАВЛЕНО

    // License gate for all actions except 'status'
    if (action !== 'status') {
      var lic = checkLicense_(token, email, sheetId);  // ← ДОБАВЛЕН sheetId
      if (!lic.ok) return json_({ ok: false, error: lic.error || 'UNAUTHORIZED' }, 403);
    }

    switch (action) {
      case 'gm': {
        var prompt = (data.prompt || '').toString();
        var maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
        var temperature = data.temperature == null ? 0.7 : +data.temperature;
        var apiKey = (data.apiKey || '').toString();
        if (!apiKey) return json_({ ok: false, error: 'NO_CLIENT_KEY' }, 400);
        // rate limit
        if (!rateLimitOk_(token)) return json_({ ok: false, error: 'RATE_LIMIT' }, 429);

        var t0 = Date.now();
        var ok = true, err = null, text = '';
        try {
          text = serverGM_(prompt, maxTokens, temperature, apiKey);
        } catch (ex) {
          ok = false; err = String(ex && ex.message || ex);
        }
        try { serverLog_({ action: 'gm', ok: ok, error: err, email: email, token: token, promptLen: prompt.length, ms: Date.now() - t0 }); } catch (_) {}
        if (!ok) return json_({ ok: false, error: err }, 500);
        return json_({ ok: true, data: text });
      }
      case 'gm_image': {
        var images = data.images || [];
        var lang = (data.lang || 'ru').toString();
        var apiKey2 = (data.apiKey || '').toString();
        var delimiter = (data.delimiter && String(data.delimiter).trim()) ? String(data.delimiter).trim() : null;
        if (!apiKey2) return json_({ ok: false, error: 'NO_CLIENT_KEY' }, 400);
        if (!Array.isArray(images) || images.length === 0) return json_({ ok: false, error: 'NO_IMAGES' }, 400);
        if (!rateLimitOk_(token)) return json_({ ok: false, error: 'RATE_LIMIT' }, 429);

        var t1 = Date.now();
        var ok2 = true, err2 = null, text2 = '';
        try {
          text2 = serverGMImage_(images, lang, apiKey2, delimiter);
        } catch (ex2) {
          ok2 = false; err2 = String(ex2 && ex2.message || ex2);
        }
        try { serverLog_({ action: 'gm_image', ok: ok2, error: err2, email: email, token: token, promptLen: images.length, ms: Date.now() - t1 }); } catch (_) {}
        if (!ok2) return json_({ ok: false, error: err2 }, 500);
        return json_({ ok: true, data: text2 });
      }
      case 'status': {
        var status = checkLicense_(token, email, sheetId);  // ← ДОБАВЛЕН sheetId
        try { serverLog_({ action: 'status', ok: status.ok, error: status.error || null, email: email, token: token, promptLen: 0, ms: 0 }); } catch (_) {}
        return json_({ 
          ok: status.ok, 
          error: status.error || null, 
          until: status.until || null, 
          row: status.row || null,
          quota: status.quota || null,     // ← ДОБАВЛЕНО
          message: status.message || null  // ← ДОБАВЛЕНО
        });
      }
      default:
        return json_({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) }, 500);
  }
}


// ===== License =====
// ===== License (ПОЛНАЯ ВЕРСИЯ с привязкой таблиц) =====
function checkLicense_(token, email, sheetId) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    
    if (!token) return {ok: false, error: 'NO_TOKEN'};
    if (!email) return {ok: false, error: 'NO_EMAIL'};

    var ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    var sh = LICENSE_SHEET_NAME ? ss.getSheetByName(LICENSE_SHEET_NAME) : ss.getSheets()[0];
    if (!sh) return {ok: false, error: 'LICENSE_SHEET_NOT_FOUND'};

    var range = sh.getDataRange();
    var values = range.getValues();
    if (!values || values.length < 2) return {ok: false, error: 'LICENSE_SHEET_EMPTY'};

    var emailL = String(email).toLowerCase().trim();
    var tokenS = String(token).trim();
    var now = new Date();

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var em = String(row[0] || '').toLowerCase().trim();     // Email (колонка 0)
      var t = String(row[1] || '').trim();                    // Token (колонка 1)
      var dateCell = row[2];                                  // ExpiredDate (колонка 2)
      var statusCell = String(row[3] || '').toLowerCase().trim(); // Status (колонка 3)
      var sheetIdsCell = String(row[4] || '').trim();         // sheet_ids (колонка 4)
      var copiesCountCell = row[5];                           // copies_count (колонка 5)
      
      if (t && em && t === tokenS && em === emailL) {
        // 1. Проверка статуса
        var active = (statusCell === 'active' || statusCell === 'активен' || statusCell === 'активный');
        if (!active) return {ok: false, error: 'INACTIVE', row: r + 1};

        // 2. Проверка даты истечения
        var untilOk = true;
        var untilIso = null;
        
        if (dateCell) {
          var dt = (dateCell instanceof Date) ? dateCell : new Date(dateCell);
          untilOk = dt && dt >= now;
          untilIso = dt && dt.toISOString();
        }
        
        if (!untilOk) return {ok: false, error: 'EXPIRED', until: untilIso, row: r + 1};

        // 3. Проверка системы привязки листов
        var copiesCount = parseInt(String(copiesCountCell || '0').trim()) || 0;
        
        // Если нет sheetId - работаем без привязки (только квоты)
        if (!sheetId) {
          if (copiesCount <= 0) {
            return {
              ok: false,
              error: 'NO_QUOTA_LEFT',
              row: r + 1,
              quota: {remaining: 0, total: 0}
            };
          }
          
          return {
            ok: true,
            until: untilIso,
            row: r + 1,
            message: 'NO_SHEET_CONTEXT',
            quota: {remaining: copiesCount, total: copiesCount}
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
              quota: {remaining: 0, total: 0}
            };
          }
          
          // Привязываем текущую таблицу
          try {
            var sheetName = 'Unknown Sheet';
            try {
              sheetName = SpreadsheetApp.openById(sheetId).getName();
            } catch (e) {
              // Название получить не удалось - не критично
            }
            
            var bindingInfo = sheetId + '\n' + sheetName + ' (' + new Date().toLocaleDateString() + ')';
            var newCopiesCount = copiesCount - 1;
            
            // Обновляем лицензионную таблицу
            sh.getRange(r + 1, 5).setValue(bindingInfo);        // колонка 4 (sheet_ids) = индекс 4, но getRange начинается с 1
            sh.getRange(r + 1, 6).setValue(newCopiesCount);     // колонка 5 (copies_count) = индекс 5, но getRange начинается с 1
            
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
          var boundSheetIds = sheetIdsCell.split('\n')
            .map(function(line) { return line.trim(); })
            .filter(function(line) { return line.length > 0; })
            .map(function(line) { 
              return line.split(' ')[0].split('\t')[0]; 
            });
          
          if (boundSheetIds.indexOf(sheetId) !== -1) {
            // Лист уже привязан - разрешаем
            var usedCopies = boundSheetIds.length;
            var totalCopies = copiesCount + usedCopies;
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
  for (var i = 0; i < headerArr.length; i++) {
    var h = headerArr[i];
    for (var j = 0; j < keys.length; j++) {
      if (h === keys[j]) return i;
    }
  }
  return -1;
}

// ===== Gemini (server-side) =====
function serverGM_(prompt, maxTokens, temperature, apiKey) {
  if (!prompt || typeof prompt !== 'string') throw new Error('EMPTY_PROMPT');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');

  var requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: temperature }
  };
  var options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, options);
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    var msg = data && data.error && data.error.message || ('HTTP_' + code);
    throw new Error(msg);
  }
  var candidate = data.candidates && data.candidates[0];
  var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  var text = content && content.text ? content.text : '';
  return serverProcessMarkdown_(text);
}

function serverGMImage_(images, lang, apiKey, delimiter) {
  // images: [{ mimeType, data(base64) }, ...]
  if (!Array.isArray(images) || images.length === 0) throw new Error('NO_IMAGES');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');
  var instruction;
  if (delimiter && delimiter.length) {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой с точным разделителем: ' + delimiter + ' (четыре подчёркивания), лучше на отдельной строке.' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  } else {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы нумерацией (1., 2., 3.).' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  }
  var parts = [{ text: instruction }];
  for (var i = 0; i < images.length; i++) {
    var it = images[i] || {};
    var mt = String(it.mimeType || 'image/png');
    var dt = String(it.data || '');
    if (!dt) continue;
    parts.push({ inlineData: { mimeType: mt, data: dt } });
  }
  if (parts.length <= 1) throw new Error('NO_VALID_IMAGES');
  var body = { contents: [{ parts: parts }], generationConfig: { maxOutputTokens: 4096, temperature: 0 } };
  var resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    var msg = data && data.error && data.error.message || ('HTTP_' + code);
    throw new Error(msg);
  }
  var candidate = data.candidates && data.candidates[0];
  var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  var text = content && content.text ? content.text : '';
  return serverProcessMarkdown_(text);
}

function serverProcessMarkdown_(text) {
  if (!text || typeof text !== 'string') return text;
  var isMd = /\*\*[^*]+\*\*|\*[^*]+\*|^#{1,6}\s+/m.test(text) || /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  if (!isMd) return text;
  // простая очистка
  var t = text
    .replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(_m, code){ return '\n' + String(code||'').trim() + '\n'; })
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, function(_m, c){ return String(c||'').toUpperCase(); })
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+(.+)$/gm, function(_m, h){ return '\n' + String(h||'').toUpperCase() + ':\n'; })
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return t;
}

// ===== Utils =====
function parseBody_(e) {
  try {
    var raw = e && e.postData && e.postData.contents;
    return raw ? JSON.parse(raw) : {};
  } catch (err) { return {}; }
}

function json_(obj, status) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  if (status && out.setResponseCode) out.setResponseCode(status);
  return out;
}

// Rate limit: max N requests per second per token
function rateLimitOk_(token) {
  try {
    var cache = CacheService.getScriptCache();
    var sec = Math.floor(Date.now() / 1000);
    var key = 'rl:' + String(token || '').trim() + ':' + sec;
    var v = cache.get(key);
    var n = v ? parseInt(v, 10) : 0;
    if (n >= RATE_LIMIT_PER_SEC) return false;
    cache.put(key, String(n + 1), 2); // TTL 2s
    return true;
  } catch (e) { return true; }
}

// Server logs to the admin spreadsheet
function serverLog_(info) {
  try {
    var ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    var sh = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
    var headerNeeded = sh.getLastRow() === 0;
    if (headerNeeded) {
      sh.appendRow(['timestamp', 'action', 'ok', 'error', 'email', 'token', 'promptLen', 'ms']);
    }
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    var tokenMasked = maskToken_(info.token);
    sh.appendRow([ts, info.action || '', info.ok ? '1' : '0', info.error || '', info.email || '', tokenMasked, info.promptLen || 0, info.ms || 0]);
  } catch (e) {
    // Игнорируем ошибки логирования чтобы не ломать основной функционал
    console.error('serverLog_ ERROR:', e);
  }
}


function maskToken_(t) {
  var s = String(t || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 4) + '****';
}
