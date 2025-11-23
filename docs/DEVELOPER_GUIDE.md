# 📖 DEVELOPER_GUIDE.md - Руководство разработчика Table AI

**Версия:** 3.0.0  
**Дата:** 2025-06-18  
**Для:** Разработчиков, контрибьюторов

---

## 🎯 Обзор архитектуры

### 📋 Философия
Table AI построен по принципу **"Тонкий клиент, толстый сервер"**:
- **Клиент** → UI, меню, обёртки (~200 строк)
- **Сервер** → Вся бизнес-логика (~800 строк)
- **Модули** → Независимые компоненты

### 🏗️ Структура
```
deploy/
├── Main.gs              # Клиентский центр
├── server.gs            # Серверный бэкенд
├── Menu.gs              # Меню и навигация
├── GeminiClient.gs      # Обёртки Gemini API
├── Utils.gs             # Вспомогательные функции
├── Constants.gs         # Все константы
├── LoggingService.gs    # Единое логирование
├── CollectConfig.gs     # AI конструктор UI
├── VK.gs                # VK импорт
├── UnpackingViewer.gs   # Просмотр данных
├── TemplateService.gs   # Сервис шаблонов
├── ocrRunV2_client.gs  # OCR клиент
└── reniewcell.gs        # Batch обновления
```

---

## 🚀 Как добавить новую функцию

### Шаг 1: Планирование
1. **Определите тип функции:**
   - UI функция → клиентский модуль
   - Бизнес-логика → сервер
   - Обработка данных → отдельный модуль

2. **Создайте ticket** с описанием:
   - Назначение функции
   - Входные/выходные данные
   - UI требования
   - Тестовые сценарии

### Шаг 2: Реализация бизнес-логики (server.gs)
```javascript
// 1. Добавьте роут в doPost()
function doPost(e) {
  // ... существующий код
  switch (action) {
    // ... существующие роуты
    case 'your_new_function': return handleYourNewFunction(data);
  }
}

// 2. Реализуйте обработчик
function handleYourNewFunction(data) {
  try {
    // Валидация входных данных
    if (!data.requiredParam) {
      return {success: false, error: 'MISSING_PARAM: requiredParam'};
    }
    
    // Бизнес-логика
    const result = processYourData(data);
    
    // Логирование
    log('Function executed successfully', 'INFO', 'YOUR_MODULE');
    
    return {success: true, data: result};
  } catch (e) {
    log('Function error: ' + e.message, 'ERROR', 'YOUR_MODULE');
    return {success: false, error: e.message};
  }
}
```

### Шаг 3: Создание клиентской обёртки
```javascript
// В соответствующем клиентском файле
function yourNewFunction(param1, param2) {
  // Валидация на клиенте
  if (!param1) {
    throw new Error('Parameter param1 is required');
  }
  
  // Вызов сервера
  const response = callServer('your_new_function', {
    requiredParam: param1,
    optionalParam: param2
  });
  
  if (!response.success) {
    throw new Error(response.error);
  }
  
  return response.data;
}
```

### Шаг 4: Добавление в меню
```javascript
// Menu.gs
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Table AI')
    // ... существующие пункты
    .addItem('🆕 Ваша функция', 'yourNewFunctionUI')
    .addToUi();
}

function yourNewFunctionUI() {
  // UI логика
  const html = HtmlService.createHtmlOutputFromFile('YourFunctionUI')
    .setWidth(400)
    .setTitle('🆕 Ваша функция');
  
  SpreadsheetApp.getUi().showModalDialog(html);
}
```

### Шаг 5: Тестирование
```javascript
// __tests__/YourFunction.test.gs
function testYourNewFunction() {
  // Тест базовой функциональности
  const result = yourNewFunction('test_param');
  assertNotNull(result);
  
  // Тест обработки ошибок
  try {
    yourNewFunction('');
    fail('Should throw error for empty param');
  } catch (e) {
    assertTrue(e.message.includes('required'));
  }
}
```

---

## 📝 Стандарты кодирования

### Стиль кода
```javascript
// ✅ ХОРОШО
const MAX_RETRIES = 3;
const API_ENDPOINT = 'https://api.example.com';

function processUserData(userId) {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  const userData = getUserData(userId);
  return transformData(userData);
}

// ❌ ПЛОХО
function processuserdata(u){
  var d = getuser(u);
  return d;
}
```

### Обработка ошибок
```javascript
// ✅ ХОРОШО
function riskyOperation() {
  try {
    const result = performOperation();
    log('Operation successful', 'INFO', 'MODULE');
    return result;
  } catch (e) {
    log('Operation failed: ' + e.message, 'ERROR', 'MODULE');
    throw new Error('OPERATION_FAILED: ' + e.message);
  }
}

// ❌ ПЛОХО
function riskyOperation() {
  return performOperation(); // Может упасть без лога
}
```

### Логирование
```javascript
// Используйте LoggingService
log('User action completed', 'INFO', 'USER_MODULE');
log('API call failed', 'ERROR', 'API_MODULE');
log('Debug information', 'DEBUG', 'DEBUG_MODULE');

// Для ошибок используйте конкретные сообщения
throw new Error('VALIDATION_ERROR: Email format invalid');
throw new Error('API_ERROR: Rate limit exceeded');
throw new Error('PERMISSION_ERROR: User not authorized');
```

---

## 🔄 Работа с данными

### Чтение данных
```javascript
// ✅ Оптимизированное чтение
function readSheetData(sheetName, rangeA1) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    const range = sheet.getRange(rangeA1);
    const values = range.getValues();
    
    log(`Read ${values.length} rows from ${sheetName}!${rangeA1}`, 
        'DEBUG', 'DATA_MODULE');
    
    return values;
  } catch (e) {
    log('Error reading data: ' + e.message, 'ERROR', 'DATA_MODULE');
    throw e;
  }
}
```

### Запись данных
```javascript
// ✅ Пакетная запись
function writeSheetData(sheetName, rangeA1, values) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet()
      .getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    const range = sheet.getRange(rangeA1);
    range.setValues(values);
    
    log(`Wrote ${values.length} rows to ${sheetName}!${rangeA1}`, 
        'DEBUG', 'DATA_MODULE');
    
    return true;
  } catch (e) {
    log('Error writing data: ' + e.message, 'ERROR', 'DATA_MODULE');
    throw e;
  }
}
```

### Валидация данных
```javascript
// ✅ Комплексная валидация
function validateUserData(userData) {
  const errors = [];
  
  // Обязательные поля
  if (!userData.email) errors.push('Email is required');
  if (!userData.name) errors.push('Name is required');
  
  // Формат данных
  if (userData.email && !isValidEmail(userData.email)) {
    errors.push('Email format is invalid');
  }
  
  if (userData.age && (userData.age < 0 || userData.age > 150)) {
    errors.push('Age must be between 0 and 150');
  }
  
  if (errors.length > 0) {
    throw new Error('VALIDATION_ERROR: ' + errors.join(', '));
  }
  
  return true;
}
```

---

## 🌐 Работа с API

### Вызов внешних API
```javascript
// ✅ Безопасный вызов API
function callExternalAPI(endpoint, data) {
  try {
    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(data),
      muteHttpExceptions: true,
      headers: {
        'User-Agent': 'TableAI/3.0'
      }
    };
    
    const response = UrlFetchApp.fetch(endpoint, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode !== 200) {
      throw new Error(`API_ERROR: HTTP ${responseCode} - ${responseText}`);
    }
    
    return JSON.parse(responseText);
  } catch (e) {
    log('API call failed: ' + e.message, 'ERROR', 'API_MODULE');
    throw e;
  }
}
```

### Rate limiting
```javascript
// ✅ Rate limiting для API
function callAPIWithRateLimit(endpoint, data) {
  const RATE_LIMIT_KEY = 'api_rate_limit';
  const MAX_CALLS_PER_MINUTE = 60;
  
  const cache = CacheService.getScriptCache();
  const currentMinute = Math.floor(Date.now() / 60000);
  const cacheKey = `${RATE_LIMIT_KEY}_${currentMinute}`;
  
  const currentCalls = parseInt(cache.get(cacheKey) || '0');
  
  if (currentCalls >= MAX_CALLS_PER_MINUTE) {
    throw new Error('RATE_LIMIT: Exceeded API calls per minute');
  }
  
  // Увеличиваем счётчик
  cache.put(cacheKey, String(currentCalls + 1), 120); // 2 минуты TTL
  
  // Вызываем API
  return callExternalAPI(endpoint, data);
}
```

---

## 🧪 Тестирование

### Unit тесты
```javascript
// __tests__/UserService.test.gs
function testGetUserById() {
  // Arrange
  const userId = 'test_user_123';
  const expectedUser = {id: userId, name: 'Test User'};
  
  // Act
  const actualUser = getUserById(userId);
  
  // Assert
  assertEquals(expectedUser.id, actualUser.id);
  assertEquals(expectedUser.name, actualUser.name);
}

function testGetUserByIdNotFound() {
  // Arrange
  const userId = 'nonexistent_user';
  
  // Act & Assert
  try {
    getUserById(userId);
    fail('Should throw error for nonexistent user');
  } catch (e) {
    assertTrue(e.message.includes('USER_NOT_FOUND'));
  }
}
```

### Интеграционные тесты
```javascript
function testCompleteUserWorkflow() {
  // Создание пользователя
  const newUser = createUser({
    name: 'Integration Test User',
    email: 'test@example.com'
  });
  
  assertNotNull(newUser.id);
  
  // Получение пользователя
  const retrievedUser = getUserById(newUser.id);
  assertEquals(newUser.name, retrievedUser.name);
  
  // Обновление пользователя
  const updatedUser = updateUser(newUser.id, {
    name: 'Updated Name'
  });
  assertEquals('Updated Name', updatedUser.name);
  
  // Удаление пользователя
  deleteUser(newUser.id);
  
  // Проверка удаления
  try {
    getUserById(newUser.id);
    fail('User should be deleted');
  } catch (e) {
    assertTrue(e.message.includes('USER_NOT_FOUND'));
  }
}
```

---

## 📊 Мониторинг и отладка

### Логирование
```javascript
// Используйте разные уровни логирования
log('Process started', 'INFO', 'MODULE_NAME');
log('User action: ' + action, 'DEBUG', 'USER_MODULE');
log('Performance: operation took ' + duration + 'ms', 'DEBUG', 'PERFORMANCE');
log('API error: ' + error, 'ERROR', 'API_MODULE');
log('Critical system error', 'ERROR', 'SYSTEM');
```

### Метрики производительности
```javascript
function measurePerformance(functionName, operation) {
  const startTime = Date.now();
  
  try {
    const result = operation();
    const duration = Date.now() - startTime;
    
    log(`Performance: ${functionName} took ${duration}ms`, 
        'INFO', 'PERFORMANCE');
    
    return result;
  } catch (e) {
    const duration = Date.now() - startTime;
    
    log(`Performance: ${functionName} failed after ${duration}ms`, 
        'ERROR', 'PERFORMANCE');
    
    throw e;
  }
}

// Использование
const result = measurePerformance('processUserData', () => {
  return processUserData(userId);
});
```

---

## 🔒 Безопасность

### Валидация входных данных
```javascript
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Удаление потенциально опасных символов
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}
```

### Защита API ключей
```javascript
// ✅ Безопасное получение API ключа
function getGeminiApiKey() {
  const apiKey = PropertiesService.getScriptProperties()
    .getProperty('GEMINI_API_KEY');
  
  if (!apiKey) {
    throw new Error('CONFIG_ERROR: GEMINI_API_KEY not configured');
  }
  
  return apiKey;
}

// ❌ НЕ ДЕЛАЙТЕ ЭТОГО
const API_KEY = 'AIza...'; // Никогда не храните ключи в коде!
```

---

## 🚀 Деплой и релизы

### Подготовка к релизу
```bash
# 1. Проверка кода
npm run lint
npm test

# 2. Сборка
npm run build

# 3. Версионирование
npm version patch  # или minor/major

# 4. Деплой
npm run deploy

# 5. Создание тега
git tag v3.0.1
git push origin v3.0.1
```

### Чеклист перед релизом
- [ ] Все тесты проходят
- [ ] Линтинг без ошибок
- [ ] Документация обновлена
- [ ] Версия обновлена
- [ ] Changelog заполнен
- [ ] Тестирование на staging
- [ ] Performance тестирование
- [ ] Security review

---

## 🤝 Лучшие практики

### Код ревью
1. **Функциональность:** Код работает как ожидалось
2. **Читаемость:** Код понятен и хорошо документирован
3. **Производительность:** Нет явных узких мест
4. **Безопасность:** Нет уязвимостей
5. **Тесты:** Достаточное покрытие тестами

### Коммиты
```bash
# ✅ Хорошие коммиты
git commit -m "feat: add user authentication"
git commit -m "fix: resolve API timeout issue"
git commit -m "docs: update developer guide"
git commit -m "test: add integration tests for user service"

# ❌ Плохие коммиты
git commit -m "fix bug"
git commit -m "update stuff"
git commit -m "wip"
```

### Ветвление
```bash
# Feature ветки
git checkout -b feature/user-authentication
git checkout -b fix/api-timeout-issue
git checkout -b docs/developer-guide-update

# Структура веток
main          # Продакшн
develop       # Разработка
feature/*     # Новые функции
fix/*         # Исправления
docs/*        # Документация
```

---

## 📚 Полезные ресурсы

### Документация
- [Google Apps Script Reference](https://developers.google.com/apps-script/reference)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Gemini API Documentation](https://ai.google.dev/docs)

### Инструменты
- [clasp](https://github.com/google/clasp) - Command Line Apps Script Projects
- [ESLint](https://eslint.org/) - Линтинг JavaScript
- [Jest](https://jestjs.io/) - Тестирование

### Сообщество
- [Google Apps Script Community](https://developers.google.com/apps-script/community)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-apps-script)
- [GitHub Discussions](https://github.com/your-repo/table-ai/discussions)

---

## 🆘 Поддержка

### Если у вас проблемы:
1. **Проверьте логи** - используйте `getLogs()` для диагностики
2. **Посмотрите в Issues** - возможно, проблема уже известна
3. **Создайте новый Issue** - подробно опишите проблему
4. **Свяжитесь с командой** - для критических проблем

### Шаблон для Issue:
```markdown
## Описание проблемы
Краткое описание проблемы

## Шаги воспроизведения
1. Шаг 1
2. Шаг 2
3. Шаг 3

## Ожидаемый результат
Что должно было произойти

## Фактический результат
Что произошло на самом деле

## Окружение
- Версия Table AI: 3.0.0
- Браузер: Chrome 91.0
- ОС: Windows 10

## Дополнительная информация
Логи, скриншоты, другая полезная информация
```

---

**Счастливой разработки!** 🚀

Если у вас есть вопросы или предложения, не стесняйтесь обращаться к команде или создавать Issues.