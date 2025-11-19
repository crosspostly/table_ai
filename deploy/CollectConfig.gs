/**
 * ============================================================================
 * COLLECT CONFIG - ПОЛНОСТЬЮ НОВАЯ ВЕРСИЯ С НУЛЯ
 * ============================================================================
 * Версия: 3.0.0
 * Дата: 2025-10-18 18:20:00
 * 
 * ЦЕЛЬ: ПРОСТОТА И НАДЁЖНОСТЬ!
 * ============================================================================
 */

const COLLECT_CONFIG_VERSION = '3.0.0';
const COLLECT_CONFIG_LAST_UPDATE = '2025-10-18 18:20:00';

// ============================================================================
// ГЛОБАЛЬНЫЙ ЛОГ (для передачи в UI)
// ============================================================================
var GLOBAL_LOG = [];

function addLog(message, level) {
  level = level || 'INFO';
  const timestamp = new Date().toLocaleTimeString('ru-RU');
  const logEntry = {
    timestamp: timestamp,
    message: message,
    level: level.toUpperCase()
  };
  GLOBAL_LOG.push(logEntry);
  Logger.log(`[${level}] ${message}`);
}

function clearLog() {
  GLOBAL_LOG = [];
}

function getLog() {
  return GLOBAL_LOG;
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: Открыть UI
// ============================================================================
function openCollectConfigUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
      .setWidth(700)
      .setTitle('🎯 AI Конструктор v3.0');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

// ============================================================================
// УПРАВЛЕНИЕ ШАБЛОНАМИ
// ============================================================================
function openTemplatesUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
      .setWidth(800)
      .setHeight(600)
      .setTitle('🗂️ Управление шаблонами');
    
    // Устанавливаем режим управления шаблонами
    html.setContent(html.getContent() + 
      '<script>window.onload = function() { showTemplatesTab(); };</script>');
    
    SpreadsheetApp.getUi().showModalDialog(html, '🗂️ Управление шаблонами');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

function showCollectConfigHelp() {
  try {
    const helpText = `
🎯 AI Конструктор - Справка

📋 ОСНОВНЫЕ ПОНЯТИЯ:
• Конфигурация ячейки - привязка к конкретной ячейке
• Шаблон - именованная конфигурация для переиспользования

🔧 РАБОТА С КОНФИГУРАЦИЯМИ:
1. Выделите целевую ячейку
2. Откройте "🎯 Настроить запрос"
3. Выберите системный промпт (Prompt_box!E2)
4. Добавьте источники данных
5. Сохраните и выполните

📂 ХРАНЕНИЕ ДАННЫХ:
• Все конфигурации хранятся в листе ConfigData
• Шаблоны отмечены флагом IsTemplate = true
• Базовый шаблон "По умолчанию" создаётся автоматически

💡 СОВЕТЫ:
• Используйте шаблоны для однотипных задач
• Имена шаблонов должны быть уникальными
• Конфигурации ячеек привязаны к конкретным адресам
• Все изменения логируются для отладки

❓ ПОДДЕРЖКА:
Проверьте логи через меню 🧰 DEV → 📝 Показать логи
    `;
    
    SpreadsheetApp.getUi().alert('📖 Справка', helpText.trim(), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

// ============================================================================
// ИНИЦИАЛИЗАЦИЯ UI
// ============================================================================
function getCollectConfigInitData() {
  try {
    clearLog();
    addLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_LAST_UPDATE})`, 'INFO');
    
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();
    
    if (!range) {
      throw new Error('Выделите ячейку!');
    }
    
    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName());
    
    addLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');
    addLog(`📋 Найдено листов: ${sheets.length}`, 'INFO');
    
    // Создаём базовый шаблон
    createDefaultTemplate();
    
    return {
      sheetName: sheetName,
      cellAddress: cellAddress,
      sheets: sheets,
      version: COLLECT_CONFIG_VERSION,
      lastUpdate: COLLECT_CONFIG_LAST_UPDATE,
      logs: getLog()
    };
  } catch (error) {
    addLog(`❌ Ошибка инициализации: ${error.message}`, 'ERROR');
    throw error;
  }
}

// ============================================================================
// СОЗДАНИЕ БАЗОВОГО ШАБЛОНА
// ============================================================================
function createDefaultTemplate() {
  try {
    const templates = getAllTemplatesFromSheet();
    
    // Если шаблон уже есть - не создаём
    if (templates && templates['По умолчанию']) {
      addLog('✅ Базовый шаблон уже существует', 'INFO');
      return;
    }
    
    const defaultTemplate = {
      systemPrompt: {
        sheet: 'Prompt_box',
        cell: 'E2'
      },
      userData: [
        {
          sheet: 'отзывы',
          cell: 'B:B'
        }
      ]
    };
    
    const result = saveTemplateToSheet('По умолчанию', defaultTemplate);
    if (result && result.success) {
      addLog('✅ Создан базовый шаблон "По умолчанию"', 'SUCCESS');
    } else {
      addLog('⚠️ Не удалось создать базовый шаблон', 'WARN');
    }
  } catch (error) {
    addLog(`⚠️ Ошибка создания шаблона: ${error.message}`, 'WARN');
  }
}

// ============================================================================
// ГЛАВНАЯ ФУНКЦИЯ: СОХРАНИТЬ И ВЫПОЛНИТЬ
// ============================================================================
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  try {
    clearLog();
    addLog(`🚀 CollectConfig v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_LAST_UPDATE})`, 'INFO');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📋 НАЧАЛО ВЫПОЛНЕНИЯ', 'INFO');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    
    // Валидация
    addLog(`📍 Целевая ячейка: ${sheetName}!${cellAddress}`, 'INFO');
    addLog(`📊 Конфигурация: ${JSON.stringify(config).substring(0, 100)}...`, 'INFO');
    
    if (!sheetName || !cellAddress || !config) {
      throw new Error('Отсутствуют обязательные параметры!');
    }
    
    // Сохраняем конфигурацию
    addLog('💾 Сохранение конфигурации...', 'INFO');
    const saved = saveCollectConfig(sheetName, cellAddress, config);
    if (saved) {
      addLog('✅ Конфигурация сохранена', 'SUCCESS');
    } else {
      addLog('⚠️ Ошибка сохранения', 'WARN');
    }
    
    // Выполняем
    addLog('🔥 Выполнение запроса...', 'INFO');
    const result = executeCollectConfig(sheetName, cellAddress);
    
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    if (result.success) {
      addLog('✅ УСПЕХ!', 'SUCCESS');
      addLog(`📝 Результат: ${result.result.length} символов`, 'INFO');
    } else {
      addLog('❌ ОШИБКА!', 'ERROR');
      addLog(`❌ ${result.error}`, 'ERROR');
    }
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    
    result.logs = getLog();
    return result;
    
  } catch (error) {
    addLog(`💥 КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, 'ERROR');
    addLog(`Stack: ${error.stack}`, 'ERROR');
    return {
      success: false,
      error: error.message,
      logs: getLog()
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
    
    addLog('📖 Конфигурация загружена', 'INFO');
    
    // Собираем System Prompt
    let systemPrompt = '';
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      addLog(`📍 System Prompt: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}`, 'INFO');
      try {
        systemPrompt = readData(config.systemPrompt.sheet, config.systemPrompt.cell);
        addLog(`✅ System Prompt: ${systemPrompt.length} символов`, 'SUCCESS');
      } catch (e) {
        addLog(`❌ Ошибка чтения System Prompt: ${e.message}`, 'ERROR');
        throw e;
      }
    } else {
      addLog('⚠️ System Prompt не задан', 'WARN');
    }
    
    // Собираем User Data
    const userDataParts = [];
    if (config.userData && config.userData.length > 0) {
      addLog(`📦 User Data: ${config.userData.length} источников`, 'INFO');
      
      config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          addLog(`  📍 Источник ${index + 1}: ${source.sheet}!${source.cell}`, 'INFO');
          try {
            const data = readData(source.sheet, source.cell);
            addLog(`  ✅ Прочитано: ${data.length} символов`, 'SUCCESS');
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            addLog(`  ❌ Ошибка: ${e.message}`, 'ERROR');
            userDataParts.push(`Источник (${source.sheet}!${source.cell}):\n[ОШИБКА: ${e.message}]`);
          }
        }
      });
    } else {
      addLog('⚠️ User Data не задан', 'WARN');
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
    
    addLog(`📝 Финальный промпт: ${finalPrompt.length} символов`, 'INFO');
    
    // Вызываем AI
    addLog('🤖 Отправка запроса в Gemini...', 'INFO');
    const aiResult = GM(finalPrompt);
    
    if (!aiResult || aiResult.startsWith('Error:')) {
      throw new Error('Ошибка AI: ' + aiResult);
    }
    
    addLog(`✅ Получен ответ от AI: ${aiResult.length} символов`, 'SUCCESS');
    
    // Записываем результат
    const targetSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (targetSheet) {
      targetSheet.getRange(cellAddress).setValue(aiResult);
      addLog(`✅ Результат записан в ${sheetName}!${cellAddress}`, 'SUCCESS');
    }
    
    // Обновляем lastRun
    updateLastRun(sheetName, cellAddress);
    
    return {
      success: true,
      result: aiResult
    };
    
  } catch (error) {
    addLog(`❌ executeCollectConfig ERROR: ${error.message}`, 'ERROR');
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================================
// ЧТЕНИЕ ДАННЫХ - МАКСИМАЛЬНО ПРОСТАЯ ВЕРСИЯ
// ============================================================================
function readData(sheetName, cellAddress) {
  addLog(`  → Чтение ${sheetName}!${cellAddress}`, 'INFO');
  
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не найден`);
    }
    
    // ПРОСТЕЙШИЙ подход: просто читаем диапазон как есть
    const range = sheet.getRange(cellAddress);
    const values = range.getValues();
    
    addLog(`  → Прочитано: ${values.length} строк × ${values[0].length} столбцов`, 'INFO');
    
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
    
    addLog(`  → После фильтрации: ${result.length} значений`, 'INFO');
    
    return result.join('\n');
    
  } catch (error) {
    addLog(`  ❌ Ошибка чтения: ${error.message}`, 'ERROR');
    throw new Error(`Не удалось прочитать ${sheetName}!${cellAddress}: ${error.message}`);
  }
}

// ============================================================================
// СОХРАНЕНИЕ/ЗАГРУЗКА КОНФИГУРАЦИИ
// ============================================================================
function saveCollectConfig(sheetName, cellAddress, config) {
  try {
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      throw new Error('Не удалось получить лист ConfigData');
    }
    
    // Ищем существующую строку для конфигурации ячейки
    const data = configSheet.getDataRange().getValues();
    let rowIndex = -1;
    let existingCreatedAt = new Date().toISOString();
    
    for (let i = 1; i < data.length; i++) {
      // Ищем конфигурацию ячейки (не шаблон)
      if (data[i][0] === sheetName && data[i][1] === cellAddress && data[i][6] !== true) {
        rowIndex = i + 1;
        existingCreatedAt = data[i][7] || existingCreatedAt;
        break;
      }
    }
    
    const rowData = [
      sheetName,                                    // SheetName
      cellAddress,                                  // CellAddress
      config.systemPrompt ? config.systemPrompt.sheet : '', // SystemPromptSheet
      config.systemPrompt ? config.systemPrompt.cell : '', // SystemPromptCell
      JSON.stringify(config.userData || []),        // UserDataJSON
      '',                                           // TemplateName (пусто для конфигураций)
      false,                                        // IsTemplate
      existingCreatedAt,                             // CreatedAt
      new Date().toISOString()                       // LastRun
    ];
    
    if (rowIndex > 0) {
      // Обновляем существующую конфигурацию
      configSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      addLog(`✅ Конфигурация обновлена: ${sheetName}!${cellAddress}`, 'INFO');
    } else {
      // Добавляем новую конфигурацию
      configSheet.appendRow(rowData);
      addLog(`✅ Конфигурация создана: ${sheetName}!${cellAddress}`, 'INFO');
    }
    
    return true;
  } catch (error) {
    addLog(`❌ Ошибка сохранения конфигурации: ${error.message}`, 'ERROR');
    return false;
  }
}

function loadCollectConfig(sheetName, cellAddress) {
  try {
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      return null;
    }
    
    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      // Ищем конфигурацию ячейки (не шаблон)
      if (data[i][0] === sheetName && data[i][1] === cellAddress && data[i][6] !== true) {
        let userData = [];
        try {
          if (data[i][4]) {
            userData = JSON.parse(data[i][4]);
          }
        } catch (e) {
          addLog(`⚠️ Ошибка парсинга UserData для ${sheetName}!${cellAddress}: ${e.message}`, 'WARN');
          userData = [];
        }
        
        return {
          systemPrompt: (data[i][2] && data[i][3]) ? {
            sheet: data[i][2],
            cell: data[i][3]
          } : null,
          userData: userData
        };
      }
    }
    
    return null;
  } catch (error) {
    addLog(`❌ Ошибка загрузки конфигурации: ${error.message}`, 'ERROR');
    return null;
  }
}

function updateLastRun(sheetName, cellAddress) {
  try {
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      return;
    }
    
    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      // Ищем конфигурацию ячейки (не шаблон)
      if (data[i][0] === sheetName && data[i][1] === cellAddress && data[i][6] !== true) {
        configSheet.getRange(i + 1, 9).setValue(new Date().toISOString()); // LastRun column
        addLog(`✅ Обновлён LastRun для ${sheetName}!${cellAddress}`, 'DEBUG');
        return;
      }
    }
  } catch (error) {
    addLog(`⚠️ Ошибка updateLastRun: ${error.message}`, 'WARN');
  }
}

// ============================================================================
// ФУНКЦИИ ДЛЯ UI: PREVIEW
// ============================================================================
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
        ui.ButtonSet.YES_NO
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
// ФУНКЦИИ ДЛЯ РАБОТЫ С ШАБЛОНАМИ В ConfigData ЛИСТЕ
// ============================================================================

/**
 * Создаёт или получает лист ConfigData
 */
function getOrCreateConfigSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let configSheet = ss.getSheetByName('ConfigData');
    
    if (!configSheet) {
      configSheet = ss.insertSheet('ConfigData');
      const headers = [
        'SheetName',
        'CellAddress', 
        'SystemPromptSheet',
        'SystemPromptCell',
        'UserDataJSON',
        'TemplateName',
        'IsTemplate',
        'CreatedAt',
        'LastRun'
      ];
      configSheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setFontWeight('bold')
        .setBackground('#E3E3E3');
      addLog('✅ Создан лист ConfigData', 'INFO');
    }
    
    return configSheet;
  } catch (error) {
    addLog(`❌ Ошибка создания ConfigData: ${error.message}`, 'ERROR');
    return null;
  }
}

/**
 * Сохраняет шаблон в лист ConfigData
 */
function saveTemplateToSheet(templateName, config) {
  try {
    if (!templateName || !config) {
      throw new Error('TemplateName и config обязательны');
    }
    
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      throw new Error('Не удалось получить лист ConfigData');
    }
    
    // Проверяем, существует ли уже шаблон
    const existingData = configSheet.getDataRange().getValues();
    for (let i = 1; i < existingData.length; i++) {
      if (existingData[i][5] === templateName && existingData[i][6] === true) {
        // Обновляем существующий шаблон
        const rowData = [
          existingData[i][0], // SheetName (пусто для шаблонов)
          existingData[i][1], // CellAddress (пусто для шаблонов)
          config.systemPrompt ? config.systemPrompt.sheet : '',
          config.systemPrompt ? config.systemPrompt.cell : '',
          JSON.stringify(config.userData || []),
          templateName,
          true, // IsTemplate
          existingData[i][7], // CreatedAt (сохраняем старую)
          new Date().toISOString() // LastRun
        ];
        configSheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
        addLog(`✅ Шаблон "${templateName}" обновлён в ConfigData`, 'INFO');
        return {success: true, message: 'Шаблон обновлён'};
      }
    }
    
    // Создаём новый шаблон
    const rowData = [
      '', // SheetName (пусто для шаблонов)
      '', // CellAddress (пусто для шаблонов)
      config.systemPrompt ? config.systemPrompt.sheet : '',
      config.systemPrompt ? config.systemPrompt.cell : '',
      JSON.stringify(config.userData || []),
      templateName,
      true, // IsTemplate
      new Date().toISOString(),
      '' // LastRun
    ];
    
    configSheet.appendRow(rowData);
    addLog(`✅ Шаблон "${templateName}" создан в ConfigData`, 'INFO');
    return {success: true, message: 'Шаблон создан'};
    
  } catch (error) {
    addLog(`❌ Ошибка сохранения шаблона: ${error.message}`, 'ERROR');
    return {success: false, message: error.message};
  }
}

/**
 * Загружает все шаблоны из листа ConfigData
 */
function getAllTemplatesFromSheet() {
  try {
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      return {};
    }
    
    const data = configSheet.getDataRange().getValues();
    const templates = {};
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][6] === true) { // IsTemplate column
        const templateName = data[i][5];
        if (templateName) {
          let userData = [];
          try {
            userData = JSON.parse(data[i][4] || '[]');
          } catch (e) {
            addLog(`⚠️ Ошибка парсинга UserData для шаблона "${templateName}": ${e.message}`, 'WARN');
            userData = [];
          }
          
          templates[templateName] = {
            systemPrompt: (data[i][2] && data[i][3]) ? {
              sheet: data[i][2],
              cell: data[i][3]
            } : null,
            userData: userData,
            created: data[i][7],
            lastRun: data[i][8]
          };
        }
      }
    }
    
    addLog(`📋 Загружено шаблонов из ConfigData: ${Object.keys(templates).length}`, 'INFO');
    return templates;
    
  } catch (error) {
    addLog(`❌ Ошибка загрузки шаблонов: ${error.message}`, 'ERROR');
    return {};
  }
}

/**
 * Удаляет шаблон из листа ConfigData
 */
function deleteTemplateFromSheet(templateName) {
  try {
    if (!templateName) {
      throw new Error('TemplateName обязателен');
    }
    
    const configSheet = getOrCreateConfigSheet();
    if (!configSheet) {
      throw new Error('Не удалось получить лист ConfigData');
    }
    
    const data = configSheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][6] === true && data[i][5] === templateName) {
        configSheet.deleteRow(i + 1);
        addLog(`✅ Шаблон "${templateName}" удалён из ConfigData`, 'INFO');
        return {success: true, message: 'Шаблон удалён'};
      }
    }
    
    return {success: false, message: 'Шаблон не найден'};
    
  } catch (error) {
    addLog(`❌ Ошибка удаления шаблона: ${error.message}`, 'ERROR');
    return {success: false, message: error.message};
  }
}

// ============================================================================
// ШАБЛОНЫ - ENDPOINTS ДЛЯ UI (обновлённые для ConfigData)
// ============================================================================
function serverGetAllTemplates() {
  try {
    const templates = getAllTemplatesFromSheet();
    return templates;
  } catch (e) {
    addLog(`❌ Ошибка serverGetAllTemplates: ${e.message}`, 'ERROR');
    return {};
  }
}

function serverGetTemplatesStats() {
  try {
    const templates = getAllTemplatesFromSheet();
    const count = Object.keys(templates).length;
    
    const templatesList = Object.keys(templates).map(name => ({
      name: name,
      created: templates[name].created,
      lastRun: templates[name].lastRun
    }));
    
    return {
      count: count,
      totalSize: JSON.stringify(templates).length,
      templates: templatesList
    };
  } catch (e) {
    addLog(`❌ Ошибка serverGetTemplatesStats: ${e.message}`, 'ERROR');
    return {count: 0, totalSize: 0, templates: []};
  }
}

function serverSaveTemplate(templateName, config) {
  try {
    return saveTemplateToSheet(templateName, config);
  } catch (e) {
    addLog(`❌ Ошибка serverSaveTemplate: ${e.message}`, 'ERROR');
    return {success: false, message: e.message};
  }
}

function serverDeleteTemplate(templateName) {
  try {
    return deleteTemplateFromSheet(templateName);
  } catch (e) {
    addLog(`❌ Ошибка serverDeleteTemplate: ${e.message}`, 'ERROR');
    return {success: false, message: e.message};
  }
}

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================
function getAllSheetNames() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(s => s.getName());
}

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
