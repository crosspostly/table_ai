# Table AI - AI-Powered Google Sheets Constructor v3.5

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-3.5.2-brightgreen.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)]()

> **🆕 v3.5.2**: 
> - ✅ Исправлена обратная совместимость OTA системы
> - ✅ **КРИТИЧНО:** Исправлена retry-логика при исчерпании квоты Gemini (30s → 60s → 120s вместо 1s → 2s → 4s)
> - ✅ Rate limit снижен до 2 запросов/минуту для предотвращения quota exhaustion
> - ✅ Детальное логирование всех Gemini API вызовов с таймстампами

## 📌 О проекте

**Table AI** - это мощный Google Sheets add-on, который использует **AI (Gemini 2.0)** для автоматизации работы с данными:

✅ **Интеллектуальные трансформации** - преобразование данных через natural language  
✅ **Парсинг VK постов** - автоматический импорт контента из VK  
✅ **OCR отзывов** - распознавание текста с изображений  
✅ **Автоматические обновления** - система OTA для бесперебойных апдейтов  
✅ **Лицензирование** - управление копиями и доступом пользователей  

---

## 🚀 Быстрый старт

### 1️⃣ Установка

```
# Клонируем репозиторий
git clone https://github.com/crosspostly/table_ai.git

# Входим в проект
cd table_ai

# Устанавливаем зависимости (если нужны)
npm install
```

### 2️⃣ Развертывание на Google Apps Script

```
# Создаём новый Apps Script проект
# Extensions → Apps Script в Google Sheets

# Копируем файлы из deploy/
- Main.gs
- CollectConfig.gs
- TemplateService.gs
- ... остальные файлы

# Или используем clasp (Google Apps Script CLI)
clasp clone <scriptId>
clasp push
```

### 3️⃣ Первый запуск

```
1. Открываешь таблицу
2. Extensions → Apps Script → (обновляешь браузер)
3. Меню: 🤖 Table AI → ⚙️ Настройки
4. Вставляешь Gemini API ключ (опционально)
5. Сохраняешь
6. ✅ Готово!
```

---

## 🏗️ Архитектура

### Компоненты системы

```
┌─────────────────────────────────────┐
│     КЛИЕНТ (Google Sheets)          │
│  ┌──────────────────────────────┐   │
│  │ Main.gs (UI, логика)         │   │
│  │ CollectConfig.gs             │   │
│  │ SettingsUI.html              │   │
│  └──────────────────────────────┘   │
└────────────┬────────────────────────┘
             │ OTA Updates
             │ Gemini API (client key)
             ▼
┌─────────────────────────────────────┐
│   СЕРВЕР (Google Apps Script Web App)│
│  ┌──────────────────────────────┐   │
│  │ server.gs (OTA, Лицензии)    │   │
│  │ license_module.gs            │   │
│  │ Обновляет клиентские скрипты │   │
│  └──────────────────────────────┘   │
└────────────┬────────────────────────┘
             │ Gemini API (default key)
             │ GitHub Raw API
             ▼
┌─────────────────────────────────────┐
│    ВНЕШНИЕ СЕРВИСЫ                  │
│  -  GitHub (deploy/ folder)          │
│  -  Google Gemini API                │
│  -  VK API                           │
│  -  Google Drive API                 │
└─────────────────────────────────────┘
```

### Поток данных OTA

```
1. Клиент проверяет версию (3:00 AM или вручную)
   └─> SERVER: action='ota', subaction='checkUpdates'

2. Сервер возвращает: updateAvailable=true

3. Клиент запрашивает файлы
   └─> SERVER: action='ota', subaction='getUpdatedFiles'

4. Сервер скачивает файлы с GitHub
   └─> GITHUB: /deploy/*.gs

5. Сервер отправляет файлы клиенту

6. Клиент запрашивает сервер обновить код
   └─> SERVER: action='ota', subaction='applyUpdates'

7. Сервер обновляет клиентский скрипт (Apps Script API)
   └─> API: PUT /projects/{scriptId}/content

8. ✅ Клиентский код обновлён!
```

---

## 📡 prompt_table (удалённые промпты)

### Что это такое?

**prompt_table** позволяет получать системный промпт (System Prompt) из удалённой Google Таблицы вместо локальных листов. Это полезно для:

✅ Централизованного управления промптами для разных пользователей  
✅ Быстрого изменения промпта без обновления каждой копии таблицы  
✅ Использования конфиденциальной таблицы с лицензированными промптами  

### Как использовать

**1. Открыть AI Constructor:**
- Меню: 🤖 Table AI → 🛠️ AI Constructor

**2. Включить prompt_table:**
- Поставить галку: `📡 prompt_table (удалённый сервер)`

**3. Заполнить параметры:**

| Поле | Описание | Пример |
|------|---------|--------|
| 📋 ID таблицы | ID Google Sheets (из URL) | `1abc123def456ghi` |
| 📄 Лист | Название листа с промптом | `Промты` |
| 📍 Ячейка | Адрес ячейки с промптом | `B2` или `A1:B5` |

**4. Применить:**
- Нажать: 🚀 Запустить

### Пример конфигурации

Если локальная таблица может читать из удалённой:

```javascript
// config.prompt_table (новый формат)
{
  "prompt_table": {
    "spreadsheetId": "1abc123def456ghi",
    "sheetName": "Промты",
    "cellAddress": "B2"
  }
}
```

### Проверка доступа

Перед использованием убедитесь что:
- ✅ Удалённая таблица доступна вашему Google аккаунту
- ✅ Лист `Промты` существует в таблице
- ✅ Ячейка `B2` содержит текст промпта
- ✅ Нет запрета на доступ через Apps Script

### Откат на локальные промпты

Если нужно вернуться к локальным промптам:
1. Открыть AI Constructor
2. Убрать галку с `📡 prompt_table`
3. Выбрать локальный лист и ячейку
4. Нажать 🚀 Запустить

---

## 🔑 Управление API ключами

### Gemini API (три уровня приоритета)

```
ПРИОРИТЕТ:
1️⃣ ЛИЧНЫЙ КЛЮЧ (UserProperties)
   └─ Если установлен → используется только для этого пользователя

2️⃣ ОБЩИЙ КЛЮЧ ТАБЛИЦЫ (ScriptProperties клиента)
   └─ Если личного нет → используется для всех пользователей этой копии

3️⃣ СЕРВЕРНЫЙ КЛЮЧ (ScriptProperties сервера)
   └─ Если на клиенте нет ключей → сервер выполняет запрос своим ключом

НОЛЬ КЛЮЧЕЙ В СИСТЕМЕ?
❌ Сервер вернёт `NO_API_KEY_AVAILABLE` и попросит администратора настроить ключ
```

### Как установить ключи

**Серверный ключ (администратор):**
```
// Extensions → server.gs → Console
setDefaultGeminiKey_('AIza...')
```

**Общий ключ таблицы (владелец):**
```
// В таблице: Меню → 🔑 Gemini → "Установить API ключ"
// или вручную через консоль Apps Script клиента
PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', 'AIza...')
```

**Личный ключ (пользователь):**
```
1. ⚙️ Настройки (Table AI → ⚙️ Настройки)
2. 🤖 Gemini API Ключ
3. Вставляешь свой ключ
4. ✅ Сохраняешь
```

---

## 📦 Лицензирование

### Система Bindings

Таблица лицензий (Google Sheet):
```
┌─────────────────┬──────────────┬──────────────┐
│ Email           │ sheet_ids    │ script_ids   │
├─────────────────┼──────────────┼──────────────┤
│ user@gmail.com  │ sheet-123... │ script-456...│
│ user@gmail.com  │ sheet-789... │ script-abc...│
└─────────────────┴──────────────┴──────────────┘

Каждая строка = одна копия таблицы
```

### Как работает

```
Пользователь копирует таблицу
    ↓
Открывает копию
    ↓
onOpen() → installUpdateTrigger_()
    ↓
Триггер создается → checkForUpdatesBackground_()
    ↓
Каждую ночь в 3:00 сервер проверяет обновления
    ↓
✅ Новый код автоматически загружается!
```

---

## 🔄 OTA (Over-The-Air) Обновления

### Как работают обновления

```
АВТОМАТИЧЕСКИЕ (каждую ночь в 3:00):
✅ Запускается checkForUpdatesBackground_()
✅ Сервер обновляет код клиента
✅ Пользователь ничего не делает

РУЧНЫЕ:
✅ Пользователь нажимает: 🔄 Автообновление
✅ Проверяется триггер (создается если нет)
✅ Запускается проверка обновлений
✅ Если есть обновление → обновляется код
```

### Стадии обновления

```
СТАДИЯ 1: ПРОВЕРКА ВЕРСИИ
├─ Клиент: CLIENT_VERSION = '3.1.0'
├─ Сервер: SERVER_VERSION = '3.1.1'
└─ Результат: updateAvailable = true

СТАДИЯ 2: СКАЧИВАНИЕ ФАЙЛОВ
├─ Сервер → GitHub: Скачивает 12 файлов
├─ Проверка: Все файлы получены?
└─ Результат: ✅ 12 файлов готовы

СТАДИЯ 3: ОБНОВЛЕНИЕ КОДА
├─ Сервер → Apps Script API
├─ Обновляет код в клиентском проекте
└─ Результат: ✅ Код обновлён в скрипте

СТАДИЯ 4: ГОТОВО
└─ ✅ Клиент перезагружается с новым кодом
```

---

## 🛠️ Разработка и развертывание

### Локальная разработка

```
# 1. Клонируем репо
git clone https://github.com/crosspostly/table_ai.git

# 2. Устанавливаем Google Apps Script CLI
npm install -g @google/clasp

# 3. Логинимся в Google
clasp login

# 4. Создаём Apps Script проект
clasp create

# 5. Синхронизируем код
clasp push

# 6. Разворачиваем
clasp deploy
```

### Развертывание на production

```
# 1. Увеличиваем версии:
#    - CLIENT_VERSION в Main.gs
#    - SERVER_VERSION в server.gs

# 2. Коммитим в main ветку
git add deploy/
git commit -m "Release v3.1.1: add feature X"
git push origin main

# 3. Deployим сервер
clasp deploy --server

# 4. OTA система автоматически обновит всех клиентов! ✅
```

---

## 📚 Документация

### Гайды

- 📖 [OTA_UPDATES.md](docs/OTA_UPDATES.md) - Подробно об обновлениях (v3.5)
- 🔐 [GITHUB_PRIVATE_REPO.md](docs/GITHUB_PRIVATE_REPO.md) - Приватные GitHub репо (NEW!)
- 🔑 [GEMINI_API_CONFIG.md](docs/GEMINI_API_CONFIG.md) - Управление API ключами
- 🏗️ [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Архитектура системы
- 📦 [LICENSE_SYSTEM.md](docs/LICENSE_SYSTEM.md) - Система лицензирования
- 🚀 [SERVER_SETUP.md](docs/SERVER_SETUP.md) - Настройка сервера
- 🎯 [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Развертывание

---

## 🐛 Отладка

### Включить DEV режим

```
// Main.gs, строка ~50
const DEV_MODE = true;  // ← Включить для отладки
```

### DEV Меню

```
🧰 DEV
├─ 📝 Показать логи (все события)
├─ ⬇️ Экспорт логов (скачать в CSV)
├─ 🗑 Очистить логи
├─ 🔍 Тест сервера (проверить связь)
├─ 🧪 Dev Self Test (вся система)
├─ 🔑 Debug Gemini Keys (проверить ключи)
└─ 🔄 Автообновление (управление триггерами)
```

### Вызвать отладку

```
// Extensions → Apps Script → Console
debugOTAFlow()        // Отладка OTA
debugGeminiKeys()     // Отладка Gemini ключей
testServerConnection() // Проверить сервер
```

---

## ⚡ Retry-логика и Rate Limiting (v3.5.2+)

### Проблема, которую мы решили

**До исправления:**
- Пользователь нажимал кнопку → quota exceeded
- Система пыталась повторить через **1s → 2s → 4s** (слишком быстро!)
- Результат: **20+ retry за несколько минут** → блокировка на 15+ минут

**После исправления:**
- **Exponential backoff:** 30s → 60s → 120s
- **Максимум 3 попытки**, затем понятная ошибка пользователю
- **Rate limit:** 2 запроса/минуту (глобально)
- **Детальное логирование** каждой попытки с таймстампами

### Как это работает

```javascript
// server.gs: executeGeminiWithRateLimit()

Попытка 1 → Ошибка 429
  ⏳ Ожидание 30 секунд...
  
Попытка 2 → Ошибка 429
  ⏳ Ожидание 60 секунд...
  
Попытка 3 → Ошибка 429
  ⏳ Ожидание 120 секунд...
  
❌ Все попытки исчерпаны
→ Пользователь видит: "⏸️ Квота Gemini API исчерпана. Подождите 120 секунд и попробуйте снова."
```

### Использование Retry-After

Если Google API возвращает `Retry-After` header, система использует это значение вместо фиксированного backoff:

```javascript
// Пример ошибки от Google:
{
  "error": {
    "message": "Resource exhausted",
    "details": [{
      "metadata": {
        "retryDelay": "45s"  // ← Используем это!
      }
    }]
  }
}
```

### Rate Limiting

**Константы:**
- `MAX_REQUESTS_PER_MINUTE = 2` (было 10)
- `RATE_LIMIT_WINDOW_MS = 60000` (1 минута)

**Поведение:**
1. Первый запрос → выполняется
2. Второй запрос (в течение минуты) → выполняется
3. Третий запрос → **ожидание** до конца минутного окна
4. После ожидания → выполняется

**Логи:**
```
[RATE_LIMIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[RATE_LIMIT] ⏸️ ПРЕВЫШЕН ЛИМИТ ЗАПРОСОВ
[RATE_LIMIT] Текущий лимит: 2 запросов/минуту
[RATE_LIMIT] Ожидание: 45 секунд
[RATE_LIMIT] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Мониторинг API вызовов

Все метрики логируются в лист `API_METRICS` (в лицензионной таблице):

| Timestamp | Function | Status | Model | Tokens | Error | Wait Time (ms) |
|-----------|----------|--------|-------|--------|-------|----------------|
| 2025-01-... | executeGeminiWithRateLimit | success | gemini-2.5-flash-lite | 1234 | | 0 |
| 2025-01-... | executeGeminiWithRateLimit | failed | gemini-2.5-flash-lite | 0 | Quota exceeded | 30000 |

**Как посмотреть:**
1. Открываешь лицензионную таблицу (LICENSE_SHEET_ID)
2. Ищешь лист `API_METRICS`
3. Смотришь все вызовы с таймстампами и ошибками

### Документация API вызовов

Полная карта всех вызовов Gemini API: [docs/GEMINI_API_CALLS.md](docs/GEMINI_API_CALLS.md)

**Включает:**
- Полный поток вызовов (CLIENT → SERVER → Gemini)
- Описание каждой функции
- Retry-логика и rate limiting
- Примеры использования
- Troubleshooting

---

## 🤝 Вклад

Хочешь помочь развивать проект?

1. Fork репозиторий
2. Создай feature ветку: `git checkout -b feature/amazing-thing`
3. Коммитишь изменения: `git commit -m 'Add amazing thing'`
4. Пушишь: `git push origin feature/amazing-thing`
5. Создаешь Pull Request

---

## 📄 Лицензия

MIT License - смотри [LICENSE](LICENSE)

---

## 📞 Контакты

- 👨‍💻 Автор: [@daoqub](https://vk.com/daoqub)
- 🐛 Ошибка? [Создай Issue](https://github.com/crosspostly/table_ai/issues)
- 💬 Предложение? [Обсудим в Discussions](https://github.com/crosspostly/table_ai/discussions)

---

## 🎯 Дорожная карта

- [x] v3.5.0 - Private GitHub OTA + Client/Server separation
- [x] v3.5.1 - DEV tools extraction
- [x] v3.5.2 - OTA backward compatibility fix
- [ ] v3.6 - Multi-language support
- [ ] v4.0 - Web dashboard

---

## 📋 История изменений

См. [CHANGELOG.md](docs/CHANGELOG.md) для полной истории изменений.

---

**Последнее обновление:** 2025-01-XX | v3.5.2
