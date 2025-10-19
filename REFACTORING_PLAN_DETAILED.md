# 🚀 ДЕТАЛЬНЫЙ ПЛАН РЕФАКТОРИНГА
## Table AI v2.1.0 → v3.0.0 (Модернизация архитектуры)

**Дата:** 19 Октября 2025  
**Статус:** 📋 Планирование  
**Приоритет:** 🔴 КРИТИЧЕСКИЙ  

---

## 📌 КРИТИЧЕСКОЕ УТОЧНЕНИЕ: АРХИТЕКТУРА КЛЮЧЕЙ

### ✅ ПРАВИЛЬНАЯ Архитектура Доступа

```
🔐 РАСПРЕДЕЛЕНИЕ СЕКРЕТОВ (ПРАВИЛЬНО):

┌─────────────────────────────────────────────┐
│ 📱 CLIENT (Google Sheets Container-bound)   │
├─────────────────────────────────────────────┤
│ ✅ GEMINI_API_KEY     - Ключ ПОЛЬЗОВАТЕЛЯ  │
│ ✅ EMAIL              - Email ПОЛЬЗОВАТЕЛЯ  │
│ ✅ LICENSE_TOKEN      - Токен ПОЛЬЗОВАТЕЛЯ │
│ ✅ SERVER_URL         - Адрес сервера      │
│ ❌ VK_TOKEN           - НЕ ХРАНИТЬ!        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 🌐 SERVER (Standalone Web App)              │
├─────────────────────────────────────────────┤
│ ✅ LICENSE_DB         - База лицензий       │
│ ✅ Логирование        - Все запросы         │
│ ✅ TELEGRAM_TOKEN     - Опционально (админ) │
│ ✅ INSTAGRAM_TOKEN    - Опционально (админ) │
│ ❌ GEMINI_API_KEY     - НЕ ХРАНИТЬ!        │
│ ❌ VK_TOKEN           - НЕ ХРАНИТЬ!        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 📡 VK_PARSER (External Service - 3я часть) │
├─────────────────────────────────────────────┤
│ ✅ VK_TOKEN           - ТОЛЬКО ЗДЕСЬ!       │
│ ✅ VK API вызовы      - Вся логика VK      │
└─────────────────────────────────────────────┘
```

### 🔄 Flow Правильно Спроектирован

```
1️⃣ GEMINI ЗАПРОСЫ (CLIENT-independent):
   CLIENT → Gemini API (с СОБСТВЕННЫМ ключом пользователя)
   ❌ Сервер НЕ участвует в Gemini вызовах!
   ✅ SERVER может логировать что был запрос

2️⃣ ЛИЦЕНЗИОННЫЕ ПРОВЕРКИ:
   CLIENT → SERVER (action: 'check_license')
   SERVER → Проверяет БД, возвращает: {ok: true}
   CLIENT → Использует результат

3️⃣ VK ИМПОРТ:
   CLIENT → SERVER (action: 'import_vk', owner, count)
   SERVER → VK_PARSER (с VK_TOKEN)
   VK_PARSER → VK API
   VK_PARSER → SERVER
   SERVER → CLIENT
```

### ❌ ЧТО БЫЛО НЕПРАВИЛЬНО В ПРЕДЫДУЩЕМ АНАЛИЗЕ

В первом ARCHITECTURE_ANALYSIS_REPORT.md я ошибочно рекомендовал:

```javascript
// ❌ НЕПРАВИЛЬНО!
SERVER: {
  GEMINI_API_KEY (moved from client) ✅✅✅  ← ОШИБКА!
}
```

**Это ПОЛНОСТЬЮ противоположно правильной архитектуре:**
- ❌ Gemini ключ должен ОСТАТЬСЯ на CLIENT
- ❌ SERVER вообще не должен вызывать Gemini
- ❌ Каждый пользователь вводит свой ключ

**Правильно:**
- ✅ CLIENT вызывает Gemini напрямую (со своим ключом)
- ✅ SERVER только логирует что был запрос
- ✅ Один SERVER может обслуживать много CLIENT'ов с разными ключами

---

## 🏗️ РЕФАКТОРИНГ С ИСПОЛЬЗОВАНИЕМ `shared/`

### Текущее Состояние shared/ (уже готовые утилиты)

```
shared/
├── Constants.gs                 (40 строк)
├── Utils.gs                     (16 KB) - Atomic operations, helpers
├── SecurityValidator.gs         (14 KB) - Input validation
├── LoggingService.gs            (11 KB) - Unified logging
├── DetailedLogger.gs            (9.2 KB) - Sheet logging
├── VersionInfo.gs               (4.5 KB) - Version management
└── EmojiRemover.gs              (2.6 KB) - Text processing
```

**ИТОГО: 56 KB полезных утилит, готовые к использованию!**

### ✅ Какие утилиты ИСПОЛЬЗОВАТЬ

#### 1. **SecurityValidator.gs** - Валидация Input
```javascript
// Защита от:
✅ XSS атак
✅ SQL injection
✅ Опасных URL
✅ Невалидных email
✅ Неправильных API ключей

// Использовать для:
✅ Валидации email пользователя (CLIENT → SERVER)
✅ Валидации prompt'ов для Gemini (CLIENT)
✅ Валидации VK owner параметра (CLIENT → SERVER → VK_PARSER)
```

#### 2. **LoggingService.gs** - Централизованное Логирование
```javascript
// Возможности:
✅ addSystemLog() - быстрое логирование
✅ logToSheet() - запись в Google Sheets (для анализа)
✅ generateTraceId() - отслеживание запросов

// Использовать для:
✅ Логирование всех Gemini запросов (CLIENT)
✅ Логирование всех VK импортов (SERVER)
✅ Трейсинг ошибок через trace ID
```

#### 3. **DetailedLogger.gs** - Подробное Логирование
```javascript
// Создает лист "Логи" с:
✅ Время операции
✅ Тип операции
✅ Имя функции
✅ Статус выполнения
✅ Детали
✅ Ошибки
✅ Длительность

// Использовать для:
✅ Детального анализа каждой операции
✅ Performance monitoring
✅ Отладки проблем
```

#### 4. **Utils.gs** - Atomic Operations
```javascript
// Backup система:
✅ createAtomicBackup() - создание backup перед изменениями
✅ restoreFromBackup() - восстановление данных
✅ cleanupOldBackups() - удаление старых backup'ов

// Использовать для:
✅ Безопасных импортов данных
✅ Защиты от data corruption
✅ Возможности откатить изменения
```

#### 5. **EmojiRemover.gs** - Text Processing
```javascript
// Функции:
✅ removeEmojis() - удаляет эмодзи
✅ containsEmojis() - проверяет наличие эмодзи
✅ countEmojis() - подсчитывает эмодзи

// Использовать для:
✅ Очистки VK постов (удаление эмодзи)
✅ Очистки OCR результатов
✅ Подготовки текста для Gemini
```

#### 6. **VersionInfo.gs** - Version Management
```javascript
// Функции:
✅ getVersionInfo() - полная информация о версии
✅ getVersionWithTimestamp() - для меню
✅ showVersionInfo() - показ в UI

// Использовать для:
✅ Отображения версии в меню
✅ Совместимости функций
✅ Tracking обновлений
```

---

## 📋 ПЛАН РЕФАКТОРИНГА (6 ФАЗА)

### ФАЗА 1: ПОДГОТОВКА (1 неделя)
**Цель:** Настроить базовую инфраструктуру

#### 1.1 Интеграция shared/ утилит в CLIENT и SERVER
```
✅ Убедиться что все shared/*.gs доступны везде
✅ Заменить дублирующийся код на shared функции
✅ Удалить старые реализации логирования
```

#### 1.2 Настройка SecurityValidator
```
✅ Валидировать EMAIL (от пользователя)
✅ Валидировать PROMPT (перед отправкой в Gemini)
✅ Валидировать VK owner (перед импортом)
```

#### 1.3 Настройка LoggingService
```
✅ initLogsSheet() в CLIENT при первом запуске
✅ Логировать все операции через addSystemLog()
✅ Использовать trace ID для отслеживания
```

**Timeline:** 5 дней
**Сложность:** Средняя

---

### ФАЗА 2: CLIENT ОЧИСТКА (2 недели)
**Цель:** Оставить на CLIENT только UI логику

#### 2.1 Удалить Gemini кэширование из CLIENT
```
БЫЛО:
  CLIENT:
    function GM() { ... 40 строк полного запроса ... }
    function gmCacheKey_() { ... }
    function gmCachePut_() { ... }

СТАЛО:
  CLIENT:
    function GM(prompt) {
      // Кэш НА КЛИЕНТЕ (каждый юзер сам кэширует)
      var key = 'gm_cache:' + prompt.slice(0, 20);
      var cached = CacheService.getScriptCache().get(key);
      if (cached) return cached;
      
      // Запрос с СОБСТВЕННЫМ ключом пользователя
      var apiKey = PropertiesService.getScriptProperties()
        .getProperty('GEMINI_API_KEY');
      var response = UrlFetchApp.fetch(GEMINI_API_URL, {
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        })
      });
      
      // Сохранить в кэш на 6 часов
      var result = JSON.parse(response).candidates[0].content.parts[0].text;
      CacheService.getScriptCache().put(key, result, 21600);
      
      // Логировать через SERVER (опционально)
      callServer('log_gemini', {prompt_len: prompt.length});
      
      return result;
    }
```

**Результат:**
- ✅ GM() остается в CLIENT (не передавать на SERVER!)
- ✅ Используется СОБСТВЕННЫЙ ключ пользователя
- ✅ Кэширование локальное
- ✅ SERVER только логирует

#### 2.2 Удалить дублирующееся логирование
```
БЫЛО:
  CLIENT: addSystemLog() (100+ строк)
  SERVER: serverLog() (100+ строк)
  Разные форматы, разная логика

СТАЛО:
  shared/LoggingService.gs:
    addSystemLog() (одна реализация для всех)
  CLIENT и SERVER используют одну функцию
```

#### 2.3 Оставить только UI функции
```
CLIENT будет содержать ТОЛЬКО:
✅ onOpen() - создание меню
✅ onEdit() - triggers для Sheet
✅ showDialog() - открытие диалогов
✅ callServer() - вызов SERVER endpoints
✅ displayResults() - вывод результатов в Sheet

УДАЛИТЬ:
❌ Все API вызовы (остаются в CLIENT только для Gemini!)
❌ Все валидации (переместить на SERVER)
❌ Все кэширования (кроме локального)
```

**Timeline:** 10 дней
**Сложность:** Средняя

---

### ФАЗА 3: SERVER КОНСОЛИДАЦИЯ (2 недели)
**Цель:** Централизовать бизнес логику

#### 3.1 Создать API слой
```
Структура SERVER после рефакторинга:

ServerEndpoints.gs:
  function doPost(e) {
    var action = JSON.parse(e.postData.contents).action;
    
    switch(action) {
      case 'check_license':
        return handleCheckLicense(data);
      case 'log_operation':
        return handleLogOperation(data);
      case 'import_vk':
        return handleVkImport(data);
      case 'validate_input':
        return handleValidateInput(data);
    }
  }
```

#### 3.2 Интегрировать SecurityValidator
```
LicenseValidator.gs:
  function validateLicense(email, token) {
    // Использовать SecurityValidator.validateEmail()
    if (!SecurityValidator.validateInput(email, 'email').isValid) {
      return { ok: false, error: 'Invalid email' };
    }
    
    // Проверить в БД
    // ...
  }

VkImportValidator.gs:
  function validateVkImportParams(owner, count) {
    // Использовать SecurityValidator
    if (!SecurityValidator.validateInput(owner, 'general').isValid) {
      return { ok: false, error: 'Invalid owner' };
    }
  }
```

#### 3.3 Интегрировать LoggingService
```
Все операции логируются через:

  const traceId = generateTraceId('vk_import');
  addSystemLog(`Starting VK import: ${owner}`, 'INFO', 'VK_PARSER');
  
  try {
    const result = importVkPosts(owner, count);
    addSystemLog(`Success`, 'INFO', 'VK_PARSER');
    logToSheet('IMPORT', 'importVkPosts', 'wall', 'SUCCESS', 
               {posts: result.length}, null, duration);
  } catch(e) {
    addSystemLog(`Error: ${e.message}`, 'ERROR', 'VK_PARSER');
    logToSheet('IMPORT', 'importVkPosts', 'wall', 'ERROR', 
               null, e.message, duration);
  }
```

**Timeline:** 10 дней
**Сложность:** Высокая

---

### ФАЗА 4: VK_PARSER ИНТЕГРАЦИЯ (1 неделя)
**Цель:** Синхронизировать VK импорт

#### 4.1 Убедиться VK_TOKEN на VK_PARSER
```
VK_PARSER ДОЛЖЕН ИМЕТЬ:
✅ VK_TOKEN (секретно, только на VK_PARSER)
✅ wall.get() логика
✅ album parsing логика
✅ Security валидация

VK_PARSER НЕ ДОЛЖЕН ИМЕТЬ:
❌ Gemini ключи
❌ Лицензионные данные
❌ User credentials
```

#### 4.2 SERVER → VK_PARSER интеграция
```
Когда CLIENT запрашивает VK импорт:

CLIENT → SERVER (action: 'import_vk', owner, count)
SERVER → VkImportService.gs:
  function handleVkImport(data) {
    // 1. Валидировать input
    const validation = SecurityValidator.validateInput(data.owner, 'general');
    if (!validation.isValid) return error();
    
    // 2. Вызвать VK_PARSER
    const vkParserUrl = 'https://...VK_PARSER_URL.../exec';
    const response = UrlFetchApp.fetch(vkParserUrl, {
      payload: JSON.stringify({
        action: 'wall',
        owner: data.owner,
        count: data.count
      })
    });
    
    // 3. Логировать
    const posts = JSON.parse(response.getContentText());
    addSystemLog(`Imported ${posts.length} posts from ${data.owner}`, 'INFO', 'VK');
    
    // 4. Вернуть результат
    return { ok: true, posts: posts };
  }
```

**Timeline:** 5 дней
**Сложность:** Средняя

---

### ФАЗА 5: ТЕСТИРОВАНИЕ (1 неделя)
**Цель:** Убедиться что все работает

#### 5.1 Функциональное тестирование
```
✅ GM() - Gemini запросы с собственным ключом
✅ checkLicense() - Проверка лицензий
✅ importVk() - Импорт из VK через VK_PARSER
✅ Логирование - Все операции логируются
✅ Валидация - Все inputs валидируются
```

#### 5.2 Безопасность
```
✅ Ключи не утекают между CLIENT/SERVER
✅ VK_TOKEN только на VK_PARSER
✅ Gemini ключ только на CLIENT
✅ Email/Token валидируются
```

#### 5.3 Performance
```
✅ CLIENT startup < 500ms
✅ GM() вызов < 3 сек
✅ VK импорт < 5 сек
✅ Логирование не замедляет операции
```

**Timeline:** 5 дней
**Сложность:** Средняя

---

### ФАЗА 6: ДОКУМЕНТАЦИЯ И DEPLOY (1 неделя)
**Цель:** Документировать и задеплоить

#### 6.1 Обновить документацию
```
✅ ARCHITECTURE_ANALYSIS_REPORT.md (правильная архитектура ключей)
✅ README.md (новая структура)
✅ REFACTORING_PLAN_DETAILED.md (этот документ)
✅ SECURITY.md (как работает security)
✅ API_DOCUMENTATION.md (API endpoints)
```

#### 6.2 Миграция данных
```
✅ Перенести логи в новый формат
✅ Обновить версию
✅ Запустить миграцию на production
```

#### 6.3 Деплой
```
✅ Merge в main
✅ GitHub Actions автоматически задеплоит
✅ Проверить что все работает
```

**Timeline:** 5 дней
**Сложность:** Низкая

---

## 📊 ИТОГОВАЯ СТАТИСТИКА РЕФАКТОРИНГА

### ДО (v2.1.0):
```
CLIENT: 3500 строк
├── UI логика: 500 строк
├── Gemini: 185 строк ✓ (ОСТАЕТСЯ!)
├── Кэширование: 200 строк
├── Логирование: 300 строк
├── Валидация: 200 строк
├── Credentials: 200 строк
└── Прочее: 1815 строк (УДАЛИТЬ!)

SERVER: 2000 строк
├── API: 200 строк
├── Лицензии: 300 строк
├── Логирование: 300 строк (УДАЛИТЬ! - дубликат)
├── Валидация: 200 строк (УДАЛИТЬ! - дубликат)
└── Прочее: 1000 строк

shared/: 56 KB (7 файлов) - готовые утилиты
```

### ПОСЛЕ (v3.0.0):
```
CLIENT: 800 строк
├── UI логика: 500 строк ✓
├── Gemini: 185 строк ✓
├── callServer(): 100 строк ✓
└── UI helpers: 15 строк ✓

SERVER: 1500 строк
├── API endpoints: 200 строк ✓
├── LicenseValidator: 300 строк ✓
├── VkImportService: 300 строк ✓
├── Validation: 200 строк ✓
└── Handlers: 500 строк ✓

shared/: 56 KB - ПЕРЕИСПОЛЬЗУЕТСЯ везде
├── SecurityValidator: используется в CLIENT + SERVER
├── LoggingService: используется везде
├── Utils: используется везде
└── Все остальные утилиты

УДАЛЕНО: 1815 строк неиспользуемого кода (-52%)
ПЕРЕИСПОЛЬЗОВАНО: 56 KB общих утилит (+100% переиспользования)
РЕЗУЛЬТАТ: Чище, безопаснее, масштабируемее!
```

---

## 🎯 КЛЮЧЕВЫЕ ПРИНЦИПЫ РЕФАКТОРИНГА

### 1️⃣ **ПРАВИЛО: Gemini Запросы = CLIENT Only**
```
❌ НИКОГДА не передавайте Gemini ключ на SERVER
✅ CLIENT вызывает Gemini напрямую
✅ SERVER может логировать что был запрос
✅ Каждый пользователь использует свой ключ
```

### 2️⃣ **ПРАВИЛО: Secrets по уровням**
```
CLIENT хранит:
  - Gemini ключ (пользователя)
  - Email (пользователя)
  - License token (пользователя)

SERVER хранит:
  - Данные о лицензиях
  - Логи операций
  - Telegram/Instagram ключи (опционально)

VK_PARSER хранит:
  - VK_TOKEN (НИКОМУ не доступен!)
```

### 3️⃣ **ПРАВИЛО: Используй shared/**
```
Любой код который нужен везде:
  → Идет в shared/

SecurityValidator, LoggingService, Utils, etc:
  → Используются везде автоматически
```

### 4️⃣ **ПРАВИЛО: DRY - No Duplication**
```
Если функция написана в shared/ - используй её везде:
  ❌ Не пиши свою валидацию - используй SecurityValidator
  ❌ Не пиши свое логирование - используй LoggingService
  ✅ Переиспользуй готовые утилиты
```

### 5️⃣ **ПРАВИЛО: Single Responsibility**
```
CLIENT: Только UI + Gemini (локальный)
SERVER: Только бизнес логика + API
VK_PARSER: Только VK интеграция
shared/: Только общие утилиты
```

---

## 🚀 ПРИОРИТЕТ ИСПОЛНЕНИЯ

### КРИТИЧЕСКИЙ (сделать СЕЙЧАС):
1. ✅ Понять правильную архитектуру ключей
2. ✅ Убедиться Gemini ключ остается на CLIENT
3. ✅ Убедиться VK_TOKEN только на VK_PARSER
4. 📋 Начать ФАЗУ 1: интеграция shared/

### ВЫСОКИЙ (первые 2 недели):
5. 📋 Начать ФАЗУ 2: CLIENT очистка (сохранить Gemini!)
6. 📋 Начать ФАЗУ 3: SERVER консолидация

### СРЕДНИЙ (следующие недели):
7. 📋 ФАЗА 4-6: Тестирование, документация, деплой

---

## ✅ SUCCESS CRITERIA

После завершения рефакторинга (v3.0.0):

```
✅ CLIENT: < 800 строк (-77%)
✅ SERVER: > 1500 строк (+75% логики!)
✅ shared/ переиспользуется везде (100%)
✅ НУЛЕВЫХ дубликатов кода
✅ Gemini ключ ТОЛЬКО на CLIENT
✅ VK_TOKEN ТОЛЬКО на VK_PARSER
✅ Все логирование через shared/LoggingService
✅ Все валидация через shared/SecurityValidator
✅ Все производительность сохранена
✅ Все безопасность укреплена
```

---

## 🎓 УРОК: Trinity Architecture

Правильная Trinity архитектура:

```
┌─────────────┐     HTTP      ┌─────────────┐
│   CLIENT    │ ←────────────→ │   SERVER    │
│ (User data) │               │ (Business)  │
└─────────────┘               └─────────────┘
       ↓                               ↓
   Personal                      Common
   Secrets                       Secrets
   (Gemini)                      (DB, logs)
                                      ↓
                              ┌─────────────┐
                              │  VK_PARSER  │
                              │  (VK Token) │
                              └─────────────┘
```

Каждый уровень:
- ✅ Владеет своими секретами
- ✅ Имеет четкую ответственность
- ✅ Использует общие утилиты из shared/
- ✅ Масштабируется независимо
- ✅ Может обновляться отдельно

---

**Статус:** 📋 Готов к внедрению  
**Next Action:** Начать ФАЗУ 1 - Интеграция shared/ утилит

Дорога к v3.0.0! 🚀
