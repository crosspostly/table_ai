/**
 * Collect Config UI Functions
 * Функции для работы с веб-интерфейсом настройки
 * 
 * Version: 1.0.0
 * Last updated: 2024-10-14
 */

/**
 * Открыть интерфейс настройки для текущей ячейки
 * ИСПРАВЛЕНИЕ: Используем sidebar вместо dialog - требует меньше разрешений
 */
function openCollectConfigUI() {
  try {
    // ВАЖНО: Apps Script не поддерживает пути с папками!
    // Файл должен называться просто 'CollectConfigUI' в плоской структуре
    var html = HtmlService.createHtmlOutputFromFile('CollectConfigUI')
      .setWidth(700)
      .setTitle('🎯 Настройка AI запроса');
    
    // Теперь у нас есть UI разрешения! Используем удобный modal dialog
    SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
    
  } catch (error) {
    // Fallback: если sidebar тоже не работает, используем простой prompt-based интерфейс
    SpreadsheetApp.getUi().alert(
      '❌ HTML интерфейс недоступен (нет разрешений UI).\n\n' +
      '💡 Альтернатива: используйте функцию quickCollectConfig() для быстрой настройки через prompts.'
    );
    
    // Предлагаем простую альтернативу
    var useSimple = SpreadsheetApp.getUi().alert(
      'Простой интерфейс',
      'Хотите настроить AI запрос через простые диалоги?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO
    );
    
    if (useSimple === SpreadsheetApp.getUi().Button.YES) {
      quickCollectConfig();
    }
  }
}

/**
 * Простой интерфейс настройки через prompt диалоги
 * АЛЬТЕРНАТИВА для случаев когда HTML UI недоступен из-за разрешений
 */
function quickCollectConfig() {
  var ui = SpreadsheetApp.getUi();
  
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    
    if (!range) {
      ui.alert('⚠️ Внимание', 'Сначала выделите ячейку где нужен результат!', ui.ButtonSet.OK);
      return;
    }
    
    var sheetName = sheet.getName();
    var cellAddress = range.getA1Notation();
    
    // 1. System Prompt
    var systemPromptInfo = ui.prompt(
      'Шаг 1/3: System Prompt',
      'Введите адрес ячейки с инструкцией для AI\\n' +
      'Формат: ИмяЛиста!Адрес (например: Prompts!A1)\\n\\n' +
      'Или оставьте пустым, если нет:',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (systemPromptInfo.getSelectedButton() !== ui.Button.OK) return;
    
    var systemPrompt = null;
    var systemPromptText = systemPromptInfo.getResponseText().trim();
    if (systemPromptText && systemPromptText.includes('!')) {
      var parts = systemPromptText.split('!');
      systemPrompt = { sheet: parts[0], cell: parts[1] };
    }
    
    // 2. User Data Sources
    var userData = [];
    var addMore = true;
    var sourceIndex = 1;
    
    while (addMore && sourceIndex <= 5) { // Ограничиваем до 5 источников
      var sourceInfo = ui.prompt(
        'Шаг 2/3: Данные для анализа (источник ' + sourceIndex + ')',
        'Введите адрес ячейки/диапазона с данными:\\n' +
        'Формат: ИмяЛиста!Адрес (например: Data!A:A)\\n\\n' +
        'Или оставьте пустым, если больше нет данных:',
        ui.ButtonSet.OK_CANCEL
      );
      
      if (sourceInfo.getSelectedButton() !== ui.Button.OK) return;
      
      var sourceText = sourceInfo.getResponseText().trim();
      if (sourceText && sourceText.includes('!')) {
        var parts = sourceText.split('!');
        userData.push({ sheet: parts[0], cell: parts[1] });
        sourceIndex++;
      } else {
        addMore = false;
      }
    }
    
    if (userData.length === 0 && !systemPrompt) {
      ui.alert('⚠️ Ошибка', 'Нужно указать хотя бы System Prompt или источники данных!', ui.ButtonSet.OK);
      return;
    }
    
    // 3. Подтверждение и выполнение
    var summary = 'ПРОВЕРЬТЕ НАСТРОЙКИ:\\n\\n';
    summary += 'Результат будет записан в: ' + sheetName + '!' + cellAddress + '\\n\\n';
    summary += 'System Prompt: ' + (systemPrompt ? systemPrompt.sheet + '!' + systemPrompt.cell : 'не задан') + '\\n';
    summary += 'Источников данных: ' + userData.length + '\\n';
    
    for (var i = 0; i < userData.length; i++) {
      summary += '  • ' + userData[i].sheet + '!' + userData[i].cell + '\\n';
    }
    
    summary += '\\nНачать обработку?';
    
    var confirm = ui.alert('Шаг 3/3: Подтверждение', summary, ui.ButtonSet.YES_NO);
    
    if (confirm !== ui.Button.YES) return;
    
    // Создаем конфигурацию
    var config = {
      systemPrompt: systemPrompt,
      userData: userData
    };
    
    // Сохраняем и выполняем
    saveCollectConfig(sheetName, cellAddress, config);
    
    ui.alert('🚀 Запуск...', 'Конфигурация сохранена.\\nНачинаю обработку данных...', ui.ButtonSet.OK);
    
    var result = executeCollectConfig(sheetName, cellAddress);
    
    if (result.success) {
      ui.alert('✅ Готово!', 'Результат записан в ячейку ' + cellAddress, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Ошибка выполнения', result.error || 'Неизвестная ошибка', ui.ButtonSet.OK);
    }
    
  } catch (error) {
    ui.alert('❌ Ошибка', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Получить данные для инициализации интерфейса
 * @return {Object} {sheetName, cellAddress, sheets}
 */
function getCollectConfigInitData() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    
    if (!range) {
      throw new Error('Выделите ячейку!');
    }
    
    var sheetName = sheet.getName();
    var cellAddress = range.getA1Notation();
    var sheets = getAllSheetNames();
    
    return {
      sheetName: sheetName,
      cellAddress: cellAddress,
      sheets: sheets
    };
    
  } catch (error) {
    throw new Error('Ошибка инициализации: ' + error.message);
  }
}

/**
 * Обновить текущую ячейку по сохранённой конфигурации
 * Вызывается из меню "🔄 Обновить ячейку"
 */
function refreshCellWithConfig() {
  try {
    var ui = SpreadsheetApp.getUi();
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    
    if (!range) {
      ui.alert('⚠️ Внимание', 'Выделите ячейку!', ui.ButtonSet.OK);
      return;
    }
    
    var sheetName = sheet.getName();
    var cellAddress = range.getA1Notation();
    
    // Проверяем есть ли сохранённая конфигурация
    var config = loadCollectConfig(sheetName, cellAddress);
    
    if (!config) {
      var response = ui.alert(
        '⚠️ Конфигурация не найдена',
        'Для ячейки ' + sheetName + '!' + cellAddress + ' нет сохранённой конфигурации.\n\n' +
        'Хотите создать новую?',
        ui.ButtonSet.YES_NO
      );
      
      if (response == ui.Button.YES) {
        openCollectConfigUI();
      }
      return;
    }
    
    // Показываем информацию о запуске
    ui.alert(
      '🚀 Запуск обновления',
      'Конфигурация найдена!\n\n' +
      'System Prompt: ' + (config.systemPrompt ? 
        config.systemPrompt.sheet + '!' + config.systemPrompt.cell : 'не задан') + '\n' +
      'User Data: ' + config.userData.length + ' источник(ов)\n\n' +
      'Запускаю обработку...',
      ui.ButtonSet.OK
    );
    
    // Выполняем запрос
    var result = executeCollectConfig(sheetName, cellAddress);
    
    if (result.success) {
      // Записываем результат в ячейку
      range.setValue(result.result);
      
      ui.alert(
        '✅ Готово!',
        'Результат записан в ячейку ' + cellAddress,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '❌ Ошибка',
        'Не удалось выполнить запрос:\n' + result.error,
        ui.ButtonSet.OK
      );
    }
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

/**
 * Проверить есть ли конфигурация для текущей ячейки
 * @return {boolean}
 */
function hasConfigForCurrentCell() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    
    if (!range) {
      return false;
    }
    
    var sheetName = sheet.getName();
    var cellAddress = range.getA1Notation();
    var config = loadCollectConfig(sheetName, cellAddress);
    
    return config !== null;
    
  } catch (error) {
    return false;
  }
}

/**
 * Получить список всех листов в таблице
 * @return {Array<string>} Массив названий листов
 */
function getAllSheetNames() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var names = [];
    
    for (var i = 0; i < sheets.length; i++) {
      names.push(sheets[i].getName());
    }
    
    return names;
    
  } catch (error) {
    Logger.log('Error getting sheet names: ' + error.message);
    return [];
  }
}

/**
 * Получить предпросмотр содержимого ячейки (первые 100 символов)
 * @param {string} sheetName - Название листа
 * @param {string} cellAddress - Адрес ячейки (A1 notation)
 * @return {string} Первые 100 символов или "пусто"
 */
function getCellPreview(sheetName, cellAddress) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return '❌ Лист не найден';
    }
    
    var cell = sheet.getRange(cellAddress);
    var value = cell.getValue();
    
    if (!value || value.toString().trim() === '') {
      return '(пусто)';
    }
    
    var text = value.toString();
    
    if (text.length <= 100) {
      return text;
    }
    
    return text.substring(0, 100) + '...';
    
  } catch (error) {
    return '❌ Ошибка: ' + error.message;
  }
}

/**
 * Справка по AI Конструктору
 */
function showCollectConfigHelp() {
  var ui = SpreadsheetApp.getUi();
  
  var helpText = '🎯 AI КОНСТРУКТОР - ЧТО ЭТО?\n\n';
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
  
  helpText += '📊 ДАННЫЕ В JSON:\n';
  helpText += 'Все данные отправляются в AI в структурированном\n';
  helpText += 'JSON формате - нейросеть лучше понимает!\n\n';
  
  helpText += '🔒 ХРАНЕНИЕ:\n';
  helpText += 'Конфигурации сохраняются в скрытом листе\n';
  helpText += '"ConfigData" - нет лимитов, легко экспортировать!';
  
  ui.alert('🎯 AI Конструктор', helpText, ui.ButtonSet.OK);
}

// ============================================================================
// НОВЫЕ ФУНКЦИИ ДЛЯ TEMPLATE SYSTEM v2.0
// Endpoints для работы с шаблонами через TemplateService
// ============================================================================

/**
 * Получить контекст активной ячейки для UI
 * @return {{sheetName: string, a1Notation: string}}
 */
function getActiveCellContext() {
  try {
    var sheet = SpreadsheetApp.getActiveSheet();
    var range = sheet.getActiveRange();
    
    if (!range) {
      return {
        sheetName: null,
        a1Notation: null
      };
    }
    
    return {
      sheetName: sheet.getName(),
      a1Notation: range.getA1Notation()
    };
    
  } catch (e) {
    Logger.log('getActiveCellContext error: ' + e.message);
    return {
      sheetName: null,
      a1Notation: null
    };
  }
}

/**
 * Получить все шаблоны текущего пользователя
 * @return {Object} Объект с шаблонами {templateName: {config, created, updated}}
 */
function serverGetAllTemplates() {
  try {
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var templates = getAllTemplates(user); // Из TemplateService.gs
    
    // Преобразуем в формат для UI (только конфигурации)
    var result = {};
    for (var name in templates) {
      var template = templates[name];
      result[name] = template.config || template; // Совместимость с обоими форматами
    }
    
    return result;
    
  } catch (e) {
    Logger.log('serverGetAllTemplates error: ' + e.message);
    return {};
  }
}

/**
 * Получить конкретный шаблон по имени
 * @param {string} templateName - Имя шаблона
 * @return {Object|null} Конфигурация шаблона или null
 */
function serverGetTemplate(templateName) {
  try {
    if (!templateName) {
      throw new Error('Не указано имя шаблона');
    }
    
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var template = getTemplate(user, templateName); // Из TemplateService.gs
    
    if (!template) {
      return null;
    }
    
    // Возвращаем только конфигурацию (без метаданных)
    return template.config || template;
    
  } catch (e) {
    Logger.log('serverGetTemplate error: ' + e.message);
    return null;
  }
}

/**
 * Сохранить шаблон
 * @param {string} templateName - Имя шаблона
 * @param {Object} config - Конфигурация {systemPrompt: {sheet, cell}, userData: [{sheet, cell}]}
 * @return {{success: boolean, message: string}}
 */
function serverSaveTemplate(templateName, config) {
  try {
    if (!templateName || !config) {
      return {
        success: false,
        message: 'Не указано имя шаблона или конфигурация'
      };
    }
    
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var result = saveTemplate(user, templateName, config); // Из TemplateService.gs
    
    return result;
    
  } catch (e) {
    Logger.log('serverSaveTemplate error: ' + e.message);
    return {
      success: false,
      message: 'Ошибка сохранения: ' + e.message
    };
  }
}

/**
 * Удалить шаблон
 * @param {string} templateName - Имя шаблона для удаления
 * @return {{success: boolean, message: string}}
 */
function serverDeleteTemplate(templateName) {
  try {
    if (!templateName) {
      return {
        success: false,
        message: 'Не указано имя шаблона'
      };
    }
    
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var result = deleteTemplate(user, templateName); // Из TemplateService.gs
    
    return result;
    
  } catch (e) {
    Logger.log('serverDeleteTemplate error: ' + e.message);
    return {
      success: false,
      message: 'Ошибка удаления: ' + e.message
    };
  }
}

/**
 * Выполнить конфигурацию и записать результат в ячейку
 * @param {Object} config - Конфигурация {systemPrompt: {sheet, cell}, userData: [{sheet, cell}]}
 * @param {Object} cellInfo - Информация о целевой ячейке {sheetName, a1Notation}
 * @return {{success: boolean, result?: string, error?: string}}
 */
function serverExecuteConfig(config, cellInfo) {
  try {
    if (!cellInfo || !cellInfo.sheetName || !cellInfo.a1Notation) {
      return {
        success: false,
        error: 'Не указана целевая ячейка'
      };
    }
    
    if (!config) {
      return {
        success: false,
        error: 'Не указана конфигурация'
      };
    }
    
    var sheetName = cellInfo.sheetName;
    var cellAddress = cellInfo.a1Notation;
    
    // Временно сохраняем конфигурацию для этой ячейки (используем старый механизм)
    saveCollectConfig(sheetName, cellAddress, config);
    
    // Выполняем через существующую функцию
    var result = executeCollectConfig(sheetName, cellAddress);
    
    if (result.success) {
      // Записываем результат в ячейку
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(sheetName);
      
      if (sheet) {
        var range = sheet.getRange(cellAddress);
        range.setValue(result.result);
      }
      
      return {
        success: true,
        result: result.result
      };
    } else {
      return {
        success: false,
        error: result.error || 'Неизвестная ошибка'
      };
    }
    
  } catch (e) {
    Logger.log('serverExecuteConfig error: ' + e.message);
    return {
      success: false,
      error: 'Ошибка выполнения: ' + e.message
    };
  }
}

/**
 * Получить статистику по шаблонам текущего пользователя
 * @return {Object} Статистика {count, totalSize, templates[]}
 */
function serverGetTemplatesStats() {
  try {
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    return getTemplatesStats(user); // Из TemplateService.gs
  } catch (e) {
    Logger.log('serverGetTemplatesStats error: ' + e.message);
    return {
      count: 0,
      totalSize: 0,
      templates: []
    };
  }
}

// === CollectConfig Core Functions ===
// Добавлены из collect_config/ConfigurationManager.gs для автономности deploy/

/**
 * Выполнение AI запроса по сохраненной конфигурации.
 * @param {string} sheetName - Имя листа с результатом.
 * @param {string} cellAddress - Адрес ячейки с результатом.
 * @return {{success: boolean, result?: string, error?: string}}
 */
function executeCollectConfig(sheetName, cellAddress) {
  var logCtx = { traceId: Utilities.getUuid(), target: `'${sheetName}'!${cellAddress}` };
  addLog('executeCollectConfig START', 'INFO');

  try {
    var config = loadCollectConfig(sheetName, cellAddress);
    if (!config) throw new Error('Конфигурация не найдена. Настройте и сохраните запрос.');
    addLog('Config loaded successfully', 'DEBUG');

    var systemPrompt = '';
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      systemPrompt = collectDataFromRange(config.systemPrompt.sheet, config.systemPrompt.cell);
    }

    var userDataContent = [];
    if (config.userData) {
      config.userData.forEach(function(source) {
        if (source.sheet && source.cell) {
          try {
            var data = collectDataFromRange(source.sheet, source.cell);
            userDataContent.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            userDataContent.push(`Источник (${source.sheet}!${source.cell}):\n[ОШИБКА СБОРА ДАННЫХ: ${e.message}]`);
          }
        }
      });
    }
    
    var fullPrompt = (systemPrompt ? systemPrompt + '\n\n---\n\n' : '') + 
                     (userDataContent.length > 0 ? 'ДАННЫЕ ДЛЯ АНАЛИЗА:\n' + userDataContent.join('\n\n') : '');

    if (!fullPrompt.trim()) throw new Error('Нет данных для обработки. Настройте System Prompt или User Data.');

    // Используем GM() для совместимости с Main.gs (адаптация от GM_RAW)
    var geminiResult = GM(fullPrompt);

    if (!geminiResult || geminiResult.startsWith('Error:')) throw new Error('API Error: ' + geminiResult);

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(cellAddress).setValue(geminiResult);
    updateLastRun(sheetName, cellAddress);
    addLog('executeCollectConfig END', 'INFO');
    return { success: true, result: geminiResult };

  } catch (error) {
    addLog(`executeCollectConfig FAILED: ${error.message}`, 'ERROR');
    try {
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(cellAddress).setValue(`ОШИБКА: ${error.message}`);
    } catch(e) { /* ignore */ }
    return { success: false, error: error.message };
  }
}

/**
 * Сохранение конфигурации в скрытый лист ConfigData
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки
 * @param {Object} config - Конфигурация
 * @return {boolean} - успех сохранения
 */
function saveCollectConfig(sheetName, cellAddress, config) {
  try {
    if (!sheetName || !cellAddress || !config) throw new Error('Требуются sheetName, cellAddress и config');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName('ConfigData') || ss.insertSheet('ConfigData').hideSheet();
    if (configSheet.getLastRow() === 0) {
        var headers = ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun', 'ConfigName'];
        configSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    }
    
    var existingRowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
    var rowData = [
      sheetName, cellAddress,
      config.systemPrompt ? config.systemPrompt.sheet : '',
      config.systemPrompt ? config.systemPrompt.cell : '',
      JSON.stringify(config.userData || [])
    ];

    if (existingRowIndex > 0) {
      configSheet.getRange(existingRowIndex, 1, 1, 5).setValues([rowData]);
    } else {
      rowData.push(new Date().toISOString(), null, '');
      configSheet.appendRow(rowData);
    }
    return true;
  } catch (error) {
    addLog(`Ошибка сохранения конфигурации: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Загрузка конфигурации из скрытого листа ConfigData
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки
 * @return {Object|null} - конфигурация или null если не найдена
 */
function loadCollectConfig(sheetName, cellAddress) {
  var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigData');
  if (!configSheet) return null;
  var rowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
  if (rowIndex <= 0) return null;

  var rowData = configSheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
  var userData = [];
  try {
    if (rowData[4]) userData = JSON.parse(rowData[4]);
  } catch (e) { /* ignore malformed JSON */ }

  return {
    systemPrompt: (rowData[2] && rowData[3]) ? { sheet: rowData[2], cell: rowData[3] } : null,
    userData: userData,
    name: rowData[7] || ''
  };
}

/**
 * Найти существующую конфигурацию в таблице ConfigData
 * @param {GoogleAppsScript.Spreadsheet.Sheet} configSheet - Лист с конфигурациями
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки
 * @return {number} - номер строки или -1 если не найдено
 */
function findExistingConfig(configSheet, sheetName, cellAddress) {
  var data = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === sheetName && data[i][1] === cellAddress) return i + 2;
  }
  return -1;
}

/**
 * Обновить время последнего запуска для конфигурации
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки
 */
function updateLastRun(sheetName, cellAddress) {
  var configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigData');
  if (!configSheet) return;
  var rowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
  if (rowIndex > 0) {
    configSheet.getRange(rowIndex, 7).setValue(new Date().toISOString());
  }
}

/**
 * Сбор данных из диапазона ячеек
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки или диапазона
 * @return {string} - данные из ячеек, объединенные через \n
 */
function collectDataFromRange(sheetName, cellAddress) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error(`Лист \"${sheetName}\" не найден.`);
  
  if (/^[A-Z]+:[A-Z]+$/.test(cellAddress)) {
    var col = cellAddress.split(':')[0];
    var fullRangeAddress = `${col}1:${col}${sheet.getLastRow()}`;
    return sheet.getRange(fullRangeAddress).getValues().flat().filter(String).join('\n');
  } else {
    return sheet.getRange(cellAddress).getValues().flat().filter(String).join('\n');
  }
}
