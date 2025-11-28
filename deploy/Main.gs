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

// ====== КЛИЕНТСКОЕ ЛОГИРОВАНИЕ ======
const LOGS_CACHE_KEY = 'CLIENT_LOGS';
const MAX_CLIENT_LOGS = 300;
const CLIENT_LOGS_TTL = 86400; // 24 часа

/**
 * Добавить запись в клиентский лог
 * @param {string} msg - Сообщение
 * @param {string} level - Уровень: INFO, WARN, ERROR, DEBUG
 */
function addLog(msg, level = 'INFO') {
  try {
    // Получаем кэш
    const cache = CacheService.getScriptCache();

    // Читаем существующие логи
    let logs = cache.get(LOGS_CACHE_KEY);
    logs = logs ? JSON.parse(logs) : [];

    // Формируем timestamp
    const ts = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd HH:mm:ss',
    );

    // Добавляем новую запись
    logs.push({
      timestamp: ts,
      level: level,
      message: msg,
    });

    // Ограничиваем количество
    if (logs.length > MAX_CLIENT_LOGS) {
      logs.shift(); // Удаляем самую старую
    }

    // Сохраняем обратно в кэш
    cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), CLIENT_LOGS_TTL);

    // Дублируем в console.log
    console.log(`[CLIENT] [${ts}] ${level}: ${msg}`);
  } catch (e) {
    // Если логирование упало - не ломаем основную логику
    console.error('[CLIENT] Ошибка записи лога:', e.message);
  }
}

/**
 * Получить клиентские логи
 * @param {number} limit - Количество последних записей
 * @return {Array} Массив объектов {timestamp, level, message}
 */
function getClientLogs(limit = 100) {
  try {
    const cache = CacheService.getScriptCache();
    const logs = cache.get(LOGS_CACHE_KEY);

    if (!logs) return [];

    const arr = JSON.parse(logs);
    return arr.slice(-limit); // Последние limit записей
  } catch (e) {
    console.error('[CLIENT] Ошибка чтения логов:', e.message);
    return [];
  }
}

/**
 * Очистить клиентские логи
 */
function clearClientLogs() {
  try {
    CacheService.getScriptCache().remove(LOGS_CACHE_KEY);
    addLog('✅ Клиентские логи очищены', 'INFO');
    SpreadsheetApp.getUi().alert('Клиентские логи очищены');
  } catch (e) {
    console.error('[CLIENT] Ошибка очистки логов:', e.message);
    SpreadsheetApp.getUi().alert('Ошибка очистки логов: ' + e.message);
  }
}

// ====== ВСПомогательная функция для вызовов сервера ======
function callServerAction_(action, subaction, payload = {}) {
  // ЛОГИРУЕМ ДО ВЫЗОВА
  addLog(`→ SERVER CALL: ${action}/${subaction}`, 'DEBUG');

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

  try {
    const response = UrlFetchApp.fetch(SERVER_URL, options);
    const code = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    // Проверяем HTTP код
    if (code !== 200) {
      addLog(`← SERVER ERROR: HTTP ${code}`, 'ERROR');
      throw new Error(`Сервер вернул ${code}: ${result.error || 'Неизвестная ошибка'}`);
    }

    // ЛОГИРУЕМ ПОСЛЕ ВЫЗОВА
    addLog(
      `← SERVER RESPONSE: ${result.success ? 'OK' : 'ERROR'}`,
      result.success ? 'INFO' : 'ERROR',
    );

    return result;
  } catch (e) {
    // ЛОГИРУЕМ ОШИБКУ
    addLog(`❌ SERVER CALL FAILED: ${e.message}`, 'ERROR');
    throw e; // Пробрасываем дальше
  }
}

// ====== ОСНОВНАЯ ТОЧКА ВХОДА ======
function onOpen() {
  addLog('🚀 onOpen вызван', 'INFO');

  try {
    // Проверяем обновления (неблокирующий вызов)
    checkForUpdates_();

    // Строим меню
    buildMenu_();
  } catch (e) {
    addLog(`❌ onOpen упал: ${e.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка загрузки меню: ' + e.message);
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

// Batch операции перенесены в reniewCell.gs

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
function showClientLogsDialog() {
  try {
    const logs = getClientLogs();
    const logText = logs.map((log) =>
      `[${log.timestamp}] ${log.level}: ${log.message}`,
    ).join('\n');

    const html = HtmlService.createHtmlOutput(`
      <div style="font-family: monospace; padding: 10px; white-space: pre-wrap;">${logText || 'Логов нет'}</div>
    `).setWidth(800).setHeight(600);

    SpreadsheetApp.getUi().showModalDialog(html, '📝 Клиентские логи');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия клиентских логов: ' + e.message);
  }
}

function showServerLogsDialog() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('logging_system')
      .setWidth(800).setHeight(600);

    SpreadsheetApp.getUi().showModalDialog(html, '📜 Серверные логи');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Ошибка открытия серверных логов: ' + e.message);
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

// ====== ПОСТРОЕНИЕ МЕНЮ ======
function buildMenu_() {
  addLog('📋 Построение меню...', 'INFO');
  const ui = SpreadsheetApp.getUi();

  // Создаём главное меню
  const mainMenu = ui.createMenu('🤖 Table AI');

  // Подключаем batch операции из reniewCell.gs
  try {
    const batchMenu = buildBatchMenu_(); // ← функция из reniewCell.gs
    mainMenu.addSubMenu(batchMenu);
    addLog('✅ Batch меню подключено из reniewCell.gs', 'DEBUG');
  } catch (e) {
    addLog(`❌ Ошибка построения batch меню: ${e.message}`, 'ERROR');
    // Продолжаем строить меню без batch операций
  }

  // Остальные пункты меню
  mainMenu
    .addSeparator()
    .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer')
    .addSeparator()
    .addItem('📥 Импорт VK постов', 'importVkPosts')
    .addItem('🖼️ Транскрибация отзывов', 'ocrRun')
    .addSeparator()
    .addItem('⚙️ Настройки', 'openSettingsUI')
    .addToUi();

  // DEV меню
  if (DEV_MODE) {
    ui.createMenu('🧰 DEV')
      .addItem('📝 Логи (клиент)', 'showClientLogsDialog')
      .addItem('📜 Логи (сервер)', 'showServerLogsDialog')
      .addItem('🗑 Очистить логи (клиент)', 'clearClientLogs')
      .addSeparator()
      .addItem('📊 Статус batch операций', 'showBatchStatus')
      .addItem('🔍 Тест сервера', 'testServerConnection')
      .addItem('🧪 Dev Self Test', 'runDevSelfTest')
      .addItem('🔄 Проверить обновления', 'checkForUpdates_')
      .addToUi();
  }

  addLog('✅ Меню создано успешно', 'INFO');
}
