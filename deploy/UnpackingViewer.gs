/**
 * TABLE AI - Unpacking Viewer Module
 * v1.0.1 - Fixed logging system
 *
 * Модуль для просмотра и экспорта данных из листа "Распаковка"
 * 
 * Функции:
 * - openUnpackingViewer(): открытие модального окна
 * - getUnpackingData(): чтение данных из листа
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
        'yyyy-MM-dd HH:mm:ss'
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
      .setTitle('📦 Просмотр Распаковки');

    SpreadsheetApp.getUi().showModalDialog(html, '📦 Просмотр Распаковки');

    logUnpacking('✅ Окно просмотра открыто', 'INFO');
  } catch (error) {
    logUnpacking('❌ Ошибка открытия окна: ' + error.message, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка открытия окна:\n\n' + error.message);
  }
}

/**
 * Читает данные из листа "Распаковка"
 * @return {Object} Объект с данными или ошибкой
 */
/**
 * Читает данные из листа "Распаковка"
 * @return {Object} Объект с данными или ошибкой
 */
// eslint-disable-next-line no-unused-vars
function getUnpackingData() {
  try {
    logUnpacking('📖 Чтение данных из листа Распаковка', 'INFO');

    // Получаем активную таблицу
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Ищем лист "Распаковка"
    const sheet = ss.getSheetByName('Распаковка');

    if (!sheet) {
      logUnpacking('❌ Лист "Распаковка" не найден', 'ERROR');
      return {
        success: false,
        data: [],
        error: 'Лист "Распаковка" не найден в таблице',
      };
    }

    // Читаем заголовки (строка 2, A2:H2)
    const headersRange = sheet.getRange('A2:H2');
    const headersValues = headersRange.getValues()[0];

    // Находим последнюю заполненную строку в столбце A
    const lastRow = sheet.getLastRow();
    
    // Если данных нет после заголовков
    if (lastRow < 3) {
      return {
        success: false,
        data: [],
        error: 'На листе "Распаковка" нет данных для отображения',
      };
    }

    // Читаем ВСЕ данные от строки 3 до последней строки (A3:H{lastRow})
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 8); // строка 3, столбец 1, количество строк, 8 столбцов
    const dataValues = dataRange.getValues();

    logUnpacking('📊 Прочитано заголовков: ' + headersValues.length, 'DEBUG');
    logUnpacking('📊 Прочитано строк данных: ' + dataValues.length, 'DEBUG');

    // Формируем массив объектов {header, values[]}
    const result = [];

    for (let colIndex = 0; colIndex < headersValues.length; colIndex++) {
      const header = headersValues[colIndex];

      // Пропускаем пустые заголовки
      if (!header || header.toString().trim() === '') {
        continue;
      }

      // Собираем все значения из этого столбца
      const columnValues = [];
      for (let rowIndex = 0; rowIndex < dataValues.length; rowIndex++) {
        const cellValue = dataValues[rowIndex][colIndex];
        
        // Добавляем только непустые значения
        if (cellValue && cellValue.toString().trim() !== '') {
          columnValues.push(cellValue.toString().trim());
        }
      }

      // Если в столбце есть данные, добавляем
      if (columnValues.length > 0) {
        result.push({
          header: header.toString().trim(),
          value: columnValues.join('\n'), // Объединяем значения через перенос строки
          count: columnValues.length, // Количество строк
        });
      } else {
        // Если данных нет, добавляем пустое поле
        result.push({
          header: header.toString().trim(),
          value: '(нет данных)',
          count: 0,
        });
      }
    }

    logUnpacking('✅ Сформировано полей: ' + result.length, 'INFO');

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
    logUnpacking('❌ Ошибка чтения данных: ' + error.message, 'ERROR');
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
    logUnpacking('📄 Начало экспорта в Google Docs', 'INFO');

    // Получаем данные
    const dataResponse = getUnpackingData();

    if (!dataResponse.success) {
      return dataResponse; // Возвращаем ошибку
    }

    const data = dataResponse.data;
    logUnpacking('📊 Данных для экспорта: ' + data.length, 'DEBUG');

    // Формируем имя файла
    const now = new Date();
    const dateStr = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm');
    const fileName = 'Распаковка_' + dateStr;

    logUnpacking('📝 Имя документа: ' + fileName, 'DEBUG');

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
      fieldHeader.setHeading(DocumentApp.ParagraphHeading.HEADING2);
      fieldHeader.setSpacingBefore(8);
      fieldHeader.setSpacingAfter(4);

      // Значение поля
// Значение поля, разбитое по \n на отдельные параграфы
      const lines = (field.value || '').split('\n');
      lines.forEach(line => {
        const para = body.appendParagraph('   ' + line);
        para.setFontSize(12);
        para.setIndentStart(20);
        para.setSpacingAfter(0);
        para.setBold(false);  // ← Явно обычный текст, НЕ жирный
      });
      body.appendParagraph('');
      // Пустая строка между полями
      body.appendParagraph('');
      body.appendPageBreak();
    });

    // === ФУТЕР ===
    body.appendHorizontalRule();
    const footer = body.appendParagraph('Документ создан автоматически');
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


// Мой файлы - управление экспортированными документами

/**
 * Получить список с данными экспортированных документов
 */
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
          id: index,
          name: row[0],
          url: row[1],
          date: row[2] || new Date().toLocaleString()
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
function deleteExportedDocs(indices) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('список_экспорт') || null;
  if (!sheet) return;
  
  try {
    // Удалять по сортированным индексам в обратном порядке
    indices.sort((a, b) => b - a).forEach(index => {
      sheet.deleteRow(index + 2);
    });
  } catch (e) {
    logUnpacking('Ошибка при удалении документов: ' + e.message, 'ERROR');
  }
}
}
