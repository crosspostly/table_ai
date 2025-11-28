/**
 * ============================================================================
 * COLLECT CONFIG - VERTICAL SIDEBAR UI v3.0
 * ============================================================================
 * Версия: 3.0.0
 * Дата: 2025-06-18 00:00:00
 *
 * ИЗМЕНЕНИЯ:
 * - ✅ Новый вертикальный sidebar интерфейс (только один столбец)
 * - ✅ Все элементы строго по вертикали - никакого горизонтального грид
 * - ✅ Sidebar вместо модального диалога (showSidebar вместо showModalDialog)
 * - ✅ Collapsible управление шаблонами через <details>/<summary>
 * - ✅ Кнопки-иконки с tooltips
 * - ✅ Отделенные секции с визуальными разделителями
 * - ✅ Адаптивная ширина 350-500px для боковой панели
 * - ✅ Убрана информация о версии из UI
 * - ✅ Обязательные превью для каждого источника данных
 * ============================================================================
 */

const COLLECT_CONFIG_VERSION = '3.0.0';
const COLLECT_CONFIG_LAST_UPDATE = '2025-06-18 00:00:00';

// ============================================================================
// ЛОКАЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ UI (не конфликтует с глобальным addLog)
// ============================================================================
let COLLECT_CONFIG_UI_LOG = [];

/**
 * Добавляет запись в UI-лог И в глобальную систему логирования
 * НЕ ЗАМЕНЯЕТ глобальную функцию addLog() из Main.gs!
 */
const addCollectLog = (message, level) => {
  level = level || 'INFO';
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  // Добавляем в локальный UI-лог
  const logEntry = {
    timestamp: timestamp,
    message: message,
    level: level.toUpperCase(),
  };
  COLLECT_CONFIG_UI_LOG.push(logEntry);

  // ВАЖНО: Добавляем также в глобальную систему логирования
  try {
    if (typeof addLog === 'function') {
      addLog(`[CollectConfig] ${message}`, level);
    } else {
      Logger.log(`[${level}] ${message}`);
    }
  } catch (e) {
    Logger.log(`[${level}] ${message}`);
  }
};

/**
 * Очищает локальный UI-лог (НЕ влияет на глобальный лог)
 */
const clearCollectLog = () => {
  COLLECT_CONFIG_UI_LOG = [];
};

/**
 * Возвращает локальный UI-лог для отображения в интерфейсе
 */
const getCollectLog = () => {
  return COLLECT_CONFIG_UI_LOG;
};

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: Открыть UI (Vertical Sidebar)
// ============================================================================
const openCollectConfigUI = () => {
  try {
    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
      .setWidth(400)
      .setTitle('🎯 AI Конструктор');

    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
};

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ UI
// ============================================================================
// eslint-disable-next-line no-unused-vars
function getCollectConfigInitData() {
  try {
    clearCollectLog();
    addCollectLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_LAST_UPDATE})`, 'INFO');

    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      throw new Error('Выделите ячейку!');
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    addCollectLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');

    // Call server for initialization
    const serverResult = callServerAction_('collect_config_init', {
      sheetName: sheetName,
      cellAddress: cellAddress,
    });

    if (!serverResult || !serverResult.ok) {
      const errorMsg = serverResult && serverResult.error ? serverResult.error : 'Сервер вернул ошибку';
      throw new Error(errorMsg);
    }

    // Merge server logs
    if (serverResult.logs && Array.isArray(serverResult.logs)) {
      mergeServerLogs_(serverResult.logs);
    }

    const serverData = serverResult.data;

    // Create default template if needed (server-side)
    createDefaultTemplate();

    return {
      sheetName: sheetName,
      cellAddress: cellAddress,
      sheets: serverData.sheets || [],
      version: serverData.version || COLLECT_CONFIG_VERSION,
      lastUpdate: serverData.lastUpdate || COLLECT_CONFIG_LAST_UPDATE,
      existingConfig: serverData.existingConfig,
      logs: getCollectLog(),
    };
  } catch (error) {
    addCollectLog(`❌ Ошибка инициализации: ${error.message}`, 'ERROR');
    throw error;
  }
}

// ============================================================================
// СОЗДАНИЕ БАЗОВОГО ШАБЛОНА
// ============================================================================
function createDefaultTemplate() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);

    // Если шаблон уже есть - не создаём
    if (templates && templates['По умолчанию']) {
      addCollectLog('✅ Базовый шаблон уже существует', 'INFO');
      return;
    }

    const defaultTemplate = {
      systemPrompt: {
        sheet: 'Prompt_box',
        cell: 'E2',
      },
      userData: [
        {
          sheet: 'отзывы',
          cell: 'B:B',
        },
      ],
    };

    const result = saveTemplate(user, 'По умолчанию', defaultTemplate);
    if (result && result.success) {
      addCollectLog('✅ Создан базовый шаблон "По умолчанию"', 'SUCCESS');
    } else {
      addCollectLog('⚠️ Не удалось создать базовый шаблон', 'WARN');
    }
  } catch (error) {
    addCollectLog(`⚠️ Ошибка создания шаблона: ${error.message}`, 'WARN');
  }
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: СОХРАНИТЬ И ВЫПОЛНИТЬ
// ============================================================================
// eslint-disable-next-line no-unused-vars
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  try {
    clearCollectLog();
    addCollectLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION}`, 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addCollectLog('📋 НАЧАЛО ВЫПОЛНЕНИЯ', 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    // Валидация
    if (!sheetName || !cellAddress || !config) {
      throw new Error('Отсутствуют обязательные параметры!');
    }

    addCollectLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');

    // Сохраняем конфигурацию через сервер
    addCollectLog('💾 Сохранение конфигурации...', 'INFO');
    const saveResult = callServerAction_('collect_config_save', {
      sheetName: sheetName,
      cellAddress: cellAddress,
      config: config,
    });

    if (!saveResult || !saveResult.ok) {
      const errorMsg = saveResult && saveResult.error ? saveResult.error : 'Сервер вернул ошибку при сохранении';
      throw new Error(errorMsg);
    }

    // Merge save logs
    if (saveResult.logs && Array.isArray(saveResult.logs)) {
      mergeServerLogs_(saveResult.logs);
    }

    addCollectLog('✅ Конфигурация сохранена', 'SUCCESS');

    // Выполняем через сервер
    addCollectLog('📡 Выполнение через сервер...', 'INFO');

    const executeResult = callServerAction_('collect_config_execute', {
      sheetName: sheetName,
      cellAddress: cellAddress,
      config: config,
    });

    if (!executeResult || !executeResult.ok) {
      const errorMsg = executeResult && executeResult.error ? executeResult.error : 'Сервер вернул ошибку при выполнении';
      throw new Error(errorMsg);
    }

    // Объединяем логи сервера с UI логами
    if (executeResult.logs && Array.isArray(executeResult.logs)) {
      mergeServerLogs_(executeResult.logs);
    }

    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addCollectLog('✅ УСПЕХ!', 'SUCCESS');
    addCollectLog(`📝 Результат: ${executeResult.data ? executeResult.data.length : 0} символов`, 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    return {
      success: true,
      result: executeResult.data,
      logs: getCollectLog(),
    };
  } catch (error) {
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addCollectLog(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, 'ERROR');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    // Понятные сообщения об ошибках
    if (error.message.includes('SERVER_URL не настроен')) {
      addCollectLog('', 'ERROR');
      addCollectLog('📝 Инструкция:', 'ERROR');
      addCollectLog('1. Откройте меню Settings', 'ERROR');
      addCollectLog('2. Настройте SERVER_URL', 'ERROR');
      addCollectLog('3. Настройте лицензионные данные', 'ERROR');
    }

    return {
      success: false,
      error: error.message,
      logs: getCollectLog(),
    };
  }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ UI: PREVIEW
// ============================================================================
// eslint-disable-next-line no-unused-vars
function getCellPreview(sheetName, cellAddress, tableId) {
  try {
    if (!sheetName || !cellAddress) {
      return '⚠️ Не указаны параметры';
    }

    // Call server for preview
    const config = {
      userData: [{
        sheet: sheetName,
        cell: cellAddress,
      }],
    };

    const serverResult = callServerAction_('collect_config_preview', {
      config: config,
      tableId: tableId || '',
    });

    if (!serverResult || !serverResult.ok) {
      const errorMsg = serverResult && serverResult.error ? serverResult.error : 'Сервер вернул ошибку';
      return `❌ Ошибка: ${errorMsg}`;
    }

    const preview = serverResult.data || '';
    return preview.length <= 100 ? preview : (preview.substring(0, 100) + '...');
  } catch (error) {
    return `❌ Ошибка: ${error.message}`;
  }
}

// ============================================================================
// ОБНОВЛЕНИЕ ЯЧЕЙКИ
// ============================================================================
// eslint-disable-next-line no-unused-vars
function refreshCellWithConfig() {
  try {
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Выберите ячейку!');
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    // Load existing config from server
    const loadResult = callServerAction_('collect_config_init', {
      sheetName: sheetName,
      cellAddress: cellAddress,
    });

    const config = loadResult && loadResult.ok && loadResult.data && loadResult.data.existingConfig;

    if (!config) {
      const response = ui.alert(
        '⚠️ Конфигурация не найдена',
        'Хотите создать новую?',
        ui.ButtonSet.YES_NO,
      );

      if (response === ui.Button.YES) {
        openCollectConfigUI();
      }
      return;
    }

    ui.alert('🚀 Запуск...', 'Выполняю запрос через сервер...', ui.ButtonSet.OK);

    // Execute via server
    const executeResult = callServerAction_('collect_config_execute', {
      sheetName: sheetName,
      cellAddress: cellAddress,
      config: config,
    });

    if (executeResult && executeResult.ok) {
      ui.alert('✅ Готово!', `Результат записан в ${cellAddress}`, ui.ButtonSet.OK);
    } else {
      const errorMsg = executeResult && executeResult.error ? executeResult.error : 'Неизвестная ошибка';
      ui.alert('❌ Ошибка', errorMsg, ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

// ============================================================================
// ШАБЛОНЫ - ENDPOINTS ДЛЯ UI
// ============================================================================
// eslint-disable-next-line no-unused-vars
function serverGetAllTemplates() {
  try {
    const serverResult = callServerAction_('collect_config_templates_get_all', {});

    if (!serverResult || !serverResult.ok) {
      return {};
    }

    const templates = serverResult.data || {};
    const result = {};
    for (const name in templates) {
      if (Object.prototype.hasOwnProperty.call(templates, name)) {
        result[name] = templates[name].config || templates[name];
      }
    }

    return result;
  } catch (e) {
    return {};
  }
}

// eslint-disable-next-line no-unused-vars
function serverGetTemplate(templateName) {
  try {
    const serverResult = callServerAction_('collect_config_templates_get', {
      templateName: templateName,
    });

    if (!serverResult || !serverResult.ok) {
      return null;
    }

    const template = serverResult.data;
    return template ? (template.config || template) : null;
  } catch (e) {
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
function serverGetTemplatesStats() {
  try {
    const serverResult = callServerAction_('collect_config_templates_stats', {});

    if (!serverResult || !serverResult.ok) {
      return {count: 0, totalSize: 0, templates: []};
    }

    return serverResult.data || {count: 0, totalSize: 0, templates: []};
  } catch (e) {
    return {count: 0, totalSize: 0, templates: []};
  }
}

// eslint-disable-next-line no-unused-vars
function serverSaveTemplate(templateName, config) {
  try {
    const serverResult = callServerAction_('collect_config_templates_save', {
      templateName: templateName,
      config: config,
    });

    if (!serverResult || !serverResult.ok) {
      return {success: false, message: serverResult && serverResult.error ? serverResult.error : 'Unknown error'};
    }

    return serverResult.data || {success: true, message: 'Template saved successfully'};
  } catch (e) {
    return {success: false, message: e.message};
  }
}

// eslint-disable-next-line no-unused-vars
function serverDeleteTemplate(templateName) {
  try {
    const serverResult = callServerAction_('collect_config_templates_delete', {
      templateName: templateName,
    });

    if (!serverResult || !serverResult.ok) {
      return {success: false, message: serverResult && serverResult.error ? serverResult.error : 'Unknown error'};
    }

    return serverResult.data || {success: true, message: 'Template deleted successfully'};
  } catch (e) {
    return {success: false, message: e.message};
  }
}

// ============================================================================
// SERVER INTEGRATION - CENTRALIZED CALL FUNCTION
// ============================================================================

/**
 * Centralized function to call server actions
 * @param {string} action - Server action name
 * @param {Object} data - Data to send to server
 * @return {Object} Server response
 */
function callServerAction_(action, data) {
  // Get credentials from ScriptProperties
  const props = PropertiesService.getScriptProperties();
  const serverUrl = props.getProperty('SERVER_URL') || (typeof SERVER_URL !== 'undefined' ? SERVER_URL : '');
  const licenseEmail = props.getProperty('LICENSE_EMAIL') || '';
  const licenseToken = props.getProperty('LICENSE_TOKEN') || '';
  const geminiApiKey = props.getProperty('GEMINI_API_KEY') || '';

  if (!serverUrl) {
    throw new Error('SERVER_URL не настроен. Откройте Settings и настройте URL сервера.');
  }

  if (!licenseEmail || !licenseToken) {
    throw new Error('Лицензионные данные не настроены. Откройте Settings и укажите LICENSE_EMAIL и LICENSE_TOKEN.');
  }

  const scriptId = ScriptApp.getScriptId();
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

  const payload = {
    action: action,
    ...data,
    spreadsheetId: spreadsheetId,
    scriptId: scriptId,
    email: licenseEmail,
    token: licenseToken,
  };

  // Add API key only for actions that need it
  if (['collect_config_execute', 'collect_config_preview'].includes(action)) {
    payload.apiKey = geminiApiKey;
  }

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 60,
  };

  addCollectLog(`📤 Отправка запроса на сервер: ${action}`, 'INFO');

  const response = UrlFetchApp.fetch(serverUrl, options);
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  addCollectLog(`📥 Ответ сервера: HTTP ${responseCode}`, 'INFO');

  if (responseCode >= 400) {
    throw new Error(`HTTP ${responseCode}: ${responseText}`);
  }

  let result;
  try {
    result = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Ошибка парсинга ответа сервера: ${parseError.message}`);
  }

  return result;
}

// ============================================================================
// SERVER INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Merge server logs into UI log
 * @param {Array} serverLogs - Array of log entries from server
 */
function mergeServerLogs_(serverLogs) {
  if (!serverLogs || !Array.isArray(serverLogs)) {
    return;
  }

  serverLogs.forEach(function(logEntry) {
    if (logEntry && logEntry.message) {
      // Convert ISO timestamp to local time format
      let timestamp;
      try {
        if (logEntry.timestamp) {
          const date = new Date(logEntry.timestamp);
          timestamp = date.toLocaleTimeString('ru-RU');
        } else {
          timestamp = new Date().toLocaleTimeString('ru-RU');
        }
      } catch (e) {
        timestamp = new Date().toLocaleTimeString('ru-RU');
      }

      COLLECT_CONFIG_UI_LOG.push({
        timestamp: timestamp,
        message: logEntry.message,
        level: (logEntry.level || 'INFO').toUpperCase(),
      });
    }
  });
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
// eslint-disable-next-line no-unused-vars
function getAllSheetNames() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) {
    return s.getName();
  });
}

// eslint-disable-next-line no-unused-vars
function hasConfigForCurrentCell() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();
    if (!range) return false;

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    // Check via server
    const loadResult = callServerAction_('collect_config_init', {
      sheetName: sheetName,
      cellAddress: cellAddress,
    });

    const config = loadResult && loadResult.ok && loadResult.data && loadResult.data.existingConfig;
    return config !== null && config !== undefined;
  } catch (e) {
    return false;
  }
}
