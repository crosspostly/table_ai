/**
 * VK Import Module — v4
 * Импорт постов VK с фильтрацией и ПОЛНОЙ защитой первых 2 строк + ширины колонок
 * 1 строка — пустая/параметры (не трогаем)
 * 2 строка — заголовки (не трогаем)
 * 3+ строки — данные/формулы (перезаписываем)
 */
/* exported importVkPosts */
function addLog(message, level) {
  Logger.log(`[${level || 'INFO'}] ${message}`);
}


/**
 * Главная функция импорта постов ВК
 */
// eslint-disable-next-line no-unused-vars
function importVkPosts() {
  addLog('→ Импорт VK-постов с фильтрацией', 'INFO');
  const ss = SpreadsheetApp.getActive();
  const params = ss.getSheetByName('Посты');

  if (!params) {
    addLog('❌ Нет листа "Посты"', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Посты" не найден!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const owner = params.getRange('C1').getValue();
  const count = params.getRange('E1').getValue();

  if (!owner || !count) {
    addLog('❌ Не указаны owner или count', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Введите owner и count на листе "Посты"', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);

  let arr = [];
  try {
    const resp = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    const respBody = resp.getContentText();

    if (resp.getResponseCode() !== 200) {
      Logger.log('HTTP ERROR: ' + resp.getResponseCode());
      Logger.log('BODY: ' + respBody);
      throw new Error('Ошибка VK Parser: ' + resp.getResponseCode());
    }

    // ⭐ Проверка HTML перед парсингом JSON
    if (respBody.trim().startsWith('<!DOCTYPE') ||
        respBody.trim().startsWith('<html')) {
      Logger.log('ERROR: VK Parser returned HTML instead of JSON!');
      Logger.log('Response preview: ' + respBody.substring(0, 200));
      throw new Error('VK Parser returned HTML instead of JSON');
    }

    arr = JSON.parse(respBody);
  } catch (e) {
    addLog('❌ Ошибка запроса VK: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка запроса VK Parser: ' + e);
    return;
  }

  if (!Array.isArray(arr)) {
    addLog('❌ Неверный массив от VK', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Неверный формат данных от VK Parser', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const sheet = ss.getSheetByName('Посты');
  if (!sheet) {
    addLog('❌ Лист "Посты" не найден!', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Создайте лист "Посты".', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
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

  createStopWordsFormulas(sheet, out.length + 2);

  addLog('✅ Импортировано ' + out.length + ' постов', 'INFO');
  SpreadsheetApp.getUi().alert('Импорт завершён: ' + out.length + ' постов. Формулы фильтрации добавлены.');
}


/**
 * Фильтрация стоп-слов/позитивных слов (только с 3-й строки)
 */
function createStopWordsFormulas(sheet, totalRows) {
  try {
    addLog('→ Создание формул фильтрации (batch)', 'INFO');
    const startTime = new Date().getTime();

    const stopWordsRange = '$E$3:$E$100';
    const positiveWordsRange = '$H$3:$H$100';
    const formulas = [];

    // Формулы ТОЛЬКО для строк с 3-й и до totalRows
    for (let row = 3; row <= totalRows; row++) {
      const formulaF = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + ')))*(' + stopWordsRange + '<>"")) > 0, "", C' + row + ')';
      const formulaG = '=IF(F' + row + '<>"", COUNTA(F$3:F' + row + '), "")';
      const formulaI = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + ')))*(' + positiveWordsRange + '<>"")) > 0, C' + row + ', "")';
      const formulaJ = '=IF(I' + row + '<>"", COUNTA(I$3:I' + row + '), "")';
      formulas.push([formulaF, formulaG, '', formulaI, formulaJ]);
    }

    if (formulas.length > 0) {
      sheet.getRange(3, 6, formulas.length, 5).setFormulas(formulas);
    }

    const elapsed = new Date().getTime() - startTime;
    addLog('✅ Формулы фильтрации созданы за ' + elapsed + 'мс (batch)', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка создания формул: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка создания формул: ' + e.message);
  }
}
