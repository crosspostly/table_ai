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
    addCollectLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_LAST_UPDATE})`, 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addCollectLog('📋 НАЧАЛО ВЫПОЛНЕНИЯ', 'INFO');
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    // Валидация
    addCollectLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');
    addCollectLog(`📊 Конфигурация: ${JSON.stringify(config).substring(0, 100)}...`, 'INFO');

    if (!sheetName || !cellAddress || !config) {
      throw new Error('Отсутствуют обязательные параметры!');
    }

    // Сохраняем конфигурацию
    addCollectLog('💾 Сохранение конфигурации...', 'INFO');
    const saved = saveCollectConfig(sheetName, cellAddress, config);
    if (saved) {
      addCollectLog('✅ Конфигурация сохранена', 'SUCCESS');
    } else {
      addCollectLog('⚠️ Ошибка сохранения', 'WARN');
    }

    // Выполняем
    addCollectLog('🔥 Выполнение запроса...', 'INFO');
    const result = executeCollectConfig(sheetName, cellAddress);

    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    if (result.success) {
      addCollectLog('✅ УСПЕХ!', 'SUCCESS');
      addCollectLog(`📝 Результат: ${result.result.length} символов`, 'INFO');
    } else {
      addCollectLog('❌ ОШИБКА!', 'ERROR');
      addCollectLog(`❌ ${result.error}`, 'ERROR');
    }
    addCollectLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    result.logs = getCollectLog();
    return result;
  } catch (error) {
    addCollectLog(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, 'ERROR');
    addCollectLog(`Stack: ${error.stack}`, 'ERROR');
    return {
      success: false,
      error: error.message,
      logs: getCollectLog(),
    };
  }
}

// ============================================================================
// ВЫПОЛНЕНИЕ КОНФИГУРАЦИИ
// ============================================================================
function executeCollectConfig(sheetName, cellAddress) {
  try {
    // Загружаем конфигурацию
    const config = loadCollectConfig(sheetName, cellAddress);
    if (!config) {
      throw new Error('Конфигурация не найдена!');
    }

    addCollectLog('📖 Конфигурация загружена', 'INFO');

    // Собираем System Prompt
    let systemPrompt = '';
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      addCollectLog(`📍 System Prompt: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}`, 'INFO');
      try {
        systemPrompt = readData(config.systemPrompt.sheet, config.systemPrompt.cell);
        addCollectLog(`✅ System Prompt: ${systemPrompt.length} символов`, 'SUCCESS');
      } catch (e) {
        addCollectLog(`❌ Ошибка чтения System Prompt: ${e.message}`, 'ERROR');
        throw e;
      }
    } else {
      addCollectLog('⚠️ System Prompt не задан', 'WARN');
    }

    // Собираем User Data
    const userDataParts = [];
    if (config.userData && config.userData.length > 0) {
      addCollectLog(`📦 User Data: ${config.userData.length} источников`, 'INFO');

      config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          addCollectLog(`  📍 Источник ${index + 1}: ${source.sheet}!${source.cell}`, 'INFO');
          try {
            const data = readData(source.sheet, source.cell);
            addCollectLog(`  ✅ Прочитано: ${data.length} символов`, 'SUCCESS');
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            addCollectLog(`  ❌ Ошибка: ${e.message}`, 'ERROR');
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n[ОШИБКА: ${e.message}]`);
          }
        }
      });
    } else {
      addCollectLog('⚠️ User Data не задан', 'WARN');
    }

    // Формируем финальный промпт
    let finalPrompt = '';
    if (systemPrompt) {
      finalPrompt += systemPrompt + '\n\n---\n\n';
    }
    if (userDataParts.length > 0) {
      finalPrompt += 'ДАННЫЕ:\n' + userDataParts.join('\n\n');
    }

    if (!finalPrompt.trim()) {
      throw new Error('Нет данных для обработки!');
    }

    addCollectLog(`📝 Финальный промпт: ${finalPrompt.length} символов`, 'INFO');

    // Вызываем AI
    addCollectLog('🤖 Отправка запроса в Gemini...', 'INFO');
    const aiResult = GM(finalPrompt);

    if (!aiResult || aiResult.startsWith('Error:')) {
      throw new Error('Ошибка AI: ' + aiResult);
    }

    addCollectLog(`✅ Получен ответ от AI: ${aiResult.length} символов`, 'SUCCESS');

    // Записываем результат
    const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (targetSheet) {
      targetSheet.getRange(cellAddress).setValue(aiResult);
      addCollectLog(`✅ Результат записан в ${sheetName}!${cellAddress}`, 'SUCCESS');
    }

    // Обновляем lastRun
    updateLastRun(sheetName, cellAddress);

    return {
      success: true,
      result: aiResult,
    };
  } catch (error) {
    addCollectLog(`❌ executeCollectConfig ERROR: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// ЧТЕНИЕ ДАННЫХ - МАКСИМАЛЬНО ПРОСТАЯ ВЕРСИЯ
// ============================================================================
function readData(sheetName, cellAddress) {
  addCollectLog(`  → Чтение ${sheetName}!${cellAddress}`, 'INFO');

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не найден`);
    }

    // ПРОСТЕЙШИЙ подход: просто читаем диапазон как есть
    const range = sheet.getRange(cellAddress);
    const values = range.getValues();

    addCollectLog(`  → Прочитано: ${values.length} строк × ${values[0].length} столбцов`, 'INFO');

    // Превращаем в плоский массив и фильтруем пустые
    const result = [];
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        const val = values[r][c];
        if (val !== null && val !== undefined && val.toString().trim() !== '') {
          result.push(val.toString());
        }
      }
    }

    addCollectLog(`  → После фильтрации: ${result.length} значений`, 'INFO');

    return result.join('\n');
  } catch (error) {
    addCollectLog(`  ❌ Ошибка чтения: ${error.message}`, 'ERROR');
    throw new Error(`Не удалось прочитать ${sheetName}!${cellAddress}: ${error.message}`);
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
function getCellPreview(sheetName, cellAddress) {
  try {
    if (!sheetName || !cellAddress) {
      return '⚠️ Не указаны параметры';
    }

    const data = readData(sheetName, cellAddress);

    if (!data || data.length === 0) {
      return '(пусто)';
    }

    if (data.length <= 100) {
      return data;
    }

    return data.substring(0, 100) + '...';
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

    ui.alert('🚀 Запуск...', 'Выполняю запрос...', ui.ButtonSet.OK);

    const result = executeCollectConfig(sheetName, cellAddress);

    if (result.success) {
      ui.alert('✅ Готово!', `Результат записан в ${cellAddress}`, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Ошибка', result.error, ui.ButtonSet.OK);
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
