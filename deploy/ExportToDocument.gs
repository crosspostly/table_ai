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
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      throw new Error('Лист пустой!');
    }

    addLog('📊 Размер: ' + lastRow + ' строк × ' + lastCol + ' колонок', 'INFO');

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

    // ✅ СОЗДАНИЕ ТЕКСТОВЫХ КАРТОЧЕК ВМЕСТО ТАБЛИЦЫ
    addLog('📝 Создание текстовых карточек из данных...', 'INFO');

    const headers = data[0]; // Заголовки колонок

    // Создаем текстовые карточки для каждой строки данных
    for (let r = 1; r < data.length; r++) {
      const row = data[r];

      // Пропускаем пустые строки
      if (row.every((cell) => !cell || cell.toString().trim() === '')) {
        continue;
      }

      // Заголовок карточки
      const cardTitle = body.appendParagraph('📌 Запись #' + r);
      cardTitle.setBold(true);
      cardTitle.setFontSize(14);
      cardTitle.setForegroundColor('#4285f4');

      // Поля карточки
      for (let c = 0; c < headers.length; c++) {
        const fieldName = headers[c] ? headers[c].toString().trim() : '';
        const fieldValue = row[c] ? row[c].toString().trim() : '';

        // Пропускаем пустые заголовки или значения
        if (!fieldName || !fieldValue) {
          continue;
        }

        // Создаем абзац для поля
        const fieldPara = body.appendParagraph('');

        // Название поля (жирное)
        const nameText = fieldPara.appendText(fieldName + ': ');
        nameText.setBold(true);
        nameText.setForegroundColor('#333333');

        // Значение поля (обычное)
        const valueText = fieldPara.appendText(fieldValue);
        valueText.setBold(false);
        valueText.setForegroundColor('#000000');

        // Добавляем отступ для красоты
        fieldPara.setIndentStart(20);
        fieldPara.setSpacingBefore(3);
        fieldPara.setSpacingAfter(3);
      }

      // Разделитель между карточками (кроме последней)
      if (r < data.length - 1) {
        body.appendParagraph(''); // Пустая строка
        body.appendHorizontalRule();
        body.appendParagraph(''); // Пустая строка
      }
    }

    addLog('✅ Текстовые карточки созданы', 'SUCCESS');

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
