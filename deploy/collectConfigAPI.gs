/**
 * ============================================================================
 * COLLECT CONFIG API - SERVER MODULE
 * Перенесено из CollectConfig.gs для работы на толстом сервере
 * ============================================================================
 * Версия: 3.0.0
 * Дата: 2025-06-18 00:00:00
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================
// Note: Version constants are handled on the server side

// ============================================================================
// ОСНОВНЫЕ API ФУНКЦИИ
// ============================================================================

/**
 * Инициализация CollectConfig UI
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Результат инициализации
 */
function collectConfigInit(spreadsheetId, payload) {
  const logs = [];

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      throw new Error('Выделите ячейку!');
    }

    const a1 = range.getA1Notation();
    const sheetName = sheet.getName();
    const currentValue = String(range.getValue() || '').trim();

    // Получаем шаблоны
    const templates = collectConfigGetTemplates(spreadsheetId, payload);

    // Получаем конфигурацию для текущей ячейки
    const existingConfig = collectConfigGetExistingConfig(spreadsheetId, sheetName, a1);

    const result = {
      success: true,
      data: {
        sheetName: sheetName,
        cellA1: a1,
        currentValue: currentValue,
        templates: templates.templates,
        categories: templates.categories,
        existingConfig: existingConfig,
      },
      logs: logs,
    };

    logs.push('✅ CollectConfig инициализирован для ' + sheetName + '!' + a1);
    return result;
  } catch (error) {
    logs.push('❌ Ошибка инициализации: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Предпросмотр конфигурации
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} config - Конфигурация для предпросмотра
 * @return {Object} Результат предпросмотра
 */
function collectConfigPreview(_spreadsheetId, _config) {
  const logs = [];

  try {
    if (!_config) {
      throw new Error('NO_CONFIG');
    }

    let preview = '';

    // Читаем данные для предпросмотра
    if (_config.userData && _config.userData.length > 0) {
      const previews = [];
      _config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          try {
            const dataText = serverReadData_(_spreadsheetId, source.sheet, source.cell, logs);
            const trimmed = dataText.length > 100 ? dataText.substring(0, 100) + '...' : dataText;
            previews.push(`Источник ${index + 1} (${source.sheet}!${source.cell}): ${trimmed}`);
          } catch (e) {
            previews.push(`Источник ${index + 1}: Ошибка - ${e.message}`);
          }
        }
      });
      preview = previews.join('\n\n');
    } else {
      preview = '(нет данных для предпросмотра)';
    }

    logs.push('✅ Предпросмотр создан');
    return {
      success: true,
      data: preview,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка предпросмотра: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Выполнение конфигурации
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} config - Конфигурация для выполнения
 * @param {Object} payload - Дополнительные параметры (sheetName, cellAddress)
 * @return {Object} Результат выполнения
 */
function collectConfigExecute(spreadsheetId, config, payload) {
  const logs = [];
  const sheetName = payload.sheetName || '';
  const cellAddress = payload.cellAddress || '';

  try {
    // Валидация
    if (!config) throw new Error('NO_CONFIG');
    if (!spreadsheetId) throw new Error('NO_SPREADSHEET_ID');
    if (!sheetName) throw new Error('NO_SHEET_NAME');
    if (!cellAddress) throw new Error('NO_CELL_ADDRESS');

    logs.push('📋 Начало выполнения конфигурации для ' + sheetName + '!' + cellAddress);

    // Формируем полный промпт
    const fullPrompt = collectConfigBuildPrompt(_config, _spreadsheetId, logs);

    // Вызываем Gemini API (будет вызываться через основной сервер)
    // Здесь мы просто возвращаем подготовленные данные
    logs.push('✅ Промпт сформирован, длина: ' + fullPrompt.length);

    return {
      success: true,
      data: {
        prompt: fullPrompt,
        targetSheet: sheetName,
        targetCell: cellAddress,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка выполнения: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Сохранение конфигурации
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} config - Конфигурация для сохранения
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Результат сохранения
 */
function collectConfigSave(spreadsheetId, config, payload) {
  const logs = [];

  try {
    const sheetName = payload.sheetName || '';
    const cellAddress = payload.cellAddress || '';

    if (!config) throw new Error('NO_CONFIG');
    if (!sheetName) throw new Error('NO_SHEET_NAME');
    if (!cellAddress) throw new Error('NO_CELL_ADDRESS');

    // Сохраняем в PropertiesService
    const props = PropertiesService.getScriptProperties();
    const key = 'collectConfig_' + sheetName + '_' + cellAddress;
    props.setProperty(key, JSON.stringify(config));

    logs.push('✅ Конфигурация сохранена для ' + sheetName + '!' + cellAddress);

    return {
      success: true,
      data: {saved: true},
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка сохранения: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Удаление конфигурации
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры (sheetName, cellAddress)
 * @return {Object} Результат удаления
 */
function collectConfigDelete(spreadsheetId, payload) {
  const logs = [];

  try {
    const sheetName = payload.sheetName || '';
    const cellAddress = payload.cellAddress || '';

    if (!sheetName) throw new Error('NO_SHEET_NAME');
    if (!cellAddress) throw new Error('NO_CELL_ADDRESS');

    // Удаляем из PropertiesService
    const props = PropertiesService.getScriptProperties();
    const key = 'collectConfig_' + sheetName + '_' + cellAddress;
    props.deleteProperty(key);

    logs.push('✅ Конфигурация удалена для ' + sheetName + '!' + cellAddress);

    return {
      success: true,
      data: {deleted: true},
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка удаления: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Получение списка шаблонов
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Список шаблонов
 */
function collectConfigGetTemplates(spreadsheetId, payload) {
  const logs = [];

  try {
    // Используем TemplateService для получения шаблонов
    const templates = [];
    const categories = [];

    // Здесь должна быть логика получения шаблонов из TemplateService
    // Пока возвращаем пустые массивы

    logs.push('✅ Шаблоны загружены');

    return {
      success: true,
      data: {
        templates: templates,
        categories: categories,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка загрузки шаблонов: ' + error.message);
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
 * Построение полного промпта из конфигурации
 * @param {Object} config - Конфигурация
 * @param {string} spreadsheetId - ID таблицы
 * @param {Array} logs - Массив для логов
 * @return {string} Полный промпт
 */
function collectConfigBuildPrompt(config, spreadsheetId, logs) {
  let prompt = '';

  // Добавляем системный промпт
  if (config.systemPrompt) {
    prompt += config.systemPrompt + '\n\n';
  }

  // Добавляем данные из источников
  if (config.userData && config.userData.length > 0) {
    prompt += 'Данные:\n';
    config.userData.forEach(function(source, index) {
      if (source.sheet && source.cell) {
        try {
          const dataText = serverReadData_(spreadsheetId, source.sheet, source.cell, logs);
          prompt += `\n${source.label || 'Источник ' + (index + 1)}:\n${dataText}\n`;
        } catch (e) {
          logs.push('⚠️ Не удалось прочитать данные из ' + source.sheet + '!' + source.cell + ': ' + e.message);
        }
      }
    });
  }

  // Добавляем пользовательский промпт
  if (config.userPrompt) {
    prompt += '\nЗадача:\n' + config.userPrompt;
  }

  return prompt;
}

/**
 * Получение существующей конфигурации для ячейки
 * @param {string} spreadsheetId - ID таблицы
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки
 * @return {Object|null} Конфигурация или null
 */
function collectConfigGetExistingConfig(spreadsheetId, sheetName, cellAddress) {
  try {
    const props = PropertiesService.getScriptProperties();
    const key = 'collectConfig_' + sheetName + '_' + cellAddress;
    const configJson = props.getProperty(key);
    
    if (configJson) {
      return JSON.parse(configJson);
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

// Export functions for server use
if (typeof module !== 'undefined') {
  module.exports = {
    collectConfigInit,
    collectConfigPreview,
    collectConfigExecute,
    collectConfigSave,
    collectConfigDelete,
    collectConfigGetTemplates,
    collectConfigGetExistingConfig
  };
}
