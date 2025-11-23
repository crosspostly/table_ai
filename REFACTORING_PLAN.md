# 🚀 REFACTORING PLAN - План рефакторинга Table AI

**Дата:** 2025-06-18  
**Версия:** v1.0  
**Статус:** ПЛАНИРОВАНИЕ  

**ЦЕЛЬ:** Минимизировать Main.gs до 200 строк, перенести всю бизнес-логику на сервер

---

## 📋 ОБЗОР ПЛАНА

### 🎯 ГЛАВНАЯ ЦЕЛЬ
```
Main.gs: 1273 строк → 200 строк (-85%)
server.gs: 407 строк → 800 строк (+97%)
Бизнес-логика: 5 файлов → 1 файл (server.gs)
Дублирование: 5 реализаций → 0 реализаций
```

### 📅 ГРАФИК РАБОТ
- **Фаза 1:** Критические исправления (2 дня)
- **Фаза 2:** Архитектурный рефакторинг (1 неделя)
- **Фаза 3:** Оптимизация и тестирование (3 дня)
- **Фаза 4:** Документация (1 день)

---

## 🚨 ФАЗА 1: КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ (2 дня)

### ДЕНЬ 1: Безопасность и стабильность
**⏰ Время:** 4-6 часов

#### 1.1 ИСПРАВИТЬ ОШИБКУ В VK.gs (30 минут)
```javascript
// ПРОБЛЕМА: Переменная arr не определена
let arr; // ← ДОБАВИТЬ ЭТУ СТРОКУ
try {
  arr = JSON.parse(resp.getContentText());
} catch (e) {
  arr = [];
}
if (!Array.isArray(arr)) {
  // ...
}
```

#### 1.2 СОЗДАТЬ LoggingService.gs (2 часа)
```javascript
// НОВЫЙ ФАЙЛ: LoggingService.gs
/**
 * Единый сервис логирования для всех модулей
 */
const LOG_LEVELS = {ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3};

function log(message, level = 'INFO', module = 'GLOBAL') {
  // Единая логика логирования с CacheService
}

function logError(message, module) { log(message, 'ERROR', module); }
function logWarn(message, module) { log(message, 'WARN', module); }
function logInfo(message, module) { log(message, 'INFO', module); }
function logDebug(message, module) { log(message, 'DEBUG', module); }
```

#### 1.3 ОБНОВИТЬ ВСЕ МОДУЛИ ИСПОЛЬЗОВАТЬ LoggingService (3 часа)
```javascript
// Обновить файлы:
- Main.gs: заменить addLog() → log()
- VK.gs: заменить addLog() → log()
- UnpackingViewer.gs: заменить logUnpacking() → log()
- ocrRunV2_client.gs: заменить log_() → log()
- reniewcell.gs: заменить addLog() → log()
```

### ДЕНЬ 2: Константы и структура
**⏰ Время:** 4-6 часов

#### 2.1 СОЗДАТЬ Constants.gs (1 час)
```javascript
// НОВЫЙ ФАЙЛ: Constants.gs
/**
 * Единые константы для всей системы
 */

// API URLs
const API_ENDPOINTS = {
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  SERVER: 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec',
  VK_PARSER: 'https://script.google.com/macros/s/AKfycbzttbqz16EmmcXbEYCuYhNlXkCxAnCG77phspFL1_rTCi4xVqoorByJAPa4dI4iwT8/exec'
};

// Limits и quotas
const LIMITS = {
  MAX_LOGS: 300,
  LOGS_TTL: 86400,
  OCR_BATCH_LIMIT: 50,
  OCR_CHUNK_SIZE: 8,
  MAX_TEMPLATE_SIZE: 8000,
  MAX_TEMPLATES_PER_USER: 100
};

// Sheet names и ranges
const SHEETS = {
  CONFIG_DATA: 'ConfigData',
  UNPACKING: 'Распаковка',
  PROMPT_BOX: 'Prompt_box',
  POSTS: 'Посты',
  REVIEWS: 'Отзывы',
  PARAMETERS: 'Параметры'
};
```

#### 2.2 ОБНОВИТЬ ВСЕ ФАЙЛЫ ИСПОЛЬЗОВАТЬ Constants.gs (2 часа)

#### 2.3 СОЗДАТЬ БЭКАП И ТЕСТОВОЕ ОКРУЖЕНИЕ (1 час)
```bash
# Создать ветку для рефакторинга
git checkout -b refactor/architecture-cleanup

# Создать копию для тестов
clasp copy --title "Table AI Refactor Test"
```

---

## 🏗️ ФАЗА 2: АРХИТЕКТУРНЫЙ РЕФАКТОРИНГ (1 неделя)

### ДЕНЬ 3: Разделение Main.gs
**⏰ Время:** 6-8 часов

#### 3.1 СОЗДАТЬ Menu.gs (1 час)
```javascript
// НОВЫЙ ФАЙЛ: Menu.gs
/**
 * Меню и навигация системы
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🤖 Table AI')
    .addItem('🎯 AI Конструктор', 'openCollectConfigUI')
    .addItem('📦 Просмотр Распаковки', 'openUnpackingViewer')
    .addSeparator()
    .addItem('📥 Импорт VK постов', 'importVkPosts')
    .addItem('🔍 Распознать текст (OCR)', 'ocrRun')
    .addSeparator()
    .addItem('⚙️ Настройки', 'openSettingsDialog')
    .addToUi();
}
```

#### 3.2 СОЗДАТЬ GeminiClient.gs (3 часа)
```javascript
// НОВЫЙ ФАЙЛ: GeminiClient.gs
/**
 * Клиентские обёртки для Gemini API
 */

function GM(prompt, maxTokens = 12500, temperature = 0.7) {
  // Проверка кэша
  const cacheKey = gmCacheKey_(prompt, maxTokens, temperature);
  let result = gmCacheGet_(cacheKey);
  if (result) return result;
  
  // Вызов сервера
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

function callServer(action, data) {
  // Универсальная функция вызова сервера
}
```

#### 3.3 СОЗДАТЬ Utils.gs (2 часа)
```javascript
// НОВЫЙ ФАЙЛ: Utils.gs
/**
 * Утилитарные функции
 */

function columnToLetter(column) { /* текущая реализация */ }
function letterToColumn(letters) { /* текущая реализация */ }
function parseTargetA1(a1) { /* текущая реализация */ }
function getNonEmptyRowCount(sheet) { /* новая функция */ }
```

#### 3.4 ОБНОВИТЬ Main.gs (2 часа)
```javascript
// Main.gs - только импорты и основные функции
// Импортировать все новые модули
// Оставить только критически важные функции
// Размер: ~200 строк
```

### ДЕНЬ 4-5: Перенос бизнес-логики на сервер
**⏰ Время:** 12-16 часов

#### 4.1 РАСШИРИТЬ server.gs (8 часов)
```javascript
// Добавить новые роуты в doPost():
case 'collect_config': return handleCollectConfig(data);
case 'ocr_process': return handleOcrProcess(data);
case 'batch_update': return handleBatchUpdate(data);

// Добавить новые функции:
function handleCollectConfig(data) {
  // Логика из CollectConfig.gs executeCollectConfig()
}

function handleOcrProcess(data) {
  // Логика из ocrRunV2_client.gs
}

function handleBatchUpdate(data) {
  // Логика из reniewcell.gs
}
```

#### 4.2 ОБНОВИТЬ CollectConfig.gs (4 часа)
```javascript
// Оставить только UI функции:
- openCollectConfigUI()
- getCollectConfigInitData()
- saveAndExecuteCollectConfig() - как координатор

// Удалить бизнес-логику:
- executeCollectConfig() → перенести в server.gs
- readData() → перенести в server.gs
```

#### 4.3 ОБНОВИТЬ ocrRunV2_client.gs (4 часа)
```javascript
// Оставить только координатор:
function ocrRun() {
  // Координация процесса
  // Вызов сервера для обработки
}

// Перенести в server.gs:
- collectFromSourceV2_()
- gmOcrFromBlobV2_()
- serverGmOcrBatchV2_()
- VK/Drive обработка
```

### ДЕНЬ 6: Оптимизация модулей
**⏰ Время:** 6-8 часов

#### 6.1 ОПТИМИЗИРОВАТЬ TemplateService.gs (2 часа)
- Добавить валидацию через LoggingService
- Использовать Constants.gs
- Оптимизировать производительность

#### 6.2 ОПТИМИЗИРОВАТЬ UnpackingViewer.gs (2 часа)
- Использовать LoggingService
- Использовать Constants.gs
- Добавить валидацию данных

#### 6.3 ОПТИМИЗИРОВАТЬ VK.gs (2 часа)
- Использовать LoggingService
- Использовать Constants.gs
- Добавить обработку ошибок

#### 6.4 ОПТИМИЗИРОВАТЬ reniewcell.gs (2 часа)
- Использовать LoggingService
- Использовать Constants.gs
- Оптимизировать batch обработку

### ДЕНЬ 7: Тестирование и отладка
**⏰ Время:** 6-8 часов

#### 7.1 ФУНКЦИОНАЛЬНОЕ ТЕСТИРОВАНИЕ (4 часа)
- [ ] Меню работает корректно
- [ ] GM() функции выполняются
- [ ] AI Конструктор работает
- [ ] OCR распознавание работает
- [ ] VK импорт работает
- [ ] UnpackingViewer работает
- [ ] Batch обновления работают

#### 7.2 ПРОИЗВОДИТЕЛЬНОСТЬ (2 часа)
- [ ] Время отклика UI
- [ ] Скорость выполнения операций
- [ ] Использование памяти

#### 7.3 ОБРАБОТКА ОШИБОК (2 часа)
- [ ] Логирование ошибок
- [ ] Graceful degradation
- [ ] User-friendly сообщения

---

## 🔧 ФАЗА 3: ОПТИМИЗАЦИЯ И ТЕСТИРОВАНИЕ (3 дня)

### ДЕНЬ 8: Unit тесты
**⏰ Время:** 6-8 часов

#### 8.1 СОЗДАТЬ ТЕСТОВЫЙ ФРЕЙМВОРК (2 часа)
```javascript
// __tests__/TestFramework.gs
function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

function runTests() {
  // Запуск всех тестов
}
```

#### 8.2 НАПИСАТЬ ТЕСТЫ ДЛЯ КРИТИЧЕСКИХ ФУНКЦИЙ (6 часов)
- [ ] Gemini API вызовы
- [ ] ConfigData операции
- [ ] TemplateService функции
- [ ] LoggingService
- [ ] Utils функции

### ДЕНЬ 9: Интеграционное тестирование
**⏰ Время:** 6-8 часов

#### 9.1 ТЕСТЫ ИНТЕГРАЦИИ (4 часа)
- [ ] Клиент ↔ Сервер взаимодействие
- [ ] UI ↔ Бизнес-логика
- [ ] Модуль ↔ Модуль зависимости

#### 9.2 ТЕСТЫ ПРОИЗВОДИТЕЛЬНОСТИ (2 часа)
- [ ] Load testing
- [ ] Stress testing
- [ ] Memory profiling

### ДЕНЬ 10: Финальная отладка
**⏰ Время:** 6-8 часов

#### 10.1 ИСПРАВЛЕНИЕ БАГОВ (4 часа)
- [ ] Исправить найденные проблемы
- [ ] Оптимизировать узкие места
- [ ] Улучшить обработку ошибок

#### 10.2 ПОДГОТОВКА К ДЕПЛОЮ (2 часа)
- [ ] Финальная проверка кода
- [ ] Обновление документации
- [ ] Подготовка к миграции

---

## 📚 ФАЗА 4: ДОКУМЕНТАЦИЯ (1 день)

### ДЕНЬ 11: Обновление документации
**⏰ Время:** 6-8 часов

#### 11.1 ОБНОВИТЬ README.md (2 часа)
```markdown
# Table AI - Google Sheets AI Automation

## Архитектура
- **Клиент:** UI + меню + обёртки (~200 строк)
- **Сервер:** Бизнес-логика + API (~800 строк)
- **Модули:** Независимые компоненты

## Установка и использование
## Разработка
## Тестирование
```

#### 11.2 СОЗДАТЬ DEVELOPER_GUIDE.md (2 часа)
- Архитектура системы
- Как добавлять новые функции
- Стандарты кодирования
- Процесс тестирования

#### 11.3 СОЗДАТЬ API_DOCUMENTATION.md (2 часа)
- Описание всех API endpoints
- Форматы данных
- Примеры использования

#### 11.4 ОБНОВИТЬ AGENT_READ_FIRST.md (2 часа)
- Актуальная информация о системе
- Текущая архитектура
- Рекомендации для AI агентов

---

## 📊 ИЗМЕРЕНИЕ УСПЕХА

### КОЛИЧЕСТВЕННЫЕ МЕТРИКИ
```
ДО:
├── Main.gs: 1273 строк
├── Бизнес-логика: 5 файлов
├── Дублирование addLog(): 5 реализаций
├── Магических чисел: 15+
└── Unit тесты: 0

ПОСЛЕ:
├── Main.gs: 200 строк (-85%)
├── Бизнес-логика: 1 файл (server.gs)
├── Дублирование addLog(): 0 реализаций
├── Магических чисел: 0 (все в Constants.gs)
└── Unit тесты: 20+ тестов
```

### КАЧЕСТВЕННЫЕ МЕТРИКИ
```
✅ Чёткое разделение клиент-сервер
✅ Единое логирование
✅ Централизованные константы
✅ Модульная архитектура
✅ Покрытие тестами
✅ Актуальная документация
```

---

## 🚨 РИСКИ И МИТИГАЦИЯ

### ВЫСОКИЙ РИСК: Регрессия функциональности
**Митигация:**
- Поэтапное тестирование каждого этапа
- Создание бэкапов перед каждым большим изменением
- Тестирование на изолированной копии

### СРЕДНИЙ РИСК: Увеличение latency
**Митигация:**
- Агрессивное кэширование на клиенте
- Оптимизация размера запросов
- Batch обработка

### НИЗКИЙ РИСК: Сложность отладки
**Митигация:**
- Детальное логирование всех запросов
- Единый формат ошибок
- Информативные сообщения для пользователя

---

## 📋 FINAL CHECKLIST

### ПЕРЕД НАЧАЛОМ:
- [ ] Создан бэкап текущей версии
- [ ] Подготовлено тестовое окружение
- [ ] Согласован план с командой

### В ПРОЦЕССЕ:
- [ ] Каждый этап протестирован
- [ ] Логирование работает
- [ ] Документация обновляется

### ПОСЛЕ ЗАВЕРШЕНИЯ:
- [ ] Все функции работают
- [ ] Производительность улучшена
- [ ] Документация актуальна
- [ ] Команда обучена

---

## 🎯 СЛЕДУЮЩИЕ ШАГИ

### НЕМЕДЛЕННО (после рефакторинга):
1. Деплой на production
2. Мониторинг производительности
3. Сбор обратной связи от пользователей

### В ТЕЧЕНИЕ МЕСЯЦА:
1. Оптимизация на основе реального использования
2. Дополнительные unit тесты
3. Улучшение документации

### В ТЕЧЕНИЕ КВАРТАЛА:
1. Планирование следующих улучшений
2. Обучение команды новой архитектуре
3. Создание лучших практик разработки

---

**ИТОГ:** Этот план превратит монолитный код в чистую, масштабируемую архитектуру с чётким разделением ответственности.