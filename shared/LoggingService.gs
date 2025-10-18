/**
 * Unified Logging Service v1.0
 * Централизованная система логирования для всего проекта
 */

/**
 * addSystemLog() - основная реализация находится в Utils.gs:219
 * Использует CacheService для временного хранения логов
 *
 * Этот файл содержит только вспомогательные функции для логирования
 */

/**
 * Логирование в Google Sheets для критических событий
 * @param {string} logEntry - запись лога
 * @param {string} level - уровень
 */
function logToSheet(logEntry, level) {
  try {
    const ss = SpreadsheetApp.getActive();
    let logSheet = ss.getSheetByName('System Logs');

    if (!logSheet) {
      logSheet = ss.insertSheet('System Logs');
      // Заголовки
      logSheet.getRange('A1:D1').setValues([['Timestamp', 'Level', 'Component', 'Message']]);
      logSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#f1f3f4');
    }

    // Добавляем запись
    const lastRow = logSheet.getLastRow();
    const timestamp = new Date().toISOString();

    // Парсим log entry для извлечения компонентов
    const matches = logEntry.match(/\\[(.*?)\\]\\s+\\[(.*?)\\]\\s+\\[(.*?)\\]\\s+(.*)/);
    if (matches) {
      logSheet.getRange(lastRow + 1, 1, 1, 4).setValues([[
        matches[1], // timestamp
        matches[2], // level
        matches[3], // component
        matches[4], // message
      ]]);

      // Цветовая кодировка по уровням
      const range = logSheet.getRange(lastRow + 1, 1, 1, 4);
      switch (level) {
      case 'CRITICAL':
        range.setBackground('#fce8e6');
        break;
      case 'ERROR':
        range.setBackground('#fef7e0');
        break;
      case 'WARN':
        range.setBackground('#e8f5e8');
        break;
      }
    }

    // Ограничиваем количество записей в листе (максимум 1000)
    if (lastRow > 1000) {
      logSheet.deleteRows(2, lastRow - 1000);
    }
  } catch (error) {
    Logger.log('Sheet logging error: ' + error.message);
  }
}

/**
 * Генератор trace ID для отслеживания запросов
 * @param {string} prefix - префикс ID
 * @return {string} - trace ID
 */
function generateTraceId(prefix) {
  prefix = prefix || 'trace';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Маскировка email для логов (защита PII)
 * @param {string} email - email адрес
 * @return {string} - замаскированный email
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';

  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid_email';

  const username = parts[0];
  const domain = parts[1];

  if (username.length <= 2) {
    return '*'.repeat(username.length) + '@' + domain;
  }

  return username[0] + '*'.repeat(username.length - 2) + username[username.length - 1] + '@' + domain;
}

/**
 * Логирование активности лицензий
 * @param {string} action - действие
 * @param {string} email - email пользователя
 * @param {string} token - токен (будет замаскирован)
 * @param {Object} result - результат проверки
 * @param {string} traceId - trace ID
 */
function logLicenseActivity(action, email, token, result, traceId) {
  const maskedEmail = maskEmail(email);
  const maskedToken = token ? token.substr(0, 6) + '***' : 'null';

  const message = `License check: action=${action}, email=${maskedEmail}, ` +
                `token=${maskedToken}, result=${result.ok ? 'VALID' : 'INVALID'}, ` +
                `reason=${result.error || 'none'}, traceId=${traceId}`;

  addSystemLog(message, 'INFO', 'LICENSE');
}

/**
 * Логирование безопасности и подозрительной активности
 * @param {string} event - тип события
 * @param {Object} context - контекст события
 */
function logSecurityEvent(event, context) {
  let message = `Security event: ${event}`;

  if (context.ip) message += `, ip=${context.ip}`;
  if (context.userAgent) message += `, ua=${context.userAgent}`;
  if (context.email) message += `, user=${maskEmail(context.email)}`;
  if (context.details) message += `, details=${JSON.stringify(context.details)}`;

  addSystemLog(message, 'WARN', 'SECURITY');
}

/**
 * Производительное логирование с throttling
 * @param {string} message - сообщение
 * @param {string} level - уровень
 * @param {string} component - компонент
 * @param {number} throttleMs - интервал throttling в мс
 */
function addSystemLogThrottled(message, level, component, throttleMs) {
  throttleMs = throttleMs || 1000;

  // Создаем ключ для throttling
  const throttleKey = `throttle_${component}_${level}_${message.substr(0, 50)}`;

  try {
    const cache = CacheService.getScriptCache();
    const lastLogged = cache.get(throttleKey);
    const now = Date.now();

    if (lastLogged && (now - parseInt(lastLogged)) < throttleMs) {
      return; // Пропускаем - слишком частые логи
    }

    cache.put(throttleKey, now.toString(), 60); // TTL 1 минута
    addSystemLog(message, level, component);
  } catch (error) {
    // Fallback без throttling
    addSystemLog(message, level, component);
  }
}

/**
 * Bulk логирование для массовых операций
 * @param {Array} entries - массив записей логов
 * @param {boolean} async - асинхронный режим
 */
function addSystemLogsBulk(entries, async) {
  if (!Array.isArray(entries) || entries.length === 0) return;

  const processEntries = function() {
    entries.forEach(function(entry) {
      addSystemLog(entry.message, entry.level, entry.component);
    });
  };

  if (async) {
    // Google Apps Script не поддерживает setTimeout, выполняем синхронно
    processEntries();
  } else {
    processEntries();
  }
}

/**
 * Получение логов из Properties Service
 * @param {string} level - фильтр по уровню
 * @param {string} component - фильтр по компоненту
 * @param {number} limit - лимит записей
 * @return {Array} - массив логов
 */
function getSystemLogs(level, component, limit) {
  limit = limit || 100;

  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    const logs = [];

    Object.keys(allProps).forEach(function(key) {
      if (key.startsWith('log_')) {
        try {
          const logEntry = JSON.parse(allProps[key]);

          // Применяем фильтры
          if (level && logEntry.level !== level) return;
          if (component && logEntry.component !== component) return;

          logs.push(logEntry);
        } catch (e) {
          // Пропускаем невалидные записи
        }
      }
    });

    // Сортируем по времени (новые сверху)
    logs.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return logs.slice(0, limit);
  } catch (error) {
    addSystemLog('Failed to get system logs: ' + error.message, 'ERROR', 'LOGGING');
    return [];
  }
}

/**
 * Очистка старых логов
 * @param {number} daysToKeep - сколько дней хранить логи
 */
function cleanupOldLogs(daysToKeep) {
  daysToKeep = daysToKeep || 30;

  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const keysToDelete = [];

    Object.keys(allProps).forEach(function(key) {
      if (key.startsWith('log_')) {
        try {
          const logEntry = JSON.parse(allProps[key]);
          const logTime = new Date(logEntry.timestamp).getTime();

          if (logTime < cutoffTime) {
            keysToDelete.push(key);
          }
        } catch (e) {
          // Удаляем невалидные записи тоже
          keysToDelete.push(key);
        }
      }
    });

    // Удаляем батчами по 100 (лимит Apps Script)
    for (let i = 0; i < keysToDelete.length; i += 100) {
      const batch = keysToDelete.slice(i, i + 100);
      batch.forEach(function(key) {
        props.deleteProperty(key);
      });
    }

    addSystemLog(`Cleaned up ${keysToDelete.length} old log entries`, 'INFO', 'LOGGING');
  } catch (error) {
    addSystemLog('Failed to cleanup logs: ' + error.message, 'ERROR', 'LOGGING');
  }
}

/**
 * Статистика логирования
 * @return {Object} - статистика
 */
function getLoggingStats() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    const stats = {
      total: 0,
      byLevel: {},
      byComponent: {},
      oldestEntry: null,
      newestEntry: null,
    };

    Object.keys(allProps).forEach(function(key) {
      if (key.startsWith('log_')) {
        try {
          const logEntry = JSON.parse(allProps[key]);
          stats.total++;

          // По уровням
          stats.byLevel[logEntry.level] = (stats.byLevel[logEntry.level] || 0) + 1;

          // По компонентам
          stats.byComponent[logEntry.component] = (stats.byComponent[logEntry.component] || 0) + 1;

          // Временные рамки
          const entryTime = new Date(logEntry.timestamp);
          if (!stats.oldestEntry || entryTime < stats.oldestEntry) {
            stats.oldestEntry = entryTime;
          }
          if (!stats.newestEntry || entryTime > stats.newestEntry) {
            stats.newestEntry = entryTime;
          }
        } catch (e) {
          // Пропускаем невалидные
        }
      }
    });

    return stats;
  } catch (error) {
    addSystemLog('Failed to get logging stats: ' + error.message, 'ERROR', 'LOGGING');
    return {total: 0, error: error.message};
  }
}
