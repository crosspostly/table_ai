/**
 * ============================================================================
 * BATCH UPDATE SYSTEM v3.1
 * Система batch операций с автоматическим переповторением + проверка Success
 * ============================================================================
 *
 * ЕДИНСТВЕННОЕ МЕСТО для редактирования batch операций!
 *
 * При добавлении новой операции:
 * 1. Добавь объект в BATCH_OPERATIONS (ниже)
 * 2. Скопируй-вставь шаблон функции (из раздела "ФУНКЦИИ ДЛЯ МЕНЮ")
 * 3. Сохрани файл
 * 4. Перезагрузи таблицу
 * 5. Готово! Новая операция появится в меню автоматически.
 *
 * СЕРВЕР НЕ ТРОГАЕМ!
 */

// ============================================================================
// 🎯 КОНФИГУРАЦИЯ BATCH-ОПЕРАЦИЙ
// Редактируй ТОЛЬКО эту часть при добавлении/изменении операций!
// ============================================================================

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

// ============================================================================
// 🔒 ГЛОБАЛЬНАЯ КОНФИГУРАЦИЯ
// Эти настройки используются сервером (передаются через config)
// ============================================================================

const GLOBAL_CONFIG = {
  MAX_CONCURRENT_REQUESTS: 2, // Сколько запросов одновременно
  ACTIVE_REQUESTS: 0,
  QUEUE: [],
  SKIP_FRESH_MINUTES: 10, // Пропускать успешные ячейки < 10 минут
  AUTO_RETRY_ENABLED: true, // Включить авто-повтор
  AUTO_RETRY_DELAY_MINUTES: 1, // Повтор через 1 минуту
  MAX_AUTO_RETRIES: 3, // Максимум 3 автоповтора
};

// ============================================================================
// 🔧 ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ
// ============================================================================

/**
 * Универсальная функция запуска batch операции
 *
 * Эта функция:
 * 1. Берёт конфигурацию из BATCH_OPERATIONS
 * 2. Передаёт её на сервер через callServerAction_()
 * 3. Показывает результат пользователю
 *
 * @param {string} operationKey - Ключ операции из BATCH_OPERATIONS
 */
function batchStart_(operationKey) {
  // Берём конфигурацию из локальной константы
  const config = BATCH_OPERATIONS[operationKey];

  // Проверяем что операция существует
  if (!config) {
    addLog(`❌ Операция ${operationKey} не найдена в BATCH_OPERATIONS`, 'ERROR');
    SpreadsheetApp.getUi().alert('Ошибка: операция не найдена в BATCH_OPERATIONS');
    return;
  }

  // Логируем запуск
  addLog(`▶️ Запуск: ${config.name}`, 'INFO');

  try {
    // ВЫЗЫВАЕМ СЕРВЕР, ПЕРЕДАВАЯ CONFIG
    const result = callServerAction_('batchUpdate', 'runSegment', {
      operation: operationKey,
      config: config, // ← ВОТ ОНА, конфигурация!
    });

    // Проверяем результат
    if (result.success && result.data) {
      // Формируем сообщение
      const msg = `✅ ${result.data.name}\n\n` +
        `Обработано: ${result.data.processed}\n` +
        `Ошибок: ${result.data.errors}\n` +
        `Пропущено: ${result.data.skipped}\n` +
        `Время: ${result.data.duration}мс`;

      // Показываем пользователю
      SpreadsheetApp.getUi().alert(msg);

      // Логируем успех
      addLog(`✅ ${operationKey} завершено: ${result.data.processed} ячеек`, 'INFO');
    } else {
      // Сервер вернул ошибку
      throw new Error(result.error || 'Неизвестная ошибка');
    }
  } catch (e) {
    // Ловим ошибки (сервер недоступен, таймаут, и т.д.)
    addLog(`❌ Ошибка ${operationKey}: ${e.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка выполнения:\n\n' + e.message);
  }
}

// ============================================================================
// 🎯 ФУНКЦИИ ДЛЯ МЕНЮ (копируй-вставь при добавлении новой операции!)
// ============================================================================

/**
 * ШАБЛОН для новой операции:
 *
 * function НовоеИмя() {
 *   batchStart_('новый_ключ');
 * }
 *
 * Где:
 * - НовоеИмя - ключ из BATCH_OPERATIONS с заглавной первой буквой
 *   Пример: etap1 → Etap1, faza2 → Faza2
 * - новый_ключ - ключ из BATCH_OPERATIONS как есть
 */

function Etap1() {
  batchStart_('etap1');
}

function Etap2_1() {
  batchStart_('etap2_1');
}

function Etap2_2() {
  batchStart_('etap2_2');
}

function Faza1() {
  batchStart_('faza1');
}

function Archetype() {
  batchStart_('archetype');
}

function Common_ca() {
  batchStart_('common_ca');
}

function Faza2() {
  batchStart_('faza2');
}

function Faza3() {
  batchStart_('faza3');
}

function BrendDesign() {
  batchStart_('brendDesign');
}

function Resume() {
  batchStart_('resume');
}

function AnalizConc() {
  batchStart_('analizConc');
}

function AnalizCA() {
  batchStart_('analizCA');
}

// ============================================================================
// 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СЕРВЕРА
// ============================================================================

/**
 * Получить все операции для отправки на сервер
 * Используется для статуса и других операций, требующих все операции
 * @return {Array} Массив объектов {operation, config}
 */
function getAllOperationsForServer() {
  const operations = [];

  for (const [key, config] of Object.entries(BATCH_OPERATIONS)) {
    operations.push({
      operation: key,
      config: config,
    });
  }

  return operations;
}

// ============================================================================
// 📋 ПОСТРОЕНИЕ BATCH МЕНЮ
// ============================================================================

/**
 * Создаёт подменю '🎯 AI Конструктор' с batch операциями
 *
 * Эта функция вызывается из Main.gs → buildMenu_()
 *
 * Динамически добавляет все операции из BATCH_OPERATIONS:
 * 1. Читает константу
 * 2. Для каждой операции формирует имя функции (etap1 → Etap1)
 * 3. Проверяет что функция существует
 * 4. Добавляет в меню
 *
 * @return {Menu} Подменю для добавления в главное меню
 */
function buildBatchMenu_() {
  const ui = SpreadsheetApp.getUi();

  // Проверяем что константа определена
  if (!BATCH_OPERATIONS || Object.keys(BATCH_OPERATIONS).length === 0) {
    addLog('❌ BATCH_OPERATIONS не определена или пуста', 'ERROR');
    throw new Error('BATCH_OPERATIONS не найдена');
  }

  // Создаём подменю
  const aiMenu = ui.createMenu('🎯 AI Конструктор')
    .addItem('🎯 Настроить запрос', 'openCollectConfigUI')
    .addItem('🔄 Обновить ячейку', 'refreshCellWithConfig')
    .addSeparator();

  // Динамически добавляем все batch операции
  for (const [key, config] of Object.entries(BATCH_OPERATIONS)) {
    // Формируем имя функции: etap1 → Etap1
    const funcName = key.charAt(0).toUpperCase() + key.slice(1);

    // Проверяем что функция существует
    if (typeof this[funcName] !== 'function') {
      addLog(`⚠️ Функция ${funcName} не найдена для ${key}`, 'WARN');
      continue;
    }

    // Добавляем в меню
    aiMenu.addItem(config.name, funcName);
    addLog(`  ✓ Добавлена операция: ${config.name} → ${funcName}()`, 'DEBUG');
  }

  addLog(`✅ Batch меню создано: ${Object.keys(BATCH_OPERATIONS).length} операций`, 'INFO');

  return aiMenu;
}

// ============================================================================
// 📊 ФУНКЦИИ СТАТУСА (для DEV меню)
// ============================================================================

/**
 * Показать статус всех batch операций
 * Вызывается из DEV меню
 */
function showBatchStatus() {
  try {
    addLog('📊 Запрос статуса всех batch операций', 'INFO');

    // Получаем все операции для отправки на сервер
    const operations = getAllOperationsForServer();

    // Вызываем сервер для получения статуса
    const result = callServerAction_('batchUpdate', 'getStatus', {
      operations: operations,
    });

    if (result.success && result.data) {
      // Формируем текст статуса
      let statusText = '📊 СТАТУС BATCH ОПЕРАЦИЙ\n\n';
      statusText += `Всего ячеек: ${result.data.total}\n`;
      statusText += `Обработано: ${result.data.processed}\n`;
      statusText += `Ожидает: ${result.data.pending}\n`;
      statusText += `Прогресс: ${result.data.progress}%\n\n`;

      statusText += '📋 Детально по операциям:\n';

      for (const [key, status] of Object.entries(result.data.operations)) {
        statusText += `\n${status.name}\n`;
        statusText += `  Обработано: ${status.processed}/${status.total} (${status.progress}%)\n`;
        statusText += `  Ожидает: ${status.pending}\n`;
      }

      SpreadsheetApp.getUi().alert(statusText);
      addLog('✅ Статус получен и показан', 'INFO');
    } else {
      throw new Error(result.error || 'Неизвестная ошибка');
    }
  } catch (e) {
    addLog(`❌ Ошибка получения статуса: ${e.message}`, 'ERROR');
    SpreadsheetApp.getUi().alert('❌ Ошибка получения статуса:\n\n' + e.message);
  }
}
