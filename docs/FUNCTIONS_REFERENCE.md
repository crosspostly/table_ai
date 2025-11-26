# 📚 Полный справочник функций Table AI Bot v3.0.0

## 📖 Оглавление

- [🎯 Клиентские функции (Client)](#-клиентские-функции-client)
  - [Gemini AI Functions](#gemini-ai-functions)
  - [Social Import Functions](#social-import-functions)
  - [Utility Functions](#utility-functions)
  - [UI Functions](#ui-functions)
- [🖥️ Серверные функции (Server)](#️-серверные-функции-server)
  - [API Endpoints](#api-endpoints)
  - [Social Import Services](#social-import-services)
  - [OCR Services](#ocr-services)
  - [License Services](#license-services)
- [🔗 Общие функции (Shared)](#-общие-функции-shared)
  - [Logging](#logging)
  - [Markdown Processing](#markdown-processing)
  - [A1 Notation Helpers](#a1-notation-helpers)

---

## 🎯 Клиентские функции (Client)

### Gemini AI Functions

#### `GM(prompt, maxTokens, temperature)`
**Основная функция для вызова Gemini API**

**Параметры:**
- `prompt` (string, обязательный) - текст промпта для AI
- `maxTokens` (number, optional) - максимум токенов ответа (по умолчанию 250000)
- `temperature` (number, optional) - температура генерации (по умолчанию 0.7)

**Возвращает:** string - ответ от Gemini AI

**Логика работы:**
1. Валидирует промпт (не пустой, строка, до 500к символов)
2. Проверяет кэш (ключ = SHA256(prompt+maxTokens+temp))
3. Если в кэше - возвращает мгновенно
4. Иначе - делает запрос к Gemini API с retry логикой
5. Автоматически преобразует Markdown в удобочитаемый формат
6. Сохраняет результат в кэш (TTL 5 минут)
7. Логирует все операции

**Пример использования:**
```javascript
=GM("Проанализируй текст: " & A2, 2000, 0.7)
```

**Особенности:**
- ✅ Многоуровневое кэширование (ScriptCache + Properties)
- ✅ Автоматическая обработка Markdown
- ✅ Retry логика при сбоях
- ✅ Подробное логирование

---

#### `GM_STATIC(prompt, maxTokens, temperature)`
**Статическая версия GM - автозамена формулы на результат**

**Параметры:** Идентичны `GM()`

**Возвращает:** string - ответ от Gemini AI

**Логика работы:**
1. Выполняет все шаги функции `GM()`
2. **КРИТИЧНО:** После получения ответа заменяет формулу на статичное значение
3. Это предотвращает повторные API вызовы при пересчете таблицы

**Пример использования:**
```javascript
=GM_STATIC("Создай краткое описание: " & A2)
```

**Когда использовать:**
- ✅ Для контента который не нужно обновлять
- ✅ Для экономии API квот
- ✅ Для ускорения работы таблицы
- ❌ НЕ использовать для динамических данных

---

#### `GM_IF(condition, prompt, maxTokens, temperature)`
**Условный вызов Gemini - обрабатывает только при выполнении условия**

**Параметры:**
- `condition` (any) - условие запуска (boolean, number, string)
- `prompt` (string) - промпт для AI
- `maxTokens` (number, optional) - максимум токенов
- `temperature` (number, optional) - температура

**Возвращает:** string - ответ от Gemini или пустая строка

**Логика работы:**
1. Нормализует условие в boolean:
   - `true` / не-0 число / непустая строка → true
   - `false` / 0 / "false" / "0" / "no" / "нет" → false
2. Если условие истинно - вызывает `GM()`
3. Иначе возвращает пустую строку

**Пример использования:**
```javascript
=GM_IF($A3<>"", "Обработай данные из A3: " & A3, 5000, 0.8)
=GM_IF(LEN(B3)>100, "Сократи текст: " & B3, 1000, 0.5)
```

**Умные цепочки:**
```javascript
// B3 зависит от A3
=GM_IF($A3<>"", Prompt_box!$F$2)

// C3 зависит от готовности B3
=GM_IF(LEFT(B3, LEN("Отчёт готов"))="Отчёт готов", Prompt_box!$F$3)
```

---

#### `GM_IF_STATIC(condition, prompt, maxTokens, temperature)`
**Условный статический вызов - комбинация GM_IF + GM_STATIC**

**Параметры:** Идентичны `GM_IF()`

**Логика работы:**
1. Проверяет условие
2. Если true - вызывает `GM_STATIC()` (с автозаменой на статику)
3. Иначе возвращает пустую строку

**Пример использования:**
```javascript
=GM_IF_STATIC(COUNTIF($A$2:$A$100, ">0")>10, "Проанализируй тренды", 3000, 0.7)
```

---

### Social Import Functions

#### `importSocialPosts()`
**Универсальный импорт постов из социальных сетей**

**Параметры:** Нет (читает из листа "Параметры")

**Логика работы:**
1. Проверяет наличие листа "Параметры"
2. Читает параметры:
   - `B1` - источник (URL или username) - для VK используется как owner
   - `B2` - количество постов (1-100)
   - `C1` - платформа (опционально)
3. Определяет платформу автоматически или по C1
4. Вызывает соответствующий парсер:
   - Instagram: прямой API запрос
   - VK: через VK API с access token
   - Telegram: RSS → Web preview → Embed (fallback)
5. Создает/очищает лист "посты"
6. Записывает результаты с колонками:
   - A: Платформа
   - B: Дата
   - C: Ссылка
   - D: Текст
   - E-J: Столбцы для фильтрации и анализа
7. Автоматически создает формулы фильтрации по стоп-словам и позитивным словам

**Поддерживаемые форматы источников:**

**Instagram:**
```
https://instagram.com/username
https://www.instagram.com/username  
instagram.com/username
username (+ C1="инста")
```

**VK:**
```
https://vk.com/username
-12345678 (ID группы - ОТРИЦАТЕЛЬНЫЙ)
12345678 (ID страницы)
@username
username (+ C1="вк")
```

**Telegram:**
```
https://t.me/channel
t.me/channel
@channel
channel (+ C1="тг")
```

**Фильтрация постов:**

После импорта автоматически создаются:

1. **Столбцы E-G (Стоп-слова):**
   - E: Список стоп-слов (каждое в отдельной ячейке)
   - F: Отфильтрованные посты (формула скрывает посты со стоп-словами)
   - G: Новая нумерация (только непустых постов из F)

2. **Столбцы H-J (Позитивные слова):**
   - H: Список позитивных слов
   - I: Посты с позитивными словами (формула показывает только их)
   - J: Нумерация позитивных постов

**Формулы фильтрации:**

```javascript
// F2 - проверяет пост D2 против ВСЕХ стоп-слов в E2:E100
=IF(SUMPRODUCT(--(ISNUMBER(SEARCH($E$2:$E$100, D2)))*($E$2:$E$100<>"")) > 0, "", D2)

// G2 - нумерует только непустые F
=IF(F2<>"", COUNTA(F$2:F2), "")

// I2 - показывает пост только если есть хотя бы одно позитивное слово
=IF(SUMPRODUCT(--(ISNUMBER(SEARCH($H$2:$H$100, D2)))*($H$2:$H$100<>"")) > 0, D2, "")

// J2 - нумерует посты с позитивными словами
=IF(I2<>"", COUNTA(I$2:I2), "")
```

**Пример использования:**

1. Создайте лист "Параметры":
```
| A             | B                           | C        |
|---------------|-----------------------------|----------|
| Источник:     | https://instagram.com/nasa  |          |
| Количество:   | 20                          |          |
| VK Token:     | (для VK обязательно)        |          |
```

2. Запустите через меню: 🤖 Table AI → 📱 Получить VK посты

3. Для фильтрации:
   - В столбце E укажите стоп-слова (консультация, психолог, и т.д.)
   - В столбце H укажите позитивные слова (успех, рост, и т.д.)
   - Формулы автоматически отфильтруют посты

**Обработка ошибок:**
- ❌ "Лист Параметры не найден" → создайте лист
- ❌ "Источник не указан" → заполните B1
- ❌ "Платформа не распознана" → укажите C1 или используйте полную ссылку https://
- ❌ "VK_TOKEN не настроен" → свяжитесь с администратором (токен настраивается на сервере)
- ❌ "Instagram API unavailable" → подождите 1-2 часа

---

#### `importVkPosts()` 
**Алиас для `importSocialPosts()` - обратная совместимость**

Вызывает `importSocialPosts()` для импорта из любой соцсети.

---

### Utility Functions

#### `checkLicenseStatusUI()`
**Проверка статуса лицензии с отображением в UI**

**Параметры:** Нет

**Логика работы:**
1. Получает credentials из Script Properties
2. Делает запрос к серверу: `{action: 'check_license', email, token}`
3. Получает данные лицензии:
   - valid: активна ли
   - expiresAt: дата истечения
   - requestsThisHour: использовано запросов
   - hourlyLimit: лимит запросов
   - totalRequests: всего запросов
4. Показывает красивый диалог с информацией

**Пример использования:**
Меню → ⚙️ Настройки → 📊 Проверить статус лицензии

---

#### `setLicenseCredentialsUI()`
**Настройка email и токена лицензии через UI**

**Параметры:** Нет

**Логика работы:**
1. Показывает prompt для ввода email
2. Показывает prompt для ввода токена
3. Сохраняет в Script Properties:
   - `LICENSE_EMAIL`
   - `LICENSE_TOKEN`
4. Показывает подтверждение

**Пример использования:**
Меню → ⚙️ Настройки → 🔐 Лицензия: Email + Токен

---

#### `initGeminiKey()`
**Настройка Gemini API ключа**

**Параметры:** Нет

**Логика работы:**
1. Показывает prompt с инструкцией получения ключа
2. Сохраняет в Script Properties: `GEMINI_API_KEY`
3. Показывает подтверждение

**Где получить ключ:**
https://aistudio.google.com/app/apikey

---
```
B3: "Отчёт готов: данные проанализированы..." → C3 запускается
C3: "Еще обрабатываю..." → D3 НЕ запускается
```

---

#### `clearChainForA3()`
**Очистка формул автоцепочки B3:G3**

**Параметры:** Нет

**Логика работы:**
1. Находит лист "Распаковка"
2. Очищает диапазон B3:G3
3. Показывает подтверждение

**Когда использовать:**
- Цепочка "зависла"
- Нужно начать заново
- Ошибка в формулах

---

#### `cleanupOldTriggers()`
**Удаление устаревших триггеров**

**Параметры:** Нет

**Логика работы:**
1. Получает все триггеры проекта: `ScriptApp.getProjectTriggers()`
2. Удаляет триггеры:
   - `checkStepCompletion`
   - `continueAutoProcessingChain`
3. Оставляет базовые:
   - `onEdit`
   - `onOpen`
4. Показывает статистику: "Удалено X триггеров"

**Когда использовать:**
- Триггеры накопились и замедляют работу
- Цепочки работают некорректно
- После отладки

---

#### `showActiveTriggersDialog()`
**Показать список всех активных триггеров**

**Параметры:** Нет

**Логика работы:**
1. Получает триггеры: `ScriptApp.getProjectTriggers()`
2. Форматирует список:
   ```
   1. onEdit (ON_EDIT)
   2. checkStepCompletion (CLOCK)
   3. onOpen (ON_OPEN)
   ```
3. Показывает в диалоге

**Для диагностики проблем с автоматизацией**

---

#### `refreshCurrentGMCell()`
**Принудительный пересчет GM формулы в выбранной ячейке**

**Параметры:** Нет (работает с активной ячейкой)

**Логика работы:**
1. Получает активную ячейку: `SpreadsheetApp.getActiveRange()`
2. Проверяет что это формула `=GM(` или `=GM_STATIC(` или `=GM_IF(`
3. Очищает ячейку
4. Ждет flush: `SpreadsheetApp.flush()`
5. Заново вставляет формулу → форсирует пересчет

**Когда использовать:**
- Ответ "завис"
- Нужен свежий результат
- Кэш устарел

---

### OCR Functions

#### `ocrRun()` (OCR V2)
**OCR обработка отзывов из изображений**

**Параметры:** Нет (работает с листом "Отзывы")

**Логика работы:**

**1. Подготовка:**
- Находит лист "Отзывы"
- Проверяет настройку overwrite (перезаписывать ли существующие)

**2. Для каждой строки (начиная с 2):**
- Читает ячейку A (источник изображения)
- Пропускает если пустая
- Проверяет B (результат) - если заполнен и overwrite=false, пропускает
- Извлекает источники из ячейки:
  - Formula (IMAGE, HYPERLINK)
  - Rich text links
  - Прямые URL в тексте

**3. Поддерживаемые источники:**

a) **Формула IMAGE():**
```javascript
=IMAGE("https://example.com/image.jpg")
→ Извлекается URL из формулы
```

b) **Rich Text с изображением:**
```
Пользователь вставил изображение копипастом
→ Извлекается URL из richText.getLinkUrl()
```

c) **Прямая ссылка:**
```
https://vk.com/photo123_456
→ Используется напрямую
```

d) **Поддерживаемые CDN:**
- VK: `sun*-*.userapi.com`, `vk.com/photo`
- Yandex.Disk: `downloader.disk.yandex.ru`
- Dropbox: `dl.dropboxusercontent.com`
- Google Drive: `drive.google.com/uc?id=`

**4. OCR обработка:**
- Отправляет запрос к серверу:
  ```javascript
  {
    action: 'ocr_process',
    email: credentials.email,
    token: credentials.token,
    geminiApiKey: credentials.apiKey,
    cellData: displayValue,
    cellMeta: {formula, richTextUrl},
    options: {limit: 50, language: 'ru'}
  }
  ```
- Сервер использует Gemini Vision API для OCR
- Возвращает массив извлеченных текстов

**5. Запись результатов:**
- Если 1 результат → записывает в B
- Если несколько → вставляет дополнительные строки и записывает все

**6. Итоговая статистика:**
```
OCR Complete:
Processed: 15
Skipped: 3
Errors: 2
```

**Настройка перезаписи:**
```javascript
// В Script Properties
OCR_OVERWRITE = "true"  // Перезаписывать существующие
OCR_OVERWRITE = "false" // Пропускать существующие (по умолчанию)
```

**Пример использования:**

1. Создайте лист "Отзывы"
2. В колонку A добавьте:
   - Ссылки на изображения
   - Формулы IMAGE()
   - Вставьте изображения напрямую
3. Запустите: Меню → 💬 Анализ отзывов
4. Результаты появятся в колонке B

---

## 🖥️ Серверные функции (Server)

### API Endpoints

#### `doPost(e)`
**Главный API endpoint для обработки POST запросов**

**Параметры:**
- `e` - объект события от Google Apps Script

**Логика работы:**

1. **Парсинг запроса:**
```javascript
var data = JSON.parse(e.postData.contents);
// Ожидаемые поля:
// - action: тип операции
// - email: email лицензии
// - token: токен лицензии
// - ...дополнительные параметры
```

2. **Валидация credentials:**
```javascript
if (!data.email || !data.token) {
  return errorResponse('Missing credentials');
}
```

3. **Роутинг по action:**
```javascript
switch(data.action) {
  case 'social_import':
    return handleSocialImport(data);
  case 'ocr_process':
    return handleOcrProcess(data);
  case 'check_license':
    return handleLicenseCheck(data);
  case 'gm':
    return handleGeminiRequest(data);
  default:
    return errorResponse('Unknown action');
}
```

4. **Обработка ошибок:**
- Try-catch на всех уровнях
- User-friendly error messages
- Подробное логирование
- Трейсинг запросов

**Формат ответа:**
```javascript
// Успех
{
  ok: true,
  data: {...},
  traceId: 'req-123456',
  platform: 'instagram' // для social_import
}

// Ошибка  
{
  ok: false,
  error: 'User-friendly error message',
  details: 'Technical details',
  traceId: 'req-123456'
}
```

---

#### `doGet(e)`
**Health check endpoint**

**Параметры:**
- `e` - объект события

**Логика работы:**
1. Проверяет доступность всех сервисов
2. Возвращает статус системы:
```javascript
{
  status: 'healthy',
  version: '2.0',
  timestamp: new Date().toISOString(),
  services: {
    socialImport: 'ok',
    ocr: 'ok',
    gemini: 'ok',
    license: 'ok'
  }
}
```

**Использование:**
```bash
curl https://script.google.com/macros/s/YOUR_ID/exec
```

---

### Smart Chain Services

#### `prepareChainSmart()`
**Умная подготовка цепочки обработки**

**Параметры:** Нет

**Логика работы:**

1. **Проверка источника конфигурации:**
```javascript
var promptBox = ss.getSheetByName('Prompt_box');
if (promptBox && hasTargets(promptBox)) {
  prepareChainFromPromptBox();
} else {
  prepareChainForA3();
}
```

2. **Режим A: Prompt_box (гибкий):**
- Читает цели из Prompt_box!B (B2, B3, B4...)
- Каждая ячейка содержит A1 notation целевой ячейки (например "C5")
- Читает промпты из Prompt_box!F (F2, F3, F4...)
- Создает формулы с зависимостями:
  ```javascript
  // Первая ячейка - зависит от A3
  =GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)
  
  // Вторая - зависит от фразы готовности в первой
  =GM_IF(LEFT(B3,LEN("Отчёт готов"))="Отчёт готов", Prompt_box!$F$3, 25000, 0.7)
  ```

3. **Режим B: Фиксированная цепочка A3→B3→...→G3:**
- Якорь: A3 заполнен
- Формулы: B3, C3, D3, E3, F3, G3
- Каждая следующая ждет фразу готовности в предыдущей
- Промпты из Prompt_box!F2, F3, F4, F5, F6, F7

**Преимущества Prompt_box:**
- Гибкие цели (можно в любые ячейки)
- Централизованное управление промптами
- Легко модифицировать логику

**Преимущества фиксированной цепочки:**
- Простота
- Предсказуемость
- Меньше настроек

---

#### `prepareChainForA3()`
**Создание фиксированной цепочки A3→B3→...→G3**

**Параметры:** Нет

**Логика работы:**

1. **Структура цепочки:**
```javascript
A3: исходные данные (триггер)
↓
B3: =GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)
↓ (ждем "Отчёт готов")
C3: =GM_IF(LEFT(B3,LEN("Отчёт готов"))="Отчёт готов", Prompt_box!$F$3, ...)
↓ (ждем "Отчёт готов")
D3: =GM_IF(LEFT(C3,LEN("Отчёт готов"))="Отчёт готов", Prompt_box!$F$4, ...)
↓
E3, F3, G3: аналогично
```

2. **Алгоритм:**
```javascript
var phrase = getCompletionPhrase() || COMPLETION_PHRASE;
var phraseEscaped = phrase.replace(/"/g, '""');

var formulas = [
  // B3 - зависит от A3
  '=GM_IF($A3<>"", Prompt_box!$F$2, 25000, 0.7)',
  
  // C3 - зависит от готовности B3
  '=GM_IF(LEFT(B3,LEN("' + phraseEscaped + '"))="' + phraseEscaped + '", Prompt_box!$F$3, 25000, 0.7)',
  
  // D3-G3: аналогично
  // ...
];

for (var i = 0; i < formulas.length; i++) {
  sheet.getRange(3, i + 2).setFormula(formulas[i]); // Колонки B-G (2-7)
}
```

3. **Настройка Prompt_box:**
```
| A | B           | C | D | E | F (промпты)                          |
|---|-------------|---|---|---|--------------------------------------|
| 1 | (заголовок) | . | . | . | (заголовок)                          |
| 2 | B3          | . | . | . | Первичный анализ данных из A3        |
| 3 | C3          | . | . | . | Детальный разбор результатов B3      |
| 4 | D3          | . | . | . | Создание выводов на основе C3        |
| 5 | E3          | . | . | . | Рекомендации по результатам D3       |
| 6 | F3          | . | . | . | Финальный отчёт со всеми данными    |
| 7 | G3          | . | . | . | Краткое резюме для руководства       |
```

**Когда цепочка запускается:**
1. Пользователь заполняет A3
2. B3 автоматически запускается (условие `$A3<>""`)
3. Gemini обрабатывает и возвращает ответ начиная с "Отчёт готов: ..."
4. C3 видит фразу готовности и запускается
5. И так далее до G3

**Ручной запуск:**
Меню → 🚀 Запустить анализ

---

## 🔗 Общие функции (Shared)

### Logging

#### `addSystemLog(message, level, tag)`
**Централизованное логирование всех операций**

**Параметры:**
- `message` (string) - текст сообщения
- `level` (string) - уровень: DEBUG, INFO, WARN, ERROR, CRITICAL
- `tag` (string) - категория: GEMINI, VK_IMPORT, OCR, LICENSE, SYSTEM

**Логика работы:**

1. **Создание записи лога:**
```javascript
var logEntry = {
  timestamp: Utilities.formatDate(new Date(), 'Europe/Moscow', 'yyyy-MM-dd HH:mm:ss'),
  level: level,
  tag: tag,
  message: message,
  traceId: getCurrentTraceId() // Для связывания операций
};
```

2. **Хранение (многоуровневое):**

**Level 1: ScriptCache (быстрый, 5 мин):**
```javascript
var cache = CacheService.getScriptCache();
var logs = JSON.parse(cache.get(LOGS_CACHE_KEY) || '[]');
logs.push(logEntry);
if (logs.length > MAX_LOGS) logs.shift(); // Ротация
cache.put(LOGS_CACHE_KEY, JSON.stringify(logs), LOGS_TTL);
```

**Level 2: Console (для debugging):**
```javascript
console.log('[' + level + '] [' + tag + '] ' + message);
```

**Level 3: Properties (долгосрочное хранение ошибок):**
```javascript
if (level === 'ERROR' || level === 'CRITICAL') {
  PropertiesService.getScriptProperties().setProperty(
    'last_error_' + Date.now(),
    JSON.stringify(logEntry)
  );
}
```

3. **Уровни важности:**
- `DEBUG` - детальная отладочная информация
- `INFO` - обычные операции
- `WARN` - предупреждения (не критично)
- `ERROR` - ошибки (требуют внимания)
- `CRITICAL` - критические сбои (система неработоспособна)

**Примеры использования:**
```javascript
addSystemLog('→ GM: prompt=123', 'INFO', 'GEMINI');
addSystemLog('✅ OCR success: row=5', 'INFO', 'OCR');
addSystemLog('⚠️ Rate limit approaching', 'WARN', 'LICENSE');
addSystemLog('❌ VK API failed', 'ERROR', 'VK_IMPORT');
addSystemLog('🚨 Database corrupted', 'CRITICAL', 'SYSTEM');
```

---

#### `getLogs(limit)`
**Получение последних логов**

**Параметры:**
- `limit` (number, optional) - количество логов (по умолчанию 50)

**Возвращает:** string - форматированные логи

**Логика работы:**
```javascript
var cache = CacheService.getScriptCache();
var logs = JSON.parse(cache.get(LOGS_CACHE_KEY) || '[]');
var recent = logs.slice(-limit);

return recent.map(function(entry) {
  return '[' + entry.timestamp + '] ' + entry.level + ' [' + entry.tag + ']: ' + entry.message;
}).join('\\n');
```

**Использование:**
```javascript
var last20 = getLogs(20);
console.log(last20);
```

---

#### `exportSystemLogsToSheet()`
**Экспорт логов в лист "Логи"**

**Параметры:** Нет

**Логика работы:**

1. Получает все логи из кэша
2. Создает/очищает лист "Логи"
3. Записывает с заголовками:
```
| Время              | Уровень | Тег      | Сообщение           |
|--------------------|---------|----------|---------------------|
| 2025-10-08 12:30:45| INFO    | GEMINI   | → GM: prompt=...    |
| 2025-10-08 12:30:47| ERROR   | VK_IMPORT| ❌ VK API failed     |
```
4. Форматирует (жирные заголовки, автоширина колонок)
5. Цветное кодирование по уровню:
   - DEBUG: серый
   - INFO: белый
   - WARN: желтый
   - ERROR: оранжевый
   - CRITICAL: красный

---

### Markdown Processing

#### `processGeminiResponse(response)`
**Автоматическое преобразование Markdown в удобочитаемый текст**

**Параметры:**
- `response` (string) - ответ от Gemini

**Возвращает:** string - обработанный текст

**Логика работы:**

1. **Проверка наличия Markdown:**
```javascript
function isMarkdownText(text) {
  var patterns = [
    /\\*\\*[^*]+\\*\\*/,    // **bold**
    /\\*[^*]+\\*/,        // *italic*
    /^#{1,6}\\s+/m,     // # headers
    /^[-*+]\\s+/m,      // - lists
    /\\[.+\\]\\(.+\\)/,   // [links](url)
    /```[\\s\\S]*?```/, // ```code```
    /`[^`]+`/           // `inline`
  ];
  return patterns.some(p => p.test(text));
}
```

2. **Преобразования:**

**Блоки кода:**
```javascript
// ```javascript\ncode\n``` → \ncode\n
text = text.replace(/```[\\w]*\\n?([\\s\\S]*?)\\n?```/g, function(match, code) {
  return '\\n' + code.trim() + '\\n';
});
```

**Инлайн код:**
```javascript
// `code` → code
text = text.replace(/`([^`]+)`/g, '$1');
```

**Жирный текст:**
```javascript
// **text** → TEXT (ЗАГЛАВНЫМИ)
text = text.replace(/\\*\\*([^*]+)\\*\\*/g, function(match, content) {
  return content.toUpperCase();
});
```

**Курсив:**
```javascript
// *text* → text (убираем звездочки)
text = text.replace(/\\*([^*]+)\\*/g, '$1');
```

**Заголовки:**
```javascript
// # Header → HEADER:
text = text.replace(/^#{1,6}\\s+(.+)$/gm, function(match, heading) {
  return '\\n' + heading.toUpperCase() + ':\\n';
});
```

**Списки:**
```javascript
// - item → 1. item (нумерация)
var lines = text.split('\\n');
var listCounter = 0;
lines = lines.map(function(line) {
  if (line.trim().match(/^[-*+]\\s+/)) {
    listCounter++;
    return line.replace(/^(\\s*)[-*+]\\s+/, '$1' + listCounter + '. ');
  }
  return line;
});
text = lines.join('\\n');
```

**Ссылки:**
```javascript
// [text](url) → text
text = text.replace(/\\[([^\\]]+)\\]\\([^)]+\\)/g, '$1');
```

3. **Очистка:**
```javascript
// Убираем лишние переносы (больше 2 подряд)
text = text.replace(/\\n{3,}/g, '\\n\\n');

// Trim
text = text.trim();
```

**Пример:**

**До:**
```markdown
# Отчёт готов

## Анализ данных

**Основные выводы:**
- Метрика A: `+25%`
- Метрика B: *снижение*

### Рекомендации
1. Увеличить **инвестиции**
2. Оптимизировать процесс

[Подробнее](https://example.com)
```

**После:**
```
ОТЧЁТ ГОТОВ:

АНАЛИЗ ДАННЫХ:

ОСНОВНЫЕ ВЫВОДЫ:
1. Метрика A: +25%
2. Метрика B: снижение

РЕКОМЕНДАЦИИ:
1. Увеличить ИНВЕСТИЦИИ
2. Оптимизировать процесс

Подробнее
```

**Автоматическое применение:**
- Все GM функции автоматически применяют `processGeminiResponse()`
- OCR результаты также обрабатываются
- Можно отключить через настройку `DISABLE_MARKDOWN_PROCESSING`

---

### A1 Notation Helpers

#### `parseTargetA1(a1String)`
**Парсинг A1 notation в координаты**

**Параметры:**
- `a1String` (string) - A1 notation (например "C5", "AA10")

**Возвращает:**
```javascript
{
  row: number,    // Номер строки (1-based)
  col: number,    // Номер колонки (1-based)
  a1: string,     // Исходная A1 notation с $ префиксами
  colLetter: string // Буква колонки
}
```

**Логика работы:**
```javascript
// Примеры: "C5" → {row:5, col:3, a1:"$C$5", colLetter:"C"}
//          "AA10" → {row:10, col:27, a1:"$AA$10", colLetter:"AA"}

var match = a1String.match(/^([A-Z]+)(\\d+)$/);
if (!match) throw new Error('Invalid A1 notation: ' + a1String);

var colLetter = match[1];
var row = parseInt(match[2]);
var col = letterToColumn(colLetter);

return {
  row: row,
  col: col,
  a1: '$' + colLetter + '$' + row,
  colLetter: colLetter
};
```

---

#### `columnToLetter(columnNumber)`
**Преобразование номера колонки в букву**

**Параметры:**
- `columnNumber` (number) - номер колонки (1-based)

**Возвращает:** string - буквенное обозначение

**Логика работы:**
```javascript
// 1→A, 2→B, ..., 26→Z, 27→AA, 28→AB, ...

var letter = '';
while (columnNumber > 0) {
  var remainder = (columnNumber - 1) % 26;
  letter = String.fromCharCode(65 + remainder) + letter;
  columnNumber = Math.floor((columnNumber - 1) / 26);
}
return letter;
```

**Примеры:**
```javascript
columnToLetter(1)   // "A"
columnToLetter(26)  // "Z"
columnToLetter(27)  // "AA"
columnToLetter(702) // "ZZ"
columnToLetter(703) // "AAA"
```

---

#### `letterToColumn(columnLetter)`
**Преобразование буквы колонки в номер**

**Параметры:**
- `columnLetter` (string) - буквенное обозначение

**Возвращает:** number - номер колонки (1-based)

**Логика работы:**
```javascript
// A→1, B→2, ..., Z→26, AA→27, AB→28, ...

var column = 0;
for (var i = 0; i < columnLetter.length; i++) {
  column = column * 26 + (columnLetter.charCodeAt(i) - 64);
}
return column;
```

**Примеры:**
```javascript
letterToColumn("A")    // 1
letterToColumn("Z")    // 26
letterToColumn("AA")   // 27
letterToColumn("ZZ")   // 702
letterToColumn("AAA")  // 703
```

---

## 📊 Полная карта взаимодействия функций

```
┌─────────────────────────────────────────────────────────────┐
│                         ПОЛЬЗОВАТЕЛЬ                         │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    ┌────▼─────┐          ┌─────▼──────┐
    │   МЕНЮ   │          │  ФОРМУЛЫ   │
    │ (Menu.gs)│          │  В ЯЧЕЙКАХ │
    └────┬─────┘          └─────┬──────┘
         │                      │
         │     ┌────────────────┘
         │     │
    ┌────▼─────▼──────────────────────────────────────────────┐
    │              КЛИЕНТСКИЕ ФУНКЦИИ                         │
    │  ┌──────────────────────────────────────────────────┐   │
    │  │ GM Functions (GeminiClient.gs)                   │   │
    │  │  • GM() - основной вызов Gemini                  │   │
    │  │  • GM_STATIC() - с автозаменой на статику        │   │
    │  │  • GM_IF() - условный вызов                      │   │
    │  │  • GM_IF_STATIC() - условный статический         │   │
    │  └────────────┬─────────────────────────────────────┘   │
    │               │                                          │
    │  ┌────────────▼─────────────────────────────────────┐   │
    │  │ Utilities (ClientUtilities.gs)                   │   │
    │  │  • Caching (gmCacheKey_, gmCacheGet_)            │   │
    │  │  • Markdown Processing (processGeminiResponse)   │   │
    │  │  • License Management (checkLicenseStatusUI)     │   │
    │  │  • Smart Prompts (setupSmartPromptTrigger)       │   │
    │  │  • Chat Mode (initializeChatMode)                │   │
    │  └────────────┬─────────────────────────────────────┘   │
    │               │                                          │
    │  ┌────────────▼─────────────────────────────────────┐   │
    │  │ ThinClient (ThinClient.gs)                       │   │
    │  │  • callServer() - HTTP client                    │   │
    │  │  • importVkPostsThin() - VK proxy                │   │
    │  └──────────────────────────────────────────────────┘   │
    └──────────────────────┬───────────────────────────────────┘
                           │ HTTPS POST
                           │
    ┌──────────────────────▼───────────────────────────────────┐
    │              СЕРВЕРНЫЕ ФУНКЦИИ                           │
    │  ┌──────────────────────────────────────────────────┐    │
    │  │ API Gateway (ServerEndpoints.gs)                 │    │
    │  │  • doPost() - routing                            │    │
    │  │  • doGet() - health check                        │    │
    │  └────────────┬─────────────────────────────────────┘    │
    │               │                                           │
    │  ┌────────────▼─────────────────────────────────────┐    │
    │  │ Social Import (SocialImportService.gs)           │    │
    │  │  • importSocialPosts()                           │    │
    │  │  • Instagram/VK/Telegram handlers                │    │
    │  │  • Retry logic (RetryService.gs)                 │    │
    │  │  • Validation (ValidationService.gs)             │    │
    │  └────────────┬─────────────────────────────────────┘    │
    │               │                                           │
    │  ┌────────────▼─────────────────────────────────────┐    │
    │  │ OCR Service (OcrService.gs)                      │    │
    │  │  • processOcrBatch()                             │    │
    │  │  • Gemini Vision API integration                 │    │
    │  │  • Source detection (SourceDetector.gs)          │    │
    │  └────────────┬─────────────────────────────────────┘    │
    │               │                                           │
    │  ┌────────────▼─────────────────────────────────────┐    │
    │  │ License Service (LicenseService.gs)              │    │
    │  │  • validateLicense()                             │    │
    │  │  • checkRateLimit()                              │    │
    │  │  • trackUsage()                                  │    │
    │  └────────────┬─────────────────────────────────────┘    │
    │               │                                           │
    │  ┌────────────▼─────────────────────────────────────┐    │
    │  │ Smart Chains (SmartChainService.gs)              │    │
    │  │  • prepareChainSmart()                           │    │
    │  │  • prepareChainForA3()                           │    │
    │  │  • prepareChainFromPromptBox()                   │    │
    │  └──────────────────────────────────────────────────┘    │
    └───────────────────────────────────────────────────────────┘
                           │
                           ▼
                    ВНЕШНИЕ API:
                    • Gemini AI API
                    • Instagram API
                    • VK API
                    • Telegram RSS/Web
```

---

## 🎯 Краткий справочник по использованию

### Быстрый старт с Gemini:
```javascript
// Простой вызов
=GM("Проанализируй данные: " & A2)

// Статический (без пересчета)
=GM_STATIC("Создай описание продукта")

// Условный
=GM_IF(A2<>"", "Обработай: " & A2)
```

### Импорт из соцсетей:
1. Создайте лист "Параметры"
2. B1: URL источника
3. B2: количество постов
4. Меню → Импорт постов

### OCR отзывов:
1. Создайте лист "Отзывы"
2. В колонку A: ссылки/IMAGE()/изображения
3. Меню → Анализ отзывов

### Умные цепочки:
1. Заполните Prompt_box (промпты в F2-F7)
2. Меню → Запустить анализ
3. Заполните A3 → автоматически B3→C3→...→G3

---

**Версия документа:** 2.1.0  
**Дата обновления:** 2025-10-12  
**Статус:** ✅ Production Ready
