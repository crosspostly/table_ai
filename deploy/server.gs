// Table AI Server (Apps Script Web App)
// Backend: лицензии, прокси к Gemini с КЛЮЧОМ КЛИЕНТА, серверные логи
/* exported checkServerAutoUpdate_, setupServerTriggers */

// ===== Constants =====
const S_GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const LOG_SHEET_NAME = 'Логи';
const RATE_LIMIT_PER_SEC = 3; // max запросов/сек на токен
const AUTO_UPDATE_CHECK_INTERVAL = 6;

// ⭐ OTA UPDATES
const SERVER_VERSION = '3.5.2';

// ⭐ LICENSE SHEET ID (для prompt_table)
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const TOKENS_SHEET_NAME = 'Tokens';
const BINDINGS_SHEET_NAME = 'Bindings';

// ═════════════════════════════════════════════════════════════════
// ⭐ OTA CONFIGURATION (ТОЛЬКО НА СЕРВЕРЕ!)
// ═════════════════════════════════════════════════════════════════

// Публичный или приватный GitHub репо?
// true = публичный (no authentication needed)
// false = приватный (requires GitHub PAT)
const REPO_IS_PUBLIC = true; // ← СЕРВЕР решает!

// Если false, установить один раз:
// Extensions → server.gs → Console
// setGithubPAT_('ghp_...')


// ===== Rate Limit & Cache Implementation =====

/**
 * ===== RATE LIMIT MANAGER (новый блок) =====
 * Управление частотой вызовов к Gemini API
 */

const RATE_LIMIT_KEY = 'gemini_api_rate_limit_store';
const METRICS_SHEET_NAME = 'API_METRICS';
const MAX_REQUESTS_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 минута
const MAX_CACHE_SIZE_KB = 500;
const CACHE_TTL_MS = 3600000; // 1 час

class RateLimitManager {
  constructor() {
    this.ps = PropertiesService.getUserProperties();
  }

  /**
   * Получить данные о запросах за последнюю минуту
   */
  getRecentRequests_() {
    const data = this.ps.getProperty(RATE_LIMIT_KEY);
    const requests = data ? JSON.parse(data) : [];
    const now = Date.now();
    
    // Отфильтровать запросы старше 60 секунд
    return requests.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  }

  /**
   * Проверить, можно ли сделать запрос прямо сейчас
   */
  canMakeRequest() {
    return this.getRecentRequests_().length < MAX_REQUESTS_PER_MINUTE;
  }

  /**
   * Получить время ожидания (миллисекунды) перед следующим запросом
   */
  getWaitTime() {
    const requests = this.getRecentRequests_();
    
    if (requests.length < MAX_REQUESTS_PER_MINUTE) {
      return 0;
    }
    
    // Найти самый старый запрос и вычислить время до конца окна
    const oldestRequest = Math.min(...requests);
    const waitTime = Math.max(0, RATE_LIMIT_WINDOW_MS - (Date.now() - oldestRequest) + 500);
    
    return waitTime;
  }

  /**
   * Ждать, если необходимо (блокирующая операция)
   */
  waitIfNeeded() {
    const waitTime = this.getWaitTime();
    
    if (waitTime > 0) {
      Logger.log(`[RATE_LIMIT] Ожидание ${waitTime}ms перед следующим запросом...`);
      Utilities.sleep(waitTime);
    }
    
    return waitTime;
  }

  /**
   * Логировать новый API запрос
   */
  logRequest() {
    const requests = this.getRecentRequests_();
    requests.push(Date.now());
    this.ps.setProperty(RATE_LIMIT_KEY, JSON.stringify(requests));
  }

  /**
   * Очистить старые логи
   */
  cleanup() {
    const requests = this.getRecentRequests_();
    if (requests.length > 0) {
      this.ps.setProperty(RATE_LIMIT_KEY, JSON.stringify(requests));
    }
  }
}

/**
 * ===== CACHE MANAGER (новый блок) =====
 */

class CacheManager {
  constructor() {
    this.ps = PropertiesService.getUserProperties();
  }

  /**
   * Создать ключ кэша из промпта и модели
   */
  static createKey(model, prompt, imageHash = '') {
    const combined = `${model}:${prompt.substring(0, 200)}:${imageHash}`;
    // Простой хеш (в реальности можно использовать Utilities.computeDigest)
    return Utilities.base64Encode(combined).substring(0, 50);
  }

  /**
   * Получить закэшированный результат
   */
  get(cacheKey) {
    const cached = this.ps.getProperty(`cache_${cacheKey}`);
    
    if (!cached) return null;
    
    const entry = JSON.parse(cached);
    const now = Date.now();
    
    // Проверить TTL
    if (now - entry.timestamp > CACHE_TTL_MS) {
      this.ps.deleteProperty(`cache_${cacheKey}`);
      return null;
    }
    
    return entry.result;
  }

  /**
   * Сохранить результат в кэш
   */
  set(cacheKey, result) {
    const entry = {
      result: result,
      timestamp: Date.now()
    };
    
    try {
      this.ps.setProperty(`cache_${cacheKey}`, JSON.stringify(entry));
    } catch (e) {
      // Если кэш переполнен, очистить старые записи
      Logger.log(`[CACHE] Переполнение кэша: ${e}`);
      this.cleanup();
    }
  }

  /**
   * Очистить старые кэш-записи
   */
  cleanup() {
    Logger.log('[CACHE] Выполнена очистка');
  }
}

/**
 * ===== ОСНОВНАЯ ОБЁРТКА (новый блок) =====
 */

const rateLimiter = new RateLimitManager();
const cacheManager = new CacheManager();

/**
 * ГЛАВНАЯ ФУНКЦИЯ: Выполнить Gemini запрос с защитой от квот
 * 
 * @param {Object} modelConfig - {model: "...", apiKey: "...", maxTokens: number, temperature: number}
 * @param {string|Object} prompt - Промпт или {text: "...", image: "..."}
 * @param {Object} options - {maxRetries: 3, timeout: 30000, skipCache: false}
 * @returns {Object} {success: true/false, data: "...", error: "...", waitTime: 0}
 */
function executeGeminiWithRateLimit(modelConfig, prompt, options = {}) {
  const {
    maxRetries = 3,
    timeout = 30000,
    skipCache = false
  } = options;

  // 1. Проверить кэш (если не skipCache)
  let cacheKey = null;
  if (!skipCache && typeof prompt === 'string') {
    cacheKey = CacheManager.createKey(modelConfig.model, prompt);
    const cached = cacheManager.get(cacheKey);
    
    if (cached) {
      Logger.log(`[CACHE_HIT] Использован кэшированный результат для модели ${modelConfig.model}`);
      return {
        success: true,
        data: cached,
        error: null,
        waitTime: 0,
        fromCache: true
      };
    }
  }

  // 2. Применить rate limiting
  const waitTime = rateLimiter.waitIfNeeded();

  // 3. Выполнить запрос с повторами
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Логировать запрос
      rateLimiter.logRequest();

      // Выполнить API запрос
      const result = callGeminiApi(modelConfig, prompt);

      // 4. Сохранить в кэш
      if (!skipCache && cacheKey && result) {
        cacheManager.set(cacheKey, result);
      }

      // Логировать успех
      logApiMetric({
        functionName: 'executeGeminiWithRateLimit',
        status: 'success',
        model: modelConfig.model,
        tokens: result.length, // approximation
        error: '',
        waitTime: waitTime
      });

      return {
        success: true,
        data: result,
        error: null,
        waitTime: waitTime,
        fromCache: false,
        attempt: attempt + 1
      };

    } catch (error) {
      lastError = error;
      const errorMsg = error.toString();

      // Если ошибка 429 (Quota Exceeded)
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
        const backoffDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        
        Logger.log(`[RATE_LIMIT_429] Попытка ${attempt + 1}/${maxRetries}. Ожидание ${backoffDelay}ms...`);
        Utilities.sleep(backoffDelay);
        
        continue; // Повторить попытку
      }

      // Для других ошибок - не повторять
      throw error;
    }
  }

  // 5. Все попытки исчерпаны
  const errorMsg = lastError?.toString() || 'Unknown error';
  
  logApiMetric({
    functionName: 'executeGeminiWithRateLimit',
    status: 'failed',
    model: modelConfig.model,
    tokens: 0,
    error: errorMsg,
    waitTime: waitTime
  });

  return {
    success: false,
    data: null,
    error: errorMsg,
    waitTime: waitTime,
    fromCache: false,
    attempt: maxRetries
  };
}

/**
 * Логировать метрики API в Google Sheets
 */
function logApiMetric(metric) {
  try {
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    let sheet = ss.getSheetByName(METRICS_SHEET_NAME);
    
    if (!sheet) {
      try {
        sheet = ss.insertSheet(METRICS_SHEET_NAME);
        sheet.appendRow(['Timestamp', 'Function', 'Status', 'Model', 'Tokens', 'Error', 'Wait Time (ms)']);
      } catch (e) {
        Logger.log('[METRICS] Could not create sheet: ' + e.message);
      }
    }
    
    if (sheet) {
      const now = new Date().toISOString();
      sheet.appendRow([
        now,
        metric.functionName,
        metric.status,
        metric.model || '',
        metric.tokens,
        metric.error,
        metric.waitTime
      ]);
    }
  } catch (e) {
    Logger.log(`[METRICS_ERROR] Не удалось логировать метрику: ${e}`);
  }
}

/**
 * Вспомогательная функция для вызова Gemini API
 */
function callGeminiApi(modelConfig, prompt) {
  // Определяем URL
  const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const model = modelConfig.model || 'gemini-2.5-flash-lite';
  const url = `${baseUrl}${model}:generateContent`;
  
  // Определяем API ключ
  const apiKey = modelConfig.apiKey;
  if (!apiKey) throw new Error('No API key provided');
  
  let payload = {};
  
  // Строим тело запроса
  if (typeof prompt === 'string') {
    // Текстовый запрос
    payload = {
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {
        maxOutputTokens: modelConfig.maxTokens || 12500,
        temperature: modelConfig.temperature || 0.7,
      }
    };
  } else if (prompt.contents) {
    // Уже готовый объект contents (для Vision или сложных промптов)
    payload = {
      contents: prompt.contents,
      generationConfig: {
        maxOutputTokens: modelConfig.maxTokens || 4096,
        temperature: modelConfig.temperature || 0,
      }
    };
  } else {
    throw new Error('Invalid prompt format for callGeminiApi');
  }
  
  const options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'x-goog-api-key': apiKey,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  // Выполняем запрос
  const resp = UrlFetchApp.fetch(url, options);
  const code = resp.getResponseCode();
  const responseText = resp.getContentText();
  
  if (code !== 200) {
    let msg = 'HTTP_' + code;
    try {
      const data = JSON.parse(responseText);
      if (data && data.error && data.error.message) msg = data.error.message;
    } catch (e) {}
    throw new Error(msg);
  }
  
  const data = JSON.parse(responseText);
  const candidate = data.candidates && data.candidates[0];
  const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  const text = content && content.text ? content.text : '';
  
  return serverProcessMarkdown_(text);
}

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

    // ⭐ ОБА ID для разных целей
    const scriptId = (data.scriptId || '').toString(); // ⭐ Для привязки
    const spreadsheetId = (data.spreadsheetId || '').toString(); // ⭐ Для работы
    const apiKey = (data.apiKey || '').toString();

    Logger.log('action: ' + action);
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
    Logger.log('scriptId: ' + (scriptId ? scriptId.substring(0, 12) + '...' : 'NOT SET')); // ⭐
    Logger.log('spreadsheetId: ' + (spreadsheetId ? 'SET' : 'NOT SET')); // ⭐
    Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));

    // License gate for all actions except 'status' and 'validate'
    if (action !== 'status' && action !== 'validate') {
      Logger.log('Checking license...');
      const lic = checkLicense_(token, email, scriptId, spreadsheetId); // ✅ Оба ID
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
      Logger.log('userApiKey: ' + (userApiKey ? 'SET (length: ' + userApiKey.length + ')' : 'NOT SET'));

      // API key priority: use user key first, otherwise fallback to default
      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        // Try to get default API key from script properties
        const defaultApiKey = getDefaultGeminiKey_();
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
    case 'gm_image': {
      Logger.log('Processing gm_image action');
      const images = data.images || [];
      const lang = (data.lang || 'ru').toString();
      const userApiKey = (data.userApiKey || data.apiKey || '').toString(); // поддерживаем оба формата
      const delimiter = (data.delimiter && String(data.delimiter).trim()) ? String(data.delimiter).trim() : null;

      Logger.log('images count: ' + images.length);
      Logger.log('lang: ' + lang);
      Logger.log('userApiKey: ' + (userApiKey ? 'SET (length: ' + userApiKey.length + ')' : 'NOT SET'));
      Logger.log('delimiter: ' + (delimiter || 'NONE'));

      // API key priority: use user key first, otherwise fallback to default
      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        // Try to get default API key from script properties
        const defaultApiKey = getDefaultGeminiKey_();
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
    // ════════════════════════════════════════════════════════
    // ACTION: GEMINI CONFIG
    // ════════════════════════════════════════════════════════
    case 'geminiConfig': {
      Logger.log('Processing geminiConfig action');
      const subaction = (data.subaction || '').toString();

      // ⭐ SUBACTION: GET DEFAULT KEY
      if (subaction === 'getDefaultKey') {
        Logger.log('📌 Getting default Gemini key');

        // Проверяем лицензию
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

      // ⭐ SUBACTION: SET DEFAULT KEY (администратор)
      if (subaction === 'setDefaultKey') {
        const adminEmail = data.adminEmail || '';
        const newKey = data.apiKey || '';

        // Проверяем что это администратор (жестко кодируем или берём из конфига)
        const ADMIN_EMAIL = 'sheepoff@gmail.com'; // ← Измени на свой!

        if (adminEmail !== ADMIN_EMAIL) {
          Logger.log(`❌ Unauthorized: ${adminEmail}`);
          return json_({ok: false, error: 'UNAUTHORIZED'}, 403);
        }

        const updated = setDefaultGeminiKey_(newKey);

        if (!updated) {
          return json_({ok: false, error: 'FAILED_TO_UPDATE'}, 500);
        }

        return json_({
          ok: true,
          message: 'Default Gemini key updated',
        });
      }

      Logger.log(`❌ Unknown geminiConfig subaction: ${subaction}`);
      return json_({ok: false, error: 'UNKNOWN_SUBACTION'}, 400);
    }
    case 'status': {
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
        scriptId: status.scriptId || scriptId || null,
      });
    }
    case 'validate': {
      Logger.log('Processing validate action');
      const status = checkLicense_(token, email, scriptId, spreadsheetId); // ✅
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

      Logger.log('Returning validate response');
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
      Logger.log('Processing collect_config_execute action');
      const config = data.config || {};
      const spreadsheetId = (data.spreadsheetId || '').toString();
      const sheetName = (data.sheetName || '').toString();
      const cellAddress = (data.cellAddress || '').toString();
      const userApiKey = (data.apiKey || '').toString();
      const logs = [];

      Logger.log('config: ' + (config ? 'SET' : 'NOT SET'));
      Logger.log('config.systemPrompt: ' + JSON.stringify(config.systemPrompt || null));
      Logger.log('config.userData: ' + (config.userData ? config.userData.length + ' sources' : 'NONE'));
      Logger.log('spreadsheetId: ' + spreadsheetId);
      Logger.log('sheetName: ' + sheetName);
      Logger.log('cellAddress: ' + cellAddress);
      Logger.log('userApiKey: ' + (userApiKey ? 'SET (length: ' + userApiKey.length + ')' : 'NOT SET'));

      // API key priority: use user key first, otherwise fallback to default
      let finalApiKey = userApiKey;
      let keySource = 'USER';

      if (!userApiKey) {
        // Try to get default API key from script properties
        const defaultApiKey = getDefaultGeminiKey_();
        if (defaultApiKey) {
          finalApiKey = defaultApiKey;
          keySource = 'DEFAULT';
          Logger.log('Using DEFAULT API key, length: ' + defaultApiKey.length);
        } else {
          Logger.log('ERROR: No API key available (neither user nor default)');
          return json_({ok: false, error: 'NO_API_KEY_AVAILABLE', logs: logs}, 400);
        }
      } else {
        Logger.log('Using USER API key, length: ' + userApiKey.length);
      }

      // Validate required fields
      if (!config) return json_({ok: false, error: 'NO_CONFIG', logs: logs}, 400);
      if (!spreadsheetId) return json_({ok: false, error: 'NO_SPREADSHEET_ID', logs: logs}, 400);
      if (!sheetName) return json_({ok: false, error: 'NO_SHEET_NAME', logs: logs}, 400);
      if (!cellAddress) return json_({ok: false, error: 'NO_CELL_ADDRESS', logs: logs}, 400);
      if (!finalApiKey) return json_({ok: false, error: 'NO_API_KEY', logs: logs}, 400);

      // Rate limit for execute calls
      if (!rateLimitOk_(token)) {
        Logger.log('Rate limit exceeded for token');
        return json_({ok: false, error: 'RATE_LIMIT', logs: logs}, 429);
      }

      Logger.log('Calling serverCollectConfigExecute_ with ' + keySource + ' API key');
      const t0 = Date.now();
      let ok = true;
      let err = null;
      let result = '';
      try {
        result = serverCollectConfigExecute_(config, spreadsheetId, sheetName, cellAddress, finalApiKey, logs);
        Logger.log('serverCollectConfigExecute_ completed successfully, result length: ' + result.length);
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
      if (!ok) {
        Logger.log('Returning error response: ' + err);
        return json_({ok: false, error: err, logs: logs}, 500);
      }

      Logger.log('Returning successful response');
      return json_({ok: true, data: result, logs: logs});
    }

    // ⭐ OTA UPDATES (СЕРВЕР ОБНОВЛЯЕТ КЛИЕНТА)
    case 'ota': {
      Logger.log('═══════════════════════════════════════════════════════════════');
      Logger.log('⭐ OTA REQUEST RECEIVED');
      Logger.log('═══════════════════════════════════════════════════════════════');

      const subaction = (data.subaction || '').toString();
      Logger.log('📌 Subaction: ' + subaction);
      Logger.log('📧 Email: ' + (email ? 'SET' : 'NOT SET'));
      Logger.log('🔑 Token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
      Logger.log('📄 ScriptId: ' + (scriptId ? scriptId.substring(0, 12) + '...' : 'NOT SET'));
      Logger.log('📊 SpreadsheetId: ' + (spreadsheetId ? 'SET' : 'NOT SET'));

      // КЛИЕНТ: "Проверь версию!"
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

      // КЛИЕНТ: "Обнови меня!"
      // СЕРВЕР: "Окей, я сам всё сделаю!"
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

        // ⭐ СЕРВЕР ВЫЗЫВАЕТ ФУНКЦИЮ ИЗ ota_updates.gs
        // КЛИЕНТ ЗДЕСЬ НЕ УЧАСТВУЕТ!
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

    // ════════════════════════════════════════════════════════
    // DEFAULT
    // ════════════════════════════════════════════════════════
    default:
      Logger.log('ERROR: Unknown action - ' + action);
      return json_({ok: false, error: 'UNKNOWN_ACTION'}, 400);
    }
  } catch (err) {
    Logger.log('doPost ERROR: ' + String(err.message || err));
    return json_({ok: false, error: String(err && err.message || err)}, 500);
  }
}

/**
 * Получить scriptId из листа Bindings (для OTA)
 * @param {string} email - Email пользователя
 * @return {string|null} Script ID или null
 */
// eslint-disable-next-line no-unused-vars
function getScriptIdFromBindingsForOTA_(email) {
  try {
    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);
    const bindingsSheet = ss.getSheetByName(BINDINGS_SHEET_NAME);

    if (!bindingsSheet) {
      Logger.log('❌ [OTA] Bindings sheet not found');
      return null;
    }

    // Получаем все данные из листа Bindings
    const bindingsData = bindingsSheet.getDataRange().getValues();
    const emailL = String(email).toLowerCase().trim();

    // Ищем строку с email
    for (let r = 1; r < bindingsData.length; r++) {
      const row = bindingsData[r];
      const bindEmail = String(row[0] || '').toLowerCase().trim(); // A: Email

      if (bindEmail === emailL) {
        const scriptId = String(row[2] || '').trim(); // C: script_ids

        if (scriptId) {
          Logger.log(`✅ [OTA] Found scriptId for ${email}: ${scriptId.substring(0, 12)}...`);
          return scriptId;
        }
      }
    }

    Logger.log(`❌ [OTA] No scriptId found for email: ${email}`);
    return null;
  } catch (e) {
    Logger.log(`❌ [OTA] Error getting scriptId from Bindings: ${e.message}`);
    return null;
  }
}


// ===== License =====
// ===== Gemini (server-side) =====
function serverGM_(prompt, maxTokens, temperature, apiKey) {
  Logger.log('=== serverGM_ START (Wrapped) ===');
  
  const modelConfig = {
    model: 'gemini-2.5-flash-lite',
    apiKey: apiKey,
    maxTokens: maxTokens,
    temperature: temperature
  };
  
  const result = executeGeminiWithRateLimit(modelConfig, prompt, {maxRetries: 3});
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.data;
}

function serverGMImage_(images, lang, apiKey, delimiter) {
  Logger.log('=== serverGMImage_ START (Wrapped) ===');
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
  
  // Use Rate Limited Executor
  const modelConfig = {
    model: 'gemini-2.5-flash-lite',
    apiKey: apiKey,
    maxTokens: 4096,
    temperature: 0
  };
  
  const promptObj = {
      contents: [{parts: parts}]
  };
  
  const result = executeGeminiWithRateLimit(modelConfig, promptObj, {maxRetries: 3});
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  return result.data;
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

// ═══════════════════════════════════════════════════════════════
// ⭐ OTA UPDATES
// ═══════════════════════════════════════════════════════════════

/**
 * Скачать файл с GitHub (raw.githubusercontent.com)
 */
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
      Logger.log(`GitHub fetch failed: HTTP ${code} for ${fileName}`);
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

// ===== Gemini API Key Management =====

/**
 * Получить Gemini API ключ по умолчанию (из свойств сервера)
 * @return {string|null} API ключ или null
 */
function getDefaultGeminiKey_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty('GEMINI_API_KEY');

    if (!key) {
      Logger.log('⚠️ GEMINI_API_KEY not set in server properties');
      return null;
    }

    Logger.log('✅ Got default Gemini key from server: ' + key.substring(0, 10) + '...');
    return key;
  } catch (e) {
    Logger.log('❌ Error getting default Gemini key: ' + e.message);
    return null;
  }
}

/**
 * Установить Gemini API ключ по умолчанию (администратор)
 * @param {string} apiKey - Новый API ключ
 */
function setDefaultGeminiKey_(apiKey) {
  try {
    if (!apiKey) {
      Logger.log('❌ Cannot set empty API key');
      return false;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('GEMINI_API_KEY', apiKey);

    Logger.log('✅ Default Gemini key updated: ' + apiKey.substring(0, 10) + '...');
    return true;
  } catch (e) {
    Logger.log('❌ Error setting default Gemini key: ' + e.message);
    return false;
  }
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
  // 1. Если включен prompt_table → читаем только с удалённой таблицы
  if (config && config.prompt_table && config.prompt_table.cellAddress) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: '📡 prompt_table активен: системный промпт читается с удалённого сервера',
    });

    const cellAddress = config.prompt_table.cellAddress;

    try {
      // Используем существующую логику чтения с сервера,
      // которая сама знает ID таблицы и лист.
      const prompt = readPromptFromServerTable_(cellAddress, logs);

      logs.push({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: '✅ prompt_table прочитан с сервера: ' + cellAddress,
      });

      return prompt || '';
    } catch (e) {
      logs.push({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: '❌ Не удалось прочитать prompt_table с сервера: ' + e.message,
      });
      throw new Error('Не удалось прочитать prompt_table: ' + e.message);
    }
  }

  // СТАРЫЙ ПОДХОД: Использовать systemPrompt (обратная совместимость)
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
 * Read prompt from server table (LICENSE_SHEET_ID)
 * @param {string} cellAddress - Cell address to read from
 * @param {Array} logs - Array to collect log entries
 * @return {string} Prompt text
 */
function readPromptFromServerTable_(cellAddress, logs) {
  // Используем константы напрямую - сервер сам знает ID таблицы и лист
  const promptTableId = LICENSE_SHEET_ID;
  const promptSheetName = 'Промты';

  logs.push({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: '📂 Чтение prompt_table: ' + promptTableId + ' / ' + promptSheetName + '!' + cellAddress,
  });

  try {
    const prompt = serverReadData_(promptTableId, promptSheetName, cellAddress, logs);
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'SUCCESS',
      message: '✅ Промпт прочитан с серверной таблицы, ' + prompt.length + ' символов',
    });
    return prompt;
  } catch (error) {
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: '❌ Ошибка чтения с серверной таблицы: ' + error.message,
    });
    throw error;
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

// ═══════════════════════════════════════════════════════════════
// ⭐ SERVER AUTO-UPDATE
// ═══════════════════════════════════════════════════════════════

/**
 * Фоновая проверка обновлений сервера (триггер каждые 6 часов)
 */
// eslint-disable-next-line no-unused-vars
function checkServerAutoUpdate_() {
  try {
    Logger.log('🌙 Server auto-update check started');

    // Получаем текущий серверный код
    const currentServerCode = getServerFileContent_('server.gs');

    if (!currentServerCode) {
      Logger.log('❌ Cannot get current server code');
      return;
    }

    // Получаем код с GitHub
    const githubServerCode = fetchFileContent_(SERVER_PATH);

    if (!githubServerCode) {
      Logger.log('⚠️ Cannot fetch from GitHub - skipping update');
      return;
    }

    // Сравниваем
    const currentHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, currentServerCode);
    const githubHash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, githubServerCode);

    const currentHashB64 = Utilities.base64Encode(currentHash);
    const githubHashB64 = Utilities.base64Encode(githubHash);

    Logger.log(`Current server hash: ${currentHashB64.substring(0, 20)}...`);
    Logger.log(`GitHub server hash:  ${githubHashB64.substring(0, 20)}...`);

    if (currentHashB64 === githubHashB64) {
      Logger.log('✅ Server is up to date');
      return;
    }

    // Обновление доступно!
    Logger.log('🚀 Server update available! Updating...');

    // Обновляем серверный файл
    const currentProject = ScriptApp.getScript();
    const serverFile = currentProject.getFiles().find(function(file) {
      return file.getName() === 'server';
    });

    if (!serverFile) {
      Logger.log('❌ Server file not found in project');
      return;
    }

    try {
      serverFile.setContent(githubServerCode);
      Logger.log('✅ Server file updated successfully!');

      // Логируем обновление
      serverLog_({
        action: 'SERVER_AUTO_UPDATE',
        oldVersion: SERVER_VERSION,
        newHash: githubHashB64.substring(0, 20) + '...',
        timestamp: new Date().toISOString(),
      });

      // Перезагружаем deployment (если нужно)
      Logger.log('🎉 Server auto-update completed!');
    } catch (updateError) {
      Logger.log('❌ Update failed: ' + updateError.message);
      serverLog_({
        action: 'SERVER_AUTO_UPDATE_ERROR',
        error: updateError.message,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    Logger.log('❌ Server auto-update error: ' + e.message);
  }
}

/**
 * Получить содержимое файла сервера
 */
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

/**
 * Установить триггер автообновления сервера
 */
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

    Logger.log(`✅ Server auto-update trigger installed (every ${AUTO_UPDATE_CHECK_INTERVAL} hours)`);
  } catch (e) {
    Logger.log('❌ Error installing server auto-update: ' + e.message);
  }
}
/**
 * Установить все триггеры для сервера (запустить один раз после деплоя)
 */
// eslint-disable-next-line no-unused-vars
function setupServerTriggers() {
  Logger.log('=== SETUP SERVER TRIGGERS ===');

  try {
    // 1. Устанавливаем триггер автообновления
    installServerAutoUpdate_();

    // 2. Проверяем что он создался
    const triggers = ScriptApp.getProjectTriggers();
    let autoUpdateCount = 0;

    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkServerAutoUpdate_') {
        autoUpdateCount++;
      }
    }

    Logger.log(`✅ Server auto-update trigger: ${autoUpdateCount} installed`);
    Logger.log(`⏰ Check every ${AUTO_UPDATE_CHECK_INTERVAL} hours`);

    // 3. Логируем в sheet
    serverLog_({
      action: 'SERVER_TRIGGERS_INSTALLED',
      triggers: autoUpdateCount,
      version: SERVER_VERSION,
      timestamp: new Date().toISOString(),
    });

    return {success: true, triggers: autoUpdateCount};
  } catch (e) {
    Logger.log('❌ Setup error: ' + e.message);
    return {success: false, error: e.message};
  }
}

// ═════════════════════════════════════════════════════════════════
// GitHub PAT (АДМИНИСТРАТОР устанавливает один раз для приватного репо)
// ═════════════════════════════════════════════════════════════════

/**
 * Установить GitHub PAT (администратор)
 *
 * ВЫЗЫВАЕТСЯ ОДИН РАЗ при настройке приватного репо!
 *
 * Extensions → server.gs → Console
 * setGithubPAT('ghp_YOUR_TOKEN_HERE')
 */
// eslint-disable-next-line no-unused-vars
function setGithubPAT(pat) {
  return setGithubPAT_(pat);
}

/**
 * Проверить что GitHub доступен
 *
 * Extensions → server.gs → Console
 * testGithubAccess()
 */
// eslint-disable-next-line no-unused-vars
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

function test_serverGMImage_withDummyPng() {
  const dummy = Utilities.newBlob('test', 'image/png', 't.png');
  const img = {
    mimeType: dummy.getContentType(),
    data: Utilities.base64Encode(dummy.getBytes()),
  };

  const key = getDefaultGeminiKey_(); // уже есть
  if (!key) throw new Error('NO_DEFAULT_GEMINI_KEY');

  const res = serverGMImage_([img], 'ru', key, '____');
  Logger.log('OK, len=' + (res || '').length);
}
