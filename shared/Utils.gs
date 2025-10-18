// New/shared/Utils.gs
// Утилиты общего назначения из old/Main.gs

/**
 * 🔄 ATOMIC OPERATIONS SYSTEM для предотвращения data corruption
 */
const ATOMIC_OPERATIONS = {
  maxBackups: 5, // Максимум backup файлов
  backupPrefix: 'atomic_backup_',
};

/**
 * 🔒 Создаёт backup текущего состояния для atomic operations
 */
function createAtomicBackup(sheetName, description) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName(sheetName);

    if (!sourceSheet) {
      throw new Error('Sheet not found: ' + sheetName);
    }

    // Генерируем уникальное имя backup
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const backupName = ATOMIC_OPERATIONS.backupPrefix + sheetName + '_' + timestamp;

    // Создаём backup лист
    const backupSheet = sourceSheet.copyTo(ss);
    backupSheet.setName(backupName);
    backupSheet.setTabColor('#ffeb3b'); // Желтый для backup

    // Добавляем метаданные в backup
    if (backupSheet.getLastRow() === 0) {
      backupSheet.appendRow(['=== ATOMIC BACKUP ===']);
    }
    backupSheet.getRange(1, backupSheet.getLastColumn() + 1).setValue('Backup: ' + description);
    backupSheet.getRange(1, backupSheet.getLastColumn()).setValue('Created: ' + new Date().toLocaleString());

    addSystemLog('✅ Atomic backup created: ' + backupName, 'INFO', 'ATOMIC');

    // Очищаем старые backups
    cleanupOldBackups();

    return {
      backupName: backupName,
      sheetName: sheetName,
      timestamp: timestamp,
    };
  } catch (error) {
    addSystemLog('❌ Failed to create atomic backup: ' + error.message, 'ERROR', 'ATOMIC');
    throw error;
  }
}

/**
 * 🧹 Очистка старых backup файлов
 */
function cleanupOldBackups() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allSheets = ss.getSheets();
    const backupSheets = [];

    // Находим все backup листы
    allSheets.forEach(function(sheet) {
      if (sheet.getName().startsWith(ATOMIC_OPERATIONS.backupPrefix)) {
        backupSheets.push({
          sheet: sheet,
          name: sheet.getName(),
        });
      }
    });

    // Сортируем по времени (новые в конце)
    backupSheets.sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });

    // Удаляем старые backups
    if (backupSheets.length > ATOMIC_OPERATIONS.maxBackups) {
      const toDelete = backupSheets.slice(0, backupSheets.length - ATOMIC_OPERATIONS.maxBackups);
      toDelete.forEach(function(backup) {
        try {
          ss.deleteSheet(backup.sheet);
          addSystemLog('🗑️ Old backup removed: ' + backup.name, 'INFO', 'ATOMIC');
        } catch (e) {
          addSystemLog('⚠️ Failed to remove backup: ' + backup.name, 'WARN', 'ATOMIC');
        }
      });
    }
  } catch (error) {
    addSystemLog('❌ Backup cleanup failed: ' + error.message, 'ERROR', 'ATOMIC');
  }
}

/**
 * 🔄 Восстанавливает данные из backup
 */
function restoreFromBackup(backupInfo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSheet = ss.getSheetByName(backupInfo.backupName);

    if (!backupSheet) {
      throw new Error('Backup sheet not found: ' + backupInfo.backupName);
    }

    const targetSheet = ss.getSheetByName(backupInfo.sheetName);
    if (!targetSheet) {
      throw new Error('Target sheet not found: ' + backupInfo.sheetName);
    }

    // Очищаем target sheet
    targetSheet.clear();

    // Копируем данные из backup (исключая метаданные)
    const lastRow = backupSheet.getLastRow();
    const lastCol = backupSheet.getLastColumn() - 2; // Исключаем 2 колонки метаданных

    if (lastRow > 0 && lastCol > 0) {
      const sourceRange = backupSheet.getRange(1, 1, lastRow, lastCol);
      const targetRange = targetSheet.getRange(1, 1, lastRow, lastCol);
      sourceRange.copyTo(targetRange);
    }

    addSystemLog('✅ Restored from backup: ' + backupInfo.backupName, 'INFO', 'ATOMIC');

    return true;
  } catch (error) {
    addSystemLog('❌ Restore from backup failed: ' + error.message, 'ERROR', 'ATOMIC');
    throw error;
  }
}

/**
 * 🗑️ Удаляет backup после успешной операции
 */
function clearBackup(backupInfo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const backupSheet = ss.getSheetByName(backupInfo.backupName);

    if (backupSheet) {
      ss.deleteSheet(backupSheet);
      addSystemLog('🗑️ Backup cleared: ' + backupInfo.backupName, 'INFO', 'ATOMIC');
    }
  } catch (error) {
    addSystemLog('⚠️ Failed to clear backup: ' + error.message, 'WARN', 'ATOMIC');
  }
}

/**
 * Markdown → читабельный текст
 * Перенесено из old/Main.gs - критически важная функция для OCR
 */
function convertMarkdownToReadableText(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') return markdownText;

  let text = markdownText;

  try {
    // Блоки кода
    text = text.replace(/```[\w]*\n?([\s\S]*?)\n?```/g, function(match, code) {
      return '\n' + String(code || '').trim() + '\n';
    });

    // Инлайн код
    text = text.replace(/`([^`]+)`/g, '$1');

    // Жирный текст
    text = text.replace(/\*\*([^*]+)\*\*/g, function(match, content) {
      return String(content || '').toUpperCase();
    });

    // Курсив
    text = text.replace(/\*([^*]+)\*/g, '$1');

    // Заголовки
    text = text.replace(/^#{1,6}\s+(.+)$/gm, function(match, header) {
      return '\n' + String(header || '').toUpperCase() + ':\n';
    });

    // Списки
    text = text.replace(/^[\*\-\+]\s+(.+)$/gm, '• $1');
    text = text.replace(/^\d+\.\s+(.+)$/gm, '$1');

    // Ссылки
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

    // Цитаты
    text = text.replace(/^>\s+(.+)$/gm, '» $1');

    // Горизонтальные линии
    text = text.replace(/^-{3,}$/gm, '---');

    // Множественные переносы строк
    text = text.replace(/\n{3,}/g, '\n\n');

    // Trim
    text = text.trim();
  } catch (e) {
    Logger.log('Markdown conversion error: ' + e.message);
    return markdownText; // Возвращаем оригинал в случае ошибки
  }

  return text;
}

/**
 * Расширенное логирование с кэшированием
 * Перенесено и адаптировано из old/Main.gs
 */
function addSystemLog(message, level, category) {
  level = level || 'INFO';
  category = category || 'SYSTEM';

  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = SYSTEM_LOGS_NAME;
    const maxLogs = 300;
    const ttl = 86400; // 24 часа

    let logs = cache.get(cacheKey);
    logs = logs ? JSON.parse(logs) : [];

    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    logs.push({
      timestamp: timestamp,
      level: level,
      category: category,
      message: message,
    });

    // Ограничиваем количество логов
    if (logs.length > maxLogs) {
      logs = logs.slice(-maxLogs);
    }

    cache.put(cacheKey, JSON.stringify(logs), ttl);

    // Дублируем в логи (Google Apps Script compatible)
    Logger.log('[' + timestamp + '] ' + level + ' [' + category + '] ' + message);
  } catch (e) {
    Logger.log('System log error: ' + e.message);
  }
}

/**
 * Получение системных логов
 */
function getSystemLogs(limit, level, category) {
  limit = limit || 100;

  try {
    const cache = CacheService.getScriptCache();
    const logs = cache.get(SYSTEM_LOGS_NAME);

    if (!logs) return 'Логи отсутствуют';

    let logEntries = JSON.parse(logs);

    // Фильтрация по уровню
    if (level) {
      logEntries = logEntries.filter(function(entry) {
        return entry.level === level;
      });
    }

    // Фильтрация по категории
    if (category) {
      logEntries = logEntries.filter(function(entry) {
        return entry.category === category;
      });
    }

    // Берем последние записи
    const recent = logEntries.slice(-limit);

    return recent.map(function(entry) {
      return '[' + entry.timestamp + '] ' + entry.level + ' [' + entry.category + '] ' + entry.message;
    }).join('\n');
  } catch (e) {
    return 'Ошибка чтения логов: ' + e.message;
  }
}

/**
 * Экспорт логов в лист
 */
function exportSystemLogsToSheet() {
  try {
    const ss = SpreadsheetApp.getActive();
    const sheet = ss.getSheetByName('Системные_Логи') || ss.insertSheet('Системные_Логи');

    const cache = CacheService.getScriptCache();
    const logs = cache.get(SYSTEM_LOGS_NAME);

    if (!logs) {
      SpreadsheetApp.getUi().alert('Системные логи отсутствуют');
      return;
    }

    const logEntries = JSON.parse(logs);
    const data = [['Время', 'Уровень', 'Категория', 'Сообщение']];

    logEntries.forEach(function(entry) {
      data.push([
        entry.timestamp,
        entry.level,
        entry.category,
        entry.message,
      ]);
    });

    // Очищаем и записываем
    sheet.clear();
    sheet.getRange(1, 1, data.length, 4).setValues(data);

    // Форматирование заголовков
    sheet.getRange(1, 1, 1, 4)
      .setFontWeight('bold')
      .setBackground('#E8F0FE');

    // Автоширина колонок
    sheet.autoResizeColumns(1, 4);

    addSystemLog('Системные логи экспортированы в лист "Системные_Логи"', 'INFO', 'UTILS');
    SpreadsheetApp.getUi().alert('Системные логи экспортированы успешно!');
  } catch (e) {
    const error = 'Ошибка экспорта логов: ' + e.message;
    addSystemLog(error, 'ERROR', 'UTILS');
    SpreadsheetApp.getUi().alert(error);
  }
}

/**
 * Очистка системных логов
 */
function clearSystemLogs() {
  try {
    CacheService.getScriptCache().remove(SYSTEM_LOGS_NAME);
    addSystemLog('Системные логи очищены', 'INFO', 'UTILS');
    SpreadsheetApp.getUi().alert('Системные логи очищены');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

/**
 * Утилита для безопасного парсинга JSON
 */
function safeJsonParse(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    Logger.log('JSON parse error: ' + e.message);
    return defaultValue || {};
  }
}

/**
 * Утилита для безопасной сериализации JSON
 */
function safeJsonStringify(obj, defaultValue) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    Logger.log('JSON stringify error: ' + e.message);
    return defaultValue || '{}';
  }
}

/**
 * Проверка валидности email
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Генерация случайного ID
 */
function generateTraceId(prefix) {
  prefix = prefix || 'trace';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return prefix + '-' + timestamp + '-' + random;
}
// fetchGeminiWithRetry() - реализация в NetworkRetry.gs


/**
 * Задержка выполнения
 */
function sleep(milliseconds) {
  Utilities.sleep(milliseconds);
}

/**
 * Безопасное получение вложенного свойства объекта
 */
function getNestedProperty(obj, path, defaultValue) {
  if (!obj || !path) return defaultValue;

  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length; i++) {
    if (current === null || current === undefined || !current.hasOwnProperty(keys[i])) {
      return defaultValue;
    }
    current = current[keys[i]];
  }

  return current;
}

/**
 * Форматирование размера файла
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Детекция Markdown текста
 */
function isMarkdownText(text) {
  if (!text || typeof text !== 'string') return false;

  const patterns = [
    /\*\*[^*]+\*\*/, /\*[^*]+\*/, /^#{1,6}\s+/m,
    /^[-*+]\s+/m, /\[.+\]\(.+\)/, /```[\s\S]*?```/, /`[^`]+`/,
  ];

  return patterns.some(function(p) {
    return p.test(text);
  });
}

/**
 * Обработка ответа от Gemini с автопреобразованием Markdown
 */
function processGeminiResponse(response) {
  if (!response) return response;

  if (isMarkdownText(response)) {
    logMessage('📝 Обнаружен Markdown → преобразуем', 'INFO');
    return convertMarkdownToReadableText(response);
  }

  return response;
}

/**
 * Алиас для addSystemLog для обратной совместимости
 * @param {string} message - сообщение
 * @param {string} level - уровень (INFO, WARN, ERROR, DEBUG)
 */
function logMessage(message, level) {
  addSystemLog(message, level || 'INFO', 'SYSTEM');
}

/**
 * Обрезание строки с добавлением "..."
 */
function truncateString(str, maxLength) {
  if (!str || typeof str !== 'string') return '';
  if (str.length <= maxLength) return str;

  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Экранирование HTML символов
 */
function escapeHtml(text) {
  if (!text || typeof text !== 'string') return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    '\'': '&#39;',
  };

  return text.replace(/[&<>"']/g, function(m) {
    return map[m];
  });
}

/**
 * Алиас для серверного логирования
 */
function logServer(message, traceId) {
  const msg = traceId ? '[' + traceId + '] ' + message : message;
  return addSystemLog(msg, 'INFO', 'SERVER');
}

/**
 * Алиас для клиентского логирования
 */
function logClient(message) {
  return addSystemLog(message, 'INFO', 'CLIENT');
}

/**
 * Извлечение источников изображений из ячейки
 * Compatibility wrapper для old code
 */
function extractImageSources(cellData, cellFormula, richTextUrl) {
  const cellMeta = {
    formula: cellFormula || '',
    richTextUrl: richTextUrl || '',
  };

  return extractSources(cellData, cellMeta);
}

/**
 * Debounce функция для ограничения частоты вызовов
 * ПРИМЕЧАНИЕ: Google Apps Script не поддерживает setTimeout
 * Используйте CacheService для throttling вместо debounce
 */
function createDebounce(func, wait) {
  // Google Apps Script не поддерживает setTimeout/clearTimeout
  // Возвращаем обёртку с throttling через Cache

  return function() {
    const context = this;
    const args = arguments;

    const throttleKey = 'debounce_' + func.name + '_' + Date.now();
    const cache = CacheService.getScriptCache();

    // Проверяем был ли недавний вызов
    const lastCall = cache.get(throttleKey);
    if (lastCall) {
      return; // Пропускаем вызов
    }

    // Сохраняем метку времени
    cache.put(throttleKey, Date.now().toString(), Math.ceil(wait / 1000));

    // Выполняем функцию
    return func.apply(context, args);
  };
}
