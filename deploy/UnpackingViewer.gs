/**
 * TABLE AI - Unpacking Viewer Module
 * v1.0.0
 *
 * Модуль для просмотра и экспорта данных из листа "Распаковка"
 * Функции:
 * - openUnpackingViewer(): открытие модального окна
 * - getUnpackingData(): чтение данных из листа
 * - exportUnpackingToDoc(): экспорт в Google Docs
 */

/**
 * Открывает модальное окно просмотра данных из листа "Распаковка"
 */
// eslint-disable-next-line no-unused-vars
function openUnpackingViewer() {
  try {
    addLog('📦 Открытие просмотра Распаковки', 'INFO');

    const html = HtmlService.createHtmlOutputFromFile('UnpackingViewerUI')
      .setWidth(700)
      .setHeight(800)
      .setTitle('📦 Просмотр Распаковки');

    SpreadsheetApp.getUi().showModalDialog(html, '📦 Просмотр Распаковки');

    addLog('✅ Окно просмотра открыто', 'INFO');
  } catch (error) {
    addLog('❌ Ошибка открытия окна: ' + error.message, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия окна:\n\n' + error.message);
  }
}

/**
 * Читает данные из листа "Распаковка"
 * @return {Object} Объект с данными или ошибкой
 */
// eslint-disable-next-line no-unused-vars
function getUnpackingData() {
  try {
    addLog('📖 Чтение данных из листа Распаковка', 'INFO');

    // Получаем активную таблицу
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ищем лист "Распаковка"
    const sheet = ss.getSheetByName('Распаковка');

    if (!sheet) {
      addLog('❌ Лист "Распаковка" не найден', 'ERROR');
      return {
        success: false,
        data: [],
        error: 'Лист "Распаковка" не найден в таблице',
      };
    }

    // Читаем заголовки (строка 2, A2:H2)
    const headersRange = sheet.getRange('A2:H2');
    const headersValues = headersRange.getValues()[0];

    // Читаем данные (строка 3, A3:H3)
    const dataRange = sheet.getRange('A3:H3');
    const dataValues = dataRange.getValues()[0];

    addLog('📊 Прочитано заголовков: ' + headersValues.length, 'DEBUG');
    addLog('📊 Прочитано значений: ' + dataValues.length, 'DEBUG');

    // Формируем массив объектов {header, value}
    const result = [];

    for (let i = 0; i < headersValues.length; i++) {
      const header = headersValues[i];
      const value = dataValues[i];

      // Пропускаем пустые ячейки
      if (!header || header.toString().trim() === '') {
        continue;
      }

      result.push({
        header: header.toString().trim(),
        value: value ? value.toString().trim() : '(нет данных)',
      });
    }

    addLog('✅ Сформировано полей: ' + result.length, 'INFO');

    if (result.length === 0) {
      return {
        success: false,
        data: [],
        error: 'На листе "Распаковка" нет данных для отображения',
      };
    }

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    addLog('❌ Ошибка чтения данных: ' + error.message, 'ERROR');
    return {
      success: false,
      data: [],
      error: 'Не удалось прочитать данные: ' + error.message,
    };
  }
}

/**
 * Экспортирует данные из листа "Распаковка" в Google Docs документ
 * @return {Object} Объект с результатом экспорта
 */
// eslint-disable-next-line no-unused-vars
function exportUnpackingToDoc() {
  try {
    addLog('📄 Начало экспорта в Google Docs', 'INFO');

    // Получаем данные
    const dataResponse = getUnpackingData();

    if (!dataResponse.success) {
      return dataResponse; // Возвращаем ошибку
    }

    const data = dataResponse.data;
    addLog('📊 Данных для экспорта: ' + data.length, 'DEBUG');

    // Формируем имя файла
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
    const fileName = 'Распаковка_' + dateStr;

    addLog('📝 Имя документа: ' + fileName, 'DEBUG');

    // Создаём Google Docs документ
    const doc = DocumentApp.create(fileName);
    const body = doc.getBody();

    // Очищаем документ
    body.clear();

    // === ЗАГОЛОВОК ДОКУМЕНТА ===
    const title = body.appendParagraph('📦 Данные листа Распаковка');
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    // Подзаголовок с датой
    const subtitle = body.appendParagraph(
      'Создано: ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'dd MMMM yyyy, HH:mm'),
    );
    subtitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    subtitle.setFontSize(12);
    subtitle.setItalic(true);

    // Горизонтальная линия
    body.appendHorizontalRule();
    body.appendParagraph('');

    // === ДАННЫЕ ПОЛЕЙ ===
    data.forEach(function(field) {
      // Заголовок поля
      const fieldHeader = body.appendParagraph('📌 ' + field.header);
      fieldHeader.setFontSize(14);
      fieldHeader.setBold(true);
      fieldHeader.setSpacingBefore(8);
      fieldHeader.setSpacingAfter(4);

      // Значение поля
      const fieldValue = body.appendParagraph('   ' + field.value);
      fieldValue.setFontSize(12);
      fieldValue.setIndentStart(20);
      fieldValue.setSpacingAfter(8);

      // Пустая строка между полями
      body.appendParagraph('');
    });

    // === ФУТЕР ===
    body.appendHorizontalRule();
    const footer = body.appendParagraph('Документ создан автоматически');
    footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    footer.setFontSize(10);
    footer.setItalic(true);

    // Сохраняем документ
    doc.saveAndClose();
    addLog('✅ Документ создан', 'INFO');

    // Получаем ID и URL
    const docId = doc.getId();
    const docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
    const downloadUrl = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';

    addLog('📄 URL документа: ' + docUrl, 'DEBUG');
    addLog('💾 URL скачивания: ' + downloadUrl, 'DEBUG');

    // Возвращаем результат
    return {
      success: true,
      docId: docId,
      docUrl: docUrl,
      fileName: fileName,
      downloadUrl: downloadUrl,
      error: null,
    };
  } catch (error) {
    addLog('❌ Ошибка экспорта: ' + error.message, 'ERROR');
    addLog('Stack: ' + error.stack, 'ERROR');

    return {
      success: false,
      docId: null,
      docUrl: null,
      fileName: null,
      downloadUrl: null,
      error: 'Не удалось создать документ: ' + error.message,
    };
  }
}

/**
 * Обновляет распаковку - пересчитывает формулы в B3:G3
 * Вызывается из меню "📦 Обновить распаковку"
 *
 * ВАЖНО: Эта функция НЕ связана с AI Constructor (CollectConfig)!
 * Она работает напрямую с листом "Распаковка" и формулами GM_IF
 */
// eslint-disable-next-line no-unused-vars
function updateUnpackingConfigs() {
  try {
    addLog('🔄 Начало обновления распаковки', 'INFO');

    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Проверяем наличие листа Распаковка
    const sheet = ss.getSheetByName('Распаковка');

    if (!sheet) {
      addLog('❌ Лист "Распаковка" не найден', 'ERROR');
      ui.alert(
        '❌ Лист "Распаковка" не найден',
        'Создайте лист "Распаковка" для работы функции обновления.',
        ui.ButtonSet.OK,
      );
      return;
    }

    addLog('📋 Лист "Распаковка" найден', 'INFO');

    // Получаем диапазон B3:G3
    const range = sheet.getRange('B3:G3');
    const formulas = range.getFormulas()[0]; // Первая строка формул

    addLog('📊 Найдено ячеек: ' + formulas.length, 'DEBUG');

    // Считаем сколько ячеек с формулами
    let formulaCount = 0;
    let emptyCount = 0;

    for (let i = 0; i < formulas.length; i++) {
      if (formulas[i] && formulas[i].trim() !== '') {
        formulaCount++;
      } else {
        emptyCount++;
      }
    }

    addLog('✅ С формулами: ' + formulaCount + ', пустых: ' + emptyCount, 'INFO');

    if (formulaCount === 0) {
      addLog('⚠️ Нет формул для обновления', 'WARN');
      ui.alert(
        '⚠️ Нет формул',
        'В диапазоне B3:G3 нет GM-формул для обновления.\n\n' +
        'Используйте меню:\n' +
        '🤖 Table AI → ▶️ Подготовить формулы (умный режим)',
        ui.ButtonSet.OK,
      );
      return;
    }

    // Показываем предупреждение
    const response = ui.alert(
      '🔄 Обновить распаковку?',
      `Будут обновлены ${formulaCount} ячеек в диапазоне B3:G3.\n\n` +
      'Текущие данные будут перезаписаны.\n\n' +
      'Продолжить?',
      ui.ButtonSet.YES_NO,
    );

    if (response !== ui.Button.YES) {
      addLog('🚫 Обновление отменено пользователем', 'INFO');
      return;
    }

    addLog('🔄 Начинаем обновление формул...', 'INFO');

    // МЕТОД 1: Пересчёт формул через очистку и восстановление
    // Это заставит GM-формулы выполниться заново

    // Сохраняем текущие формулы
    const savedFormulas = [];
    for (let col = 2; col <= 7; col++) { // B=2, G=7
      const cell = sheet.getRange(3, col);
      const formula = cell.getFormula();
      savedFormulas.push({col: col, formula: formula});
      addLog('  📝 Сохранена формула в колонке ' + col + ': ' + formula.substring(0, 50) + '...', 'DEBUG');
    }

    // Очищаем содержимое (но не формулы целиком, а значения)
    addLog('🧹 Очистка текущих значений...', 'INFO');
    range.clearContent();
    SpreadsheetApp.flush(); // Применяем изменения

    // Небольшая задержка для Google Sheets
    Utilities.sleep(100);

    // Восстанавливаем формулы
    addLog('♻️ Восстановление формул...', 'INFO');
    let restoredCount = 0;

    for (let i = 0; i < savedFormulas.length; i++) {
      if (savedFormulas[i].formula && savedFormulas[i].formula.trim() !== '') {
        const cell = sheet.getRange(3, savedFormulas[i].col);
        cell.setFormula(savedFormulas[i].formula);
        restoredCount++;
        addLog('  ✅ Восстановлена формула в колонке ' + savedFormulas[i].col, 'DEBUG');
      }
    }

    SpreadsheetApp.flush(); // Применяем изменения

    addLog('✅ Восстановлено формул: ' + restoredCount, 'SUCCESS');
    addLog('🎉 Обновление распаковки завершено успешно!', 'SUCCESS');

    ui.alert(
      '✅ Обновление завершено',
      `Успешно обновлено ${restoredCount} формул в диапазоне B3:G3.\n\n` +
      'GM-формулы будут выполнены автоматически при выполнении условий.',
      ui.ButtonSet.OK,
    );
  } catch (error) {
    addLog('❌ Критическая ошибка обновления: ' + error.message, 'ERROR');
    addLog('Stack: ' + error.stack, 'ERROR');

    SpreadsheetApp.getUi().alert(
      '❌ Ошибка обновления',
      'Не удалось обновить распаковку:\n\n' + error.message + '\n\n' +
      'Проверьте логи для подробностей.',
      SpreadsheetApp.getUi().ButtonSet.OK,
    );
  }
}
