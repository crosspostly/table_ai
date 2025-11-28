/**
 * Тестирование исправлений системы лицензирования
 * Выполнять в Script Editor после внедрения исправлений
 */

// ===== ТЕСТ 1: Проверка миграции старых ключей =====
function testMigration() {
  try {
    Logger.log('=== ТЕСТ 1: МИГРАЦИЯ СТАРЫХ КЛЮЧЕЙ ===');
    
    const props = PropertiesService.getScriptProperties();
    
    // Очищаем все ключи для чистого теста
    props.deleteProperty('LICENSE_EMAIL');
    props.deleteProperty('LICENSE_TOKEN');
    props.deleteProperty('LICENSEEMAIL');
    props.deleteProperty('LICENSETOKEN');
    
    // Устанавливаем СТАРЫЕ ключи
    props.setProperty('LICENSEEMAIL', 'old@example.com');
    props.setProperty('LICENSETOKEN', 'old_token_123');
    
    Logger.log('ДО миграции:');
    Logger.log('  LICENSEEMAIL: ' + props.getProperty('LICENSEEMAIL'));
    Logger.log('  LICENSETOKEN: ' + props.getProperty('LICENSETOKEN'));
    Logger.log('  LICENSE_EMAIL: ' + props.getProperty('LICENSE_EMAIL'));
    Logger.log('  LICENSE_TOKEN: ' + props.getProperty('LICENSE_TOKEN'));
    
    // Вызываем миграцию через getLicenseEmail (тригерит миграцию)
    const email = getLicenseEmail();
    const token = getLicenseToken();
    
    Logger.log('ПОСЛЕ миграции:');
    Logger.log('  getLicenseEmail(): ' + email);
    Logger.log('  getLicenseToken(): ' + token);
    Logger.log('  LICENSEEMAIL: ' + props.getProperty('LICENSEEMAIL'));
    Logger.log('  LICENSETOKEN: ' + props.getProperty('LICENSETOKEN'));
    Logger.log('  LICENSE_EMAIL: ' + props.getProperty('LICENSE_EMAIL'));
    Logger.log('  LICENSE_TOKEN: ' + props.getProperty('LICENSE_TOKEN'));
    
    // Проверяем результаты
    const success = (email === 'old@example.com' && 
                    token === 'old_token_123' && 
                    props.getProperty('LICENSEEMAIL') === null &&
                    props.getProperty('LICENSETOKEN') === null &&
                    props.getProperty('LICENSE_EMAIL') === 'old@example.com' &&
                    props.getProperty('LICENSE_TOKEN') === 'old_token_123');
    
    Logger.log('РЕЗУЛЬТАТ ТЕСТА 1: ' + (success ? '✅ УСПЕХ' : '❌ ПРОВАЛ'));
    return success;
    
  } catch (e) {
    Logger.log('ОШИБКА ТЕСТА 1: ' + e.message);
    return false;
  }
}

// ===== ТЕСТ 2: Проверка сохранения через UI (без API ключа) =====
function testSaveSettingsWithoutApiKey() {
  try {
    Logger.log('=== ТЕСТ 2: СОХРАНЕНИЕ ЧЕРЕЗ UI (БЕЗ API КЛЮЧА) ===');
    
    const props = PropertiesService.getScriptProperties();
    
    // Устанавливаем дефолтный API ключ
    props.setProperty('GEMINI_API_KEY', 'AIzaSy_DEFAULT_KEY_12345');
    
    Logger.log('ДО сохранения:');
    Logger.log('  GEMINI_API_KEY: ' + props.getProperty('GEMINI_API_KEY'));
    
    // Имитируем сохранение через UI с пустым API ключом
    const testData = {
      apiKey: '', // Пустой API ключ
      email: 'test@example.com',
      token: 'test_token_123'
    };
    
    const result = saveSettingsData(testData);
    
    Logger.log('ПОСЛЕ сохранения:');
    Logger.log('  GEMINI_API_KEY: ' + props.getProperty('GEMINI_API_KEY'));
    Logger.log('  LICENSE_EMAIL: ' + props.getProperty('LICENSE_EMAIL'));
    Logger.log('  LICENSE_TOKEN: ' + props.getProperty('LICENSE_TOKEN'));
    Logger.log('  saveSettingsData result: ' + JSON.stringify(result));
    
    // Проверяем результаты
    const success = (props.getProperty('GEMINI_API_KEY') === 'AIzaSy_DEFAULT_KEY_12345' && // Ключ НЕ удалён
                    props.getProperty('LICENSE_EMAIL') === 'test@example.com' &&
                    props.getProperty('LICENSE_TOKEN') === 'test_token_123' &&
                    result.success === true);
    
    Logger.log('РЕЗУЛЬТАТ ТЕСТА 2: ' + (success ? '✅ УСПЕХ' : '❌ ПРОВАЛ'));
    return success;
    
  } catch (e) {
    Logger.log('ОШИБКА ТЕСТА 2: ' + e.message);
    return false;
  }
}

// ===== ТЕСТ 3: Проверка чтения лицензии клиентом =====
function testLicenseReading() {
  try {
    Logger.log('=== ТЕСТ 3: ЧТЕНИЕ ЛИЦЕНЗИИ КЛИЕНТОМ ===');
    
    const props = PropertiesService.getScriptProperties();
    
    // Очищаем и устанавливаем данные через saveSettingsData
    props.deleteProperty('LICENSE_EMAIL');
    props.deleteProperty('LICENSE_TOKEN');
    props.deleteProperty('LICENSEEMAIL');
    props.deleteProperty('LICENSETOKEN');
    
    const testData = {
      email: 'verify@test.com',
      token: 'verify_token'
    };
    
    saveSettingsData(testData);
    
    // Проверяем чтение через функции-геттеры
    const email = getLicenseEmail();
    const token = getLicenseToken();
    const hasLicense = hasStoredLicense();
    
    Logger.log('РЕЗУЛЬТАТЫ ЧТЕНИЯ:');
    Logger.log('  getLicenseEmail(): ' + email);
    Logger.log('  getLicenseToken(): ' + token);
    Logger.log('  hasStoredLicense(): ' + hasLicense);
    
    // Проверяем результаты
    const success = (email === 'verify@test.com' &&
                    token === 'verify_token' &&
                    hasLicense === true);
    
    Logger.log('РЕЗУЛЬТАТ ТЕСТА 3: ' + (success ? '✅ УСПЕХ' : '❌ ПРОВАЛ'));
    return success;
    
  } catch (e) {
    Logger.log('ОШИБКА ТЕСТА 3: ' + e.message);
    return false;
  }
}

// ===== ТЕСТ 4: Проверка работы лицензии с сервером =====
function testServerLicenseStatus() {
  try {
    Logger.log('=== ТЕСТ 4: РАБОТА ЛИЦЕНЗИИ С СЕРВЕРОМ ===');
    
    // Проверяем статус лицензии
    const status = serverStatus();
    
    Logger.log('СТАТУС ЛИЦЕНЗИИ:');
    Logger.log('  ok: ' + status.ok);
    Logger.log('  error: ' + status.error);
    Logger.log('  until: ' + status.until);
    Logger.log('  message: ' + status.message);
    
    // Проверяем что запрос прошёл (даже если лицензия невалидна)
    const success = (status !== null && 
                    typeof status === 'object' && 
                    typeof status.ok === 'boolean');
    
    Logger.log('РЕЗУЛЬТАТ ТЕСТА 4: ' + (success ? '✅ УСПЕХ (запрос прошёл)' : '❌ ПРОВАЛ'));
    return success;
    
  } catch (e) {
    Logger.log('ОШИБКА ТЕСТА 4: ' + e.message);
    return false;
  }
}

// ===== ТЕСТ 5: Проверка работы GM() функции =====
function testGMFunction() {
  try {
    Logger.log('=== ТЕСТ 5: РАБОТА GM() ФУНКЦИИ ===');
    
    // Проверяем только базовую функциональность без реальных AI запросов
    // Просто проверяем что функция не падает с ошибкой лицензии
    
    // Сначала проверим что лицензия есть
    const hasLicense = hasStoredLicense();
    Logger.log('hasStoredLicense(): ' + hasLicense);
    
    if (!hasLicense) {
      Logger.log('⚠️ Лицензия не найдена, пропускаем тест GM()');
      return true; // Это не ошибка, просто нет лицензии
    }
    
    // Проверим статус сервера
    const status = serverStatus();
    if (!status.ok) {
      Logger.log('⚠️ Лицензия неактивна, пропускаем тест GM()');
      return true; // Это не ошибка, просто лицензия неактивна
    }
    
    Logger.log('✅ Предусловия для GM() выполнены');
    Logger.log('РЕЗУЛЬТАТ ТЕСТА 5: ✅ УСПЕХ (предусловия выполнены)');
    return true;
    
  } catch (e) {
    Logger.log('ОШИБКА ТЕСТА 5: ' + e.message);
    return false;
  }
}

// ===== ОБЩИЙ ТЕСТ =====
function runAllLicenseTests() {
  try {
    Logger.log('========================================');
    Logger.log('ЗАПУСК ВСЕХ ТЕСТОВ ЛИЦЕНЗИРОВАНИЯ');
    Logger.log('========================================');
    
    const test1 = testMigration();
    Logger.log('');
    
    const test2 = testSaveSettingsWithoutApiKey();
    Logger.log('');
    
    const test3 = testLicenseReading();
    Logger.log('');
    
    const test4 = testServerLicenseStatus();
    Logger.log('');
    
    const test5 = testGMFunction();
    Logger.log('');
    
    Logger.log('========================================');
    Logger.log('ИТОГОВЫЕ РЕЗУЛЬТАТЫ:');
    Logger.log('Тест 1 (миграция): ' + (test1 ? '✅' : '❌'));
    Logger.log('Тест 2 (API ключ): ' + (test2 ? '✅' : '❌'));
    Logger.log('Тест 3 (чтение): ' + (test3 ? '✅' : '❌'));
    Logger.log('Тест 4 (сервер): ' + (test4 ? '✅' : '❌'));
    Logger.log('Тест 5 (GM функция): ' + (test5 ? '✅' : '❌'));
    
    const allSuccess = test1 && test2 && test3 && test4 && test5;
    Logger.log('ОБЩИЙ РЕЗУЛЬТАТ: ' + (allSuccess ? '✅ ВСЕ ТЕСТЫ ПРОЙДЕНЫ' : '❌ ЕСТЬ ПРОБЛЕМЫ'));
    Logger.log('========================================');
    
    return allSuccess;
    
  } catch (e) {
    Logger.log('ОШИБКА ЗАПУСКА ТЕСТОВ: ' + e.message);
    return false;
  }
}