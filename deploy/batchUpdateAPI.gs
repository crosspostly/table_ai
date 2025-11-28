/**
 * ============================================================================
 * BATCH UPDATE API - SERVER MODULE
 * Перенесено из reniewcell.gs для работы на толстом сервере
 * ============================================================================
 * Версия: 3.1
 */

// ============================================================================
// КОНФИГУРАЦИЯ BATCH-ОПЕРАЦИЙ
// ============================================================================
const BATCH_OPERATIONS = {
  etap1: {
    name: '📋 обновить Презентация',
    startRow: 2,
    endRow: 9,
  },
  etap2_1: {
    name: '📦 обновить Рефлексия (часть 1)',
    startRow: 10,
    endRow: 23,
  },
  etap2_2: {
    name: '🎯 обновить Рефлексия (часть 2)',
    startRow: 24,
    endRow: 36,
  },
  faza1: {
    name: '🎯 обновить Фаза 1',
    startRow: 37,
    endRow: 41,
  },
  archetype: {
    name: '🎯 обновить Архетип',
    startRow: 42,
    endRow: 42,
  },
  common_ca: {
    name: '🎯 обновить ЦА (общая)',
    startRow: 43,
    endRow: 45,
  },
  faza2: {
    name: '🎯 обновить Фаза 2',
    startRow: 46,
    endRow: 53,
  },
  faza3: {
    name: '🎯 обновить фаза 3',
    startRow: 54,
    endRow: 58,
  },
  brendDesign: {
    name: '🎯 обновить Бренд-Дизайн',
    startRow: 59,
    endRow: 62,
  },
  resume: {
    name: '🎯 обновить Итог распаковки',
    startRow: 63,
    endRow: 65,
  },
  analizConc: {
    name: '🎯 обновить Анализ конкурентов',
    startRow: 66,
    endRow: 67,
  },
  analizCA: {
    name: '🎯 обновить Анализ ЦА',
    startRow: 68,
    endRow: 77,
  },
};

// ============================================================================
// ГЛОБАЛЬНЫЙ СЕМАФОР
// ============================================================================
const GLOBAL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 2,
  ACTIVE_REQUESTS: 0,
  QUEUE: [],
  SKIP_FRESH_MINUTES: 10,
  AUTO_RETRY_ENABLED: true,
  AUTO_RETRY_DELAY_MINUTES: 1,
  MAX_AUTO_RETRIES: 3,
};

// ============================================================================
// ОСНОВНЫЕ API ФУНКЦИИ
// ============================================================================

/**
 * Запуск батч-сегмента
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры операции
 * @return {Object} Результат операции
 */
function batchUpdateRunSegment(spreadsheetId, payload) {
  const logs = [];

  try {
    const {operation, sheetName = 'Распаковка'} = payload;

    if (!operation) {
      throw new Error('Не указана операция');
    }

    const config = BATCH_OPERATIONS[operation];
    if (!config) {
      throw new Error('Неизвестная операция: ' + operation);
    }

    logs.push('🚀 Запуск батч-операции: ' + config.name);

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист "' + sheetName + '" не найден');
    }

    const result = batchUpdateProcessRange(ss, sheet, config, logs);

    logs.push('✅ Батч-операция завершена: ' + result.processed + ' ячеек');

    return {
      success: true,
      data: {
        operation: operation,
        name: config.name,
        processed: result.processed,
        errors: result.errors,
        skipped: result.skipped,
        duration: result.duration,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка батч-операции: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Запуск полного обновления
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры обновления
 * @return {Object} Результат обновления
 */
function batchUpdateRunBatch(spreadsheetId, payload) {
  const logs = [];

  try {
    const {operations = Object.keys(BATCH_OPERATIONS), sheetName = 'Распаковка'} = payload;

    logs.push('🔄 Запуск полного обновления: ' + operations.length + ' операций');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист "' + sheetName + '" не найден');
    }

    const results = [];
    let totalProcessed = 0;
    let totalErrors = 0;
    let totalSkipped = 0;

    for (const operation of operations) {
      const config = BATCH_OPERATIONS[operation];
      if (!config) {
        logs.push('⚠️ Пропуск неизвестной операции: ' + operation);
        continue;
      }

      logs.push('📋 Обработка операции: ' + config.name);
      const result = batchUpdateProcessRange(ss, sheet, config, logs);

      results.push({
        operation: operation,
        name: config.name,
        ...result,
      });

      totalProcessed += result.processed;
      totalErrors += result.errors;
      totalSkipped += result.skipped;
    }

    logs.push('✅ Полное обновление завершено: ' + totalProcessed + ' ячеек');

    return {
      success: true,
      data: {
        operations: results,
        totalProcessed: totalProcessed,
        totalErrors: totalErrors,
        totalSkipped: totalSkipped,
        operationsCount: operations.length,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка полного обновления: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Запуск импорта
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры импорта
 * @return {Object} Результат импорта
 */
function batchUpdateRunImport(spreadsheetId, payload) {
  const logs = [];

  try {
    const {source, target, operation = 'import'} = payload;

    if (!source) {
      throw new Error('Не указан источник данных');
    }

    logs.push('📥 Запуск импорта: ' + operation);

    // Здесь будет логика импорта данных
    // Пока возвращаем заглушку
    const result = {
      imported: 10,
      operation: operation,
      source: source,
    };

    logs.push('✅ Импорт завершен');

    return {
      success: true,
      data: result,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка импорта: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Получение статуса батч-операций
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры запроса
 * @return {Object} Статус операций
 */
function batchUpdateGetStatus(spreadsheetId, payload) {
  const logs = [];

  try {
    logs.push('📊 Получение статуса батч-операций');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Распаковка');

    if (!sheet) {
      throw new Error('Лист "Распаковка" не найден');
    }

    const status = {};
    let totalCells = 0;
    let processedCells = 0;

    // Проверяем статус каждой операции
    Object.entries(BATCH_OPERATIONS).forEach(([key, config]) => {
      const range = sheet.getRange(config.startRow, 1, config.endRow - config.startRow + 1, 2);
      const values = range.getValues();

      let processed = 0;
      let total = 0;

      values.forEach((row) => {
        if (row[0]) { // Есть формула в колонке A
          total++;
          if (row[1]) { // Есть результат в колонке B
            processed++;
          }
        }
      });

      status[key] = {
        name: config.name,
        total: total,
        processed: processed,
        pending: total - processed,
        progress: total > 0 ? Math.round((processed / total) * 100) : 0,
      };

      totalCells += total;
      processedCells += processed;
    });

    const overallStatus = {
      total: totalCells,
      processed: processedCells,
      pending: totalCells - processedCells,
      progress: totalCells > 0 ? Math.round((processedCells / totalCells) * 100) : 0,
      operations: status,
    };

    logs.push('✅ Статус получен: ' + processedCells + '/' + totalCells + ' ячеек');

    return {
      success: true,
      data: overallStatus,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка получения статуса: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

// ============================================================================
// ВСПомогательные функции
// ============================================================================

/**
 * Обработка диапазона ячеек
 * @param {Spreadsheet} ss - Таблица
 * @param {Sheet} sheet - Лист
 * @param {Object} config - Конфигурация операции
 * @param {Array} logs - Массив для логов
 * @return {Object} Результат обработки
 */
function batchUpdateProcessRange(ss, sheet, config, logs) {
  const startTime = Date.now();
  let processed = 0;
  let errors = 0;
  let skipped = 0;

  try {
    const range = sheet.getRange(config.startRow, 1, config.endRow - config.startRow + 1, 2);
    const values = range.getValues();
    const formulas = range.getFormulas();

    for (let i = 0; i < values.length; i++) {
      const row = config.startRow + i;
      const formula = formulas[i][0];
      const result = values[i][1];

      try {
        // Проверяем, нужно ли обновлять ячейку
        if (batchUpdateShouldUpdate(sheet, row, formula, result)) {
          // Обновляем ячейку (пересчитываем формулу)
          if (formula) {
            sheet.getRange(row, 1).setFormula(formula);
          }
          processed++;
          logs.push('📝 Обновлена ячейка A' + row, 'DEBUG');
        } else {
          skipped++;
          logs.push('⏭️ Пропущена ячейка A' + row, 'DEBUG');
        }
      } catch (e) {
        errors++;
        logs.push('❌ Ошибка обновления ячейки A' + row + ': ' + e.message, 'ERROR');
      }
    }
  } catch (e) {
    logs.push('❌ Ошибка обработки диапазона: ' + e.message, 'ERROR');
    errors++;
  }

  const duration = Date.now() - startTime;

  return {
    processed: processed,
    errors: errors,
    skipped: skipped,
    duration: duration,
  };
}

/**
 * Проверка, нужно ли обновлять ячейку
 * @param {Sheet} sheet - Лист
 * @param {number} row - Номер строки
 * @param {string} formula - Формула
 * @param {string} result - Результат
 * @return {boolean} Нужно ли обновлять
 */
function batchUpdateShouldUpdate(sheet, row, formula, result) {
  // Нет формулы - не обновляем
  if (!formula) {
    return false;
  }

  // Нет результата - обновляем
  if (!result) {
    return true;
  }

  // Проверяем возраст результата
  try {
    const cell = sheet.getRange(row, 2);
    const lastUpdated = cell.getLastUpdated();

    if (lastUpdated) {
      const ageMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);
      if (ageMinutes < GLOBAL_CONFIG.SKIP_FRESH_MINUTES) {
        return false; // Слишком свежий результат
      }
    }
  } catch (e) {
    // Игнорируем ошибки при проверке возраста
  }

  // Проверяем на наличие ошибки
  if (String(result).includes('#') && String(result).includes('!')) {
    return true; // Есть ошибка - обновляем
  }

  return true; // По умолчанию обновляем
}

/**
 * Валидация операции
 * @param {string} operation - Операция
 * @return {Object} Результат валидации
 */
function batchUpdateValidateOperation(operation) {
  const errors = [];
  const warnings = [];

  if (!operation) {
    errors.push('Не указана операция');
    return {valid: false, errors, warnings};
  }

  const config = BATCH_OPERATIONS[operation];
  if (!config) {
    errors.push('Неизвестная операция: ' + operation);
    return {valid: false, errors, warnings};
  }

  if (!config.startRow || !config.endRow) {
    errors.push('Некорректная конфигурация операции');
    return {valid: false, errors, warnings};
  }

  if (config.startRow > config.endRow) {
    errors.push('Начальная строка больше конечной');
    return {valid: false, errors, warnings};
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
  };
}

/**
 * Получение списка всех операций
 * @return {Object} Список операций
 */
function batchUpdateGetOperations() {
  const operations = {};

  Object.entries(BATCH_OPERATIONS).forEach(([key, config]) => {
    operations[key] = {
      name: config.name,
      startRow: config.startRow,
      endRow: config.endRow,
      totalRows: config.endRow - config.startRow + 1,
    };
  });

  return {
    success: true,
    data: {
      operations: operations,
      count: Object.keys(operations).length,
    },
  };
}

/**
 * Очистка результатов операций
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры очистки
 * @return {Object} Результат очистки
 */
function batchUpdateClearResults(spreadsheetId, payload) {
  const logs = [];

  try {
    const {operations = Object.keys(BATCH_OPERATIONS), sheetName = 'Распаковка'} = payload;

    logs.push('🧹 Очистка результатов операций');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист "' + sheetName + '" не найден');
    }

    let clearedCells = 0;

    operations.forEach((operation) => {
      const config = BATCH_OPERATIONS[operation];
      if (config) {
        // Очищаем колонку B для диапазона операции
        const range = sheet.getRange(config.startRow, 2, config.endRow - config.startRow + 1, 1);
        range.clearContent();
        clearedCells += config.endRow - config.startRow + 1;

        logs.push('✅ Очищены результаты операции: ' + config.name);
      }
    });

    logs.push('✅ Очистка завершена: ' + clearedCells + ' ячеек');

    return {
      success: true,
      data: {
        clearedCells: clearedCells,
        operationsCount: operations.length,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка очистки: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}
