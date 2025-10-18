/**
 * Log Viewer - просмотр системных логов
 * Удобный интерфейс для отладки
 */

/**
 * Показать последние логи в диалоге
 * @param {number} limit - количество записей
 * @param {string} component - фильтр по компоненту (опционально)
 */
function showSystemLogs(limit, component) {
  try {
    limit = limit || 50;
    const ui = SpreadsheetApp.getUi();

    // Получаем логи из Utils.gs
    let logs = getRecentLogs ? getRecentLogs(limit) : [];

    if (logs.length === 0) {
      ui.alert('📋 Логи', 'Логи пусты или система логирования не инициализирована.', ui.ButtonSet.OK);
      return;
    }

    // Фильтруем по компоненту если нужно
    if (component) {
      logs = logs.filter(function(log) {
        return log.component === component;
      });
    }

    // Форматируем для отображения
    const output = [];
    output.push('📋 СИСТЕМНЫЕ ЛОГИ (последние ' + logs.length + ' записей)');
    output.push('=' .repeat(60));
    output.push('');

    logs.forEach(function(log, index) {
      const time = new Date(log.timestamp).toLocaleTimeString('ru-RU');
      const level = log.level;
      const levelIcon = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : level === 'INFO' ? 'ℹ️' : '🔍';

      output.push((index + 1) + '. [' + time + '] ' + levelIcon + ' [' + log.component + ']');
      output.push('   ' + log.message);
      output.push('');
    });

    // Показываем в диалоге
    ui.alert('Системные логи', output.join('\n'), ui.ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка', 'Не удалось загрузить логи: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Показать логи CollectConfig (сохранение и выполнение)
 */
function showCollectConfigLogs() {
  const logs = [];

  // Пробуем получить логи по компонентам
  try {
    const cache = CacheService.getScriptCache();
    const keys = ['COLLECT_CONFIG', 'COLLECT_EXEC'];

    keys.forEach(function(key) {
      for (let i = 0; i < 20; i++) {
        const logKey = 'log_' + key + '_' + i;
        const logData = cache.get(logKey);
        if (logData) {
          try {
            logs.push(JSON.parse(logData));
          } catch (e) {
            // Пропускаем невалидные записи
          }
        }
      }
    });
  } catch (error) {
    // Fallback - показываем ошибку
  }

  if (logs.length === 0) {
    SpreadsheetApp.getUi().alert(
      '📋 Логи AI Конструктора',
      'Логи пусты. Попробуйте:\n\n' +
      '1. Нажать 💾 Сохранить или 🚀 Запустить\n' +
      '2. Открыть консоль браузера (F12)\n' +
      '3. Посмотреть вкладку Console\n\n' +
      '💡 В консоли будут детальные логи!',
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
    return;
  }

  // Сортируем по времени
  logs.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Форматируем
  const output = [];
  output.push('📋 ЛОГИ AI КОНСТРУКТОРА');
  output.push('='.repeat(60));
  output.push('');

  logs.slice(0, 30).forEach(function(log, index) {
    const time = new Date(log.timestamp).toLocaleTimeString('ru-RU');
    const levelIcon = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'INFO' ? 'ℹ️' : '🔍';

    output.push((index + 1) + '. [' + time + '] ' + levelIcon);
    output.push('   ' + log.message);
    output.push('');
  });

  SpreadsheetApp.getUi().alert('Логи AI Конструктора', output.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Экспортировать логи в новый лист
 */
function exportLogsToSheet() {
  try {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Получаем логи
    const logs = getRecentLogs ? getRecentLogs(200) : [];

    if (logs.length === 0) {
      ui.alert('⚠️ Внимание', 'Нет логов для экспорта.', ui.ButtonSet.OK);
      return;
    }

    // Создаём новый лист
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
    const sheetName = 'Логи_' + timestamp;
    const logSheet = ss.insertSheet(sheetName);

    // Заголовки
    logSheet.getRange('A1:E1').setValues([['Timestamp', 'Level', 'Component', 'Message', 'Details']]);
    logSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4285f4').setFontColor('white');

    // Данные
    const data = logs.map(function(log) {
      return [
        log.timestamp,
        log.level,
        log.component,
        log.message,
        log.details || '',
      ];
    });

    logSheet.getRange(2, 1, data.length, 5).setValues(data);

    // Форматирование
    logSheet.setFrozenRows(1);
    logSheet.autoResizeColumns(1, 5);

    // Цветовое кодирование по уровням
    for (let i = 0; i < data.length; i++) {
      const level = data[i][1];
      const range = logSheet.getRange(i + 2, 1, 1, 5);

      if (level === 'ERROR') {
        range.setBackground('#fce8e6');
      } else if (level === 'WARN') {
        range.setBackground('#fef7e0');
      } else if (level === 'DEBUG') {
        range.setBackground('#f1f3f4');
      }
    }

    ui.alert('✅ Успешно', 'Экспортировано ' + logs.length + ' записей\nЛист: ' + sheetName, ui.ButtonSet.OK);

    // Активируем созданный лист
    ss.setActiveSheet(logSheet);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка', 'Не удалось экспортировать логи: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * Очистить все логи
 */
function clearSystemLogs() {
  try {
    const ui = SpreadsheetApp.getUi();

    const response = ui.alert(
      '⚠️ Подтверждение',
      'Вы уверены что хотите очистить ВСЕ логи?\n\nЭто действие необратимо!',
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      return;
    }

    // Очищаем кэш
    const cache = CacheService.getScriptCache();
    cache.removeAll(cache.getKeys());

    ui.alert('✅ Готово', 'Все логи очищены.', ui.ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка', 'Не удалось очистить логи: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
