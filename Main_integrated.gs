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
    var cache = CacheService.getScriptCache();
    var logs = cache.get(LOGS_CACHE_KEY);
    logs = logs ? JSON.parse(logs) : [];
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    logs.push({ timestamp: ts, level: level, message: msg });
    if (logs.length > MAX_LOGS) logs.shift();
    cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), LOGS_TTL);
    console.log(`[${ts}] ${level}: ${msg}`);
  } catch (e) {
    console.error('Ошибка записи лога:', e.message);
  }
}

// ====== VK Parser URL: жёстко используем константу VK_PARSER_URL (без чтения Параметры!B5) ======
function getVkParserUrl_() {
  try { return String(VK_PARSER_URL).replace(/\/$/, ''); }
  catch (e) { addLog('⚠️ getVkParserUrl_: ' + e.message, 'WARN'); return String(VK_PARSER_URL||'').replace(/\/$/, ''); }
}
function getLogs(limit = 100) {
  try {
    var cache = CacheService.getScriptCache();
    var logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) return 'Логи пусты.';
    var arr = JSON.parse(logs);
    var recent = arr.slice(-limit);
    return recent.map(x => `[${x.timestamp}] ${x.level}: ${x.message}`).join('\n');
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
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName('Логи') || ss.insertSheet('Логи');
    var cache = CacheService.getScriptCache();
    var logs = cache.get(LOGS_CACHE_KEY);
    if (!logs) {
      addLog('❌ Нет логов для экспорта', 'WARN');
      SpreadsheetApp.getUi().alert('Логи отсутствуют.');
      return;
    }
    var logEntries = JSON.parse(logs);
    var data = [['Время', 'Уровень', 'Сообщение']];
    logEntries.forEach(e => data.push([e.timestamp, e.level, e.message]));
    sheet.clear();
    sheet.getRange(1, 1, data.length, 3).setValues(data);
    sheet.getRange(1,1,1,3).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.autoResizeColumns(1,3);
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
    var triggers = ScriptApp.getProjectTriggers();
    var deleted = 0, kept = 0;
    triggers.forEach(function(trigger) {
      var fn = trigger.getHandlerFunction();
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
    var summary = '✅ Очистка: удалено ' + deleted + ', оставлено ' + kept;
    addLog(summary, 'INFO');
    SpreadsheetApp.getUi().alert(summary);
    return summary;
  } catch (e) {
    var msg = '❌ Ошибка очистки триггеров: ' + e.message;
    addLog(msg, 'ERROR');
    SpreadsheetApp.getUi().alert(msg);
    return msg;
  }
}
function showActiveTriggersDialog() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    if (triggers.length === 0) {
      SpreadsheetApp.getUi().alert('Активные триггеры', 'Нет активных триггеров', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    var list = triggers.map((t,i) => (i+1)+'. '+t.getHandlerFunction()+' ('+t.getEventType()+')').join('\n');
    SpreadsheetApp.getUi().alert('Активные триггеры', 'Всего: '+triggers.length+'\n\n'+list, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка показа триггеров: ' + e.message);
  }
}

// ====== MARKDOWN → читабельный текст ======
function convertMarkdownToReadableText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;
  var text = markdownText;
  try {
    text = text.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, (_m, code) => '\n' + String(code || '').trim() + '\n');
    text = text.replace(/`([^`]+)`/g, '$1');
    text = text.replace(/\*\*([^*]+)\*\*/g, (_m, c) => String(c || '').toUpperCase());
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/^#{1,6}\s+(.+)$/gm, (_m, h) => '\n' + String(h || '').toUpperCase() + ':\n');
    var lines = text.split('\n');
    var inList = false, listCounter = 0;
    lines = lines.map(line => {
      var t = line.trim();
      if (/^[-*+]\s+/.test(t)) {
        if (!inList) { listCounter = 0; inList = true; }
        listCounter++;
        return line.replace(/^(\s*)[-*+]\s+/, '$1' + listCounter + '. ');
      } else if (t === '') { inList = false; return line; }
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
  var patterns = [
    /\*\*[^*]+\*\*/, /\*[^*]+\*/, /^#{1,6}\s+/m,
    /^[-*+]\s+/m, /\[.+\]\(.+\)/, /```[\s\S]*?```/, /`[^`]+`/
  ];
  return patterns.some(p => p.test(text));
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
    var ss = SpreadsheetApp.getActive();
    var params = ss.getSheetByName('Параметры');
    if (params) {
      try {
        var v = params.getRange('B10').getDisplayValue();
        if (v && String(v).trim()) return String(v).trim();
      } catch (e) {}
    }
    var prop = PropertiesService.getScriptProperties().getProperty('COMPLETION_PHRASE');
    if (prop && String(prop).trim()) return String(prop).trim();
  } catch (e) {
    addLog('⚠️ Ошибка чтения фразы готовности: ' + e.message, 'WARN');
  }
  return COMPLETION_PHRASE;
}
function setCompletionPhraseUI() {
  var ui = SpreadsheetApp.getUi();
  var current = getCompletionPhrase();
  var res = ui.prompt('📝 Фраза готовности', 'Введите точную фразу, с которой ДОЛЖЕН начинаться готовый ответ (например: Отчёт готов). Текущая: ' + current, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var val = (res.getResponseText() || '').trim();
  if (!val) { ui.alert('Фраза не изменена.'); return; }
  var ss = SpreadsheetApp.getActive();
  var params = ss.getSheetByName('Параметры');
  if (!params) {
    // если нет листа Параметры — сохраним в Script Properties
    PropertiesService.getScriptProperties().setProperty('COMPLETION_PHRASE', val);
    ui.alert('✅ Фраза сохранена в настройках скрипта.');
  } else {
    params.getRange('B10').setValue(val);
    ui.alert('✅ Фраза сохранена в Параметры!B10.');
  }
  addLog('🔧 Новая фраза готовности: ' + val, 'INFO');
}

// ====== УТИЛИТЫ ДЛЯ ПОСЛЕДОВАТЕЛЬНОСТИ ======
function isCompletionReady(text) {
  if (!text || typeof text !== 'string') return false;
  var clean = text.trim();
  var phrase = getCompletionPhrase();
  var rdy = phrase ? clean.startsWith(phrase) : false;
  addLog(`🔍 Проверка готовности: "${clean.slice(0,30)}..." против "${phrase}" → ${rdy ? 'ГОТОВО' : 'НЕ ГОТОВО'}`, 'DEBUG');
  return rdy;
}

// ====== Prompt_box: фикс чтения формулы (если используем legacy-триггеры) ======
function getPromptFormula(rowIndex) {
  try {
    var ss = SpreadsheetApp.getActive();
    var promptSheet = ss.getSheetByName('Prompt_box');
    if (!promptSheet) { addLog('❌ Лист "Prompt_box" не найден', 'ERROR'); return null; }
    var rng = promptSheet.getRange(rowIndex, 6); // F
    var formula = rng.getFormula(); // ВАЖНО: формула, а не значение
    if (!formula || !formula.trim()) { addLog(`ℹ️ Формула в Prompt_box!F${rowIndex} пуста`, 'INFO'); return null; }
    addLog(`📥 Формула из Prompt_box!F${rowIndex}: ${formula.slice(0,80)}...`, 'DEBUG');
    return formula;
  } catch (e) {
    addLog('❌ Ошибка получения формулы из F' + rowIndex + ': ' + e.message, 'ERROR');
    return null;
  }
}
function setFormulaToCell(row, col, formula) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName('Распаковка');
    if (!sheet) { addLog('❌ Лист "Распаковка" не найден', 'ERROR'); return false; }
    var cell = sheet.getRange(row, col);
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
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return null;
    var value = sheet.getRange(row, col).getValue();
    if (value && typeof value === 'string' && col > 1) {
      var processed = processGeminiResponse(value);
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
    var cache = CacheService.getScriptCache();
    var status = { row: row, currentStep: currentStep, retryCount: retryCount, timestamp: new Date().getTime() };
    cache.put(PROCESSING_STATUS_KEY, JSON.stringify(status), 21600);
    addLog('💾 Статус сохранен: строка ' + row + ', шаг ' + currentStep + ', попытка ' + (retryCount + 1), 'DEBUG');
  } catch (e) { addLog('❌ Ошибка сохранения статуса: ' + e.message, 'ERROR'); }
}
function getProcessingStatus() {
  try {
    var cache = CacheService.getScriptCache();
    var statusStr = cache.get(PROCESSING_STATUS_KEY);
    return statusStr ? JSON.parse(statusStr) : null;
  } catch (e) { addLog('❌ Ошибка получения статуса: ' + e.message, 'ERROR'); return null; }
}
function clearProcessingStatus() {
  try { CacheService.getScriptCache().remove(PROCESSING_STATUS_KEY); addLog('🗑️ Статус обработки очищен', 'DEBUG'); }
  catch (e) { addLog('❌ Ошибка очистки статуса: ' + e.message, 'ERROR'); }
}
function startAutoProcessingChain(row) {
  addLog('🚀 Попытка запуска цепочки (legacy) для строки ' + row, 'INFO');
  var activeStatus = getProcessingStatus();
  if (activeStatus) { addLog('🚫 Цепочка уже активна: строка ' + activeStatus.row + ' (шаг ' + activeStatus.currentStep + ')', 'WARN'); notifyUser('Дождитесь завершения обработки строки ' + activeStatus.row); return false; }
  var triggerValue = getCellValue('Распаковка', row, 1);
  if (!triggerValue) { addLog('❌ Нет данных в A' + row + ' для запуска цепочки', 'WARN'); return false; }
  saveProcessingStatus(row, 1);
  processNextStep();
  return true;
}
function processNextStep() {
  var status = getProcessingStatus();
  if (!status) { addLog('❌ Нет активной цепочки', 'WARN'); return; }
  var row = status.row, step = status.currentStep;
  addLog('📋 Обработка шага ' + step + ' для строки ' + row, 'INFO');
  var promptRow = step + 1; // F2, F3, ...
  var formula = getPromptFormula(promptRow);
  if (!formula) { addLog('✅ Нет формулы в F' + promptRow + ', цепочка завершена', 'INFO'); clearProcessingStatus(); return; }
  var targetCol = step + 1; // B=2, C=3...
  if (!setFormulaToCell(row, targetCol, formula)) { addLog('❌ Не удалось установить формулу, цепочка прервана', 'ERROR'); clearProcessingStatus(); return; }
  saveProcessingStatus(row, step);
  try { ScriptApp.newTrigger('checkStepCompletion').timeBased().after(AUTO_PROCESSING_DELAY).create(); addLog('⏰ Проверка через ' + (AUTO_PROCESSING_DELAY/1000) + ' сек', 'DEBUG'); }
  catch (e) { addLog('❌ Ошибка создания триггера: ' + e.message, 'ERROR'); }
}
function checkStepCompletion() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'checkStepCompletion') ScriptApp.deleteTrigger(t); });
  var status = getProcessingStatus();
  if (!status) { addLog('❌ Нет активной цепочки при проверке', 'WARN'); return; }
  var row = status.row, step = status.currentStep, retryCount = status.retryCount || 0;
  var targetCol = step + 1;
  var result = getCellValue('Распаковка', row, targetCol);
  if (!result) { addLog('⏳ Шаг ' + step + ' (попытка ' + (retryCount+1) + '): результата нет', 'INFO'); return handleRetryOrFallback(row, step, retryCount, 'Результат еще не готов'); }
  if (!isCompletionReady(result.toString())) { addLog('⏳ Шаг ' + step + ' (попытка ' + (retryCount+1) + '): нет фразы готовности', 'INFO'); return handleRetryOrFallback(row, step, retryCount, 'Нет фразы завершения'); }
  addLog('✅ Шаг ' + step + ' завершен', 'INFO');
  saveProcessingStatus(row, step + 1, 0);
  processNextStep();
}
function handleRetryOrFallback(row, step, retryCount, reason) {
  retryCount++;
  if (retryCount >= MAX_RETRY_ATTEMPTS) {
    addLog('🚨 Превышен лимит попыток на шаге ' + step + ', причина: ' + reason, 'WARN');
    var strategy = decideFallbackStrategy(row, step, reason);
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
  var nextDelay = AUTO_PROCESSING_DELAY + (retryCount * RETRY_DELAY_INCREMENT);
  saveProcessingStatus(row, step, retryCount);
  addLog('🔄 Повторная проверка #' + (retryCount + 1) + ' через ' + (nextDelay/1000) + ' сек', 'INFO');
  try { ScriptApp.newTrigger('checkStepCompletion').timeBased().after(nextDelay).create(); }
  catch (e) { addLog('❌ Ошибка создания триггера для retry: ' + e.message, 'ERROR'); }
}
function decideFallbackStrategy(row, step, reason) {
  if (reason === 'Результат еще не готов') return 'STOP_CHAIN';
  if (reason === 'Нет фразы завершения') return 'FORCE_CONTINUE';
  return 'STOP_CHAIN';
}
function notifyUser(message) {
  try { SpreadsheetApp.getUi().alert('Автоцепочка: Внимание!', message, SpreadsheetApp.getUi().ButtonSet.OK); }
  catch (e) { addLog('❌ Ошибка уведомления: ' + e.message, 'ERROR'); }
}
function stopAutoProcessingChain() {
  clearProcessingStatus();
  var triggers = ScriptApp.getProjectTriggers();
  var deleted = 0; triggers.forEach(function(t){ if (t.getHandlerFunction() === 'checkStepCompletion') { ScriptApp.deleteTrigger(t); deleted++; } });
  addLog('🛑 Автоцепочка остановлена, удалено триггеров: ' + deleted, 'INFO');
}
function getChainStatus() {
  var status = getProcessingStatus();
  if (!status) return 'Нет активной цепочки обработки';
  var elapsed = Math.floor((new Date().getTime() - status.timestamp) / 1000);
  return 'Активна цепочка для строки ' + status.row + ', шаг ' + status.currentStep + ' (прошло ' + elapsed + ' сек)';
}

// ====== НОВАЯ БЕЗОПАСНАЯ ЦЕПОЧКА ТОЛЬКО ДЛЯ A3 (B3..G3) через GM_IF ======
function GM_IF(condition, prompt, maxTokens, temperature, _tick) {
  try {
    var condVal = false;
    // Нормализуем вход в одно скалярное значение
    var raw = condition;
    if (Array.isArray(raw)) {
      raw = (raw[0] && raw[0].length ? raw[0][0] : raw[0] || '');
    }
    var t = typeof raw;
    if (t === 'boolean') {
      condVal = raw === true;
    } else if (t === 'number') {
      condVal = raw !== 0;
    } else if (t === 'string') {
      var s = raw.trim().toLowerCase();
      // TRUE/ FALSE в любой локали: ИСТИНА/ЛОЖЬ; также 1/0; пустая строка → false
      condVal = (s === 'true' || s === 'истина' || s === '1' || s === 'да');
    } else {
      condVal = !!raw;
    }
    if (!condVal) return "";
    if (Array.isArray(prompt)) prompt = prompt[0][0];
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) return "";
    if (maxTokens == null) maxTokens = 25000;
    if (temperature == null) temperature = 0.7;
    return GM(prompt, maxTokens, temperature);
  } catch (e) {
    addLog('❌ GM_IF ошибка: ' + e.message, 'ERROR');
    return 'Error: ' + e.message;
  }
}
function columnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function letterToColumn(letters) {
  var s = String(letters || '').toUpperCase().trim();
  var col = 0;
  for (var i = 0; i < s.length; i++) {
    col = col * 26 + (s.charCodeAt(i) - 64);
  }
  return col;
}

function parseTargetA1(a1) {
  var raw = String(a1 || '').trim();
  if (!raw) throw new Error('Пустая ссылка на ячейку');
  var m = raw.match(/^([^!]+)!([A-Za-z]+)(\d+)$/);
  var sheetName, colLetters, row;
  if (m) {
    sheetName = m[1];
    colLetters = m[2];
    row = parseInt(m[3], 10);
  } else {
    var m2 = raw.match(/^([A-Za-z]+)(\d+)$/);
    if (!m2) throw new Error('Неверный формат ячейки: ' + raw);
    sheetName = 'Распаковка';
    colLetters = m2[1];
    row = parseInt(m2[2], 10);
  }
  if (sheetName !== 'Распаковка') throw new Error('Ожидался лист "Распаковка", получено: ' + sheetName);
  var col = letterToColumn(colLetters);
  return { sheetName: sheetName, row: row, col: col, a1: (colLetters.toUpperCase() + row) };
}

function prepareChainSmart() {
  var ss = SpreadsheetApp.getActive();
  var prompt = ss.getSheetByName('Prompt_box');
  var hasTargets = false;
  if (prompt) {
    var lastRow = Math.max(2, prompt.getLastRow());
    var vals = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0] || '').trim()) { hasTargets = true; break; }
    }
  }
  if (hasTargets) {
    prepareChainFromPromptBox();
  } else {
    prepareChainForA3();
  }
}

function prepareChainFromPromptBox() {
  var ss = SpreadsheetApp.getActive();
  var prompt = ss.getSheetByName('Prompt_box');
  var pack = ss.getSheetByName('Распаковка');
  if (!prompt) { SpreadsheetApp.getUi().alert('Лист "Prompt_box" не найден'); return; }
  if (!pack) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }

  var lastRow = Math.max(2, prompt.getLastRow());
  var targets = prompt.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B — ячейка назначения
  var mappings = [];
  for (var r = 2; r <= lastRow; r++) {
    var targetStr = String(targets[r - 2][0] || '').trim();
    if (!targetStr) continue;
    try {
      var parsed = parseTargetA1(targetStr);
      mappings.push({ promptRow: r, targetRow: parsed.row, targetCol: parsed.col, targetA1: parsed.a1 });
    } catch (e) {
      addLog('⚠️ Пропуск строки Prompt_box!B' + r + ': ' + e.message, 'WARN');
    }
  }

  if (!mappings.length) { SpreadsheetApp.getUi().alert('Нет целевых ячеек в Prompt_box!B, ничего не сделано.'); return; }

  var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  var phraseEscaped = phrase.replace(/"/g, '""');

  for (var i = 0; i < mappings.length; i++) {
    var m = mappings[i];
    var cond;
    if (i === 0) {
      // Всегда якорь от A3
      cond = '$A3<>""';
    } else {
      var prev = mappings[i - 1];
      cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
    }
    var formula = '=GM_IF(' + cond + ', Prompt_box!$F$' + m.promptRow + ', 25000, 0.7)';
    pack.getRange(m.targetRow, m.targetCol).setFormula(formula);
    addLog('📝 Формула установлена → Распаковка!' + m.targetA1 + ' из Prompt_box!F' + m.promptRow, 'INFO');
  }

  SpreadsheetApp.getUi().alert('✅ Готово: формулы расставлены по целям из Prompt_box!B.\\n' +
    'Первая ячейка запустится при заполнении соответствующего A-столбца, далее — по фразе готовности.');
}
function prepareChainForA3() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Распаковка');
  if (!sheet) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }
  var row = 3;
  var startCol = 2; // B
  var steps = 6;    // B..G
  var endCol = startCol + steps - 1;
  var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
  var phraseEscaped = phrase.replace(/"/g, '""');

  for (var col = startCol; col <= endCol; col++) {
    var stepIndex = col - 1;       // B=1 -> шаг 1
    var promptRow = stepIndex + 1; // шаг 1 -> F2 ... шаг 6 -> F7
    var target = sheet.getRange(row, col);
    var promptRef = 'Prompt_box!$F$' + promptRow;
    var formula;
    if (col === 2) {
      formula = '=GM_IF($A3<>"", ' + promptRef + ', 25000, 0.7)';
    } else {
      var prevColLetter = columnToLetter(col - 1);
      formula = '=GM_IF(LEFT(' + prevColLetter + '3, LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", ' + promptRef + ', 25000, 0.7)';
    }
    target.setFormula(formula);
    addLog('📝 Формула ' + target.getA1Notation() + ' установлена', 'DEBUG');
  }
  SpreadsheetApp.getUi().alert('✅ Готово: формулы B3..G3 проставлены.\nЗаполните A3 — шаги пойдут по очереди.');
}
function clearChainForA3() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName('Распаковка');
  if (!sheet) { SpreadsheetApp.getUi().alert('Лист "Распаковка" не найден'); return; }
  sheet.getRange(3, 2, 1, 6).clearContent(); // B3..G3
  SpreadsheetApp.getUi().alert('🧹 Очищено: B3..G3');
}

// ====== VK PARSER + фильтрация ======
function importVkPosts() {
  addLog('→ Импорт VK-постов с фильтрацией', 'INFO');
  var ss = SpreadsheetApp.getActive();
  var params = ss.getSheetByName('Параметры');
  if (!params) { addLog('❌ Нет листа "Параметры"', 'ERROR'); SpreadsheetApp.getUi().alert('Лист "Параметры" не найден!'); return; }
  var owner = params.getRange('B1').getValue();
  var count = params.getRange('B2').getValue();
  if (!owner || !count) { addLog('❌ Не указаны owner или count', 'ERROR'); SpreadsheetApp.getUi().alert('Введите owner и count на листе "Параметры"'); return; }
  var url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);
  try {
    var resp = UrlFetchApp.fetch(url);
    var arr = JSON.parse(resp.getContentText());
  } catch (e) {
    addLog('❌ Ошибка запроса VK: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка запроса VK Parser: ' + e);
    return;
  }
  if (!Array.isArray(arr)) { addLog('❌ Неверный массив от VK', 'ERROR'); SpreadsheetApp.getUi().alert('Неверный формат данных от VK Parser'); return; }

  var headers = [
    'Дата', 'Ссылка на пост', 'Текст поста', 'Номер поста',
    'Стоп-слова', 'Отфильтрованные посты', 'Новый номер',
    'Позитивные слова', 'Посты с позитивными словами', 'Новый номер (позитивные)'
  ];
  var out = [headers];
  arr.forEach(function(o, i) {
    var number = o.number !== undefined ? o.number : i + 1;
    out.push([o.date, o.link, o.text, number, '', '', '', '', '', '']);
  });

  var sheet = ss.getSheetByName('посты');
  if (!sheet) { addLog('❌ Лист "посты" не найден!', 'ERROR'); SpreadsheetApp.getUi().alert('Создайте лист "посты".'); return; }

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
    var stopWordsRange = '$E$2:$E$100';
    for (var row = 2; row <= totalRows; row++) {
      var formulaF = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + ')))*(' + stopWordsRange + '<>"")) > 0, "", C' + row + ')';
      sheet.getRange(row, 6).setFormula(formulaF); // F
      var formulaG = '=IF(F' + row + '<>"", COUNTA(F$2:F' + row + '), "")';
      sheet.getRange(row, 7).setFormula(formulaG); // G
    }
    var positiveWordsRange = '$H$2:$H$100';
    for (var row = 2; row <= totalRows; row++) {
      var formulaI = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + ')))*(' + positiveWordsRange + '<>"")) > 0, C' + row + ', "")';
      sheet.getRange(row, 9).setFormula(formulaI); // I
      var formulaJ = '=IF(I' + row + '<>"", COUNTA(I$2:I' + row + '), "")';
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
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName('посты');
    if (!sheet) { SpreadsheetApp.getUi().alert('Лист "посты" не найден'); return; }
    sheet.getRange(2, 5).setValue('консультация');
    sheet.getRange(3, 5).setValue('психолог');
    SpreadsheetApp.flush();
    var filtered2 = sheet.getRange(2, 6).getValue();
    var filtered3 = sheet.getRange(3, 6).getValue();
    var number2 = sheet.getRange(2, 7).getValue();
    var number3 = sheet.getRange(3, 7).getValue();
    var message = 'Тест фильтрации:\n\n' +
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
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('API-ключ Gemini не установлен. Меню: 🤖 Table AI → Установить API ключ Gemini');
  return key;
}
// ====== КЭШ ДЛЯ GM ======
function gmCacheKey_(prompt, maxTokens, temperature) {
  try {
    var s = 'p:' + String(prompt) + '|mx:' + String(maxTokens) + '|t:' + String(temperature);
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var v = (bytes[i] & 0xFF).toString(16);
      if (v.length === 1) v = '0' + v;
      hex += v;
    }
    return 'gm:' + hex.substring(0, 64);
  } catch (e) {
    return 'gm:fallback:' + (String(prompt).length) + ':' + String(maxTokens) + ':' + String(temperature);
  }
}
function gmCacheGet_(key) {
  try { return CacheService.getScriptCache().get(key); } catch (e) { return null; }
}
function gmCachePut_(key, value, ttlSec) {
  try {
    var ttl = Math.max(5, Math.min(21600, Math.floor(ttlSec || 300)));
    CacheService.getScriptCache().put(key, value, ttl);
  } catch (e) {}
}
function GM(prompt, maxTokens = 25000, temperature = 0.7) {
  addLog('→ GM: prompt=' + (prompt ? prompt.slice(0,60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');

  var apiKey = getGeminiApiKey();
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

  try {
    var response = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
    var responseData = JSON.parse(response.getContentText());
    addLog('← GM: HTTP ' + response.getResponseCode(), 'DEBUG');
    if (response.getResponseCode() !== 200) {
      var message = responseData.error && responseData.error.message ? responseData.error.message : 'Unknown error';
      addLog('❌ GM API ошибка: ' + message, 'ERROR');
      return 'Error: ' + message;
    }
    var candidate = responseData.candidates && responseData.candidates[0];
    var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
    var result = content && content.text ? content.text : 'Ошибка обработки данных';
    var processedResult = processGeminiResponse(result);
    addLog('✅ GM: результат, длина=' + result.length + (processedResult !== result ? ', преобразован из Markdown' : ''), 'INFO');
    return processedResult;
  } catch (error) {
    addLog('❌ GM исключение: ' + error.message, 'ERROR');
    return 'Error: ' + error.message;
  }
}
function initGeminiKey() {
  var ui = SpreadsheetApp.getUi();
  var help = 'Где взять ключ (коротко):\n' +
             '1) Откройте: https://aistudio.google.com/app/apikey\n' +
             '2) Нажмите “Create API key”\n' +
             '3) Скопируйте ключ\n\n' +
             'Вставьте ключ в поле ниже и нажмите OK';
  var res = ui.prompt('🔑 Введите ваш Gemini API ключ', help, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var key = (res.getResponseText() || '').trim();
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
  var ui = SpreadsheetApp.getUi();
  var msg =
    'Как получить API ключ Gemini:\n\n' +
    '1) Откройте Google AI Studio: https://aistudio.google.com/app/apikey\n' +
    '2) Нажмите "Create API key" (создать ключ)\n' +
    '3) Скопируйте ключ\n' +
    '4) Меню: 🔑 Gemini → "Установить API ключ" → вставьте ключ\n\n' +
    'Документация: https://ai.google.dev/gemini-api/docs/api-key?hl=ru';
  ui.alert('❓ Как получить API ключ Gemini', msg, ui.ButtonSet.OK);
}
function refreshSelectedGMTriggers() {
  var ss = SpreadsheetApp.getActive();
  var paramsSheet = ss.getSheetByName('Параметры');
  if (!paramsSheet) return;
  var activeCell = ss.getActiveRange();
  var cell = activeCell.getCell(1, 1);
  var row = cell.getRow();
  var triggerCell = paramsSheet.getRange(row, 26); // Z
  var current = triggerCell.getValue();
  triggerCell.setValue(current ? "" : ".");
  addLog('🔄 GM триггер обновлен для строки ' + row, 'DEBUG');
}

// ====== Форматирование ======
function applyUniformFormatting(sheet) {
  try {
    var range = sheet.getDataRange();
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
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Table AI')
    .addItem('▶️ Подготовить формулы (умный режим)', 'prepareChainSmart')
    .addItem('🔁 Обновить текущую ячейку (GM)', 'refreshCurrentGMCell')
    .addSeparator()
    .addItem('🧹 Очистить B3..G3', 'clearChainForA3')
    .addSeparator()
    .addSubMenu(ui.createMenu('🎯 AI Конструктор (Template System v2.0)')
      .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
      .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
      .addSeparator()
      .addItem('📦 Миграция данных (ConfigData → Templates)', 'showMigrationPreview')
      .addItem('💾 Экспорт шаблонов в лист', 'exportTemplatesToSheet')
      .addItem('❓ Справка', 'showCollectConfigHelp')
    )
    .addSeparator()
    .addItem('📥 Импорт VK постов', 'importVkPosts')
    .addItem('🔑 Установить API ключ Gemini', 'initGeminiKey')
    .addItem('📝 Фраза готовности (изменить)', 'setCompletionPhraseUI')
    .addItem('🖼️ OCR отзывов (A→B)', 'ocrReviews')
    .addItem('🖼️ OCR V2 (A→B)', 'ocrRun')
    .addSubMenu(ui.createMenu('🔐 Лицензия')
      .addItem('Ввести Email + Токен', 'setLicenseCredentialsUI')
      .addItem('Проверить статус', 'checkLicenseStatusUI')
    )
    .addToUi();

  if (DEV_MODE) {
    ui.createMenu('🧰 DEV')
      .addItem('📝 Показать логи', 'showLogsDialog')
      .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
      .addItem('🗑 Очистить логи', 'clearLogs')
      .addSeparator()
      .addItem('🧪 Откат миграции', 'rollbackMigration')
      .addToUi();
  }

  // Убрали устаревшую «горячую кнопку» (setupOcrHotButton) по просьбе пользователя
}

// Быстрое обновление активной GM-ячейки: пересоздаём формулу, чтобы заново вызвать Gemini
function refreshCurrentGMCell() {
  try {
    var ss = SpreadsheetApp.getActive();
    var range = ss.getActiveRange();
    if (!range) { SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return; }
    var cell = range.getCell(1, 1);
    var sheet = cell.getSheet();
    if (sheet.getName() !== 'Распаковка') { SpreadsheetApp.getUi().alert('Выберите ячейку на листе "Распаковка"'); return; }
    var row = cell.getRow();
    var col = cell.getColumn();

    var formula = cell.getFormula();
    var hasGm = formula && (/^\s*=\s*GM_IF\s*\(/i.test(formula) || /\bGM\s*\(/i.test(formula));
    if (!hasGm) {
      // Попробуем найти соответствие этой ячейки в Prompt_box!B (умный режим)
      var promptSheet = ss.getSheetByName('Prompt_box');
      if (promptSheet) {
        var lastRow = Math.max(2, promptSheet.getLastRow());
        var targets = promptSheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues(); // B2:B
        var mappings = [];
        for (var r = 2; r <= lastRow; r++) {
          var tstr = String(targets[r - 2][0] || '').trim();
          if (!tstr) continue;
          try {
            var parsed = parseTargetA1(tstr);
            mappings.push({ promptRow: r, targetA1: parsed.a1, targetRow: parsed.row, targetCol: parsed.col });
          } catch (e) {}
        }
        if (mappings.length) {
          var currentA1 = columnToLetter(col) + row;
          var idx = -1;
          for (var i = 0; i < mappings.length; i++) {
            if (mappings[i].targetA1 === currentA1) { idx = i; break; }
          }
          if (idx >= 0) {
            var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
            var phraseEscaped = phrase.replace(/"/g, '""');
            var cond;
            if (idx === 0) {
              cond = '$A3<>""';
            } else {
              var prev = mappings[idx - 1];
              cond = 'LEFT(' + prev.targetA1 + ', LEN("' + phraseEscaped + '"))="' + phraseEscaped + '"';
            }
            var promptRef = 'Prompt_box!$F$' + mappings[idx].promptRow;
            formula = '=GM_IF(' + cond + ', ' + promptRef + ', 25000, 0.7)';
          }
        }
      }
    }
    if (!formula) { SpreadsheetApp.getUi().alert('Нечего обновлять: в ячейке нет GM-формулы и нет соответствия в Prompt_box!B'); return; }

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
  var md = '# Отчёт готов\n\n**Список**:\n- один\n- два\n\n`код`\n\n[ссылка](https://example.com)\n';
  var converted = convertMarkdownToReadableText(md);
  SpreadsheetApp.getUi().alert('Преобразование Markdown', 'Исходный:\n' + md + '\n\nПреобразованный:\n' + converted, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ====== onEdit: авто-очистка Markdown для строки 3 (B..G) ======
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  var col = range.getColumn();
  var row = range.getRow();

  if (sheetName === 'Распаковка') {
    if (row === 3 && col > 1 && e.value && typeof e.value === 'string') {
      var processed = processGeminiResponse(e.value);
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
  var failures = [];
  try {
    // 1) columnToLetter
    var map = {1:'A',2:'B',7:'G',26:'Z',27:'AA',28:'AB'};
    Object.keys(map).forEach(k => {
      var got = columnToLetter(parseInt(k,10));
      if (got !== map[k]) failures.push('columnToLetter(' + k + ') → ' + got + ' (ожидалось ' + map[k] + ')');
    });

    // 2) Markdown detection & conversion
    var md = '**bold**\n- a\n- b\n';
    if (!isMarkdownText(md)) failures.push('isMarkdownText не распознал MD');
    var conv = convertMarkdownToReadableText(md);
    if (!conv || conv.indexOf('BOLD') === -1) failures.push('convertMarkdownToReadableText не преобразовал **bold** → BOLD');

    // 3) GM_IF sleep behavior
    var r = GM_IF(false, 'no-call');
    if (r !== '') failures.push('GM_IF при false условии должен возвращать пусто');

    // 4) Формулы для A3 (не трогаем содержимое, только проверяем, что ставятся корректно)
    var ss = SpreadsheetApp.getActive();
    var existed = !!ss.getSheetByName('Распаковка');
    var rSheet = existed ? ss.getSheetByName('Распаковка') : ss.insertSheet('Распаковка');
    var snapshot = [];
    for (var c=2;c<=7;c++){ snapshot.push(rSheet.getRange(3,c).getFormula()); }
    prepareChainForA3();
    var expectedB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 12500, 0.7)';
    var gotB3 = rSheet.getRange(3,2).getFormula();
    if (gotB3 !== expectedB3) failures.push('B3 формула некорректна: '+gotB3);
    clearChainForA3();
    // Восстановление прежних формул
    for (var c2=2;c2<=7;c2++){ if (snapshot[c2-2]) rSheet.getRange(3,c2).setFormula(snapshot[c2-2]); }
    if (!existed) ss.deleteSheet(rSheet);

    // 5) Умный режим: Prompt_box!B2:B3 → B3,C3 с якорем от A3
    var pbExisted = !!ss.getSheetByName('Prompt_box');
    var pb = pbExisted ? ss.getSheetByName('Prompt_box') : ss.insertSheet('Prompt_box');
    var bSnap = pb.getRange(2, 2, 2, 1).getDisplayValues(); // B2:B3
    var fSnap = pb.getRange(2, 6, 2, 1).getFormulas();      // F2:F3
    pb.getRange(2, 2).setValue('B3');
    pb.getRange(3, 2).setValue('C3');
    pb.getRange(2, 6).setFormula('="P1"');
    pb.getRange(3, 6).setFormula('="P2"');

    var rSheet2 = ss.getSheetByName('Распаковка') || ss.insertSheet('Распаковка');
    var b3Before = rSheet2.getRange(3, 2).getFormula();
    var c3Before = rSheet2.getRange(3, 3).getFormula();

    prepareChainSmart();

    var phrase2 = getCompletionPhrase() || COMPLETION_PHRASE;
    var phraseEsc2 = phrase2.replace(/"/g, '""');
    var expB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 12500, 0.7)';
    var expC3 = '=GM_IF(LEFT(B3, LEN("' + phraseEsc2 + '"))="' + phraseEsc2 + '", Prompt_box!$F$3, 12500, 0.7)';
    var gotB3_2 = rSheet2.getRange(3, 2).getFormula();
    var gotC3_2 = rSheet2.getRange(3, 3).getFormula();
    if (gotB3_2 !== expB3) failures.push('Smart-режим: формула B3 некорректна: ' + gotB3_2);
    if (gotC3_2 !== expC3) failures.push('Smart-режим: формула C3 некорректна: ' + gotC3_2);

    // Восстановление
    if (b3Before) rSheet2.getRange(3,2).setFormula(b3Before); else rSheet2.getRange(3,2).clearContent();
    if (c3Before) rSheet2.getRange(3,3).setFormula(c3Before); else rSheet2.getRange(3,3).clearContent();
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
  var ui = SpreadsheetApp.getUi();
  var curEmail = getLicenseEmail();
  var curToken = getLicenseToken();
  var emailRes = ui.prompt('🔐 Лицензия — Email', 'Введите Email (для проверки лицензии). Текущий: ' + (curEmail || '—'), ui.ButtonSet.OK_CANCEL);
  if (emailRes.getSelectedButton() !== ui.Button.OK) return;
  var email = (emailRes.getResponseText() || '').trim();
  var tokenRes = ui.prompt('🔐 Лицензия — Токен', 'Введите Токен (из таблицы лицензий). Текущий: ' + (curToken ? (curToken.substring(0,4)+'****') : '—'), ui.ButtonSet.OK_CANCEL);
  if (tokenRes.getSelectedButton() !== ui.Button.OK) return;
  var token = (tokenRes.getResponseText() || '').trim();
  if (!email || !token) { ui.alert('Email и Токен обязательны.'); return; }
  PropertiesService.getScriptProperties().setProperty('LICENSE_EMAIL', email);
  PropertiesService.getScriptProperties().setProperty('LICENSE_TOKEN', token);
  ui.alert('✅ Лицензия сохранена.');
}
function serverStatus_() {
  var email = getLicenseEmail();
  var token = getLicenseToken();
  var payload = { action: 'status', email: email, token: token };
  var options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  var resp = UrlFetchApp.fetch(SERVER_URL, options);
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) return { ok: false, error: (data && data.error) || ('HTTP_' + code) };
  return data;
}
function checkLicenseStatusUI() {
  try {
    var st = serverStatus_();
    if (st.ok) SpreadsheetApp.getUi().alert('Лицензия', '✅ Активна' + (st.until ? (' до ' + st.until) : ''), SpreadsheetApp.getUi().ButtonSet.OK);
    else SpreadsheetApp.getUi().alert('Лицензия', '❌ ' + (st.error || 'Неизвестная ошибка'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { SpreadsheetApp.getUi().alert('Лицензия', 'Ошибка: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK); }
}
function serverGM_(prompt, maxTokens, temperature) {
  var email = getLicenseEmail();
  var token = getLicenseToken();
  var apiKey = getGeminiApiKey();
  var payload = { action: 'gm', email: email, token: token, apiKey: apiKey, prompt: prompt, maxTokens: maxTokens, temperature: temperature };
  var options = { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true };
  var resp = UrlFetchApp.fetch(SERVER_URL, options);
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) return { ok: false, error: (data && data.error) || ('HTTP_' + code) };
  return data;
}
function GM(prompt, maxTokens, temperature) {
  // Лицензия обязательна всегда: и в PROD, и в DEV. Если пустой email/token — блокируем.
  try {
    var _email = getLicenseEmail();
    var _token = getLicenseToken();
    if (!_email || !_token) {
      addLog('🚫 Отказ: лицензия не задана (email/token пустые)', 'WARN');
      return 'Error: LICENSE_REQUIRED';
    }
    var st0 = serverStatus_();
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
  addLog('→ GM (proxy): prompt=' + (prompt ? prompt.slice(0,60)+'...' : 'нет') + ' (' + (prompt ? prompt.length : 0) + ')', 'INFO');
  if (!prompt || typeof prompt !== 'string') throw new Error('Промпт должен быть непустой строкой.');
  if (prompt.length > 50000) throw new Error('Промпт слишком длинный, сократите до 50000 символов.');
  var key = gmCacheKey_(prompt, maxTokens, temperature);
  var cached = gmCacheGet_(key); if (cached) { addLog('⚡ GM cache-hit', 'DEBUG'); return cached; }
  var errKey = 'gm_err:' + key;
  var lastErr = gmCacheGet_(errKey); if (lastErr) { addLog('⏳ GM last-error cached, skip call', 'DEBUG'); return lastErr; }
  var ok = false, text = '', serr = null;
  try {
    var r = serverGM_(prompt, maxTokens, temperature);
    if (r && r.ok) { ok = true; text = r.data || ''; }
    else { serr = (r && r.error) || 'SERVER_ERROR'; }
  } catch (e) { serr = e.message; }
  if (ok) {
    var processed = processGeminiResponse(text);
    gmCachePut_(key, processed, 21600);
    return processed;
  }
  if (DEV_MODE) {
    addLog('⚠️ DEV fallback → прямой Gemini. Причина: ' + (serr || 'UNKNOWN'), 'WARN');
    try {
      var apiKey = getGeminiApiKey();
      var body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: temperature } };
      var options = { method: 'POST', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true };
      var resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, options);
      var code = resp.getResponseCode();
      var data = JSON.parse(resp.getContentText());
      addLog('← GM (direct): HTTP ' + code, 'DEBUG');
      if (code !== 200) {
        var message = data && data.error && data.error.message ? data.error.message : 'Unknown error';
        var msg = 'Error: ' + message;
        gmCachePut_(errKey, msg, 60);
        return msg;
      }
      var candidate = data.candidates && data.candidates[0];
      var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
      var txt = content && content.text ? content.text : '';
      var processed2 = processGeminiResponse(txt);
      gmCachePut_(key, processed2, 21600);

// ====== COLLECT CONFIG INTEGRATION - MENU HANDLERS ======

/**
 * Открывает диалоговое окно Collect Config для настройки AI запроса
 */
function openCollectConfigUI() {
  try {
    var html = HtmlService.createHtmlOutputFromFile('CollectConfigUI_v2')
      .setWidth(800)
      .setHeight(600)
      .setTitle('🎯 AI Конструктор - Template System v2.0');
    SpreadsheetApp.getUi().showModelessDialog(html, '🎯 AI Конструктор');
    addLog('✅ Открыт Collect Config UI', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка открытия Collect Config UI: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка открытия интерфейса: ' + e.message);
  }
}

/**
 * Обновляет активную ячейку с сохраненной конфигурацией
 */
function refreshCellWithConfig() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var cell = sheet.getActiveCell();
    var cellAddress = cell.getA1Notation();
    
    addLog('🔄 Обновление ячейки ' + cellAddress + ' с конфигурацией', 'INFO');
    
    // Вызов функции из CollectConfigUI.gs
    if (typeof serverExecuteConfig !== 'undefined') {
      var result = serverExecuteConfig(cellAddress);
      SpreadsheetApp.getUi().alert('✅ Ячейка обновлена: ' + cellAddress);
    } else {
      throw new Error('Модуль CollectConfigUI не подключен');
    }
  } catch (e) {
    addLog('❌ Ошибка обновления ячейки: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

/**
 * Показывает предпросмотр миграции из старого ConfigData
 */
function showMigrationPreview() {
  try {
    addLog('📦 Запуск превью миграции', 'INFO');
    
    // Вызов функции из MIGRATION.gs
    if (typeof validateBeforeMigration !== 'undefined') {
      var report = validateBeforeMigration();
      SpreadsheetApp.getUi().alert(
        '📦 Проверка перед миграцией',
        report,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      
      // Предложить запустить миграцию
      var response = SpreadsheetApp.getUi().alert(
        '🔄 Начать миграцию?',
        'Хотите запустить интерактивную миграцию данных?',
        SpreadsheetApp.getUi().ButtonSet.YES_NO
      );
      
      if (response === SpreadsheetApp.getUi().Button.YES && typeof interactiveMigration !== 'undefined') {
        interactiveMigration();
      }
    } else {
      throw new Error('Модуль MIGRATION не подключен');
    }
  } catch (e) {
    addLog('❌ Ошибка миграции: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

/**
 * Показывает справку по Template System
 */
function showCollectConfigHelp() {
  var helpText = `
🎯 AI КОНСТРУКТОР - TEMPLATE SYSTEM V2.0

═══════════════════════════════════════

📖 ОСНОВНЫЕ ФУНКЦИИ:

1️⃣ Настроить запрос
   • Открывает интерфейс для создания AI промптов
   • Поддержка шаблонов (сохранение/загрузка)
   • Автоматическое заполнение параметров

2️⃣ Обновить ячейку
   • Применяет сохраненную конфигурацию
   • Быстрое обновление AI запроса

3️⃣ Миграция данных
   • Перенос из старого ConfigData
   • Проверка перед миграцией
   • Откат при необходимости

4️⃣ Экспорт шаблонов
   • Создание backup в Google Sheets
   • Просмотр всех шаблонов

═══════════════════════════════════════

🚀 БЫСТРЫЙ СТАРТ:

1. Нажмите "Настроить запрос"
2. Заполните промпт и параметры
3. Сохраните как шаблон
4. Выберите ячейку и примените!

═══════════════════════════════════════

📚 Документация: см. TEMPLATES_GUIDE.md
`;
  
  SpreadsheetApp.getUi().alert(
    '❓ Справка - AI Конструктор',
    helpText,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  
  addLog('ℹ️ Показана справка Collect Config', 'INFO');
}
      return processed2;
    } catch (e2) {
      var em = 'Error: ' + e2.message;
      gmCachePut_(errKey, em, 60);
      return em;
    }
  }
  var msg = 'Error: ' + (serr || 'LICENSE_OR_SERVER');
  gmCachePut_(errKey, msg, 60);
  return msg;
}
// ====== OCR отзывов (изображения/ссылки в A → текст в B) через Gemini (одного GEMINI_API_KEY достаточно) ======
var OCR_LANGUAGE = 'ru';
var MAX_FOLDER_IMAGES = 50; // для GDrive и локальных итераторов
var OCR_BATCH_LIMIT = 50;   // общий лимит изображений/отзывов за один прогон по строке

function ocrGetStateKey_(row){ return 'OCRQ:row:' + row; }
function ocrGetState_(row) {
  try {
    var s = PropertiesService.getScriptProperties().getProperty(ocrGetStateKey_(row));
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}
function ocrSetState_(row, state) {
  try { PropertiesService.getScriptProperties().setProperty(ocrGetStateKey_(row), JSON.stringify(state||{})); } catch (e) {}
}
function ocrClearState_(row) {
  try { PropertiesService.getScriptProperties().deleteProperty(ocrGetStateKey_(row)); } catch (e) {}
}
function ocrSignature_(textVal, formula){ return String(textVal||'') + '|' + String(formula||''); }

function ocrFindNextRow_(sh, r) {
  try {
    var last = Math.max(r, sh.getLastRow());
    var row = r;
    var b0 = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
    if (!b0) return row;
    row++;
    while (row <= last) {
      var a = String(sh.getRange(row, 1).getDisplayValue() || '').trim();
      var b = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
      if (a) break; // встретили следующую запись в A → предыдущий блок завершён
      if (b) row++; else break; // продолжаем, пока B занято и A пусто
    }
    return row; // первая пустая строка после блока
  } catch (e) { return r; }
}

function ocrReviews() {
  try {
    // Лицензия (если сервер недоступен — в DEV_MODE продолжаем)
    try {
      if (typeof serverStatus_ === 'function') {
        var st = serverStatus_();
        if (!st.ok && !(typeof DEV_MODE !== 'undefined' && DEV_MODE)) {
          SpreadsheetApp.getUi().alert('Лицензия', '❌ Лицензия не активна или сервер недоступен', SpreadsheetApp.getUi().ButtonSet.OK);
          return;
        }
      }
    } catch (e) { /* игнорируем в DEV */ }

    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName('Отзывы');
    if (!sh) { SpreadsheetApp.getUi().alert('Лист "Отзывы" не найден'); return; }
    var lastRow = Math.max(2, sh.getLastRow());
    var processed = 0, empty = 0, errors = 0, skipped = 0;
    var overwrite = getOcrOverwrite_();

    for (var r = 2; r <= lastRow; r++) {
      var rangeA = sh.getRange(r, 1);
      var textVal = String(rangeA.getDisplayValue() || '').trim();
      var formula = String(rangeA.getFormula() || '');
      var richUrl = '';
      try {
        var rich = rangeA.getRichTextValue();
        if (rich) {
          // 1) По сегментам
          var runs = rich.getRuns && rich.getRuns();
          if (runs && runs.length) {
            for (var ri = 0; ri < runs.length; ri++) {
              var st = runs[ri].getTextStyle && runs[ri].getTextStyle();
              var lu = st && st.getLinkUrl && st.getLinkUrl();
              if (lu) { richUrl = String(lu).trim(); break; }
            }
          }
          // 2) Ссылка на всю ячейку
          if (!richUrl && typeof rich.getLinkUrl === 'function') {
            var ru = rich.getLinkUrl();
            if (ru) richUrl = String(ru).trim();
          }
          // 3) Через стиль всей ячейки
          if (!richUrl && rich.getTextStyle) {
            var ts = rich.getTextStyle();
            var lu2 = ts && ts.getLinkUrl && ts.getLinkUrl();
            if (lu2) richUrl = String(lu2).trim();
          }
        }
      } catch (e) {}
      if (!textVal && !formula && !richUrl) { empty++; continue; }

      // Политика перезаписи: если B уже заполнено и overwrite=false — пропускаем строку,
      // но если есть активная очередь по этой строке (signature совпадает) — продолжаем
      var sig = ocrSignature_(textVal, formula);
      var state = ocrGetState_(r);
      var hasActiveQueue = !!(state && state.signature === sig);
      var bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
      if (!overwrite && bVal && !hasActiveQueue) { skipped++; continue; }

      var sources = parseSourcesFromCell_(textVal, formula, richUrl);
      if (!sources.length) {
        addLog('⚠️ Нет источников в A' + r + ': text="' + String(textVal).slice(0,120) + '" formula="' + String(formula).slice(0,120) + '" link="' + richUrl + '"', 'WARN');
        empty++;
        continue;
      }

      // Инициализация состояния очереди по строке
      if (!state || state.signature !== sig) {
        state = { signature: sig, sources: {} };
      }

      // Куда писать: если B уже есть (и мы не пересоздаём), дописываем ниже блока
      var writeRow = bVal ? ocrFindNextRow_(sh, r) : r;

      // Собираем изображения и тексты из источников с учётом offset и общего лимита по строке
      var batchImages = [];
      var collectedTexts = [];
      var remainingCap = OCR_BATCH_LIMIT;
      var hasMoreAny = false;
      for (var i = 0; i < sources.length && remainingCap > 0; i++) {
        var src = sources[i];
        var key = src.kind + ':' + (src.id || src.url || '');
        var srcState = state.sources[key] || { offset: 0, done: false };
        if (srcState.done) continue;
        var part = { images: [], texts: [], hasMore: false, nextOffset: srcState.offset };
        try { part = ocrSource_(src, OCR_LANGUAGE, srcState.offset, remainingCap) || part; }
        catch (e1) { errors++; addLog('❌ OCR parse error (row ' + r + '): ' + e1.message, 'ERROR'); }
        var added = 0;
        if (part.texts && part.texts.length) { collectedTexts = collectedTexts.concat(part.texts); added += part.texts.length; }
        if (added < remainingCap && part.images && part.images.length) { batchImages = batchImages.concat(part.images); added += part.images.length; }
        remainingCap = Math.max(0, remainingCap - added);
        if (part.hasMore) { hasMoreAny = true; srcState.offset = part.nextOffset || (srcState.offset + added); }
        else { srcState.done = true; srcState.offset = part.nextOffset || srcState.offset; }
        state.sources[key] = srcState;
      }
      if (!batchImages.length && !collectedTexts.length) { empty++; continue; }

      var reviews = [];
      // Сначала используем тексты (если это обсуждение VK и т.п.)
      // Лимитируем общий выпуск по строке до OCR_BATCH_LIMIT
      if (collectedTexts.length) {
        reviews = collectedTexts.slice(0, OCR_BATCH_LIMIT);
      }
      var remaining = Math.max(0, OCR_BATCH_LIMIT - reviews.length);
      if (remaining > 0 && batchImages.length) {
        // Ограничим количество изображений
        var limitedImages = batchImages.slice(0, remaining);
        try {
          var out = serverGmOcrBatch_(limitedImages, OCR_LANGUAGE);
          var arr = splitNumberedReviews_(out);
          if (arr.length <= 1) {
            var alt = (out || '').split(/\n{2,}/).map(function(s){ return String(s||'').trim(); }).filter(function(s){ return !!s; });
            arr = alt.length > 1 ? alt : [out];
          }
          reviews = reviews.concat(arr);
        } catch (e2) {
          errors++;
          addLog('❌ OCR batch error (row ' + r + '): ' + e2.message, 'ERROR');
          // fallback: по одному изображению
          try {
            for (var j = 0; j < limitedImages.length; j++) {
              var b = Utilities.newBlob(Utilities.base64Decode(limitedImages[j].data), limitedImages[j].mimeType || 'image/png', 'img');
              var t = gmOcrFromBlob_(b, OCR_LANGUAGE);
              if (t && String(t).trim()) reviews.push(String(t).trim());
            }
          } catch (e3) { addLog('❌ OCR fallback error (row ' + r + '): ' + e3.message, 'ERROR'); }
        }
      }

      if (!reviews.length) { empty++; continue; }
      if (reviews.length > 1) {
        sh.insertRowsAfter(writeRow, reviews.length - 1);
        lastRow += (reviews.length - 1);
      }
      var matrix = reviews.map(function(x){ return [x]; });
      sh.getRange(writeRow, 2, reviews.length, 1).setValues(matrix);
      if (reviews.length > 1 && writeRow === r) {
        r += (reviews.length - 1); // пропустим только что вставленные строки, если писали в текущую строку
      }

      // Сохраняем/очищаем состояние очереди
      if (hasMoreAny || remainingCap === 0) {
        ocrSetState_(r, state);
      } else {
        ocrClearState_(r);
      }

      processed++;
      Utilities.sleep(150); // чуть притормозим, чтобы не упереться в квоты
    }
    SpreadsheetApp.getUi().alert('OCR завершён', 'Строк обработано: ' + processed + '\nПропущено (B уже заполнено): ' + skipped + '\nПустых: ' + empty + '\nОшибок: ' + errors + '\n\nЛимит: ' + OCR_BATCH_LIMIT + ' за запуск. Если остались элементы — запустите ещё раз.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    addLog('❌ OCR авария: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка OCR: ' + e.message);
  }
}

function getOcrOverwrite_() {
  try {
    var v = PropertiesService.getScriptProperties().getProperty('OCR_OVERWRITE');
    if (!v) return false; // по умолчанию НЕ перезаписываем
    v = String(v).toLowerCase().trim();
    return v === '1' || v === 'true' || v === 'yes' || v === 'да';
  } catch (e) { return false; }
}

function parseSourcesFromCell_(textVal, formula, richUrl) {
  var arr = [];
  // 0) Гиперссылка на ячейке
  if (richUrl) {
    var norm = normalizeUrl_(richUrl);
    if (norm) arr.push(classifyUrlSource_(norm));
  }
  // 1) IMAGE("...")
  var urlFromImage = parseImageFormulaUrl_(formula);
  if (urlFromImage) arr.push(classifyUrlSource_(normalizeUrl_(urlFromImage)));
  // 1.1) HYPERLINK("...")
  var urlFromHyper = parseHyperlinkFormulaUrl_(formula);
  if (urlFromHyper) arr.push(classifyUrlSource_(normalizeUrl_(urlFromHyper)));

  // 2) Явные ссылки в тексте (может быть несколько через перевод строки/пробел)
  var urls = [];
  try {
    // a) http/https
    (textVal.match(/https?:\/\/\S+/g) || []).forEach(function(s){ urls.push(s); });
    // b) без схемы (vk.com/…, drive.google.com/…, yadi.sk/…, disk.yandex.ru/…, dropbox.com/…)
    (textVal.match(/(?:^|\s)(?:vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com)\/\S+/gi) || [])
      .forEach(function(s){ urls.push(s.trim()); });
  } catch (e) {}
  urls = urls.map(function(s){ return normalizeUrl_(s.replace(/[),.;]+$/, '')); });
  urls.forEach(function(u){
    arr.push(classifyUrlSource_(u));
  });

  // Уникализируем источники
  var seen = {};
  arr = arr.filter(function(s){
    var k = s.kind + ':' + (s.url || s.id);
    if (seen[k]) return false; seen[k] = true; return true;
  });
  return arr;
}

function classifyUrlSource_(u) {
  // VK album/topic
  var vk = detectVkLink_(u);
  if (vk) return vk; // { kind: 'vk-album'|'vk-topic', url }
  // Google Drive
  var g = detectDriveLink_(u);
  if (g && g.type === 'folder') return { kind: 'drive-folder', id: g.id };
  if (g && g.type === 'file') return { kind: 'drive-file', id: g.id };
  // Yandex Disk (public)
  if (isYandexPublic_(u)) return { kind: 'yadisk', url: u };
  // Dropbox file share
  if (isDropboxLink_(u)) return { kind: 'dropbox-file', url: u };
  // Generic URL (пытаемся скачать как картинку)
  return { kind: 'url', url: u };
}

function parseImageFormulaUrl_(formula) {
  if (!formula) return '';
  var f = String(formula).trim();
  // Поддержка локализованных имён функций: IMAGE / ИЗОБРАЖЕНИЕ; кавычки ' или "
  var m = f.match(/^=\s*(?:IMAGE|ИЗОБРАЖЕНИЕ)\s*\(\s*(["'])([^"']+)\1/i);
  return m ? m[2] : '';
}

function parseHyperlinkFormulaUrl_(formula) {
  if (!formula) return '';
  var f = String(formula).trim();
  // Поддержка локализованных имён функций: HYPERLINK / ГИПЕРССЫЛКА; кавычки ' или "
  var m = f.match(/^=\s*(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*(["'])([^"']+)\1/i);
  return m ? m[2] : '';
}

function normalizeUrl_(u) {
  try {
    var s = String(u || '').trim();
    if (!s) return '';
    // если завернут в <...> — уберём
    s = s.replace(/^<+|>+$/g, '');
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\./i.test(s)) return 'https://' + s;
    if (/^(vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com)\//i.test(s)) return 'https://' + s;
    return s;
  } catch (e) { return String(u || ''); }
}

function detectDriveLink_(url) {
  try {
    var u = String(url || '');
    var m1 = u.match(/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/);
    if (m1) return { type: 'folder', id: m1[1] };
    var m2 = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m2) return { type: 'file', id: m2[1] };
    var m3 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m3) return { type: 'file', id: m3[1] };
    return null;
  } catch (e) { return null; }
}

function ocrSource_(src, lang, offset, limit) {
  // Возвращаем объект { images: [inlineData...], texts: [ ... ] }
  if (src.kind === 'drive-folder') {
    return enumerateDriveFolderImages_(src.id, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'drive-file') {
    var file = DriveApp.getFileById(src.id);
    if (offset && offset > 0) return { images: [], texts: [], hasMore: false, nextOffset: offset };
    return { images: [{ mimeType: file.getBlob().getContentType() || 'image/png', data: Utilities.base64Encode(file.getBlob().getBytes()) }], texts: [], hasMore: false, nextOffset: 1 };
  } else if (src.kind === 'url') {
    var resp = UrlFetchApp.fetch(src.url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() >= 300) throw new Error('HTTP ' + resp.getResponseCode() + ' по URL');
    var blob = resp.getBlob();
    if (offset && offset > 0) return { images: [], texts: [], hasMore: false, nextOffset: offset };
    return { images: [{ mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes()) }], texts: [], hasMore: false, nextOffset: 1 };
  } else if (src.kind === 'yadisk') {
    return collectYandexPublic_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'dropbox-file') {
    var dl = toDropboxDirect_(src.url);
    var resp2 = UrlFetchApp.fetch(dl, { muteHttpExceptions: true, followRedirects: true });
    if (resp2.getResponseCode() >= 300) throw new Error('Dropbox HTTP ' + resp2.getResponseCode());
    var blob2 = resp2.getBlob();
    if (offset && offset > 0) return { images: [], texts: [], hasMore: false, nextOffset: offset };
    return { images: [{ mimeType: blob2.getContentType() || 'image/png', data: Utilities.base64Encode(blob2.getBytes()) }], texts: [], hasMore: false, nextOffset: 1 };
  } else if (src.kind === 'vk-album') {
    return collectVkAlbum_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'vk-topic') {
    return collectVkDiscussion_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  } else if (src.kind === 'vk-reviews') {
    return collectVkReviews_(src.url, offset || 0, Math.max(0, limit || OCR_BATCH_LIMIT));
  }
  return { images: [], texts: [], hasMore: false, nextOffset: offset || 0 };
}

function ocrDriveFolder_(folderId, lang) {
  var folder = DriveApp.getFolderById(folderId);
  var texts = [];
  var it = folder.getFiles();
  var n = 0;
  while (it.hasNext()) {
    var f = it.next();
    // фильтруем по типу
    var mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    try {
      var blob = f.getBlob();
      var t = gmOcrFromBlob_(blob, lang);
      if (t && String(t).trim()) texts.push(String(t).trim());
    } catch (e) {
      addLog('⚠️ OCR по файлу из папки: ' + f.getName() + ' → ' + e.message, 'WARN');
    }
    n++; if (n >= MAX_FOLDER_IMAGES) break;
    Utilities.sleep(150);
  }
  return texts.join('\n\n');
}

function collectDriveFolderImages_(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var list = [];
  var it = folder.getFiles();
  var n = 0;
  while (it.hasNext()) {
    var f = it.next();
    var mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    var blob = f.getBlob();
    list.push({ mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes()) });
    n++; if (n >= MAX_FOLDER_IMAGES) break;
  }
  return list;
}

function enumerateDriveFolderImages_(folderId, offset, limit) {
  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFiles();
  var images = [];
  var imgIndex = 0;
  while (it.hasNext()) {
    var f = it.next();
    var mt = String(f.getMimeType() || '').toLowerCase();
    if (mt.indexOf('image/') !== 0) continue;
    if (imgIndex < offset) { imgIndex++; continue; }
    var blob = f.getBlob();
    images.push({ mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes()) });
    imgIndex++;
    if (images.length >= limit) break;
  }
  var hasMore = it.hasNext();
  var nextOffset = offset + images.length;
  return { images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset };
}

function gmOcrFromBlob_(blob, lang) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  var mime = blob.getContentType() || 'image/png';
  var b64 = Utilities.base64Encode(blob.getBytes());
  var instruction = 'Задача: транскрибируй текст на изображении БЕЗ добавления от себя. Верни только чистый текст. Если на вход подается несколько изображений — разделяй отзывы нумерацией (1., 2., 3.).' + (lang ? ' Язык исходного текста: ' + lang + '.' : '');
  var body = {
    contents: [{
      parts: [
        { text: instruction },
        { inlineData: { mimeType: mime, data: b64 } }
      ]
    }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0 }
  };
  var resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200) {
    var msg = (data && data.error && data.error.message) || ('HTTP_' + code);
    throw new Error('Gemini OCR: ' + msg);
  }
  var candidate = data.candidates && data.candidates[0];
  var content = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
  var text = content && content.text ? content.text : '';
  if (typeof processGeminiResponse === 'function') {
    return processGeminiResponse(text);
  }
  return text;
}

function serverGmOcrBatch_(images, lang) {
  var email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  var token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var payload = { action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, lang: lang || 'ru' };
  var resp = UrlFetchApp.fetch(SERVER_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200 || !data || !data.ok) throw new Error((data && data.error) || ('HTTP_' + code));
  return data.data || '';
}

function splitNumberedReviews_(text) {
  var s = String(text || '').trim();
  if (!s) return [];
  // Ищем паттерн нумерации 1. ... 2. ... 3. ... (в начале строки)
  var parts = s.split(/\n\s*(?=\d+\.)/g).map(function(x){ return String(x||'').trim(); }).filter(function(x){ return !!x; });
  // Если первая часть не начинается с "1.", не считаем это нумерацией
  if (!/^\d+\.\s/.test(parts[0])) return [s];
  // Убираем префиксы "N."
  parts = parts.map(function(x){ return x.replace(/^\d+\.\s*/, ''); });
  return parts;
}

// ===== Провайдеры: Yandex Disk (публичный), Dropbox-file, VK (album/topic через ваше веб-приложение) =====
function isYandexPublic_(u) {
  return /yadi\.sk\//i.test(u) || /disk\.yandex\.(ru|com)\//i.test(u);
}
function isDropboxLink_(u) {
  return /dropbox\.com\//i.test(u);
}
function toDropboxDirect_(u) {
  try {
    var url = u.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    if (url.indexOf('?dl=0') >= 0) url = url.replace('?dl=0', '?dl=1');
    if (url.indexOf('?dl=1') < 0 && url.indexOf('?') < 0) url += '?dl=1';
    return url;
  } catch (e) { return u; }
}

function collectYandexPublic_(publicUrl, offset, limit) {
  // public/resources может отдавать как файл, так и папку. Для папки пройдёмся children и возьмём только image/* (до OCR_BATCH_LIMIT)
  var base = 'https://cloud-api.yandex.net/v1/disk/public/resources';
  var download = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';
  var images = [];
  try {
    var res = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl), { muteHttpExceptions: true, followRedirects: true });
    var code = res.getResponseCode();
    var data = JSON.parse(res.getContentText());
    if (code >= 300) throw new Error('Yandex public meta HTTP ' + code);
    if (data && data.type === 'file') {
      if (offset && offset > 0) return { images: [], texts: [], hasMore: false, nextOffset: offset };
      var dl = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl)).getContentText();
      var link = JSON.parse(dl).href;
      var f = UrlFetchApp.fetch(link, { muteHttpExceptions: true, followRedirects: true });
      var blob = f.getBlob();
      images.push({ mimeType: blob.getContentType() || 'image/png', data: Utilities.base64Encode(blob.getBytes()) });
      return { images: images, texts: [], hasMore: false, nextOffset: 1 };
    } else if (data && data.type === 'dir') {
      // Скан по страницам до набора limit изображений, учитывая image-offset
      var pageOffset = 0;
      var imgSeen = 0;
      var takeLimit = Math.max(0, limit || OCR_BATCH_LIMIT);
      while (images.length < takeLimit) {
        var meta = UrlFetchApp.fetch(base + '?public_key=' + encodeURIComponent(publicUrl) + '&limit=200&offset=' + pageOffset, { muteHttpExceptions: true, followRedirects: true });
        var md = JSON.parse(meta.getContentText());
        var items = (md && md._embedded && md._embedded.items) || [];
        if (!items.length) break;
        for (var i = 0; i < items.length && images.length < takeLimit; i++) {
          var it = items[i];
          if (it.type !== 'file') continue;
          var mime = String(it.mime_type || '').toLowerCase();
          if (mime.indexOf('image/') !== 0) continue;
          if (imgSeen < (offset || 0)) { imgSeen++; continue; }
          var dl2 = UrlFetchApp.fetch(download + '?public_key=' + encodeURIComponent(publicUrl) + '&path=' + encodeURIComponent(it.path)).getContentText();
          var link2 = JSON.parse(dl2).href;
          var f2 = UrlFetchApp.fetch(link2, { muteHttpExceptions: true, followRedirects: true });
          var blob2 = f2.getBlob();
          images.push({ mimeType: blob2.getContentType() || 'image/png', data: Utilities.base64Encode(blob2.getBytes()) });
          imgSeen++;
        }
        pageOffset += items.length;
        if (items.length < 200) break;
      }
      var hasMore = images.length >= takeLimit; // грубая оценка
      var nextOffset = (offset || 0) + images.length;
      return { images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset };
    }
  } catch (e) {
    addLog('⚠️ Yandex public error: ' + e.message, 'WARN');
  }
  return { images: images, texts: [], hasMore: false, nextOffset: (offset || 0) + images.length };
}

function detectVkLink_(u) {
  var s = String(u||'');
  // album-123_456 или album123_456
  if (/vk\.com\/(reviews-?\d+)/i.test(s)) return { kind: 'vk-reviews', url: u };
  if (/vk\.com\/(album-?\d+_\d+)/i.test(s)) return { kind: 'vk-album', url: u };
  if (/vk\.com\/(topic-?\d+_\d+)/i.test(s)) return { kind: 'vk-topic', url: u };
  return null;
}

function getVkWebAppUrl_() {
  if (typeof VK_PARSER_URL === 'undefined' || !VK_PARSER_URL) {
    throw new Error('Не задан VK_PARSER_URL');
  }
  return String(VK_PARSER_URL).replace(/\/$/, '');
}

function getVkTokenLocal_() {
  return PropertiesService.getScriptProperties().getProperty('VK_TOKEN') || '';
}

function collectVkAlbum_(albumUrl, offset, limit) {
  var base = getVkWebAppUrl_();
  var take = Math.max(0, limit || OCR_BATCH_LIMIT);
  var url = base + '?action=parseAlbum&url=' + encodeURIComponent(albumUrl) + '&limit=' + take + '&offset=' + (offset || 0);
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  var code = resp.getResponseCode();
  var data = null;
  try { data = JSON.parse(resp.getContentText()); } catch (e) {}
  if (code >= 300 || (data && data.error)) {
    addLog('VK album via web-app failed: HTTP ' + code + (data && data.error ? ('; error=' + data.error) : ''), 'WARN');
    var hasLocalToken = !!getVkTokenLocal_();
    if (hasLocalToken) {
      addLog('Attempt direct photos.get fallback (local VK_TOKEN present)', 'INFO');
      return fetchVkAlbumDirect_(albumUrl, offset || 0, take);
    } else {
      addLog('Skip direct fallback: VK_TOKEN not set in this script — web app is authoritative', 'INFO');
      return { images: [], texts: [], hasMore: false, nextOffset: offset || 0 };
    }
  }
  var imgs = [];
  if (data && data.images && data.images.length) {
    for (var i = 0; i < data.images.length && imgs.length < take; i++) {
      try {
        var u = data.images[i].url || data.images[i];
        var f = UrlFetchApp.fetch(u, { muteHttpExceptions: true, followRedirects: true });
        if (f.getResponseCode() >= 300) continue;
        var b = f.getBlob();
        imgs.push({ mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes()) });
      } catch (e) {}
    }
  }
  var hasMore = !!(data && data.hasMore);
  var nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + (data && data.images ? data.images.length : 0));
  return { images: imgs, texts: [], hasMore: hasMore, nextOffset: nextOffset };
}

function fetchVkAlbumDirect_(albumUrl, offset, limit) {
  var token = getVkTokenLocal_();
  if (!token) {
    addLog('VK album direct fallback requires VK_TOKEN in Script Properties', 'ERROR');
    return { images: [], texts: [], hasMore: false, nextOffset: offset };
  }
  var m = String(albumUrl).match(/vk\.com\/album(-?\d+)_([0-9]+)/i);
  if (!m) { addLog('VK album URL parse failed: ' + albumUrl, 'ERROR'); return { images: [], texts: [], hasMore: false, nextOffset: offset }; }
  var ownerId = parseInt(m[1], 10);
  var albumId = parseInt(m[2], 10);
  var v = '5.131';
  var take = Math.max(1, Math.min(1000, limit || OCR_BATCH_LIMIT));
  var api = 'https://api.vk.com/method/photos.get'
    + '?owner_id=' + ownerId
    + '&album_id=' + albumId
    + '&count=' + take
    + '&offset=' + Math.max(0, offset || 0)
    + '&photo_sizes=1'
    + '&access_token=' + encodeURIComponent(token)
    + '&v=' + v;
  try {
    var r = UrlFetchApp.fetch(api, { muteHttpExceptions: true });
    var code = r.getResponseCode();
    var js = JSON.parse(r.getContentText());
    if (code !== 200 || js.error) {
      addLog('VK photos.get error: HTTP ' + code + (js && js.error ? ('; ' + js.error.error_msg) : ''), 'ERROR');
      return { images: [], texts: [], hasMore: false, nextOffset: offset };
    }
    var resp = js.response || {};
    var items = resp.items || [];
    var total = resp.count || (offset + items.length);
    var images = [];
    for (var i = 0; i < items.length && images.length < take; i++) {
      var ph = items[i];
      var sizes = ph.sizes || [];
      var best = null;
      for (var k = 0; k < sizes.length; k++) {
        var s = sizes[k];
        if (!best || (s.width * s.height > best.width * best.height)) best = s;
      }
      if (best && best.url) {
        try {
          var f = UrlFetchApp.fetch(best.url, { muteHttpExceptions: true, followRedirects: true });
          if (f.getResponseCode() >= 300) continue;
          var b = f.getBlob();
          images.push({ mimeType: b.getContentType() || 'image/jpeg', data: Utilities.base64Encode(b.getBytes()) });
        } catch (e) {}
      }
    }
    var hasMore = (offset + items.length) < total;
    var nextOffset = (offset || 0) + items.length;
    return { images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset };
  } catch (e) {
    addLog('VK album direct fallback exception: ' + e.message, 'ERROR');
    return { images: [], texts: [], hasMore: false, nextOffset: offset };
  }
}

function collectVkDiscussion_(topicUrl, offset, limit) {
  var base = getVkWebAppUrl_();
  var take = Math.max(0, limit || OCR_BATCH_LIMIT);
  var resp = UrlFetchApp.fetch(base + '?action=parseDiscussion&url=' + encodeURIComponent(topicUrl) + '&limit=' + take + '&offset=' + (offset || 0), { muteHttpExceptions: true, followRedirects: true });
  var code = resp.getResponseCode();
  if (code >= 300) { addLog('VK topic HTTP ' + code, 'WARN'); return { images: [], texts: [], hasMore: false, nextOffset: offset || 0 }; }
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t){ return String(t||'').trim(); }).filter(function(t){ return !!t; }).slice(0, take);
  var hasMore = !!(data && data.hasMore);
  var nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + texts.length);
  return { images: [], texts: texts, hasMore: hasMore, nextOffset: nextOffset };
}

function collectVkReviews_(reviewsUrl, offset, limit) {
  var base = getVkWebAppUrl_();
  var take = Math.max(0, limit || OCR_BATCH_LIMIT);
  var resp = UrlFetchApp.fetch(base + '?action=parseReviews&url=' + encodeURIComponent(reviewsUrl) + '&limit=' + take + '&offset=' + (offset || 0), { muteHttpExceptions: true, followRedirects: true });
  var code = resp.getResponseCode();
  if (code >= 300) { addLog('VK reviews HTTP ' + code, 'WARN'); return { images: [], texts: [], hasMore: false, nextOffset: offset || 0 }; }
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t){ return String(t||'').trim(); }).filter(function(t){ return !!t; }).slice(0, take);
  var hasMore = !!(data && data.hasMore);
  var nextOffset = (data && data.nextOffset != null) ? data.nextOffset : ((offset || 0) + texts.length);
  return { images: [], texts: texts, hasMore: hasMore, nextOffset: nextOffset };
}
// Standalone OCR runner (do not touch review.gs)
// Exported function to assign on a drawing button: ocrRun

var OCR2_BATCH_LIMIT = 50;
var OCR2_CHUNK_SIZE = 8; // разовая порция картинок на один запрос к модели (уменьшает риск усечения ответа)

function ocrRun() {
  var ui = SpreadsheetApp.getUi();
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('Отзывы');
  if (!sh) { ui.alert('Лист "Отзывы" не найден'); return; }

  var lastRow = Math.max(2, sh.getLastRow());
  var processed = 0, empty = 0, errors = 0, skipped = 0;
  var overwrite = (typeof getOcrOverwrite_ === 'function') ? getOcrOverwrite_() : false;
  log_('▶️ V2 start: rows=' + lastRow + ', overwrite=' + overwrite + ', limit=' + OCR2_BATCH_LIMIT, 'INFO');

  for (var r = 2; r <= lastRow; r++) {
    try {
      var rangeA = sh.getRange(r, 1);
      var textVal = String(rangeA.getDisplayValue() || '').trim();
      var formula = String(rangeA.getFormula() || '');
      var rich = null, richUrl = '';
      try { rich = rangeA.getRichTextValue(); richUrl = firstLinkFromRichV2_(rich); } catch (_) {}
      log_('V2 row ' + r + ': A-text="' + String(textVal).slice(0,120) + '" richUrl="' + richUrl + '" formula="' + String(formula).slice(0,120) + '"', 'DEBUG');

      if (!textVal && !formula && !richUrl) { empty++; continue; }

      var bVal = String(sh.getRange(r, 2).getDisplayValue() || '').trim();
      if (!overwrite && bVal) { skipped++; continue; }

      var sources = extractSourcesV2_(textVal, formula, richUrl);
      log_('V2 row ' + r + ': sources=' + (sources.map(function(s){return s.kind+':' + (s.id||s.url||'');}).join(' | ') || 'none'), 'DEBUG');
      if (!sources.length) { log_('⚠️ V2: нет источников в A' + r, 'WARN'); empty++; continue; }

      var writeRow = bVal ? findNextWriteRowV2_(sh, r) : r;
      var remainingCap = OCR2_BATCH_LIMIT;
      var batchImages = [];
      var texts = [];

      for (var i = 0; i < sources.length && remainingCap > 0; i++) {
        var src = sources[i];
        log_('V2 row ' + r + ': collect kind=' + src.kind + ' key=' + (src.id||src.url||'') + ' cap=' + remainingCap, 'DEBUG');
        try {
          var part = collectFromSourceV2_(src, remainingCap);
          var addedText = 0;
          if (part.texts && part.texts.length) { texts = texts.concat(part.texts); addedText = part.texts.length; }
          remainingCap = Math.max(0, remainingCap - addedText);
          if (part.images && part.images.length) {
            var imageRoom = Math.max(0, OCR2_BATCH_LIMIT - texts.length - batchImages.length);
            if (imageRoom > 0) {
              var toTake = Math.min(imageRoom, part.images.length);
              batchImages = batchImages.concat(part.images.slice(0, toTake));
            }
          }
        } catch (e) { errors++; log_('❌ V2 collect error row ' + r + ': ' + e.message, 'ERROR'); }
      }

      if (!texts.length && !batchImages.length) { log_('V2 row ' + r + ': nothing collected', 'DEBUG'); empty++; continue; }

      var remainingOut = Math.max(0, OCR2_BATCH_LIMIT - texts.length);
      if (batchImages.length && remainingOut > 0) {
        try {
          var imgs = batchImages.slice(0, remainingOut);
          for (var p = 0; p < imgs.length && remainingOut > 0; p += OCR2_CHUNK_SIZE) {
            var sub = imgs.slice(p, Math.min(p + OCR2_CHUNK_SIZE, imgs.length));
            var out = serverGmOcrBatchV2_(sub, 'ru');
            var arr = splitBySeparatorV2_(out);
            if (!arr || !arr.length) {
              // хард-фоллбек: по одному в чанке
              log_('V2 row ' + r + ': chunk ' + (p/OCR2_CHUNK_SIZE) + ' empty → fallback per-image (' + sub.length + ' imgs)', 'WARN');
              for (var si = 0; si < sub.length && remainingOut > 0; si++) {
                try {
                  var bb = Utilities.newBlob(Utilities.base64Decode(sub[si].data), sub[si].mimeType || 'image/png', 'img');
                  var tt = gmOcrFromBlobV2_(bb, 'ru');
                  tt = String(tt||'').trim();
                  if (tt) { texts.push(tt); remainingOut--; }
                } catch (e4) { log_('V2 row ' + r + ': per-image fallback error: ' + e4.message, 'ERROR'); }
              }
            } else {
              var take = Math.min(remainingOut, arr.length);
              texts = texts.concat(arr.slice(0, take));
              remainingOut -= take;
              log_('V2 row ' + r + ': chunk size=' + sub.length + ' → got ' + arr.length + ' parts, taken=' + take + ', cap left=' + remainingOut, 'DEBUG');
            }
          }
        } catch (e2) {
          errors++; log_('❌ V2 OCR batch error row ' + r + ': ' + e2.message, 'ERROR');
          // fallback по одному
          try {
            for (var j = 0; j < Math.min(remainingOut, batchImages.length); j++) {
              var b = Utilities.newBlob(Utilities.base64Decode(batchImages[j].data), batchImages[j].mimeType || 'image/png', 'img');
              var t = gmOcrFromBlobV2_(b, 'ru');
              if (t && String(t).trim()) texts.push(String(t).trim());
            }
          } catch (e3) { log_('❌ V2 OCR fallback error row ' + r + ': ' + e3.message, 'ERROR'); }
        }
      }

      if (!texts.length) { log_('V2 row ' + r + ': texts empty after OCR', 'DEBUG'); empty++; continue; }

      if (texts.length > 1) { sh.insertRowsAfter(writeRow, texts.length - 1); lastRow += (texts.length - 1); }
      var matrix = texts.map(function(x){ return [x]; });
      sh.getRange(writeRow, 2, texts.length, 1).setValues(matrix);
      if (texts.length > 1 && writeRow === r) { r += (texts.length - 1); }
      processed++;
      log_('V2 row ' + r + ': wrote ' + texts.length + ' lines to B, next start row calc ok', 'DEBUG');
      Utilities.sleep(120);
    } catch (e) {
      errors++; log_('❌ V2 row error ' + r + ': ' + e.message, 'ERROR');
    }
  }

  ui.alert('OCR V2 завершён', 'Строк обработано: ' + processed + '\nПропущено (B уже заполнено): ' + skipped + '\nПустых: ' + empty + '\nОшибок: ' + errors + '\n\nЛимит: ' + OCR2_BATCH_LIMIT + ' за запуск.', ui.ButtonSet.OK);
}

// ---------- Helpers ----------
function log_(msg, level) { try { if (typeof addLog === 'function') addLog(msg, level || 'INFO'); else console.log((level||'INFO')+': '+msg); } catch (_) {} }

function findNextWriteRowV2_(sh, r) {
  try {
    var last = Math.max(r, sh.getLastRow());
    var row = r;
    var b0 = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
    if (!b0) return row; row++;
    while (row <= last) {
      var a = String(sh.getRange(row, 1).getDisplayValue() || '').trim();
      var b = String(sh.getRange(row, 2).getDisplayValue() || '').trim();
      if (a) break; if (b) row++; else break;
    }
    return row;
  } catch (e) { return r; }
}

function firstLinkFromRichV2_(rich) {
  try {
    if (!rich) return '';
    var idxs = rich.getTextStyleIndices();
    if (idxs && idxs.length) {
      for (var i = 0; i < idxs.length; i++) {
        var st = rich.getTextStyle(idxs[i]);
        var lu = st && st.getLinkUrl && st.getLinkUrl();
        if (lu) return String(lu).trim();
      }
    }
    var lu2 = rich.getLinkUrl && rich.getLinkUrl();
    if (lu2) return String(lu2).trim();
    var ts = rich.getTextStyle && rich.getTextStyle();
    var lu3 = ts && ts.getLinkUrl && ts.getLinkUrl();
    if (lu3) return String(lu3).trim();
  } catch (e) {}
  return '';
}

function extractSourcesV2_(textVal, formula, richUrl) {
  var list = [];
  function push(u){ if (!u) return; var n = normalizeUrlV2_(u); if (!n) return; list.push(classifyV2_(n)); }

  if (richUrl) push(richUrl);

  if (formula) {
    var f = String(formula).trim();
    var mImg = f.match(/^=\s*(?:IMAGE|ИЗОБРАЖЕНИЕ)\s*\(\s*(["'])([^"']+)\1/i);
    if (mImg) push(mImg[2]);
    var mHyp = f.match(/^=\s*(?:HYPERLINK|ГИПЕРССЫЛКА)\s*\(\s*(["'])([^"']+)\1/i);
    if (mHyp) push(mHyp[2]);
  }

  try {
    var cleaned = cleanTextForUrlsV2_(String(textVal||''));
    (cleaned.match(/https?:\/\/[^\s<>\)\]"]+/g) || []).forEach(function(s){ push(s.replace(/[),.;]+$/, '')); });
    (cleaned.match(/(?:^|\s)(?:vk\.com|drive\.google\.com|docs\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\/[^
\s<>\)\]"]+/gi) || [])
      .forEach(function(s){ push(String(s).trim()); });
  } catch (e) { log_('V2 extract: text scan error: ' + e.message, 'WARN'); }

  // uniq
  var seen = {};
  list = list.filter(function(s){ var k = s.kind+':' + (s.url||s.id); if (seen[k]) return false; seen[k]=true; return true; });
  return list;
}

function normalizeUrlV2_(u){
  try {
    var s = String(u||'').trim(); if (!s) return '';
    // убрать любые html-теги, если затесались
    s = cleanTextForUrlsV2_(s);
    // убрать явные угловые скобки по краям
    s = s.replace(/^<+|>+$/g, '');
    if (/^https?:\/\//i.test(s)) return s;
    if (/^www\./i.test(s)) return 'https://'+s;
    if (/^(vk\.com|drive\.google\.com|yadi\.sk|disk\.yandex\.(?:ru|com)|dropbox\.com|script\.google\.com|script\.googleusercontent\.com)\//i.test(s)) return 'https://'+s;
    return s;
  } catch(e){ return String(u||''); }
}

function classifyV2_(u){
  // direct VK
  if (/vk\.com\/reviews-\d+/i.test(u)) return { kind: 'vk-reviews', url: u };
  if (/vk\.com\/album-?\d+_\d+/i.test(u)) return { kind: 'vk-album', url: u };
  if (/vk\.com\/topic-?\d+_\d+/i.test(u)) return { kind: 'vk-topic', url: u };
  // parser webapp URLs
  if (/script\.google(?:usercontent)?\.com\//i.test(u)) {
    var act = getParamV2_(u, 'action');
    var inner = getParamV2_(u, 'url');
    if (act && inner) {
      var innerUrl = decodeURIComponent(inner);
      if (/^parseAlbum$/i.test(act)) return { kind: 'vk-album', url: innerUrl };
      if (/^parseDiscussion$/i.test(act)) return { kind: 'vk-topic', url: innerUrl };
      if (/^parseReviews$/i.test(act)) return { kind: 'vk-reviews', url: innerUrl };
    }
    // иначе попробуем забрать JSON как готовый результат
    return { kind: 'vk-webjson', url: u };
  }
  // Google Drive
  var gd = detectDriveLinkV2_(u);
  if (gd && gd.type === 'folder') return { kind: 'drive-folder', id: gd.id };
  if (gd && gd.type === 'file') return { kind: 'drive-file', id: gd.id };
  // Yandex / Dropbox
  if (/yadi\.sk\//i.test(u) || /disk\.yandex\.(ru|com)\//i.test(u)) return { kind: 'yadisk', url: u };
  if (/dropbox\.com\//i.test(u)) return { kind: 'dropbox-file', url: u };
  return { kind: 'url', url: u };
}

function getParamV2_(url, name){ try { var re = new RegExp('[?&]'+name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')+'=([^&#]*)','i'); var m = String(url).match(re); return m?m[1]:''; } catch(e){ return ''; } }

function detectDriveLinkV2_(url){
  try {
    var u = String(url||'');
    var m1 = u.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/); if (m1) return { type:'folder', id:m1[1] };
    var m2 = u.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/); if (m2) return { type:'file', id:m2[1] };
    var m3 = u.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m3) return { type:'file', id:m3[1] };
    // docs.google.com/uc?export=download&id=... или open?id=...
    if (/docs\.google\.com\//i.test(u)) {
      var md = u.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (md) return { type:'file', id: md[1] };
    }
    return null;
  } catch(e){ return null; }
}

function collectFromSourceV2_(src, cap){
  if (src.kind === 'vk-webjson') return collectVkWebJsonV2_(src.url, cap);
  if (src.kind === 'vk-album') return collectVkAlbumViaWebV2_(src.url, 0, cap);
  if (src.kind === 'vk-topic') return collectVkDiscussionViaWebV2_(src.url, 0, cap);
  if (src.kind === 'vk-reviews') return collectVkReviewsViaWebV2_(src.url, 0, cap);
  if (src.kind === 'drive-folder') return enumerateDriveFolderImagesV2_(src.id, 0, cap);
  if (src.kind === 'drive-file') {
    try {
      var file = DriveApp.getFileById(src.id);
      var blob = file.getBlob();
      var mt = String(blob.getContentType()||'').toLowerCase();
      if (mt.indexOf('image/') !== 0) { log_('V2 drive-file not image, contentType=' + mt, 'WARN'); return { images: [], texts: [], hasMore:false, nextOffset:1 }; }
      return { images: [{ mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes()) }], texts: [], hasMore:false, nextOffset:1 };
    } catch (e) {
      throw new Error('Drive file error: ' + e.message);
    }
  }
  if (src.kind === 'yadisk') return collectYandexPublicV2_(src.url, 0, cap);
  if (src.kind === 'dropbox-file') {
    var dl = toDropboxDirectV2_(src.url); var resp = UrlFetchApp.fetch(dl, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() >= 300) throw new Error('Dropbox HTTP ' + resp.getResponseCode());
    var bb = resp.getBlob();
    return { images: [{ mimeType: bb.getContentType()||'image/png', data: Utilities.base64Encode(bb.getBytes()) }], texts: [], hasMore:false, nextOffset:1 };
  }
  if (src.kind === 'url') {
    var bl = fetchImageToBlobWithHeadersV2_(src.url);
    if (!bl) throw new Error('HTTP_FETCH_FAILED');
    var mt = String(bl.getContentType()||'').toLowerCase();
    if (mt.indexOf('image/') !== 0) { log_('V2 url not image, contentType=' + mt + ' url=' + src.url.slice(0,80), 'DEBUG'); return { images: [], texts: [], hasMore:false, nextOffset:0 }; }
    return { images: [{ mimeType: bl.getContentType()||'image/png', data: Utilities.base64Encode(bl.getBytes()) }], texts: [], hasMore:false, nextOffset:1 };
  }
  return { images: [], texts: [], hasMore:false, nextOffset:0 };
}

// ----- VK via Web JSON (direct link to web-app/echo)
function collectVkWebJsonV2_(url, cap){
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions:true, followRedirects:true });
  var code = resp.getResponseCode(); if (code >= 300) throw new Error('VK webjson HTTP '+code);
  var data = null; try { data = JSON.parse(resp.getContentText()); } catch(e){ throw new Error('VK webjson parse'); }
  var images = []; var texts = [];
  if (data && data.images && data.images.length) {
    for (var i=0;i<data.images.length && images.length<cap;i++) {
      try {
        var u = data.images[i].url || data.images[i];
        var b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) { log_('V2 VK webjson image fetch failed for url=' + String(u).slice(0,160), 'WARN'); continue; }
        var mt = String(b.getContentType()||'').toLowerCase();
        if (mt.indexOf('image/') !== 0) { log_('V2 VK webjson non-image contentType=' + mt, 'WARN'); continue; }
        images.push({ mimeType: b.getContentType()||'image/jpeg', data: Utilities.base64Encode(b.getBytes()) });
      } catch (_) {}
    }
  }
  if (data && data.texts && data.texts.length) {
    texts = data.texts.map(function(t){ return String(t||'').trim(); }).filter(Boolean).slice(0, cap);
  }
  return { images: images, texts: texts, hasMore: false, nextOffset: 0 };
}

function getVkParserBaseV2_(){
  try { if (typeof getVkParserUrl_ === 'function') return String(getVkParserUrl_()).replace(/\/$/, ''); } catch(e){}
  try { if (typeof VK_PARSER_URL !== 'undefined' && VK_PARSER_URL) return String(VK_PARSER_URL).replace(/\/$/, ''); } catch(e){}
  throw new Error('Не задан VK_PARSER_URL');
}
function collectVkAlbumViaWebV2_(albumUrl, offset, limit){
  var base = getVkParserBaseV2_(); var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  var req = base + '?action=parseAlbum&url=' + encodeURIComponent(albumUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK album request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, { muteHttpExceptions:true, followRedirects:true });
  var code = resp.getResponseCode(); if (code >= 300) throw new Error('VK album HTTP '+code);
  var data = JSON.parse(resp.getContentText());
  var imgs = [];
  if (data && data.images && data.images.length) {
    for (var i=0;i<data.images.length && imgs.length<take;i++){
      try {
        var u = data.images[i].url || data.images[i];
        if (i < 3) log_('V2 VK album image['+i+'] url=' + String(u).slice(0,200), 'DEBUG');
        var b = fetchImageToBlobWithHeadersV2_(u);
        if (!b) { log_('V2 VK album image fetch failed for url=' + String(u).slice(0,200), 'WARN'); continue; }
        var mt = String(b.getContentType()||'').toLowerCase();
        if (mt.indexOf('image/') !== 0) { log_('V2 VK album non-image contentType=' + mt, 'WARN'); continue; }
        imgs.push({ mimeType: b.getContentType()||'image/jpeg', data: Utilities.base64Encode(b.getBytes()) });
      } catch(ei){ log_('V2 VK album image error: ' + ei.message, 'WARN'); }
    }
  } else {
    log_('V2 VK album: 0 images from web-app for url=' + albumUrl, 'WARN');
  }
  return { images: imgs, texts: [], hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0 };
}
function collectVkDiscussionViaWebV2_(topicUrl, offset, limit){
  var base = getVkParserBaseV2_(); var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  var req = base + '?action=parseDiscussion&url=' + encodeURIComponent(topicUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK topic request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, { muteHttpExceptions:true, followRedirects:true });
  var code = resp.getResponseCode(); if (code >= 300) throw new Error('VK topic HTTP '+code);
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t){ return String(t||'').trim(); }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK topic: 0 texts from web-app for url=' + topicUrl, 'WARN');
  return { images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0 };
}
function collectVkReviewsViaWebV2_(reviewsUrl, offset, limit){
  var base = getVkParserBaseV2_(); var take = Math.max(1, Math.min(OCR2_BATCH_LIMIT, limit||OCR2_BATCH_LIMIT));
  var req = base + '?action=parseReviews&url=' + encodeURIComponent(reviewsUrl) + '&limit=' + take + '&offset=' + (offset||0);
  log_('V2 VK reviews request: ' + req, 'DEBUG');
  var resp = UrlFetchApp.fetch(req, { muteHttpExceptions:true, followRedirects:true });
  var code = resp.getResponseCode(); if (code >= 300) throw new Error('VK reviews HTTP '+code);
  var data = JSON.parse(resp.getContentText());
  var texts = (data && data.texts) || [];
  texts = texts.map(function(t){ return String(t||'').trim(); }).filter(Boolean).slice(0, take);
  if (!texts.length) log_('V2 VK reviews: 0 texts from web-app for url=' + reviewsUrl, 'WARN');
  return { images: [], texts: texts, hasMore: !!(data && data.hasMore), nextOffset: (data && data.nextOffset != null) ? data.nextOffset : 0 };
}

// ----- Drive helpers (local)
function enumerateDriveFolderImagesV2_(folderId, offset, limit){
  var folder = DriveApp.getFolderById(folderId); var it = folder.getFiles();
  var images = []; var imgIndex = 0;
  while (it.hasNext()) { var f = it.next(); var mt = String(f.getMimeType()||'').toLowerCase(); if (mt.indexOf('image/') !== 0) continue; if (imgIndex < (offset||0)) { imgIndex++; continue; } var blob=f.getBlob(); images.push({ mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes()) }); imgIndex++; if (images.length >= limit) break; }
  var hasMore = it.hasNext(); var nextOffset = (offset||0) + images.length; log_('V2 Drive folder: collected ' + images.length + ' images (offset='+(offset||0)+', limit='+limit+')', 'DEBUG'); return { images: images, texts: [], hasMore: hasMore, nextOffset: nextOffset };
}

// ----- Yandex / Dropbox helpers (local)
function collectYandexPublicV2_(publicUrl, offset, limit){
  var base='https://cloud-api.yandex.net/v1/disk/public/resources'; var download='https://cloud-api.yandex.net/v1/disk/public/resources/download'; var images=[];
  try {
    var res = UrlFetchApp.fetch(base+'?public_key='+encodeURIComponent(publicUrl), { muteHttpExceptions:true, followRedirects:true }); var code = res.getResponseCode(); var data = JSON.parse(res.getContentText()); if (code >= 300) throw new Error('Yandex meta HTTP '+code);
    if (data && data.type==='file') { if (offset && offset>0) return { images:[], texts:[], hasMore:false, nextOffset:offset }; var dl=UrlFetchApp.fetch(download+'?public_key='+encodeURIComponent(publicUrl)).getContentText(); var link=JSON.parse(dl).href; var f=UrlFetchApp.fetch(link,{ muteHttpExceptions:true, followRedirects:true }); var blob=f.getBlob(); images.push({ mimeType: blob.getContentType()||'image/png', data: Utilities.base64Encode(blob.getBytes()) }); return { images:images, texts:[], hasMore:false, nextOffset:1 }; }
    if (data && data.type==='dir') { var pageOffset=0, imgSeen=0, take=Math.max(0, limit||OCR2_BATCH_LIMIT); while (images.length<take){ var meta=UrlFetchApp.fetch(base+'?public_key='+encodeURIComponent(publicUrl)+'&limit=200&offset='+pageOffset,{ muteHttpExceptions:true, followRedirects:true }); var md=JSON.parse(meta.getContentText()); var items=(md && md._embedded && md._embedded.items)||[]; if (!items.length) break; for (var i=0;i<items.length && images.length<take;i++){ var it=items[i]; if (it.type!=='file') continue; var mime=String(it.mime_type||'').toLowerCase(); if (mime.indexOf('image/')!==0) continue; if (imgSeen < (offset||0)) { imgSeen++; continue; } var dl2=UrlFetchApp.fetch(download+'?public_key='+encodeURIComponent(publicUrl)+'&path='+encodeURIComponent(it.path)).getContentText(); var link2=JSON.parse(dl2).href; var f2=UrlFetchApp.fetch(link2,{ muteHttpExceptions:true, followRedirects:true }); var blob2=f2.getBlob(); images.push({ mimeType: blob2.getContentType()||'image/png', data: Utilities.base64Encode(blob2.getBytes()) }); imgSeen++; } pageOffset += items.length; if (items.length<200) break; } var hasMore = images.length >= take; var nextOffset = (offset||0) + images.length; return { images:images, texts:[], hasMore:hasMore, nextOffset:nextOffset }; }
  } catch (e) { log_('⚠️ Yandex error: ' + e.message, 'WARN'); }
  return { images: images, texts: [], hasMore:false, nextOffset:(offset||0)+images.length };
}
function toDropboxDirectV2_(u){ try { var url = u.replace('www.dropbox.com','dl.dropboxusercontent.com'); if (url.indexOf('?dl=0')>=0) url=url.replace('?dl=0','?dl=1'); if (url.indexOf('?dl=1')<0 && url.indexOf('?')<0) url += '?dl=1'; return url; } catch(e){ return u; } }

// ----- Local OCR fallbacks
function gmOcrFromBlobV2_(blob, lang){
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY'); if (!apiKey) throw new Error('Не задан GEMINI_API_KEY');
  var mime = blob.getContentType()||'image/png'; var b64 = Utilities.base64Encode(blob.getBytes());
  var instruction = 'Транскрибируй текст на изображении БЕЗ добавления от себя. Верни только чистый текст. Если изображений несколько — разделяй отзывы строкой из четырёх подчёркиваний: ____ .'+(lang?(' Язык: '+lang+'.'):'');
  var body = { contents: [{ parts: [{ text: instruction }, { inlineData: { mimeType: mime, data: b64 } }] }], generationConfig: { maxOutputTokens: 2048, temperature: 0 } };
  var resp = UrlFetchApp.fetch(GEMINI_API_URL + '?key=' + apiKey, { method:'post', contentType:'application/json', payload: JSON.stringify(body), muteHttpExceptions:true });
  var code = resp.getResponseCode(); var data = JSON.parse(resp.getContentText()); if (code !== 200) { var msg=(data&&data.error&&data.error.message)||('HTTP_'+code); throw new Error('Gemini OCR: '+msg); }
  var cand = data.candidates && data.candidates[0]; var part = cand && cand.content && cand.content.parts && cand.content.parts[0]; var text = part && part.text ? part.text : '';
  return (typeof processGeminiResponse === 'function') ? processGeminiResponse(text) : text;
}
function splitBySeparatorV2_(text){
  var s = String(text||'').trim(); if (!s) return [];
  // основной способ: маркер ____ (четыре и более подчёркиваний) отдельной строкой или в тексте
  var parts = s.split(/\n?_{4,}\n?/g).map(function(x){ return String(x||'').trim(); }).filter(Boolean);
  if (parts.length > 1) return parts;
  // запасной: параграфы
  var parts2 = s.split(/\n{2,}/g).map(function(x){ return String(x||'').trim(); }).filter(Boolean);
  return parts2.length > 1 ? parts2 : [s];
}

function cleanTextForUrlsV2_(s){
  try {
    var t = String(s||'');
    // убрать все теги вида <...>
    t = t.replace(/<[^>]*>/g, ' ');
    // простая декодировка HTML-сущностей для популярных случаев
    t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return t;
  } catch (e) { return String(s||''); }
}

// Локальная версия server OCR call с делимитером "____" (не затрагивает review.gs)
function serverGmOcrBatchV2_(images, lang){
  var email = (typeof getLicenseEmail === 'function') ? getLicenseEmail() : '';
  var token = (typeof getLicenseToken === 'function') ? getLicenseToken() : '';
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var payload = { action: 'gm_image', email: email, token: token, apiKey: apiKey, images: images, lang: lang || 'ru', delimiter: '____' };
  var resp = UrlFetchApp.fetch(SERVER_URL, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  var code = resp.getResponseCode();
  var data = JSON.parse(resp.getContentText());
  if (code !== 200 || !data || !data.ok) throw new Error((data && data.error) || ('HTTP_' + code));
  return data.data || '';
}

// Fetch image with browser-like headers to preserve query string semantics (VK CDN)
function fetchImageToBlobWithHeadersV2_(url) {
  try {
    var opts = {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Referer': 'https://vk.com/'
      }
    };
    var res = UrlFetchApp.fetch(url, opts);
    var code = res.getResponseCode();
    if (code >= 300) return null;
    return res.getBlob();
  } catch (e) {
    return null;
  }
}
