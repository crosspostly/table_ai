/**
 * Collect Config UI Functions
 * Функции для работы с веб-интерфейсом настройки
 *
 * Version: 2.1.0
 * Last updated: 2025-01-18 13:30:00
 */

const COLLECT_CONFIG_VERSION = '2.1.0';
const COLLECT_CONFIG_UPDATED = new Date('2025-01-18T13:30:00');

/**
 * Открыть интерфейс настройки для текущей ячейки
 * ИСПРАВЛЕНИЕ: Используем sidebar вместо dialog - требует меньше разрешений
 */
function openCollectConfigUI() {
  try {
    // ВАЖНО: Apps Script не поддерживает пути с папками!
    // Файл должен называться просто 'CollectConfig' в плоской структуре
    const html = HtmlService.createHtmlOutputFromFile('CollectConfig')
      .setWidth(700)
      .setTitle('🎯 Настройка AI запроса');

    // ФИШКА: Используем красивый modal dialog (требует UI разрешения в appsscript.json)
    SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
  } catch (error) {
    // Fallback: если sidebar тоже не работает, используем простой prompt-based интерфейс
    SpreadsheetApp.getUi().alert(
      '❌ HTML интерфейс недоступен (нет разрешений UI).\n\n' +
      '💡 Альтернатива: используйте функцию quickCollectConfig() для быстрой настройки через prompts.',
    );

    // Предлагаем простую альтернативу
    const useSimple = SpreadsheetApp.getUi().alert(
      'Простой интерфейс',
      'Хотите настроить AI запрос через простые диалоги?',
      SpreadsheetApp.getUi().ButtonSet.YES_NO,
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
  const ui = SpreadsheetApp.getUi();

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Внимание', 'Сначала выделите ячейку где нужен результат!', ui.ButtonSet.OK);
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    // 1. System Prompt
    const systemPromptInfo = ui.prompt(
      'Шаг 1/3: System Prompt',
      'Введите адрес ячейки с инструкцией для AI\\n' +
      'Формат: ИмяЛиста!Адрес (например: Prompts!A1)\\n\\n' +
      'Или оставьте пустым, если нет:',
      ui.ButtonSet.OK_CANCEL,
    );

    if (systemPromptInfo.getSelectedButton() !== ui.Button.OK) return;

    let systemPrompt = null;
    const systemPromptText = systemPromptInfo.getResponseText().trim();
    if (systemPromptText && systemPromptText.includes('!')) {
      var parts = systemPromptText.split('!');
      systemPrompt = {sheet: parts[0], cell: parts[1]};
    }

    // 2. User Data Sources
    const userData = [];
    let addMore = true;
    let sourceIndex = 1;

    while (addMore && sourceIndex <= 5) { // Ограничиваем до 5 источников
      const sourceInfo = ui.prompt(
        'Шаг 2/3: Данные для анализа (источник ' + sourceIndex + ')',
        'Введите адрес ячейки/диапазона с данными:\\n' +
        'Формат: ИмяЛиста!Адрес (например: Data!A:A)\\n\\n' +
        'Или оставьте пустым, если больше нет данных:',
        ui.ButtonSet.OK_CANCEL,
      );

      if (sourceInfo.getSelectedButton() !== ui.Button.OK) return;

      const sourceText = sourceInfo.getResponseText().trim();
      if (sourceText && sourceText.includes('!')) {
        var parts = sourceText.split('!');
        userData.push({sheet: parts[0], cell: parts[1]});
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
    let summary = 'ПРОВЕРЬТЕ НАСТРОЙКИ:\\n\\n';
    summary += 'Результат будет записан в: ' + sheetName + '!' + cellAddress + '\\n\\n';
    summary += 'System Prompt: ' + (systemPrompt ? systemPrompt.sheet + '!' + systemPrompt.cell : 'не задан') + '\\n';
    summary += 'Источников данных: ' + userData.length + '\\n';

    for (let i = 0; i < userData.length; i++) {
      summary += '  • ' + userData[i].sheet + '!' + userData[i].cell + '\\n';
    }

    summary += '\\nНачать обработку?';

    const confirm = ui.alert('Шаг 3/3: Подтверждение', summary, ui.ButtonSet.YES_NO);

    if (confirm !== ui.Button.YES) return;

    // Создаем конфигурацию
    const config = {
      systemPrompt: systemPrompt,
      userData: userData,
    };

    // Сохраняем и выполняем
    saveCollectConfig(sheetName, cellAddress, config);

    ui.alert('🚀 Запуск...', 'Конфигурация сохранена.\\nНачинаю обработку данных...', ui.ButtonSet.OK);

    const result = executeCollectConfig(sheetName, cellAddress);

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
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      throw new Error('Выделите ячейку!');
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();
    const sheets = getAllSheetNames();

    // ✅ Создаём базовый пресет при первом открытии
    createDefaultPreset();

    return {
      sheetName: sheetName,
      cellAddress: cellAddress,
      sheets: sheets,
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
    const ui = SpreadsheetApp.getUi();
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Внимание', 'Выделите ячейку!', ui.ButtonSet.OK);
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    // Проверяем есть ли сохранённая конфигурация
    const config = loadCollectConfig(sheetName, cellAddress);

    if (!config) {
      const response = ui.alert(
        '⚠️ Конфигурация не найдена',
        'Для ячейки ' + sheetName + '!' + cellAddress + ' нет сохранённой конфигурации.\n\n' +
        'Хотите создать новую?',
        ui.ButtonSet.YES_NO,
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
      ui.ButtonSet.OK,
    );

    // Выполняем запрос
    const result = executeCollectConfig(sheetName, cellAddress);

    if (result.success) {
      // Записываем результат в ячейку
      range.setValue(result.result);

      ui.alert(
        '✅ Готово!',
        'Результат записан в ячейку ' + cellAddress,
        ui.ButtonSet.OK,
      );
    } else {
      ui.alert(
        '❌ Ошибка',
        'Не удалось выполнить запрос:\n' + result.error,
        ui.ButtonSet.OK,
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
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      return false;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();
    const config = loadCollectConfig(sheetName, cellAddress);

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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const names = [];

    for (let i = 0; i < sheets.length; i++) {
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
    addLog('getCellPreview: вызвана с sheetName="' + sheetName + '", cellAddress="' + cellAddress + '"', 'INFO');

    // Валидация входных параметров - БОЛЕЕ СТРОГАЯ
    if (!sheetName || sheetName.trim() === '') {
      addLog('getCellPreview: sheetName пустой или не указан', 'WARN');
      return '⚠️ Не указан лист';
    }

    if (!cellAddress || cellAddress.trim() === '') {
      addLog('getCellPreview: cellAddress пустой или не указан', 'WARN');
      return '⚠️ Не указана ячейка';
    }

    const cleanAddress = cellAddress.trim();
    addLog('getCellPreview: cleanAddress="' + cleanAddress + '"', 'INFO');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      addLog('getCellPreview: лист "' + sheetName + '" не найден', 'ERROR');
      return '❌ Лист "' + sheetName + '" не найден';
    }

    addLog('getCellPreview: лист найден, пытаемся прочитать "' + cleanAddress + '"', 'INFO');
    const cell = sheet.getRange(cleanAddress);
    const value = cell.getValue();

    if (!value || value.toString().trim() === '') {
      addLog('getCellPreview: ячейка "' + cleanAddress + '" пустая', 'INFO');
      return '(пусто)';
    }

    const text = value.toString();
    addLog('getCellPreview: прочитано ' + text.length + ' символов', 'INFO');

    if (text.length <= 100) {
      return text;
    }

    return text.substring(0, 100) + '...';
  } catch (error) {
    addLog('getCellPreview ОШИБКА: ' + error.message, 'ERROR');
    return '❌ Ошибка: ' + error.message;
  }
}

/**
 * Справка по AI Конструктору
 */
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
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      return {
        sheetName: null,
        a1Notation: null,
      };
    }

    return {
      sheetName: sheet.getName(),
      a1Notation: range.getA1Notation(),
    };
  } catch (e) {
    Logger.log('getActiveCellContext error: ' + e.message);
    return {
      sheetName: null,
      a1Notation: null,
    };
  }
}

/**
 * Получить все шаблоны текущего пользователя
 * @return {Object} Объект с шаблонами {templateName: {config, created, updated}}
 */
function serverGetAllTemplates() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user); // Из TemplateService.gs

    // Преобразуем в формат для UI (только конфигурации)
    const result = {};
    for (const name in templates) {
      const template = templates[name];
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

    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const template = getTemplate(user, templateName); // Из TemplateService.gs

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
        message: 'Не указано имя шаблона или конфигурация',
      };
    }

    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const result = saveTemplate(user, templateName, config); // Из TemplateService.gs

    return result;
  } catch (e) {
    Logger.log('serverSaveTemplate error: ' + e.message);
    return {
      success: false,
      message: 'Ошибка сохранения: ' + e.message,
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
        message: 'Не указано имя шаблона',
      };
    }

    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const result = deleteTemplate(user, templateName); // Из TemplateService.gs

    return result;
  } catch (e) {
    Logger.log('serverDeleteTemplate error: ' + e.message);
    return {
      success: false,
      message: 'Ошибка удаления: ' + e.message,
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
        error: 'Не указана целевая ячейка',
      };
    }

    if (!config) {
      return {
        success: false,
        error: 'Не указана конфигурация',
      };
    }

    const sheetName = cellInfo.sheetName;
    const cellAddress = cellInfo.a1Notation;

    // Временно сохраняем конфигурацию для этой ячейки (используем старый механизм)
    saveCollectConfig(sheetName, cellAddress, config);

    // Выполняем через существующую функцию
    const result = executeCollectConfig(sheetName, cellAddress);

    if (result.success) {
      // Записываем результат в ячейку
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(sheetName);

      if (sheet) {
        const range = sheet.getRange(cellAddress);
        range.setValue(result.result);
      }

      return {
        success: true,
        result: result.result,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Неизвестная ошибка',
      };
    }
  } catch (e) {
    Logger.log('serverExecuteConfig error: ' + e.message);
    return {
      success: false,
      error: 'Ошибка выполнения: ' + e.message,
    };
  }
}

/**
 * Получить статистику по шаблонам текущего пользователя
 * @return {Object} Статистика {count, totalSize, templates[]}
 */
function serverGetTemplatesStats() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    return getTemplatesStats(user); // Из TemplateService.gs
  } catch (e) {
    Logger.log('serverGetTemplatesStats error: ' + e.message);
    return {
      count: 0,
      totalSize: 0,
      templates: [],
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
  const logCtx = {traceId: Utilities.getUuid(), target: `'${sheetName}'!${cellAddress}`};
  addLog(`🔧 Collect Config v${COLLECT_CONFIG_VERSION} (обновлено: ${COLLECT_CONFIG_UPDATED.toLocaleString('ru-RU')})`, 'INFO');
  addLog('executeCollectConfig START', 'INFO');

  try {
    const config = loadCollectConfig(sheetName, cellAddress);
    if (!config) throw new Error('Конфигурация не найдена. Настройте и сохраните запрос.');
    addLog('Config loaded successfully', 'DEBUG');

    let systemPrompt = '';
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      addLog(`🔍 СБОР System Prompt: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}`, 'INFO');
      try {
        systemPrompt = collectDataFromRange(config.systemPrompt.sheet, config.systemPrompt.cell);
        addLog(`✅ System Prompt собран: ${systemPrompt.length} символов`, 'INFO');
      } catch (e) {
        addLog(`❌ ОШИБКА сбора System Prompt: ${e.message}`, 'ERROR');
        throw e; // Пробрасываем дальше
      }
    } else {
      addLog('⚠️ System Prompt не указан', 'WARN');
    }

    const userDataContent = [];
    if (config.userData) {
      addLog(`🔍 СБОР User Data: ${config.userData.length} источников`, 'INFO');
      config.userData.forEach(function(source, index) {
        if (source.sheet && source.cell) {
          addLog(`  📍 Источник ${index + 1}: ${source.sheet}!${source.cell}`, 'INFO');
          try {
            const data = collectDataFromRange(source.sheet, source.cell);
            addLog(`  ✅ Источник ${index + 1}: собрано ${data.length} символов`, 'INFO');
            userDataContent.push(`Источник (${source.sheet}!${source.cell}):\n${data}`);
          } catch (e) {
            addLog(`  ❌ Источник ${index + 1} ОШИБКА: ${e.message}`, 'ERROR');
            userDataContent.push(`Источник (${source.sheet}!${source.cell}):\n[ОШИБКА СБОРА ДАННЫХ: ${e.message}]`);
          }
        }
      });
      addLog(`✅ User Data собран из ${userDataContent.length} источников`, 'INFO');
    } else {
      addLog('⚠️ User Data не указан', 'WARN');
    }

    const fullPrompt = (systemPrompt ? systemPrompt + '\n\n---\n\n' : '') +
                     (userDataContent.length > 0 ? 'ДАННЫЕ ДЛЯ АНАЛИЗА:\n' + userDataContent.join('\n\n') : '');

    if (!fullPrompt.trim()) throw new Error('Нет данных для обработки. Настройте System Prompt или User Data.');

    // Используем GM() для совместимости с Main.gs (адаптация от GM_RAW)
    const geminiResult = GM(fullPrompt);

    if (!geminiResult || geminiResult.startsWith('Error:')) throw new Error('API Error: ' + geminiResult);

    SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(cellAddress).setValue(geminiResult);
    updateLastRun(sheetName, cellAddress);
    addLog('executeCollectConfig END', 'INFO');
    return {success: true, result: geminiResult};
  } catch (error) {
    addLog(`executeCollectConfig FAILED: ${error.message}`, 'ERROR');
    try {
      SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName).getRange(cellAddress).setValue(`ОШИБКА: ${error.message}`);
    } catch (e) {/* ignore */}
    return {success: false, error: error.message};
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData') || ss.insertSheet('ConfigData').hideSheet();
    if (configSheet.getLastRow() === 0) {
      const headers = ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun', 'ConfigName'];
      configSheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#4285f4').setFontColor('white');
    }

    const existingRowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
    const rowData = [
      sheetName, cellAddress,
      config.systemPrompt ? config.systemPrompt.sheet : '',
      config.systemPrompt ? config.systemPrompt.cell : '',
      JSON.stringify(config.userData || []),
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
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigData');
  if (!configSheet) return null;
  const rowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
  if (rowIndex <= 0) return null;

  const rowData = configSheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
  let userData = [];
  try {
    if (rowData[4]) userData = JSON.parse(rowData[4]);
  } catch (e) {/* ignore malformed JSON */}

  return {
    systemPrompt: (rowData[2] && rowData[3]) ? {sheet: rowData[2], cell: rowData[3]} : null,
    userData: userData,
    name: rowData[7] || '',
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
  const data = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < data.length; i++) {
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
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigData');
  if (!configSheet) return;
  const rowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
  if (rowIndex > 0) {
    configSheet.getRange(rowIndex, 7).setValue(new Date().toISOString());
  }
}

/**
 * Сбор данных из диапазона ячеек - ПОЛНОСТЬЮ ПЕРЕПИСАННАЯ ВЕРСИЯ
 * Поддерживает ВСЕ форматы: A1, A1:B10, C:C, C1:C100, B1:B
 * @param {string} sheetName - Имя листа
 * @param {string} cellAddress - Адрес ячейки или диапазона (A1 notation)
 * @return {string} - данные из ячеек, объединенные через \n
 */
function collectDataFromRange(sheetName, cellAddress) {
  addLog(`━━━ collectDataFromRange START ━━━`, 'INFO');
  addLog(`  sheetName: "${sheetName}"`, 'INFO');
  addLog(`  cellAddress: "${cellAddress}"`, 'INFO');
  
  try {
    // ШАГ 1: Получаем лист
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    addLog(`  Spreadsheet: "${ss.getName()}"`, 'INFO');
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      const errorMsg = `Лист "${sheetName}" не найден`;
      addLog(`  ❌ ${errorMsg}`, 'ERROR');
      throw new Error(errorMsg);
    }
    addLog(`  ✅ Лист "${sheetName}" найден`, 'INFO');

    // ШАГ 2: Получаем размеры листа
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    addLog(`  Размеры листа: lastRow=${lastRow}, lastCol=${lastCol}`, 'INFO');

    // Если лист пустой - возвращаем пустую строку (НЕ ошибку!)
    if (lastRow === 0 || lastCol === 0) {
      addLog(`  ⚠️ Лист пуст, возвращаем пустую строку`, 'WARN');
      return '';
    }

    // ШАГ 3: Нормализация адреса
    const normalizedAddress = cellAddress.trim().toUpperCase();
    addLog(`  Нормализованный адрес: "${normalizedAddress}"`, 'INFO');

    // ШАГ 4: Определяем ТИП диапазона
    let rangeToRead = null;
    let rangeType = 'unknown';

    // Тип 1: Полный столбец (B:B, A:C)
    if (/^[A-Z]+:[A-Z]+$/.test(normalizedAddress)) {
      rangeType = 'full_column';
      const parts = normalizedAddress.split(':');
      rangeToRead = `${parts[0]}1:${parts[1]}${lastRow}`;
      addLog(`  Тип: полный столбец → "${rangeToRead}"`, 'INFO');
    }
    // Тип 2: Диапазон с числами (A1:B10, B1:B100, B1:B)
    else if (normalizedAddress.includes(':')) {
      rangeType = 'range';
      // Проверяем формат B1:B (столбец+число:столбец)
      const partialColRegex = /^([A-Z]+)(\d+):([A-Z]+)$/;
      const partialMatch = normalizedAddress.match(partialColRegex);
      
      if (partialMatch && partialMatch[1] === partialMatch[3]) {
        // B1:B → B1:B{lastRow}
        const col = partialMatch[1];
        const startRow = partialMatch[2];
        rangeToRead = `${col}${startRow}:${col}${lastRow}`;
        addLog(`  Тип: частичный столбец B1:B → "${rangeToRead}"`, 'INFO');
      } else {
        // Обычный диапазон A1:B10
        rangeToRead = normalizedAddress;
        addLog(`  Тип: обычный диапазон → "${rangeToRead}"`, 'INFO');
      }
    }
    // Тип 3: Одна ячейка (A1, B5, C100)
    else {
      rangeType = 'single_cell';
      rangeToRead = normalizedAddress;
      addLog(`  Тип: одна ячейка → "${rangeToRead}"`, 'INFO');
    }

    // ШАГ 5: Читаем данные БЕЗОПАСНО
    addLog(`  Попытка чтения диапазона: "${rangeToRead}"...`, 'INFO');
    
    let range;
    try {
      range = sheet.getRange(rangeToRead);
    } catch (getRangeError) {
      const errorMsg = `Google Sheets API ошибка при getRange("${rangeToRead}"): ${getRangeError.message}`;
      addLog(`  ❌ ${errorMsg}`, 'ERROR');
      throw new Error(errorMsg);
    }
    
    addLog(`  ✅ Range получен успешно`, 'INFO');
    
    // Получаем размеры диапазона
    const numRows = range.getNumRows();
    const numCols = range.getNumColumns();
    addLog(`  Размеры диапазона: ${numRows} строк × ${numCols} столбцов`, 'INFO');
    
    // Проверка что диапазон не пустой
    if (numRows === 0 || numCols === 0) {
      addLog(`  ⚠️ Диапазон имеет нулевые размеры, возвращаем пустую строку`, 'WARN');
      return '';
    }

    // Читаем значения
    const values = range.getValues();
    addLog(`  ✅ Значения прочитаны: ${values.length} строк`, 'INFO');

    // ШАГ 6: Обработка и фильтрация данных
    const flatValues = values.flat();
    addLog(`  После flat(): ${flatValues.length} значений`, 'INFO');
    
    const filteredValues = flatValues.filter(function(val) {
      return val !== null && val !== undefined && val.toString().trim() !== '';
    });
    addLog(`  После фильтрации: ${filteredValues.length} непустых значений`, 'INFO');

    // ШАГ 7: Формируем результат
    const result = filteredValues.join('\n');
    addLog(`  Результат: ${result.length} символов`, 'INFO');
    addLog(`━━━ collectDataFromRange END (SUCCESS) ━━━`, 'INFO');
    
    return result;
    
  } catch (error) {
    addLog(`━━━ collectDataFromRange END (ERROR) ━━━`, 'ERROR');
    addLog(`  Ошибка: ${error.message}`, 'ERROR');
    addLog(`  Stack: ${error.stack}`, 'ERROR');
    
    // КРИТИЧНО: НЕ бросаем ошибку дальше, возвращаем понятное сообщение
    throw new Error(`Не удалось прочитать ${sheetName}!${cellAddress}: ${error.message}`);
  }
}

// ============================================================================
// НОВЫЕ КРУТЫЕ ФУНКЦИИ для меню AI Конструктора
// ============================================================================

/**
 * 👁️ Просмотр конфигурации текущей ячейки
 */
function previewCurrentCellConfig() {
  const ui = SpreadsheetApp.getUi();

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Внимание', 'Выберите ячейку!', ui.ButtonSet.OK);
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();
    const config = loadCollectConfig(sheetName, cellAddress);

    if (!config) {
      ui.alert(
        '❌ Конфигурация не найдена',
        `Для ячейки ${sheetName}!${cellAddress} нет сохранённой конфигурации.`,
        ui.ButtonSet.OK,
      );
      return;
    }

    // Формируем информацию о конфигурации
    let preview = `🎯 КОНФИГУРАЦИЯ ЯЧЕЙКИ: ${sheetName}!${cellAddress}\n\n`;

    // System Prompt
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      preview += '📝 SYSTEM PROMPT:\n';
      preview += `   Источник: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}\n`;

      try {
        const systemContent = collectDataFromRange(config.systemPrompt.sheet, config.systemPrompt.cell);
        const systemPreview = systemContent.length > 200 ? systemContent.substring(0, 200) + '...' : systemContent;
        preview += `   Содержимое: ${systemPreview || '(пусто)'}\n\n`;
      } catch (e) {
        preview += `   Содержимое: ❌ Ошибка чтения: ${e.message}\n\n`;
      }
    } else {
      preview += '📝 SYSTEM PROMPT: не задан\n\n';
    }

    // User Data
    if (config.userData && config.userData.length > 0) {
      preview += `📊 ДАННЫЕ ДЛЯ АНАЛИЗА (${config.userData.length} источник${config.userData.length > 1 ? 'ов' : ''}):\n`;

      for (let i = 0; i < Math.min(config.userData.length, 5); i++) { // Показываем максимум 5 источников
        const source = config.userData[i];
        preview += `   ${i + 1}. ${source.sheet}!${source.cell}`;

        try {
          const sourceData = collectDataFromRange(source.sheet, source.cell);
          const sourcePreview = sourceData.length > 100 ? sourceData.substring(0, 100) + '...' : sourceData;
          preview += ` → ${sourcePreview || '(пусто)'}\n`;
        } catch (e) {
          preview += ` → ❌ Ошибка: ${e.message}\n`;
        }
      }

      if (config.userData.length > 5) {
        preview += `   ... и ещё ${config.userData.length - 5} источник${config.userData.length - 5 > 1 ? 'ов' : ''}\n`;
      }
    } else {
      preview += '📊 ДАННЫЕ ДЛЯ АНАЛИЗА: не заданы\n';
    }

    // Статистика
    preview += '\n📈 СТАТИСТИКА:\n';

    const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ConfigData');
    if (configSheet) {
      const rowIndex = findExistingConfig(configSheet, sheetName, cellAddress);
      if (rowIndex > 0) {
        const rowData = configSheet.getRange(rowIndex, 1, 1, 8).getValues()[0];
        const createdAt = rowData[5] ? new Date(rowData[5]).toLocaleString('ru-RU') : 'неизвестно';
        const lastRun = rowData[6] ? new Date(rowData[6]).toLocaleString('ru-RU') : 'никогда';

        preview += `   Создано: ${createdAt}\n`;
        preview += `   Последний запуск: ${lastRun}\n`;
      }
    }

    ui.alert('👁️ Просмотр конфигурации', preview, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Ошибка просмотра', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 📋 Скопировать конфигурацию текущей ячейки в буфер
 */
function copyCurrentCellConfig() {
  const ui = SpreadsheetApp.getUi();

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Внимание', 'Выберите ячейку!', ui.ButtonSet.OK);
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();
    const config = loadCollectConfig(sheetName, cellAddress);

    if (!config) {
      ui.alert(
        '❌ Конфигурация не найдена',
        `Для ячейки ${sheetName}!${cellAddress} нет сохранённой конфигурации.`,
        ui.ButtonSet.OK,
      );
      return;
    }

    // Сохраняем конфигурацию в буфер (Properties)
    const configJson = JSON.stringify(config);
    PropertiesService.getScriptProperties().setProperty('COPIED_CONFIG', configJson);
    PropertiesService.getScriptProperties().setProperty('COPIED_CONFIG_SOURCE', `${sheetName}!${cellAddress}`);

    ui.alert(
      '📋 Конфигурация скопирована!',
      `Конфигурация из ${sheetName}!${cellAddress} скопирована в буфер.\n\n` +
      'Теперь выберите другую ячейку и используйте:\n' +
      '"📥 Вставить конфигурацию"',
      ui.ButtonSet.OK,
    );
  } catch (error) {
    ui.alert('❌ Ошибка копирования', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 📥 Вставить конфигурацию в текущую ячейку из буфера
 */
function pasteConfigToCurrentCell() {
  const ui = SpreadsheetApp.getUi();

  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const range = sheet.getActiveRange();

    if (!range) {
      ui.alert('⚠️ Внимание', 'Выберите ячейку!', ui.ButtonSet.OK);
      return;
    }

    const sheetName = sheet.getName();
    const cellAddress = range.getA1Notation();

    // Получаем конфигурацию из буфера
    const configJson = PropertiesService.getScriptProperties().getProperty('COPIED_CONFIG');
    const configSource = PropertiesService.getScriptProperties().getProperty('COPIED_CONFIG_SOURCE');

    if (!configJson) {
      ui.alert(
        '❌ Буфер пуст',
        'Сначала скопируйте конфигурацию из другой ячейки:\n' +
        '"📋 Скопировать конфигурацию"',
        ui.ButtonSet.OK,
      );
      return;
    }

    let config;
    try {
      config = JSON.parse(configJson);
    } catch (e) {
      ui.alert('❌ Ошибка буфера', 'Повреждённая конфигурация в буфере', ui.ButtonSet.OK);
      return;
    }

    // Проверяем, есть ли уже конфигурация в этой ячейке
    const existingConfig = loadCollectConfig(sheetName, cellAddress);
    if (existingConfig) {
      const overwrite = ui.alert(
        '⚠️ Перезаписать конфигурацию?',
        `В ячейке ${sheetName}!${cellAddress} уже есть конфигурация.\n\n` +
        'Перезаписать её конфигурацией из:\n' +
        (configSource || 'неизвестного источника') + '?',
        ui.ButtonSet.YES_NO,
      );

      if (overwrite !== ui.Button.YES) {
        return;
      }
    }

    // Сохраняем конфигурацию
    const saved = saveCollectConfig(sheetName, cellAddress, config);

    if (saved) {
      ui.alert(
        '✅ Конфигурация вставлена!',
        `Конфигурация из ${configSource || 'буфера'} вставлена в ${sheetName}!${cellAddress}.\n\n` +
        'Можете сразу запустить:\n"🔄 Обновить ячейку"',
        ui.ButtonSet.OK,
      );
    } else {
      ui.alert('❌ Ошибка сохранения', 'Не удалось сохранить конфигурацию', ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ Ошибка вставки', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * 🗂️ Управление шаблонами
 */
function showTemplateManager() {
  const ui = SpreadsheetApp.getUi();

  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);
    const templateNames = Object.keys(templates);

    if (templateNames.length === 0) {
      const createNew = ui.alert(
        '🗂️ Шаблоны не найдены',
        'У вас пока нет сохранённых шаблонов.\n\n' +
        'Хотите создать шаблон из текущей ячейки?',
        ui.ButtonSet.YES_NO,
      );

      if (createNew === ui.Button.YES) {
        createTemplateFromCurrentCell();
      }
      return;
    }

    // Показываем список шаблонов
    let templateList = '🗂️ УПРАВЛЕНИЕ ШАБЛОНАМИ\n\n';
    templateList += `Найдено шаблонов: ${templateNames.length}\n\n`;

    for (let i = 0; i < Math.min(templateNames.length, 10); i++) { // Показываем до 10 шаблонов
      const name = templateNames[i];
      const template = templates[name];
      const created = template.created ? new Date(template.created).toLocaleDateString('ru-RU') : 'неизвестно';
      templateList += `${i + 1}. ${name} (создан: ${created})\n`;
    }

    if (templateNames.length > 10) {
      templateList += `... и ещё ${templateNames.length - 10} шаблон${templateNames.length - 10 > 1 ? 'ов' : ''}\n`;
    }

    templateList += '\nВыберите действие:';

    const action = ui.prompt(
      '🗂️ Управление шаблонами',
      templateList + '\n\n' +
      '1 - Применить шаблон к текущей ячейке\n' +
      '2 - Удалить шаблон\n' +
      '3 - Создать новый шаблон\n' +
      '4 - Просмотр содержимого шаблона\n\n' +
      'Введите номер действия:',
      ui.ButtonSet.OK_CANCEL,
    );

    if (action.getSelectedButton() !== ui.Button.OK) return;

    const choice = action.getResponseText().trim();

    switch (choice) {
    case '1':
      applyTemplateToCurrentCell(templateNames);
      break;
    case '2':
      deleteTemplateDialog(templateNames);
      break;
    case '3':
      createTemplateFromCurrentCell();
      break;
    case '4':
      previewTemplateDialog(templateNames, templates);
      break;
    default:
      ui.alert('❌ Неверный выбор', 'Введите номер от 1 до 4', ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ Ошибка управления шаблонами', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Применить шаблон к текущей ячейке
 */
function applyTemplateToCurrentCell(templateNames) {
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    ui.alert('⚠️ Внимание', 'Выберите ячейку!', ui.ButtonSet.OK);
    return;
  }

  const templateChoice = ui.prompt(
    '🎯 Применить шаблон',
    'Доступные шаблоны:\n\n' +
    templateNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
    '\n\nВведите номер или имя шаблона:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (templateChoice.getSelectedButton() !== ui.Button.OK) return;

  const input = templateChoice.getResponseText().trim();
  let templateName;

  if (/^\d+$/.test(input)) {
    const index = parseInt(input, 10) - 1;
    if (index >= 0 && index < templateNames.length) {
      templateName = templateNames[index];
    }
  } else {
    templateName = input;
  }

  if (!templateName || templateNames.indexOf(templateName) === -1) {
    ui.alert('❌ Шаблон не найден', 'Указанный шаблон не существует', ui.ButtonSet.OK);
    return;
  }

  const user = Session.getActiveUser().getEmail() || 'anonymous';
  const template = getTemplate(user, templateName);

  if (!template) {
    ui.alert('❌ Ошибка загрузки', 'Не удалось загрузить шаблон', ui.ButtonSet.OK);
    return;
  }

  const sheetName = sheet.getName();
  const cellAddress = range.getA1Notation();

  const config = template.config || template;
  const saved = saveCollectConfig(sheetName, cellAddress, config);

  if (saved) {
    ui.alert(
      '✅ Шаблон применён!',
      `Шаблон "${templateName}" применён к ячейке ${sheetName}!${cellAddress}.\n\n` +
      'Можете сразу запустить:\n"🔄 Обновить ячейку"',
      ui.ButtonSet.OK,
    );
  } else {
    ui.alert('❌ Ошибка применения', 'Не удалось применить шаблон', ui.ButtonSet.OK);
  }
}

/**
 * Создать шаблон из текущей ячейки
 */
function createTemplateFromCurrentCell() {
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActiveSheet();
  const range = sheet.getActiveRange();

  if (!range) {
    ui.alert('⚠️ Внимание', 'Выберите ячейку с настроенной конфигурацией!', ui.ButtonSet.OK);
    return;
  }

  const sheetName = sheet.getName();
  const cellAddress = range.getA1Notation();
  const config = loadCollectConfig(sheetName, cellAddress);

  if (!config) {
    ui.alert(
      '❌ Конфигурация не найдена',
      `Для ячейки ${sheetName}!${cellAddress} нет конфигурации.\n\n` +
      'Сначала настройте ячейку через:\n"🎯 Настроить запрос"',
      ui.ButtonSet.OK,
    );
    return;
  }

  const templateName = ui.prompt(
    '💾 Сохранить как шаблон',
    'Введите имя для нового шаблона:\n\n' +
    '(Используйте понятные названия, например:\n' +
    '"Анализ отзывов", "Сводка продаж", "Извлечение данных")',
    ui.ButtonSet.OK_CANCEL,
  );

  if (templateName.getSelectedButton() !== ui.Button.OK) return;

  const name = templateName.getResponseText().trim();
  if (!name) {
    ui.alert('❌ Пустое имя', 'Имя шаблона не может быть пустым', ui.ButtonSet.OK);
    return;
  }

  const user = Session.getActiveUser().getEmail() || 'anonymous';
  const result = saveTemplate(user, name, config);

  if (result.success) {
    ui.alert(
      '✅ Шаблон создан!',
      `Шаблон "${name}" успешно сохранён.\n\n` +
      'Теперь его можно применить к любой ячейке через:\n' +
      '"🗂️ Управление шаблонами"',
      ui.ButtonSet.OK,
    );
  } else {
    ui.alert('❌ Ошибка создания', result.message || 'Не удалось создать шаблон', ui.ButtonSet.OK);
  }
}

/**
 * Удалить шаблон
 */
function deleteTemplateDialog(templateNames) {
  const ui = SpreadsheetApp.getUi();

  const templateChoice = ui.prompt(
    '🗑️ Удалить шаблон',
    'ВНИМАНИЕ: Это действие необратимо!\n\n' +
    'Доступные шаблоны:\n\n' +
    templateNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
    '\n\nВведите номер или имя шаблона для удаления:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (templateChoice.getSelectedButton() !== ui.Button.OK) return;

  const input = templateChoice.getResponseText().trim();
  let templateName;

  if (/^\d+$/.test(input)) {
    const index = parseInt(input, 10) - 1;
    if (index >= 0 && index < templateNames.length) {
      templateName = templateNames[index];
    }
  } else {
    templateName = input;
  }

  if (!templateName || templateNames.indexOf(templateName) === -1) {
    ui.alert('❌ Шаблон не найден', 'Указанный шаблон не существует', ui.ButtonSet.OK);
    return;
  }

  const confirm = ui.alert(
    '⚠️ Подтверждение удаления',
    `Удалить шаблон "${templateName}"?\n\nЭто действие нельзя отменить!`,
    ui.ButtonSet.YES_NO,
  );

  if (confirm !== ui.Button.YES) return;

  const user = Session.getActiveUser().getEmail() || 'anonymous';
  const result = deleteTemplate(user, templateName);

  if (result.success) {
    ui.alert('✅ Шаблон удалён', `Шаблон "${templateName}" успешно удалён.`, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ Ошибка удаления', result.message || 'Не удалось удалить шаблон', ui.ButtonSet.OK);
  }
}

/**
 * Просмотр содержимого шаблона
 */
function previewTemplateDialog(templateNames, templates) {
  const ui = SpreadsheetApp.getUi();

  const templateChoice = ui.prompt(
    '👁️ Просмотр шаблона',
    'Доступные шаблоны:\n\n' +
    templateNames.map((name, i) => `${i + 1}. ${name}`).join('\n') +
    '\n\nВведите номер или имя шаблона:',
    ui.ButtonSet.OK_CANCEL,
  );

  if (templateChoice.getSelectedButton() !== ui.Button.OK) return;

  const input = templateChoice.getResponseText().trim();
  let templateName;

  if (/^\d+$/.test(input)) {
    const index = parseInt(input, 10) - 1;
    if (index >= 0 && index < templateNames.length) {
      templateName = templateNames[index];
    }
  } else {
    templateName = input;
  }

  if (!templateName || templateNames.indexOf(templateName) === -1) {
    ui.alert('❌ Шаблон не найден', 'Указанный шаблон не существует', ui.ButtonSet.OK);
    return;
  }

  const template = templates[templateName];
  const config = template.config || template;

  let preview = `🗂️ ШАБЛОН: ${templateName}\n\n`;

  // System Prompt
  if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
    preview += `📝 System Prompt: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}\n`;
  } else {
    preview += '📝 System Prompt: не задан\n';
  }

  // User Data
  if (config.userData && config.userData.length > 0) {
    preview += `📊 Данные (${config.userData.length} источник${config.userData.length > 1 ? 'ов' : ''}):\n`;
    for (let i = 0; i < Math.min(config.userData.length, 5); i++) {
      const source = config.userData[i];
      preview += `   ${i + 1}. ${source.sheet}!${source.cell}\n`;
    }
    if (config.userData.length > 5) {
      preview += `   ... и ещё ${config.userData.length - 5}\n`;
    }
  } else {
    preview += '📊 Данные: не заданы\n';
  }

  // Метаданные
  if (template.created) {
    preview += `\n🕒 Создан: ${new Date(template.created).toLocaleString('ru-RU')}`;
  }
  if (template.updated) {
    preview += `\n🔄 Обновлён: ${new Date(template.updated).toLocaleString('ru-RU')}`;
  }

  ui.alert('👁️ Просмотр шаблона', preview, ui.ButtonSet.OK);
}

/**
 * 📊 Статистика использования AI Конструктора
 */
function showConfigStats() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');

    let stats = '📊 СТАТИСТИКА AI КОНСТРУКТОРА\n\n';

    if (!configSheet || configSheet.getLastRow() <= 1) {
      stats += '❌ Нет данных\n';
      stats += 'Конфигурации не найдены.\n\n';
      stats += '💡 Создайте первую конфигурацию:\n';
      stats += '🎯 AI Конструктор → Настроить запрос';
    } else {
      const data = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 8).getValues();
      var totalConfigs = data.length;
      const sheetsUsed = new Set();
      var runCounts = 0;
      let oldestConfig = null;
      let newestConfig = null;
      let mostRecentRun = null;

      for (var i = 0; i < data.length; i++) {
        const row = data[i];
        var sheetName = row[0];
        const createdAt = row[5];
        const lastRun = row[6];

        if (sheetName) sheetsUsed.add(sheetName);
        if (lastRun) runCounts++;

        if (createdAt) {
          const created = new Date(createdAt);
          if (!oldestConfig || created < oldestConfig) {
            oldestConfig = created;
          }
          if (!newestConfig || created > newestConfig) {
            newestConfig = created;
          }
        }

        if (lastRun) {
          const run = new Date(lastRun);
          if (!mostRecentRun || run > mostRecentRun) {
            mostRecentRun = run;
          }
        }
      }

      stats += '📈 ОБЩАЯ СТАТИСТИКА:\n';
      stats += `   Всего конфигураций: ${totalConfigs}\n`;
      stats += `   Активных (запускались): ${runCounts}\n`;
      stats += `   Неиспользованных: ${totalConfigs - runCounts}\n`;
      stats += `   Задействовано листов: ${sheetsUsed.size}\n\n`;

      if (oldestConfig) {
        stats += '📅 ВРЕМЕННЫЕ ДАННЫЕ:\n';
        stats += `   Первая конфигурация: ${oldestConfig.toLocaleString('ru-RU')}\n`;
      }
      if (newestConfig) {
        stats += `   Последняя конфигурация: ${newestConfig.toLocaleString('ru-RU')}\n`;
      }
      if (mostRecentRun) {
        stats += `   Последний запуск: ${mostRecentRun.toLocaleString('ru-RU')}\n\n`;
      }

      // Статистика по листам
      const sheetStats = {};
      for (var i = 0; i < data.length; i++) {
        var sheetName = data[i][0];
        if (sheetName) {
          sheetStats[sheetName] = (sheetStats[sheetName] || 0) + 1;
        }
      }

      if (Object.keys(sheetStats).length > 0) {
        stats += '📋 ПО ЛИСТАМ:\n';
        const sortedSheets = Object.keys(sheetStats).sort((a, b) => sheetStats[b] - sheetStats[a]);
        for (var i = 0; i < Math.min(sortedSheets.length, 5); i++) {
          const sheet = sortedSheets[i];
          stats += `   ${sheet}: ${sheetStats[sheet]} конфигураций\n`;
        }
        if (sortedSheets.length > 5) {
          stats += `   ... и ещё ${sortedSheets.length - 5} лист${sortedSheets.length - 5 > 1 ? 'ов' : ''}\n`;
        }
      }
    }

    // Статистика по шаблонам
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);
    const templateCount = Object.keys(templates).length;

    stats += '\n🗂️ ШАБЛОНЫ:\n';
    stats += `   Сохранённых шаблонов: ${templateCount}\n`;

    if (templateCount > 0) {
      const templateNames = Object.keys(templates).slice(0, 3);
      stats += `   Последние: ${templateNames.join(', ')}`;
      if (templateCount > 3) {
        stats += ` и ещё ${templateCount - 3}`;
      }
      stats += '\n';
    }

    stats += '\n💡 РЕКОМЕНДАЦИИ:\n';
    if (totalConfigs === 0) {
      stats += '   • Создайте первую конфигурацию\n';
      stats += '   • Попробуйте простую настройку\n';
    } else if (runCounts === 0) {
      stats += '   • Запустите созданные конфигурации\n';
      stats += '   • Используйте "🔄 Обновить ячейку"\n';
    } else {
      stats += '   • Создавайте шаблоны из удачных конфигураций\n';
      stats += '   • Копируйте настройки между ячейками\n';
    }

    ui.alert('📊 Статистика использования', stats, ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ Ошибка статистики', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * КРИТИЧНО: Функция которая вызывается из HTML UI
 * Сохраняет конфигурацию и сразу выполняет её
 * @param {string} sheetName - имя листа где находится целевая ячейка
 * @param {string} cellAddress - адрес целевой ячейки (куда писать результат)
 * @param {Object} config - конфигурация с systemPrompt и userData
 * @return {Object} - {success: boolean, result?: string, error?: string}
 */
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  try {
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');
    addLog(`🚀 saveAndExecuteCollectConfig START`, 'INFO');
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');
    
    // ✅ КРИТИЧНО: Валидация входных параметров
    addLog(`📋 ВХОДНЫЕ ПАРАМЕТРЫ:`, 'INFO');
    addLog(`  sheetName: "${sheetName}" (type: ${typeof sheetName}, length: ${sheetName ? sheetName.length : 0})`, 'INFO');
    addLog(`  cellAddress: "${cellAddress}" (type: ${typeof cellAddress}, length: ${cellAddress ? cellAddress.length : 0})`, 'INFO');
    addLog(`  config: ${JSON.stringify(config)}`, 'INFO');
    
    if (!sheetName || sheetName.trim() === '') {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: sheetName пуст или undefined!');
    }
    if (!cellAddress || cellAddress.trim() === '') {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: cellAddress пуст или undefined!');
    }
    if (!config) {
      throw new Error('❌ КРИТИЧЕСКАЯ ОШИБКА: config is null или undefined!');
    }
    
    addLog(`✅ Валидация входных параметров пройдена`, 'INFO');
    
    // Детальная валидация конфигурации
    addLog(`📊 ДЕТАЛИ КОНФИГУРАЦИИ:`, 'INFO');
    if (config.systemPrompt) {
      addLog(`  System Prompt: ${config.systemPrompt.sheet}!${config.systemPrompt.cell}`, 'INFO');
      if (!config.systemPrompt.sheet || !config.systemPrompt.cell) {
        addLog(`  ⚠️ WARNING: System Prompt имеет пустые поля!`, 'WARN');
      }
    } else {
      addLog(`  System Prompt: НЕ УКАЗАН`, 'WARN');
    }
    
    if (config.userData && config.userData.length > 0) {
      addLog(`  User Data источников: ${config.userData.length}`, 'INFO');
      config.userData.forEach(function(source, index) {
        addLog(`    [${index + 1}] ${source.sheet}!${source.cell}`, 'INFO');
        if (!source.sheet || !source.cell) {
          addLog(`    ⚠️ WARNING: Источник [${index + 1}] имеет пустые поля!`, 'WARN');
        }
      });
    } else {
      addLog(`  User Data: ПУСТО (нет источников данных)`, 'WARN');
    }
    
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');
    addLog(`💾 ШАГ 1: СОХРАНЕНИЕ КОНФИГУРАЦИИ`, 'INFO');
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');

    // 1. Сначала СОХРАНЯЕМ конфигурацию
    const saveSuccess = saveCollectConfig(sheetName, cellAddress, config);
    if (saveSuccess) {
      addLog('✅ Конфигурация успешно сохранена в ConfigData', 'SUCCESS');
    } else {
      addLog('⚠️ Конфигурация НЕ сохранена (saveCollectConfig вернул false)', 'WARN');
    }

    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');
    addLog(`🔥 ШАГ 2: ВЫПОЛНЕНИЕ КОНФИГУРАЦИИ`, 'INFO');
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');

    // 2. Затем ВЫПОЛНЯЕМ её
    const result = executeCollectConfig(sheetName, cellAddress);
    
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');
    addLog(`🏁 saveAndExecuteCollectConfig END`, result.success ? 'SUCCESS' : 'ERROR');
    addLog(`  success: ${result.success}`, result.success ? 'SUCCESS' : 'ERROR');
    if (result.error) {
      addLog(`  error: ${result.error}`, 'ERROR');
    }
    if (result.result) {
      addLog(`  result length: ${result.result.length} символов`, 'INFO');
    }
    addLog(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'INFO');

    return result;
  } catch (error) {
    const errorMsg = `💥 saveAndExecuteCollectConfig CRASHED: ${error.message}`;
    addLog(errorMsg, 'ERROR');
    addLog(`Stack trace: ${error.stack}`, 'ERROR');
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Создать базовый пресет с часто используемыми настройками
 * ВЫЗЫВАЕТСЯ АВТОМАТИЧЕСКИ при первом открытии UI
 */
function createDefaultPreset() {
  try {
    const user = Session.getActiveUser().getEmail() || 'anonymous';
    const templates = getAllTemplates(user);
    
    // Если уже есть пресет "По умолчанию", не создаём
    if (templates['По умолчанию']) {
      return;
    }
    
    // Создаём базовую конфигурацию
    const defaultConfig = {
      systemPrompt: {
        sheet: 'Prompt_box',
        cell: 'E2'
      },
      userData: [
        {
          sheet: 'отзывы',
          cell: 'B:B' // Автоматически конвертируется из B1:B
        }
      ]
    };
    
    // Сохраняем как шаблон
    saveTemplate(user, 'По умолчанию', defaultConfig);
    addLog('✅ Создан базовый пресет "По умолчанию"', 'INFO');
  } catch (error) {
    addLog(`Ошибка создания базового пресета: ${error.message}`, 'WARN');
  }
}
