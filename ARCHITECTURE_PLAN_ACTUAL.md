# 🏗️ АКТУАЛЬНЫЙ ПЛАН РЕФАКТОРИНГА v2.1.0 → v3.0.0
## Table AI - Правильная архитектура

---

## 🔴 КРИТИЧЕСКАЯ ОШИБКА В ПРЕДЫДУЩЕМ АНАЛИЗЕ

### ❌ ЧТО Я НЕПРАВИЛЬНО ПИСАЛ:

```
"CLIENT → Gemini API (с собственным ключом пользователя)"
"CLIENT → VK API (через VK_PARSER)"
"GM() ОСТАЕТСЯ на CLIENT"
"SERVER может логировать что был запрос"
```

### ✅ ЧТО НА САМОМ ДЕЛЕ:

```
CLIENT БЕРЕТ КЛЮЧ, НО ВСЕ ЗАПРОСЫ И ДЕЙСТВИЯ НА СЕРВЕРЕ!
```

---

## 🏗️ ПРАВИЛЬНАЯ АРХИТЕКТУРА

### ❌ НЕПРАВИЛЬНО (то что я писал):
```
CLIENT → Gemini API
CLIENT → VK_PARSER
SERVER → логирование
```

### ✅ ПРАВИЛЬНО (так как есть сейчас):
```
CLIENT → SERVER (с ключами и параметрами)
SERVER → Gemini API
SERVER → VK_PARSER (встроено в SERVER, не отдельный сервис!)
SERVER → Логирование
SERVER → Результаты обратно CLIENT
```

### 📋 Распределение:

```
┌──────────────────────────────────────────────┐
│ 📱 CLIENT (Google Sheets Container-bound)   │
├──────────────────────────────────────────────┤
│ ✅ UI (меню, диалоги, результаты)           │
│ ✅ GEMINI_API_KEY (от пользователя)         │
│ ✅ EMAIL (от пользователя)                  │
│ ✅ LICENSE_TOKEN (от пользователя)          │
│ ❌ БЕЗ логики (вся логика на SERVER!)       │
│ ❌ БЕЗ callServer() - это неправильный путь!│
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 🌐 SERVER (Standalone Web App)              │
├──────────────────────────────────────────────┤
│ ✅ ВСЕ API endpoints (POST /gm, /import_vk) │
│ ✅ ВСЕ бизнес логика                        │
│ ✅ Gemini вызовы (получает ключ от CLIENT)  │
│ ✅ VK_PARSER логика (встроена в SERVER!)    │
│ ✅ Валидация input                          │
│ ✅ Логирование всего                        │
│ ✅ Работа с БД                              │
│ ✅ Кэширование (если нужно)                 │
└──────────────────────────────────────────────┘
```

---

## 🔄 ПОТОК ДАННЫХ ПРАВИЛЬНО

### 1️⃣ GEMINI ЗАПРОС

```
CLIENT:
  User вводит: "Prompt", "GEMINI_API_KEY", "EMAIL", "LICENSE_TOKEN"
  CLIENT отправляет:
    POST /gm
    {
      action: 'gm',
      prompt: '...',
      key: 'sk-...',
      email: 'user@example.com',
      token: 'lic_...'
    }

SERVER:
  1️⃣ Получает запрос
  2️⃣ Валидирует: email, token (лицензия ок?)
  3️⃣ Вызывает Gemini с ключом от CLIENT
  4️⃣ Получает ответ от Gemini
  5️⃣ Логирует: {email, prompt_len, status, timestamp}
  6️⃣ Возвращает:
    {
      ok: true,
      result: 'Ответ от Gemini',
      trace_id: '...'
    }

CLIENT:
  1️⃣ Получает результат
  2️⃣ Показывает в Sheet
  3️⃣ Готов к новому запросу
```

### 2️⃣ VK ИМПОРТ

```
CLIENT:
  User вводит: "VK owner", "count", "EMAIL", "LICENSE_TOKEN"
  CLIENT отправляет:
    POST /import_vk
    {
      action: 'import_vk',
      owner: 'durov',
      count: 10,
      email: 'user@example.com',
      token: 'lic_...'
    }

SERVER:
  1️⃣ Получает запрос
  2️⃣ Валидирует: email, token (лицензия ок?)
  3️⃣ Запускает встроенный VK_PARSER код:
     const vkToken = getVkToken_();  // из PropertiesService
     const posts = handleWallGet_(owner, count, vkToken);
  4️⃣ Парсит посты (это часть VK_PARSER.txt логики!)
  5️⃣ Логирует: {email, owner, posts_count, status}
  6️⃣ Возвращает:
    {
      ok: true,
      posts: [
        {date, link, text, comments, likes},
        ...
      ],
      count: 10,
      trace_id: '...'
    }

CLIENT:
  1️⃣ Получает посты
  2️⃣ Вставляет в Sheet
  3️⃣ Показывает результат
```

### 3️⃣ ЛИЦЕНЗИОННАЯ ПРОВЕРКА

```
CLIENT:
  При открытии Sheet проверяет лицензию
  CLIENT отправляет:
    POST /check_license
    {
      action: 'check_license',
      email: 'user@example.com',
      token: 'lic_...'
    }

SERVER:
  1️⃣ Проверяет email + token в БД
  2️⃣ Возвращает:
    {
      ok: true/false,
      remaining_calls: 99,
      expiry: '2025-12-31'
    }

CLIENT:
  Если ok = false → показывает "Купите лицензию"
  Если ok = true → позволяет работать
```

---

## 🚨 ПРОБЛЕМА С GM() НА CLIENT

### ❌ Почему это плохо:

```javascript
// Если в CLIENT есть:
function GM(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var response = UrlFetchApp.fetch(GEMINI_API_URL, {
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  return JSON.parse(response).candidates[0].content.parts[0].text;
}
```

### 🔓 РИСК:

1. **Логика видна в исходнике** - Любой может открыть Apps Script и скопировать функцию
2. **Ключ скопируется вместе с логикой** - Логика + ключ = компрометация
3. **Легко подделать** - Можно создать свой скрипт с той же функцией
4. **Нет контроля** - SERVER не знает как был вызван Gemini

### ✅ ПРАВИЛЬНО:

```javascript
// CLIENT ОТПРАВЛЯЕТ ТОЛЬКО ДАННЫЕ
function sendGmRequest(prompt) {
  var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  var email = PropertiesService.getScriptProperties().getProperty('EMAIL');
  var token = PropertiesService.getScriptProperties().getProperty('LICENSE_TOKEN');
  
  // Просто отправляем на SERVER
  var response = UrlFetchApp.fetch(SERVER_URL + '/exec', {
    method: 'post',
    payload: JSON.stringify({
      action: 'gm',
      prompt: prompt,
      key: key,
      email: email,
      token: token
    })
  });
  
  var result = JSON.parse(response.getContentText());
  return result.result;  // SERVER вернул результат Gemini
}

// SERVER ВЫПОЛНЯЕТ ЛОГИКУ
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  
  if (data.action === 'gm') {
    // Валидируем
    if (!validateLicense(data.email, data.token)) {
      return error('License invalid');
    }
    
    // ЗДЕСЬ вызываем Gemini
    var response = UrlFetchApp.fetch(GEMINI_API_URL, {
      method: 'post',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: data.prompt }] }],
        model: 'gemini-1.5-pro'
      }),
      headers: {'x-goog-api-key': data.key}
    });
    
    // Логируем
    logOperation({
      type: 'gm',
      email: data.email,
      prompt_len: data.prompt.length,
      timestamp: new Date()
    });
    
    // Возвращаем
    var result = JSON.parse(response.getContentText());
    return json({ok: true, result: result.candidates[0].content.parts[0].text});
  }
}
```

### 💡 ПРЕИМУЩЕСТВА:

```
✅ Логика защищена на SERVER
✅ Ключ использует SERVER (клиент не знает как)
✅ Нельзя скопировать логику GM()
✅ SERVER может изменить логику без обновления CLIENT
✅ SERVER может отказать если лицензия не ок
✅ Нет дублирования логики
✅ Легко логировать
✅ Легко добавить rate limiting
✅ Легко добавить кэширование
```

---

## 📋 VK_PARSER - ВСТРОЕНО В SERVER

### 📄 Что это (глядя на old/VK_PARSER.txt):

```javascript
// Это просто функции, которые:
function handleWallGet_(owner, count, token) { ... }  // 50+ строк
function handleParseAlbum_(url, token) { ... }        // 80+ строк
function handleParseDiscussion_(url, token) { ... }   // 100+ строк
function handleParseReviews_(url, token) { ... }      // 150+ строк

// Они используют VK_TOKEN из SERVER PropertiesService
var token = getVkToken_();

// И возвращают JSON результаты
return json_(items);
```

### ✅ Что делать:

```
1️⃣ СКОПИРОВАТЬ эту логику в SERVER (не удалять!)
2️⃣ Использовать ВНУТРь SERVER как часть одного приложения
3️⃣ CLIENT → SERVER /import_vk → SERVER запускает handleWallGet_()
4️⃣ БЕЗ отдельных HTTP запросов!
5️⃣ БЕЗ лишних задержек!
```

### ❌ Что НЕ делать:

```
❌ Делать VK_PARSER отдельным приложением
❌ Вызывать VK_PARSER по HTTP из SERVER
❌ Усложнять архитектуру
```

---

## 🎯 ПРАВИЛА РЕФАКТОРИНГА

### ПРАВИЛО 1: CLIENT = UI ONLY
```
CLIENT содержит ТОЛЬКО:
  ✅ onOpen() - меню
  ✅ onEdit() - триггеры
  ✅ showDialog() - диалоги
  ✅ displayResults() - вывод результатов
  ✅ callServer() - отправка запроса на SERVER
  ✅ Работа с Sheet (readRange, writeRange)

CLIENT НЕ содержит:
  ❌ Gemini вызовы
  ❌ VK вызовы
  ❌ Валидацию (кроме UI)
  ❌ Логику (вообще никакую!)
  ❌ API ключи для логики (только в PropertiesService!)
```

### ПРАВИЛО 2: SERVER = ВСЯ ЛОГИКА
```
SERVER содержит ВСЕ:
  ✅ API endpoints: /gm, /import_vk, /check_license, /log
  ✅ Gemini логика
  ✅ VK_PARSER логика (встроена как функции)
  ✅ Валидация
  ✅ Логирование
  ✅ Кэширование (если нужно)
  ✅ БД операции
```

### ПРАВИЛО 3: SHARED = ПЕРЕИСПОЛЬЗОВАНИЕ
```
Что идет в shared/:
  ✅ SecurityValidator - валидация
  ✅ LoggingService - логирование
  ✅ Utils - helper функции
  ✅ EmojiRemover - очистка текста

Что дублируется?
  ❌ Ничего! Везде используется shared/
```

### ПРАВИЛО 4: VK_PARSER = ВСТРОЕНО, НЕ ОТДЕЛЬНО
```
VK_PARSER это НЕ:
  ❌ Отдельное приложение
  ❌ HTTP endpoint
  ❌ Функция с внешним callURL

VK_PARSER это:
  ✅ Набор функций в SERVER коде
  ✅ Вызывается напрямую: handleWallGet_(owner, count, token)
  ✅ Возвращает JSON
```

### ПРАВИЛО 5: ПОТОКИ = CLIENT → SERVER → DATA
```
ALL Запросы идут: CLIENT → SERVER → Обработка → CLIENT

Никогда:
  ❌ CLIENT → Gemini
  ❌ CLIENT → VK API
  ❌ CLIENT → VK_PARSER

Только:
  ✅ CLIENT → SERVER (POST /gm с ключом и prompt)
  ✅ SERVER обрабатывает (вызывает Gemini, VK, логирует)
  ✅ SERVER → CLIENT (результат)
```

---

## 📦 СТРУКТУРА ПОСЛЕ РЕФАКТОРИНГА

```
google-sheets-bound/
  ├── Main.gs                    (700 строк - ТОЛЬКО UI!)
  │   ├── onOpen()
  │   ├── onEdit()
  │   ├── showGmDialog()
  │   ├── showVkDialog()
  │   ├── callServer(action, data)  ← ЕДИНСТВЕННЫЙ способ вызвать SERVER!
  │   └── displayResults(data)
  │
  ├── shared/
  │   ├── SecurityValidator.gs   (используется везде)
  │   ├── LoggingService.gs      (логирование)
  │   ├── Utils.gs
  │   └── ...
  │
  └── old/
      ├── Main.txt
      ├── VK_PARSER.txt
      └── ...

web-app-server/
  ├── Server.gs                  (2000+ строк - ВСЯ логика!)
  │   ├── doPost(e)              ← главная функция
  │   │   ├── case 'gm'          → handleGm(data)
  │   │   ├── case 'import_vk'   → handleImportVk(data)
  │   │   ├── case 'check_license' → handleCheckLicense(data)
  │   │   └── case 'log'         → handleLog(data)
  │   │
  │   ├── Gemini Logic
  │   │   ├── callGemini(prompt, key)
  │   │   ├── cacheResult(key, result)
  │   │   └── getCachedResult(key)
  │   │
  │   ├── VK_PARSER Logic (встроено!)
  │   │   ├── handleWallGet_(owner, count, token)
  │   │   ├── handleParseAlbum_(url, token)
  │   │   ├── handleParseDiscussion_(url, token)
  │   │   └── handleParseReviews_(url, token)
  │   │
  │   ├── Database
  │   │   ├── validateLicense(email, token)
  │   │   └── updateQuotas(email)
  │   │
  │   └── Helpers
  │       ├── json_()
  │       ├── error()
  │       └── success()
  │
  ├── shared/
  │   ├── SecurityValidator.gs   (используется везде)
  │   ├── LoggingService.gs      (логирование)
  │   └── ...
  │
  └── old/
      ├── VK_PARSER.txt
      └── ...
```

---

## 🔨 ЭТАПЫ РЕФАКТОРИНГА

### ЭТАП 1: Подготовка shared/
```
✅ shared/ доступны везде
✅ Интегрировать SecurityValidator везде
✅ Интегрировать LoggingService везде
```

### ЭТАП 2: CLIENT очистка
```
❌ Удалить из CLIENT: GM(), валидация, логика
✅ Оставить только: UI (menus, dialogs, sheets)
✅ Добавить callServer(action, data) - ЕДИНСТВЕННЫЙ эндпоинт!

Примеры callServer():
  callServer('gm', {prompt: '...', key: '...', email: '...'})
  callServer('import_vk', {owner: '...', count: 10, email: '...'})
  callServer('check_license', {email: '...', token: '...'})
```

### ЭТАП 3: SERVER консолидация
```
✅ Создать doPost(e) с роутингом по action
✅ Скопировать VK_PARSER логику в SERVER
✅ Встроить Gemini вызовы в SERVER
✅ Встроить валидацию в SERVER
✅ Встроить логирование везде
```

### ЭТАП 4: Тестирование
```
✅ CLIENT отправляет → SERVER получает
✅ SERVER обрабатывает → CLIENT получает результат
✅ Логирование работает
✅ Валидация работает
✅ Лицензии проверяются
```

---

## ✅ SUCCESS CRITERIA

```
✅ CLIENT: 700 строк (только UI)
✅ SERVER: 2500+ строк (ВСЯ логика)
✅ Нет дублирования кода
✅ ВСЕ запросы через callServer()
✅ ВСЯ обработка на SERVER
✅ Никаких HTTP вызовов CLIENT → Gemini
✅ Никаких HTTP вызовов CLIENT → VK
✅ VK_PARSER встроено в SERVER (не отдельно)
✅ Логирование везде
✅ Лицензии проверяются
✅ Производительность сохранена
✅ Безопасность улучшена
```

---

## 🎓 ИТОГОВАЯ АРХИТЕКТУРА

```
TRINITY MODEL (ПРАВИЛЬНО):

┌─────────────────────────────────────────┐
│ 📱 CLIENT (Google Sheets Container)     │
│                                         │
│ • onOpen() → menu                       │
│ • showDialog() → user input             │
│ • callServer('gm', data)                │
│ • displayResults()                      │
│                                         │
│ Никакой логики, только UI!             │
└─────────────────────────────────────────┘
                  ↓
            HTTP POST
           (JSON payload)
                  ↓
┌─────────────────────────────────────────┐
│ 🌐 SERVER (Web App)                     │
│                                         │
│ doPost(e):                              │
│   • action = 'gm' → Gemini              │
│   • action = 'import_vk' → VK_PARSER    │
│   • action = 'check_license' → DB       │
│   • action = 'log' → LoggingService     │
│                                         │
│ VK_PARSER встроено внутри:              │
│   handleWallGet_()                      │
│   handleParseAlbum_()                   │
│   handleParseDiscussion_()              │
│   handleParseReviews_()                 │
│                                         │
│ ВСЯ логика, ВСЕ API вызовы             │
└─────────────────────────────────────────┘
                  ↓
         ┌────────┴────────┐
         ↓                 ↓
    Gemini API        VK API
   (с ключом)      (с VK_TOKEN)
   (от CLIENT)     (от SERVER)
```

### ПОЧЕМУ ЭТО РАБОТАЕТ:

1. **CLIENT отправляет только данные** - ключи + параметры
2. **SERVER обрабатывает все** - логика, безопасность, API вызовы
3. **Логика защищена** - находится на SERVER, не скопируется
4. **VK_PARSER встроено** - нет лишних HTTP вызовов
5. **Масштабируемо** - один SERVER может обслуживать много CLIENT'ов
6. **Безопасно** - SERVER может проверить лицензию перед выполнением

---

**Статус:** 📋 ГОТОВ К НЕМЕДЛЕННОЙ РЕАЛИЗАЦИИ

**Начинаем сейчас! 🚀**
