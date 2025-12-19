/**
 * ============================================================================
 * BATCH UPDATE SYSTEM v3.1
 * Система с автоматическим переповторением + проверка Success
 * ============================================================================
 */

/**
 * 🎯 КОНФИГУРАЦИЯ BATCH-ОПЕРАЦИЙ
 * Редактируй ТОЛЬКО эту часть!
 */
const BATCH_OPERATIONS = {
  etap1: {
    name: '📋 обновить Презентация',
    startRow: 2,
    endRow: 9,
  },
  etap2_1: {
    name: '📦 обновить Рефлексия (часть 1)',
    startRow: 10,
    endRow: 23,
  },
  etap2_2: {
    name: '🎯 обновить Рефлексия (часть 2)',
    startRow: 24,
    endRow: 36,
  },
  faza1: {
    name: '🎯 обновить Фаза 1',
    startRow: 37,
    endRow: 41,
  },
  archetype: {
    name: '🎯 обновить Архетип',
    startRow: 42,
    endRow: 42,
  },
  common_ca: {
    name: '🎯 обновить ЦА (общая)',
    startRow: 43,
    endRow: 45,
  },
  faza2: {
    name: '🎯 обновить Фаза 2',
    startRow: 46,
    endRow: 53,
  },
  faza3: {
    name: '🎯 обновить фаза 3',
    startRow: 54,
    endRow: 58,
  },
  brendDesign: {
    name: '🎯 обновить Бренд-Дизайн',
    startRow: 59,
    endRow: 62,
  },
  resume: {
    name: '🎯 обновить Итог распаковки',
    startRow: 63,
    endRow: 65,
  },
  analizConc: {
    name: '🎯 обновить Анализ конкурентов',
    startRow: 66,
    endRow: 67,
  },
  analizCA: {
    name: '🎯 обновить Анализ ЦА',
    startRow: 68,
    endRow: 77,
  },
};

/**
 * 🔒 ГЛОБАЛЬНЫЙ СЕМАФОР
 */
const GLOBAL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 2,
  ACTIVE_REQUESTS: 0,
  QUEUE: [],
  SKIP_FRESH_MINUTES: 10, // ⭐ Пропускать успешные ячейки < 10 минут
  AUTO_RETRY_ENABLED: true, // ⭐ Включить авто-повтор
  AUTO_RETRY_DELAY_MINUTES: 1, // ⭐ Повтор через 1 минуту
  MAX_AUTO_RETRIES: 3, // ⭐ Максимум 3 автоповтора
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 ФУНКЦИИ ДЛЯ МЕНЮ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function etap1() {
  BatchStart(BATCH_OPERATIONS.etap1);
}

function etap2_1() {
  BatchStart(BATCH_OPERATIONS.etap2_1);
}

function etap2_2() {
  BatchStart(BATCH_OPERATIONS.etap2_2);
}

function faza1() {
  BatchStart(BATCH_OPERATIONS.faza1);
}

function archetype() {
  BatchStart(BATCH_OPERATIONS.archetype);
}

function common_ca() {
  BatchStart(BATCH_OPERATIONS.common_ca);
}

function faza2() {
  BatchStart(BATCH_OPERATIONS.faza2);
}

function faza3() {
  BatchStart(BATCH_OPERATIONS.faza3);
}

function brendDesign() {
  BatchStart(BATCH_OPERATIONS.brendDesign);
}

function resume() {
  BatchStart(BATCH_OPERATIONS.resume);
}

function analizConc() {
  BatchStart(BATCH_OPERATIONS.analizConc);
}

function analizCA() {
  BatchStart(BATCH_OPERATIONS.analizCA);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔥 ВНУТРЕННЯЯ ЛОГИКА
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 🚀 Запуск батча
 */
function BatchStart(config) {
  enqueueTask(() => {
    batchUpdateWrapper(config.name, config.startRow, config.endRow);
  }, config.name);
}

/**
 * 🔒 Добавить в очередь
 */
function enqueueTask(taskFn, taskName) {
  GLOBAL_CONFIG.QUEUE.push({
    fn: taskFn,
    name: taskName,
    timestamp: new Date(),
  });
  processQueue();
}

/**
 * 🔥 Обработчик очереди
 */
function processQueue() {
  if (GLOBAL_CONFIG.ACTIVE_REQUESTS >= GLOBAL_CONFIG.MAX_CONCURRENT_REQUESTS) {
    return;
  }

  if (GLOBAL_CONFIG.QUEUE.length === 0) {
    return;
  }

  const task = GLOBAL_CONFIG.QUEUE.shift();
  GLOBAL_CONFIG.ACTIVE_REQUESTS++;

  console.log(`▶️ Запуск: ${task.name}`);
  addLog(`▶️ Запуск: ${task.name}`, 'INFO');

  try {
    task.fn();
  } catch (error) {
    console.error(`❌ Ошибка в ${task.name}: ${error.message}`);
    addLog(`❌ Ошибка в ${task.name}: ${error.message}`, 'ERROR');
  } finally {
    GLOBAL_CONFIG.ACTIVE_REQUESTS--;
    Utilities.sleep(500);
    processQueue();
  }
}

/**
 * ⭐ ОСНОВНАЯ ФУНКЦИЯ БАТЧА
 * 🔧 ИСПРАВЛЕННАЯ ЛОГИКА ПРОПУСКА:
 * 1. Пропускаем пустые строки
 * 2. ТОЛЬКО Success=TRUE И < 10 минут → ПРОПУСКАЕМ
 * 3. Всё остальное (успешные > 10 мин ИЛИ ошибки) → ОБНОВЛЯЕМ
 */
function batchUpdateWrapper(batchName, startRow, endRow) {
  try {
    const ss = SpreadsheetApp.getActive();
    const configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      SpreadsheetApp.getUi().alert('❌ Лист "ConfigData" не найден');
      return;
    }

    ensureConfigDataStructure(configSheet);

    const rowCount = endRow - startRow + 1;
    const range = configSheet.getRange(startRow, 1, rowCount, 8);
    const data = range.getValues();

    const cellsToUpdate = [];
    let skippedCount = 0;
    const now = new Date();
    const skipThresholdMs = GLOBAL_CONFIG.SKIP_FRESH_MINUTES * 60 * 1000;

    for (let i = 0; i < data.length; i++) {
      const sheet = String(data[i][0] || '').trim();
      const cell = String(data[i][1] || '').trim();
      const lastRunStr = data[i][6]; // Колонка G (lastRun)
      const lastSuccess = data[i][7]; // Колонка H (Success)

      // Шаг 1: Пропускаем пустые
      if (!sheet || !cell) {
        continue;
      }

      // Шаг 2: ⭐ КЛЮЧЕВАЯ ЛОГИКА
      // ТОЛЬКО Success=TRUE И < 10 мин → ПРОПУСКАЕМ
      if (lastRunStr && lastSuccess === true) {
        try {
          const lastRun = new Date(lastRunStr);
          const diffMs = now - lastRun;

          if (diffMs < skipThresholdMs) {
            // Свежая успешная - ПРОПУСКАЕМ
            const minutesAgo = Math.floor(diffMs / 60000);
            addLog(`⏭️ Пропуск ${sheet}!${cell} (✅ успешно ${minutesAgo} мин назад)`, 'INFO');
            skippedCount++;
            continue; // ⚡ ВАЖНО: continue отправляет на следующую итерацию
          } else {
            // Success=TRUE но > 10 мин - ОБНОВЛЯЕМ
            const minutesAgo = Math.floor(diffMs / 60000);
            addLog(`🔄 ${sheet}!${cell} добавлен (✅ успешно ${minutesAgo} мин назад, нужен апдейт)`, 'INFO');
          }
        } catch (e) {
          addLog(`⚠️ ${sheet}!${cell} - ошибка парсинга даты`, 'WARN');
        }
      } else if (lastRunStr && lastSuccess === false) {
        // Шаг 3: Success=FALSE (была ошибка) - ОБНОВЛЯЕМ
        try {
          const lastRun = new Date(lastRunStr);
          const minutesAgo = Math.floor((now - lastRun) / 60000);
          addLog(`🔄 ${sheet}!${cell} добавлен (❌ ошибка ${minutesAgo} мин назад, повтор)`, 'INFO');
        } catch (e) {}
      } else if (!lastRunStr) {
        // Шаг 4: Нет времени выполнения (первое обновление) - ОБНОВЛЯЕМ
        addLog(`🆕 ${sheet}!${cell} добавлен (первое обновление)`, 'INFO');
      }

      // ✅ ДОБАВЛЯЕМ ЯЧЕЙКУ В ОЧЕРЕДЬ
      // Все ячейки, которые не пропущены выше
      cellsToUpdate.push({
        sheet: sheet,
        cell: cell,
        configRow: startRow + i,
      });
    }

    console.log(`📋 ${batchName}: Найдено ${cellsToUpdate.length} ячеек для обновления`);
    addLog(`🔄 ${batchName}: Найдено ${cellsToUpdate.length} ячеек (пропущено ${skippedCount} свежих)`, 'INFO');

    if (cellsToUpdate.length === 0) {
      SpreadsheetApp.getUi().alert(
        '⏭️ Все ячейки успешны\n\n' +
        `Диапазон: строки ${startRow}-${endRow}\n` +
        `Все ${rowCount} ячеек успешны менее ${GLOBAL_CONFIG.SKIP_FRESH_MINUTES} минут назад.`
      );
      return;
    }

    const result = updateCellsBatch(cellsToUpdate, batchName);

    if (GLOBAL_CONFIG.AUTO_RETRY_ENABLED && result.errorCount > 0) {
      scheduleAutoRetry(batchName, startRow, endRow);
    }
  } catch (error) {
    addLog(`❌ Ошибка: ${error.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

/**
 * ⭐ БАТЧ-ОБНОВЛЕНИЕ ЯЧЕЕК
 */
function updateCellsBatch(cellsToUpdate, batchName) {
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  const POOL_SIZE = 3;
  const RETRY_COUNT = 0;
  const DELAY = 800;

  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
  addLog(`🚀 НАЧАЛО: ${batchName}`, 'INFO');

  for (let idx = 0; idx < cellsToUpdate.length; idx += POOL_SIZE) {
    const batch = cellsToUpdate.slice(idx, idx + POOL_SIZE);

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const cellRef = `${item.sheet}!${item.cell}`;
      const totalIdx = idx + i + 1;

      let retryCount = 0;
      let success = false;
      let lastError = null;

      while (retryCount <= RETRY_COUNT && !success) {
        try {
          console.log(`[${totalIdx}/${cellsToUpdate.length}] 🔄 ${cellRef}`);
          addLog(`[${totalIdx}/${cellsToUpdate.length}] ${cellRef}`, 'INFO');

          const result = updateSingleCell(item.sheet, item.cell);

          if (result.success) {
            successCount++;
            success = true;
            addLog(`✅ ${cellRef} успешно`, 'SUCCESS');
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (e) {
          lastError = e;
          const msg = e.message || String(e);

          if (msg.includes('LICENSE_OR_SERVER') || msg.includes('<!DOCTYPE')) {
            addLog(`⚠️ ${cellRef}: Ошибка сервера`, 'WARN');
            break;
          }

          retryCount++;
          if (retryCount <= RETRY_COUNT) {
            Utilities.sleep(DELAY * retryCount);
          }
        }
      }

      if (!success) {
        errorCount++;
        const errMsg = `❌ ${cellRef}: ${lastError?.message || 'Ошибка'}`;
        addLog(errMsg, 'ERROR');
        errors.push(errMsg);
      }
    }

    if (idx + POOL_SIZE < cellsToUpdate.length) {
      Utilities.sleep(DELAY);
    }
  }

  addLog(`📊 ${batchName}: ✅ ${successCount}, ❌ ${errorCount}`, 'INFO');
  addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'INFO');
  BatchStartComplete(batchName, successCount, errorCount, cellsToUpdate.length);

  const msg = `${batchName}\n✅ ${successCount}\n❌ ${errorCount}`;

  let finalMsg = msg;
  if (GLOBAL_CONFIG.AUTO_RETRY_ENABLED && errorCount > 0) {
    finalMsg += `\n\n⏰ Авто-повтор через ${GLOBAL_CONFIG.AUTO_RETRY_DELAY_MINUTES} минут`;
  }

  if (errors.length <= 5) {
    const errorsMsg = errors.length > 0 ? '\n\n' + errors.join('\n') : '';
    SpreadsheetApp.getUi().alert(`📊 Результат\n\n${finalMsg}${errorsMsg}`);
  } else {
    const errorsMsg = '\n\n' + errors.slice(0, 5).join('\n') + `\n... и ещё ${errors.length - 5}`;
    SpreadsheetApp.getUi().alert(`📊 Результат\n\n${finalMsg}${errorsMsg}`);
  }

  return {successCount, errorCount};
}

/**
 * 🔄 ОБНОВИТЬ ОДНУ ЯЧЕЙКУ (с записью Success)
 * ⭐ ВСЕГДА ПРОПУСКАЕМ КЕШ (skipCache = true)
 */
function updateSingleCell(sheetName, cellName) {
  try {
    const config = loadCollectConfig(sheetName, cellName);

    if (!config) {
      updateLastRunWithStatus(sheetName, cellName, false);
      return {
        success: false,
        error: 'Конфигурация не найдена для ' + sheetName + '!' + cellName,
      };
    }

    const result = callCollectConfigServer_(config, sheetName, cellName, true);
    addLog(`🔄 ${sheetName}!${cellName}: skipCache=true (полное обновление)`, 'DEBUG');

    if (result && result.ok) {
      updateLastRunWithStatus(sheetName, cellName, true);
      return {success: true};
    }

    updateLastRunWithStatus(sheetName, cellName, false);
    return {
      success: false,
      error: result?.error || 'Неизвестная ошибка',
    };
  } catch (error) {
    const msg = error.message || String(error);
    updateLastRunWithStatus(sheetName, cellName, false);

    if (msg.includes('<!DOCTYPE') || msg.includes('is not valid JSON')) {
      return {success: false, error: 'LICENSE_OR_SERVER'};
    }

    return {success: false, error: msg};
  }
}

/**
 * ⭐ ОБНОВИТЬ lastRun И Success (ПИШЕТ В ConfigData)
 */
function updateLastRunWithStatus(sheetName, cellAddress, success) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('ConfigData');

    if (!configSheet) {
      return;
    }

    const data = configSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === sheetName && data[i][1] === cellAddress) {
        const row = i + 1;

        configSheet.getRange(row, 7).setValue(new Date().toISOString());
        configSheet.getRange(row, 8).setValue(success);

        addLog(`📝 ConfigData: ${sheetName}!${cellAddress} → ${success ? '✅ TRUE' : '❌ FALSE'}`, 'DEBUG');
        return;
      }
    }
  } catch (error) {
    addLog(`⚠️ Ошибка записи в ConfigData: ${error.message}`, 'WARN');
  }
}

/**
 * ⭐ ПРОВЕРКА И СОЗДАНИЕ КОЛОНКИ Success
 */
function ensureConfigDataStructure(configSheet) {
  try {
    const headers = configSheet.getRange(1, 1, 1, 8).getValues()[0];

    if (!headers[7] || headers[7] !== 'Success') {
      configSheet.getRange(1, 8).setValue('Success')
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('white');

      addLog('✅ Добавлена колонка H (Success) в ConfigData', 'INFO');
    }
  } catch (error) {
    addLog(`⚠️ Ошибка проверки структуры: ${error.message}`, 'WARN');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⏰ АВТО-RETRY СИСТЕМА
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function scheduleAutoRetry(batchName, startRow, endRow) {
  try {
    const props = PropertiesService.getScriptProperties();
    const retryKey = `RETRY_${batchName}_${startRow}_${endRow}`;
    const currentRetries = parseInt(props.getProperty(retryKey) || '0');

    if (currentRetries >= GLOBAL_CONFIG.MAX_AUTO_RETRIES) {
      addLog(`⚠️ ${batchName}: Достигнут лимит авто-повторов (${GLOBAL_CONFIG.MAX_AUTO_RETRIES})`, 'WARN');
      props.deleteProperty(retryKey);
      return;
    }

    props.setProperty(retryKey, String(currentRetries + 1));
    deleteAutoRetryTriggers(batchName);

    const triggerTime = new Date(Date.now() + GLOBAL_CONFIG.AUTO_RETRY_DELAY_MINUTES * 60 * 1000);
    ScriptApp.newTrigger('autoRetryExecutor').timeBased().at(triggerTime).create();

    const triggerData = {
      batchName: batchName,
      startRow: startRow,
      endRow: endRow,
      scheduledAt: new Date().toISOString(),
      executeAt: triggerTime.toISOString(),
      attempt: currentRetries + 1,
    };

    props.setProperty(`TRIGGER_DATA_${batchName}`, JSON.stringify(triggerData));
    addLog(`⏰ ${batchName}: Авто-повтор ${currentRetries + 1}/${GLOBAL_CONFIG.MAX_AUTO_RETRIES} на ${triggerTime.toLocaleString('ru-RU')}`, 'INFO');
  } catch (error) {
    addLog(`❌ Ошибка планирования: ${error.message}`, 'ERROR');
  }
}

function autoRetryExecutor() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();

    for (const key in allProps) {
      if (key.startsWith('TRIGGER_DATA_')) {
        const triggerData = JSON.parse(allProps[key]);
        addLog(`🔄 Авто-повтор: ${triggerData.batchName} (попытка ${triggerData.attempt})`, 'INFO');
        batchUpdateWrapper(triggerData.batchName, triggerData.startRow, triggerData.endRow);
        props.deleteProperty(key);
      }
    }
    cleanupOldTriggers();
  } catch (error) {
    addLog(`❌ Ошибка autoRetryExecutor: ${error.message}`, 'ERROR');
  }
}

function deleteAutoRetryTriggers(_batchName) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    for (let i = 0; i < triggers.length; i++) {
      if (triggers[i].getHandlerFunction() === 'autoRetryExecutor') {
        ScriptApp.deleteTrigger(triggers[i]);
      }
    }
  } catch (error) {}
}

function cleanupOldTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      if (trigger.getHandlerFunction() === 'autoRetryExecutor') {
        const triggerTime = trigger.getTriggerSource();
        if (now - triggerTime > DAY_MS) {
          ScriptApp.deleteTrigger(trigger);
        }
      }
    }
  } catch (error) {}
}

function resetAutoRetryCounters() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    let count = 0;

    for (const key in allProps) {
      if (key.startsWith('RETRY_') || key.startsWith('TRIGGER_DATA_')) {
        props.deleteProperty(key);
        count++;
      }
    }

    addLog(`🔧 Сброшено: ${count}`, 'INFO');
    SpreadsheetApp.getUi().alert(`✅ Сброшено счётчиков: ${count}`);
  } catch (error) {}
}

function showAutoRetryStatus() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const status = [];

    for (const key in allProps) {
      if (key.startsWith('TRIGGER_DATA_')) {
        const data = JSON.parse(allProps[key]);
        status.push(
          `${data.batchName}: попытка ${data.attempt}/${GLOBAL_CONFIG.MAX_AUTO_RETRIES}\n` +
          `Запланировано: ${new Date(data.executeAt).toLocaleString('ru-RU')}`
        );
      }
    }

    if (status.length === 0) {
      SpreadsheetApp.getUi().alert('ℹ️ Нет запланированных авто-повторов');
    } else {
      SpreadsheetApp.getUi().alert('⏰ Запланированные:\n\n' + status.join('\n\n'));
    }
  } catch (error) {}
}

function unfreezeAllSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    let count = 0;

    for (let i = 0; i < sheets.length; i++) {
      const sheet = sheets[i];
      sheet.setFrozenRows(0);
      sheet.setFrozenColumns(0);
      addLog(`🔓 ${sheet.getName()}: открепления`, 'INFO');
      count++;
    }

    SpreadsheetApp.getUi().alert(`✅ Откреплено листов: ${count}`);
    addLog(`✅ Успешно откреплено ${count} листов`, 'INFO');
  } catch (error) {
    addLog(`❌ Ошибка: ${error.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка: ' + error.message);
  }
}

/**
 * ⭐ ДЕТАЛЬНАЯ СТАТИСТИКА БАТЧА
 */
function BatchStartComplete(batchName, successCount, errorCount, totalCells) {
  try {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('ru-RU');
    const totalProcessed = successCount + errorCount;
    const successRate = totalProcessed > 0 ? ((successCount / totalProcessed) * 100).toFixed(1) : '0.0';

    Logger.log('==========================================');
    Logger.log(`🎯 BATCH COMPLETE: ${batchName}`);
    Logger.log(`⏰ Время: ${timestamp}`);
    Logger.log('📊 Статистика:');
    Logger.log(`   ✅ Обновлено: ${successCount}`);
    Logger.log(`   ❌ Ошибки: ${errorCount}`);
    Logger.log(`   📋 Обработано: ${totalProcessed}/${totalCells}`);
    Logger.log(`   📈 Успешность: ${successRate}%`);
    Logger.log('💾 Кеширование: ОТКЛЮЧЕНО (skipCache=true)');
    Logger.log(`⏱️ Временная логика: АКТИВНА (пропуск < ${GLOBAL_CONFIG.SKIP_FRESH_MINUTES} мин только успешных)`);
    Logger.log('==========================================');

    addLog('==========================================', 'INFO');
    addLog(`🎯 BATCH COMPLETE: ${batchName}`, 'INFO');
    addLog(`📊 ✅: ${successCount} | ❌: ${errorCount} | Обработано: ${totalProcessed}/${totalCells}`, 'INFO');
    addLog(`📈 Успешность: ${successRate}%`, 'INFO');
    addLog('💾 Кеш: ОТК | Логика: ✅ ИСПРАВЛЕНА', 'INFO');
    addLog('==========================================', 'INFO');
  } catch (error) {
    addLog(`❌ Ошибка в BatchStartComplete: ${error.message}`, 'ERROR');
  }
}
