/**
 * LoggingService.gs - Централизованная система логирования
 * Версия: 1.0.0
 *
 * Функции:
 * - addLog() - добавление логов в кэш
 * - getLogs() - получение логов
 * - showLogsDialog() - показ логов в диалоге
 * - exportLogsToSheet() - экспорт логов в лист
 * - clearLogs() - очистка логов
 */

// ====== КОНСТАНТЫ ======
const LOGS_CACHE_KEY = 'SYSTEM_LOGS';
const MAX_LOGS = 300;
const LOGS_TTL = 86400; // 24ч

// ====== ОСНОВНЫЕ ФУНКЦИИ ЛОГИРОВАНИЯ ======
/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
function showLogsDialog() {
  try {
    SpreadsheetApp.getUi().alert('📝 Логи (последние 100)', getLogs(100), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка показа логов: ' + e.message);
  }
}

/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
function clearLogs() {
  try {
    CacheService.getScriptCache().remove(LOGS_CACHE_KEY);
    addLog('✅ Логи очищены', 'INFO');
    SpreadsheetApp.getUi().alert('Информация', 'Логи очищены.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

