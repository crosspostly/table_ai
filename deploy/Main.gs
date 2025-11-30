

/**
 * TABLE AI - CLIENT (Google Sheets Container-bound Script)
 * v3.0.0 Refactoring: CLIENT = UI ONLY
 *
 * ИСПОЛЬЗУЕМЫЕ SHARED UTILITIES:
 * - SecurityValidator.gs: Валидация входных данных
 * - LoggingService.gs: Централизованное логирование
 * - Utils.gs: Helper функции
 * - EmojiRemover.gs: Очистка текста
 * - VersionInfo.gs: Информация о версии
 * - Constants.gs: Общие константы
 *
 * VK_PARSER: Отдельный веб-сервис (VK_PARSER_URL)
 * SERVER: Отдельный веб-сервис (SERVER_URL)
 */
/* exported onOpen, optimizedOTASetup, checkForUpdatesManual_, checkForUpdatesBackground_ */
/* exported setClientGeminiKey, removeClientGeminiKey, debugGeminiKeys */
/* eslint-disable indent, no-multiple-empty-lines, padded-blocks */

// VK Parser URL: используется в VK.gs
// eslint-disable-next-line no-unused-vars
const VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
// Фиксированный сервер (веб‑приложение) для лицензий/логов
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

// ====== КОНСТАНТЫ ДЛЯ АВТОМАТИЗАЦИИ (legacy-триггеры, оставлены для совместимости) ======
// eslint-disable-next-line no-unused-vars
const AUTO_PROCESSING_DELAY = 20000; // 20 сек
// eslint-disable-next-line no-unused-vars
const LONG_PROCESSING_DELAY = 45000; // 45 сек
// eslint-disable-next-line no-unused-vars
const COMPLETION_PHRASE = 'Отчёт готов';
// eslint-disable-next-line no-unused-vars
const PROCESSING_STATUS_KEY = 'AUTO_PROCESSING_STATUS';
const LOGS_CACHE_KEY = 'SYSTEM_LOGS';
const MAX_LOGS = 300;
const LOGS_TTL = 86400; // 24ч
// eslint-disable-next-line no-unused-vars
const MAX_RETRY_ATTEMPTS = 5;
// eslint-disable-next-line no-unused-vars
const RETRY_DELAY_INCREMENT = 10000;

// ====== DEV ФЛАГ ======
const DEV_MODE = true; // DEV: показывать DEV-меню/логи
// eslint-disable-next-line no-unused-vars
const DEVMODE = DEV_MODE;

// ⭐ OTA UPDATES
const CLIENT_VERSION = '3.5.0';

// В твоем мастер-листе добавь кнопку:
// eslint-disable-next-line no-unused-vars
function shareAsTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Создать копию с очищенными данными, но с кодом
  const copy = ss.copy('VK→Telegram Crossposter Template');

  // URL для пользователей
  const url = `https://docs.google.com/spreadsheets/d/${copy.getId()}/copy`;
  SpreadsheetApp.getUi().alert('Template URL готов:', url);
}
// ====== ЛОГИРОВАНИЕ ======
function addLog(msg, level = 'INFO') {
  try {
    const cache = CacheService.getScriptCache();
    let logs = cache.get(LOGS_CACHE_KEY);
    logs = logs ? JSON.parse(logs) : [];
    const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    logs.push({timestamp: ts, level: level, message: msg});
    if (logs.length > MAX_LOGS) logs.shift();
    cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), LOGS_TTL);
    console.log(`[${ts}] ${level}: ${msg}`);
  } catch (e) {
    console.error('Ошибка записи лога:', e.message);
  }
}

function getLogs(limit = 100) {
  try {
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) return 'Логи пусты.';
    const arr = JSON.parse(logs);
    const recent = arr.slice(-limit);
    return recent.map((x) => `[${x.timestamp}] ${x.level}: ${x.message}`).join('\n');
  } catch (e) {
    return 'Ошибка чтения логов: ' + e.message;
  }
}
// eslint-disable-next-line no-unused-vars
function showLogsDialog() {
  try {
    SpreadsheetApp.getUi().alert('📝 Логи (последние 100)', getLogs(100), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка показа логов: ' + e.message);
  }
}
// eslint-disable-next-line no-unused-vars
function exportLogsToSheet() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('Логи') || ss.insertSheet('Логи');
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) {
      addLog('❌ Нет логов для экспорта', 'WARN');
      SpreadsheetApp.getUi().alert('Информация', 'Логи отсутствуют.', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const logEntries = JSON.parse(logs);
    const data = [['Время', 'Уровень', 'Сообщение']];
    logEntries.forEach((e) => data.push([e.timestamp, e.level, e.message]));
    sheet.clear();
    sheet.getRange(1, 1, data.length, 3).setValues(data);
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.autoResizeColumns(1, 3);
    addLog('✅ Логи экспортированы в лист "Логи"', 'INFO');
    SpreadsheetApp.getUi().alert('Информация', 'Готово: логи экспортированы в "Логи".', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    addLog('❌ Ошибка экспорта логов: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка экспорта логов: ' + e.message);
  }
}
// eslint-disable-next-line no-unused-vars
function clearLogs() {
  try {
    CacheService.getScriptCache().remove(LOGS_CACHE_KEY);
    addLog('✅ Логи очищены', 'INFO');
    SpreadsheetApp.getUi().alert('Информация', 'Логи очищены.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

// ====== ТРИГГЕРЫ (просмотр/очистка) ======
// eslint-disable-next-line no-unused-vars
function cleanupOldTriggers() {
  try {
    addLog('🧹 Очистка старых триггеров...', 'INFO');
    const triggers = ScriptApp.getProjectTriggers();
    let deleted = 0; let kept = 0;
    triggers.forEach(function(trigger) {
      const fn = trigger.getHandlerFunction();
      if (fn !== 'onEdit' && fn !== 'onOpen') {
        if (fn === 'checkStepCompletion') {
          ScriptApp.deleteTrigger(trigger);
          deleted++;
          addLog('🗑️ Удален триггер: ' + fn, 'INFO');
        } else {
          kept++;
        }
      } else {
        kept++;
      }
    });
    const summary = '✅ Очистка: удалено ' + deleted + ', оставлено ' + kept;
    addLog(summary, 'INFO');
    SpreadsheetApp.getUi().alert(summary);
    return summary;
  } catch (e) {
    const msg = '❌ Ошибка очистки триггеров: ' + e.message;
    addLog(msg, 'ERROR');
    SpreadsheetApp.getUi().alert(msg);
    return msg;
  }
}
// eslint-disable-next-line no-unused-vars
function showActiveTriggersDialog() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    if (triggers.length === 0) {
      SpreadsheetApp.getUi().alert('Активные триггеры', 'Нет активных триггеров', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const list = triggers.map((t, i) => (i+1)+'. '+t.getHandlerFunction()+' ('+t.getEventType()+')').join('\n');
    SpreadsheetApp.getUi().alert('Активные триггеры', 'Всего: '+triggers.length+'\n\n'+list, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка показа триггеров: ' + e.message);
  }
}

// ====== MARKDOWN → читабельный текст ======
function convertMarkdownToReadableText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;
  let text = markdownText;
  try {
    text = text.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, (_m, code) => '\n' + String(code || '').trim() + '\n');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/\*\*([^*]+)\*\*/g, (_m, c) => String(c || '').toUpperCase());
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/^#{1,6}\s+(.+)$/gm, (_m, h) => '\n' + String(h || '').toUpperCase() + ':\n');
    let lines = text.split('\n');
    let inList = false; let listCounter = 0;
    lines = lines.map((line) => {
      const t = line.trim();
      if (/^[-*+]\s+/.test(t)) {
        if (!inList) {
          listCounter = 0; inList = true;
        }
        listCounter++;
        return line.replace(/^(\s*)[-*+]\s+/, '$1' + listCounter + '. ');
      } else if (t === '') {
        inList = false; return line;
      }
      inList = false; return line;
    });
    text = lines.join('\n');
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    text = text.replace(/\n{3,}/g, '\n\n').trim();
    addLog('✅ Markdown преобразован', 'DEBUG');
    return text;
  } catch (e) {
    addLog('❌ Ошибка MD преобразования: ' + e.message, 'ERROR');
    return markdownText;
  }
}
function isMarkdownText(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\*\*[^*]+\*\*/, /\*[^*]+\*/, /^#{1,6}\s+/m,
    /^[-*+]\s+/m, /\[.+\]\(.+\)/, /```[\s\S]*?```/, /`[^`]+`/,
  ];
  return patterns.some((p) => p.test(text));
}
function processGeminiResponse(response) {
  if (!response) return response;
  if (isMarkdownText(response)) {
    addLog('📝 Обнаружен Markdown → преобразуем', 'INFO');
    return convertMarkdownToReadableText(response);
  }
  return response;
}

// ====== ФРАЗА ГОТОВНОСТИ: из Параметры!B10 → Script Properties → дефолт ======
function getCompletionPhrase() {
  try {
    const ss = SpreadsheetApp.getActive();
    const params = ss.getSheetByName('Параметры');
    if (params) {
      try {
        const v = params.getRange('B10').getDisplayValue();
        if (v && String(v).trim()) return String(v).trim();
      } catch (e) {}
    }
    const prop = PropertiesService.getScriptProperties().getProperty('COMPLETION_PHRASE');
    if (prop && String(prop).trim()) return String(prop).trim();
  } catch (e) {
    addLog('⚠️ Ошибка чтения фразы готовности: ' + e.message, 'WARN');
  }
  return COMPLETION_PHRASE;
}
// Функция setCompletionPhraseUI удалена - больше не используется

// ====== УТИЛИТЫ ДЛЯ ПОСЛЕДОВАТЕЛЬНОСТИ ======
// eslint-disable-next-line no-unused-vars
function isCompletionReady(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  const phrase = getCompletionPhrase();
  const rdy = phrase ? clean.startsWith(phrase) : false;
  addLog(`🔍 Проверка готовности: "${clean.slice(0, 30)}..." против "${phrase}" → ${rdy ? 'ГОТОВО' : 'НЕ ГОТОВО'}`, 'DEBUG');
  return rdy;
}

function columnToLetter(column) {
  let temp; let letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function letterToColumn(letters) {
  const s = String(letters || '').toUpperCase().trim();
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    col = col * 26 + (s.charCodeAt(i) - 64);
  }
  return col;
}

function parseTargetA1(a1) {
  const raw = String(a1 || '').trim();
  if (!raw) throw new Error('Пустая ссылка на ячейку');
  const m = raw.match(/^([^!]+)!([A-Za-z]+)(\d+)$/);
  let sheetName; let colLetters; let row;
  if (m) {
    sheetName = m[1];
    colLetters = m[2];
    row = parseInt(m[3], 10);
  } else {
    const m2 = raw.match(/^([A-Za-z]+)(\d+)$/);
    if (!m2) throw new Error('Неверный формат ячейки: ' + raw);
    sheetName = 'Распаковка';
    colLetters = m2[1];
    row = parseInt(m2[2], 10);
  }
  if (sheetName !== 'Распаковка') throw new Error('Ожидался лист "Распаковка", получено: ' + sheetName);
  const col = letterToColumn(colLetters);
  return {sheetName: sheetName, row: row, col: col, a1: (colLetters.toUpperCase() + row)};
}

function prepareChainSmart() {
  const ss = SpreadsheetApp.getActive();
  const prompt = ss.getSheetByName('Prompt_box');
  let hasTargets = false;
  if (prompt) {
    const lastRow = Math.max(2, prompt.getLastRow());
    const vals = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim()) {
        hasTargets = true; break;
      }
    }
  }
  if (hasTargets) {
    prepareChainFromPromptBox();
  } else {
    prepareChainForA3();
  }
}

function prepareChainFromPromptBox() {
  const ss = SpreadsheetApp.getActive();
  const prompt = ss.getSheetByName('Prompt_box');
  const pack = ss.getSheetByName('Распаковка');
  if (!prompt) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Prompt_box" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  if (!pack) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }

  const lastRow = Math.max(2, prompt.getLastRow());
  const targets = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B — ячейка назначения
  const mappings = [];
  for (let r = 2; r <= lastRow; r++) {
    const targetStr = String(targets[r - 2][0] || '').trim();
    if (!targetStr) continue;
    try {
      const parsed = parseTargetA1(targetStr);
      mappings.push({promptRow: r, targetRow: parsed.row, targetCol: parsed.col, targetA1: parsed.a1});
    } catch (e) {
      addLog('⚠️ Пропуск строки Prompt_box!B' + r + ': ' + e.message, 'WARN');
    }
  }

  if (!mappings.length) {
    SpreadsheetApp.getUi().alert('Информация', 'Нет целевых ячеек в Prompt_box!B, ничего не сделано.', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }

  const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  const phraseEscaped = phrase.replace(/"/g, '""');

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    let cond;
    if (i === 0) {
      // Всегда якорь от A3
      cond = '$A3<>""';
    } else {
      const prev = mappings[i - 1];
      cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
    }
    const formula = '=GM_IF(' + cond + ', Prompt_box!$F$' + m.promptRow + ', 25000, 0.7)';
    pack.getRange(m.targetRow, m.targetCol).setFormula(formula);
    addLog('📝 Формула установлена → Распаковка!' + m.targetA1 + ' из Prompt_box!F' + m.promptRow, 'INFO');
  }

  SpreadsheetApp.getUi().alert('✅ Готово: формулы расставлены по целям из Prompt_box!B.\\n' +
    'Первая ячейка запустится при заполнении соответствующего A-столбца, далее — по фразе готовности.');
}
function prepareChainForA3() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Распаковка');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  const row = 3;
  const startCol = 2; // B
  const steps = 6; // B..G
  const endCol = startCol + steps - 1;
  const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  const phraseEscaped = phrase.replace(/"/g, '""');

  for (let col = startCol; col <= endCol; col++) {
    const stepIndex = col - 1; // B=1 -> шаг 1
    const promptRow = stepIndex + 1; // шаг 1 -> F2 ... шаг 6 -> F7
    const target = sheet.getRange(row, col);
    const promptRef = 'Prompt_box!$F$' + promptRow;
    let formula;
    if (col === 2) {
      formula = '=GM_IF($A3<>"", ' + promptRef + ', 25000, 0.7)';
    } else {
      const prevColLetter = columnToLetter(col - 1);
      formula = '=GM_IF(LEFT(' + prevColLetter + '3, LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", ' + promptRef + ', 25000, 0.7)';
    }
    target.setFormula(formula);
    addLog('📝 Формула ' + target.getA1Notation() + ' установлена', 'DEBUG');
  }
  SpreadsheetApp.getUi().alert('Готово', '✅ Готово: формулы B3..G3 проставлены.\nЗаполните A3 — шаги пойдут по очереди.', SpreadsheetApp.getUi().ButtonSet.OK);
}
function clearChainForA3() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Распаковка');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Распаковка" не найден', SpreadsheetApp.getUi().ButtonSet.OK); return;
  }
  sheet.getRange(3, 2, 1, 6).clearContent(); // B3..G3
  SpreadsheetApp.getUi().alert('Информация', '🧹 Очищено: B3..G3', SpreadsheetApp.getUi().ButtonSet.OK);
}

function getGeminiApiKey() {
  Logger.log('=== getGeminiApiKey START ===');

  // Priority 1: Check for user-provided API key first
  const userApiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (userApiKey) {
    Logger.log('Using USER API key, length: ' + userApiKey.length);
    return userApiKey;
  }

  // Priority 2: Check for script-level API key (default)
  const scriptApiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (scriptApiKey) {
    Logger.log('Using DEFAULT API key, length: ' + scriptApiKey.length);
    return scriptApiKey;
  }

  Logger.log('ERROR: No API key available (neither user nor default)');
  throw new Error('API-ключ Gemini не установлен. Меню: 🤖 Table AI → Установить API ключ Gemini');
}
// ====== КЭШ ДЛЯ GM ======
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
// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
function initGeminiKey() {
  const ui = SpreadsheetApp.getUi();
  const help = 'Где взять ключ (коротко):\n' +
             '1) Откройте: https://aistudio.google.com/app/apikey\n' +
             '2) Нажмите “Create API key”\n' +
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
// eslint-disable-next-line no-unused-vars
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
// eslint-disable-next-line no-unused-vars
function refreshSelectedGMTriggers() {
  const ss = SpreadsheetApp.getActive();
  const paramsSheet = ss.getSheetByName('Параметры');
  if (!paramsSheet) return;
  const activeCell = ss.getActiveRange();
  const cell = activeCell.getCell(1, 1);
  const row = cell.getRow();
  const triggerCell = paramsSheet.getRange(row, 26); // Z
  const current = triggerCell.getValue();
  triggerCell.setValue(current ? '' : '.');
  addLog('🔄 GM триггер обновлен для строки ' + row, 'DEBUG');
}

// ====== Форматирование ======
// eslint-disable-next-line no-unused-vars
function applyUniformFormatting(sheet) {
  try {
    const range = sheet.getDataRange();
    range.setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('left');
    addLog('✅ Применено форматирование к листу ' + sheet.getName(), 'DEBUG');
  } catch (e) {
    addLog('⚠️ Ошибка форматирования листа ' + sheet.getName() + ': ' + e.message, 'WARN');
  }
}

// ====== Меню ======
function onOpen() {
  try {
    // ⭐ УСТАНАВЛИВАЕМ ТРИГГЕР (быстро - просто проверка)
    installUpdateTrigger_();

    const ui = SpreadsheetApp.getUi();
    const aiMenu = ui.createMenu('🎯 AI Конструктор')
      .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
      .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
      .addSeparator();

    for (const [key, config] of Object.entries(BATCH_OPERATIONS)) {
      const funcName = key.charAt(0).toUpperCase() + key.slice(1);
      aiMenu.addItem(config.name, funcName);
    }

    ui.createMenu('🤖 Table AI')
      .addSubMenu(aiMenu)
      .addSeparator()
      .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer')
      .addSeparator()
      .addItem('📥 Импорт VK постов', 'importVkPosts')
      .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
      .addSeparator()
      .addItem('⚙️ Настройки', 'openSettingsUI')
      .addItem('🔄 Автообновление', 'optimizedOTASetup')
      // ⭐ Убрали отдельную кнопку - проверка теперь в Settings при сохранении
      .addToUi();

    if (DEV_MODE) {
      ui.createMenu('🧰 DEV')
        .addItem('📝 Показать логи', 'showLogsDialog')
        .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
        .addItem('🗑 Очистить логи', 'clearLogs')
        .addItem('🔍 Тест сервера', 'testServerConnection')
        .addItem('🧪 Dev Self Test', 'runDevSelfTest')
        .addItem('🔄 Обновить вручную', 'checkForUpdatesManual_')
        .addSeparator()
        .addItem('🔑 Debug Gemini Keys', 'debugGeminiKeys')
        .addToUi();
    }

    addLog('✅ Меню загружено', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка меню: ' + e.message, 'ERROR');
  }
}
/**
 * Оптимизированная установка OTA триггеров
 * - Проверяет если триггер уже есть
 * - Если есть → пропускает установку
 * - Переходит к проверке обновлений
 * - Минимум всплывающих сообщений
 */
// eslint-disable-next-line no-unused-vars
function optimizedOTASetup() {
  try {
    addLog('⚙️ OTA Setup started', 'DEBUG');

    // ШАГ 1: Проверяем существующие триггеры
    const triggers = ScriptApp.getProjectTriggers();
    let hasOTA = false;

    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'checkForUpdatesBackground_') {
        hasOTA = true;
        break;
      }
    }

    // ШАГ 2: Если триггера нет - создаём
    if (!hasOTA) {
      addLog('📚 Creating OTA trigger...', 'DEBUG');

      try {
        ScriptApp.newTrigger('checkForUpdatesBackground_')
          .timeBased()
          .atHour(3)
          .everyDays(1)
          .create();

        addLog('✅ OTA trigger created', 'INFO');
      } catch (triggerError) {
        addLog(`❌ Failed to create trigger: ${triggerError.message}`, 'ERROR');
        SpreadsheetApp.getUi().alert(
          '❌ Ошибка\n\n' +
          'Не удалось создать триггер автообновления.\n\n' +
          'Причина: ' + triggerError.message,
        );
        return;
      }
    } else {
      addLog('✅ OTA trigger already exists', 'DEBUG');
    }

    // ШАГ 3: Проверяем обновления (основной шаг)
    addLog('🔍 Checking for updates...', 'DEBUG');
    checkForUpdatesManual_();

  } catch (e) {
    addLog(`❌ OTA Setup error: ${e.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert(
      '❌ Ошибка автообновления\n\n' + e.message,
    );
  }
}

/**
 * Возвращает полный список доступных функций Table AI для мобильного приложения
 * Включает все функции из меню, их метаданные и параметры
 */
function listExposedFunctions() {
  try {
    addLog('📱 Запрос списка функций от мобильного приложения', 'INFO');

    const functions = [];

    // AI Constructor меню
    functions.push(
      {
        name: 'openCollectConfigUI',
        label: '🎯 Настроить запрос',
        description: 'Создание и настройка AI-запросов',
        category: 'ai',
        menuPath: '🎯 AI Конструктор',
        order: 1,
        returnsHtml: false,
        parameters: [],
      },
      {
        name: 'refreshCellWithConfig',
        label: '🔄 Обновить ячейку',
        description: 'Обновить выбранную ячейку с конфигурацией',
        category: 'ai',
        menuPath: '🎯 AI Конструктор',
        order: 2,
        returnsHtml: false,
        parameters: [
          {
            name: 'targetCell',
            type: 'string',
            description: 'Адрес ячейки для обновления (опционально)',
            required: false,
          },
        ],
      },
    );

    // Batch операции из BATCH_OPERATIONS
    if (typeof BATCH_OPERATIONS !== 'undefined') {
      let batchOrder = 10;
      for (const [key, config] of Object.entries(BATCH_OPERATIONS)) {
        const funcName = key.charAt(0).toUpperCase() + key.slice(1);
        functions.push({
          name: funcName,
          label: config.name || `Batch: ${key}`,
          description: `Batch операция: ${config.name || key}`,
          category: 'data',
          menuPath: '🎯 AI Конструктор',
          order: batchOrder++,
          returnsHtml: false,
          parameters: [
            {
              name: 'sheetName',
              type: 'string',
              description: 'Имя листа для обработки',
              required: false,
            },
          ],
        });
      }
    }

    // Основное меню Table AI
    functions.push(
      {
        name: 'openUnpackingViewer',
        label: '📦 Просмотр Распаковки',
        description: 'Просмотр результатов обработки данных',
        category: 'data',
        menuPath: '🤖 Table AI',
        order: 100,
        returnsHtml: true,
        parameters: [],
      },
      {
        name: 'importVkPosts',
        label: '📥 Импорт VK постов',
        description: 'Загрузка постов из ВКонтакте',
        category: 'data',
        menuPath: '🤖 Table AI',
        order: 101,
        returnsHtml: false,
        parameters: [
          {
            name: 'sourceUrl',
            type: 'string',
            description: 'URL источника VK постов',
            required: false,
          },
        ],
      },
      {
        name: 'ocrRun',
        label: '🖼️ Транскрибация отзывов',
        description: 'Распознавание текста с изображений',
        category: 'ai',
        menuPath: '🤖 Table AI',
        order: 102,
        returnsHtml: false,
        parameters: [
          {
            name: 'range',
            type: 'string',
            description: 'Диапазон ячеек с изображениями',
            required: false,
          },
        ],
      },
      {
        name: 'openSettingsUI',
        label: '⚙️ Настройки',
        description: 'Конфигурация Table AI',
        category: 'settings',
        menuPath: '🤖 Table AI',
        order: 103,
        returnsHtml: true,
        parameters: [],
      },
      {
        name: 'checkLicenseStatusUI',
        label: '🔒 Проверить лицензию',
        description: 'Проверка статуса лицензии',
        category: 'settings',
        menuPath: '🤖 Table AI',
        order: 104,
        returnsHtml: false,
        parameters: [],
      },
    );

    // Dev функции (если в DEV_MODE)
    if (DEV_MODE) {
      functions.push(
        {
          name: 'showLogsDialog',
          label: '📝 Показать логи',
          description: 'Показать системные логи',
          category: 'dev',
          menuPath: '🧰 DEV',
          order: 200,
          returnsHtml: false,
          parameters: [],
        },
        {
          name: 'exportLogsToSheet',
          label: '⬇️ Экспорт логов',
          description: 'Экспортировать логи в лист',
          category: 'dev',
          menuPath: '🧰 DEV',
          order: 201,
          returnsHtml: false,
          parameters: [],
        },
        {
          name: 'clearLogs',
          label: '🗑 Очистить логи',
          description: 'Очистить системные логи',
          category: 'dev',
          menuPath: '🧰 DEV',
          order: 202,
          returnsHtml: false,
          parameters: [],
        },
        {
          name: 'testServerConnection',
          label: '🔍 Тест сервера',
          description: 'Проверить соединение с сервером',
          category: 'dev',
          menuPath: '🧰 DEV',
          order: 203,
          returnsHtml: false,
          parameters: [],
        },
        {
          name: 'runDevSelfTest',
          label: '🧪 Dev Self Test',
          description: 'Запустить самотестирование',
          category: 'dev',
          menuPath: '🧰 DEV',
          order: 204,
          returnsHtml: false,
          parameters: [],
        },
      );
    }

    const result = {
      success: true,
      functions: functions.sort((a, b) => a.order - b.order),
      metadata: {
        version: '3.0.0',
        devMode: DEV_MODE,
        totalFunctions: functions.length,
        timestamp: new Date().toISOString(),
      },
    };

    addLog(`✅ Список функций сформирован: ${functions.length} функций`, 'INFO');
    return result;
  } catch (e) {
    const errorMsg = `Ошибка формирования списка функций: ${e.message}`;
    addLog(`❌ ${errorMsg}`, 'ERROR');
    return {
      success: false,
      error: errorMsg,
      functions: [],
    };
  }
}

/**
 * Выполняет функцию с логированием для мобильного приложения
 * @param {string} functionName - Имя функции для выполнения
 * @param {Object} parameters - Параметры функции
 * @return {Object} - Результат выполнения
 */
// eslint-disable-next-line no-unused-vars
function executeFunction(functionName, parameters = {}) {
  try {
    addLog(`📱 Запуск функции "${functionName}" из мобильного приложения`, 'INFO');

    // Проверяем существование функции
    if (typeof this[functionName] !== 'function') {
      throw new Error(`Функция "${functionName}" не найдена`);
    }

    // Выполняем функцию с параметрами
    const startTime = Date.now();
    let result;

    try {
      if (Object.keys(parameters).length > 0) {
        result = this[functionName](parameters);
      } else {
        result = this[functionName]();
      }
    } catch (funcError) {
      throw funcError;
    }

    const executionTime = Date.now() - startTime;

    const response = {
      success: true,
      functionName: functionName,
      result: result,
      executionTime: executionTime,
      timestamp: new Date().toISOString(),
    };

    addLog(`✅ Функция "${functionName}" выполнена за ${executionTime}мс`, 'INFO');
    return response;
  } catch (e) {
    const errorMsg = `Ошибка выполнения функции "${functionName}": ${e.message}`;
    addLog(`❌ ${errorMsg}`, 'ERROR');

    return {
      success: false,
      functionName: functionName,
      error: errorMsg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Получает статус скрипта для мобильного приложения
 */
// eslint-disable-next-line no-unused-vars
function getScriptStatus() {
  try {
    const ss = SpreadsheetApp.getActive();
    const status = {
      success: true,
      scriptId: ScriptApp.getScriptId(),
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      devMode: DEV_MODE,
      version: '3.0.0',
      lastUpdated: new Date().toISOString(),
      user: Session.getEffectiveUser().getEmail(),
      functions: listExposedFunctions(),
    };

    addLog('📱 Запрос статуса скрипта от мобильного приложения', 'INFO');
    return status;
  } catch (e) {
    const errorMsg = `Ошибка получения статуса скрипта: ${e.message}`;
    addLog(`❌ ${errorMsg}`, 'ERROR');

    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Быстрое обновление активной GM-ячейки: пересоздаём формулу, чтобы заново вызвать Gemini
// eslint-disable-next-line no-unused-vars
function refreshCurrentGMCell() {
  try {
    const ss = SpreadsheetApp.getActive();
    const range = ss.getActiveRange();
    if (!range) {
      SpreadsheetApp.getUi().alert('Информация', 'Выберите ячейку на листе "Распаковка"', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const cell = range.getCell(1, 1);
    const sheet = cell.getSheet();
    if (sheet.getName() !== 'Распаковка') {
      SpreadsheetApp.getUi().alert('Информация', 'Выберите ячейку на листе "Распаковка"', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    const row = cell.getRow();
    const col = cell.getColumn();

    let formula = cell.getFormula();
    const hasGm = formula && (/^\s*=\s*GM_IF\s*\(/i.test(formula) || /\bGM\s*\(/i.test(formula));
    if (!hasGm) {
      // Попробуем найти соответствие этой ячейки в Prompt_box!B (умный режим)
      const promptSheet = ss.getSheetByName('Prompt_box');
      if (promptSheet) {
        const lastRow = Math.max(2, promptSheet.getLastRow());
        const targets = promptSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
        const mappings = [];
        for (let r = 2; r <= lastRow; r++) {
          const tstr = String(targets[r - 2][0] || '').trim();
          if (!tstr) continue;
          try {
            const parsed = parseTargetA1(tstr);
            mappings.push({promptRow: r, targetA1: parsed.a1, targetRow: parsed.row, targetCol: parsed.col});
          } catch (e) {}
        }
        if (mappings.length) {
          const currentA1 = columnToLetter(col) + row;
          let idx = -1;
          for (let i = 0; i < mappings.length; i++) {
            if (mappings[i].targetA1 === currentA1) {
              idx = i; break;
            }
          }
          if (idx >= 0) {
            const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
            const phraseEscaped = phrase.replace(/"/g, '""');
            let cond;
            if (idx === 0) {
              cond = '$A3<>""';
            } else {
              const prev = mappings[idx - 1];
              cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
            }
            const promptRef = 'Prompt_box!$F$' + mappings[idx].promptRow;
            formula = '=GM_IF(' + cond + ', ' + promptRef + ', 25000, 0.7)';
          }
        }
      }
    }
    if (!formula) {
      SpreadsheetApp.getUi().alert('Информация', 'Нечего обновлять: в ячейке нет GM-формулы и нет соответствия в Prompt_box!B', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }

    cell.clearContent();
    SpreadsheetApp.flush();
    Utilities.sleep(50);
    cell.setFormula(formula);
    SpreadsheetApp.flush();
    addLog('🔁 Обновлена ячейка ' + cell.getA1Notation(), 'INFO');
  } catch (e) {
    addLog('❌ Ошибка обновления ячейки: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}
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

    return GM(prompt, maxTokens, temperature);
  } catch (e) {
    addLog('❌ GM_IF ошибка: ' + e.message, 'ERROR');
    return 'Error: ' + e.message;
  }
}

// ====== onEdit: авто-очистка Markdown для строки 3 (B..G) ======
// eslint-disable-next-line no-unused-vars
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const col = range.getColumn();
  const row = range.getRow();

  if (sheetName === 'Распаковка') {
    if (row === 3 && col > 1 && e.value && typeof e.value === 'string') {
      const processed = processGeminiResponse(e.value);
      if (processed !== e.value) {
        range.setValue(processed);
        addLog('🔄 Автопреобразование Markdown в ' + range.getA1Notation(), 'INFO');
      }
    }
  }

  // Убран режим B1-чекбокса по просьбе пользователя — запуск через рисунок с назначенной функцией
}

// Горячая кнопка теперь через рисунок с назначенной функцией ocrReviews

// ====== DEV: Автотесты (не включать в продукт: DEV_MODE=false) ======
// eslint-disable-next-line no-unused-vars
function runDevSelfTest() {
  const failures = [];
  try {
    // 1) columnToLetter
    const map = {1: 'A', 2: 'B', 7: 'G', 26: 'Z', 27: 'AA', 28: 'AB'};
    Object.keys(map).forEach((k) => {
      const got = columnToLetter(parseInt(k, 10));
      if (got !== map[k]) failures.push('columnToLetter(' + k + ') → ' + got + ' (ожидалось ' + map[k] + ')');
    });

    // 2) Markdown detection & conversion
    const md = '**bold**\n- a\n- b\n';
    if (!isMarkdownText(md)) failures.push('isMarkdownText не распознал MD');
    const conv = convertMarkdownToReadableText(md);
    if (!conv || conv.indexOf('BOLD') === -1) failures.push('convertMarkdownToReadableText не преобразовал **bold** → BOLD');

    // 3) GM_IF sleep behavior
    const r = GM_IF(false, 'no-call');
    if (r !== '') failures.push('GM_IF при false условии должен возвращать пусто');

    // 4) Формулы для A3 (не трогаем содержимое, только проверяем, что ставятся корректно)
    const ss = SpreadsheetApp.getActive();
    const existed = !!ss.getSheetByName('Распаковка');
    const rSheet = existed ? ss.getSheetByName('Распаковка') : ss.insertSheet('Распаковка');
    const snapshot = [];
    for (let c=2; c<=7; c++) {
      snapshot.push(rSheet.getRange(3, c).getFormula());
    }
    prepareChainForA3();
    const expectedB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)';
    const gotB3 = rSheet.getRange(3, 2).getFormula();
    if (gotB3 !== expectedB3) failures.push('B3 формула некорректна: '+gotB3);
    clearChainForA3();
    // Восстановление прежних формул
    for (let c2=2; c2<=7; c2++) {
      if (snapshot[c2-2]) rSheet.getRange(3, c2).setFormula(snapshot[c2-2]);
    }
    if (!existed) ss.deleteSheet(rSheet);

    // 5) Умный режим: Prompt_box!B2:B3 → B3,C3 с якорем от A3
    const pbExisted = !!ss.getSheetByName('Prompt_box');
    const pb = pbExisted ? ss.getSheetByName('Prompt_box') : ss.insertSheet('Prompt_box');
    const bSnap = pb.getRange(2, 2, 2, 1).getDisplayValues(); // B2:B3
    const fSnap = pb.getRange(2, 6, 2, 1).getFormulas(); // F2:F3
    pb.getRange(2, 2).setValue('B3');
    pb.getRange(3, 2).setValue('C3');
    pb.getRange(2, 6).setFormula('="P1"');
    pb.getRange(3, 6).setFormula('="P2"');

    const rSheet2 = ss.getSheetByName('Распаковка') || ss.insertSheet('Распаковка');
    const b3Before = rSheet2.getRange(3, 2).getFormula();
    const c3Before = rSheet2.getRange(3, 3).getFormula();

    prepareChainSmart();

    const phrase2 = getCompletionPhrase() || COMPLETION_PHRASE;
    const phraseEsc2 = phrase2.replace(/"/g, '""');
    const expB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)';
    const expC3 = '=GM_IF(LEFT(B3, LEN("' + phraseEsc2 + '"))="' + phraseEsc2 + '", Prompt_box!$F$3, 25000, 0.7)';
    const gotB3_2 = rSheet2.getRange(3, 2).getFormula();
    const gotC3_2 = rSheet2.getRange(3, 3).getFormula();
    if (gotB3_2 !== expB3) failures.push('Smart-режим: формула B3 некорректна: ' + gotB3_2);
    if (gotC3_2 !== expC3) failures.push('Smart-режим: формула C3 некорректна: ' + gotC3_2);

    // Восстановление
    if (b3Before) rSheet2.getRange(3, 2).setFormula(b3Before); else rSheet2.getRange(3, 2).clearContent();
    if (c3Before) rSheet2.getRange(3, 3).setFormula(c3Before); else rSheet2.getRange(3, 3).clearContent();
    pb.getRange(2, 2, 2, 1).setValues(bSnap);
    pb.getRange(2, 6, 2, 1).setFormulas(fSnap);
    if (!pbExisted) ss.deleteSheet(pb);
  } catch (e) {
    failures.push('Исключение автотестов: '+e.message);
  }

  if (failures.length) {
    addLog('❌ DEV-тесты: провалено '+failures.length+' пункт(ов)\n'+failures.join('\n'), 'ERROR');
    SpreadsheetApp.getUi().alert('❌ DEV-тесты: есть проблемы', failures.join('\n'));
  } else {
    addLog('✅ DEV-тесты: всё зелёное', 'INFO');
    SpreadsheetApp.getUi().alert('Готово', '✅ DEV-тесты пройдены', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ===== LICENSE & SERVER PROXY (patch) =====
/**
 * Автоматическая миграция старых ключей в новый формат
 * Вызывается при первом обращении к getLicenseEmail/getLicenseToken
 * @return {boolean} true если была выполнена миграция
 */
function migrateLicenseKeysIfNeeded_() {
  try {
    const props = PropertiesService.getScriptProperties();

    // Проверяем наличие СТАРЫХ ключей
    const oldEmail = props.getProperty('LICENSEEMAIL');
    const oldToken = props.getProperty('LICENSETOKEN');

    // Проверяем наличие НОВЫХ ключей
    const newEmail = props.getProperty('LICENSE_EMAIL');
    const newToken = props.getProperty('LICENSE_TOKEN');

    let migrated = false;

    // Если есть старый email, но нет нового - мигрируем
    if (oldEmail && !newEmail) {
      props.setProperty('LICENSE_EMAIL', oldEmail);
      props.deleteProperty('LICENSEEMAIL');
      Logger.log('✅ Migrated LICENSEEMAIL → LICENSE_EMAIL');
      migrated = true;
    }

    // Если есть старый token, но нет нового - мигрируем
    if (oldToken && !newToken) {
      props.setProperty('LICENSE_TOKEN', oldToken);
      props.deleteProperty('LICENSETOKEN');
      Logger.log('✅ Migrated LICENSETOKEN → LICENSE_TOKEN');
      migrated = true;
    }

    if (migrated) {
      addLog('✅ Выполнена миграция лицензионных ключей в новый формат', 'INFO');
    }

    return migrated;
  } catch (e) {
    Logger.log('⚠️ Migration error (non-critical): ' + e.message);
    return false;
  }
}

function getLicenseEmail() {
  // Автомиграция при первом обращении
  migrateLicenseKeysIfNeeded_();

  return PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL') || '';
}
function getLicenseToken() {
  // Автомиграция при первом обращении
  migrateLicenseKeysIfNeeded_();

  return PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN') || '';
}
function hasStoredLicense() {
  // Автомиграция перед проверкой
  migrateLicenseKeysIfNeeded_();

  try {
    const email = getLicenseEmail();
    const token = getLicenseToken();
    return !!(email && token && String(email).trim() && String(token).trim());
  } catch (e) {
    addLog('hasStoredLicense: ' + e.message, 'WARN');
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
function setLicenseCredentialsUI() {
  const ui = SpreadsheetApp.getUi();
  const curEmail = getLicenseEmail();
  const curToken = getLicenseToken();
  const emailRes = ui.prompt('🔐 Лицензия — Email', 'Введите Email (для проверки лицензии). Текущий: ' + (curEmail || '—'), ui.ButtonSet.OK_CANCEL);
  if (emailRes.getSelectedButton() !== ui.Button.OK) return;
  const email = (emailRes.getResponseText() || '').trim();
  const tokenRes = ui.prompt('🔐 Лицензия — Токен', 'Введите Токен (из таблицы лицензий). Текущий: ' + (curToken ? (curToken.substring(0, 4)+'****') : '—'), ui.ButtonSet.OK_CANCEL);
  if (tokenRes.getSelectedButton() !== ui.Button.OK) return;
  const token = (tokenRes.getResponseText() || '').trim();
  if (!email || !token) {
    ui.alert('Email и Токен обязательны.'); return;
  }
  PropertiesService.getScriptProperties().setProperty('LICENSE_EMAIL', email);
  PropertiesService.getScriptProperties().setProperty('LICENSE_TOKEN', token);
  ui.alert('✅ Лицензия сохранена.');
}

// eslint-disable-next-line no-unused-vars
function getScriptProp(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

// eslint-disable-next-line no-unused-vars
function setScriptProp(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

/**
 * Однократное засидывание лицензии из листа "Параметры":
 * - Читает email из G1 и token из H1
 * - Пишет их в ScriptProperties как LICENSE_EMAIL / LICENSE_TOKEN
 * - НЕ трогает LICENSE_KEY (пусть создается/проверяется через текущую логику)
 * Возвращает true, если данные записаны; false — если не нашлись или уже были.
 */
function seedLicenseCredentialsFromParametersSheet() {
  try {
    // Проверяем через функции-геттеры (они уже содержат миграцию)
    const curEmail = getLicenseEmail();
    const curToken = getLicenseToken();

    // Если УЖЕ есть - НЕ перезаписываем
    if (curEmail && curToken) {
      Logger.log('DEBUG: License already exists, skipping seed');
      return false;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Параметры');
    if (!sheet) {
      Logger.log('DEBUG: Sheet "Параметры" not found');
      return false;
    }

    // Читаем из G1 и H1
    const email = String(sheet.getRange('G1').getDisplayValue() || '').trim();
    const token = String(sheet.getRange('H1').getDisplayValue() || '').trim();

    if (!email || !token) {
      Logger.log('DEBUG: G1 or H1 empty (G1="' + email + '", H1="' + (token ? '***' : '') + '")');
      return false;
    }

    // Сохраняем в ПРАВИЛЬНЫЕ ключи
    const scriptProps = PropertiesService.getScriptProperties();
    scriptProps.setProperty('LICENSE_EMAIL', email);
    scriptProps.setProperty('LICENSE_TOKEN', token);

    Logger.log('INFO: License credentials seeded from Параметры sheet');
    Logger.log('  - LICENSE_EMAIL: ' + email);
    Logger.log('  - LICENSE_TOKEN: ' + token.substring(0, 4) + '***');

    addLog('✅ Лицензия загружена из листа "Параметры"', 'INFO');
    return true;
  } catch (e) {
    Logger.log('WARN: seed_license_from_params_error: ' + e.message);
    return false;
  }
}


function serverStatus() {
  // 0) Если лицензии нет — один раз попробовать засидить из Параметры!G1/H1
  if (!hasStoredLicense()) {
    seedLicenseCredentialsFromParametersSheet();
  }

  // 1) Читаем значения из ScriptProperties (после возможного seed)
  const email = getLicenseEmail();
  const token = getLicenseToken();

  // ⭐ ОБА ID
  const scriptId = ScriptApp.getScriptId(); // ⭐ Для привязки лицензии
  const spreadsheetId = SpreadsheetApp.getActive().getId(); // ⭐ Для работы и названия

  if (DEV_MODE) {
    addLog(`STATUS REQUEST: email=${email}, token=${token ? token.substring(0, 4) : null}`, 'DEBUG');
  }

  const payload = {
    action: 'status',
    email: email,
    token: token,
    scriptId: scriptId, // ⭐ Для привязки
    spreadsheetId: spreadsheetId, // ⭐ Для названия
  };


  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    const resp = UrlFetchApp.fetch(SERVER_URL, options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();

    if (DEV_MODE) {
      addLog(`STATUS RAW: HTTP ${code}`, 'DEBUG');
      addLog(`STATUS CONTENT: ${responseText.substring(0, 200)}...`, 'DEBUG');
    }

    const data = JSON.parse(responseText);

    if (DEV_MODE) {
      addLog(`STATUS RESULT ok=${data.ok ? true : false}`, 'DEBUG');
      if (data && data.message) addLog(`STATUS MESSAGE: ${data.message}`, 'DEBUG');
      if (data && data.quota) addLog(`STATUS QUOTA: ${JSON.stringify(data.quota)}`, 'DEBUG');
      if (data && data.error) addLog(`STATUS ERROR: ${data.error}`, 'ERROR');
    }

    if (code !== 200) {
      return {ok: false, error: data ? data.error : `HTTP ${code}`};
    }
    return data;
  } catch (e) {
    addLog(`STATUS REQUEST FAILED: ${e.message}`, 'ERROR');
    return {ok: false, error: `REQUEST_FAILED: ${e.message}`};
  }
}

/**
 * ✅ ВАЛИДАЦИЯ ЛИЦЕНЗИИ (без привязки)
 * Используется в saveSettingsData для проверки перед сохранением
 *
 * @param {string} email - Email пользователя
 * @param {string} token - Токен лицензии
 * @return {Object} Результат проверки лицензии
 */
function validateLicense(email, token) {
  try {
    Logger.log('=== validateLicense START ===');
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));

    // ⭐ ОБА ID
    const scriptId = ScriptApp.getScriptId(); // ⭐ Для привязки
    const spreadsheetId = SpreadsheetApp.getActive().getId(); // ⭐ Для работы и названия

    const payload = {
      action: 'validate', // ⭐ ВАЛИДАЦИЯ БЕЗ ПРИВЯЗКИ
      email: email,
      token: token,
      scriptId: scriptId, // ⭐ Для привязки
      spreadsheetId: spreadsheetId, // ⭐ Для названия
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    };

    const resp = UrlFetchApp.fetch(SERVER_URL, options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();

    if (DEV_MODE) {
      addLog(`VALIDATE RAW: HTTP ${code}`, 'DEBUG');
      addLog(`VALIDATE CONTENT: ${responseText.substring(0, 200)}...`, 'DEBUG');
    }

    const data = JSON.parse(responseText);

    if (DEV_MODE) {
      addLog(`VALIDATE RESULT ok=${data.ok ? true : false}`, 'DEBUG');
      if (data && data.message) addLog(`VALIDATE MESSAGE: ${data.message}`, 'DEBUG');
      if (data && data.quota) addLog(`VALIDATE QUOTA: ${JSON.stringify(data.quota)}`, 'DEBUG');
      if (data && data.error) addLog(`VALIDATE ERROR: ${data.error}`, 'ERROR');
    }

    if (code !== 200) {
      return {ok: false, error: data ? data.error : `HTTP ${code}`};
    }
    return data;
  } catch (e) {
    addLog(`VALIDATE REQUEST FAILED: ${e.message}`, 'ERROR');
    return {ok: false, error: `REQUEST_FAILED: ${e.message}`};
  }
}

// eslint-disable-next-line no-unused-vars
function checkLicenseStatusUI() {
  try {
    const st = serverStatus();
    if (st.ok) SpreadsheetApp.getUi().alert('Лицензия', '✅ Активна' + (st.until ? (' до ' + st.until) : ''), SpreadsheetApp.getUi().ButtonSet.OK);
    else SpreadsheetApp.getUi().alert('Лицензия', '❌ ' + (st.error || 'Неизвестная ошибка'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Лицензия', 'Ошибка: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ====== UNIFIED SETTINGS UI ======
// eslint-disable-next-line no-unused-vars
function openSettingsUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('SettingsUI')
      .setWidth(600)
      .setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Настройки Table AI');
    addLog('✅ Открыто окно настроек', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка открытия окна настроек: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия настроек: ' + e.message);
  }
}

// eslint-disable-next-line no-unused-vars
function getSettingsData() {
  try {
    Logger.log('=== getSettingsData START ===');

    // Автомиграция перед чтением
    migrateLicenseKeysIfNeeded_();

    const userProps = PropertiesService.getUserProperties();
    const scriptProps = PropertiesService.getScriptProperties();

    // Priority: user key first, then script key
    const userApiKey = userProps.getProperty('GEMINI_API_KEY');
    const scriptApiKey = scriptProps.getProperty('GEMINI_API_KEY');
    const currentApiKey = userApiKey || scriptApiKey || '';
    const keySource = userApiKey ? 'USER' : (scriptApiKey ? 'DEFAULT' : 'NONE');

    // Используем функции-геттеры (они уже содержат миграцию и правильные ключи)
    const email = getLicenseEmail();
    const token = getLicenseToken();

    Logger.log('currentApiKey: ' + (currentApiKey ? 'SET (' + keySource + ', length: ' + currentApiKey.length + ')' : 'NOT SET'));
    Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
    Logger.log('token: ' + (token ? 'SET' : 'NOT SET'));

    return {
      apiKey: currentApiKey,
      email: email,
      token: token,
      keySource: keySource,
    };
  } catch (e) {
    Logger.log('getSettingsData ERROR: ' + e.message);
    addLog('❌ Ошибка чтения настроек: ' + e.message, 'ERROR');
    return {apiKey: '', email: '', token: '', keySource: 'NONE'};
  }
}

// eslint-disable-next-line no-unused-vars
function saveSettingsData(data) {
  try {
    Logger.log('=== saveSettingsData START ===');
    Logger.log('Validation mode: ENABLED');

    const props = PropertiesService.getScriptProperties();
    const logs = []; // ⭐ Массив логов для пользователя

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ШАГ 1: ВАЛИДАЦИЯ ЛИЦЕНЗИИ (если email/token введены)
    // ═══════════════════════════════════════════════════════════════

    const emailToSave = (data.email !== undefined && data.email && String(data.email).trim()) ?
      String(data.email).trim() :
      null;
    const tokenToSave = (data.token !== undefined && data.token && String(data.token).trim()) ?
      String(data.token).trim() :
      null;

    // Если пользователь ввёл email ИЛИ token - проверяем лицензию
    if (emailToSave || tokenToSave) {
      logs.push('🔍 Проверка лицензии на сервере...');
      Logger.log('📡 License validation: email=' + (emailToSave || 'не изменён') + ', token=' + (tokenToSave ? 'введён' : 'не изменён'));

      // ⭐ Используем текущие значения если новые не введены
      const emailForCheck = emailToSave || getLicenseEmail();
      const tokenForCheck = tokenToSave || getLicenseToken();

      if (!emailForCheck || !tokenForCheck) {
        Logger.log('❌ Validation failed: missing email or token');
        logs.push('❌ Для проверки нужны email И token');
        return {
          success: false,
          message: '❌ Ошибка: укажите email И token лицензии',
          logs: logs,
        };
      }

      // ⭐ ПРОВЕРЯЕМ ЛИЦЕНЗИЮ НА СЕРВЕРЕ (ВАЛИДАЦИЯ БЕЗ ПРИВЯЗКИ)
      const licenseStatus = validateLicense(emailForCheck, tokenForCheck);
      Logger.log('📥 License check result: ' + JSON.stringify(licenseStatus));

      if (!licenseStatus || !licenseStatus.ok) {
        const errorMsg = licenseStatus && licenseStatus.error ? licenseStatus.error : 'UNKNOWN_ERROR';
        const userMsg = getLicenseErrorMessage_(errorMsg);

        Logger.log('❌ License validation FAILED: ' + errorMsg);
        logs.push('❌ Проверка лицензии не пройдена');
        logs.push('');
        logs.push('📋 Детали:');
        logs.push('  • Ошибка: ' + userMsg);
        logs.push('  • Email: ' + emailForCheck);
        logs.push('  • Token: ' + (tokenForCheck ? tokenForCheck.substring(0, 4) + '****' : '—'));

        return {
          success: false,
          message: '❌ Лицензия недействительна. Данные НЕ сохранены.\n\n' + userMsg,
          logs: logs,
        };
      }

      // ⭐ ЛИЦЕНЗИЯ ВАЛИДНА - логируем детали
      Logger.log('✅ License validation PASSED');
      logs.push('✅ Лицензия проверена успешно');
      logs.push('');
      logs.push('📋 Информация о лицензии:');
      logs.push('  • Статус: ' + (licenseStatus.message || 'активна'));
      logs.push('  • Действует до: ' + (licenseStatus.until ? new Date(licenseStatus.until).toLocaleDateString('ru-RU') : '—'));

      if (licenseStatus.quota) {
        logs.push('  • Доступно копий: ' + licenseStatus.quota.remaining + ' из ' + licenseStatus.quota.total);
      }
      logs.push('');
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ШАГ 2: СОХРАНЕНИЕ ДАННЫХ (только если валидация прошла)
    // ═══════════════════════════════════════════════════════════════

    logs.push('💾 Сохранение настроек...');
    const updated = [];

    // API KEY
    if (data.apiKey !== undefined && data.apiKey && String(data.apiKey).trim()) {
      props.setProperty('GEMINI_API_KEY', String(data.apiKey).trim());
      updated.push('API ключ');
      Logger.log('✅ GEMINI_API_KEY saved, length: ' + data.apiKey.length);
    }

    // LICENSE EMAIL
    if (emailToSave) {
      props.setProperty('LICENSE_EMAIL', emailToSave);
      updated.push('Email лицензии');
      Logger.log('✅ LICENSE_EMAIL saved: ' + emailToSave);
    }

    // LICENSE TOKEN
    if (tokenToSave) {
      props.setProperty('LICENSE_TOKEN', tokenToSave);
      updated.push('Token лицензии');
      Logger.log('✅ LICENSE_TOKEN saved, length: ' + tokenToSave.length);
    }

    if (updated.length === 0) {
      Logger.log('⚠️ No data to save');
      logs.push('⚠️ Нет данных для сохранения');
      return {
        success: false,
        message: 'Нет данных для сохранения',
        logs: logs,
      };
    }

    logs.push('✅ Сохранено: ' + updated.join(', '));
    Logger.log('✅ Settings saved successfully: ' + updated.join(', '));

    addLog('✅ Настройки сохранены и проверены: ' + updated.join(', '), 'INFO');

    return {
      success: true,
      message: '✅ Настройки сохранены и проверены успешно!\n\n' + logs.join('\n'),
      logs: logs,
    };
  } catch (e) {
    Logger.log('❌ saveSettingsData ERROR: ' + e.message);
    addLog('❌ Ошибка сохранения настроек: ' + e.message, 'ERROR');
    return {
      success: false,
      message: '❌ Ошибка: ' + e.message,
      logs: ['❌ Критическая ошибка: ' + e.message],
    };
  }
}

/**
 * ⭐ Получить понятное сообщение об ошибке лицензии
 */
function getLicenseErrorMessage_(errorCode) {
  const messages = {
    'NO_TOKEN': 'Не указан токен лицензии',
    'NO_EMAIL': 'Не указан email лицензии',
    'NO_SCRIPT_ID': 'Не удалось получить Script ID',
    'NOT_FOUND': 'Лицензия не найдена в базе данных',
    'INACTIVE': 'Лицензия неактивна',
    'EXPIRED': 'Срок действия лицензии истёк',
    'NO_QUOTA_LEFT': 'Исчерпано количество доступных копий',
    'LICENSE_SHEET_NOT_FOUND': 'Таблица лицензий не найдена',
    'LICENSE_SHEET_EMPTY': 'Таблица лицензий пуста',
    'SCRIPT_BINDING_ERROR': 'Ошибка привязки скрипта',
    'LICENSE_ERROR': 'Ошибка проверки лицензии на сервере',
    'REQUEST_FAILED': 'Не удалось связаться с сервером лицензий',
  };

  return messages[errorCode] || errorCode;
}


function serverGM(prompt, maxTokens, temperature) {
  Logger.log('=== serverGM START ===');
  Logger.log('prompt length: ' + (prompt ? prompt.length : 0));
  Logger.log('maxTokens: ' + maxTokens);
  Logger.log('temperature: ' + temperature);

  const email = getLicenseEmail();
  const token = getLicenseToken();
  const apiKey = getGeminiApiKey();

  // ⭐ ОБА ID
  const scriptId = ScriptApp.getScriptId();
  const spreadsheetId = SpreadsheetApp.getActive().getId();

  Logger.log('email: ' + (email ? 'SET' : 'NOT SET'));
  Logger.log('token: ' + (token ? 'SET (length: ' + token.length + ')' : 'NOT SET'));
  Logger.log('apiKey: ' + (apiKey ? 'SET (length: ' + apiKey.length + ')' : 'NOT SET'));
  Logger.log('scriptId: ' + scriptId);
  Logger.log('spreadsheetId: ' + spreadsheetId);

  // DEV логирование
  if (DEV_MODE) {
    addLog(`SERVER REQUEST: action=gm, email=${email}, token=${token ? token.substring(0, 4) + '****' : 'null'}`, 'DEBUG');
    addLog(`PAYLOAD: promptLen=${prompt ? prompt.length : 0}, maxTokens=${maxTokens}`, 'DEBUG');

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
    scriptId: scriptId, // ⭐ Для привязки
    spreadsheetId: spreadsheetId, // ⭐ Для работы
  };

  Logger.log('Request payload: ' + JSON.stringify({
    ...payload,
    prompt: prompt ? '[PROMPT_' + prompt.length + '_CHARS]' : null,
    token: token ? '[TOKEN_' + token.length + '_CHARS]' : null,
    apiKey: apiKey ? '[APIKEY_' + apiKey.length + '_CHARS]' : null,
  }));

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  try {
    Logger.log('Sending POST request to: ' + SERVER_URL);
    addLog(`📡 POST запрос на: ${SERVER_URL}`, 'DEBUG');
    const resp = UrlFetchApp.fetch(SERVER_URL, options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();

    Logger.log('Response code: ' + code);
    Logger.log('Response length: ' + responseText.length);

    // DEV логирование
    if (DEV_MODE) {
      addLog(`RAW RESPONSE: HTTP=${code}, length=${responseText.length}`, 'DEBUG');
      addLog(`RESPONSE START: ${responseText.substring(0, 200)}...`, 'DEBUG');
    }

    const data = JSON.parse(responseText);
    Logger.log('Response parsed successfully, ok=' + (data && data.ok ? 'true' : 'false'));

    // DEV логирование
    if (DEV_MODE) {
      addLog(`PARSED RESPONSE: ok=${data && data.ok ? 'true' : 'false'}`, 'DEBUG');
    }

    if (!data.ok && data.error) {
      Logger.log('Server returned error: ' + data.error);
      addLog(`SERVER ERROR: ${data.error}`, 'ERROR');
    }

    if (data.ok && data.data) {
      Logger.log('Gemini result received, length: ' + data.data.length);
      addLog(`GEMINI RESULT: length=${data.data.length}, start=${data.data.substring(0, 100)}...`, 'DEBUG');
    }

    if (data.quota) {
      Logger.log('Quota info: ' + JSON.stringify(data.quota));
      addLog(`QUOTA INFO: ${JSON.stringify(data.quota)}`, 'DEBUG');
    }

    if (data.message) {
      Logger.log('License message: ' + data.message);
      addLog(`LICENSE MESSAGE: ${data.message}`, 'DEBUG');
    }

    if (code !== 200) {
      Logger.log('Non-200 response code: ' + code);
      return {ok: false, error: (data && data.error) || `HTTP_${code}`};
    }

    Logger.log('serverGM completed successfully');
    return data;
  } catch (e) {
    Logger.log('serverGM ERROR: ' + e.message);
    addLog(`SERVER REQUEST FAILED: ${e.message}`, 'ERROR');
    return {ok: false, error: `REQUEST_FAILED: ${e.message}`};
  }
}

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
      text = r.data || '';
      addLog('✅ Сервер вернул успешный ответ, длина: ' + text.length, 'DEBUG');
    } else {
      serr = (r && r.error) || 'SERVER_ERROR';
      addLog('❌ Сервер вернул ошибку: ' + serr, 'WARN');
    }
  } catch (e) {
    serr = e.message;
    addLog('❌ Исключение при вызове serverGM: ' + serr, 'ERROR');
  }

  if (ok) {
    const processed = processGeminiResponse(text);
    gmCachePut_(key, processed, 21600);
    addLog('✅ GM успешно: ответ обработан и закэширован', 'INFO');
    return processed;
  }

  if (DEV_MODE) {
    addLog('⚠️ DEV fallback → прямой Gemini. Причина: ' + (serr || 'UNKNOWN'), 'WARN');
    try {
      const apiKey = getGeminiApiKey();
      const body = {
        contents: [{parts: [{text: prompt}]}],
        generationConfig: {maxOutputTokens: maxTokens, temperature: temperature},
      };
      const options = {method: 'POST', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true};
      const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
      const code = resp.getResponseCode();
      const data = JSON.parse(resp.getContentText());
      addLog('← GM (direct): HTTP ' + code, 'DEBUG');
      if (code !== 200) {
        const message = data && data.error && data.error.message ? data.error.message : 'Unknown error';
        const msg = 'Error: ' + message;
        gmCachePut_(errKey, msg, 60);
        addLog('❌ Прямой Gemini: ' + message, 'ERROR');
        return msg;
      }
      const candidate = data.candidates && data.candidates[0];
      const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
      const txt = content && content.text ? content.text : '';
      const processed2 = processGeminiResponse(txt);
      gmCachePut_(key, processed2, 21600);
      addLog('✅ Прямой Gemini успешно: ' + txt.length + ' символов', 'DEBUG');
      return processed2;
    } catch (e2) {
      const em = 'Error: ' + e2.message;
      gmCachePut_(errKey, em, 60);
      addLog('❌ Прямой Gemini упал: ' + e2.message, 'ERROR');
      return em;
    }
  }

  const msg = 'Error: ' + (serr || 'LICENSE_OR_SERVER');
  gmCachePut_(errKey, msg, 60);
  addLog('❌ GM финальная ошибка: ' + msg, 'ERROR');
  return msg;
}

// ═══════════════════════════════════════════════════════════════
// ⭐ OTA UPDATES - TRIGGERS
// ═══════════════════════════════════════════════════════════════

/**
 * Установить триггер для фоновой проверки обновлений
 * Вызывается из onOpen(), быстро (<1 сек)
 */
/**
 * Установить триггер для фоновой проверки обновлений
 * Вызывается из onOpen(), быстро (<1 сек)
 */
function installUpdateTrigger_() {
  try {
    Logger.log('DEBUG: installUpdateTrigger_() called'); // ← ОТЛАДКА

    const triggers = ScriptApp.getProjectTriggers();
    Logger.log('DEBUG: Found ' + triggers.length + ' triggers'); // ← ОТЛАДКА

    // ⭐ Измени find() на обычный цикл (более совместимо)
    let exists = false;
    for (let i = 0; i < triggers.length; i++) {
      const handler = triggers[i].getHandlerFunction();
      Logger.log('DEBUG: Trigger ' + i + ': ' + handler); // ← ОТЛАДКА

      if (handler === 'checkForUpdatesBackground_') {
        exists = true;
        break;
      }
    }

    if (exists) {
      addLog('ℹ️ Триггер обновлений уже установлен', 'DEBUG');
      Logger.log('DEBUG: Trigger already exists'); // ← ОТЛАДКА
      return;
    }

    Logger.log('DEBUG: Creating new trigger...'); // ← ОТЛАДКА

    const trigger = ScriptApp.newTrigger('checkForUpdatesBackground_')
      .timeBased()
      .atHour(3)
      .everyDays(1)
      .create();

    Logger.log('DEBUG: Trigger created with ID: ' + trigger.getUniqueId()); // ← ОТЛАДКА

    addLog('✅ Триггер обновлений установлен (каждый день в 3:00)', 'INFO');
  } catch (e) {
    Logger.log('❌ EXCEPTION in installUpdateTrigger_: ' + e.message); // ← ОТЛАДКА
    Logger.log('Stack: ' + e.stack); // ← ОТЛАДКА
    addLog(`❌ Ошибка установки триггера: ${e.message}`, 'ERROR');
  }
}


/**
 * КЛИЕНТ: Фоновая проверка обновлений
 *
 * Что делает:
 * 1. Проверяет версию (спрашивает сервер)
 * 2. Если нужно обновиться - просит сервер
 * 3. ВСЁ! Остальное делает СЕРВЕР!
 *
 * НЕ скачивает файлы!
 * НЕ обновляет себя!
 * НЕ знает про GitHub и приватные ключи!
 */
function checkForUpdatesBackground_() {
  addLog('🌙 Background update check', 'INFO');

  try {
    // ШАГ 1: Клиент спрашивает сервер
    const checkPayload = {
      action: 'ota',
      subaction: 'checkUpdates',
      clientVersion: CLIENT_VERSION,
      email: getLicenseEmail(),
      token: getLicenseToken(),
      scriptId: ScriptApp.getScriptId(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    };

    const resp = UrlFetchApp.fetch(SERVER_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(checkPayload),
      muteHttpExceptions: true,
    });

    const check = JSON.parse(resp.getContentText());

    if (!check.ok || !check.updateAvailable) {
      addLog('✅ Up to date', 'DEBUG');
      return;
    }

    addLog(`🚀 Update available: ${check.serverVersion}`, 'INFO');

    // ШАГ 2: Клиент просит сервер обновить
    const applyPayload = {
      action: 'ota',
      subaction: 'applyUpdates',
      email: getLicenseEmail(),
      token: getLicenseToken(),
      scriptId: ScriptApp.getScriptId(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    };

    const updateResp = UrlFetchApp.fetch(SERVER_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(applyPayload),
      muteHttpExceptions: true,
    });

    const update = JSON.parse(updateResp.getContentText());

    if (update.ok) {
      addLog(`✅ Updated to ${update.version}`, 'INFO');
    } else {
      addLog(`❌ Update failed: ${update.error}`, 'ERROR');
    }

  } catch (e) {
    addLog(`❌ Error: ${e.message}`, 'ERROR');
  }
}



/**
 * КЛИЕНТ: Ручная проверка обновлений (из меню)
 *
 * Простая функция - только спрашивает сервер!
 */
function checkForUpdatesManual_() {
  addLog('🔍 Manual update check', 'INFO');

  try {
    const payload = {
      action: 'ota',
      subaction: 'checkUpdates',
      clientVersion: CLIENT_VERSION,
      email: getLicenseEmail(),
      token: getLicenseToken(),
      scriptId: ScriptApp.getScriptId(),
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
    };

    const resp = UrlFetchApp.fetch(SERVER_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const check = JSON.parse(resp.getContentText());

    if (!check.ok) {
      SpreadsheetApp.getUi().alert('❌ ' + check.error);
      return;
    }

    if (!check.updateAvailable) {
      SpreadsheetApp.getUi().alert(`✅ Up to date: ${check.clientVersion}`);
      return;
    }

    const response = SpreadsheetApp.getUi().alert(
      `Update available: ${check.serverVersion}`,
      `Current: ${check.clientVersion}\n\nUpdate now?`,
      SpreadsheetApp.getUi().ButtonSet.YES_NO,
    );

    if (response === SpreadsheetApp.getUi().Button.YES) {
      checkForUpdatesBackground_();
    }

  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ ' + e.message);
  }
}

    // ===== GEMINI API KEY MANAGEMENT =====

    /**
     * Получить Gemini API ключ (приоритет: клиент → сервер → null)
     *
     * ЛОГИКА:
     * 1. Проверить свой ключ в свойствах клиента
     * 2. Если нет → запросить сервера
     * 3. Если сервер ошибка → вернуть null
     *
     * @return {string|null} API ключ или null
     */
    function getGeminiApiKey() {
      try {
        // ШАГ 1: Проверяем свой ключ в свойствах клиента
        Logger.log('🔑 Getting Gemini API key...');

        const props = PropertiesService.getUserProperties();
        const clientKey = props.getProperty('GEMINI_API_KEY');

        if (clientKey) {
          Logger.log('✅ Using CLIENT Gemini key: ' + clientKey.substring(0, 10) + '...');
          addLog('🔑 Используется личный Gemini API ключ', 'DEBUG');
          return clientKey;
        }

        Logger.log('📌 Client key not found, requesting SERVER default key...');

        // ШАГ 2: Запрашиваем ключ сервера
        const payload = {
          action: 'geminiConfig',
          subaction: 'getDefaultKey',
          email: getLicenseEmail(),
          token: getLicenseToken(),
          scriptId: ScriptApp.getScriptId(),
          spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
        };

        const options = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(payload),
          muteHttpExceptions: true,
        };

        const resp = UrlFetchApp.fetch(SERVER_URL, options);
        const result = JSON.parse(resp.getContentText());

        if (!result.ok) {
          Logger.log('❌ Failed to get server key: ' + result.error);
          addLog('❌ Не удалось получить Gemini ключ: ' + result.error, 'ERROR');
          return null;
        }

        const serverKey = result.apiKey;
        Logger.log('✅ Using SERVER default Gemini key: ' + serverKey.substring(0, 10) + '...');
        addLog('🔑 Используется серверный Gemini API ключ', 'DEBUG');

        return serverKey;

      } catch (e) {
        Logger.log('❌ Error getting Gemini key: ' + e.message);
        addLog('❌ Ошибка получения Gemini ключа: ' + e.message, 'ERROR');
        return null;
      }
    }

    /**
     * Установить личный Gemini API ключ (клиент)
     * @param {string} apiKey - Новый API ключ
     * @return {boolean} Успех операции
     */
    function setClientGeminiKey(apiKey) {
      try {
        if (!apiKey) {
          Logger.log('❌ Cannot set empty API key');
          return false;
        }

        if (apiKey.length < 20) {
          Logger.log('❌ API key too short (min 20 chars)');
          return false;
        }

        const props = PropertiesService.getUserProperties();
        props.setProperty('GEMINI_API_KEY', apiKey);

        Logger.log('✅ Client Gemini key set: ' + apiKey.substring(0, 10) + '...');
        addLog('✅ Личный Gemini API ключ установлен', 'INFO');

        return true;
      } catch (e) {
        Logger.log('❌ Error setting client Gemini key: ' + e.message);
        addLog('❌ Ошибка установки ключа: ' + e.message, 'ERROR');
        return false;
      }
    }

    /**
     * Удалить личный Gemini API ключ (вернуться на серверный)
     */
    function removeClientGeminiKey() {
      try {
        const props = PropertiesService.getUserProperties();
        props.deleteProperty('GEMINI_API_KEY');

        Logger.log('✅ Client Gemini key removed, will use server default');
        addLog('✅ Личный ключ удалён, будет использован серверный', 'INFO');

        return true;
      } catch (e) {
        Logger.log('❌ Error removing client Gemini key: ' + e.message);
        return false;
      }
    }

    /**
     * Получить информацию о текущем ключе (для отладки)
     * @return {Object} Информация о ключе
     */
    function getGeminiKeyInfo() {
      const props = PropertiesService.getUserProperties();
      const clientKey = props.getProperty('GEMINI_API_KEY');

      return {
        hasClientKey: !!clientKey,
        clientKeyPreview: clientKey ? clientKey.substring(0, 10) + '...' : null,
        source: clientKey ? 'CLIENT (personal)' : 'SERVER (default)',
      };
    }

    /**
     * Отладка Gemini ключей
     */
    function debugGeminiKeys() {
      Logger.log('=== DEBUG GEMINI KEYS ===');

      try {
        // 1. Информация о ключах
        const info = getGeminiKeyInfo();
        Logger.log('Client key configured: ' + info.hasClientKey);
        Logger.log('Current key preview: ' + (info.clientKeyPreview || 'using server default'));
        Logger.log('Source: ' + info.source);

        // 2. Попытка получить ключ
        Logger.log('Attempting to get Gemini key...');
        const apiKey = getGeminiApiKey();
        Logger.log('API Key obtained: ' + (apiKey ? '✅ YES' : '❌ NO'));

        if (apiKey) {
          Logger.log('Key preview: ' + apiKey.substring(0, 10) + '...');
        }

      } catch (e) {
        Logger.log('❌ Error: ' + e.message);
      }
    }

    /**
     * Отладочная функция для проверки полного OTA-потока
     */
    // eslint-disable-next-line no-unused-vars
    function debugOTAFlow() {
      Logger.log('=== DEBUG OTA FLOW ===');

      Logger.log('1️⃣ Calling serverStatus()...');
      const status = serverStatus();
      Logger.log('   Result: ' + JSON.stringify(status));
      Logger.log('   scriptId: ' + ((status && status.scriptId) ? status.scriptId : 'UNDEFINED'));

      Logger.log('2️⃣ CLIENT_VERSION: ' + (typeof CLIENT_VERSION !== 'undefined' ? CLIENT_VERSION : 'UNDEFINED'));
      Logger.log('3️⃣ SERVER_URL: ' + SERVER_URL);
      Logger.log('4️⃣ ScriptApp.getScriptId(): ' + ScriptApp.getScriptId());
      Logger.log('5️⃣ getLicenseEmail(): ' + getLicenseEmail());
      const token = getLicenseToken();
      Logger.log('6️⃣ getLicenseToken(): ' + (token ? 'SET' : 'NOT SET'));
    }
