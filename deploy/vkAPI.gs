/**
 * ============================================================================
 * VK API - SERVER MODULE
 * Перенесено из VK.gs для работы на толстом сервере
 * ============================================================================
 * Версия: 4.0.0
 */

// ============================================================================
// КОНСТАНТЫ
// ============================================================================
// VK_PARSER_URL остается захардкодированным в этом файле!
const VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';

// ============================================================================
// ОСНОВНЫЕ API ФУНКЦИИ
// ============================================================================

/**
 * Импорт постов VK
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Дополнительные параметры
 * @return {Object} Результат импорта
 */
function vkImportPosts(spreadsheetId, payload) {
  const logs = [];

  try {
    logs.push('→ Импорт VK-постов с фильтрацией');

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const params = ss.getSheetByName('Посты');

    if (!params) {
      throw new Error('Лист "Посты" не найден');
    }

    const owner = params.getRange('C1').getValue();
    const count = params.getRange('E1').getValue();

    if (!owner || !count) {
      throw new Error('Введите owner и count на листе "Посты"');
    }

    const url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);

    let arr = [];
    try {
      const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
      if (resp.getResponseCode() !== 200) {
        logs.push('HTTP ERROR: ' + resp.getResponseCode());
        logs.push('BODY: ' + resp.getContentText());
        throw new Error('Ошибка VK Parser: ' + resp.getResponseCode());
      }
      arr = JSON.parse(resp.getContentText());
    } catch (e) {
      logs.push('❌ Ошибка запроса VK: ' + e.message);
      throw new Error('Ошибка запроса VK Parser: ' + e.message);
    }

    if (!Array.isArray(arr)) {
      logs.push('❌ Неверный массив от VK');
      throw new Error('Неверный формат данных от VK Parser');
    }

    const sheet = ss.getSheetByName('Посты');
    if (!sheet) {
      throw new Error('Создайте лист "Посты"');
    }

    // Очищаем ТОЛЬКО с 3-й строки и ниже
    const lastRow = sheet.getLastRow();
    if (lastRow > 2) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(3, 1, lastRow - 2, lastCol).clearContent().clearFormat();
    }

    // Формируем данные для вывода
    const out = [];
    arr.forEach(function(o, i) {
      const number = o.number !== undefined ? o.number : i + 2;
      out.push([o.date, o.link, o.text, number, '', '', '', '', '', '']);
    });

    // Записываем данные строго с 3-й строки
    if (out.length > 0) {
      sheet.getRange(3, 1, out.length, 10).setValues(out);
    }

    vkCreateStopWordsFormulas(sheet, out.length + 2, logs);

    logs.push('✅ Импортировано ' + out.length + ' постов');

    return {
      success: true,
      data: {
        imported: out.length,
        owner: owner,
        count: count,
      },
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка импорта VK: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Парсинг отдельного VK поста
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры поста
 * @return {Object} Результат парсинга
 */
function vkParsePost(spreadsheetId, payload) {
  const logs = [];

  try {
    const {postUrl, postId} = payload;

    if (!postUrl && !postId) {
      throw new Error('Укажите postUrl или postId');
    }

    // Здесь будет логика парсинга отдельного поста
    // Пока возвращаем заглушку
    const result = {
      parsed: true,
      data: {
        url: postUrl,
        id: postId,
        text: 'Текст поста',
        date: new Date().toISOString(),
      },
    };

    logs.push('✅ VK пост распарсен');

    return {
      success: true,
      data: result,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка парсинга VK поста: ' + error.message);
    return {
      success: false,
      error: error.message,
      logs: logs,
    };
  }
}

/**
 * Получение статуса VK парсера
 * @param {string} spreadsheetId - ID таблицы
 * @param {Object} payload - Параметры запроса
 * @return {Object} Статус парсера
 */
function vkGetStatus(spreadsheetId, payload) {
  const logs = [];

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName('Посты');

    if (!sheet) {
      throw new Error('Лист "Посты" не найден');
    }

    const owner = sheet.getRange('C1').getValue();
    const count = sheet.getRange('E1').getValue();
    const lastRow = sheet.getLastRow();
    const importedPosts = Math.max(0, lastRow - 2); // Вычитаем 2 строки заголовков

    const status = {
      owner: owner || 'не указан',
      count: count || 0,
      imported: importedPosts,
      lastImport: new Date().toISOString(),
    };

    logs.push('✅ Статус VK получен');

    return {
      success: true,
      data: status,
      logs: logs,
    };
  } catch (error) {
    logs.push('❌ Ошибка получения статуса VK: ' + error.message);
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
 * Создание формул для фильтрации стоп-слов
 * @param {Sheet} sheet - Лист
 * @param {number} totalRows - Общее количество строк
 * @param {Array} logs - Массив для логов
 */
function vkCreateStopWordsFormulas(sheet, totalRows, logs) {
  try {
    logs.push('→ Создание формул фильтрации (batch)');
    const startTime = new Date().getTime();

    const stopWordsRange = '$E$3:$E$100';
    const positiveWordsRange = '$F$3:$F$100';

    // Создаем формулы для каждой строки
    const formulas = [];
    for (let i = 3; i <= totalRows + 2; i++) {
      // Формула для столбца D (фильтр стоп-слов)
      const stopWordsFormula = `=IF(OR(ISNUMBER(SEARCH(${stopWordsRange}, C${i}))), "СТОП", "")`;
      formulas.push({row: i, col: 4, formula: stopWordsFormula});

      // Формула для столбца E (фильтр позитивных слов)
      const positiveWordsFormula = `=IF(OR(ISNUMBER(SEARCH(${positiveWordsRange}, C${i}))), "ПОЗИТИВ", "")`;
      formulas.push({row: i, col: 5, formula: positiveWordsFormula});

      // Формула для столбца F (итоговая оценка)
      const ratingFormula = `=IF(D${i}="СТОП", 1, IF(E${i}="ПОЗИТИВ", 5, 3))`;
      formulas.push({row: i, col: 6, formula: ratingFormula});
    }

    // Применяем формулы пачками для оптимизации
    const batchSize = 50;
    for (let i = 0; i < formulas.length; i += batchSize) {
      const batch = formulas.slice(i, i + batchSize);
      batch.forEach(({row, col, formula}) => {
        sheet.getRange(row, col).setFormula(formula);
      });
    }

    const endTime = new Date().getTime();
    const duration = endTime - startTime;

    logs.push('✅ Формулы фильтрации созданы за ' + duration + 'мс');
  } catch (error) {
    logs.push('❌ Ошибка создания формул: ' + error.message);
    throw error;
  }
}

/**
 * Валидация параметров VK
 * @param {string} owner - Владелец
 * @param {number} count - Количество
 * @return {Object} Результат валидации
 */
function vkValidateParams(owner, count) {
  const errors = [];

  if (!owner) {
    errors.push('Не указан owner');
  }

  if (!count || count <= 0) {
    errors.push('Не указано count или count <= 0');
  }

  if (count > 100) {
    errors.push('Слишком большое count (максимум 100)');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

/**
 * Форматирование даты поста
 * @param {string|Date} date - Дата
 * @return {string} Отформатированная дата
 */
function vkFormatDate(date) {
  try {
    const d = new Date(date);
    return Utilities.formatDate(d, 'Europe/Moscow', 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return String(date);
  }
}

/**
 * Очистка текста поста
 * @param {string} text - Текст поста
 * @return {string} Очищенный текст
 */
function vkCleanText(text) {
  if (!text) return '';

  return String(text)
    .replace(/\s+/g, ' ') // Удаляем множественные пробелы
    .replace(/\n+/g, '\n') // Удаляем множественные переносы строк
    .trim(); // Удаляем пробелы по краям
}
