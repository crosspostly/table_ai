// ====== URL-ы и константы ======
const VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
// Фиксированный сервер (веб‑приложение) для лицензий/логов
const SERVER_URL = 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

// ====== КОНСТАНТЫ ДЛЯ АВТОМАТИЗАЦИИ (legacy-триггеры, оставлены для совместимости) ======
const AUTO_PROCESSING_DELAY = 20000; // 20 сек
const LONG_PROCESSING_DELAY = 45000; // 45 сек
const COMPLETION_PHRASE = 'Отчёт готов';
const PROCESSING_STATUS_KEY = 'AUTO_PROCESSING_STATUS';
const LOGS_CACHE_KEY = 'SYSTEM_LOGS';
const MAX_LOGS = 300;
const LOGS_TTL = 86400; // 24ч
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_DELAY_INCREMENT = 10000;

// ====== DEV ФЛАГ ======
const DEV_MODE = true; // DEV: показывать DEV-меню/логи

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

// ====== VK Parser URL: жёстко используем константу VK_PARSER_URL (без чтения Параметры!B5) ======
function getVkParserUrl_() {
  try {
    return String(VK_PARSER_URL).replace(/\/$/, '');
  } catch (e) {
    addLog('⚠️ getVkParserUrl_: ' + e.message, 'WARN'); return String(VK_PARSER_URL||'').replace(/\/$/, '');
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
function showLogsDialog() {
  try {
    SpreadsheetApp.getUi().alert('📝 Логи (последние 100)', getLogs(100), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка показа логов: ' + e.message);
  }
}
function exportLogsToSheet() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('Логи') || ss.insertSheet('Логи');
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) {
      addLog('❌ Нет логов для экспорта', 'WARN');
      SpreadsheetApp.getUi().alert('Логи отсутствуют.');
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
    SpreadsheetApp.getUi().alert('Готово: логи экспортированы в "Логи".');
  } catch (e) {
    addLog('❌ Ошибка экспорта логов: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка экспорта логов: ' + e.message);
  }
}
function clearLogs() {
  try {
    CacheService.getScriptCache().remove(LOGS_CACHE_KEY);
    addLog('✅ Логи очищены', 'INFO');
    SpreadsheetApp.getUi().alert('Логи очищены.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

// ====== ТРИГГЕРЫ (просмотр/очистка) ======
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
function isCompletionReady(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  const phrase = getCompletionPhrase();
  const rdy = phrase ? clean.startsWith(phrase) : false;
  addLog(`🔍 Проверка готовности: "${clean.slice(0, 30)}..." против "${phrase}" → ${rdy ? 'ГОТОВО' : 'НЕ ГОТОВО'}`, 'DEBUG');
  return rdy;
}

// ====== Prompt_box: фикс чтения формулы (если используем legacy-триггеры) ======
function getPromptFormula(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActive();
    const promptSheet = ss.getSheetByName('Prompt_box');
    if (!promptSheet) {
      addLog('❌ Лист "Prompt_box" не найден', 'ERROR'); return null;
    }
    const rng = promptSheet.getRange(rowIndex, 6); // F
    const formula = rng.getFormula(); // ВАЖНО: формула, а не значение
    if (!formula || !formula.trim()) {
      addLog(`ℹ️ Формула в Prompt_box!F${rowIndex} пуста`, 'INFO'); return null;
    }
    addLog(`📥 Формула из Prompt_box!F${rowIndex}: ${formula.slice(0, 80)}...`, 'DEBUG');
    return formula;
  } catch (e) {
    addLog('❌ Ошибка получения формулы из F' + rowIndex + ': ' + e.message, 'ERROR');
    return null;
  }
}
function setFormulaToCell(row, col, formula) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('Распаковка');
    if (!sheet) {
      addLog('❌ Лист "Распаковка" не найден', 'ERROR'); return false;
    }
    const cell = sheet.getRange(row, col);
    cell.setFormula(formula);
    addLog('✅ Формула установлена в ' + cell.getA1Notation() + ': ' + formula.slice(0, 80) + '...', 'INFO');
    return true;
  } catch (e) {
    addLog('❌ Ошибка установки формулы в (' + row + ',' + col + '): ' + e.message, 'ERROR');
    return false;
  }
}
function getCellValue(sheetName, row, col) {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;
    const value = sheet.getRange(row, col).getValue();
    if (value && typeof value === 'string' && col > 1) {
      const processed = processGeminiResponse(value);
      if (processed !== value) {
        sheet.getRange(row, col).setValue(processed);
        addLog('🔄 Markdown преобразован в ' + sheet.getRange(row, col).getA1Notation(), 'INFO');
        return processed;
      }
    }
    return value;
  } catch (e) {
    addLog('❌ Ошибка чтения ячейки ' + sheetName + '(' + row + ',' + col + '): ' + e.message, 'ERROR');
    return null;
  }
}

// ====== Legacy-цепочка на триггерах (сохранено, меню не подключаем) ======
function saveProcessingStatus(row, currentStep, retryCount = 0) {
  try {
    const cache = CacheService.getScriptCache();
    const status = {row: row, currentStep: currentStep, retryCount: retryCount, timestamp: new Date().getTime()};
    cache.put(PROCESSING_STATUS_KEY, JSON.stringify(status), 21600);
    addLog('💾 Статус сохранен: строка ' + row + ', шаг ' + currentStep + ', попытка ' + (retryCount + 1), 'DEBUG');
  } catch (e) {
    addLog('❌ Ошибка сохранения статуса: ' + e.message, 'ERROR');
  }
}
function getProcessingStatus() {
  try {
    const cache = CacheService.getScriptCache();
    const statusStr = cache.get(PROCESSING_STATUS_KEY);
    return statusStr ? JSON.parse(statusStr) : null;
  } catch (e) {
    addLog('❌ Ошибка получения статуса: ' + e.message, 'ERROR'); return null;
  }
}
function clearProcessingStatus() {
  try {
    CacheService.getScriptCache().remove(PROCESSING_STATUS_KEY); addLog('🗑️ Статус обработки очищен', 'DEBUG');
  } catch (e) {
    addLog('❌ Ошибка очистки статуса: ' + e.message, 'ERROR');
  }
}
function startAutoProcessingChain(row) {
  addLog('🚀 Попытка запуска цепочки (legacy) для строки ' + row, 'INFO');
  const activeStatus = getProcessingStatus();
  if (activeStatus) {
    addLog('🚫 Цепочка уже активна: строка ' + activeStatus.row + ' (шаг ' + activeStatus.currentStep + ')', 'WARN'); notifyUser('Дождитесь завершения обработки строки ' + activeStatus.row); return false;
  }
  const triggerValue = getCellValue('Распаковка', row, 1);
  if (!triggerValue) {
    addLog('❌ Нет данных в A' + row + ' для запуска цепочки', 'WARN'); return false;
  }
  saveProcessingStatus(row, 1);
  processNextStep();
  return true;
}
function processNextStep() {
  const status = getProcessingStatus();
  if (!status) {
    addLog('❌ Нет активной цепочки', 'WARN'); return;
  }
  const row = status.row; const step = status.currentStep;
  addLog('📋 Обработка шага ' + step + ' для строки ' + row, 'INFO');
  const promptRow = step + 1; // F2, F3, ...
  const formula = getPromptFormula(promptRow);
  if (!formula) {
    addLog('✅ Нет формулы в F' + promptRow + ', цепочка завершена', 'INFO'); clearProcessingStatus(); return;
  }
  const targetCol = step + 1; // B=2, C=3...
  if (!setFormulaToCell(row, targetCol, formula)) {
    addLog('❌ Не удалось установить формулу, цепочка прервана', 'ERROR'); clearProcessingStatus(); return;
  }
  saveProcessingStatus(row, step);
  try {
    ScriptApp.newTrigger('checkStepCompletion').timeBased().after(AUTO_PROCESSING_DELAY).create(); addLog('⏰ Проверка через ' + (AUTO_PROCESSING_DELAY/1000) + ' сек', 'DEBUG');
  } catch (e) {
    addLog('❌ Ошибка создания триггера: ' + e.message, 'ERROR');
  }
}
function checkStepCompletion() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkStepCompletion') ScriptApp.deleteTrigger(t);
  });
  const status = getProcessingStatus();
  if (!status) {
    addLog('❌ Нет активной цепочки при проверке', 'WARN'); return;
  }
  const row = status.row; const step = status.currentStep; const retryCount = status.retryCount || 0;
  const targetCol = step + 1;
  const result = getCellValue('Распаковка', row, targetCol);
  if (!result) {
    addLog('⏳ Шаг ' + step + ' (попытка ' + (retryCount+1) + '): результата нет', 'INFO'); return handleRetryOrFallback(row, step, retryCount, 'Результат еще не готов');
  }
  if (!isCompletionReady(result.toString())) {
    addLog('⏳ Шаг ' + step + ' (попытка ' + (retryCount+1) + '): нет фразы готовности', 'INFO'); return handleRetryOrFallback(row, step, retryCount, 'Нет фразы завершения');
  }
  addLog('✅ Шаг ' + step + ' завершен', 'INFO');
  saveProcessingStatus(row, step + 1, 0);
  processNextStep();
}
function handleRetryOrFallback(row, step, retryCount, reason) {
  retryCount++;
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    addLog('🚨 Превышен лимит попыток на шаге ' + step + ', причина: ' + reason, 'WARN');
    const strategy = decideFallbackStrategy(row, step, reason);
    switch (strategy) {
    case 'SKIP_STEP':
    case 'FORCE_CONTINUE':
      saveProcessingStatus(row, step + 1, 0); processNextStep(); break;
    case 'STOP_CHAIN':
    default:
      clearProcessingStatus(); notifyUser('Автоцепочка остановлена после ' + MAX_RETRY_ATTEMPTS + ' неудачных попыток на шаге ' + step + '\nПричина: ' + reason); break;
    }
    return;
  }
  const nextDelay = AUTO_PROCESSING_DELAY + (retryCount * RETRY_DELAY_INCREMENT);
  saveProcessingStatus(row, step, retryCount);
  addLog('🔄 Повторная проверка #' + (retryCount + 1) + ' через ' + (nextDelay/1000) + ' сек', 'INFO');
  try {
    ScriptApp.newTrigger('checkStepCompletion').timeBased().after(nextDelay).create();
  } catch (e) {
    addLog('❌ Ошибка создания триггера для retry: ' + e.message, 'ERROR');
  }
}
function decideFallbackStrategy(row, step, reason) {
  if (reason === 'Результат еще не готов') return 'STOP_CHAIN';
  if (reason === 'Нет фразы завершения') return 'FORCE_CONTINUE';
  return 'STOP_CHAIN';
}
function notifyUser(message) {
  try {
    SpreadsheetApp.getUi().alert('Автоцепочка: Внимание!', message, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    addLog('❌ Ошибка уведомления: ' + e.message, 'ERROR');
  }
}
function stopAutoProcessingChain() {
  clearProcessingStatus();
  const triggers = ScriptApp.getProjectTriggers();
  let deleted = 0; triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'checkStepCompletion') {
      ScriptApp.deleteTrigger(t); deleted++;
    }
  });
  addLog('🛑 Автоцепочка остановлена, удалено триггеров: ' + deleted, 'INFO');
}
function getChainStatus() {
  const status = getProcessingStatus();
  if (!status) return 'Нет активной цепочки обработки';
  const elapsed = Math.floor((new Date().getTime() - status.timestamp) / 1000);
  return 'Активна цепочка для строки ' + status.row + ', шаг ' + status.currentStep + ' (прошло ' + elapsed + ' сек)';
}

// ====== НОВАЯ БЕЗОПАСНАЯ ЦЕПОЧКА ТОЛЬКО ДЛЯ A3 (B3..G3) через GM_IF ======
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
    if (!condVal) return '';
    if (Array.isArray(prompt)) prompt = prompt[0][0];
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return '';
    if (maxTokens == null) maxTokens = 25000;
    if (temperature == null) temperature = 0.7;
    return GM(prompt, maxTokens, temperature);
  } catch (e) {
    addLog('❌ GM_IF ошибка: ' + e.message, 'ERROR');
    return 'Error: ' + e.message;
  }
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
    SpreadsheetApp.getUi().alert('Лист "Prompt_box" не найден'); return;
  }
  if (!pack) {
    SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return;
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
    SpreadsheetApp.getUi().alert('Нет целевых ячеек в Prompt_box!B, ничего не сделано.'); return;
  }

  const phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  const phraseEscaped = phrase.replace(/"/g, '""');

  for (let i = 0; i < mappings.length; i++) {
    const m = mappings[i];
    var cond;
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
    SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return;
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
    var formula;
    if (col === 2) {
      formula = '=GM_IF($A3<>"", ' + promptRef + ', 25000, 0.7)';
    } else {
      const prevColLetter = columnToLetter(col - 1);
      formula = '=GM_IF(LEFT(' + prevColLetter + '3, LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", ' + promptRef + ', 25000, 0.7)';
    }
    target.setFormula(formula);
    addLog('📝 Формула ' + target.getA1Notation() + ' установлена', 'DEBUG');
  }
  SpreadsheetApp.getUi().alert('✅ Готово: формулы B3..G3 проставлены.\nЗаполните A3 — шаги пойдут по очереди.');
}
function clearChainForA3() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('Распаковка');
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return;
  }
  sheet.getRange(3, 2, 1, 6).clearContent(); // B3..G3
  SpreadsheetApp.getUi().alert('🧹 Очищено: B3..G3');
}

// ====== VK PARSER + фильтрация ======
function importVkPosts() {
  addLog('→ Импорт VK-постов с фильтрацией', 'INFO');
  const ss = SpreadsheetApp.getActive();
  const params = ss.getSheetByName('Параметры');
  if (!params) {
    addLog('❌ Нет листа "Параметры"', 'ERROR'); SpreadsheetApp.getUi().alert('Лист "Параметры" не найден!'); return;
  }
  const owner = params.getRange('B1').getValue();
  const count = params.getRange('B2').getValue();
  if (!owner || !count) {
    addLog('❌ Не указаны owner или count', 'ERROR'); SpreadsheetApp.getUi().alert('Введите owner и count на листе "Параметры"'); return;
  }
  const url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);
  try {
    const resp = UrlFetchApp.fetch(url);
    var arr = JSON.parse(resp.getContentText());
  } catch (e) {
    addLog('❌ Ошибка запроса VK: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка запроса VK Parser: ' + e);
    return;
  }
  if (!Array.isArray(arr)) {
    addLog('❌ Неверный массив от VK', 'ERROR'); SpreadsheetApp.getUi().alert('Неверный формат данных от VK Parser'); return;
  }

  const headers = [
    'Дата', 'Ссылка на пост', 'Текст поста', 'Номер поста',
    'Стоп-слова', 'Отфильтрованные посты', 'Новый номер',
    'Позитивные слова', 'Посты с позитивными словами', 'Новый номер (позитивные)',
  ];
  const out = [headers];
  arr.forEach(function(o, i) {
    const number = o.number !== undefined ? o.number : i + 1;
    out.push([o.date, o.link, o.text, number, '', '', '', '', '', '']);
  });

  const sheet = ss.getSheetByName('посты');
  if (!sheet) {
    addLog('❌ Лист "посты" не найден!', 'ERROR'); SpreadsheetApp.getUi().alert('Создайте лист "посты".'); return;
  }

  sheet.clear();
  sheet.getRange(1, 1, out.length, headers.length).setValues(out);
  applyUniformFormatting(sheet);
  createStopWordsFormulas(sheet, out.length);
  addLog('✅ Импортировано ' + (out.length-1) + ' постов', 'INFO');
  SpreadsheetApp.getUi().alert('Импорт завершён: ' + (out.length - 1) + ' постов. Формулы фильтрации добавлены.');
}
function createStopWordsFormulas(sheet, totalRows) {
  try {
    addLog('→ Создание формул фильтрации', 'INFO');
    const stopWordsRange = '$E$2:$E$100';
    for (var row = 2; row <= totalRows; row++) {
      const formulaF = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + ')))*(' + stopWordsRange + '<>"")) > 0, "", C' + row + ')';
      sheet.getRange(row, 6).setFormula(formulaF); // F
      const formulaG = '=IF(F' + row + '<>"", COUNTA(F$2:F' + row + '), "")';
      sheet.getRange(row, 7).setFormula(formulaG); // G
    }
    const positiveWordsRange = '$H$2:$H$100';
    for (var row = 2; row <= totalRows; row++) {
      const formulaI = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + ')))*(' + positiveWordsRange + '<>"")) > 0, C' + row + ', "")';
      sheet.getRange(row, 9).setFormula(formulaI); // I
      const formulaJ = '=IF(I' + row + '<>"", COUNTA(I$2:I' + row + '), "")';
      sheet.getRange(row, 10).setFormula(formulaJ); // J
    }
    sheet.getRange(1, 5, 1, 3).setFontWeight('bold').setBackground('#FFF2CC');
    sheet.getRange(1, 8, 1, 3).setFontWeight('bold').setBackground('#D9EAD3');
    sheet.autoResizeColumns(5, 6);
    addLog('✅ Формулы фильтрации созданы', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка создания формул: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка создания формул: ' + e.message);
  }
}
function testStopWordsFilter() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('посты');
    if (!sheet) {
      SpreadsheetApp.getUi().alert('Лист "посты" не найден'); return;
    }
    sheet.getRange(2, 5).setValue('консультация');
    sheet.getRange(3, 5).setValue('психолог');
    SpreadsheetApp.flush();
    const filtered2 = sheet.getRange(2, 6).getValue();
    const filtered3 = sheet.getRange(3, 6).getValue();
    const number2 = sheet.getRange(2, 7).getValue();
    const number3 = sheet.getRange(3, 7).getValue();
    const message = 'Тест фильтрации:\n\n' +
      'Строка 2: ' + (filtered2 ? 'показывается' : 'скрыто') + ', номер: ' + (number2 || '—') + '\n' +
      'Строка 3: ' + (filtered3 ? 'показывается' : 'скрыто') + ', номер: ' + (number3 || '—');
    SpreadsheetApp.getUi().alert('Результаты теста', message, SpreadsheetApp.getUi().ButtonSet.OK);
    addLog('✅ Тест фильтрации выполнен', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка теста фильтрации: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка теста: ' + e.message);
  }
}

// ====== GEMINI (с авто Markdown-преобразованием) ======
function getGeminiApiKey() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('API-ключ Gemini не установлен. Меню: 🤖 Table AI → Установить API ключ Gemini');
  return key;
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
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  addLog('→ GM: prompt=' + (prompt ? prompt.slice(0, 60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');

  const apiKey = getGeminiApiKey();
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

  try {
    const response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
    const responseData = JSON.parse(response.getContentText());
    addLog('← GM: HTTP ' + response.getResponseCode(), 'DEBUG');
    if (response.getResponseCode() !== 200) {
      const message = responseData.error && responseData.error.message ? responseData.error.message : 'Unknown error';
      addLog('❌ GM API ошибка: ' + message, 'ERROR');
      return 'Error: ' + message;
    }
    const candidate = responseData.candidates && responseData.candidates[0];
    const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    const result = content && content.text ? content.text : 'Ошибка обработки данных';
    const processedResult = processGeminiResponse(result);
    addLog('✅ GM: результат, длина=' + result.length + (processedResult !== result ? ', преобразован из Markdown' : ''), 'INFO');
    return processedResult;
  } catch (error) {
    addLog('❌ GM исключение: ' + error.message, 'ERROR');
    return 'Error: ' + error.message;
  }
}
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
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Table AI')
    .addItem('▶️ Подготовить формулы (умный режим)', 'prepareChainSmart')
    .addItem('🔁 Обновить текущую ячейку (GM)', 'refreshCurrentGMCell')
    .addSeparator()
    .addItem('🧹 Очистить B3..G3', 'clearChainForA3')
    .addSeparator()
    .addSubMenu(ui.createMenu('🎯 AI Конструктор')
      .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
      .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
      .addSeparator()
      .addItem('🗂️ Управление шаблонами', 'openTemplatesUI')
      .addItem('❓ Справка', 'showCollectConfigHelp'),
    )
    .addSeparator()
    .addItem('📥 Импорт VK постов', 'importVkPosts')
    .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ Настройки')
      .addItem('🔑 Установить API ключ Gemini', 'initGeminiKey')
      .addSeparator()
      .addItem('🔐 Ввести лицензию', 'setLicenseCredentialsUI')
      .addItem('🔐 Проверить статус лицензии', 'checkLicenseStatusUI'),
    )
    .addToUi();

  if (DEV_MODE) {
    ui.createMenu('🧰 DEV')
      .addItem('📝 Показать логи', 'showLogsDialog')
      .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
      .addItem('🗑 Очистить логи', 'clearLogs')
      .addToUi();
  }

  // Убрали устаревшую «горячую кнопку» (setupOcrHotButton) по просьбе пользователя
}

// Быстрое обновление активной GM-ячейки: пересоздаём формулу, чтобы заново вызвать Gemini
function refreshCurrentGMCell() {
  try {
    const ss = SpreadsheetApp.getActive();
    const range = ss.getActiveRange();
    if (!range) {
      SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return;
    }
    const cell = range.getCell(1, 1);
    const sheet = cell.getSheet();
    if (sheet.getName() !== 'Распаковка') {
      SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return;
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
      SpreadsheetApp.getUi().alert('Нечего обновлять: в ячейке нет GM-формулы и нет соответствия в Prompt_box!B'); return;
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

// ====== Тест Markdown ======
function testMarkdownConversion() {
  const md = '# Отчёт готов\n\n**Список**:\n- один\n- два\n\n`код`\n\n[ссылка](https://example.com)\n';
  const converted = convertMarkdownToReadableText(md);
  SpreadsheetApp.getUi().alert('Преобразование Markdown', 'Исходный:\n' + md + '\n\nПреобразованный:\n' + converted, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ====== onEdit: авто-очистка Markdown для строки 3 (B..G) ======
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
    const expectedB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 12500, 0.7)';
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
    const expB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 12500, 0.7)';
    const expC3 = '=GM_IF(LEFT(B3, LEN("' + phraseEsc2 + '"))="' + phraseEsc2 + '", Prompt_box!$F$3, 12500, 0.7)';
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
    SpreadsheetApp.getUi().alert('✅ DEV-тесты пройдены');
  }
}

// ===== LICENSE & SERVER PROXY (patch) =====
function getLicenseEmail() {
  return PropertiesService.getScriptProperties().getProperty('LICENSE_EMAIL') || '';
}
function getLicenseToken() {
  return PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN') || '';
}
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
function serverStatus_() {
  const email = getLicenseEmail();
  const token = getLicenseToken();
  const payload = {action: 'status', email: email, token: token};
  const options = {method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true};
  const resp = UrlFetchApp.fetch(SERVER_URL, options);
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());
  if (code !== 200) return {ok: false, error: (data && data.error) || ('HTTP_' + code)};
  return data;
}
function checkLicenseStatusUI() {
  try {
    const st = serverStatus_();
    if (st.ok) SpreadsheetApp.getUi().alert('Лицензия', '✅ Активна' + (st.until ? (' до ' + st.until) : ''), SpreadsheetApp.getUi().ButtonSet.OK);
    else SpreadsheetApp.getUi().alert('Лицензия', '❌ ' + (st.error || 'Неизвестная ошибка'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Лицензия', 'Ошибка: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
function serverGM_(prompt, maxTokens, temperature) {
  const email = getLicenseEmail();
  const token = getLicenseToken();
  const apiKey = getGeminiApiKey();
  const payload = {action: 'gm', email: email, token: token, apiKey: apiKey, prompt: prompt, maxTokens: maxTokens, temperature: temperature};
  const options = {method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true};
  const resp = UrlFetchApp.fetch(SERVER_URL, options);
  const code = resp.getResponseCode();
  const data = JSON.parse(resp.getContentText());
  if (code !== 200) return {ok: false, error: (data && data.error) || ('HTTP_' + code)};
  return data;
}
function GM(prompt, maxTokens, temperature) {
  // Лицензия обязательна всегда: и в PROD, и в DEV. Если пустой email/token — блокируем.
  try {
    const _email = getLicenseEmail();
    const _token = getLicenseToken();
    if (!_email || !_token) {
      addLog('🚫 Отказ: лицензия не задана (email/token пустые)', 'WARN');
      return 'Error: LICENSE_REQUIRED';
    }
    const st0 = serverStatus_();
    if (!st0 || !st0.ok) {
      addLog('🚫 Отказ: лицензия неактивна или сервер недоступен', 'WARN');
      return 'Error: LICENSE_OR_SERVER';
    }
  } catch (eLic) {
    addLog('🚫 Отказ: ошибка проверки лицензии: ' + eLic.message, 'WARN');
    return 'Error: LICENSE_CHECK_FAILED';
  }

  if (maxTokens == null) maxTokens = 25000;
  if (temperature == null) temperature = 0.7;
  addLog('→ GM (proxy): prompt=' + (prompt ? prompt.slice(0, 60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');
  const key = gmCacheKey_(prompt, maxTokens, temperature);
  const cached = gmCacheGet_(key); if (cached) {
    addLog('⚡ GM cache-hit', 'DEBUG'); return cached;
  }
  const errKey = 'gm_err:' + key;
  const lastErr = gmCacheGet_(errKey); if (lastErr) {
    addLog('⏳ GM last-error cached, skip call', 'DEBUG'); return lastErr;
  }
  let ok = false; let text = ''; let serr = null;
  try {
    const r = serverGM_(prompt, maxTokens, temperature);
    if (r && r.ok) {
      ok = true; text = r.data || '';
    } else {
      serr = (r && r.error) || 'SERVER_ERROR';
    }
  } catch (e) {
    serr = e.message;
  }
  if (ok) {
    const processed = processGeminiResponse(text);
    gmCachePut_(key, processed, 21600);
    return processed;
  }
  if (DEV_MODE) {
    addLog('⚠️ DEV fallback → прямой Gemini. Причина: ' + (serr || 'UNKNOWN'), 'WARN');
    try {
      const apiKey = getGeminiApiKey();
      const body = {contents: [{parts: [{text: prompt}]}], generationConfig: {maxOutputTokens: maxTokens, temperature: temperature}};
      const options = {method: 'POST', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true};
      const resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
      const code = resp.getResponseCode();
      const data = JSON.parse(resp.getContentText());
      addLog('← GM (direct): HTTP ' + code, 'DEBUG');
      if (code !== 200) {
        const message = data && data.error && data.error.message ? data.error.message : 'Unknown error';
        var msg = 'Error: ' + message;
        gmCachePut_(errKey, msg, 60);
        return msg;
      }
      const candidate = data.candidates && data.candidates[0];
      const content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
      const txt = content && content.text ? content.text : '';
      const processed2 = processGeminiResponse(txt);
      gmCachePut_(key, processed2, 21600);
      return processed2;
    } catch (e2) {
      const em = 'Error: ' + e2.message;
      gmCachePut_(errKey, em, 60);
      return em;
    }
  }
  var msg = 'Error: ' + (serr || 'LICENSE_OR_SERVER');
  gmCachePut_(errKey, msg, 60);
  return msg;
}
