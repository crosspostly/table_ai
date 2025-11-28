/**
 * Тестирование новой системы лицензий v3.0
 * Выполнять на сервере (server.gs)
 */

/**
 * Тестирование модуля license.gs
 */
function testLicenseModule() {
  Logger.log('=== ТЕСТИРОВАНИЕ МОДУЛЯ LICENSE.V3 ===');
  
  // Тестовые данные
  const testEmail = 'sheepoff@gmail.com';
  const testToken = 'test';
  const testScriptId = 'AKfycbyTEST123456789';
  const testSpreadsheetId = '1testSpreadsheetIdForTesting1234567890';
  
  Logger.log('📋 Тестовые данные:');
  Logger.log('  Email: ' + testEmail);
  Logger.log('  Token: ' + testToken);
  Logger.log('  Script ID: ' + testScriptId);
  Logger.log('  Spreadsheet ID: ' + testSpreadsheetId);
  
  // ТЕСТ 1: Проверка лицензии
  Logger.log('');
  Logger.log('=== ТЕСТ 1: Проверка лицензии ===');
  const result1 = checkLicense_(testToken, testEmail, testScriptId, testSpreadsheetId);
  Logger.log('Результат: ' + JSON.stringify(result1));
  
  // ТЕСТ 2: Повторная проверка (уже привязанный скрипт)
  if (result1.ok) {
    Logger.log('');
    Logger.log('=== ТЕСТ 2: Повторная проверка ===');
    const result2 = checkLicense_(testToken, testEmail, testScriptId, testSpreadsheetId);
    Logger.log('Результат: ' + JSON.stringify(result2));
  }
  
  // ТЕСТ 3: Новый скрипт (если есть квота)
  if (result1.ok && result1.quota && result1.quota.remaining > 0) {
    Logger.log('');
    Logger.log('=== ТЕСТ 3: Новый скрипт ===');
    const result3 = checkLicense_(testToken, testEmail, 'AKfycbyNEW_SCRIPT_ID', '1newSpreadsheetIdForTesting');
    Logger.log('Результат: ' + JSON.stringify(result3));
  }
  
  Logger.log('');
  Logger.log('=== ТЕСТИРОВАНИЕ ЗАВЕРШЕНО ===');
}

/**
 * Тестирование серверных endpoint'ов
 */
function testServerEndpoints() {
  Logger.log('=== ТЕСТИРОВАНИЕ СЕРВЕРНЫХ ENDPOINT''ОВ ===');
  
  const testData = {
    email: 'sheepoff@gmail.com',
    token: 'test',
    scriptId: 'AKfycbyTEST123456789',
    spreadsheetId: '1testSpreadsheetIdForTesting1234567890'
  };
  
  // ТЕСТ 1: status endpoint
  Logger.log('');
  Logger.log('=== ТЕСТ 1: status endpoint ===');
  const statusPayload = Object.assign({action: 'status'}, testData);
  
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(statusPayload),
      muteHttpExceptions: true,
    };
    
    const resp = UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec', options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();
    
    Logger.log('HTTP Код: ' + code);
    Logger.log('Ответ: ' + responseText.substring(0, 500) + '...');
    
  } catch (e) {
    Logger.log('ОШИБКА: ' + e.message);
  }
  
  // ТЕСТ 2: validate endpoint
  Logger.log('');
  Logger.log('=== ТЕСТ 2: validate endpoint ===');
  const validatePayload = Object.assign({action: 'validate'}, testData);
  
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(validatePayload),
      muteHttpExceptions: true,
    };
    
    const resp = UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec', options);
    const code = resp.getResponseCode();
    const responseText = resp.getContentText();
    
    Logger.log('HTTP Код: ' + code);
    Logger.log('Ответ: ' + responseText.substring(0, 500) + '...');
    
  } catch (e) {
    Logger.log('ОШИБКА: ' + e.message);
  }
  
  Logger.log('');
  Logger.log('=== ТЕСТИРОВАНИЕ ENDPOINT''ОВ ЗАВЕРШЕНО ===');
}

/**
 * Тестирование клиентских функций
 * Выполнять на клиенте (Main.gs)
 */
function testClientFunctions() {
  Logger.log('=== ТЕСТИРОВАНИЕ КЛИЕНТСКИХ ФУНКЦИЙ ===');
  
  // ТЕСТ 1: validateLicense
  Logger.log('');
  Logger.log('=== ТЕСТ 1: validateLicense ===');
  const result1 = validateLicense('sheepoff@gmail.com', 'test');
  Logger.log('Результат: ' + JSON.stringify(result1));
  
  // ТЕСТ 2: serverStatus
  Logger.log('');
  Logger.log('=== ТЕСТ 2: serverStatus ===');
  const result2 = serverStatus();
  Logger.log('Результат: ' + JSON.stringify(result2));
  
  Logger.log('');
  Logger.log('=== ТЕСТИРОВАНИЕ КЛИЕНТСКИХ ФУНКЦИЙ ЗАВЕРШЕНО ===');
}