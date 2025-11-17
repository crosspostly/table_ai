/**
 * ============================================================================
 * EXPORT TO DOCUMENT - Word/PDF Export Functionality
 * ============================================================================
 * Версия: 1.0.0
 *
 * Функционал экспорта листов Google Sheets в Word/PDF документы
 * через боковую панель с красивым форматированием
 * ============================================================================
 */

/**
 * Открывает боковую панель для экспорта
 */
// eslint-disable-next-line no-unused-vars
function openExportSidebar() {
  try {
    addLog('📄 Открытие панели экспорта', 'INFO');

    const html = HtmlService.createHtmlOutputFromFile('ExportToDocumentUI')
      .setTitle('📄 Экспорт в Word/PDF')
      .setWidth(400);

    SpreadsheetApp.getUi().showSidebar(html);

    addLog('✅ Панель экспорта открыта', 'SUCCESS');
  } catch (e) {
    addLog('❌ Ошибка открытия панели: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка открытия панели: ' + e.message);
  }
}

/**
 * Получает данные для инициализации UI
 * @return {Object} Объект с доступными листами
 */
// eslint-disable-next-line no-unused-vars
function getExportInitData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();

    const sheetList = sheets.map(function(sheet) {
      return {
        name: sheet.getName(),
        rowCount: sheet.getLastRow(),
        colCount: sheet.getLastColumn(),
      };
    });

    addLog('📊 Доступные листы: ' + sheetList.length, 'INFO');

    return {
      success: true,
      sheets: sheetList,
      currentSheet: ss.getActiveSheet().getName(),
    };
  } catch (e) {
    addLog('❌ Ошибка получения списка листов: ' + e.message, 'ERROR');
    return {
      success: false,
      error: e.message,
      sheets: [],
    };
  }
}

/**
 * Экспортирует лист в Word/PDF
 * @param {string} sheetName - Название листа
 * @param {string} format - Формат: 'word', 'pdf', или 'both'
 * @param {Object} _options - Дополнительные настройки форматирования
 * @return {Object} Результат с ссылками на файлы
 */
// eslint-disable-next-line no-unused-vars
function exportSheetToDocument(sheetName, format, _options) {
  try {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📄 НАЧАЛО ЭКСПОРТА', 'INFO');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('📋 Лист: ' + sheetName, 'INFO');
    addLog('📦 Формат: ' + format, 'INFO');

    // Валидация параметров
    if (!sheetName || !format) {
      throw new Error('Не указаны обязательные параметры!');
    }

    // Получаем лист
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист "' + sheetName + '" не найден!');
    }

    // Читаем данные
    addLog('📖 Чтение данных из листа...', 'INFO');
    let lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      throw new Error('Лист пустой!');
    }

    addLog('📊 Размер: ' + lastRow + ' строк × ' + lastCol + ' колонок', 'INFO');

    // ✅ ОГРАНИЧЕНИЕ ДЛЯ БОЛЬШИХ ТАБЛИЦ
    const BATCH_SIZE = 100; // Обрабатываем по 100 строк за раз
    const MAX_ROWS = 500; // Максимальный лимит для избежания timeout
    if (lastRow > MAX_ROWS) {
      addLog('⚠️ Таблица слишком большая (' + lastRow + ' строк), обрезаем до ' + MAX_ROWS + ' строк', 'WARN');
      lastRow = MAX_ROWS;
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    // Создаем Google Docs документ
    addLog('📝 Создание документа...', 'INFO');
    const docName = 'Экспорт из ' + sheetName + ' (' + new Date().toLocaleString('ru-RU') + ')';
    const doc = DocumentApp.create(docName);
    const body = doc.getBody();

    // Добавляем заголовок
    addLog('🎨 Форматирование документа...', 'INFO');
    const title = body.appendParagraph(docName);
    title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

    const timestamp = body.appendParagraph('Дата экспорта: ' + new Date().toLocaleString('ru-RU'));
    timestamp.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    timestamp.setFontSize(10);
    timestamp.setForegroundColor('#666666');

    body.appendHorizontalRule();
    body.appendParagraph(''); // Пустая строка

    // ✅ УМНОЕ СОЗДАНИЕ ТАБЛИЦЫ С БАТЧИНГОМ
    addLog('📊 Создание таблицы с красивым форматированием...', 'INFO');

    // Создаем таблицу с заголовком
    const headerData = [data[0]]; // Только первая строка (заголовок)
    let table = body.appendTable(headerData);

    // ✅ КРАСИВОЕ ФОРМАТИРОВАНИЕ ЗАГОЛОВКА
    const headerRow = table.getRow(0);
    const numCells = headerRow.getNumCells();

    for (let c = 0; c < numCells; c++) {
      const cell = headerRow.getCell(c);
      cell.setBackgroundColor('#4285f4');
      cell.getChild(0).asParagraph().setForegroundColor('#FFFFFF');
      cell.getChild(0).asParagraph().setBold(true);
      cell.setPaddingTop(8);
      cell.setPaddingBottom(8);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
    }

    // ✅ ДОБАВЛЯЕМ ОСТАЛЬНЫЕ СТРОКИ БАТЧАМИ С КРАСИВЫМ ФОРМАТИРОВАНИЕМ
    for (let startRow = 1; startRow < data.length; startRow += BATCH_SIZE) {
      const endRow = Math.min(startRow + BATCH_SIZE, data.length);
      const batchData = data.slice(startRow, endRow);

      addLog(`🎨 Обработка строк ${startRow}-${endRow} из ${data.length} с форматированием...`, 'INFO');

      // Добавляем батч строк с красивым форматированием
      for (let r = 0; r < batchData.length; r++) {
        const rowData = batchData[r];
        const newRow = table.appendTableRow();

        for (let c = 0; c < rowData.length; c++) {
          const cell = newRow.appendTableCell(rowData[c] ? String(rowData[c]) : '—');

          // ✅ КРАСИВОЕ ЧЕРЕДУЮЩЕЕСЯ ФОРМАТИРОВАНИЕ
          const bgColor = ((startRow + r) % 2 === 0) ? '#FFFFFF' : '#F3F3F3';
          cell.setBackgroundColor(bgColor);
          cell.setPaddingTop(6);
          cell.setPaddingBottom(6);
          cell.setPaddingLeft(8);
          cell.setPaddingRight(8);

          // Заменяем пустые ячейки на "—"
          const text = cell.getText().trim();
          if (!text) {
            cell.clear();
            cell.appendParagraph('—');
          }
        }
      }

      // ✅ СОХРАНЯЕМ ПОСЛЕ КАЖДОГО БАТЧА (кроме последнего)
      if (endRow < data.length) {
        addLog('💾 Сохранение прогресса...', 'INFO');
        doc.saveAndClose();
        Utilities.sleep(300); // Небольшая пауза

        // Переоткрываем документ
        doc = DocumentApp.openById(doc.getId());
        body = doc.getBody();
        table = body.getTables()[0]; // Получаем ту же таблицу
      }
    }

    // ✅ ФИНАЛЬНОЕ ОФОРМЛЕНИЕ ТАБЛИЦЫ
    table.setBorderWidth(0.5);
    table.setBorderColor('#CCCCCC');

    addLog('✅ Таблица создана и красиво отформатирована', 'SUCCESS');

    // Экспорт файлов
    const docId = doc.getId();
    const docFile = DriveApp.getFileById(docId);

    const result = {
      success: true,
      docId: docId,
      docName: docName,
    };

    // Создаем или находим папку для экспортов
    const folder = getOrCreateExportFolder();
    addLog('📁 Папка для сохранения: ' + folder.getName(), 'INFO');

    // Экспорт в Word
    if (format === 'word' || format === 'both') {
      addLog('📄 Экспорт в Word...', 'INFO');
      try {
        // ✅ ПРАВИЛЬНЫЙ СПОСОБ: используем URL для экспорта в DOCX
        const docUrl = 'https://docs.google.com/document/d/' + docId + '/export?format=docx';

        const blob = UrlFetchApp.fetch(docUrl, {
          headers: {
            'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
          },
        }).getBlob();

        const wordFile = folder.createFile(blob);
        wordFile.setName(sheetName + '_export.docx');
        result.wordUrl = wordFile.getUrl();
        result.wordId = wordFile.getId();
        addLog('✅ Word файл создан: ' + wordFile.getName(), 'SUCCESS');
      } catch (e) {
        addLog('⚠️ Ошибка экспорта в Word: ' + e.message, 'WARN');
        result.wordError = e.message;
      }
    }

    // Экспорт в PDF
    if (format === 'pdf' || format === 'both') {
      addLog('📄 Экспорт в PDF...', 'INFO');
      try {
        const pdfBlob = docFile.getAs('application/pdf');
        const pdfFile = folder.createFile(pdfBlob);
        pdfFile.setName(sheetName + '_export.pdf');
        result.pdfUrl = pdfFile.getUrl();
        result.pdfId = pdfFile.getId();
        addLog('✅ PDF файл создан: ' + pdfFile.getName(), 'SUCCESS');
      } catch (e) {
        addLog('⚠️ Ошибка экспорта в PDF: ' + e.message, 'WARN');
        result.pdfError = e.message;
      }
    }

    // Перемещаем исходный Google Docs в папку экспортов
    docFile.moveTo(folder);

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
    addLog('✅ ЭКСПОРТ ЗАВЕРШЕН УСПЕШНО!', 'SUCCESS');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');

    return result;
  } catch (e) {
    addLog('❌ КРИТИЧЕСКАЯ ОШИБКА: ' + e.message, 'ERROR');
    addLog('Stack: ' + e.stack, 'ERROR');
    return {
      success: false,
      error: e.message,
    };
  }
}

/**
 * Создает или находит папку для экспортов
 * @return {Folder} Папка Google Drive
 */
function getOrCreateExportFolder() {
  try {
    const folderName = 'Table AI Exports';
    const folders = DriveApp.getFoldersByName(folderName);

    if (folders.hasNext()) {
      return folders.next();
    }
    const newFolder = DriveApp.createFolder(folderName);
    addLog('📁 Создана новая папка: ' + folderName, 'INFO');
    return newFolder;
  } catch (e) {
    addLog('⚠️ Не удалось создать папку, используем корневую: ' + e.message, 'WARN');
    return DriveApp.getRootFolder();
  }
}

/**
 * Получает превью данных листа (первые 3 строки)
 * @param {string} sheetName - Название листа
 * @return {Object} Объект с превью данных
 */
// eslint-disable-next-line no-unused-vars
function getSheetPreview(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {success: false, error: 'Лист не найден'};
    }

    const lastRow = Math.min(4, sheet.getLastRow()); // Заголовок + 3 строки
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      return {success: false, error: 'Лист пустой'};
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

    return {
      success: true,
      data: data,
      totalRows: sheet.getLastRow(),
      totalCols: sheet.getLastColumn(),
    };
  } catch (e) {
    return {success: false, error: e.message};
  }
}
