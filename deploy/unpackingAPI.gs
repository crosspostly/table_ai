/**
 * ============================================================================
 * UNPACKING API - SERVER MODULE
 * Перенесено из UnpackingViewer.gs для работы на толстом сервере
 * ============================================================================
 * Версия: 1.1.0
 */

// ============================================================================
// ОСНОВНЫЕ API ФУНКЦИИ
// ============================================================================

/**
 * Получение данных распаковки
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Данные распаковки
 */
function unpackingFetch(spreadsheetId, payload) {
  const logs = [];

  try {
    logs.push('📖 Чтение данных из листов Распаковка и ЦА');

    const ss = SpreadsheetApp.openById(spreadsheetId);

    // Получаем данные из обоих листов
    const unpackingData = unpackingGetSheetData(ss, 'Распаковка', logs);
    const caData = unpackingGetSheetData(ss, 'ЦА', logs);

    // Объединяем данные
    const allData = [];

    if (unpackingData.success && unpackingData.data.length > 0) {
      allData.push(...unpackingData.data);
      logs.push('✅ Добавлены данные из листа Распаковка: ' + unpackingData.data.length + ' полей', 'DEBUG');
    } else {
      logs.push('⚠️ Лист Распаковка пуст или не найден', 'DEBUG');
    }

    if (caData.success && caData.data.length > 0) {
      allData.push(...caData.data);
      logs.push('✅ Добавлены данные из листа ЦА: ' + caData.data.length + ' полей', 'DEBUG');
    } else {
      logs.push('⚠️ Лист ЦА пуст или не найден', 'DEBUG');
    }

    logs.push('✅ Всего загружено полей: ' + allData.length);

    return {
      success: true,
      data: {
        fields: allData,
        unpackingCount: unpackingData.data.length,
        caCount: caData.data.length,
        totalCount: allData.length,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка получения данных распаковки: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Экспорт данных в Google Docs
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры экспорта
 * @return {Object} Результат экспорта
 */
function unpackingExportToDoc(spreadsheetId, payload) {
  const logs = [];

  try {
    const {title, includeHeaders = true, format = 'doc'} = payload;

    logs.push('📄 Экспорт данных в Google Docs');

    // Получаем данные
    const fetchResult = unpackingFetch(spreadsheetId, payload);
    if (!fetchResult.success) {
      throw new Error('Не удалось получить данные: ' + fetchResult.error);
    }

    const fields = fetchResult.data.fields;
    if (!fields || fields.length === 0) {
      throw new Error('Нет данных для экспорта');
    }

    // Создаем документ
    const docTitle = title || 'Распаковка_' + new Date().toISOString().slice(0, 10);
    const doc = DocumentApp.create(docTitle);
    const body = doc.getBody();

    // Добавляем заголовок
    if (includeHeaders) {
      const header = doc.appendParagraph(docTitle);
      header.setHeading(DocumentApp.ParagraphHeading.HEADING1);
    }

    // Добавляем данные
    fields.forEach((field) => {
      if (field.a1 && field.b1) {
        // Заголовки A1/B1
        const sectionTitle = doc.appendParagraph(field.a1);
        sectionTitle.setHeading(DocumentApp.ParagraphHeading.HEADING2);

        if (field.a2) {
          const subtitleA = doc.appendParagraph(field.a2);
          subtitleA.setHeading(DocumentApp.ParagraphHeading.HEADING3);
        }

        if (field.b1) {
          const contentTitle = doc.appendParagraph(field.b1);
          contentTitle.setHeading(DocumentApp.ParagraphHeading.HEADING3);
        }

        if (field.b2) {
          const subtitleB = doc.appendParagraph(field.b2);
          subtitleB.setHeading(DocumentApp.ParagraphHeading.HEADING4);
        }

        // Данные строк
        if (field.data && field.data.length > 0) {
          field.data.forEach((row) => {
            if (row.a && row.b) {
              const dataPara = doc.appendParagraph(row.a + ': ' + row.b);
              dataPara.setIndentStart(20);
            }
          });
        }
      }
    });

    logs.push('✅ Документ создан: ' + doc.getUrl());

    return {
      success: true,
      data: {
        docId: doc.getId(),
        docUrl: doc.getUrl(),
        title: docTitle,
        fieldsCount: fields.length,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка экспорта в документ: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Получение списка экспортов
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры запроса
 * @return {Object} Список экспортов
 */
function unpackingListExports(spreadsheetId, payload) {
  const logs = [];

  try {
    logs.push('📋 Получение списка экспортов');

    // Здесь будет логика получения списка предыдущих экспортов
    // Пока возвращаем пустой список
    const exports = [];

    logs.push('✅ Список экспортов получен');

    return {
      success: true,
      data: {
        exports: exports,
        count: exports.length,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка получения списка экспортов: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Очистка данных распаковки
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры очистки
 * @return {Object} Результат очистки
 */
function unpackingClear(spreadsheetId, payload) {
  const logs = [];

  try {
    const {sheets = ['Распаковка', 'ЦА'], preserveHeaders = true} = payload;

    logs.push('🧹 Очистка данных распаковки');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    let clearedSheets = 0;
    let totalCleared = 0;

    sheets.forEach((sheetName) => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const lastRow = sheet.getLastRow();
        const startRow = preserveHeaders ? 3 : 1; // Сохраняем заголовки если нужно

        if (lastRow >= startRow) {
          const lastCol = sheet.getLastColumn();
          const rowsToClear = lastRow - startRow + 1;

          sheet.getRange(startRow, 1, rowsToClear, lastCol).clearContent();
          totalCleared += rowsToClear;
          clearedSheets++;

          logs.push('✅ Очищен лист "' + sheetName + '": ' + rowsToClear + ' строк');
        } else {
          logs.push('ℹ️ Лист "' + sheetName + '" уже пуст');
        }
      } else {
        logs.push('⚠️ Лист "' + sheetName + '" не найден');
      }
    });

    logs.push('✅ Очистка завершена: ' + clearedSheets + ' листов, ' + totalCleared + ' строк');

    return {
      success: true,
      data: {
        clearedSheets: clearedSheets,
        totalCleared: totalCleared,
        sheetsProcessed: sheets,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка очистки данных: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

// ============================================================================
// ВСПомогательные функции
// ============================================================================

/**
 * Получение данных с листа с новой структурой заголовков
 * @param {Spreadsheet} ss - Таблица
 * @param {string} sheetName - Имя листа
 * @param {Array} logs - Массив для логов
 * @return {Object} Данные листа
 */
function unpackingGetSheetData(ss, sheetName, logs) {
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      logs.push('⚠️ Лист "' + sheetName + '" не найден');
      return {success: false, error: 'Sheet not found', data: []};
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      logs.push('ℹ️ Лист "' + sheetName + '" пуст (менее 3 строк)');
      return {success: true, data: []};
    }

    // Читаем заголовки
    const a1 = sheet.getRange('A1').getDisplayValue();
    const b1 = sheet.getRange('B1').getDisplayValue();
    const a2 = sheet.getRange('A2').getDisplayValue();
    const b2 = sheet.getRange('B2').getDisplayValue();

    // Читаем данные строк
    const dataRange = sheet.getRange(3, 1, lastRow - 2, 2);
    const dataValues = dataRange.getValues();

    const data = [];
    dataValues.forEach((row, index) => {
      if (row[0] || row[1]) { // Пропускаем пустые строки
        data.push({
          row: index + 3,
          a: String(row[0] || '').trim(),
          b: String(row[1] || '').trim(),
        });
      }
    });

    const fieldData = {
      sheetName: sheetName,
      a1: a1,
      b1: b1,
      a2: a2,
      b2: b2,
      data: data,
    };

    logs.push('✅ Прочитаны данные из "' + sheetName + '": ' + data.length + ' строк');

    return {success: true, data: [fieldData]};
  } catch (error) {
    logs.push('❌ Ошибка чтения листа "' + sheetName + '": ' + error.message);
    return {success: false, error: error.message, data: []};
  }
}

/**
 * Валидация данных распаковки
 * @param {Array} fields - Поля данных
 * @return {Object} Результат валидации
 */
function unpackingValidateData(fields) {
  const errors = [];
  const warnings = [];

  if (!Array.isArray(fields)) {
    errors.push('Данные должны быть массивом');
    return {valid: false, errors, warnings};
  }

  fields.forEach((field, index) => {
    if (!field.a1 && !field.b1) {
      warnings.push('Поле ' + (index + 1) + ': отсутствуют заголовки');
    }

    if (!field.data || field.data.length === 0) {
      warnings.push('Поле ' + (index + 1) + ': нет данных');
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
  };
}

/**
 * Форматирование текста для экспорта
 * @param {string} text - Текст
 * @return {string} Отформатированный текст
 */
function unpackingFormatText(text) {
  if (!text) return '';

  return String(text)
    .replace(/\s+/g, ' ') // Удаляем множественные пробелы
    .replace(/\n+/g, '\n') // Удаляем множественные переносы строк
    .trim(); // Удаляем пробелы по краям
}

/**
 * Создание имени файла для экспорта
 * @param {string} prefix - Префикс
 * @param {Date} date - Дата
 * @return {string} Имя файла
 */
function unpackingCreateFileName(prefix, date = new Date()) {
  const dateStr = Utilities.formatDate(date, 'Europe/Moscow', 'yyyy-MM-dd_HH-mm-ss');
  return prefix + '_' + dateStr;
}
