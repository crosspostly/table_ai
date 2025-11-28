/**
 * Скрипт миграции v2.0 → v3.0
 * Выполнить ОДИН РАЗ вручную
 * 
 * ИЗМЕНЕНИЯ:
 * - Удаляем колонки E, F, G из листа "Tokens" (старая структура)
 * - Добавляем колонку E: copies_count в "Tokens"
 * - Создаем лист "Bindings" с структурой: A: Email, B: sheet_ids, C: script_ids
 * - Мигрируем существующие привязки из многострочных полей в отдельные строки
 */
function migrateV2ToV3() {
  try {
    Logger.log('=== НАЧАЛО МИГРАЦИИ V2.0 → V3.0 ===');
    
    const ss = SpreadsheetApp.openById('1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s');
    const tokensSheet = ss.getSheetByName('Tokens');
    
    if (!tokensSheet) {
      throw new Error('Лист "Tokens" не найден');
    }
    
    Logger.log('✅ Лист "Tokens" найден');
    
    // ШАГ 1: Создаём Bindings если нет
    let bindingsSheet = ss.getSheetByName('Bindings');
    if (!bindingsSheet) {
      bindingsSheet = ss.insertSheet('Bindings');
      bindingsSheet.appendRow(['Email', 'sheet_ids', 'script_ids']);
      Logger.log('✅ Лист "Bindings" создан');
    } else {
      Logger.log('✅ Лист "Bindings" уже существует');
    }
    
    // ШАГ 2: Читаем текущие данные из Tokens
    const tokensData = tokensSheet.getDataRange().getValues();
    Logger.log('📋 Прочитано строк из Tokens: ' + tokensData.length);
    
    if (tokensData.length < 2) {
      Logger.log('⚠️ Лист "Tokens" пуст или только заголовки');
      return;
    }
    
    // ШАГ 3: Мигрируем привязки
    let migratedCount = 0;
    
    for (let r = 1; r < tokensData.length; r++) {
      const row = tokensData[r];
      const email = String(row[0] || '').trim();
      
      if (!email) continue;
      
      // СТАРЫЕ колонки из v2.0:
      const oldSheetIds = String(row[4] || '').trim();   // Старая E: sheet_ids
      const oldScriptIds = String(row[6] || '').trim();  // Старая G: script_ids
      
      if (!oldSheetIds || !oldScriptIds) {
        Logger.log('📋 Пропускаем строку ' + (r + 1) + ': нет старых привязок');
        continue;
      }
      
      Logger.log('📋 Обработка строки ' + (r + 1) + ': ' + email);
      
      // Парсим многострочные значения
      const sheetLines = oldSheetIds.split('\n')
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });
        
      const scriptLines = oldScriptIds.split('\n')
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l.length > 0; });
      
      Logger.log('  📄 Найдено sheet_ids: ' + sheetLines.length);
      Logger.log('  📄 Найдено script_ids: ' + scriptLines.length);
      
      // Создаём привязки (одна строка = одна привязка)
      const bindingsCount = Math.min(sheetLines.length, scriptLines.length);
      
      for (let i = 0; i < bindingsCount; i++) {
        const sheetId = sheetLines[i];
        const scriptId = scriptLines[i];
        
        if (sheetId && scriptId) {
          bindingsSheet.appendRow([email, sheetId, scriptId]);
          migratedCount++;
          Logger.log('  ✅ Мигрировано: ' + email + ' → ' + scriptId.substring(0, 12) + '...');
        }
      }
    }
    
    Logger.log('');
    Logger.log('═══════════════════════════════════');
    Logger.log('✅ МИГРАЦИЯ ПРИВЯЗОК ЗАВЕРШЕНА!');
    Logger.log('Перенесено привязок: ' + migratedCount);
    Logger.log('═══════════════════════════════════');
    
    // ШАГ 4: Обновляем структуру листа "Tokens"
    Logger.log('');
    Logger.log('🔄 Обновление структуры листа "Tokens"...');
    
    // Получаем текущие заголовки
    const headers = tokensData[0];
    Logger.log('📋 Текущие заголовки: ' + headers.join(', '));
    
    // Очищаем старые колонки E, F, G (sheet_ids, copies_count, script_ids)
    // и оставляем только A-D + новая E (copies_count)
    
    // Сначала читаем нужные данные
    const cleanData = [];
    for (let r = 0; r < tokensData.length; r++) {
      const row = tokensData[r];
      const cleanRow = [
        row[0], // A: Email
        row[1], // B: Token
        row[2], // C: ExpiredDate
        row[3], // D: Status
        r === 0 ? 'copies_count' : 5  // E: copies_count (заголовок или значение по умолчанию)
      ];
      cleanData.push(cleanRow);
    }
    
    // Очищаем лист и записываем новые данные
    tokensSheet.clear();
    tokensSheet.getRange(1, 1, cleanData.length, cleanData[0].length).setValues(cleanData);
    
    Logger.log('✅ Лист "Tokens" обновлён до структуры v3.0');
    Logger.log('📋 Новые заголовки: Email, Token, ExpiredDate, Status, copies_count');
    
    // ШАГ 5: Форматирование
    Logger.log('🎨 Применение форматирования...');
    
    // Заголовки
    const headerRange = tokensSheet.getRange(1, 1, 1, 5);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f0f0f0');
    headerRange.setHorizontalAlignment('center');
    
    // Bindings заголовки
    const bindingsHeaderRange = bindingsSheet.getRange(1, 1, 1, 3);
    bindingsHeaderRange.setFontWeight('bold');
    bindingsHeaderRange.setBackground('#f0f0f0');
    bindingsHeaderRange.setHorizontalAlignment('center');
    
    Logger.log('✅ Форматирование применено');
    
    Logger.log('');
    Logger.log('🎉 МИГРАЦИЯ V2.0 → V3.0 УСПЕШНО ЗАВЕРШЕНА!');
    Logger.log('');
    Logger.log('⚠️ СЛЕДУЮЩИЕ ШАГИ:');
    Logger.log('1. Проверьте данные в листе "Tokens" (должно быть 5 колонок)');
    Logger.log('2. Проверьте данные в листе "Bindings" (должно быть 3 колонки)');
    Logger.log('3. Установите правильные значения copies_count для каждой лицензии');
    Logger.log('4. Проверьте работу системы с новой архитектурой');
    
  } catch (e) {
    Logger.log('❌ ОШИБКА МИГРАЦИИ: ' + e.message);
    Logger.log('Stack: ' + e.stack);
  }
}

/**
 * Вспомогательная функция для проверки текущей структуры
 */
function checkCurrentStructure() {
  try {
    Logger.log('=== ПРОВЕРКА ТЕКУЩЕЙ СТРУКТУРЫ ===');
    
    const ss = SpreadsheetApp.openById('1u9rNx0Zwk4Y1cKHiquwu2jH3elpX7VUSJVgkq_Tb3-s');
    const tokensSheet = ss.getSheetByName('Tokens');
    const bindingsSheet = ss.getSheetByName('Bindings');
    
    if (!tokensSheet) {
      Logger.log('❌ Лист "Tokens" не найден');
      return;
    }
    
    Logger.log('✅ Лист "Tokens" найден');
    
    const tokensData = tokensSheet.getDataRange().getValues();
    const tokensColumns = tokensData[0].length;
    const tokensRows = tokensData.length;
    
    Logger.log('📊 Tokens: ' + tokensRows + ' строк, ' + tokensColumns + ' колонок');
    Logger.log('📋 Заголовки Tokens: ' + tokensData[0].join(', '));
    
    if (bindingsSheet) {
      const bindingsData = bindingsSheet.getDataRange().getValues();
      const bindingsColumns = bindingsData[0].length;
      const bindingsRows = bindingsData.length;
      
      Logger.log('✅ Лист "Bindings" найден');
      Logger.log('📊 Bindings: ' + bindingsRows + ' строк, ' + bindingsColumns + ' колонок');
      Logger.log('📋 Заголовки Bindings: ' + bindingsData[0].join(', '));
    } else {
      Logger.log('❌ Лист "Bindings" не найден');
    }
    
    // Проверяем, какая версия структуры
    if (tokensColumns === 5) {
      Logger.log('✅ Структура Tokens соответствует v3.0 (5 колонок)');
    } else if (tokensColumns === 7) {
      Logger.log('⚠️ Структура Tokens соответствует v2.0 (7 колонок) - нужна миграция');
    } else {
      Logger.log('❌ Неизвестная структура Tokens: ' + tokensColumns + ' колонок');
    }
    
  } catch (e) {
    Logger.log('❌ ОШИБКА ПРОВЕРКИ: ' + e.message);
  }
}