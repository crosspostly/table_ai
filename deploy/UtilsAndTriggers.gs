/**
 * UtilsAndTriggers.gs - Утилиты и управление триггерами
 * Версия: 1.0.0
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog()
 *
 * Функции:
 * - columnToLetter() / letterToColumn() - преобразование координат
 * - parseTargetA1() - парсинг A1 нотации
 * - convertMarkdownToReadableText() - конвертация Markdown
 * - isMarkdownText() - определение Markdown
 * - processGeminiResponse() - обработка ответа Gemini
 * - cleanupOldTriggers() - очистка триггеров
 * - showActiveTriggersDialog() - показ активных триггеров
 * - refreshSelectedGMTriggers() - обновление GM триггеров
 */

// ====== КОНСТАНТЫ ======
const COMPLETION_PHRASE = 'Отчёт готов';
const DEV_MODE = false; // DEV: показывать DEV-меню/логи

// ====== ПРЕОБРАЗОВАНИЕ КООРДИНАТ ======
/* eslint-disable-next-line no-unused-vars */
function columnToLetter(column) {
  let temp; let letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

/* eslint-disable-next-line no-unused-vars */
function letterToColumn(letters) {
  const s = String(letters || '').toUpperCase().trim();
  let col = 0;
  for (let i = 0; i < s.length; i++) {
    col = col * 26 + (s.charCodeAt(i) - 64);
  }
  return col;
}

/* eslint-disable-next-line no-unused-vars */
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

// ====== MARKDOWN ОБРАБОТКА ======
/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
function isMarkdownText(text) {
  if (!text || typeof text !== 'string') return false;
  const patterns = [
    /\*\*[^*]+\*\*/, /\*[^*]+\*/, /^#{1,6}\s+/m,
    /^[-*+]\s+/m, /\[.+\]\(.+\)/, /```[\s\S]*?```/, /`[^`]+`/,
  ];
  return patterns.some((p) => p.test(text));
}

/* eslint-disable-next-line no-unused-vars */
function processGeminiResponse(response) {
  if (!response) return response;
  if (isMarkdownText(response)) {
    addLog('📝 Обнаружен Markdown → преобразуем', 'INFO');
    return convertMarkdownToReadableText(response);
  }
  return response;
}

// ====== УПРАВЛЕНИЕ ТРИГГЕРАМИ ======
/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
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

// ====== УТИЛИТЫ ПОСЛЕДОВАТЕЛЬНОСТИ ======
/* eslint-disable-next-line no-unused-vars */
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

/* eslint-disable-next-line no-unused-vars */
function isCompletionReady(text) {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  const phrase = getCompletionPhrase();
  const rdy = phrase ? clean.startsWith(phrase) : false;
  addLog(`🔍 Проверка готовности: "${clean.slice(0, 30)}..." против "${phrase}" → ${rdy ? 'ГОТОВО' : 'НЕ ГОТОВО'}`, 'DEBUG');
  return rdy;
}

// =====ШАБЛОННЫЕ УТИЛИТЫ ======
/* eslint-disable-next-line no-unused-vars */
function shareAsTemplate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // Создать копию с очищенными данными, но с кодом
  const copy = ss.copy('VK→Telegram Crossposter Template');

  // URL для пользователей
  const url = `https://docs.google.com/spreadsheets/d/${copy.getId()}/copy`;
  SpreadsheetApp.getUi().alert('Template URL готов:', url);
}

