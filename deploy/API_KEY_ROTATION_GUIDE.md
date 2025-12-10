# 🔑 API Key Rotation & Dynamic Model Management

**Версия:** 3.5.3+  
**Дата:** декабрь 2025  
**Статус:** Production Ready ✅

---

## 📋 Содержание

1. [Обзор архитектуры](#обзор-архитектуры)
2. [Приоритет ключей](#приоритет-ключей)
3. [Динамическое управление моделями](#динамическое-управление-моделями)
4. [Fallback механизм](#fallback-механизм)
5. [Настройка таблицы api_gem](#настройка-таблицы-api_gem)
6. [Логирование](#логирование)
7. [Примеры](#примеры)

---

## 🏗️ Обзор архитектуры

### До PR #90
```
Клиент
  └─ Прямой вызов Gemini API
     └─ API key в URL (?key=...)
     └─ Небезопасно!
```

### После PR #90 с API Key Rotation
```
Клиент
  └─ Вызов сервера
     └─ serverGMImageWithRotation_()
        ├─ Попытка 1: userApiKey + all models
        ├─ Попытка 2: backup keys from api_gem sheet
        ├─ Fallback: на менее мощные модели
        └─ Graceful degradation если все исчерпаны
```

---

## 🔐 Приоритет ключей

Порядок попыток (в `serverGMImageWithRotation_()`):

### 1️⃣ Клиентский ключ (USER)
```javascript
// Если клиент передал свой API key
const userApiKey = (data.apiKey || '').toString();
```

### 2️⃣ Серверный ключ по умолчанию (DEFAULT)
```javascript
// Если клиентского нет, берем из Script Properties
const defaultApiKey = getDefaultGeminiKey_();
```

### 3️⃣ Резервные ключи из таблицы (BACKUP)
```javascript
// Если оба выше исчерпаны, читаем из листа api_gem
const backupKeys = getApiKeysFromSheet_();
// Столбец A, начиная с A2
```

---

## 🤖 Динамическое управление моделями

### Константа GEMINI_MODELS
```javascript
const GEMINI_MODELS = [
  // Tier 1: Лучше для картинок (OCR)
  {model: 'gemini-2.5-flash-image', rpd: 10000, rpm: 600000},
  // Tier 2: Универсальные
  {model: 'gemini-2.5-flash', rpd: 10000, rpm: 600000},
  {model: 'gemini-2.5-flash-lite', rpd: 10000, rpm: 1000000},
  // Tier 3: Продвинутые
  {model: 'gemini-2.5-pro', rpd: 1000, rpm: 40000},
];
```

### Поддерживаемые модели (декабрь 2025)

| Модель | RPD | RPM | Для OCR | Примечание |
|--------|-----|-----|---------|------------|
| `gemini-2.5-flash-image` | 10k | 600k | ✅ **BEST** | Оптимизирована для картинок |
| `gemini-2.5-flash` | 10k | 600k | ✅ | Универсальная |
| `gemini-2.5-flash-lite` | 10k | 1M | ✅ | Самая дешевая + быстрая |
| `gemini-2.5-pro` | 1k | 40k | ❌ | Слишком мощная |
| `gemini-2.0-flash` | - | - | ⚠️ | Deprecated |

**RPD** = Requests Per Day  
**RPM** = Requests Per Minute

---

## 🔄 Fallback механизм

### Алгоритм для `serverGMImageWithRotation_()`

```
Для каждого API ключа:
  ├─ Для каждой модели:
  │   ├─ Попытка 1
  │   │   ├─ 200 OK? ✅ Возвращаем результат
  │   │   ├─ 429 (квота)? Переходим к следующей модели
  │   │   ├─ 401/403 (auth)? Переходим к следующему ключу
  │   │   └─ Другая ошибка? Пытаемся еще раз
  │   └─ Попытка 2 (если ошибка не fatal)
  └─ Если все модели исчерпаны → следующий ключ

Если все ключи и модели исчерпаны:
  └─ Выбрасываем ошибку 'ALL_KEYS_EXHAUSTED'
```

### Коды ошибок

| Код | Значение | Действие |
|-----|----------|----------|
| **200** | OK | ✅ Success, return result |
| **429** | Quota exceeded | 🔄 Try next model |
| **401** | Unauthorized | 🔑 Try next API key |
| **403** | Forbidden | 🔑 Try next API key |
| **Other** | Server error | 🔄 Retry 2 times |

---

## 📊 Настройка таблицы api_gem

### Структура листа

**Лист:** `api_gem` в лицензионной таблице (`LICENSE_SHEET_ID`)  
**Столбец A (с A2):** API ключи

```
A1 | api_key
---|----------
A2 | sk-proj-xxxxx (ключ 1)
A3 | sk-proj-yyyyy (ключ 2)
A4 | sk-proj-zzzzz (ключ 3)
...
```

### Кэширование

Ключи кэшируются на **1 час** в `CacheService.getScriptCache()`.

```javascript
// Автоматическое кэширование в getApiKeysFromSheet_()
const API_KEYS_CACHE_DURATION = 3600; // 1 час
```

### Очистка кэша

Если добавили новый ключ, вызовите:

```javascript
clearApiKeyCache_()
```

---

## 📝 Логирование

### Где смотреть логи

1. **Apps Script Console** (`Ctrl+Enter`)
   - Детальный поток всех попыток
   - HTTP коды, ошибки, модели

2. **Лист `Логи` в лицензионной таблице**
   - Итоговый результат (ok/fail)
   - Используемый keySource (USER, DEFAULT, BACKUP)
   - Время выполнения

### Пример логирования

```
=== serverGMImageWithRotation_ START ===
images count: 1
lang: ru
Backup keys available: 3

🔑 Key attempt 1 of 4 (USER)
  🔍 Model attempt 0/5 (gemini-2.5-flash-image), try 1/2
    🌐 POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
    ✓ HTTP 429
    ⚠️ QUOTA (429) - trying next model...
  
  🔍 Model attempt 1/5 (gemini-2.5-flash), try 1/2
    🌐 POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
    ✓ HTTP 200
    ✅ SUCCESS with USER key #1, model gemini-2.5-flash
```

---

## 🧪 Примеры

### Пример 1: Клиент передает свой ключ

```javascript
// Client-side code
const response = UrlFetchApp.fetch(SERVER_URL, {
  method: 'post',
  contentType: 'application/json',
  payload: JSON.stringify({
    action: 'gm_image',
    images: [...],
    lang: 'ru',
    apiKey: 'sk-proj-my-own-key-xxxxx',  // ⭐ Свой ключ клиента
  }),
});

// Server попробует:
// 1. sk-proj-my-own-key-xxxxx (USER)
// 2. Если ошибка 401/403 → следующий
// 3. Резервные ключи из api_gem
```

### Пример 2: Автоматический fallback

**Сценарий:** Клиент не передал ключ, на сервере исчерпана квота для первой модели

```
Аттемпт 1: gemini-2.5-flash-image + defaultKey
  └─ 429 Quota → next model

Атттемпт 2: gemini-2.5-flash + defaultKey
  └─ 429 Quota → next model

Атттемпт 3: gemini-2.5-flash-lite + defaultKey
  └─ 200 OK ✅ Success!
```

### Пример 3: Ротация ключей

**Сценарий:** Серверный ключ неверный, есть резервные

```
Атттемпт 1: all models + defaultKey
  └─ 401 Auth error → next key

Атттемпт 2: gemini-2.5-flash-image + backup[0]
  └─ 200 OK ✅ Success!
```

---

## 🛡️ Безопасность

### ✅ Что улучшено

1. **API key НЕ видна в сети**
   - Передается в заголовке `x-goog-api-key`, не в URL
   - Browser history не сохраняет key
   - Логи не содержат actual key значения

2. **Резервные ключи хранятся на сервере**
   - Клиент не видит список резервных ключей
   - Автоматическая ротация скрыта от пользователя

3. **Graceful degradation**
   - Если основной key не работает, пытаемся резервные
   - Если все ключи исчерпаны, возвращаем понятную ошибку

---

## 🔧 Администраторские функции

### Чтение ключей из таблицы

```javascript
// Вызвать в Console
getApiKeysFromSheet_()
// Возвращает: ['key1', 'key2', 'key3', ...]
```

### Очистка кэша

```javascript
// После добавления новых ключей
clearApiKeyCache_()
```

### Установка дефолтного ключа

```javascript
// Вызвать один раз при настройке
setDefaultGeminiKey_('sk-proj-xxxxx')
```

---

## 📈 Мониторинг квоты

### Как узнать, когда ключ исчерпан

1. **Логи Console**
   - Ищите `429 Quota exceeded`
   - Смотрите, какая модель выбрана fallback

2. **Лист Логи**
   - `keySource` покажет, какой ключ использовался
   - `error` покажет `ALL_KEYS_EXHAUSTED`

3. **Google API Dashboard**
   - https://console.cloud.google.com/apis/dashboard
   - Смотрите Gemini API usage

---

## ❓ FAQ

### Q: Что если все ключи и модели исчерпаны?
**A:** Возвращается ошибка `'ALL_KEYS_EXHAUSTED: ...'` с кодом 500. Нужно:
1. Добавить новый API key в таблицу `api_gem`
2. Дождаться следующего часа (сброс квоты)
3. Очистить кэш: `clearApiKeyCache_()`

### Q: Почему именно 2 попытки на модель?
**A:** Баланс между отказоустойчивостью и скоростью. 2 попытки ловят временные сетевые сбои, но не замораживают систему на долгие переборы.

### Q: Как приоритизировать определённую модель?
**A:** Измените порядок в `GEMINI_MODELS`. Первая модель в массиве имеет наивысший приоритет.

### Q: Можно ли отключить fallback?
**A:** Нет, это встроено. Но можно передать клиентский ключ, чтобы не использовать резервные.

---

## 🚀 Развертывание

### Предусловия

1. **Создать лист `api_gem` в лицензионной таблице**
   - Столбец A: API ключи
   - Начиная с A2

2. **Установить дефолтный ключ** (опционально)
   ```javascript
   setDefaultGeminiKey_('sk-proj-xxxxx')
   ```

3. **Пересоздать deployment** (новая версия server.gs)
   - Версия: 3.5.3+

### Проверка

```javascript
// В Console сервера
getApiKeysFromSheet_()  // Должны вернуться ключи
getDefaultGeminiKey_()  // Должен вернуться дефолтный ключ
```

---

## 📚 Ссылки

- [OCR_SERVER_PROXY_GUIDE.md](./OCR_SERVER_PROXY_GUIDE.md) - Архитектура proxy
- [OCR_MIGRATION_SUMMARY.md](./OCR_MIGRATION_SUMMARY.md) - Summary PR #90
- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models) - Official docs

---

**Status:** ✅ Production Ready  
**Last Updated:** 2025-12-10  
**Version:** 3.5.3+
