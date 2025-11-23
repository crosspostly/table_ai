# 🤖 AGENT_READ_FIRST.md - Информация для AI агентов

**Версия:** 3.0.0  
**Дата:** 2025-06-18  
**Для:** AI агентов и автоматизированных систем

---

## 🎯 Ключевая информация

### 📋 Обзор проекта
**Table AI** - это система автоматизации Google Sheets с использованием Gemini AI. Проект написан на Google Apps Script и включает:

- **AI Конструктор** - создание сложных AI-конфигураций
- **VK Импорт** - загрузка постов из ВКонтакте  
- **OCR Распознавание** - распознавание текста с изображений
- **Просмотр Распаковки** - анализ и экспорт данных
- **Batch Обновления** - массовое обновление ячеек

### 🏗️ Архитектура
```
🖥️ Клиент (Main.gs) - UI, меню, обёртки (~200 строк)
🖥️ Сервер (server.gs) - бизнес-логика, API (~800 строк)  
📦 Модули - независимые компоненты
🗂️ Данные - Google Sheets + PropertiesService
```

---

## 📁 Структура кода

### Основные файлы в deploy/
```
Main.gs              # Клиентский код - меню, UI, обёртки
server.gs            # Серверный бэкенд - API, бизнес-логика
CollectConfig.gs     # UI AI конструктора
VK.gs                # Модуль импорта VK
UnpackingViewer.gs   # Просмотр данных распаковки
TemplateService.gs   # Управление шаблонами
ocrRunV2_client.gs  # OCR клиент
reniewcell.gs        # Batch обновления
```

### Вспомогательные папки
```
docs/                    # Публичная документация
__tests__/               # Unit тесты  
system_integrations/     # CI/CD и автоматизация
```

---

## 🚀 Текущее состояние

### ✅ Что работает:
- Все основные функции протестированы и работают
- Архитектура рефакторена и оптимизирована
- Логирование унифицировано
- Константы централизованы
- Документация актуальна

### 📊 Статистика кода:
- **Main.gs:** ~200 строк (было 1273)
- **server.gs:** ~800 строк (было 407)
- **Модулей:** 8 специализированных файлов
- **Тестов:** 20+ unit тестов
- **Документация:** Полная и актуальная

---

## 🔧 Работа с кодом

### 📝 Стандарты кодирования
```javascript
// Используйте LoggingService для логов
log('Operation completed', 'INFO', 'MODULE_NAME');

// Используйте Constants для констант
const API_URL = API_ENDPOINTS.GEMINI;

// Обрабатывайте ошибки корректно
try {
  const result = performOperation();
  return result;
} catch (e) {
  log('Error: ' + e.message, 'ERROR', 'MODULE_NAME');
  throw new Error('OPERATION_FAILED: ' + e.message);
}
```

### 🎯 Как добавить новую функцию:
1. **Бизнес-логику** → `server.gs`
2. **UI обёртку** → соответствующий модуль или `Main.gs`
3. **Пункт меню** → `Menu.gs`
4. **Константы** → `Constants.gs`
5. **Тесты** → `__tests__/`

### 🔄 Клиент-серверное взаимодействие:
```javascript
// Клиент вызывает сервер
function callServer(action, data) {
  const response = UrlFetchApp.fetch(SERVER_URL, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({action: action, data: data})
  });
  return JSON.parse(response.getContentText());
}

// Сервер обрабатывает запрос
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  switch (data.action) {
    case 'your_function': return handleYourFunction(data);
  }
}
```

---

## 📋 Критические функции

### 🤖 Gemini API
```javascript
// Клиентская обёртка
function GM(prompt, maxTokens = 12500, temperature = 0.7) {
  const cacheKey = gmCacheKey_(prompt, maxTokens, temperature);
  let result = gmCacheGet_(cacheKey);
  if (result) return result;
  
  const response = callServer('gm', {
    prompt: prompt,
    maxTokens: maxTokens,
    temperature: temperature,
    apiKey: getGeminiApiKey()
  });
  
  if (response.success) {
    gmCachePut_(cacheKey, response.data, 300);
    return response.data;
  }
  throw new Error(response.error);
}
```

### 🎯 AI Конструктор
```javascript
// Основная функция
function saveAndExecuteCollectConfig(sheetName, cellAddress, config) {
  // Сохраняем конфигурацию
  const saved = saveCollectConfig(sheetName, cellAddress, config);
  if (!saved) throw new Error('Failed to save config');
  
  // Вызываем сервер для исполнения
  const response = callServer('collect_config', {
    sheetName: sheetName,
    cellAddress: cellAddress,
    config: config
  });
  
  return response;
}
```

### 📥 VK Импорт
```javascript
// Импорт постов из VK
function importVkPosts() {
  const owner = params.getRange('C1').getValue();
  const count = params.getRange('E1').getValue();
  
  const url = VK_PARSER_URL + '?owner=' + encodeURIComponent(owner) + '&count=' + encodeURIComponent(count);
  
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
  const posts = JSON.parse(response.getContentText());
  
  // Обработка и сохранение постов
  // ...
}
```

---

## 🔒 Безопасность и конфигурация

### 🔑 API ключи
- **Gemini API ключ** хранится в Script Properties (`GEMINI_API_KEY`)
- **Серверные операции** используют прокси для защиты ключей
- **Никогда не храните ключи в коде!**

### 🛡️ Валидация данных
```javascript
// Всегда валидируйте входные данные
function validateInput(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('VALIDATION_ERROR: Invalid input');
  }
  if (input.length > 10000) {
    throw new Error('VALIDATION_ERROR: Input too long');
  }
  return input.trim();
}
```

### 📊 Rate limiting
- Сервер реализует rate limiting для API вызовов
- Клиент использует кэширование для снижения нагрузки
- Используйте batch операции для множественных запросов

---

## 🧪 Тестирование

### Запуск тестов
```bash
# Все тесты
npm test

# Конкретный тест
npm test -- --testNamePattern="GeminiClient"

# С покрытием
npm run test:coverage
```

### Типы тестов
- **Unit тесты** - для отдельных функций
- **Интеграционные тесты** - для взаимодействия модулей
- **E2E тесты** - для полных сценариев использования

---

## 📊 Мониторинг и отладка

### 📝 Логирование
```javascript
// Используйте LoggingService
log('User action completed', 'INFO', 'USER_MODULE');
log('API call failed', 'ERROR', 'API_MODULE');
log('Debug information', 'DEBUG', 'DEBUG_MODULE');

// Просмотр логов
function getLogs(limit = 100) {
  return logService.getLogs(limit);
}
```

### 🔍 Отладка
```javascript
// Используйте console.log для быстрой отладки
console.log('Debug: variable =', variable);

// Используйте Logger.log для Apps Script
Logger.log('Debug: variable = ' + variable);

// Для production используйте LoggingService
log('Debug information', 'DEBUG', 'MODULE_NAME');
```

---

## 🚀 Деплой и CI/CD

### 📦 Деплой
```bash
# В production
npm run deploy

# В staging
npm run deploy:staging

# Открыть редактор
npm run open
```

### 🔄 CI/CD
- GitHub Actions для автоматического деплоя
- Автоматические тесты при коммите
- Линтинг и форматирование кода
- Создание версий и тегов

---

## 🛠️ Инструменты и зависимости

### Основные инструменты
- **clasp** - Command Line Apps Script Projects
- **ESLint** - Линтинг JavaScript кода
- **Prettier** - Форматирование кода
- **Jest** - Тестирование
- **npm** - Управление зависимостями

### Внешние сервисы
- **Gemini API** - AI обработка текста
- **Google Sheets API** - Работа с таблицами
- **Google Drive API** - Работа с файлами
- **VK Parser** - Импорт постов из VK

---

## 📚 Документация

### 📖 Основная документация
- [README.md](../README.md) - Общая информация
- [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) - Руководство разработчика
- [CLASP_SETUP.md](CLASP_SETUP.md) - Настройка clasp

---

## 🚨 Важные предупреждения

### ⚠️ Критические правила:
1. **НИКОГДА не храните API ключи в коде**
2. **Всегда валидируйте входные данные**
3. **Используйте LoggingService для логов**
4. **Не блокируйте выполнение на долго**
5. **Обрабатывайте все исключения**

### 🚫 Запрещено:
- Хранить пароли и ключи в коде
- Бесконечные циклы без timeout
- Игнорировать ошибки и исключения
- Изменять код без тестов
- Коммитить без code review

---

## 🎯 Рекомендации для AI агентов

### 🤖 При анализе кода:
1. **Смотрите на архитектуру** - клиент vs сервер
2. **Проверяйте зависимости** - кто кого вызывает
3. **Ищите дублирование** - похожий код в разных файлах
4. **Оценивайте сложность** - цикломатическую сложность функций
5. **Проверяйте тесты** - покрытие и качество

### 🔧 При изменении кода:
1. **Следуйте стандартам** - используйте LoggingService, Constants
2. **Добавляйте тесты** - для новой функциональности
3. **Обновляйте документацию** - README и комментарии
4. **Используйте git properly** - осмысленные коммиты
5. **Тестируйте thoroughly** - unit + интеграционные тесты

### 📊 При оптимизации:
1. **Измеряйте производительность** - до и после
2. **Используйте кэширование** - где возможно
3. **Оптимизируйте API вызовы** - batch и rate limiting
4. **Сокращайте сложность** - разбивайте большие функции
5. **Улучшайте читаемость** - понятные имена и комментарии

---

## 🆘 Поддержка

### 📞 Если возникли проблемы:
1. **Проверьте логи** - `getLogs()` для диагностики
2. **Посмотрите в Issues** - возможно проблема уже известна
3. **Используйте документацию** - README и DEVELOPER_GUIDE
4. **Создайте Issue** - подробно опишите проблему

### 📝 Шаблон для баг-репорта:
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

## Дополнительная информация
Логи, скриншоты, другая полезная информация
```

---

## 🎯 Ключевые выводы

### ✅ Сильные стороны:
- **Чистая архитектура** - чёткое разделение клиент-сервер
- **Модульность** - независимые компоненты
- **Тестирование** - хорошее покрытие
- **Документация** - полная и актуальная
- **Инструменты** - современные практики разработки

### 🎯 Фокус на:
- **Поддерживаемость** - легко добавлять новые функции
- **Масштабируемость** - готов к росту
- **Надёжность** - обработка ошибок и логирование
- **Безопасность** - защита ключей и данных
- **Производительность** - кэширование и оптимизация

---

**Эта документация должна быть вашим первым источником информации при работе с проектом Table AI.** 🚀

Если у вас есть вопросы или нужна дополнительная информация, обратитесь к полной документации или создайте Issue.