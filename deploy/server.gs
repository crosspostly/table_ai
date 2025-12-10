// Table AI Server (Apps Script Web App)
// Backend: лицензии, прокси к Gemini с КЛЮЧОМ КЛИЕНТА, серверные логи
/* exported checkServerAutoUpdate_, setupServerTriggers */

// ===== Constants: Gemini Models =====
// Обновлено: декабрь 2025, Gemini 2.5+ с максимальными лимитами
const GEMINI_MODELS = [
  // Tier 1: Best for Images (OCR, vision)
  {model: 'gemini-2.5-flash-image', rpd: 10000, rpm: 600000},    // ⭐ OCR優先
  // Tier 2: Universal (text + vision)
  {model: 'gemini-2.5-flash', rpd: 10000, rpm: 600000},           // General use
  {model: 'gemini-2.5-flash-lite', rpd: 10000, rpm: 1000000},     // Fast + cheap
  // Tier 3: Advanced (thinking)
  {model: 'gemini-2.5-pro', rpd: 1000, rpm: 40000},               // Advanced
  {model: 'gemini-2.5-pro-lite', rpd: 1000, rpm: 40000},
];

// ===== Constants =====
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3;
const AUTO_UPDATE_CHECK_INTERVAL = 6;
const API_KEYS_CACHE_DURATION = 3600; // 1 час
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const TOKENS_SHEET_NAME = 'Tokens';
const BINDINGS_SHEET_NAME = 'Bindings';
const API_GEM_SHEET_NAME = 'api_gem'; // Лист с резервными ключами

// ⭐ OTA UPDATES
const SERVER_VERSION = '3.5.3'; // Увеличена версия

// ═════════════════════════════════════════════════════════════════
// ⭐ OTA CONFIGURATION (ТОЛЬКО НА СЕРВЕРЕ!)
// ═════════════════════════════════════════════════════════════════

const REPO_IS_PUBLIC = true;

// ===== Entry points =====
function doGet(_e) {
  return json_({ok: true, ping: 'pong', time: new Date().toISOString()});
}

function doPost(_e) {
  try {
    Logger.log('=== doPost START ===');

    const data = parseBody_(_e);
    const action = (data.action || '').toString();
    const token = (data.token || '').toString();
    const email = (data.email || '').toString();
    const scriptId = (data.scriptId || '').toString();
    const spreadsheetId = (data.spreadsheetId || '').toString();
    const apiKey = (data.apiKey || '').toString();

    Logger.log('action: ' + action);
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
    Logger.log('scriptId: ' + (scriptId ? scriptId.substring(0, 12) + '...' : 'NOT SET'));
    Logger.log('spreadsheetId: ' + (spreadsheetId ? 'SET' : 'NOT SET'));
    Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));

    // License gate
    if (action !== 'status' && action !== 'validate') {
      Logger.log('Checking license...');
      const lic = checkLicense_(token, email, scriptId, spreadsheetId);
      Logger.log('License check result: ' + JSON.stringify(lic));

      if (!lic.ok) {
        Logger.log('License check FAILED: ' + lic.error);
        return json_({ok: false, error: lic.error || 'UNAUTHORIZED'}, 403);
      }
      Logger.log('License check PASSED');
    }

    switch (action) {
    case 'gm': {
      Logger.log('Processing gm action');
      const prompt = (data.prompt || '').toString();
      const maxTokens = data.maxTokens == null ? 12500 : +data.maxTokens;
      const temperature = data.temperature == null ? 0.7 : +data.temperature;
      const userApiKey = (data.apiKey || '').toString();

      Logger.log('prompt length: ' + prompt.length);
      Logger.log('maxTokens: ' + maxTokens);
      Logger.log('temperature: ' + temperature);

      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        const defaultApiKey = getDefaultGeminiKey_();
        if (defaultApiKey) {
          finalApiKey = defaultApiKey;
          keySource = 'DEFAULT';
          Logger.log('Using DEFAULT API key');
        } else {
          Logger.log('ERROR: No API key available');
          return json_({ok: false, error: 'NO_API_KEY_AVAILABLE'}, 400);
        }
      }

      if (!rateLimitOk_(token)) {
        Logger.log('Rate limit exceeded');
        return json_({ok: false, error: 'RATE_LIMIT'}, 429);
      }

      const t0 = Date.now();
      let ok = true;
      let err = null;
      let text = '';
      try {
        text = serverGM_(prompt, maxTokens, temperature, finalApiKey);
        Logger.log('serverGM_ completed, response length: ' + text.length);
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

      return !ok ? json_({ok: false, error: err}, 500) : json_({ok: true, data: text});
    }
    case 'gm_image': {
      Logger.log('Processing gm_image action');
      const images = data.images || [];
      const lang = (data.lang || 'ru').toString();
      const userApiKey = (data.userApiKey || data.apiKey || '').toString();
      const delimiter = (data.delimiter && String(data.delimiter).trim()) ? String(data.delimiter).trim() : null;

      Logger.log('images count: ' + images.length);
      Logger.log('lang: ' + lang);
      Logger.log('delimiter: ' + (delimiter || 'NONE'));

      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        const defaultApiKey = getDefaultGeminiKey_();
        if (defaultApiKey) {
          finalApiKey = defaultApiKey;
          keySource = 'DEFAULT';
          Logger.log('Using DEFAULT API key');
        } else {
          Logger.log('ERROR: No API key available');
          return json_({ok: false, error: 'NO_API_KEY_AVAILABLE'}, 400);
        }
      }

      if (!Array.isArray(images) || images.length === 0) {
        Logger.log('ERROR: No images provided');
        return json_({ok: false, error: 'NO_IMAGES'}, 400);
      }

      if (!rateLimitOk_(token)) {
        Logger.log('Rate limit exceeded');
        return json_({ok: false, error: 'RATE_LIMIT'}, 429);
      }

      const t1 = Date.now();
      let ok2 = true;
      let err2 = null;
      let text2 = '';
      try {
        // 🔄 Используем новую функцию с rotation
        text2 = serverGMImageWithRotation_(images, lang, finalApiKey, delimiter, keySource);
        Logger.log('serverGMImageWithRotation_ completed, response length: ' + text2.length);
      } catch (ex2) {
        ok2 = false;
        err2 = String(ex2 && ex2.message || ex2);
        Logger.log('serverGMImageWithRotation_ failed: ' + err2);
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

      return !ok2 ? json_({ok: false, error: err2}, 500) : json_({ok: true, data: text2});
    }
    case 'geminiConfig': {
      Logger.log('Processing geminiConfig action');
      const subaction = (data.subaction || '').toString();

      if (subaction === 'getDefaultKey') {
        Logger.log('📌 Getting default Gemini key');
        const lic = checkLicense_(token, email, scriptId, spreadsheetId);
        if (!lic.ok) {
          Logger.log(`❌ License check failed: ${lic.error}`);
          return json_(lic, 403);
        }

        const defaultKey = getDefaultGeminiKey_();
        if (!defaultKey) {
          Logger.log('❌ No default key configured');
          return json_({
            ok: false,
            error: 'NO_DEFAULT_KEY',
            message: 'No default Gemini API key configured on server',
          }, 500);
        }

        Logger.log('✅ Returning default Gemini key');
        return json_({
          ok: true,
          apiKey: defaultKey,
          source: 'server_default',
        });
      }

      if (subaction === 'setDefaultKey') {
        const adminEmail = data.adminEmail || '';
        const newKey = data.apiKey || '';
        const ADMIN_EMAIL = 'sheepoff@gmail.com';

        if (adminEmail !== ADMIN_EMAIL) {
          Logger.log(`❌ Unauthorized: ${adminEmail}`);
          return json_({ok: false, error: 'UNAUTHORIZED'}, 403);
        }

        const updated = setDefaultGeminiKey_(newKey);
        if (!updated) {
          return json_({ok: false, error: 'FAILED_TO_UPDATE'}, 500);
        }

        return json_({ok: true, message: 'Default Gemini key updated'});
      }

      Logger.log(`❌ Unknown geminiConfig subaction: ${subaction}`);
      return json_({ok: false, error: 'UNKNOWN_SUBACTION'}, 400);
    }
    case 'status': {
      Logger.log('Processing status action');
      const status = checkLicense_(token, email, scriptId, spreadsheetId);
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

      return json_({
        ok: status.ok,
        error: status.error || null,
        until: status.until || null,
        row: status.row || null,
        quota: status.quota || null,
        message: status.message || null,
        scriptId: status.scriptId || scriptId || null,
      });
    }
    case 'validate': {
      Logger.log('Processing validate action');
      const status = checkLicense_(token, email, scriptId, spreadsheetId);
      Logger.log('License check result: ' + JSON.stringify(status));

      try {
        serverLog_({
          action: 'validate',
          ok: status.ok,
          error: status.error || null,
          email: email,
          token: token,
          promptLen: 0,
          ms: 0,
          keySource: 'NONE',
        });
      } catch (_) {}

      return json_({
        ok: status.ok,
        error: status.error || null,
        until: status.until || null,
        row: status.row || null,
        quota: status.quota || null,
        message: status.message || null,
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
      Logger.log('Processing collect_config_execute action');
      const config = data.config || {};
      const spreadsheetId = (data.spreadsheetId || '').toString();
      const sheetName = (data.sheetName || '').toString();
      const cellAddress = (data.cellAddress || '').toString();
      const userApiKey = (data.apiKey || '').toString();
      const logs = [];

      Logger.log('config: ' + (config ? 'SET' : 'NOT SET'));
      Logger.log('spreadsheetId: ' + spreadsheetId);

      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        const defaultApiKey = getDefaultGeminiKey_();
        if (defaultApiKey) {
          finalApiKey = defaultApiKey;
          keySource = 'DEFAULT';
          Logger.log('Using DEFAULT API key');
        } else {
          Logger.log('ERROR: No API key available');
          return json_({ok: false, error: 'NO_API_KEY_AVAILABLE', logs: logs}, 400);
        }
      }

      if (!config) return json_({ok: false, error: 'NO_CONFIG', logs: logs}, 400);
      if (!spreadsheetId) return json_({ok: false, error: 'NO_SPREADSHEET_ID', logs: logs}, 400);
      if (!sheetName) return json_({ok: false, error: 'NO_SHEET_NAME', logs: logs}, 400);
      if (!cellAddress) return json_({ok: false, error: 'NO_CELL_ADDRESS', logs: logs}, 400);
      if (!finalApiKey) return json_({ok: false, error: 'NO_API_KEY', logs: logs}, 400);

      if (!rateLimitOk_(token)) {
        Logger.log('Rate limit exceeded');
        return json_({ok: false, error: 'RATE_LIMIT', logs: logs}, 429);
      }

      const t0 = Date.now();
      let ok = true;
      let err = null;
      let result = '';
      try {
        result = serverCollectConfigExecute_(config, spreadsheetId, sheetName, cellAddress, finalApiKey, logs);
        Logger.log('serverCollectConfigExecute_ completed, result length: ' + result.length);
      } catch (ex) {
        ok = false;
        err = String(ex && ex.message || ex);
        Logger.log('serverCollectConfigExecute_ failed: ' + err);
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
          keySource: keySource,
        });
      } catch (_) {}
      return !ok ? json_({ok: false, error: err, logs: logs}, 500) : json_({ok: true, data: result, logs: logs});
    }

    case 'ota': {
      Logger.log('═══════════════════════════════════════════════════════════════');
      Logger.log('⭐ OTA REQUEST RECEIVED');
      Logger.log('═══════════════════════════════════════════════════════════════');

      const subaction = (data.subaction || '').toString();
      Logger.log('📌 Subaction: ' + subaction);

      if (subaction === 'checkUpdates') {
        Logger.log('\n📌 STEP: checkUpdates');
        const clientVersion = data.clientVersion || '0.0.0';
        Logger.log('📱 Client version: ' + clientVersion);
        Logger.log('🖥️ Server version: ' + SERVER_VERSION);

        const check = checkForUpdates_(clientVersion, SERVER_VERSION);
        Logger.log('✅ Version check result: ' + JSON.stringify(check));
        Logger.log('═══════════════════════════════════════════════════════════════\n');
        return json_(check);
      }

      if (subaction === 'applyUpdates') {
        Logger.log('\n📌 STEP: applyUpdates');
        Logger.log('🔐 Checking license...');

        const lic = checkLicense_(token, email, scriptId, spreadsheetId);
        Logger.log('   License check result: ' + JSON.stringify(lic));

        if (!lic.ok) {
          Logger.log('❌ License FAILED: ' + lic.error);
          Logger.log('═══════════════════════════════════════════════════════════════\n');
          return json_(lic, 403);
        }

        Logger.log('✅ License OK');
        Logger.log('🌐 Starting OTA update for client...');

        const result = applyUpdatesToClient_(
          token,
          email,
          scriptId,
          spreadsheetId,
          REPO_IS_PUBLIC,
        );

        Logger.log('\n📋 OTA result: ' + JSON.stringify(result));
        Logger.log('═══════════════════════════════════════════════════════════════\n');
        return json_(result);
      }

      Logger.log('❌ Unknown OTA subaction: ' + subaction);
      Logger.log('═══════════════════════════════════════════════════════════════\n');
      return json_({ok: false, error: 'Unknown OTA subaction'}, 400);
    }

    default:
      Logger.log('ERROR: Unknown action - ' + action);
      return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }
  } catch (err) {
    Logger.log('doPost ERROR: ' + String(err.message || err));
    return json_({ok: false, error: String(err && err.message || err)}, 500);
  }
}

// ═════════════════════════════════════════════════════════════════
// ⭐ API KEY MANAGEMENT WITH ROTATION
// ═════════════════════════════════════════════════════════════════

/**
 * Получить все доступные API ключи (с кэшированием)
 * @return {Array<string>} Массив ключей или пусто
 */
function getApiKeysFromSheet_() {
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'api_keys_list';
    const cached = cache.get(cacheKey);

    if (cached) {
      Logger.log('✅ API keys from cache');
      return JSON.parse(cached);
    }

    Logger.log('📖 Reading API keys from sheet: ' + LICENSE_SHEET_ID + '/' + API_GEM_SHEET_NAME);

    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const sheet = ss.getSheetByName(API_GEM_SHEET_NAME);

    if (!sheet) {
      Logger.log('⚠️ Sheet ' + API_GEM_SHEET_NAME + ' not found');
      return [];
    }

    // Читаем столбец A, начиная с A2
    const range = sheet.getRange('A2:A');
    const values = range.getValues();
    const keys = [];

    for (let i = 0; i < values.length; i++) {
      const key = String(values[i][0] || '').trim();
      if (key && key.length > 5) {
        keys.push(key);
      }
    }

    Logger.log('📊 Found ' + keys.length + ' API keys in sheet');

    // Кэшируем на 1 час
    cache.put(cacheKey, JSON.stringify(keys), API_KEYS_CACHE_DURATION);

    return keys;
  } catch (e) {
    Logger.log('❌ Error reading API keys: ' + e.message);
    return [];
  }
}

/**
 * Очистить кэш API ключей (после ошибки)
 */
function clearApiKeyCache_() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('api_keys_list');
    Logger.log('🔄 API keys cache cleared');
  } catch (e) {
    Logger.log('⚠️ Error clearing cache: ' + e.message);
  }
}

/**
 * Получить модель с минимальным лимитом (для деградации под квоту)
 * @param {string} excludeModel - Модель для исключения (если она не работает)
 * @return {Object} {model, rpd, rpm} или null
 */
function getMostRestrictiveModel_(excludeModel) {
  for (let i = GEMINI_MODELS.length - 1; i >= 0; i--) {
    if (GEMINI_MODELS[i].model !== excludeModel) {
      return GEMINI_MODELS[i];
    }
  }
  return null;
}

/**
 * Получить модель по приоритету
 * @param {number} index - Индекс в массиве (0 = самая приоритетная)
 * @return {Object} {model, rpd, rpm} или null
 */
function getModelByIndex_(index) {
  return index >= 0 && index < GEMINI_MODELS.length ? GEMINI_MODELS[index] : null;
}

// ═════════════════════════════════════════════════════════════════
// ⭐ GEMINI API CALLS WITH ROTATION
// ═════════════════════════════════════════════════════════════════

function serverGM_(prompt, maxTokens, temperature, apiKey) {
  Logger.log('=== serverGM_ START ===');
  Logger.log('prompt length: ' + (prompt ? prompt.length : 0));
  Logger.log('maxTokens: ' + maxTokens);
  Logger.log('temperature: ' + temperature);

  if (!prompt || typeof prompt !== 'string') {
    Logger.log('ERROR: Empty or invalid prompt');
    throw new Error('EMPTY_PROMPT');
  }
  if (!apiKey) {
    Logger.log('ERROR: No API key provided');
    throw new Error('NO_CLIENT_KEY');
  }

  // Используем первую (самую мощную) модель для текста
  const model = GEMINI_MODELS[0] ? GEMINI_MODELS[0].model : 'gemini-2.5-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

  Logger.log('Using model: ' + model);
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
    headers: {
      'x-goog-api-key': apiKey,  // ✅ Правильный заголовок!
    },
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true,
  };

  Logger.log('Sending request to Gemini API...');
  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  const responseText = resp.getContentText();

  Logger.log('Gemini API response code: ' + code);

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

/**
 * Улучшенная функция OCR с поддержкой rotation и fallback
 */
function serverGMImageWithRotation_(images, lang, userApiKey, delimiter, keySource) {
  Logger.log('=== serverGMImageWithRotation_ START ===');
  Logger.log('images count: ' + images.length);
  Logger.log('lang: ' + lang);
  Logger.log('delimiter: ' + (delimiter || 'NONE'));
  Logger.log('keySource: ' + keySource);

  if (!Array.isArray(images) || images.length === 0) {
    Logger.log('ERROR: No images provided');
    throw new Error('NO_IMAGES');
  }
  if (!userApiKey) {
    Logger.log('ERROR: No API key provided');
    throw new Error('NO_CLIENT_KEY');
  }

  // Получаем резервные ключи из таблицы
  const backupKeys = getApiKeysFromSheet_();
  Logger.log('📊 Backup keys available: ' + backupKeys.length);

  let instruction;
  if (delimiter && delimiter.length) {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Разделяй отзывы: ' + delimiter + (lang ? (' Язык: ' + lang + '.') : '');
  } else {
    instruction = 'Задача: транскрибируй текст на каждом изображении БЕЗ добавления от себя. Верни только чистый текст. Разделяй нумерацией (1., 2., 3.).' + (lang ? (' Язык: ' + lang + '.') : '');
  }

  Logger.log('Instruction length: ' + instruction.length);

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
  const body = {
    contents: [{parts: parts}],
    generationConfig: {maxOutputTokens: 4096, temperature: 0},
  };

  // 🔄 ROTATION LOGIC: 2 попытки на модель, потом следующий ключ
  const keysToTry = [userApiKey].concat(backupKeys);
  let lastError = null;

  for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
    const currentKey = keysToTry[keyIdx];
    const isBackup = keyIdx > 0;

    Logger.log('\n🔑 Key attempt ' + (keyIdx + 1) + ' of ' + keysToTry.length + (isBackup ? ' (BACKUP)' : ' (USER)'));

    // Пробуем каждую модель (2 раза на модель)
    for (let modelIdx = 0; modelIdx < GEMINI_MODELS.length; modelIdx++) {
      const modelObj = GEMINI_MODELS[modelIdx];
      const model = modelObj.model;

      for (let attempt = 1; attempt <= 2; attempt++) {
        Logger.log('  📦 Model attempt ' + modelIdx + '/' + GEMINI_MODELS.length + ' (' + model + '), try ' + attempt + '/2');

        try {
          const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';

          const options = {
            method: 'post',
            contentType: 'application/json',
            headers: {
              'x-goog-api-key': currentKey,  // ✅ Правильный заголовок!
            },
            payload: JSON.stringify(body),
            muteHttpExceptions: true,
          };

          Logger.log('    🌐 POST ' + url);
          const resp = UrlFetchApp.fetch(url, options);
          const code = resp.getResponseCode();
          const responseText = resp.getContentText();

          Logger.log('    ✓ HTTP ' + code);

          const data = JSON.parse(responseText);

          // ✅ Success
          if (code === 200) {
            Logger.log('    ✅ SUCCESS with ' + (isBackup ? 'BACKUP' : 'USER') + ' key #' + (keyIdx + 1) + ', model ' + model);
            const candidate = data.candidates && data.candidates[0];
            const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
            const text = content && content.text ? content.text : '';
            return serverProcessMarkdown_(text);
          }

          // 429 = Quota exceeded
          if (code === 429) {
            Logger.log('    ⚠️ QUOTA (429) - trying next model...');
            lastError = 'QUOTA_LIMIT';
            break; // Переходим к следующей модели
          }

          // 401/403 = Auth error
          if (code === 401 || code === 403) {
            Logger.log('    ❌ AUTH ERROR (' + code + ') - invalid key, trying next...');
            lastError = 'AUTH_ERROR_' + code;
            break; // Переходим к следующему ключу
          }

          // Другие ошибки
          const msg = data && data.error && data.error.message || ('HTTP_' + code);
          Logger.log('    ❌ ERROR: ' + msg);
          lastError = msg;
          break;
        } catch (ex) {
          Logger.log('    💥 EXCEPTION: ' + ex.message);
          lastError = ex.message;
        }
      }

      // Если 401/403, выходим из цикла моделей и переходим к следующему ключу
      if (lastError === 'AUTH_ERROR_401' || lastError === 'AUTH_ERROR_403') {
        Logger.log('  🔑 AUTH failed, trying next API key...');
        break;
      }
    }
  }

  // Все ключи и модели исчерпаны
  Logger.log('\n❌ ALL ATTEMPTS FAILED');
  Logger.log('📊 Last error: ' + lastError);
  throw new Error('ALL_KEYS_EXHAUSTED: ' + (lastError || 'UNKNOWN_ERROR'));
}

function serverGMImage_(images, lang, apiKey, delimiter) {
  Logger.log('=== serverGMImage_ START (legacy) ===');
  // Legacy функция - перенаправляем на новую
  return serverGMImageWithRotation_(images, lang, apiKey, delimiter, 'LEGACY');
}

function serverProcessMarkdown_(text) {
  if (!text || typeof text !== 'string') return text;
  const isMd = /\*\*[^*]+\*\*|\*[^*]+\*|^#{1,6}\s+/m.test(text) || /```[\s\S]*?```/.test(text) || /`[^`]+`/.test(text);
  if (!isMd) return text;
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

function serverLog_(info) {
  try {
    Logger.log('=== serverLog_ START ===');
    Logger.log('action: ' + (info.action || ''));
    Logger.log('ok: ' + (info.ok ? 'true' : 'false'));
    Logger.log('error: ' + (info.error || 'NONE'));
    Logger.log('email: ' + (info.email || 'NONE'));

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
  }
}

function maskToken_(t) {
  const s = String(t || '');
  if (s.length <= 4) return '****';
  return s.substring(0, 4) + '****';
}

// ═════════════════════════════════════════════════════════════════
// ⭐ GEMINI API KEY MANAGEMENT
// ═════════════════════════════════════════════════════════════════

/**
 * Получить Gemini API ключ по умолчанию
 */
function getDefaultGeminiKey_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('GEMINI_API_KEY');

    if (!key) {
      Logger.log('⚠️ GEMINI_API_KEY not set in server properties');
      return null;
    }

    Logger.log('✅ Got default Gemini key from server');
    return key;
  } catch (e) {
    Logger.log('❌ Error getting default Gemini key: ' + e.message);
    return null;
  }
}

/**
 * Установить Gemini API ключ по умолчанию
 */
function setDefaultGeminiKey_(apiKey) {
  try {
    if (!apiKey) {
      Logger.log('❌ Cannot set empty API key');
      return false;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('GEMINI_API_KEY', apiKey);

    Logger.log('✅ Default Gemini key updated');
    return true;
  } catch (e) {
    Logger.log('❌ Error setting default Gemini key: ' + e.message);
    return false;
  }
}

// ═════════════════════════════════════════════════════════════════
// ⭐ COLLECTCONFIG SERVER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

function serverCollectConfigExecute_(config, spreadsheetId, sheetName, cellAddress, apiKey, logs) {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '🚀 Начало выполнения CollectConfig'});

  try {
    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📖 Загрузка System Prompt...'});
    const systemPrompt = serverGetSystemPrompt_(config, spreadsheetId, logs);
    if (systemPrompt) {
      logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ System Prompt: ${systemPrompt.length} символов`});
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '📦 Загрузка User Data...'});
    const userDataParts = [];
    if (config.userData && config.userData.length > 0) {
      logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `📦 Sources: ${config.userData.length}`});

      config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          try {
            const data = serverReadData_(spreadsheetId, source.sheet, source.cell, logs);
            logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `  ✅ Source ${index + 1}: ${data.length} символов`});
            userDataParts.push(`Source (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `  ❌ Source ${index + 1}: ${e.message}`});
            userDataParts.push(`Source (${source.sheet}!${source.cell}):\n[ERROR: ${e.message}]`);
          }
        }
      });
    }

    let finalPrompt = '';
    if (systemPrompt) {
      finalPrompt += systemPrompt + '\n\n---\n\n';
    }
    if (userDataParts.length > 0) {
      finalPrompt += 'DATA:\n' + userDataParts.join('\n\n');
    }

    if (!finalPrompt.trim()) {
      throw new Error('NO_DATA');
    }

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `📝 Final prompt: ${finalPrompt.length} символов`});

    const maxTokens = config.maxTokens || 25000;
    const temperature = config.temperature || 0.7;

    logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: '🤖 Calling AI...'});
    const aiResult = serverGM_(finalPrompt, maxTokens, temperature, apiKey);

    if (!aiResult || aiResult.startsWith('Error:')) {
      throw new Error('AI_ERROR: ' + aiResult);
    }

    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ AI response: ${aiResult.length} символов`});

    try {
      const targetSpreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const targetSheet = targetSpreadsheet.getSheetByName(sheetName);
      if (targetSheet) {
        targetSheet.getRange(cellAddress).setValue(aiResult);
        logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: `✅ Written to ${sheetName}!${cellAddress}`});
      } else {
        throw new Error(`Sheet "${sheetName}" not found`);
      }
    } catch (e) {
      logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `❌ Write error: ${e.message}`});
      throw new Error(`Cannot write to ${sheetName}!${cellAddress}: ${e.message}`);
    }

    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: '✅ CollectConfig completed'});
    return aiResult;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `❌ Error: ${error.message}`});
    throw error;
  }
}

function serverGetSystemPrompt_(config, defaultSpreadsheetId, logs) {
  if (config && config.prompt_table && config.prompt_table.cellAddress) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: '📡 Using remote prompt_table',
    });

    const cellAddress = config.prompt_table.cellAddress;

    try {
      const prompt = readPromptFromServerTable_(cellAddress, logs);
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'SUCCESS',
        message: '✅ prompt_table loaded: ' + cellAddress,
      });
      return prompt || '';
    } catch (e) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: '❌ prompt_table error: ' + e.message,
      });
      throw new Error('Cannot read prompt_table: ' + e.message);
    }
  }

  if (!config.systemPrompt || !config.systemPrompt.sheet || !config.systemPrompt.cell) {
    return '';
  }

  let spreadsheetId;
  let sheetName;

  const promptSource = config.systemPrompt.sheet;
  const promptSourceLower = (promptSource || '').toString().toLowerCase().trim();

  try {
    if (promptSourceLower === 'prompt_table' || promptSourceLower === 'promt_table') {
      spreadsheetId = LICENSE_SHEET_ID;
      sheetName = 'Промты';
    } else if (isTableId(promptSource)) {
      spreadsheetId = promptSource;
      sheetName = 'Промты';
    } else {
      spreadsheetId = defaultSpreadsheetId;
      sheetName = promptSource;
    }

    const prompt = serverReadData_(spreadsheetId, sheetName, config.systemPrompt.cell, logs);
    logs.push({timestamp: new Date().toISOString(), level: 'SUCCESS', message: '✅ System Prompt loaded: ' + prompt.length});
    return prompt;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: '❌ System Prompt error: ' + error.message});
    throw new Error('Cannot read System Prompt: ' + error.message);
  }
}

function readPromptFromServerTable_(cellAddress, logs) {
  const promptTableId = LICENSE_SHEET_ID;
  const promptSheetName = 'Промты';

  logs.push({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: '📂 Reading prompt_table: ' + promptTableId + '/' + promptSheetName + '!' + cellAddress,
  });

  try {
    const prompt = serverReadData_(promptTableId, promptSheetName, cellAddress, logs);
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'SUCCESS',
      message: '✅ Prompt loaded: ' + prompt.length + ' chars',
    });
    return prompt;
  } catch (error) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: '❌ Error reading prompt: ' + error.message,
    });
    throw error;
  }
}

function serverReadData_(spreadsheetId, sheetName, cellAddress, logs) {
  logs.push({timestamp: new Date().toISOString(), level: 'INFO', message: `  → Reading ${sheetName}!${cellAddress}`});

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const range = sheet.getRange(cellAddress);
    const values = range.getValues();

    if (!values || values.length === 0) {
      logs.push({timestamp: new Date().toISOString(), level: 'WARN', message: `  → Empty range: ${cellAddress}`});
      return '';
    }

    const result = [];
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        const val = values[r][c];
        if (val !== null && val !== undefined && val.toString().trim() !== '') {
          result.push(val.toString());
        }
      }
    }

    const dataPreview = result.join('\n');
    return dataPreview;
  } catch (error) {
    logs.push({timestamp: new Date().toISOString(), level: 'ERROR', message: `  ❌ Error: ${error.message}`});
    throw new Error(`Cannot read ${sheetName}!${cellAddress}: ${error.message}`);
  }
}

// ═════════════════════════════════════════════════════════════════
// ⭐ SERVER AUTO-UPDATE
// ═════════════════════════════════════════════════════════════════

function checkServerAutoUpdate_() {
  try {
    Logger.log('🌙 Server auto-update check started');

    const currentServerCode = getServerFileContent_('server.gs');
    if (!currentServerCode) {
      Logger.log('❌ Cannot get current server code');
      return;
    }

    const githubServerCode = fetchFileContent_('server.gs');
    if (!githubServerCode) {
      Logger.log('⚠️ Cannot fetch from GitHub');
      return;
    }

    const currentHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, currentServerCode);
    const githubHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, githubServerCode);

    const currentHashB64 = Utilities.base64Encode(currentHash);
    const githubHashB64 = Utilities.base64Encode(githubHash);

    if (currentHashB64 === githubHashB64) {
      Logger.log('✅ Server is up to date');
      return;
    }

    Logger.log('🚀 Server update available!');

    const currentProject = ScriptApp.getScript();
    const serverFile = currentProject.getFiles().find(function(file) {
      return file.getName() === 'server';
    });

    if (!serverFile) {
      Logger.log('❌ Server file not found');
      return;
    }

    try {
      serverFile.setContent(githubServerCode);
      Logger.log('✅ Server file updated!');
    } catch (updateError) {
      Logger.log('❌ Update failed: ' + updateError.message);
    }
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

function getServerFileContent_(fileName) {
  try {
    const project = ScriptApp.getScript();
    const files = project.getFiles();

    for (let i = 0; i < files.length; i++) {
      if (files[i].getName() === fileName) {
        return files[i].getContentAsString();
      }
    }
    return null;
  } catch (e) {
    Logger.log('Error getting file content: ' + e.message);
    return null;
  }
}

function fetchFileContent_(fileName) {
  const REPO = 'crosspostly/table_ai';
  const BRANCH = 'main';
  const PATH = 'deploy/';

  try {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}${fileName}`;
    Logger.log('Fetching: ' + url);

    const resp = UrlFetchApp.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code !== 200) {
      Logger.log(`GitHub fetch failed: HTTP ${code}`);
      return null;
    }

    const content = resp.getContentText();
    Logger.log(`Fetched ${fileName}: ${content.length} bytes`);
    return content;
  } catch (e) {
    Logger.log(`Error fetching ${fileName}: ${e.message}`);
    return null;
  }
}

function installServerAutoUpdate_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let hasAutoUpdate = false;

    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkServerAutoUpdate_') {
        hasAutoUpdate = true;
        break;
      }
    }

    if (hasAutoUpdate) {
      Logger.log('Server auto-update trigger already exists');
      return;
    }

    ScriptApp.newTrigger('checkServerAutoUpdate_')
      .timeBased()
      .everyHours(AUTO_UPDATE_CHECK_INTERVAL)
      .create();

    Logger.log(`✅ Auto-update trigger installed (every ${AUTO_UPDATE_CHECK_INTERVAL} hours)`);
  } catch (e) {
    Logger.log('❌ Error: ' + e.message);
  }
}

function setupServerTriggers() {
  Logger.log('=== SETUP SERVER TRIGGERS ===');

  try {
    installServerAutoUpdate_();

    const triggers = ScriptApp.getProjectTriggers();
    let autoUpdateCount = 0;

    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkServerAutoUpdate_') {
        autoUpdateCount++;
      }
    }

    Logger.log(`✅ Auto-update trigger: ${autoUpdateCount}`);
    Logger.log(`⏰ Check every ${AUTO_UPDATE_CHECK_INTERVAL} hours`);

    return {success: true, triggers: autoUpdateCount};
  } catch (e) {
    Logger.log('❌ Setup error: ' + e.message);
    return {success: false, error: e.message};
  }
}

// ═════════════════════════════════════════════════════════════════
// GitHub helpers (для приватных репо)
// ═════════════════════════════════════════════════════════════════

function setGithubPAT(pat) {
  return setGithubPAT_(pat);
}

function testGithubAccess() {
  try {
    const pat = getGithubPAT_();
    if (!pat) {
      return {ok: false, message: 'PAT not configured'};
    }

    const file = downloadFileFromGithub_('server.gs', REPO_IS_PUBLIC);
    return {ok: true, working: !!file};
  } catch (e) {
    return {ok: false, error: e.message};
  }
}

// Stub для getGithubPAT_ и downloadFileFromGithub_ если они не определены
function getGithubPAT_() {
  try {
    return PropertiesService.getScriptProperties().getProperty('GITHUB_PAT');
  } catch (e) {
    return null;
  }
}

function downloadFileFromGithub_(fileName, isPublic) {
  // Реализация зависит от конкретного GitHub интеграции
  return null;
}

function getScriptIdFromBindingsForOTA_(email) {
  try {
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const bindingsSheet = ss.getSheetByName(BINDINGS_SHEET_NAME);

    if (!bindingsSheet) {
      Logger.log('❌ Bindings sheet not found');
      return null;
    }

    const bindingsData = bindingsSheet.getDataRange().getValues();
    const emailL = String(email).toLowerCase().trim();

    for (let r = 1; r < bindingsData.length; r++) {
      const row = bindingsData[r];
      const bindEmail = String(row[0] || '').toLowerCase().trim();

      if (bindEmail === emailL) {
        const scriptId = String(row[2] || '').trim();
        if (scriptId) {
          Logger.log(`✅ Found scriptId for ${email}`);
          return scriptId;
        }
      }
    }

    Logger.log(`❌ No scriptId found for: ${email}`);
    return null;
  } catch (e) {
    Logger.log(`❌ Error: ${e.message}`);
    return null;
  }
}
