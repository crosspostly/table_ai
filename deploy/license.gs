// ═══════════════════════════════════════════════════════════════
// LICENSE MODULE v3.0
// Вся логика лицензий в отдельном модуле
// Используется только на сервере через server.gs
// ═══════════════════════════════════════════════════════════════

// ===== Constants =====
const LICENSE_SHEET_ID = '1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s';
const TOKENS_SHEET_NAME = 'Tokens';
const BINDINGS_SHEET_NAME = 'Bindings';

/**
 * ✅ ОСНОВНАЯ ФУНКЦИЯ: Проверка лицензии и управление привязками
 *
 * @param {string} token - Токен лицензии
 * @param {string} email - Email пользователя
 * @param {string} scriptId - Script ID (для привязки)
 * @param {string} spreadsheetId - Spreadsheet ID (для работы)
 * @return {Object} Результат проверки
 */

function checkLicense_(token, email, scriptId, spreadsheetId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
    // ═══════════════════════════════════════════════════════════════

    if (!token) {
      Logger.log('❌ NO_TOKEN');
      return {ok: false, error: 'NO_TOKEN'};
    }
    if (!email) {
      Logger.log('❌ NO_EMAIL');
      return {ok: false, error: 'NO_EMAIL'};
    }
    
    // ⭐ НОВОЕ: Если scriptId не передан - пытаемся получить из Bindings
    if (!scriptId) {
      Logger.log('📚 scriptId not provided, fetching from Bindings');
      scriptId = getScriptIdFromBindingsForOTA_(email);
      
      if (!scriptId) {
        Logger.log(`⚠️ Warning: Cannot find scriptId for ${email} in Bindings`);
        // Не блокируем проверку лицензии - просто логируем
        // (scriptId может быть опциональным для некоторых операций)
      }
    }

    Logger.log('📋 License check: email=' + email + ', scriptId=' + (scriptId ? scriptId.substring(0, 12) + '...' : 'not provided'));

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ОТКРЫТИЕ ТАБЛИЦЫ ЛИЦЕНЗИЙ
    // ═══════════════════════════════════════════════════════════════

    const ss = SpreadsheetApp.openById(LICENSE_SHEET_ID);

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ШАГ 1: ПРОВЕРКА ЛИЦЕНЗИИ В "Tokens"
    // ═══════════════════════════════════════════════════════════════

    const tokensSheet = ss.getSheetByName(TOKENS_SHEET_NAME);
    if (!tokensSheet) {
      Logger.log('❌ TOKENS_SHEET_NOT_FOUND');
      return {ok: false, error: 'TOKENS_SHEET_NOT_FOUND'};
    }

    const licenseInfo = validateLicense_(tokensSheet, email, token);

    if (!licenseInfo) {
      Logger.log('❌ NOT_FOUND: email=' + email + ', token=' + token.substring(0, 4) + '****');
      return {ok: false, error: 'NOT_FOUND'};
    }

    Logger.log('✅ Лицензия найдена в строке ' + (licenseInfo.rowIndex + 1));

    // Проверка статуса
    if (!licenseInfo.isActive) {
      Logger.log('❌ INACTIVE: статус = ' + licenseInfo.status);
      return {
        ok: false,
        error: 'INACTIVE',
        message: 'Лицензия неактивна. Статус: ' + licenseInfo.status,
        row: licenseInfo.rowIndex + 1,
      };
    }

    // Проверка даты
    if (!licenseInfo.isNotExpired) {
      Logger.log('❌ EXPIRED: until = ' + licenseInfo.untilIso);
      return {
        ok: false,
        error: 'EXPIRED',
        message: 'Лицензия истекла: ' + licenseInfo.untilIso,
        until: licenseInfo.untilIso,
        row: licenseInfo.rowIndex + 1,
      };
    }

    Logger.log('✅ Лицензия активна до: ' + licenseInfo.untilIso);
    Logger.log('📊 Доступно копий: ' + licenseInfo.copiesCount);

    // ═══════════════════════════════════════════════════════════════
    // ⭐ ШАГ 2: ПРОВЕРКА ПРИВЯЗОК В "Bindings"
    // ═══════════════════════════════════════════════════════════════

    const bindingsSheet = ensureBindingsSheet_(ss);
    const userBindings = getBindings_(bindingsSheet, email);

    Logger.log('📋 Найдено привязок для ' + email + ': ' + userBindings.length);

    // Проверяем есть ли уже такой scriptId
    const existingBinding = userBindings.find(function(b) {
      return b.scriptId === scriptId;
    });

    // ═══════════════════════════════════════════════════════════════
    // ⭐ СЛУЧАЙ 1: Скрипт УЖЕ ПРИВЯЗАН
    // ═══════════════════════════════════════════════════════════════

    if (existingBinding) {
      const usedCopies = userBindings.length;
      const totalCopies = licenseInfo.copiesCount + usedCopies;

      Logger.log('✅ Скрипт уже привязан, доступ разрешён');
      Logger.log('  Использовано: ' + usedCopies);
      Logger.log('  Доступно: ' + licenseInfo.copiesCount);
      Logger.log('  Всего: ' + totalCopies);

      return {
        ok: true,
        until: licenseInfo.untilIso,
        row: licenseInfo.rowIndex + 1,
        message: 'SCRIPT_ALLOWED',
        quota: {
          remaining: licenseInfo.copiesCount,
          total: totalCopies,
          used: usedCopies,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ СЛУЧАЙ 2: Скрипт НЕ ПРИВЯЗАН - Проверяем квоту
    // ═══════════════════════════════════════════════════════════════

    if (licenseInfo.copiesCount <= 0) {
      const usedCopies = userBindings.length;
      const totalCopies = usedCopies; // ← ИСПРАВЛЕНО: правильный расчёт

      Logger.log('❌ Нет доступных копий');
      Logger.log('  Использовано: ' + usedCopies);
      Logger.log('  Доступно: 0');
      Logger.log('  Всего было: ' + totalCopies);

      return {
        ok: false,
        error: 'NO_QUOTA_LEFT',
        message: 'Количество копий исчерпано. Обратитесь к создателю: https://vk.com/daoqub',
        row: licenseInfo.rowIndex + 1,
        quota: {
          remaining: 0,
          total: totalCopies, // ← ИСПРАВЛЕНО
          used: usedCopies,
        },
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // ⭐ СЛУЧАЙ 3: Есть квота - Добавляем новую привязку
    // ═══════════════════════════════════════════════════════════════

    Logger.log('🔄 Привязываем новый скрипт (копий доступно: ' + licenseInfo.copiesCount + ')');

    try {
      // Добавляем привязку
      const bindingAdded = addBinding_(bindingsSheet, email, spreadsheetId, scriptId);
      if (!bindingAdded) {
        throw new Error('Не удалось добавить привязку');
      }

      Logger.log('✅ Новая привязка добавлена');

      // Сортируем "Bindings"
      sortSheetByEmail_(bindingsSheet, 3);
      Logger.log('✅ Лист "Bindings" отсортирован');

      // Обновляем copies_count
      const newCopiesCount = licenseInfo.copiesCount - 1;
      const countUpdated = updateCopiesCount_(tokensSheet, licenseInfo.rowIndex, newCopiesCount);
      if (!countUpdated) {
        throw new Error('Не удалось обновить copies_count');
      }

      Logger.log('✅ copies_count обновлён: ' + licenseInfo.copiesCount + ' → ' + newCopiesCount);

      // Сортируем "Tokens"
      sortSheetByEmail_(tokensSheet, 5);
      Logger.log('✅ Лист "Tokens" отсортирован');

      const usedCopies = userBindings.length + 1;
      const totalCopies = newCopiesCount + usedCopies;

      Logger.log('✅ Новый скрипт привязан успешно');
      Logger.log('  Script ID: ' + scriptId);
      Logger.log('  Sheet ID: ' + spreadsheetId);
      Logger.log('  Использовано: ' + usedCopies);
      Logger.log('  Копий осталось: ' + newCopiesCount);

      return {
        ok: true,
        until: licenseInfo.untilIso,
        row: licenseInfo.rowIndex + 1,
        message: 'SCRIPT_BOUND_NEW',
        quota: {
          remaining: newCopiesCount,
          total: totalCopies,
          used: usedCopies,
        },
      };
    } catch (e) {
      Logger.log('❌ Ошибка привязки: ' + e.message);
      return {ok: false, error: 'BINDING_ERROR: ' + e.message, row: licenseInfo.rowIndex + 1};
    }
  } catch (e) {
    Logger.log('❌ checkLicense_ EXCEPTION: ' + e.message);
    return {ok: false, error: 'LICENSE_ERROR: ' + e.message};
  } finally {
    lock.releaseLock();
  }
}

/**
 * Проверка лицензии в листе "Tokens"
 * @param {Sheet} tokensSheet - Лист "Tokens"
 * @param {string} email - Email
 * @param {string} token - Token
 * @return {Object|null} Информация о лицензии или null
 */
function validateLicense_(tokensSheet, email, token) {
  const tokensData = tokensSheet.getDataRange().getValues();

  if (!tokensData || tokensData.length < 2) {
    return null;
  }

  const emailL = String(email).toLowerCase().trim();
  const tokenS = String(token).trim();
  const now = new Date();

  for (let r = 1; r < tokensData.length; r++) {
    const row = tokensData[r];
    const em = String(row[0] || '').toLowerCase().trim(); // A: Email
    const t = String(row[1] || '').trim(); // B: Token

    if (t && em && t === tokenS && em === emailL) {
      const expiredDate = row[2]; // C: ExpiredDate
      const status = String(row[3] || '').toLowerCase().trim(); // D: Status
      const copiesCount = parseInt(String(row[4] || '0').trim()) || 0; // E: copies_count

      const isActive = (status === 'active' || status === 'активен' || status === 'активный');

      let isNotExpired = true;
      let untilIso = null;

      // ⭐ УЛУЧШЕННЫЙ ПАРСИНГ ДАТЫ
      if (expiredDate) {
        let dt = null;

        // Если это уже Date объект из Sheets
        if (expiredDate instanceof Date) {
          dt = expiredDate;
        } else {
          // Пробуем распарсить как строку
          const dateStr = String(expiredDate).trim();

          // Поддержка форматов: 2026-06-01, 01.06.2026, 06/01/2026
          if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // YYYY-MM-DD → добавляем время чтобы избежать UTC проблем
            dt = new Date(dateStr + 'T23:59:59');
          } else {
            dt = new Date(dateStr);
          }
        }

        // Проверяем что дата валидна
        if (dt && !isNaN(dt.getTime())) {
          isNotExpired = dt >= now;
          untilIso = dt.toISOString();

          Logger.log('📅 Дата истечения: ' + untilIso);
          Logger.log('📅 Сегодня: ' + now.toISOString());
          Logger.log('📅 Истекла: ' + !isNotExpired);
        } else {
          Logger.log('⚠️ ВНИМАНИЕ: Некорректный формат даты в ExpiredDate: ' + expiredDate);
          Logger.log('⚠️ Дата будет игнорирована, лицензия считается бессрочной');
          isNotExpired = true; // Если дата некорректна - не блокируем
        }
      } else {
        Logger.log('ℹ️ ExpiredDate не указан - лицензия бессрочная');
      }

      return {
        rowIndex: r,
        email: em,
        token: t,
        status: status,
        isActive: isActive,
        expiredDate: expiredDate,
        isNotExpired: isNotExpired,
        untilIso: untilIso,
        copiesCount: copiesCount,
      };
    }
  }

  return null;
}

/**
 * Получение всех привязок для email
 * @param {Sheet} bindingsSheet - Лист "Bindings"
 * @param {string} email - Email
 * @return {Array} Массив привязок
 */
function getBindings_(bindingsSheet, email) {
  const bindingsData = bindingsSheet.getDataRange().getValues();
  const emailL = String(email).toLowerCase().trim();
  const userBindings = [];

  for (let r = 1; r < bindingsData.length; r++) {
    const row = bindingsData[r];
    const bindEmail = String(row[0] || '').toLowerCase().trim(); // A: Email

    if (bindEmail === emailL) {
      userBindings.push({
        rowIndex: r,
        email: bindEmail,
        sheetId: String(row[1] || '').trim(), // B: sheet_ids
        scriptId: String(row[2] || '').trim(), // C: script_ids
      });
    }
  }

  return userBindings;
}

/**
 * Добавление новой привязки
 * @param {Sheet} bindingsSheet - Лист "Bindings"
 * @param {string} email - Email
 * @param {string} spreadsheetId - Sheet ID
 * @param {string} scriptId - Script ID
 * @return {boolean} Успех операции
 */
function addBinding_(bindingsSheet, email, spreadsheetId, scriptId) {
  try {
    bindingsSheet.appendRow([email, spreadsheetId, scriptId]);
    return true;
  } catch (e) {
    Logger.log('❌ addBinding_ error: ' + e.message);
    return false;
  }
}

/**
 * Обновление copies_count в "Tokens"
 * @param {Sheet} tokensSheet - Лист "Tokens"
 * @param {number} rowIndex - Индекс строки (0-based)
 * @param {number} newValue - Новое значение
 * @return {boolean} Успех операции
 */
function updateCopiesCount_(tokensSheet, rowIndex, newValue) {
  try {
    tokensSheet.getRange(rowIndex + 1, 5).setValue(newValue); // E: copies_count
    return true;
  } catch (e) {
    Logger.log('❌ updateCopiesCount_ error: ' + e.message);
    return false;
  }
}

/**
 * Сортировка листа по колонке A (Email)
 * @param {Sheet} sheet - Лист для сортировки
 * @param {number} numColumns - Количество колонок
 * @return {boolean} Успех операции
 */
function sortSheetByEmail_(sheet, numColumns) {
  try {
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return true; // Нечего сортировать

    const range = sheet.getRange(2, 1, lastRow - 1, numColumns);
    range.sort(1); // Сортировка по колонке 1 (A = Email)
    return true;
  } catch (e) {
    Logger.log('❌ sortSheetByEmail_ error: ' + e.message);
    return false;
  }
}

/**
 * Создание листа "Bindings" если его нет
 * @param {Spreadsheet} ss - Таблица
 * @return {Sheet} Лист "Bindings"
 */
function ensureBindingsSheet_(ss) {
  let sheet = ss.getSheetByName(BINDINGS_SHEET_NAME);

  if (!sheet) {
    Logger.log('⚠️ Лист "Bindings" не найден, создаём...');
    sheet = ss.insertSheet(BINDINGS_SHEET_NAME);
    sheet.appendRow(['Email', 'sheet_ids', 'script_ids']);
    Logger.log('✅ Лист "Bindings" создан');
  }

  return sheet;
}
