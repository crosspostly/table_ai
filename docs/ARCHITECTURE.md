# 🏗️ Архитектура Table AI

## Обзор системы

```
USERS (копируют таблицу)
    ↓
CLIENT (Main.gs в таблице пользователя)
    ↓ OTA, Gemini, Data processing
    ↓
SERVER (Web App на Google Apps Script)
    ↓ License check, API proxy, Code updates
    ↓
EXTERNAL SERVICES (GitHub, Gemini, VK, etc)
```

## Компоненты

### 1. Client Layer (Main.gs)
- UI: Меню, диалоги, настройки
- Logic: Обработка данных через Gemini
- OTA: Проверка обновлений, получение файлов
- Storage: Личный Gemini ключ в User properties

### 2. Server Layer (server.gs)
- License: Проверка лицензий через Bindings
- OTA: Скачивание файлов, обновление клиентов
- API Proxy: Отправка запросов Gemini с серверным ключом
- Storage: Серверный Gemini ключ в Script properties

### 3. Data Storage
- License Sheet: Tokens (email, token, expires, copies_count)
- Bindings Sheet: Привязки (email, sheet_id, script_id)
- Logs: История операций

### 4. External APIs
- GitHub: Исходный код в /deploy/
- Google Sheets API: Работа с данными
- Apps Script API: Обновление кода
- Gemini API: AI обработка
- VK API: Импорт постов

## Потоки данных

### OTA Update Flow

```
1. CLIENT: checkForUpdatesBackground_()
   └─ Запрос: {action: 'ota', subaction: 'checkUpdates'}

2. SERVER: Сравнение версий
   └─ Ответ: {updateAvailable: true, version: '3.1.1'}

3. CLIENT: Запрос файлов
   └─ Запрос: {action: 'ota', subaction: 'getUpdatedFiles'}

4. SERVER: Скачивание с GitHub
   └─ GitHub: GET /deploy/*.gs
   └─ Ответ: {files: {...}}

5. CLIENT: Применение обновлений
   └─ Запрос: {action: 'ota', subaction: 'applyUpdates'}

6. SERVER: Обновление кода
   └─ Apps Script API: PUT /projects/{scriptId}/content
   └─ Ответ: {success: true}
```

### Gemini API Request Flow

```
1. CLIENT: GM(prompt)
   ├─ Проверить личный ключ в User Properties
   ├─ Если нет → запросить у сервера
   └─ Запрос: {action: 'gemini', prompt: '...'}

2. SERVER: Proxy запрос
   ├─ Проверить серверный ключ в Script Properties
   ├─ Использовать ключ с приоритетом
   └─ Gemini API: POST /v1/models/gemini-pro:generateContent

3. GEMINI: Обработка промпта
   └─ Ответ: {candidates: [{content: {parts: [{text: "..."}]}}]}

4. SERVER: Возврат результата
   └─ Ответ клиенту: {result: "..."}

5. CLIENT: Запись результата
   └─ SpreadsheetApp: targetCell.setValue(result)
```

### License Check Flow

```
1. CLIENT: onOpen()
   └─ installUpdateTrigger_()
   └─ Получить email и scriptId

2. SERVER: Проверка лицензии
   ├─ Проверить email в License Sheet
   ├─ Проверить token не истёк
   ├─ Проверить copies_count > 0
   └─ Проверить scriptId в Bindings Sheet

3. SERVER: Обновление Bindings
   ├─ Если новая копия → добавить в Bindings
   ├─ Уменьшить copies_count
   └─ Записать timestamp

4. CLIENT: Продолжить работу
   └─ ✅ Лицензия валидна
   └─ ❌ Лицензия невалидна → показать ошибку
```

## Техническая архитектура

### Database Schema

#### License Sheet
```
┌─────────────────────┬─────────────┬─────────────┬──────────────┐
│ email               │ token       │ expires     │ copies_count │
├─────────────────────┼─────────────┼─────────────┼──────────────┤
│ user@gmail.com      │ abc123...   │ 2025-12-31  │ 100          │
│ admin@company.com   │ xyz789...   │ 2026-01-31  │ 1000         │
└─────────────────────┴─────────────┴─────────────┴──────────────┘
```

#### Bindings Sheet
```
┌─────────────────────┬─────────────┬─────────────┬─────────────┐
│ email               │ sheet_id    │ script_id   │ created_at  │
├─────────────────────┼─────────────┼─────────────┼─────────────┤
│ user@gmail.com      │ sheet-123...│ script-456..│ 2025-11-30  │
│ user@gmail.com      │ sheet-789...│ script-abc..│ 2025-11-29  │
└─────────────────────┴─────────────┴─────────────┴─────────────┘
```

### API Endpoints

#### Server Web App (server.gs)
```
POST / {action: 'ota', subaction: 'checkUpdates'}
POST / {action: 'ota', subaction: 'getUpdatedFiles'}
POST / {action: 'ota', subaction: 'applyUpdates'}
POST / {action: 'gemini', prompt: '...'}
POST / {action: 'license', operation: 'check'}
POST / {action: 'license', operation: 'bind'}
```

### File Structure

#### Client Files (deploy/)
```
Main.gs                    # Основной клиентский код
├─ onOpen()               # Меню и триггеры
├─ checkForUpdatesBackground_()  # OTA проверка
├─ GM(prompt)             # Gemini API вызов
└─ DEV функции            # Отладка и тесты

CollectConfig.gs           # AI конструктор
├─ getCollectConfigInitData()  # Инициализация UI
├─ saveAndExecuteCollectConfig()  # Выполнение
└─ Работа с шаблонами

TemplateService.gs        # Сервис шаблонов
├─ saveTemplate()         # Сохранение
├─ loadTemplate()         # Загрузка
└─ deleteTemplate()       # Удаление

HTML файлы:
├─ CollectConfigUi.html   # UI конструктора
├─ SettingsUI.html        # Настройки
├─ UnpackingViewerUI.html # Просмотр данных
└─ logging_system.html    # Система логов
```

#### Server Files (deploy/)
```
server.gs                  # Основной сервер
├─ doPost()               # Диспетчер запросов
├─ case 'ota'             # OTA обработка
├─ case 'gemini'          # Gemini proxy
├─ case 'license'         # Проверка лицензий
└─ fetchFileContent_()    # Скачивание с GitHub

license.gs                # Модуль лицензий
├─ checkLicense()         # Проверка лицензии
├─ bindSheetToLicense()   # Привязка таблицы
└─ validateToken()        # Валидация токена
```

## Security Model

### 1. API Key Management
```
Client Key (User Properties)
├─ Хранится локально
├─ Приоритет над серверным
└─ Пользователь может изменить

Server Key (Script Properties)
├─ Хранится на сервере
├─ Fallback для всех клиентов
└─ Только администратор может изменить
```

### 2. License Validation
```
Token Based Authentication
├─ Уникальный токен на пользователя
├─ Экспирация токена
├─ Лимит копий (copies_count)
└─ Привязка к конкретным таблицам
```

### 3. OTA Security
```
Code Signing
├─ Файлы только из main ветки GitHub
├─ Проверка целостности файлов
├─ Версионирование (CLIENT_VERSION vs SERVER_VERSION)
└─ Rollback поддержка
```

## Performance Considerations

### 1. Caching Strategy
```
PropertiesService Cache
├─ Gemini ключи (кэшируются)
├─ Шаблоны (PropertiesService > Sheets)
├─ Конфигурации (быстрый доступ)
└─ LockService для параллельных операций
```

### 2. Rate Limiting
```
Gemini API Limits
├─ 60 RPM (Free tier)
├─ 10,000 RPM (Paid tier)
├─ Exponential backoff на ошибки
└─ Queue для асинхронных операций
```

### 3. Batch Operations
```
Optimized Data Processing
├─ getValues() вместо getValue()
├─ Пакетная обработка диапазонов
├─ Минимизация API вызовов
└─ Асинхронные операции где возможно
```

## Monitoring & Observability

### 1. Logging System
```
Structured Logging
├─ Уровни: ERROR, WARN, INFO, DEBUG
├─ CacheService (300 записей, 24 часа)
├─ Экспорт в Google Sheets
└─ Фильтрация и поиск
```

### 2. Metrics
```
Performance Metrics
├─ Время выполнения операций
├─ Количество API запросов
├─ Успешность/ошибки
└─ Использование памяти
```

### 3. Health Checks
```
System Monitoring
├─ testServerConnection()
├─ debugGeminiKeys()
├─ debugOTAFlow()
└─ Dev Self Test
```

---

**Последнее обновление:** 30.11.2025
