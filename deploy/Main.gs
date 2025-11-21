/**
 * TABLE AI - MAIN (Google Sheets Container-bound Script)
 * v4.0.0 Refactoring: MAIN = UI + EVENT HANDLERS ONLY
 *
 * ЗАВИСИМОСТИ:
 * - LoggingService.gs: addLog(), exportLogsToSheet()
 * - VkIntegration.gs: importVkPosts()
 * - GeminiService.gs: GM(), GM_IF(), testServerConnection(), runDevSelfTest()
 * - UtilsAndTriggers.gs: processGeminiResponse()
 * - ChainManager.gs: refreshCurrentGMCell()
 * - LicenseAndSettingsService.gs: checkLicenseStatusUI(), openSettingsUI()
 * - CollectConfig.gs: openCollectConfigUI(), refreshCellWithConfig(),
 *   updateReflectionConfigs(), openTemplatesUI(), showCollectConfigHelp()
 * - UnpackingViewer.gs: openUnpackingViewer(), updateUnpackingConfigs()
 * - ExportToDocument.gs: openExportSidebar()
 * - ocrRunV2_client.gs: ocrRun()
 *
 * ОСТАВЛЕННЫЕ ФУНКЦИИ:
 * - onOpen(): Главное меню
 * - onEdit(): Авто-обработка Markdown
 * - runDevSelfTest(): Dev автотесты
 */

// ====== КОНСТАНТЫ ======
const DEV_MODE = false; // DEV: показывать DEV-меню/логи

// ====== ГЛАВНОЕ МЕНЮ ======
/* eslint-disable-next-line no-unused-vars */
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🤖 Table AI')
      .addSubMenu(ui.createMenu('🎯 AI Конструктор')
        .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
        .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
        .addSeparator()
        .addItem('🔄 Обновить рефлексию', 'updateReflectionConfigs') // → CollectConfig.gs
        .addItem('📦 Обновить распаковку', 'updateUnpackingConfigs') // → UnpackingViewer.gs (!)
        .addSeparator()
        .addItem('🗂️ Управление шаблонами', 'openTemplatesUI')
        .addItem('❓ Справка', 'showCollectConfigHelp'),
      )
      .addSeparator()
      .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer')
      .addSeparator()
      .addItem('📥 Импорт VK постов', 'importVkPosts')
      .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
      .addSeparator()
      .addItem('📄 Экспорт в Word/PDF', 'openExportSidebar')
      .addSeparator()
      .addItem('⚙️ Настройки', 'openSettingsUI')
      .addItem('🔒 Проверить лицензию', 'checkLicenseStatusUI')
      .addToUi();

    // ✅ ИСПРАВЛЕНО DEV МЕНЮ:
    if (DEV_MODE) {
      ui.createMenu('🧰 DEV')
        .addItem('📝 Показать логи', 'showLogsDialog')
        .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
        .addItem('🗑 Очистить логи', 'clearLogs')
        .addItem('🔍 Тест сервера', 'testServerConnection')
        .addItem('🧪 Dev Self Test', 'runDevSelfTest')
        .addToUi(); // ← ДОБАВЛЕН .addToUi()!
    }

    addLog('✅ Меню загружено успешно', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка загрузки меню: ' + e.message, 'ERROR');
    console.error('Menu error:', e);
  }
}

// ====== ОБРАБОТЧИКИ СОБЫТИЙ ======
/* eslint-disable-next-line no-unused-vars */
function onEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  const sheetName = sheet.getName();
  const col = range.getColumn();
  const row = range.getRow();

  if (sheetName === 'Распаковка') {
    if (row === 3 && col > 1 && e.value && typeof e.value === 'string') {
      const processed = processGeminiResponse(e.value);
      if (processed !== e.value) {
        range.setValue(processed);
        addLog('🔄 Автопреобразование Markdown в ' + range.getA1Notation(), 'INFO');
      }
    }
  }

  // Убран режим B1-чекбокса по просьбе пользователя — запуск через рисунок с назначенной функцией
}

// ====== DEV: Автотесты (не включать в продукт: DEV_MODE=false) ======
/* eslint-disable-next-line no-unused-vars */
function runDevSelfTest() {
  const failures = [];
  try {
    // 1) columnToLetter
    const map = {1: 'A', 2: 'B', 7: 'G', 26: 'Z', 27: 'AA', 28: 'AB'};
    Object.keys(map).forEach((k) => {
      const got = columnToLetter(parseInt(k, 10));
      if (got !== map[k]) failures.push('columnToLetter(' + k + ') → ' + got + ' (ожидалось ' + map[k] + ')');
    });

    // 2) Markdown detection & conversion
    const md = '**bold**\n- a\n- b\n';
    if (!isMarkdownText(md)) failures.push('isMarkdownText не распознал MD');
    const conv = convertMarkdownToReadableText(md);
    if (!conv || conv.indexOf('BOLD') === -1) failures.push('convertMarkdownToReadableText не преобразовал **bold** → BOLD');

    // 3) GM_IF sleep behavior
    /* eslint-disable-next-line new-cap */
    const r = GM_IF(false, 'no-call');
    if (r !== '') failures.push('GM_IF при false условии должен возвращать пусто');

    // 4) Формулы для A3 (не трогаем содержимое, только проверяем, что ставятся корректно)
    const ss = SpreadsheetApp.getActive();
    const existed = !!ss.getSheetByName('Распаковка');
    const rSheet = existed ? ss.getSheetByName('Распаковка') : ss.insertSheet('Распаковка');
    const snapshot = [];
    for (let c=2; c<=7; c++) {
      snapshot.push(rSheet.getRange(3, c).getFormula());
    }
    prepareChainForA3();
    const expectedB3 = '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)';
    const gotB3 = rSheet.getRange(3, 2).getFormula();
    if (gotB3 !== expectedB3) failures.push('B3 формула некорректна: '+gotB3);
    clearChainForA3();
    // Восстановление прежних формул
    for (let c2=2; c2<=7; c2++) {
      if (snapshot[c2-2]) rSheet.getRange(3, c2).setFormula(snapshot[c2-2]);
    }
    if (!existed) ss.deleteSheet(rSheet);

    // 5) Умный режим: Prompt_box!B2:B3 → B3,C3 с якорем от A3
    const pbExisted = !!ss.getSheetByName('Prompt_box');
    const pbSheet = pbExisted ? ss.getSheetByName('Prompt_box') : ss.insertSheet('Prompt_box');
    const pbSnapshot = [];
    // Сохраняем состояние
    if (pbSheet.getLastRow() >= 2) {
      pbSnapshot.push(pbSheet.getRange('B2').getValue());
      pbSnapshot.push(pbSheet.getRange('B3').getValue());
    }
    // Тест
    pbSheet.getRange('B2').setValue('Распаковка!B3');
    pbSheet.getRange('B3').setValue('Распаковка!C3');
    prepareChainFromPromptBox();
    const b3got = rSheet.getRange('B3').getFormula();
    const c3got = rSheet.getRange('C3').getFormula();
    if (!b3got || b3got.indexOf('Prompt_box!$F$2') === -1) failures.push('B3 умный режим некорректен');
    if (!c3got || c3got.indexOf('Prompt_box!$F$3') === -1) failures.push('C3 умный режим некорректен');
    // Восстановление
    clearChainForA3();
    if (pbSnapshot.length >= 2) {
      pbSheet.getRange('B2').setValue(pbSnapshot[0]);
      pbSheet.getRange('B3').setValue(pbSnapshot[1]);
    } else {
      pbSheet.getRange('B2').clearContent();
      pbSheet.getRange('B3').clearContent();
    }
    if (!pbExisted) ss.deleteSheet(pbSheet);

    if (failures.length === 0) {
      addLog('✅ All self-tests passed', 'INFO');
      SpreadsheetApp.getUi().alert('Dev Self Test', '✅ All tests passed', SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      addLog('❌ Self-test failures: ' + failures.join('; '), 'ERROR');
      SpreadsheetApp.getUi().alert('Dev Self Test FAILED', '❌ Failures:\n' + failures.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
    }
  } catch (e) {
    addLog('❌ Self-test exception: ' + e.message, 'ERROR');
    SpreadsheetApp.getUi().alert('Dev Self Test ERROR', '❌ Exception: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
