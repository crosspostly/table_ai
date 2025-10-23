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
    // Ensure we trigger OAuth consent for user email if needed (required for templates/presets)
    ensureEmailAuth();

    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
      .setWidth(700)
      .setTitle('🎯 AI Конструктор v3.0');
    
    SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
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
// AUTHORIZATION HELPER — TRIGGER OAUTH FOR userinfo.email SCOPE
// ============================================================================
/**
 * Ensures the script is authorized to access the user's email
 * by touching Session.getActiveUser().getEmail() without swallowing errors.
 * This intentionally has no try/catch so that Apps Script shows an OAuth prompt
 * if the scope hasn't been granted yet.
 * @return {string} email or empty string (for some accounts)
 */
function ensureEmailAuth() {
  // Touching this requires https://www.googleapis.com/auth/userinfo.email
  // If not authorized, Apps Script will prompt the user automatically.
  var email = Session.getActiveUser().getEmail();
  return email || '';
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
    
    const result = saveTemplate(user, 'По умолчанию', defaultTemplate);
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
      ''
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
    addLog(`Ошибка сохранения: ${error.message}`, 'ERROR');
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
            cell: data[i][3]
          } : null,
          userData: userData
        };
      }
    }
    
    return null;
  } catch (error) {
    addLog(`Ошибка загрузки: ${error.message}`, 'ERROR');
    return null;
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
// ШАБЛОНЫ - ENDPOINTS ДЛЯ UI
// ============================================================================
function serverGetAllTemplates() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);
    
    const result = {};
    for (const name in templates) {
      result[name] = templates[name].config || templates[name];
    }
    
    return result;
  } catch (e) {
    return {};
  }
}

function serverGetTemplate(templateName) {
  try {
    if (!templateName) {
      return null;
    }
    
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const template = getTemplate(user, templateName);
    
    if (!template) {
      return null;
    }
    
    return template.config || template;
  } catch (e) {
    return null;
  }
}

function serverGetTemplatesStats() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return getTemplatesStats(user);
  } catch (e) {
    return {count: 0, totalSize: 0, templates: []};
  }
}

function serverSaveTemplate(templateName, config) {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return saveTemplate(user, templateName, config);
  } catch (e) {
    return {success: false, message: e.message};
  }
}

function serverDeleteTemplate(templateName) {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return deleteTemplate(user, templateName);
  } catch (e) {
    return {success: false, message: e.message};
  }
}

// ============================================================================
// УДАЛЕНИЕ КОНФИГУРАЦИИ
// ============================================================================
function deleteCollectConfig(sheetName, cellAddress) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');
    
    if (!configSheet) {
      return {success: false, message: 'Нет сохранённых конфигураций'};
    }
    
    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        configSheet.deleteRow(i + 1);
        return {success: true, message: 'Конфигурация удалена'};
      }
    }
    
    return {success: false, message: 'Конфигурация не найдена'};
  } catch (error) {
    return {success: false, message: error.message};
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

// ============================================================================
// ПРОСТОЙ UI ДЛЯ УПРАВЛЕНИЯ ШАБЛОНАМИ
// ============================================================================
function openTemplatesUI() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);
    const templateNames = Object.keys(templates);
    
    if (templateNames.length === 0) {
      SpreadsheetApp.getUi().alert(
        '🗂️ Шаблоны',
        'У вас пока нет сохранённых шаблонов.\n\n' +
        'Создайте шаблон через:\n' +
        '🎯 Настроить запрос → заполните форму → 💾 Сохранить как шаблон',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }
    
    // Формируем список шаблонов
    let list = '📋 ВАШИ ШАБЛОНЫ (' + templateNames.length + '):\n\n';
    templateNames.forEach(function(name, index) {
      const tmpl = templates[name];
      const created = tmpl.created ? new Date(tmpl.created).toLocaleDateString('ru-RU') : '—';
      list += (index + 1) + '. ' + name + '\n   Создан: ' + created + '\n\n';
    });
    
    SpreadsheetApp.getUi().alert(
      '🗂️ Управление шаблонами',
      list,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('Ошибка', 'Не удалось загрузить шаблоны: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ============================================================================
// СПРАВКА ПО AI КОНСТРУКТОРУ
// ============================================================================
function showCollectConfigHelp() {
  const ui = SpreadsheetApp.getUi();

  let helpText = '🎯 AI КОНСТРУКТОР - ЧТО ЭТО?\n\n';
  helpText += '💡 ПРОБЛЕМА:\n';
  helpText += 'Google Sheets ограничивает формулу 50,000 символами.\n';
  helpText += 'Если вы собираете данные из многих ячеек:\n';
  helpText += '=GM("Промпт: " & A1 & A2 & ... & A1000)\n';
  helpText += '❌ Формула слишком длинная = ОШИБКА!\n\n';

  helpText += '✅ РЕШЕНИЕ:\n';
  helpText += 'AI Конструктор собирает данные НА СЕРВЕРЕ!\n';
  helpText += '1. Выбираете ячейку (например B3)\n';
  helpText += '2. Настраиваете:\n';
  helpText += '   • System Prompt - инструкция для AI\n';
  helpText += '   • User Data - листы и ячейки с данными\n';
  helpText += '3. Нажимаете "Запустить"\n';
  helpText += '4. Результат появляется в B3\n\n';

  helpText += '🎯 КАК ИСПОЛЬЗОВАТЬ:\n';
  helpText += '1. Выделите ячейку где нужен результат\n';
  helpText += '2. Меню → 🎯 AI Конструктор → 🎯 Настроить запрос\n';
  helpText += '3. Выберите лист и ячейку для System Prompt\n';
  helpText += '4. Добавьте источники данных (+ Добавить данные)\n';
  helpText += '5. Нажмите "Запустить"\n\n';

  helpText += '💾 НАСТРОЙКИ СОХРАНЯЮТСЯ!\n';
  helpText += 'При повторном открытии - все поля заполнены.\n';
  helpText += 'Можно быстро обновить: 🔄 Обновить ячейку\n\n';

  helpText += '🗂️ ШАБЛОНЫ:\n';
  helpText += 'Сохраняйте частые конфигурации как шаблоны!\n';
  helpText += 'Загружайте их в один клик через форму.\n\n';

  helpText += '🔒 ХРАНЕНИЕ:\n';
  helpText += 'Конфигурации сохраняются в скрытом листе\n';
  helpText += '"ConfigData" - нет лимитов, легко экспортировать!';

  ui.alert('🎯 AI Конструктор', helpText, ui.ButtonSet.OK);
}
