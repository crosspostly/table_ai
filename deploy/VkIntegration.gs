/**
 * VkIntegration.gs - Интеграция с VK Parser
 * Версия: 1.0.0
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog()
 * - UtilsAndTriggers.gs: applyUniformFormatting()
 *
 * Функции:
 * - importVkPosts() - импорт постов из VK
 * - createStopWordsFormulas() - создание формул фильтрации
 * - applyUniformFormatting() - форматирование листов
 */

// ====== КОНСТАНТЫ ======
const VK_PARSER_URL = 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec';

// ====== ОСНОВНЫЕ ФУНКЦИИ VK ИНТЕГРАЦИИ ======
/* eslint-disable-next-line no-unused-vars */
function importVkPosts() {
  addLog('→ Импорт VK-постов с фильтрацией', 'INFO');
  const ss = SpreadsheetApp.getActive();
  const params = ss.getSheetByName('Параметры');
  if (!params) {
    addLog('❌ Нет листа "Параметры"', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Лист "Параметры" не найден!', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const owner = params.getRange('B1').getValue();
  const count = params.getRange('B2').getValue();
  if (!owner || !count) {
    addLog('❌ Не указаны owner или count', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Введите owner и count на листе "Параметры"', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  const url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);

  let arr;

  try {
    const resp = UrlFetchApp.fetch(url);
    arr = JSON.parse(resp.getContentText());
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

  const headers = [
    'Дата', 'Ссылка на пост', 'Текст поста', 'Номер поста',
    'Стоп-слова', 'Отфильтрованные посты', 'Новый номер',
    'Позитивные слова', 'Посты с позитивными словами', 'Новый номер (позитивные)',
  ];
  const out = [headers];
  arr.forEach(function(o, i) {
    const number = o.number !== undefined ? o.number : i + 1;
    out.push([o.date, o.link, o.text, number, '', '', '', '', '', '']);
  });

  const sheet = ss.getSheetByName('посты');
  if (!sheet) {
    addLog('❌ Лист "посты" не найден!', 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка', 'Создайте лист "посты".', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  sheet.clear();
  sheet.getRange(1, 1, out.length, headers.length).setValues(out);
  applyUniformFormatting(sheet);
  createStopWordsFormulas(sheet, out.length);
  addLog('✅ Импортировано ' + (out.length-1) + ' постов', 'INFO');
  SpreadsheetApp.getUi().alert('Импорт завершён: ' + (out.length - 1) + ' постов. Формулы фильтрации добавлены.');
}

/* eslint-disable-next-line no-unused-vars */
function createStopWordsFormulas(sheet, totalRows) {
  try {
    addLog('→ Создание формул фильтрации (оптимизированная batch-версия)', 'INFO');
    const startTime = new Date().getTime();

    const stopWordsRange = '$E$2:$E$100';
    const positiveWordsRange = '$H$2:$H$100';

    // Собираем ВСЕ формулы в один массив для batch-операции
    const formulas = [];
    for (let row = 2; row <= totalRows; row++) {
      // F: Фильтрация стоп-слов
      const formulaF = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + stopWordsRange + ', C' + row + ')))*(' + stopWordsRange + '<>"")) > 0, "", C' + row + ')';

      // G: Номер отфильтрованного поста
      const formulaG = '=IF(F' + row + '<>"", COUNTA(F$2:F' + row + '), "")';

      // H: Пусто (колонка для позитивных слов - заполняется вручную)

      // I: Фильтрация позитивных слов
      const formulaI = '=IF(SUMPRODUCT(--(ISNUMBER(SEARCH(' + positiveWordsRange + ', C' + row + ')))*(' + positiveWordsRange + '<>"")) > 0, C' + row + ', "")';

      // J: Номер поста с позитивными словами
      const formulaJ = '=IF(I' + row + '<>"", COUNTA(I$2:I' + row + '), "")';

      // Формируем строку: F, G, H (пусто), I, J
      formulas.push([formulaF, formulaG, '', formulaI, formulaJ]);
    }

    // ОДИН batch-запрос вместо 400 отдельных!
    // Устанавливаем формулы для колонок F, G, H, I, J (с E:6 по J:10)
    if (formulas.length > 0) {
      sheet.getRange(2, 6, formulas.length, 5).setFormulas(formulas);
    }

    // Форматирование заголовков
    sheet.getRange(1, 5, 1, 3).setFontWeight('bold').setBackground('#FFF2CC'); // E, F, G - стоп-слова
    sheet.getRange(1, 8, 1, 3).setFontWeight('bold').setBackground('#D9EAD3'); // H, I, J - позитивные
    sheet.autoResizeColumns(5, 6);

    const elapsed = new Date().getTime() - startTime;
    addLog('✅ Формулы фильтрации созданы за ' + elapsed + 'мс (batch-режим)', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка создания формул: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка создания формул: ' + e.message);
  }
}

// ====== УТИЛИТЫ ФОРМАТИРОВАНИЯ ======
/* eslint-disable-next-line no-unused-vars */
function applyUniformFormatting(sheet) {
  try {
    const range = sheet.getDataRange();
    range.setFontFamily('Arial')
      .setFontSize(10)
      .setVerticalAlignment('middle')
      .setHorizontalAlignment('left');
    addLog('✅ Применено форматирование к листу ' + sheet.getName(), 'DEBUG');
  } catch (e) {
    addLog('⚠️ Ошибка форматирования листа ' + sheet.getName() + ': ' + e.message, 'WARN');
  }
}

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
/* eslint-disable-next-line no-unused-vars */
function getVkParserUrl_() {
  try {
    return String(VK_PARSER_URL).replace(/\/$/, '');
  } catch (e) {
    addLog('⚠️ getVkParserUrl_: ' + e.message, 'WARN');
    return String(VK_PARSER_URL||'').replace(/\/$/, '');
  }
}


