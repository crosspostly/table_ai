/**
 * Migration Script для Collect Config System
 * Переносит данные из старого хранилища (лист ConfigData) в новое (PropertiesService)
 * 
 * Использование:
 * 1. Откройте таблицу с данными в ConfigData
 * 2. Запустите функцию migrateConfigDataToTemplates() из редактора скриптов
 * 3. Проверьте результат в логах
 * 
 * Version: 1.0.0
 * Author: Droid (Factory AI)
 * Created: 2025-10-18
 */

/**
 * Основная функция миграции
 * Переносит все конфигурации из листа ConfigData в PropertiesService как шаблоны
 * 
 * @return {{success: boolean, message: string, migrated: number, errors: Array}}
 */
function migrateConfigDataToTemplates() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName('ConfigData');
    
    if (!configSheet) {
      return {
        success: true,
        message: 'Лист ConfigData не найден. Миграция не требуется.',
        migrated: 0,
        errors: []
      };
    }
    
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var data = configSheet.getDataRange().getValues();
    
    // Проверка структуры данных
    if (data.length === 0) {
      return {
        success: true,
        message: 'Лист ConfigData пустой. Нечего мигрировать.',
        migrated: 0,
        errors: []
      };
    }
    
    var migrated = 0;
    var errors = [];
    var skipped = 0;
    
    // Предполагаемая структура ConfigData:
    // Row 0 (header): SheetName, CellAddress, SystemPromptSheet, SystemPromptCell, UserDataJSON
    // Row 1+: данные
    
    // Пропускаем заголовок
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      // Пропускаем пустые строки
      if (!row[0] && !row[1]) {
        skipped++;
        continue;
      }
      
      try {
        var sheetName = row[0] || '';
        var cellAddress = row[1] || '';
        var systemPromptSheet = row[2] || '';
        var systemPromptCell = row[3] || '';
        var userDataJSON = row[4] || '[]';
        
        if (!sheetName || !cellAddress) {
          errors.push('Строка ' + (i + 1) + ': пропущена (нет sheetName или cellAddress)');
          skipped++;
          continue;
        }
        
        // Парсим userData
        var userData = [];
        try {
          userData = JSON.parse(userDataJSON);
        } catch (e) {
          errors.push('Строка ' + (i + 1) + ': ошибка парсинга userData - ' + e.message);
          skipped++;
          continue;
        }
        
        // Создаём конфигурацию
        var config = {
          systemPrompt: {
            sheet: systemPromptSheet,
            cell: systemPromptCell
          },
          userData: userData
        };
        
        // Генерируем имя шаблона
        var templateName = sheetName + '!' + cellAddress + ' (migrated)';
        
        // Сохраняем как шаблон
        var result = saveTemplate(user, templateName, config);
        
        if (result.success) {
          migrated++;
          Logger.log('Мигрировано: ' + templateName);
        } else {
          errors.push('Строка ' + (i + 1) + ' (' + templateName + '): ' + result.message);
        }
        
      } catch (e) {
        errors.push('Строка ' + (i + 1) + ': неожиданная ошибка - ' + e.message);
      }
    }
    
    // Логирование результата
    if (typeof addSystemLog === 'function') {
      addSystemLog(
        'Migration completed: ' + migrated + ' templates migrated, ' + 
        skipped + ' skipped, ' + errors.length + ' errors',
        'INFO',
        'MIGRATION'
      );
    }
    
    var message = 'Миграция завершена!\n\n';
    message += '✅ Мигрировано: ' + migrated + '\n';
    message += '⏭️ Пропущено: ' + skipped + '\n';
    message += '❌ Ошибок: ' + errors.length;
    
    if (errors.length > 0) {
      message += '\n\nПервые 5 ошибок:\n' + errors.slice(0, 5).join('\n');
    }
    
    return {
      success: true,
      message: message,
      migrated: migrated,
      errors: errors
    };
    
  } catch (e) {
    Logger.log('Migration error: ' + e.message);
    return {
      success: false,
      message: 'Критическая ошибка миграции: ' + e.message,
      migrated: 0,
      errors: [e.message]
    };
  }
}

/**
 * Интерактивная миграция с диалогом подтверждения
 * Вызывается через меню или вручную
 */
function interactiveMigration() {
  var ui = SpreadsheetApp.getUi();
  
  // Предупреждение
  var response = ui.alert(
    '⚠️ Миграция данных',
    'Эта функция перенесёт все конфигурации из листа ConfigData\n' +
    'в новое хранилище шаблонов (PropertiesService).\n\n' +
    'Старые данные НЕ будут удалены.\n\n' +
    'Продолжить?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    ui.alert('Миграция отменена');
    return;
  }
  
  // Показываем прогресс
  ui.alert(
    '🚀 Запуск миграции',
    'Миграция запущена. Это может занять некоторое время.\n\n' +
    'Пожалуйста, подождите...',
    ui.ButtonSet.OK
  );
  
  // Выполняем миграцию
  var result = migrateConfigDataToTemplates();
  
  // Показываем результат
  if (result.success) {
    ui.alert('✅ Миграция завершена', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ Ошибка миграции', result.message, ui.ButtonSet.OK);
  }
}

/**
 * Проверка данных перед миграцией
 * Показывает статистику без реального переноса
 * 
 * @return {{total: number, valid: number, invalid: number, details: Array}}
 */
function validateBeforeMigration() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var configSheet = ss.getSheetByName('ConfigData');
    
    if (!configSheet) {
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        details: ['Лист ConfigData не найден']
      };
    }
    
    var data = configSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        total: 0,
        valid: 0,
        invalid: 0,
        details: ['ConfigData пустой или содержит только заголовок']
      };
    }
    
    var total = data.length - 1; // Минус заголовок
    var valid = 0;
    var invalid = 0;
    var details = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var sheetName = row[0] || '';
      var cellAddress = row[1] || '';
      var systemPromptSheet = row[2] || '';
      var systemPromptCell = row[3] || '';
      var userDataJSON = row[4] || '[]';
      
      if (!sheetName || !cellAddress) {
        invalid++;
        details.push('Строка ' + (i + 1) + ': нет sheetName или cellAddress');
        continue;
      }
      
      try {
        JSON.parse(userDataJSON);
      } catch (e) {
        invalid++;
        details.push('Строка ' + (i + 1) + ': некорректный JSON');
        continue;
      }
      
      valid++;
    }
    
    return {
      total: total,
      valid: valid,
      invalid: invalid,
      details: details
    };
    
  } catch (e) {
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      details: ['Ошибка проверки: ' + e.message]
    };
  }
}

/**
 * Показывает диалог с предварительной проверкой
 */
function showMigrationPreview() {
  var ui = SpreadsheetApp.getUi();
  var validation = validateBeforeMigration();
  
  var message = '📊 СТАТИСТИКА ДАННЫХ ДЛЯ МИГРАЦИИ\n\n';
  message += 'Всего записей: ' + validation.total + '\n';
  message += '✅ Корректных: ' + validation.valid + '\n';
  message += '❌ Некорректных: ' + validation.invalid + '\n\n';
  
  if (validation.invalid > 0) {
    message += 'Проблемы (первые 5):\n';
    message += validation.details.slice(0, 5).join('\n');
  }
  
  if (validation.valid === 0) {
    message += '\n\n⚠️ Нечего мигрировать!';
  } else {
    message += '\n\nДля запуска миграции используйте:\nМеню → Скрипт → interactiveMigration()';
  }
  
  ui.alert('Предварительная проверка', message, ui.ButtonSet.OK);
}

/**
 * Откат миграции - удаляет все мигрированные шаблоны
 * ВНИМАНИЕ: Удалит ВСЕ шаблоны с пометкой "(migrated)"
 */
function rollbackMigration() {
  var ui = SpreadsheetApp.getUi();
  
  var response = ui.alert(
    '⚠️ ОТКАТ МИГРАЦИИ',
    'Эта функция удалит ВСЕ шаблоны с пометкой "(migrated)".\n\n' +
    'Это действие НЕЛЬЗЯ отменить!\n\n' +
    'Продолжить?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    ui.alert('Откат отменён');
    return;
  }
  
  try {
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var templates = getAllTemplates(user);
    var deleted = 0;
    
    for (var templateName in templates) {
      if (templateName.indexOf('(migrated)') !== -1) {
        var result = deleteTemplate(user, templateName);
        if (result.success) {
          deleted++;
        }
      }
    }
    
    ui.alert(
      '✅ Откат завершён',
      'Удалено шаблонов: ' + deleted,
      ui.ButtonSet.OK
    );
    
  } catch (e) {
    ui.alert('❌ Ошибка отката', e.message, ui.ButtonSet.OK);
  }
}

/**
 * Экспорт текущих шаблонов в лист для резервного копирования
 * Создаёт лист "TemplatesBackup" с копией всех шаблонов
 */
function exportTemplatesToSheet() {
  try {
    var user = Session.getActiveUser().getEmail() || 'anonymous';
    var templates = getAllTemplates(user);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Создаём или очищаем лист
    var backupSheet = ss.getSheetByName('TemplatesBackup');
    if (backupSheet) {
      backupSheet.clear();
    } else {
      backupSheet = ss.insertSheet('TemplatesBackup');
    }
    
    // Заголовки
    var headers = ['Template Name', 'System Prompt Sheet', 'System Prompt Cell', 'User Data JSON', 'Created', 'Updated'];
    backupSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    backupSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    
    // Данные
    var rowData = [];
    for (var templateName in templates) {
      var template = templates[templateName];
      var config = template.config || template;
      
      rowData.push([
        templateName,
        config.systemPrompt ? config.systemPrompt.sheet : '',
        config.systemPrompt ? config.systemPrompt.cell : '',
        JSON.stringify(config.userData || []),
        template.created || '',
        template.updated || ''
      ]);
    }
    
    if (rowData.length > 0) {
      backupSheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);
    }
    
    backupSheet.autoResizeColumns(1, headers.length);
    
    SpreadsheetApp.getUi().alert(
      '✅ Экспорт завершён',
      'Шаблоны экспортированы в лист "TemplatesBackup"\n\n' +
      'Экспортировано: ' + rowData.length + ' шаблонов',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Ошибка экспорта', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
