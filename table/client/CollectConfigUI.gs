/**
 * Collect Config UI Functions - Client Side Only
 * Функции для работы с веб-интерфейсом настройки (только клиент)
 *
 * Version: 2.0.0 - Client-Server Architecture
 * Last updated: 2024-10-18
 */

/**
 * Открыть интерфейс настройки для текущей ячейки
 */
function openCollectConfigUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUI')
      .setWidth(700)
      .setTitle('🎯 Настройка AI запроса');

    SpreadsheetApp.getUi().showModalDialog(html, 'AI Конструктор');
  } catch (error) {
    // Fallback: простой prompt-based интерфейс
    SpreadsheetApp.getUi().alert(
      '❌ HTML интерфейс недоступен (нет разрешений UI).\n\n' +
      '💡 Альтернатива: используйте функцию quickCollectConfig() для быстрой настройки через prompts.',
    );

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

    while (addMore && sourceIndex <= 5) {
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
    const config = {
      systemPrompt: systemPrompt,
      userData: userData,
    };

    const cellInfo = {
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      sheetName: sheetName,
      a1Notation: cellAddress,
    };

    ui.alert('🚀 Запуск...', 'Отправляю запрос на сервер для обработки...', ui.ButtonSet.OK);

    // Вызываем серверный API
    const result = serverExecuteConfig(config, cellInfo);

    if (result.success) {
      ui.alert('✅ Готово!', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Ошибка выполнения', result.error || 'Неизвестная ошибка', ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ Ошибка', 'Произошла ошибка: ' + error.message, ui.ButtonSet.OK);
  }
}

/**
 * Получить контекст активной ячейки для UI
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
 * Показать справку по AI Конструктору
 */
function showCollectConfigHelp() {
  const ui = SpreadsheetApp.getUi();

  let helpText = '🎯 AI КОНСТРУКТОР v2.0 - КЛИЕНТ-СЕРВЕР\\n\\n';
  helpText += '🏗️ НОВАЯ АРХИТЕКТУРА:\\n';
  helpText += '• Клиент (этот проект): UI интерфейс\\n';
  helpText += '• Сервер: AI обработка и хранение данных\\n';
  helpText += '• Связь через HTTPS API\\n\\n';

  helpText += '💡 ПРОБЛЕМА:\\n';
  helpText += 'Google Sheets ограничивает формулу 50,000 символами.\\n';
  helpText += 'AI Конструктор собирает данные НА СЕРВЕРЕ!\\n\\n';

  helpText += '✅ КАК ИСПОЛЬЗОВАТЬ:\\n';
  helpText += '1. Выделите ячейку где нужен результат\\n';
  helpText += '2. Меню → 🎯 AI Конструктор → 🎯 Настроить запрос\\n';
  helpText += '3. Выберите System Prompt и источники данных\\n';
  helpText += '4. Нажмите "Запустить"\\n';
  helpText += '5. Сервер обработает и запишет результат\\n\\n';

  helpText += '🔐 БЕЗОПАСНОСТЬ:\\n';
  helpText += 'Все данные передаются через защищенный HTTPS\\n';
  helpText += 'Сервер имеет доступ только к указанным ячейкам\\n\\n';

  helpText += '📊 ШАБЛОНЫ:\\n';
  helpText += 'Сохраняются на сервере - доступны из любой таблицы!';

  ui.alert('🎯 AI Конструктор v2.0', helpText, ui.ButtonSet.OK);
}
