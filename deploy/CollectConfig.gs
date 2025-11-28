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
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function(s) {
      return s.getName();
    });

    addCollectLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');
    addCollectLog(`📋 Найдено листов: ${sheets.length}`, 'INFO');

    // Создаём базовый шаблон
    createDefaultTemplate();

    return {
      sheetName: sheetName,
      cellAddress: cellAddress,
      sheets: sheets,
      version: COLLECT_CONFIG_VERSION,
      lastUpdate: COLLECT_CONFIG_LAST_UPDATE,
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

    // Сохраняем конфигурацию локально (для повторного использования)
    addCollectLog('💾 Сохранение конфигурации...', 'INFO');
    const saved = saveCollectConfig(sheetName, cellAddress, config);
    if (saved) {
      addCollectLog('✅ Конфигурация сохранена', 'SUCCESS');
    }

    // ═══════════════════════════════════════════════════════════════
    // ТОЛЬКО СЕРВЕРНОЕ ВЫПОЛНЕНИЕ (БЕЗ FALLBACK)
    // ═══════════════════════════════════════════════════════════════
    addCollectLog('📡 Отправка запроса на сервер...', 'INFO');

    const serverResult = callCollectConfigServer_(config, sheetName, cellAddress);

    if (!serverResult || !serverResult.ok) {
      const errorMsg = serverResult && serverResult.error ? serverResult.error : 'Сервер вернул ошибку';
      throw new Error(errorMsg);
    }

    // Объединяем логи сервера с UI логами
    if (serverResult.logs && Array.isArray(serverResult.logs)) {
      mergeServerLogs_(serverResult.logs);
    }

    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addCollectLog('✅ УСПЕХ!', 'SUCCESS');
    addCollectLog(`📝 Результат: ${serverResult.data.length} символов`, 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    return {
      success: true,
      result: serverResult.data,
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
// СОХРАНЕНИЕ/ЗАГРУЗКА КОНФИГУРАЦИИ
// ============================================================================
function saveCollectConfig(sheetName, cellAddress, config) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      configSheet = ss.insertSheet('ConfigData');
      configSheet.hideSheet();

      // Заголовки
      const headers = ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun'];
      configSheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('white');
    }

    // Ищем существующую строку
    const data = configSheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        rowIndex = i + 1;
        break;
      }
    }

    const rowData = [
      sheetName,
      cellAddress,
      config.systemPrompt ? config.systemPrompt.sheet : '',
      config.systemPrompt ? config.systemPrompt.cell : '',
      JSON.stringify(config.userData || []),
      rowIndex === -1 ? new Date().toISOString() : data[rowIndex - 1][5],
      '',
    ];

    if (rowIndex > 0) {
      // Обновляем существующую
      configSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Добавляем новую
      configSheet.appendRow(rowData);
    }

    return true;
  } catch (error) {
    addCollectLog(`Ошибка сохранения: ${error.message}`, 'ERROR');
    return false;
  }
}

function loadCollectConfig(sheetName, cellAddress) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      return null;
    }

    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        let userData = [];
        try {
          if (data[i][4]) {
            userData = JSON.parse(data[i][4]);
          }
        } catch (e) {
          // ignore
        }

        return {
          systemPrompt: (data[i][2] && data[i][3]) ? {
            sheet: data[i][2],
            cell: data[i][3],
          } : null,
          userData: userData,
        };
      }
    }

    return null;
  } catch (error) {
    addCollectLog(`Ошибка загрузки: ${error.message}`, 'ERROR');
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
function deleteCollectConfig(sheetName, cellAddress) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      return false;
    }

    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        configSheet.deleteRow(i + 1);
        addCollectLog(`🗑️ Конфигурация удалена: ${sheetName}!${cellAddress}`, 'INFO');
        return true;
      }
    }

    return false;
  } catch (error) {
    addCollectLog(`Ошибка удаления: ${error.message}`, 'ERROR');
    return false;
  }
}

// eslint-disable-next-line no-unused-vars
function updateLastRun(sheetName, cellAddress) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      return;
    }

    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        configSheet.getRange(i + 1, 7).setValue(new Date().toISOString());
        return;
      }
    }
  } catch (error) {
    // ignore
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

    // Only server preview (NO fallback)
    const serverPreview = callCollectConfigPreview_(sheetName, cellAddress, tableId);

    if (!serverPreview || serverPreview.length === 0) {
      return '(пусто)';
    }

    return serverPreview.length <= 100 ? serverPreview : (serverPreview.substring(0, 100) + '...');
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
    const config = loadCollectConfig(sheetName, cellAddress);

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

    // ONLY server execution (NO fallback)
    const serverResult = callCollectConfigServer_(config, sheetName, cellAddress);

    if (serverResult && serverResult.ok) {
      ui.alert('✅ Готово!', `Результат записан в ${cellAddress}`, ui.ButtonSet.OK);
    } else {
      const errorMsg = serverResult && serverResult.error ? serverResult.error : 'Неизвестная ошибка';
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
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);

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
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const template = getTemplate(user, templateName);
    return template ? (template.config || template) : null;
  } catch (e) {
    return null;
  }
}

// eslint-disable-next-line no-unused-vars
function serverGetTemplatesStats() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return getTemplatesStats(user);
  } catch (e) {
    return {count: 0, totalSize: 0, templates: []};
  }
}

// eslint-disable-next-line no-unused-vars
function serverSaveTemplate(templateName, config) {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return saveTemplate(user, templateName, config);
  } catch (e) {
    return {success: false, message: e.message};
  }
}

// eslint-disable-next-line no-unused-vars
function serverDeleteTemplate(templateName) {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return deleteTemplate(user, templateName);
  } catch (e) {
    return {success: false, message: e.message};
  }
}

// ============================================================================
// SERVER INTEGRATION FUNCTIONS
// ============================================================================

/**
 * Call CollectConfig server for execution
 * @param {Object} config - CollectConfig configuration
 * @param {string} sheetName - Target sheet name
 * @param {string} cellAddress - Target cell address
 * @return {Object} Server response
 */
function callCollectConfigServer_(config, sheetName, cellAddress) {
  // ═══════════════════════════════════════════════════════════════
  // VALIDATION OF SETTINGS (detailed error messages)
  // ═══════════════════════════════════════════════════════════════

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

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY не настроен. Откройте Settings и укажите API ключ Gemini.');
  }

  const scriptId = ScriptApp.getScriptId();  // ⭐ Добавить
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

  const payload = {
    action: 'collect_config_execute',
    config: config,
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    cellAddress: cellAddress,
    apiKey: geminiApiKey,
    email: licenseEmail,
    token: licenseToken,
    scriptId: scriptId,        // ⭐ Для привязки
    // spreadsheetId уже есть выше для работы
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 60, // 60 seconds timeout
  };

  addCollectLog(`📤 Отправка запроса на сервер: ${serverUrl}`, 'INFO');
  addCollectLog(`📋 Payload config.systemPrompt: ${JSON.stringify(config.systemPrompt)}`, 'DEBUG');
  addCollectLog(`📋 Payload config.userData: ${config.userData ? config.userData.length + ' источников' : 'нет'}`, 'DEBUG');
  addCollectLog(`📋 SpreadsheetId: ${spreadsheetId}`, 'DEBUG');

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

/**
 * Call CollectConfig server for preview
 * @param {string} sheetName - Sheet name
 * @param {string} cellAddress - Cell address
 * @param {string} tableId - Optional table ID
 * @return {string} Preview text
 */
function callCollectConfigPreview_(sheetName, cellAddress, tableId) {
  // Get credentials from ScriptProperties
  const props = PropertiesService.getScriptProperties();
  const serverUrl = props.getProperty('SERVER_URL') || (typeof SERVER_URL !== 'undefined' ? SERVER_URL : '');
  const licenseEmail = props.getProperty('LICENSE_EMAIL') || '';
  const licenseToken = props.getProperty('LICENSE_TOKEN') || '';

  if (!serverUrl || !licenseEmail || !licenseToken) {
    throw new Error('Сервер не настроен');
  }

  const scriptId = ScriptApp.getScriptId();  // ⭐ Добавить
  const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();

  const config = {
    userData: [{
      sheet: sheetName,
      cell: cellAddress,
    }],
  };

  const payload = {
    action: 'collect_config_preview',
    config: config,
    spreadsheetId: spreadsheetId,
    tableId: tableId || '',
    email: licenseEmail,
    token: licenseToken,
    scriptId: scriptId,  // ⭐ Для привязки
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    timeout: 30, // 30 seconds timeout
  };

  const response = UrlFetchApp.fetch(serverUrl, options);
  const responseCode = response.getResponseCode();

  if (responseCode >= 400) {
    throw new Error(`HTTP ${responseCode}`);
  }

  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    throw new Error(result.error || 'UNKNOWN_ERROR');
  }

  return result.data || '';
}

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

    const config = loadCollectConfig(sheet.getName(), range.getA1Notation());
    return config !== null;
  } catch (e) {
    return false;
  }
}
