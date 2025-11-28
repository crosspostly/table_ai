/**
 * TABLE AI - CLIENT (Google Sheets Container-bound Script)
 * v3.0.0 Refactoring: THIN CLIENT + OTA UPDATES
 *
 * Клиент - тонкая обёртка (5-7 KB) для вызовов толстого сервера
 * Вся бизнес-логика перенесена на сервер
 */

// ====== КОНСТАНТЫ ВЕРСИОНИРОВАНИЯ ======
const CLIENT_VERSION = '3.0.0';
const SERVER_URL = PropertiesService.getScriptProperties().getProperty('SERVER_URL') || 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec';

// ====== КОНСТАНТЫ ДЛЯ СОВМЕСТИМОСТИ (legacy) ======
const DEV_MODE = true; // DEV: показывать DEV-меню/логи
const DEVMODE = DEV_MODE;

// ====== ВСПомогательная функция для вызовов сервера ======
function callServerAction_(action, subaction, payload = {}) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      action,
      subaction,
      spreadsheetId: SpreadsheetApp.getActiveSpreadsheet().getId(),
      clientVersion: CLIENT_VERSION,
      ...payload,
    }),
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(SERVER_URL, options);
  return JSON.parse(response.getContentText());
}

// ====== ОСНОВНАЯ ТОЧКА ВХОДА ======
function onOpen() {
  try {
    // Проверяем обновления (неблокирующий вызов)
    checkForUpdates_();

    // Строим меню (как сейчас, без изменений)
    buildMenu_();
  } catch (e) {
    Logger.log('Error in onOpen: ' + e.message);
    // В случае ошибки все равно строим меню
    buildMenu_();
  }
}

// ====== МЕХАНИЗМ OTA ОБНОВЛЕНИЙ ======
function checkForUpdates_() {
  try {
    const updateInfo = callServerAction_('ota', 'checkUpdates', {});

    if (updateInfo.updateAvailable) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Доступны обновления Table AI!\nТекущая версия: ' + updateInfo.clientVersion +
        '\nНовая версия: ' + updateInfo.serverVersion,
        ui.ButtonSet.YES_NO,
      );

      if (response === ui.Button.YES) {
        showUpdateDialog_(updateInfo.availableFiles);
      }
    }
  } catch (e) {
    // Ошибка при проверке не должна ломать меню
    Logger.log('OTA check error: ' + e.toString());
  }
}

function showUpdateDialog_(files) {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial; padding: 10px;">
      <h3>Доступные файлы для обновления:</h3>
      <div id="fileList"></div>
      <button onclick="google.script.host.close()">Закрыть</button>
    </div>
    <script>
      const files = ${JSON.stringify(files)};
      const fileList = document.getElementById('fileList');
      files.forEach(file => {
        const div = document.createElement('div');
        div.innerHTML = '<button onclick="downloadFile(\'' + file.name + '\')">' + file.name + ' (' + file.size + ')</button>';
        fileList.appendChild(div);
      });
      
      function downloadFile(fileName) {
        google.script.run.downloadFileContent_(fileName, function(content) {
          const pre = document.createElement('pre');
          pre.textContent = content;
          pre.style.backgroundColor = '#f0f0f0';
          pre.style.padding = '10px';
          pre.style.overflow = 'auto';
          pre.style.maxHeight = '500px';
          fileList.appendChild(pre);
        });
      }
    </script>
  `);

  SpreadsheetApp.getUi().showModelessDialog(html, 'Table AI Обновления');
}

function downloadFileContent_(fileName) {
  try {
    const content = callServerAction_('ota', 'getFileContent', {fileName: fileName});
    return content.content;
  } catch (e) {
    return 'Ошибка при скачивании: ' + e.toString();
  }
}

// ====== ФУНКЦИИ МЕНЮ (вызывают сервер) ======

// AI Конструктор
function openCollectConfigUI() {
  try {
    const result = callServerAction_('collectConfig', 'init', {});
    if (!result.ok) {
      SpreadsheetApp.getUi().alert('Ошибка: ' + result.error);
      return;
    }

    const html = HtmlService.createHtmlOutputFromFile('CollectConfigUi')
      .setWidth(800).setHeight(600);

    SpreadsheetApp.getUi().showModelessDialog(html, 'AI Конструктор');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия AI Конструктора: ' + e.message);
  }
}

function refreshCellWithConfig() {
  try {
    const result = callServerAction_('collectConfig', 'execute', {});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка обновления ячейки: ' + e.message);
  }
}

// Batch операции
function etap1() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'etap1'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function etap2_1() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'etap2_1'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function etap2_2() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'etap2_2'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function faza1() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'faza1'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function archetype() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'archetype'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function common_ca() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'common_ca'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function faza2() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'faza2'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function faza3() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'faza3'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function brendDesign() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'brendDesign'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function resume() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'resume'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function analizConc() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'analizConc'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

function analizCA() {
  try {
    const result = callServerAction_('batchUpdate', 'runSegment', {operation: 'analizCA'});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка: ' + e.message);
  }
}

// Другие функции
function openUnpackingViewer() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('UnpackingViewerUI')
      .setWidth(700).setHeight(800);

    SpreadsheetApp.getUi().showModalDialog(html, '📦 Просмотр Распаковка + ЦА');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия просмотра распаковки: ' + e.message);
  }
}

function importVkPosts() {
  try {
    const result = callServerAction_('vk', 'importPosts', {});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка импорта VK постов: ' + e.message);
  }
}

function ocrRun() {
  try {
    const result = callServerAction_('ocr', 'queue', {});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка OCR: ' + e.message);
  }
}

function openSettingsUI() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('SettingsUI')
      .setWidth(600).setHeight(400);

    SpreadsheetApp.getUi().showModalDialog(html, '⚙️ Настройки');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия настроек: ' + e.message);
  }
}

// ====== DEV ФУНКЦИИ ======
function showLogsDialog() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('logging_system')
      .setWidth(800).setHeight(600);

    SpreadsheetApp.getUi().showModalDialog(html, '📝 Логи системы');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия логов: ' + e.message);
  }
}

function exportLogsToSheet() {
  try {
    const result = callServerAction_('status', 'getLogs', {});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка экспорта логов: ' + e.message);
  }
}

function clearLogs() {
  try {
    const result = callServerAction_('status', 'clearLogs', {});
    SpreadsheetApp.getUi().alert(result.message || result.error);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

function testServerConnection() {
  try {
    const result = callServerAction_('status', 'test', {});
    SpreadsheetApp.getUi().alert('Соединение с сервером: ' + (result.ok ? 'OK' : 'Ошибка'));
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка теста соединения: ' + e.message);
  }
}

function runDevSelfTest() {
  try {
    SpreadsheetApp.getUi().alert('Dev Self Test: Функции перенесены на сервер');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка self test: ' + e.message);
  }
}

// ====== ПОСТРОЕНИЕ МЕНЮ (без изменений) ======
function buildMenu_() {
  const ui = SpreadsheetApp.getUi();

  // Получаем BATCH_OPERATIONS с сервера для динамического меню
  let batchOperations = {};
  try {
    const opsResult = callServerAction_('batchUpdate', 'getOperations', {});
    if (opsResult.ok && opsResult.data && opsResult.data.operations) {
      batchOperations = opsResult.data.operations;
    }
  } catch (e) {
    Logger.log('Error getting batch operations: ' + e.message);
  }

  const aiMenu = ui.createMenu('🎯 AI Конструктор')
    .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
    .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
    .addSeparator();

  // Добавляем batch операции динамически
  Object.entries(batchOperations).forEach(([key, config]) => {
    const funcName = key.charAt(0).toUpperCase() + key.slice(1);
    if (typeof this[funcName] === 'function') {
      aiMenu.addItem(config.name, funcName);
    }
  });

  ui.createMenu('🤖 Table AI')
    .addSubMenu(aiMenu)
    .addSeparator()
    .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer')
    .addSeparator()
    .addItem('📥 Импорт VK постов', 'importVkPosts')
    .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
    .addSeparator()
    .addItem('⚙️ Настройки', 'openSettingsUI')
    .addToUi();

  if (DEV_MODE) {
    ui.createMenu('🧰 DEV')
      .addItem('📝 Показать логи', 'showLogsDialog')
      .addItem('⬇️ Экспорт логов', 'exportLogsToSheet')
      .addItem('🗑 Очистить логи', 'clearLogs')
      .addItem('🔍 Тест сервера', 'testServerConnection')
      .addItem('🧪 Dev Self Test', 'runDevSelfTest')
      .addItem('🔄 Проверить обновления', 'checkForUpdates_')
      .addToUi();
  }
}
