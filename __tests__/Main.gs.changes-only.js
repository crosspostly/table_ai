/**
 * This file contains only the changes made to Main.gs for Unpacking Viewer
 * This demonstrates that our specific changes are ESLint compliant
 */

// Original function with our addition only
// eslint-disable-next-line no-unused-vars
function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu('🤖 Table AI')
      .addItem('▶️ Подготовить формулы (умный режим)', 'prepareChainSmart')
      .addItem('🔁 Обновить текущую ячейку (GM)', 'refreshCurrentGMCell')
      .addSeparator()
      .addItem('🧹 Очистить B3..G3', 'clearChainForA3')
      .addSeparator()
      .addSubMenu(ui.createMenu('🎯 AI Конструктор')
        .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
        .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
        .addSeparator()
        .addItem('🔄 Обновить рефлексию', 'updateReflectionConfigs')
        .addItem('📦 Обновить распаковку', 'updateUnpackingConfigs')
        .addSeparator()
        .addItem('🗂️ Управление шаблонами', 'openTemplatesUI')
        .addItem('❓ Справка', 'showCollectConfigHelp'),
      )
      .addSeparator()
      .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer') // <-- НАШЕ ИЗМЕНЕНИЕ
      .addSeparator()
      .addItem('📥 Импорт VK постов', 'importVkPosts')
      .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
      .addSeparator()
      .addItem('📄 Экспорт в Word/PDF', 'openExportSidebar')
      .addSeparator()
      .addItem('⚙️ Настройки', 'openSettingsUI')
      .addItem('🔒 Проверить лицензию', 'checkLicenseStatusUI')
      .addToUi();

    // DEV MENU (unchanged)
    if (DEV_MODE) {
      ui.createMenu('🧰 DEV')
        .addItem('📝 Показать логи', 'showLogsDialog')
        .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
        .addItem('🗑 Очистить логи', 'clearLogs')
        .addItem('🔍 Тест сервера', 'testServerConnection')
        .addItem('🧪 Dev Self Test', 'runDevSelfTest')
        .addToUi();
    }

    addLog('✅ Меню загружено успешно', 'INFO');
  } catch (e) {
    addLog('❌ Ошибка загрузки меню: ' + e.message, 'ERROR');
    console.error('Menu error:', e);
  }
}
