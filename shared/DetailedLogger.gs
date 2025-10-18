/**
 * Detailed Logger - Подробное логирование в таблицу
 * Создает лист "Логи" с детальной информацией о всех операциях
 * !force_build!
 */

/**
 * Инициализация листа логов
 */
function initLogsSheet() {
  const ss = SpreadsheetApp.getActive();
  let logsSheet = ss.getSheetByName('Логи');

  if (!logsSheet) {
    logsSheet = ss.insertSheet('Логи');

    // Настройка заголовков
    const headers = [
      'Время',
      'Тип',
      'Функция',
      'Операция',
      'Статус',
      'Детали',
      'Ошибка',
      'Длительность (мс)',
    ];

    logsSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Форматирование
    logsSheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4285f4')
      .setFontColor('white');

    // Ширина колонок
    logsSheet.setColumnWidth(1, 150); // Время
    logsSheet.setColumnWidth(2, 80); // Тип
    logsSheet.setColumnWidth(3, 150); // Функция
    logsSheet.setColumnWidth(4, 200); // Операция
    logsSheet.setColumnWidth(5, 100); // Статус
    logsSheet.setColumnWidth(6, 400); // Детали
    logsSheet.setColumnWidth(7, 300); // Ошибка
    logsSheet.setColumnWidth(8, 80); // Длительность

    // Заморозка заголовков
    logsSheet.setFrozenRows(1);
  }

  return logsSheet;
}

/**
 * Добавить лог в таблицу
 *
 * @param {string} type - Тип операции (OCR, IMPORT, GEMINI, SYSTEM, TEST)
 * @param {string} functionName - Имя функции
 * @param {string} operation - Описание операции
 * @param {string} status - Статус (START, SUCCESS, ERROR, SKIP)
 * @param {object} details - Детальная информация (объект)
 * @param {string} error - Сообщение об ошибке (если есть)
 * @param {number} duration - Длительность в мс
 */
function logToSheet(type, functionName, operation, status, details, error, duration) {
  try {
    const logsSheet = initLogsSheet();

    // Форматируем детали
    let detailsStr = '';
    if (details && typeof details === 'object') {
      try {
        detailsStr = JSON.stringify(details);
      } catch (e) {
        detailsStr = String(details);
      }
    } else if (details) {
      detailsStr = String(details);
    }

    // Ограничиваем длину
    if (detailsStr.length > 500) {
      detailsStr = detailsStr.substring(0, 497) + '...';
    }

    const errorStr = error ? String(error).substring(0, 300) : '';

    // Добавляем строку
    const timestamp = new Date().toISOString();
    const row = [
      timestamp,
      type,
      functionName,
      operation,
      status,
      detailsStr,
      errorStr,
      duration || '',
    ];

    logsSheet.appendRow(row);

    // Цветовая кодировка по статусу
    const lastRow = logsSheet.getLastRow();
    const statusCell = logsSheet.getRange(lastRow, 5);

    switch (status) {
    case 'SUCCESS':
      statusCell.setBackground('#d4edda').setFontColor('#155724');
      break;
    case 'ERROR':
      statusCell.setBackground('#f8d7da').setFontColor('#721c24');
      break;
    case 'SKIP':
      statusCell.setBackground('#fff3cd').setFontColor('#856404');
      break;
    case 'START':
      statusCell.setBackground('#d1ecf1').setFontColor('#0c5460');
      break;
    }

    // Ограничиваем количество строк (последние 1000)
    if (lastRow > 1001) {
      logsSheet.deleteRows(2, lastRow - 1001);
    }
  } catch (e) {
    // Fallback к обычному Logger если не получилось записать в таблицу
    Logger.log('logToSheet error: ' + e.message);
    Logger.log('Log: ' + type + ' | ' + functionName + ' | ' + operation + ' | ' + status);
  }
}

/**
 * Класс для удобного логирования операций с таймером
 */
function OperationLogger(type, functionName, operation) {
  this.type = type;
  this.functionName = functionName;
  this.operation = operation;
  this.startTime = new Date().getTime();
  this.details = {};

  // Логируем начало
  logToSheet(type, functionName, operation, 'START', null, null, 0);

  /**
   * Добавить детали
   */
  this.addDetails = function(key, value) {
    this.details[key] = value;
    return this;
  };

  /**
   * Завершить с успехом
   */
  this.success = function(additionalDetails) {
    const duration = new Date().getTime() - this.startTime;
    const allDetails = Object.assign({}, this.details, additionalDetails || {});
    logToSheet(this.type, this.functionName, this.operation, 'SUCCESS', allDetails, null, duration);
  };

  /**
   * Завершить с ошибкой
   */
  this.error = function(errorMessage, additionalDetails) {
    const duration = new Date().getTime() - this.startTime;
    const allDetails = Object.assign({}, this.details, additionalDetails || {});
    logToSheet(this.type, this.functionName, this.operation, 'ERROR', allDetails, errorMessage, duration);
  };

  /**
   * Пропустить операцию
   */
  this.skip = function(reason, additionalDetails) {
    const duration = new Date().getTime() - this.startTime;
    const allDetails = Object.assign({}, this.details, additionalDetails || {});
    logToSheet(this.type, this.functionName, this.operation, 'SKIP', allDetails, reason, duration);
  };

  return this;
}

/**
 * Очистить старые логи (оставить последние N строк)
 */
function clearOldLogs(keepLast) {
  keepLast = keepLast || 500;

  try {
    const logsSheet = initLogsSheet();
    const lastRow = logsSheet.getLastRow();

    if (lastRow > keepLast + 1) {
      const rowsToDelete = lastRow - keepLast - 1;
      logsSheet.deleteRows(2, rowsToDelete);

      logToSheet('SYSTEM', 'clearOldLogs', 'Clear old logs', 'SUCCESS', {
        deleted: rowsToDelete,
        kept: keepLast,
      }, null, 0);

      return rowsToDelete;
    }

    return 0;
  } catch (e) {
    Logger.log('clearOldLogs error: ' + e.message);
    return -1;
  }
}

/**
 * Экспорт логов в текстовый формат
 */
function exportLogsAsText(limit) {
  limit = limit || 100;

  try {
    const logsSheet = initLogsSheet();
    const lastRow = logsSheet.getLastRow();

    if (lastRow <= 1) {
      return 'Нет логов';
    }

    const startRow = Math.max(2, lastRow - limit + 1);
    const numRows = lastRow - startRow + 1;

    const data = logsSheet.getRange(startRow, 1, numRows, 8).getValues();

    let text = '='.repeat(80) + '\n';
    text += 'ЛОГИ СИСТЕМЫ (последние ' + numRows + ' записей)\n';
    text += '='.repeat(80) + '\n\n';

    data.forEach(function(row) {
      text += '[' + row[0] + '] ' + row[1] + ' | ' + row[2] + '\n';
      text += '  Операция: ' + row[3] + '\n';
      text += '  Статус: ' + row[4];
      if (row[7]) text += ' (' + row[7] + ' мс)';
      text += '\n';
      if (row[5]) text += '  Детали: ' + row[5] + '\n';
      if (row[6]) text += '  ⚠️ Ошибка: ' + row[6] + '\n';
      text += '\n';
    });

    return text;
  } catch (e) {
    return 'Ошибка экспорта логов: ' + e.message;
  }
}

/**
 * UI функция: показать последние логи
 */
function showRecentLogs() {
  const ui = SpreadsheetApp.getUi();
  const text = exportLogsAsText(20);

  // Создаем HTML для лучшего отображения
  const html = '<pre style="font-family: monospace; font-size: 11px; white-space: pre-wrap; word-wrap: break-word;">' +
             text.replace(/</g, '&lt;').replace(/>/g, '&gt;') +
             '</pre>';

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(700)
    .setHeight(600);

  ui.showModalDialog(htmlOutput, 'Последние логи системы');
}

/**
 * UI функция: экспорт и показ логов (для меню тестирования)
 */
function exportAndShowLogs() {
  showRecentLogs();
}

/**
 * UI функция: очистить старые логи
 */
function clearOldLogsUI() {
  const ui = SpreadsheetApp.getUi();

  const result = ui.prompt(
    'Очистка логов',
    'Сколько последних записей оставить? (по умолчанию 500)',
    ui.ButtonSet.OK_CANCEL,
  );

  if (result.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const keepLast = parseInt(result.getResponseText()) || 500;
  const deleted = clearOldLogs(keepLast);

  if (deleted > 0) {
    ui.alert('Логи очищены', 'Удалено ' + deleted + ' старых записей, оставлено ' + keepLast, ui.ButtonSet.OK);
  } else if (deleted === 0) {
    ui.alert('Логи актуальны', 'Нет старых записей для удаления', ui.ButtonSet.OK);
  } else {
    ui.alert('Ошибка', 'Не удалось очистить логи', ui.ButtonSet.OK);
  }
}
