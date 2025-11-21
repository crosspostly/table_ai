/**
 * GeminiService.gs - Интеграция с Gemini AI
 * Версия: 1.0.0
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog()
 * - LicenseAndSettingsService.gs: getLicenseEmail(), getLicenseToken(),
 *   hasStoredLicense(), seedLicenseCredentialsFromParametersSheet(), serverStatus()
 * - UtilsAndTriggers.gs: processGeminiResponse()
 *
 * Функции:
 * - GM() - основной вызов Gemini
 * - GM_IF() - условный вызов Gemini
 * - serverGM() - серверный вызов через API
 * - getGeminiApiKey() - получение API ключа
 * - initGeminiKey() - установка API ключа
 * - showGeminiKeyHelp() - справка по API ключу
 * - testServerConnection() - тестирование сервера
 */

// ====== КОНСТАНТЫ ======
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

// ====== ОСНОВНЫЕ ФУНКЦИИ GEMINI ======
/* eslint-disable-next-line new-cap, no-unused-vars */
function GM(prompt, maxTokens, temperature) {
  // Мягкий seed (не перезаписывает, только если пусто)
  if (!hasStoredLicense()) {
    seedLicenseCredentialsFromParametersSheet();
  }
  // Лицензия обязательна всегда: и в PROD, и в DEV. Если пустой email/token — блокируем.
  try {
    const _email = getLicenseEmail();
    const _token = getLicenseToken();
    if (!_email || !_token) {
      addLog('🚫 Отказ: лицензия не задана (email/token пустые)', 'WARN');
      return 'Error: LICENSE_REQUIRED';
    }

    if (DEV_MODE) {
      addLog('🔍 LICENSE CHECK: email=' + _email + ', token=' + (_token ? _token.substring(0, 4) + '****' : 'отсутствует'), 'DEBUG');
    }

    const st0 = serverStatus();
    if (!st0 || !st0.ok) {
      addLog('🚫 Отказ: лицензия неактивна или сервер недоступен. Статус: ' + (st0 && st0.error ? st0.error : 'UNKNOWN'), 'WARN');
      return 'Error: LICENSE_OR_SERVER';
    }

    if (DEV_MODE) {
      addLog('✅ LICENSE OK: ' + (st0.message || 'активна') + (st0.quota ? ', квота: ' + JSON.stringify(st0.quota) : ''), 'DEBUG');
    }
  } catch (eLic) {
    addLog('🚫 Отказ: ошибка проверки лицензии: ' + eLic.message, 'WARN');
    return 'Error: LICENSE_CHECK_FAILED';
  }

  if (maxTokens == null) maxTokens = 25000;
  if (temperature == null) temperature = 0.7;
  addLog('→ GM (proxy): prompt=' + (prompt ? prompt.slice(0, 60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ' символов)', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');

  const key = gmCacheKey_(prompt, maxTokens, temperature);
  const cached = gmCacheGet_(key);
  if (cached) {
    addLog('⚡ GM cache-hit: найден кэшированный ответ', 'DEBUG');
    return cached;
  }

  const errKey = 'gm_err:' + key;
  const lastErr = gmCacheGet_(errKey);
  if (lastErr) {
    addLog('⏳ GM last-error cached, skip call', 'DEBUG');
    return lastErr;
  }

  let ok = false;
  let text = '';
  let serr = null;

  try {
    addLog('🚀 Отправка запроса через serverGM...', 'DEBUG');
    const r = serverGM(prompt, maxTokens, temperature);
    if (r && r.ok) {
      ok = true;
      text = r.data;
      if (!text) {
        addLog('⚠️ GM вернул пустой текст', 'WARN');
        text = '[ПУСТОЙ ОТВЕТ]';
      }
    } else {
      serr = (r && r.error) ? r.error : 'UNKNOWN_ERROR';
      addLog('❌ GM ошибка: ' + serr, 'ERROR');
    }
  } catch (e) {
    serr = 'EXCEPTION: ' + e.message;
    addLog('❌ GM исключение: ' + e.message, 'ERROR');
  }

  if (ok && text) {
    // Кэшируем успешный результат на 15 минут
    gmCachePut_(key, text, 900);
    // Удаляем возможный кэш ошибки
    CacheService.getScriptCache().remove(errKey);
    addLog('✅ GM успешно: ' + text.length + ' символов', 'DEBUG');
    return processGeminiResponse(text);
  } else {
    // Кэшируем ошибку на 2 минуты, чтобы не спамить
    gmCachePut_(errKey, serr || 'GM_FAILED', 120);
    return 'Error: ' + (serr || 'GM_FAILED');
  }
}

/* eslint-disable-next-line new-cap, no-unused-vars */
function GM_IF(condition, prompt, maxTokens, temperature, _tick) {
  try {
    let condVal = false;
    // Нормализуем вход в одно скалярное значение
    let raw = condition;
    if (Array.isArray(raw)) {
      raw = (raw[0] && raw[0].length ? raw[0][0] : raw[0] || '');
    }
    const t = typeof raw;
    if (t === 'boolean') {
      condVal = raw === true;
    } else if (t === 'number') {
      condVal = raw !== 0;
    } else if (t === 'string') {
      const s = raw.trim().toLowerCase();
      // TRUE/ FALSE в любой локали: ИСТИНА/ЛОЖЬ; также 1/0; пустая строка → false
      condVal = (s === 'true' || s === 'истина' || s === '1' || s === 'да');
    } else {
      condVal = !!raw;
    }

    if (!condVal) {
      if (DEV_MODE) {
        addLog('GM_IF: условие false, пропускаем', 'DEBUG');
      }
      return '';
    }

    if (Array.isArray(prompt)) prompt = prompt[0][0];
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return '';
    if (maxTokens == null) maxTokens = 25000;
    if (temperature == null) temperature = 0.7;

    if (DEV_MODE) {
      addLog('GM_IF: условие true, вызываем GM', 'DEBUG');
    }

    /* eslint-disable-next-line new-cap, no-unused-vars */
    return GM(prompt, maxTokens, temperature);
  } catch (e) {
    addLog('❌ GM_IF ошибка: ' + e.message, 'ERROR');
    return 'Error: ' + e.message;
  }
}

function serverGM(prompt, maxTokens, temperature) {
  const email = getLicenseEmail();
  const token = getLicenseToken();
  const apiKey = getGeminiApiKey();
  const sheetId = SpreadsheetApp.getActive().getId();

  // DEV логирование
  if (DEV_MODE) {
    addLog(`SERVER REQUEST: action=gm, email=${email}, token=${token ? token.substring(0, 4) + '****' : 'null'}`, 'DEBUG');
    addLog(`PAYLOAD: sheetId=${sheetId}, promptLen=${prompt ? prompt.length : 0}, maxTokens=${maxTokens}`, 'DEBUG');

    if (prompt) {
      addLog(`PROMPT START: ${prompt.substring(0, 150)}...`, 'DEBUG');
    }
  }

  const payload = {
    action: 'gm',
    email: email,
    token: token,
    apiKey: apiKey,
    prompt: prompt,
    maxTokens: maxTokens,
    temperature: temperature,
    sheetId: sheetId,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    addLog(`📡 POST запрос на: ${SERVER_URL}`, 'DEBUG');
    const resp = UrlFetchApp.fetch(SERVER_URL, options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();

    // DEV логирование
    if (DEV_MODE) {
      addLog(`RAW RESPONSE: HTTP=${code}, length=${responseText.length}`, 'DEBUG');
      addLog(`RESPONSE START: ${responseText.substring(0, 200)}...`, 'DEBUG');
    }

    const data = JSON.parse(responseText);

    // DEV логирование
    if (DEV_MODE) {
      addLog(`PARSED RESPONSE: ok=${data && data.ok ? 'true' : 'false'}`, 'DEBUG');
    }

    if (!data.ok && data.error) {
      addLog(`SERVER ERROR: ${data.error}`, 'ERROR');
    }

    if (data.ok && data.data) {
      addLog(`GEMINI RESULT: length=${data.data.length}, start=${data.data.substring(0, 100)}...`, 'DEBUG');
    }

    if (data.quota) {
      addLog(`QUOTA INFO: ${JSON.stringify(data.quota)}`, 'DEBUG');
    }

    if (data.message) {
      addLog(`LICENSE MESSAGE: ${data.message}`, 'DEBUG');
    }

    if (code !== 200) {
      return {ok: false, error: (data && data.error) || `HTTP_${code}`};
    }

    return data;
  } catch (e) {
    addLog(`SERVER REQUEST FAILED: ${e.message}`, 'ERROR');
    return {ok: false, error: `REQUEST_FAILED: ${e.message}`};
  }
}

// ====== УПРАВЛЕНИЕ API КЛЮЧОМ ======
/* eslint-disable-next-line no-unused-vars */
function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('API-ключ Gemini не установлен. Меню: 🤖 Table AI → Установить API ключ Gemini');
  return key;
}

/* eslint-disable-next-line no-unused-vars */
function initGeminiKey() {
  const ui = SpreadsheetApp.getUi();
  const help = 'Где взять ключ (коротко):\n' +
             '1) Откройте: https://aistudio.google.com/app/apikey\n' +
             '2) Нажмите "Create API key"\n' +
             '3) Скопируйте ключ\n\n' +
             'Вставьте ключ в поле ниже и нажмите OK';
  const res = ui.prompt('🔑 Введите ваш Gemini API ключ', help, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const key = (res.getResponseText() || '').trim();
  if (key) {
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
    ui.alert('✅ Ключ установлен!');
    addLog('✅ Новый API ключ Gemini установлен', 'INFO');
  } else {
    ui.alert('❌ Ключ не введён.');
    addLog('❌ Gemini: ключ не введён', 'WARN');
  }
}

/* eslint-disable-next-line no-unused-vars */
function showGeminiKeyHelp() {
  const ui = SpreadsheetApp.getUi();
  const msg =
    'Как получить API ключ Gemini:\n\n' +
    '1) Откройте Google AI Studio: https://aistudio.google.com/app/apikey\n' +
    '2) Нажмите "Create API key" (создать ключ)\n' +
    '3) Скопируйте ключ\n' +
    '4) Меню: 🔑 Gemini → "Установить API ключ" → вставьте ключ\n\n' +
    'Документация: https://ai.google.dev/gemini-api/docs/api-key?hl=ru';
  ui.alert('❓ Как получить API ключ Gemini', msg, ui.ButtonSet.OK);
}

// ====== КЭШИРОВАНИЕ GEMINI ======
function gmCacheKey_(prompt, maxTokens, temperature) {
  try {
    const s = 'p:' + String(prompt) + '|mx:' + String(maxTokens) + '|t:' + String(temperature);
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
      let v = (bytes[i] & 0xFF).toString(16);
      if (v.length === 1) v = '0' + v;
      hex += v;
    }
    return 'gm:' + hex.substring(0, 64);
  } catch (e) {
    return 'gm:fallback:' + (String(prompt).length) + ':' + String(maxTokens) + ':' + String(temperature);
  }
}

function gmCacheGet_(key) {
  try {
    return CacheService.getScriptCache().get(key);
  } catch (e) {
    return null;
  }
}

function gmCachePut_(key, value, ttlSec) {
  try {
    const ttl = Math.max(5, Math.min(21600, Math.floor(ttlSec || 300)));
    CacheService.getScriptCache().put(key, value, ttl);
  } catch (e) {}
}

// ====== ТЕСТИРОВАНИЕ СЕРВЕРА ======
/* eslint-disable-next-line no-unused-vars */
function testServerConnection() {
  addLog('🔍 Тестирование подключения к серверу...', 'INFO');

  try {
    // Тест 1: GET запрос (ping)
    addLog('📡 GET запрос на: ' + SERVER_URL, 'DEBUG');
    const getResp = UrlFetchApp.fetch(SERVER_URL + '?test=ping', {muteHttpExceptions: true});
    const getCode = getResp.getResponseCode();
    const getText = getResp.getContentText();

    addLog('📥 GET RESPONSE: HTTP=' + getCode, 'DEBUG');
    addLog('📥 GET CONTENT: ' + getText.substring(0, 200) + '...', 'DEBUG');

    if (getCode === 200) {
      addLog('✅ GET запрос успешен', 'INFO');
    } else {
      addLog('❌ GET запрос провален: ' + getCode, 'ERROR');
    }
  } catch (e) {
    addLog('❌ GET запрос exception: ' + e.message, 'ERROR');
  }

  try {
    // Тест 2: POST запрос с минимальными данными

    const testPayload = {
      action: 'status',
      email: 'sheepoff@gmail.com',
      token: 'test',
      sheetId: SpreadsheetApp.getActive().getId(),
    };

    const postOptions = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true,
    };

    addLog('📡 POST запрос на: ' + SERVER_URL, 'DEBUG');
    addLog('📤 POST PAYLOAD: ' + JSON.stringify(testPayload), 'DEBUG');

    const postResp = UrlFetchApp.fetch(SERVER_URL, postOptions);
    const postCode = postResp.getResponseCode();
    const postText = postResp.getContentText();

    addLog('📥 POST RESPONSE: HTTP=' + postCode, 'DEBUG');
    addLog('📥 POST CONTENT: ' + postText.substring(0, 300) + '...', 'DEBUG');

    if (postCode === 200) {
      try {
        const postData = JSON.parse(postText);
        addLog('✅ POST запрос успешен, JSON валиден', 'INFO');
        addLog('📥 POST DATA: ' + JSON.stringify(postData), 'DEBUG');
      } catch (jsonErr) {
        addLog('❌ POST ответ не JSON: ' + jsonErr.message, 'ERROR');
      }
    } else {
      addLog('❌ POST запрос провален: ' + postCode, 'ERROR');
    }
  } catch (e2) {
    addLog('❌ POST запрос exception: ' + e2.message, 'ERROR');
  }

  // Экспортируем логи для просмотра
  exportLogsToSheet();

  SpreadsheetApp.getUi().alert('Тестирование завершено', 'Результаты в листе "Логи"', SpreadsheetApp.getUi().ButtonSet.OK);
}
