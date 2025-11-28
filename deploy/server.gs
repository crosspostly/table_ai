// Table AI Server (Apps Script Web App)
// Backend: диспетчер + лицензирование + OTA обновления
// v3.0.0 - Thick Server + Thin Client Architecture

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const LICENSE_SHEET_NAME = 'Tokens';
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3; // max запросов/сек на токен
const SERVER_VERSION = '3.0.0'; // Версия сервера для OTA

// ===== Entry points =====
function doGet(_e) {
  return json_({ok: true, ping: 'pong', time: new Date().toISOString()});
}

function doPost(_e) {
  try {
    Logger.log('=== doPost START ===');

    const data = parseBody_(_e);
    const action = (data.action || '').toString();
    const subaction = (data.subaction || '').toString();
    const token = (data.token || '').toString();
    const email = (data.email || '').toString();

    // ⭐ ОБА ID для разных целей
    const scriptId = (data.scriptId || '').toString(); // ⭐ Для привязки
    const spreadsheetId = (data.spreadsheetId || '').toString(); // ⭐ Для работы
    const apiKey = (data.apiKey || '').toString();
    const clientVersion = (data.clientVersion || '').toString(); // Для OTA

    Logger.log('action: ' + action);
    Logger.log('subaction: ' + subaction);
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
    Logger.log('scriptId: ' + (scriptId ? scriptId.substring(0, 12) + '...' : 'NOT SET')); // ⭐
    Logger.log('spreadsheetId: ' + (spreadsheetId ? 'SET' : 'NOT SET')); // ⭐
    Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));
    Logger.log('clientVersion: ' + clientVersion);

    // License gate for all actions except 'status', 'validate', and OTA
    if (action !== 'status' && action !== 'validate' && action !== 'ota') {
      Logger.log('Checking license...');
      const lic = checkLicense_(token, email, scriptId, spreadsheetId); // ✅ Оба ID
      Logger.log('License check result: ' + JSON.stringify(lic));

      if (!lic.ok) {
        Logger.log('License check FAILED: ' + lic.error);
        return json_({ok: false, error: lic.error || 'UNAUTHORIZED'}, 403);
      }
      Logger.log('License check PASSED');
    }

    // ===== ДИСПЕТЧЕР АКЦИЙ =====
    switch (action) {
    case 'ota':
      return handleOTA(subaction, data, clientVersion);

    case 'gm':
      return handleGemini(data, token, email);

    case 'gm_image':
      return handleGeminiImage(data, token, email);

    case 'status':
    case 'validate':
      return handleStatus(data, token, email, scriptId, spreadsheetId);

    case 'collectConfig':
      return handleCollectConfig(subaction, data, spreadsheetId);

    case 'ocr':
      return handleOCR(subaction, data, spreadsheetId);

    case 'vk':
      return handleVK(subaction, data, spreadsheetId);

    case 'unpacking':
      return handleUnpacking(subaction, data, spreadsheetId);

    case 'batchUpdate':
      return handleBatchUpdate(subaction, data, spreadsheetId);

    default:
      Logger.log('ERROR: Unknown action - ' + action);
      return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }
  } catch (err) {
    Logger.log('doPost ERROR: ' + String(err.message || err));
    return json_({ok: false, error: String(err && err.message || err)}, 500);
  }
}


// ===== ОБРАБОТЧИКИ АКЦИЙ =====

/**
 * Обработчик OTA запросов
 */
function handleOTA(subaction, data, clientVersion) {
  Logger.log('Processing OTA subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'checkUpdates':
      return {
        ok: true,
        serverVersion: SERVER_VERSION,
        clientVersion: clientVersion,
        updateAvailable: clientVersion < SERVER_VERSION,
        availableFiles: [
          {name: 'Main.gs', size: '8 KB', checksum: 'main_v3_checksum'},
          {name: 'CollectConfigUi.html', size: '12 KB', checksum: 'ui_v3_checksum'},
          {name: 'UnpackingViewerUI.html', size: '10 KB', checksum: 'unpacking_v3_checksum'},
          {name: 'SettingsUI.html', size: '8 KB', checksum: 'settings_v3_checksum'},
          {name: 'logging_system.html', size: '5 KB', checksum: 'logs_v3_checksum'},
        ],
      };

    case 'getFileContent':
      const fileName = data.fileName;
      if (!fileName) {
        return {ok: false, error: 'NO_FILE_NAME'};
      }

      const content = fetchFileContent_(fileName);
      if (!content) {
        return {ok: false, error: 'FILE_NOT_FOUND'};
      }

      return {
        ok: true,
        fileName: fileName,
        content: content,
        fileType: 'text/plain',
        version: SERVER_VERSION,
      };

    default:
      return {ok: false, error: 'UNKNOWN_OTA_SUBACTION'};
    }
  } catch (e) {
    Logger.log('OTA handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

/**
 * Обработчик Gemini запросов
 */
function handleGemini(data, token, email) {
  Logger.log('Processing gm action');
  const prompt = (data.prompt || '').toString();
  const maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
  const temperature = data.temperature == null ? 0.7 : +data.temperature;
  const userApiKey = (data.apiKey || '').toString();

  Logger.log('prompt length: ' + prompt.length);
  Logger.log('maxTokens: ' + maxTokens);
  Logger.log('temperature: ' + temperature);
  Logger.log('userApiKey: ' + (userApiKey ? 'SET (length: ' + userApiKey.length + ')' : 'NOT SET'));

  // API key priority: use user key first, otherwise fallback to default
  let finalApiKey = userApiKey;
  let keySource = 'USER';

  if (!userApiKey) {
    const defaultApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (defaultApiKey) {
      finalApiKey = defaultApiKey;
      keySource = 'DEFAULT';
      Logger.log('Using DEFAULT API key, length: ' + defaultApiKey.length);
    } else {
      Logger.log('ERROR: No API key available (neither user nor default)');
      return json_({ok: false, error: 'NO_API_KEY_AVAILABLE'}, 400);
    }
  } else {
    Logger.log('Using USER API key, length: ' + userApiKey.length);
  }

  // rate limit
  if (!rateLimitOk_(token)) {
    Logger.log('Rate limit exceeded for token');
    return json_({ok: false, error: 'RATE_LIMIT'}, 429);
  }

  Logger.log('Calling serverGM_ with ' + keySource + ' API key');
  const t0 = Date.now();
  let ok = true; let err = null; let text = '';
  try {
    text = serverGM_(prompt, maxTokens, temperature, finalApiKey);
    Logger.log('serverGM_ completed successfully, response length: ' + text.length);
  } catch (ex) {
    ok = false;
    err = String(ex && ex.message || ex);
    Logger.log('serverGM_ failed: ' + err);
  }

  try {
    serverLog_({
      action: 'gm',
      ok: ok,
      error: err,
      email: email,
      token: token,
      promptLen: prompt.length,
      ms: Date.now() - t0,
      keySource: keySource,
    });
  } catch (_) {}

  if (!ok) {
    Logger.log('Returning error response: ' + err);
    return json_({ok: false, error: err}, 500);
  }

  Logger.log('Returning successful response');
  return json_({ok: true, data: text});
}

/**
 * Обработчик Gemini Image запросов
 */
function handleGeminiImage(data, token, email) {
  Logger.log('Processing gm_image action');
  const images = data.images || [];
  const lang = (data.lang || 'ru').toString();
  const userApiKey = (data.apiKey || '').toString();
  const delimiter = (data.delimiter && String(data.delimiter).trim()) ? String(data.delimiter).trim() : null;

  Logger.log('images count: ' + images.length);
  Logger.log('lang: ' + lang);
  Logger.log('userApiKey: ' + (userApiKey ? 'SET (length: ' + userApiKey.length + ')' : 'NOT SET'));
  Logger.log('delimiter: ' + (delimiter || 'NONE'));

  // API key priority: use user key first, otherwise fallback to default
  const finalApiKey = userApiKey;
  let keySource = 'USER';

  if (!userApiKey) {
    const defaultApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (defaultApiKey) {
      keySource = 'DEFAULT';
      Logger.log('Using DEFAULT API key, length: ' + defaultApiKey.length);
    } else {
      Logger.log('ERROR: No API key available (neither user nor default)');
      return json_({ok: false, error: 'NO_API_KEY_AVAILABLE'}, 400);
    }
  } else {
    Logger.log('Using USER API key, length: ' + userApiKey.length);
  }

  if (!Array.isArray(images) || images.length === 0) {
    Logger.log('ERROR: No images provided');
    return json_({ok: false, error: 'NO_IMAGES'}, 400);
  }

  if (!rateLimitOk_(token)) {
    Logger.log('Rate limit exceeded for token');
    return json_({ok: false, error: 'RATE_LIMIT'}, 429);
  }

  Logger.log('Calling serverGMImage_ with ' + keySource + ' API key');
  const t1 = Date.now();
  let ok2 = true;
  let err2 = null;
  let text2 = '';
  try {
    text2 = serverGMImage_(images, lang, finalApiKey, delimiter);
    Logger.log('serverGMImage_ completed successfully, response length: ' + text2.length);
  } catch (ex2) {
    ok2 = false;
    err2 = String(ex2 && ex2.message || ex2);
    Logger.log('serverGMImage_ failed: ' + err2);
  }

  try {
    serverLog_({
      action: 'gm_image',
      ok: ok2,
      error: err2,
      email: email,
      token: token,
      promptLen: images.length,
      ms: Date.now() - t1,
      keySource: keySource,
    });
  } catch (_) {}

  if (!ok2) {
    Logger.log('Returning error response: ' + err2);
    return json_({ok: false, error: err2}, 500);
  }

  Logger.log('Returning successful response');
  return json_({ok: true, data: text2});
}

/**
 * Обработчик статуса лицензии
 */
function handleStatus(data, token, email, scriptId, spreadsheetId) {
  Logger.log('Processing status action');
  const status = checkLicense_(token, email, scriptId, spreadsheetId); // ✅
  Logger.log('License check result: ' + JSON.stringify(status));

  try {
    serverLog_({
      action: 'status',
      ok: status.ok,
      error: status.error || null,
      email: email,
      token: token,
      promptLen: 0,
      ms: 0,
      keySource: 'NONE',
    });
  } catch (_) {}

  Logger.log('Returning status response');
  return json_({
    ok: status.ok,
    error: status.error || null,
    until: status.until || null,
    row: status.row || null,
    quota: status.quota || null,
    message: status.message || null,
  });
}

/**
 * Обработчик CollectConfig запросов
 */
function handleCollectConfig(subaction, data, spreadsheetId) {
  Logger.log('Processing CollectConfig subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'init':
      return collectConfigInit(spreadsheetId, data);

    case 'preview':
      return collectConfigPreview(spreadsheetId, data.config || {});

    case 'execute':
      return collectConfigExecute(spreadsheetId, data.config || {}, data);

    case 'save':
      return collectConfigSave(spreadsheetId, data.config || {}, data);

    case 'delete':
      return collectConfigDelete(spreadsheetId, data);

    case 'getTemplates':
      return collectConfigGetTemplates(spreadsheetId, data);

    default:
      return {ok: false, error: 'UNKNOWN_COLLECTCONFIG_SUBACTION'};
    }
  } catch (e) {
    Logger.log('CollectConfig handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

/**
 * Обработчик OCR запросов
 */
function handleOCR(subaction, data, spreadsheetId) {
  Logger.log('Processing OCR subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'queue':
      return ocrQueue(spreadsheetId, data);

    case 'getStatus':
      return ocrGetStatus(spreadsheetId, data);

    case 'processBatch':
      return ocrProcessBatch(spreadsheetId, data);

    default:
      return {ok: false, error: 'UNKNOWN_OCR_SUBACTION'};
    }
  } catch (e) {
    Logger.log('OCR handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

/**
 * Обработчик VK запросов
 */
function handleVK(subaction, data, spreadsheetId) {
  Logger.log('Processing VK subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'importPosts':
      return vkImportPosts(spreadsheetId, data);

    case 'parsePost':
      return vkParsePost(spreadsheetId, data);

    case 'getStatus':
      return vkGetStatus(spreadsheetId, data);

    default:
      return {ok: false, error: 'UNKNOWN_VK_SUBACTION'};
    }
  } catch (e) {
    Logger.log('VK handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

/**
 * Обработчик Unpacking запросов
 */
function handleUnpacking(subaction, data, spreadsheetId) {
  Logger.log('Processing Unpacking subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'fetch':
      return unpackingFetch(spreadsheetId, data);

    case 'exportToDoc':
      return unpackingExportToDoc(spreadsheetId, data);

    case 'listExports':
      return unpackingListExports(spreadsheetId, data);

    case 'clear':
      return unpackingClear(spreadsheetId, data);

    default:
      return {ok: false, error: 'UNKNOWN_UNPACKING_SUBACTION'};
    }
  } catch (e) {
    Logger.log('Unpacking handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

/**
 * Обработчик BatchUpdate запросов
 */
function handleBatchUpdate(subaction, data, spreadsheetId) {
  Logger.log('Processing BatchUpdate subaction: ' + subaction);

  try {
    switch (subaction) {
    case 'runSegment':
      return batchUpdateRunSegment(spreadsheetId, data);

    case 'runBatch':
      return batchUpdateRunBatch(spreadsheetId, data);

    case 'runImport':
      return batchUpdateRunImport(spreadsheetId, data);

    case 'getStatus':
      return batchUpdateGetStatus(spreadsheetId, data);

    case 'clearResults':
      return batchUpdateClearResults(spreadsheetId, data);

    case 'getOperations':
      return batchUpdateGetOperations();

    default:
      return {ok: false, error: 'UNKNOWN_BATCHUPDATE_SUBACTION'};
    }
  } catch (e) {
    Logger.log('BatchUpdate handler error: ' + e.message);
    return {ok: false, error: e.message};
  }
}

// ===== ВСПомогательные функции OTA =====

/**
 * Получение содержимого файла для OTA
 */
function fetchFileContent_(fileName) {
  try {
    // Здесь должна быть логика получения файлов из хранилища
    // Пока возвращаем заглушки
    switch (fileName) {
    case 'Main.gs':
      return '// Main.gs v3.0.0 - Thin Client\n// Содержимое будет добавлено позже';

    case 'CollectConfigUi.html':
      return '<!-- CollectConfigUi.html v3.0.0 -->\n<html>...</html>';

    case 'UnpackingViewerUI.html':
      return '<!-- UnpackingViewerUI.html v3.0.0 -->\n<html>...</html>';

    case 'SettingsUI.html':
      return '<!-- SettingsUI.html v3.0.0 -->\n<html>...</html>';

    case 'logging_system.html':
      return '<!-- logging_system.html v3.0.0 -->\n<html>...</html>';

    default:
      return null;
    }
  } catch (e) {
    Logger.log('Error fetching file content: ' + e.message);
    return null;
  }
}


// ===== License =====
// ===== Gemini (server-side) =====
function serverGM_(prompt, maxTokens, temperature, apiKey) {
  Logger.log('=== serverGM_ START ===');
  Logger.log('prompt length: ' + (prompt ? prompt.length : 0));
  Logger.log('maxTokens: ' + maxTokens);
  Logger.log('temperature: ' + temperature);
  Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));

  if (!prompt || typeof prompt !== 'string') {
    Logger.log('ERROR: Empty or invalid prompt');
    throw new Error('EMPTY_PROMPT');
  }
  if (!apiKey) {
    Logger.log('ERROR: No API key provided');
    throw new Error('NO_CLIENT_KEY');
  }

  Logger.log('Building request to Gemini API...');
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

  Logger.log('Sending request to Gemini API...');
  const resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, options);
  const code = resp.getResponseCode();
  const responseText = resp.getContentText();

  Logger.log('Gemini API response code: ' + code);
  Logger.log('Gemini API response length: ' + responseText.length);

  const data = JSON.parse(responseText);
  if (code !== 200) {
    const msg = data && data.error && data.error.message || ('HTTP_' + code);
    Logger.log('Gemini API error: ' + msg);
    throw new Error(msg);
  }

  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';

  Logger.log('Gemini API success, response length: ' + text.length);
  return serverProcessMarkdown_(text);
}

function serverGMImage_(images, lang, apiKey, delimiter) {
  Logger.log('=== serverGMImage_ START ===');
  Logger.log('images count: ' + images.length);
  Logger.log('lang: ' + lang);
  Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));
  Logger.log('delimiter: ' + (delimiter || 'NONE'));

  // images: [{ mimeType, data(base64) }, ...]
  if (!Array.isArray(images) || images.length === 0) {
    Logger.log('ERROR: No images provided');
    throw new Error('NO_IMAGES');
  }
  if (!apiKey) {
    Logger.log('ERROR: No API key provided');
    throw new Error('NO_CLIENT_KEY');
  }

  let instruction;
  if (delimiter && delimiter.length) {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой с точным разделителем: ' + delimiter + ' (четыре подчёркивания), лучше на отдельной строке.' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  } else {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы нумерацией (1., 2., 3.).' + (lang ? (' Язык исходного текста: ' + lang + '.') : '');
  }

  Logger.log('Instruction: ' + instruction.substring(0, 100) + '...');

  const parts = [{text: instruction}];
  for (let i = 0; i < images.length; i++) {
    const it = images[i] || {};
    const mt = String(it.mimeType || 'image/png');
    const dt = String(it.data || '');
    if (!dt) continue;
    parts.push({inlineData: {mimeType: mt, data: dt}});
  }

  if (parts.length <= 1) {
    Logger.log('ERROR: No valid images found');
    throw new Error('NO_VALID_IMAGES');
  }

  Logger.log('Processing ' + (parts.length - 1) + ' valid images');
  const body = {contents: [{parts: parts}], generationConfig: {maxOutputTokens: 4096, temperature: 0}};

  Logger.log('Sending request to Gemini Vision API...');
  const resp = UrlFetchApp.fetch(S_GEMINI_API_URL + '?key=' + apiKey, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const responseText = resp.getContentText();

  Logger.log('Gemini Vision API response code: ' + code);
  Logger.log('Gemini Vision API response length: ' + responseText.length);

  const data = JSON.parse(responseText);
  if (code !== 200) {
    const msg = data && data.error && data.error.message || ('HTTP_' + code);
    Logger.log('Gemini Vision API error: ' + msg);
    throw new Error(msg);
  }

  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';

  Logger.log('Gemini Vision API success, response length: ' + text.length);
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
    Logger.log('=== serverLog_ START ===');
    Logger.log('action: ' + (info.action || ''));
    Logger.log('ok: ' + (info.ok ? 'true' : 'false'));
    Logger.log('error: ' + (info.error || 'NONE'));
    Logger.log('email: ' + (info.email || 'NONE'));
    Logger.log('promptLen: ' + (info.promptLen || 0));
    Logger.log('ms: ' + (info.ms || 0));
    Logger.log('keySource: ' + (info.keySource || 'NONE'));

    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sh = ss.getSheetByName(LOG_SHEET_NAME) || ss.insertSheet(LOG_SHEET_NAME);
    const headerNeeded = sh.getLastRow() === 0;
    if (headerNeeded) {
      sh.appendRow(['timestamp', 'action', 'ok', 'error', 'email', 'token', 'promptLen', 'ms', 'keySource']);
    }
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const tokenMasked = maskToken_(info.token);
    sh.appendRow([
      ts,
      info.action || '',
      info.ok ? '1' : '0',
      info.error || '',
      info.email || '',
      tokenMasked,
      info.promptLen || 0,
      info.ms || 0,
      info.keySource || 'NONE',
    ]);
    Logger.log('serverLog_ completed successfully');
  } catch (e) {
    Logger.log('serverLog_ ERROR: ' + e.message);
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
  logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: '🔧 Config: ' + JSON.stringify({
    systemPrompt: config.systemPrompt,
    userDataCount: config.userData ? config.userData.length : 0,
    spreadsheetId: spreadsheetId,
  })});

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
          logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: `  🔍 Источник ${index + 1} полный: ${JSON.stringify(source)}`});
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

  logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: '🔍 SystemPrompt source: ' + promptSource});

  try {
    // Проверяем кодовое слово "prompt_table" или "promt_table"
    const promptSourceLower = (promptSource || '').toString().toLowerCase().trim();
    if (promptSourceLower === 'prompt_table' || promptSourceLower === 'promt_table') {
      // Используем таблицу с лицензиями и промптами по умолчанию
      spreadsheetId = LICENSE_SHEET_ID;
      sheetName = 'Промты'; // Лист с промптами в лицензионной таблице
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Использование DEFAULT таблицы с промптами: ' + LICENSE_SHEET_ID});
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист: Промты'});
    } else if (isTableId(promptSource)) {
      // ID защищённой таблицы
      spreadsheetId = promptSource;
      sheetName = 'Промты'; // ВСЕГДА Промты!
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Защищённая таблица (ID): ' + spreadsheetId});
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист: Промты'});
    } else {
      // Название листа в текущей таблице клиента
      spreadsheetId = defaultSpreadsheetId;
      sheetName = promptSource;
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📂 Таблица клиента: ' + spreadsheetId});
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📄 Лист клиента: ' + sheetName});
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

    const dataPreview = result.join('\n');
    const previewLength = Math.min(100, dataPreview.length);
    logs.push({timestamp: new Date().toISOString(), level: 'DEBUG', message: `  → Превью данных (${previewLength} символов): ${dataPreview.substring(0, previewLength)}${dataPreview.length > previewLength ? '...' : ''}`});

    return dataPreview;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `  ❌ Ошибка чтения: ${error.message}`});
    throw new Error(`Не удалось прочитать ${sheetName}!${cellAddress}: ${error.message}`);
  }
}
