// Table AI Server (Apps Script Web App)
// Backend: лицензии, прокси к Gemini с КЛЮЧОМ КЛИЕНТА, серверные логи

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const LICENSE_SHEET_NAME = 'Tokens';
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3; // max запросов/сек на токен

// ===== Entry points =====
function doGet(_e) {
  return json_({ok: true, ping: 'pong', time: new Date().toISOString()});
}

function doPost(_e) {
  try {
    const data = parseBody_(_e);
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
    case 'collect_config_preview': {
      const config = data.config || {};
      const spreadsheetId = (data.spreadsheetId || '').toString();
      const tableId = (data.tableId || '').toString();
      const logs = [];

      const t0 = Date.now();
      let ok = true;
      let err = null;
      let preview = '';
      try {
        if (!config) throw new Error('NO_CONFIG');
        if (!spreadsheetId && !tableId) throw new Error('NO_SPREADSHEET_ID');

        // Read data for preview
        if (config.userData && config.userData.length > 0) {
          const previews = [];
          config.userData.forEach(function(source, index) {
            if (source.sheet && source.cell) {
              try {
                const dataText = tableId ?
                  serverReadData_(tableId, source.sheet, source.cell, logs) :
                  serverReadData_(spreadsheetId, source.sheet, source.cell, logs);
                const trimmed = dataText.length > 100 ? dataText.substring(0, 100) + '...' : dataText;
                previews.push(`Источник ${index + 1} (${source.sheet}!${source.cell}): ${trimmed}`);
              } catch (e) {
                previews.push(`Источник ${index + 1}: Ошибка - ${e.message}`);
              }
            }
          });
          preview = previews.join('\n\n');
        } else {
          preview = '(нет данных для предпросмотра)';
        }
      } catch (ex) {
        ok = false;
        err = String(ex && ex.message || ex);
      }

      try {
        serverLog_({
          action: 'collect_config_preview',
          ok: ok,
          error: err,
          email: email,
          token: token,
          promptLen: preview.length,
          ms: Date.now() - t0,
        });
      } catch (_) {}
      if (!ok) return json_({ok: false, error: err, logs: logs}, 400);
      return json_({ok: true, data: preview, logs: logs});
    }
    case 'collect_config_execute': {
      const config = data.config || {};
      const spreadsheetId = (data.spreadsheetId || '').toString();
      const sheetName = (data.sheetName || '').toString();
      const cellAddress = (data.cellAddress || '').toString();
      const apiKey = (data.apiKey || '').toString();
      const logs = [];

      // Validate required fields
      if (!config) return json_({ok: false, error: 'NO_CONFIG', logs: logs}, 400);
      if (!spreadsheetId) return json_({ok: false, error: 'NO_SPREADSHEET_ID', logs: logs}, 400);
      if (!sheetName) return json_({ok: false, error: 'NO_SHEET_NAME', logs: logs}, 400);
      if (!cellAddress) return json_({ok: false, error: 'NO_CELL_ADDRESS', logs: logs}, 400);
      if (!apiKey) return json_({ok: false, error: 'NO_API_KEY', logs: logs}, 400);

      // Rate limit for execute calls
      if (!rateLimitOk_(token)) return json_({ok: false, error: 'RATE_LIMIT', logs: logs}, 429);

      const t0 = Date.now();
      let ok = true;
      let err = null;
      let result = '';
      try {
        result = serverCollectConfigExecute_(config, spreadsheetId, sheetName, cellAddress, apiKey, logs);
      } catch (ex) {
        ok = false;
        err = String(ex && ex.message || ex);
      }
      try {
        serverLog_({
          action: 'collect_config_execute',
          ok: ok,
          error: err,
          email: email,
          token: token,
          promptLen: result.length,
          ms: Date.now() - t0,
        });
      } catch (_) {}
      if (!ok) return json_({ok: false, error: err, logs: logs}, 500);
      return json_({ok: true, data: result, logs: logs});
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
            sh.getRange(r + 1, 5).setValue(bindingInfo); // колонка 4 (sheet_ids) = индекс 4, но getRange с 1
            sh.getRange(r + 1, 6).setValue(newCopiesCount); // колонка 5 (copies_count) = индекс 5, но getRange с 1

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

// ===== Gemini (server-side) =====
function serverGM_(prompt, maxTokens, temperature, apiKey) {
  if (!prompt || typeof prompt !== 'string') throw new Error('EMPTY_PROMPT');
  if (!apiKey) throw new Error('NO_CLIENT_KEY');

  const requestBody = {
    contents: [{parts: [{text: prompt}]}],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature,
    },
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
function isTableId(str) {
  return /^[a-zA-Z0-9_-]{44}$/.test(str);
}

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

// ===== CollectConfig Server Functions =====

/**
 * Execute CollectConfig configuration on the server
 * @param {Object} config - CollectConfig configuration
 * @param {string} spreadsheetId - Target spreadsheet ID
 * @param {string} sheetName - Target sheet name
 * @param {string} cellAddress - Target cell address
 * @param {string} apiKey - Gemini API key
 * @param {Array} logs - Array to collect log entries
 * @return {string} AI response text
 */
function serverCollectConfigExecute_(config, spreadsheetId, sheetName, cellAddress, apiKey, logs) {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '🚀 Начало выполнения CollectConfig на сервере'});

  try {
    // Get system prompt
    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📖 Загрузка System Prompt...'});
    const systemPrompt = serverGetSystemPrompt_(config, spreadsheetId, logs);
    if (systemPrompt) {
      logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ System Prompt загружен: ${systemPrompt.length} символов`});
    } else {
      logs.push({timestamp: new Date().toISOString(), level: 'WARN', message: '⚠️ System Prompt не задан'});
    }

    // Get user data
    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📦 Загрузка User Data...'});
    const userDataParts = [];
    if (config.userData && config.userData.length > 0) {
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `📦 User Data: ${config.userData.length} источников`});

      config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  📍 Источник ${index + 1}: ${source.sheet}!${source.cell}`});
          try {
            const data = serverReadData_(spreadsheetId, source.sheet, source.cell, logs);
            logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `  ✅ Прочитано: ${data.length} символов`});
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `  ❌ Ошибка: ${e.message}`});
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n[ОШИБКА: ${e.message}]`);
          }
        }
      });
    } else {
      logs.push({timestamp: new Date().toISOString(), level: 'WARN', message: '⚠️ User Data не задан'});
    }

    // Build final prompt
    let finalPrompt = '';
    if (systemPrompt) {
      finalPrompt += systemPrompt + '\n\n---\n\n';
    }
    if (userDataParts.length > 0) {
      finalPrompt += 'ДАННЫЕ:\n' + userDataParts.join('\n\n');
    }

    if (!finalPrompt.trim()) {
      throw new Error('Нет данных для обработки!');
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `📝 Финальный промпт: ${finalPrompt.length} символов`});

    // Call AI with defaults or config overrides
    const maxTokens = config.maxTokens || 25000;
    const temperature = config.temperature || 0.7;

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '🤖 Отправка запроса в Gemini...'});
    const aiResult = serverGM_(finalPrompt, maxTokens, temperature, apiKey);

    if (!aiResult || aiResult.startsWith('Error:')) {
      throw new Error('Ошибка AI: ' + aiResult);
    }

    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ Получен ответ от AI: ${aiResult.length} символов`});

    // Write result to target sheet
    try {
      const targetSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const targetSheet = targetSpreadsheet.getSheetByName(sheetName);
      if (targetSheet) {
        targetSheet.getRange(cellAddress).setValue(aiResult);
        logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ Результат записан в ${sheetName}!${cellAddress}`});
      } else {
        throw new Error(`Лист "${sheetName}" не найден`);
      }
    } catch (e) {
      logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `❌ Ошибка записи результата: ${e.message}`});
      throw new Error(`Не удалось записать результат в ${sheetName}!${cellAddress}: ${e.message}`);
    }

    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: '✅ Выполнение CollectConfig завершено успешно'});
    return aiResult;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `❌ Ошибка выполнения: ${error.message}`});
    throw error;
  }
}

/**
 * Get system prompt from configuration
 * @param {Object} config - CollectConfig configuration
 * @param {string} defaultSpreadsheetId - Default spreadsheet ID
 * @param {Array} logs - Array to collect log entries
 * @return {string} System prompt text
 */
function serverGetSystemPrompt_(config, defaultSpreadsheetId, logs) {
  if (!config.systemPrompt || !config.systemPrompt.sheet || !config.systemPrompt.cell) {
    return '';
  }

  let spreadsheetId;
  let sheetName;

  const promptSource = config.systemPrompt.sheet;

  try {
    if (isTableId(promptSource)) {
      // ID защищённой таблицы
      spreadsheetId = promptSource;
      sheetName = 'Промты'; // ВСЕГДА Промты!
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Защищённая таблица: ' + spreadsheetId});
    } else {
      // Название листа в текущей таблице
      spreadsheetId = defaultSpreadsheetId;
      sheetName = promptSource;
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Текущая таблица, лист: ' + sheetName});
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📍 Ячейка: ' + config.systemPrompt.cell});

    const prompt = serverReadData_(spreadsheetId, sheetName, config.systemPrompt.cell, logs);

    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: '✅ Промпт прочитан, ' + prompt.length + ' символов'});

    return prompt;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: '❌ Ошибка чтения System Prompt: ' + error.message});
    throw new Error('Не удалось прочитать System Prompt: ' + error.message);
  }
}

/**
 * Read data from spreadsheet
 * @param {string} spreadsheetId - Spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} cellAddress - Cell/range address
 * @param {Array} logs - Array to collect log entries
 * @return {string} Flattened text data
 */
function serverReadData_(spreadsheetId, sheetName, cellAddress, logs) {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → Чтение ${sheetName}!${cellAddress} из ${spreadsheetId}`});

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не найден`);
    }

    // Read range
    const range = sheet.getRange(cellAddress);
    const values = range.getValues();

    if (!values || values.length === 0) {
      logs.push({timestamp: new Date().toISOString(), level: 'WARN', message: `  → Пустой диапазон: ${cellAddress}`});
      return '';
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → Прочитано: ${values.length} строк × ${values[0] ? values[0].length : 0} столбцов`});

    // Flatten and filter empty values
    const result = [];
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        const val = values[r][c];
        if (val !== null && val !== undefined && val.toString().trim() !== '') {
          result.push(val.toString());
        }
      }
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → После фильтрации: ${result.length} значений`});

    return result.join('\n');
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `  ❌ Ошибка чтения: ${error.message}`});
    throw new Error(`Не удалось прочитать ${sheetName}!${cellAddress}: ${error.message}`);
  }
}
