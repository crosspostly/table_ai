/**
 * TABLE AI - Unpacking Viewer Module
 * v1.1.0 - Redesigned data structure for proper A1/B1 heading display
 *
 * Модуль для просмотра и экспорта данных из листов "Распаковка" и "ЦА"
 *
 * Структура данных:
 * - A1 & B1: Основные заголовки
 * - A2: Подзаголовок для столбца A (отображается под A1)
 * - B2: Подзаголовок для столбца B (содержимое как обычный текст)
 * - Строки 3+: Данные для соответствующих столбцов
 *
 * Функции:
 * - openUnpackingViewer(): открытие модального окна
 * - getUnpackingData(): чтение данных из листов с новой структурой
 * - exportUnpackingToDoc(): экспорт в Google Docs
 * - logUnpacking(): безопасное логирование с fallback
 */

/**
 * Безопасное логирование с fallback на Logger.log()
 * Использует addLog() из Main.gs, если доступна
 * @param {string} message - Сообщение для логирования
 * @param {string} level - Уровень: INFO, DEBUG, WARN, ERROR (по умолчанию INFO)
 */
function logUnpacking(message, level) {
  const logLevel = level || 'INFO';

  try {
    // Проверяем наличие глобальной функции addLog
    if (typeof addLog === 'function') {
      addLog(`[UnpackingViewer] ${message}`, logLevel);
    } else {
      // Fallback: используем встроенный Logger
      const timestamp = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyy-MM-dd HH:mm:ss',
      );
      Logger.log(`[${timestamp}] ${logLevel}: ${message}`);
    }
  } catch (error) {
    // Критический fallback
    console.log(`[${logLevel}] ${message}`);
    console.error('Logging error:', error.message);
  }
}

/**
 * Открывает модальное окно просмотра данных из листа "Распаковка"
 */
// eslint-disable-next-line no-unused-vars
function openUnpackingViewer() {
  try {
    logUnpacking('📦 Открытие просмотра Распаковки', 'INFO');

    const html = HtmlService.createHtmlOutputFromFile('UnpackingViewerUI')
      .setWidth(700)
      .setHeight(800)
      .setTitle('📦 Просмотр Распаковка + ЦА');

    SpreadsheetApp.getUi().showModalDialog(html, '📦 Просмотр Распаковка + ЦА');

    logUnpacking('✅ Окно просмотра открыто', 'INFO');
  } catch (error) {
    logUnpacking('❌ Ошибка открытия окна: ' + error.message, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия окна:\n\n' + error.message);
  }
}

/**
 * Читает данные из листов "Распаковка" и "ЦА" с новой структурой заголовков
 * A1/B1 - основные заголовки, A2/B2 - подзаголовки, строки 3+ - данные
 * @return {Object} Объект с данными или ошибкой
 */
// eslint-disable-next-line no-unused-vars
function getUnpackingData() {
  try {
    logUnpacking('📖 Чтение данных из листов Распаковка и ЦА', 'INFO');

    // Получаем активную таблицу
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Получаем данные из обоих листов
    const unpackingData = getSheetData(ss, 'Распаковка');
    const caData = getSheetData(ss, 'ЦА');

    // Объединяем данные
    const allData = [];

    if (unpackingData.success && unpackingData.data.length > 0) {
      allData.push(...unpackingData.data);
      logUnpacking('✅ Добавлены данные из листа Распаковка: ' + unpackingData.data.length + ' полей', 'DEBUG');
    } else {
      logUnpacking('⚠️ Лист Распаковка пуст или не найден', 'DEBUG');
    }

    if (caData.success && caData.data.length > 0) {
      allData.push(...caData.data);
      logUnpacking('✅ Добавлены данные из листа ЦА: ' + caData.data.length + ' полей', 'DEBUG');
    } else {
      logUnpacking('⚠️ Лист ЦА пуст или не найден', 'DEBUG');
    }

    logUnpacking('📊 Всего полей из обоих листов: ' + allData.length, 'INFO');

    if (allData.length === 0) {
      return {
        success: false,
        data: [],
        error: 'На листах "Распаковка" и "ЦА" нет данных для отображения',
      };
    }

    return {
      success: true,
      data: allData,
      error: null,
    };
  } catch (error) {
    logUnpacking('❌ Ошибка чтения данных: ' + error.message, 'ERROR');
    return {
      success: false,
      data: [],
      error: 'Не удалось прочитать данные: ' + error.message,
    };
  }
}

/**
 * Вспомогательная функция для чтения данных из одного листа с новой структурой
 * Читает A1:B1 (основные заголовки), A2:B2 (подзаголовки), строки 3+ (данные)
 * @param {Spreadsheet} ss - Активная таблица
 * @param {string} sheetName - Имя листа
 * @return {Object} Объект с данными или ошибкой
 */
function getSheetData(ss, sheetName) {
  try {
    logUnpacking('📖 Чтение данных из листа ' + sheetName, 'DEBUG');

    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      logUnpacking('❌ Лист "' + sheetName + '" не найден', 'DEBUG');
      return {
        success: false,
        data: [],
        error: 'Лист "' + sheetName + '" не найден в таблице',
      };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 1) {
      return {
        success: false,
        data: [],
        error: 'На листе "' + sheetName + '" нет данных для отображения',
      };
    }

    const result = [];
    
    if (sheetName === 'ЦА') {
      // === ДЛЯ ЦА ===
      
      // Столбец A: A1 - заголовок, A2 - ОДНО значение (не массив!)
      const headerA = sheet.getRange('A1').getValue();
      const valueA = sheet.getRange('A2').getValue();
      
      if (headerA) {
        result.push({
          header: 'ЦА: ' + headerA.toString().trim(),
          value: valueA ? valueA.toString().trim() : '(нет данных)',
          count: valueA ? 1 : 0,
        });
      }
      
      // Столбец B: B1 - заголовок, B2+ - ВСЕ значения
      const headerB = sheet.getRange('B1').getValue();
      
      if (headerB) {
        const columnDataB = [];
        if (lastRow >= 2) {
          const dataRangeB = sheet.getRange(2, 2, lastRow - 1, 1);
          const dataValuesB = dataRangeB.getValues();
          
          for (let i = 0; i < dataValuesB.length; i++) {
            const cellValue = dataValuesB[i][0];
            if (cellValue && cellValue.toString().trim() !== '') {
              columnDataB.push(cellValue.toString().trim());
            }
          }
        }
        
        result.push({
          header: 'ЦА: ' + headerB.toString().trim(),
          value: columnDataB.length > 0 ? columnDataB.join('\n') : '(нет данных)',
          count: columnDataB.length,
        });
      }
      
    } else {
      // === ДЛЯ РАСПАКОВКИ (как было) ===
      
      const mainHeadersRange = sheet.getRange('A1:B1');
      const mainHeadersValues = mainHeadersRange.getValues()[0];

      const subHeadersRange = sheet.getRange('A2:B2');
      const subHeadersValues = subHeadersRange.getValues()[0];

      let dataValues = [];
      if (lastRow >= 3) {
        const dataRange = sheet.getRange(3, 1, lastRow - 2, 2);
        dataValues = dataRange.getValues();
      }

      // Столбец A
      if (mainHeadersValues[0]) {
        const mainTitle = mainHeadersValues[0].toString().trim();
        const subTitle = subHeadersValues[0] ? subHeadersValues[0].toString().trim() : '';

        const columnData = [];
        for (let rowIndex = 0; rowIndex < dataValues.length; rowIndex++) {
          const cellValue = dataValues[rowIndex][0];
          if (cellValue && cellValue.toString().trim() !== '') {
            columnData.push(cellValue.toString().trim());
          }
        }

        let fullHeader = sheetName + ': ' + mainTitle;
        if (subTitle) {
          fullHeader += ' → ' + subTitle;
        }

        result.push({
          header: fullHeader,
          value: columnData.length > 0 ? columnData.join('\n') : '(нет данных)',
          count: columnData.length,
        });
      }

      // Столбец B
      if (mainHeadersValues[1]) {
        const mainTitle = mainHeadersValues[1].toString().trim();
        const subTitle = subHeadersValues[1] ? subHeadersValues[1].toString().trim() : '';

        const columnData = [];
        for (let rowIndex = 0; rowIndex < dataValues.length; rowIndex++) {
          const cellValue = dataValues[rowIndex][1];
          if (cellValue && cellValue.toString().trim() !== '') {
            columnData.push(cellValue.toString().trim());
          }
        }

        let fullHeader = sheetName + ': ' + mainTitle;
        if (subTitle) {
          fullHeader += ' → ' + subTitle;
        }

        result.push({
          header: fullHeader,
          value: columnData.length > 0 ? columnData.join('\n') : '(нет данных)',
          count: columnData.length,
        });
      }
    }

    logUnpacking('✅ Сформировано полей из ' + sheetName + ': ' + result.length, 'DEBUG');

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    logUnpacking('❌ Ошибка чтения данных из ' + sheetName + ': ' + error.message, 'ERROR');
    return {
      success: false,
      data: [],
      error: 'Не удалось прочитать данные из ' + sheetName + ': ' + error.message,
    };
  }
}



/**
 * Экспортирует данные из листов "Распаковка" и "ЦА" в Google Docs документ
 * @return {Object} Объект с результатом экспорта
 */
// eslint-disable-next-line no-unused-vars
function exportUnpackingToDoc() {
  try {
    logUnpacking('📄 Начало экспорта в Google Docs', 'INFO');

    // Получаем данные из обоих листов
    const dataResponse = getUnpackingData();

    if (!dataResponse.success) {
      return dataResponse; // Возвращаем ошибку
    }

    const data = dataResponse.data;
    logUnpacking('📊 Данных для экспорта: ' + data.length, 'DEBUG');

    // Формируем имя файла
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
    const fileName = 'Распаковка_Экспорт_' + dateStr;

    logUnpacking('📝 Имя документа: ' + fileName, 'DEBUG');

    // Создаём Google Docs документ
    const doc = DocumentApp.create(fileName);
    const body = doc.getBody();

    // Очищаем документ
    body.clear();

    // === ЗАГОЛОВОК ДОКУМЕНТА ===
    const title = body.appendParagraph('📦 Данные листов Распаковка + ЦА');
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
      fieldHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      fieldHeader.setSpacingBefore(8);
      fieldHeader.setSpacingAfter(4);

      // Значение поля, разбитое по \n на отдельные параграфы
      const lines = (field.value || '').split('\n');
      lines.forEach((line) => {
        const para = body.appendParagraph('   ' + line);
        para.setFontSize(12);
        para.setIndentStart(20);
        para.setSpacingAfter(0);
        para.setBold(false); // ← Явно обычный текст, НЕ жирный
      });
      body.appendParagraph('');
      // Пустая строка между полями
      body.appendParagraph('');
      body.appendPageBreak();
    });

    // === ФУТЕР ===
    body.appendHorizontalRule();
    const footer = body.appendParagraph('Документ создан автоматически (данные из Распаковка + ЦА)');
    footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    footer.setFontSize(10);
    footer.setItalic(true);

    // Сохраняем документ
    doc.saveAndClose();
    logUnpacking('✅ Документ создан', 'INFO');

    // Получаем ID и URL
    const docId = doc.getId();
    const docUrl = 'https://docs.google.com/document/d/' + docId + '/edit';
    const downloadUrl = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';

    // Сохранить метаданные документа для "Мои файлы"
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('список_экспорт') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('список_экспорт');
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Наименование', 'Ссылка', 'Дата']);
      }
      sheet.appendRow([fileName, downloadUrl, new Date().toLocaleString()]);
    } catch (e) {
      logUnpacking('Ошибка при сохранении метаданных: ' + e.message, 'DEBUG');
    }

    logUnpacking('📄 URL документа: ' + docUrl, 'DEBUG');
    logUnpacking('💾 URL скачивания: ' + downloadUrl, 'DEBUG');

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
    logUnpacking('❌ Ошибка экспорта: ' + error.message, 'ERROR');
    logUnpacking('Stack: ' + error.stack, 'ERROR');

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


// Мой файлы - управление экспортированными документами

/**
 * Получить список с данными экспортированных документов
 */
// eslint-disable-next-line no-unused-vars
function getExportedDocuments() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('список_экспорт') || null;
  if (!sheet) return [];

  try {
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    const documents = [];

    data.forEach((row, index) => {
      if (row[0] && row[1]) {
        documents.push({
          rowIndex: index, // Используем rowIndex для совместимости с deleteExportedDocs
          name: row[0],
          url: row[1],
          date: row[2] || new Date().toLocaleString(),
        });
      }
    });

    return documents;
  } catch (e) {
    logUnpacking('Ошибка при получении документов: ' + e.message, 'ERROR');
    return [];
  }
}

/**
 * Удалить экспортированные документы
 * @param {array} indices - Индексы для удаления
 */
// eslint-disable-next-line no-unused-vars
function deleteExportedDocs(indices) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('список_экспорт') || null;
  if (!sheet) return;

  try {
    // Удалять по сортированным индексам в обратном порядке
    indices.sort((a, b) => b - a).forEach((index) => {
      sheet.deleteRow(index + 2);
    });
  } catch (e) {
    logUnpacking('Ошибка при удалении документов: ' + e.message, 'ERROR');
  }
}
