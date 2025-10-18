/**
 * Collect Config UI Functions
 * Функции для работы с веб-интерфейсом настройки
 *
 * Version: 1.0.0
 * Last updated: 2024-10-14
 */

/**
 * Открыть интерфейс настройки для текущей ячейки
 */
function openCollectConfigUI() {
  try {
    // ВАЖНО: Apps Script не поддерживает пути с папками!
    // Файл должен называться просто 'CollectConfigUI' в плоской структуре
    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUI')
      .setWidth(650)
      .setHeight(600)
      .setTitle('🎯 Настройка AI запроса');

    SpreadsheetApp.getUi().showModalDialog(html, 'Настройка запроса');
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия интерфейса: ' + error.message);
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return '❌ Лист не найден';
    }

    const cell = sheet.getRange(cellAddress);
    const value = cell.getValue();

    if (!value || value.toString().trim() === '') {
      return '(пусто)';
    }

    const text = value.toString();

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
