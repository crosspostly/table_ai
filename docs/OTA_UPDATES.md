# OTA (Over-The-Air) Обновления - Полное руководство

## 📌 Что это?

**OTA система** автоматически обновляет код на клиентских таблицах через Apps Script API.

- ✅ Нет необходимости вручную обновлять каждую копию
- ✅ Обновления распространяются ночью в 3:00
- ✅ Пользователи ничего не делают - всё автоматически
- ✅ Откатки версий поддерживаются

---

## 🔄 Процесс обновления

### Шаг 1: Разработка новой версии

```
# Разработчик:
1. Изменяет код в /deploy/ папке
2. Тестирует локально
3. Увеличивает SERVER_VERSION в server.gs
   const SERVER_VERSION = '3.1.0' → '3.1.1'
4. Commitит в main ветку
   git push origin main
```

### Шаг 2: Сервер скачивает новый код

```
# На GitHub репозитории:
1. SERVER_VERSION = '3.1.1' в deploy/server.gs
2. Все файлы обновлены в /deploy/
3. Готово для OTA!
```

### Шаг 3: Клиент проверяет обновления

```
# Каждый клиент (ночью в 3:00):
1. checkForUpdatesBackground_() запускается
2. Отправляет: {action: 'ota', subaction: 'checkUpdates'}
3. Сервер сравнивает: CLIENT_VERSION vs SERVER_VERSION
4. Если новая версия → запрашивает файлы
```

### Шаг 4: Сервер обновляет клиента

```
# Сервер:
1. Скачивает файлы с GitHub
2. Отправляет клиенту (12 файлов)
3. Клиент просит: "Обнови мой код"
4. Сервер → Apps Script API → Обновляет скрипт
5. ✅ Готово!
```

---

## 🎯 Для разработчика: Как выпустить обновление

### 1. Разработай новую фичу

```
git checkout -b feature/new-feature
# ... разработка ...
git add deploy/
git commit -m "Add new feature X"
```

### 2. Обнови версию

```
# deploy/server.gs, строка ~12
const SERVER_VERSION = '3.1.1';  // ← увеличена с 3.1.0
```

### 3. Коммитнись и пушни

```
git add deploy/server.gs
git commit -m "Release v3.1.1"
git push origin main
```

### 4. Deploy сервера

```
# В Apps Script сервера:
clasp deploy --server

# Или в UI:
# Extensions → Apps Script → Deploy → New deployment
```

### 5. ✅ Готово!

```
Все клиенты автоматически получат обновление ночью в 3:00
```

---

## 🎯 Для пользователя: Как обновиться

### Автоматическое обновление (рекомендуется)

```
✅ Триггер создается автоматически при первом открытии
✅ Каждую ночь в 3:00 система проверяет обновления
✅ Если есть → автоматически обновляется
✅ Ты ничего не делаешь!
```

### Ручное обновление

```
1. Открываешь меню: 🤖 Table AI
2. Нажимаешь: 🔄 Автообновление
3. Система проверяет триггер (создает если нет)
4. Проверяет обновления
5. Если есть → "Обновить?" → YES
6. ✅ Готово!
```

---

## 🔍 Отладка OTA

### Включи DEV режим

```
// Main.gs, строка ~50
const DEV_MODE = true;
```

### Посмотри логи

```
Extensions → Apps Script → Logs
🔽 нажми → последние события выше
```

### Типовые сообщения в логах

```
✅ ОК:
- "🌙 Background update check started"
- "✅ Version is up to date: 3.1.1"
- "🚀 Updating to version 3.1.1"
- "✅ Update applied by server"
- "🎉 Update completed successfully!"

❌ ПРОБЛЕМА:
- "❌ License check failed: NOT_FOUND"
  → Проверь email и token
  
- "❌ Failed to get files: unknown"
  → Проблема с GitHub (может быть rate limit)
  
- "❌ Update error: Script ID not found"
  → Проверь что scriptId в Bindings листе
```

### Отладочная функция

```
// Extensions → Apps Script → Console
debugOTAFlow()

// Выведет:
// 1️⃣ Calling serverStatus()...
// 2️⃣ CLIENT_VERSION: 3.1.0
// 3️⃣ SERVER_URL: https://...
// 4️⃣ ScriptApp.getScriptId(): 12bp9cBT...
// 5️⃣ getLicenseEmail(): user@gmail.com
// 6️⃣ getLicenseToken(): SET
```

---

## 🔄 Откатка версии

Если новая версия сломала что-то?

### Откатить на предыдущую

```
# На GitHub:
1. Найти последний stable коммит
2. git revert <commit-hash>
3. git push origin main
4. Уменьшить SERVER_VERSION на 1
5. Deploy сервера

# Через 24 часа все клиенты откатятся на старую версию
```

### Срочный откат (без ожидания)

```
1. Пользователь может откатиться вручную:
   Extensions → Apps Script → +
   Выбрать версию вашего скрипта из истории
   → Restore (восстановить)

2. Или у администратора: откатить на previous версию вручную
```

---

## 📊 Статистика обновлений

### Просмотреть в логах сервера

```
// server.gs → Logs
[INFO] 🚀 Client: 12bp9cBT... updated to v3.1.1
[INFO] 📥 Downloaded 12 files
[INFO] ✅ Server applied updates to client
```

### Отследить по лицензиям

```
Таблица: "Логи" (в сервере)
Ищешь: action = "OTA_UPDATE"
Видишь: email, timestamp, version
```

---

## ⚙️ Конфигурация

### Время проверки (3:00 AM)

```
// Main.gs: installUpdateTrigger_()
.atHour(3)         // ← Час (0-23, UTC)
.everyDays(1)      // ← Каждый день
```

Измени час:
```
.atHour(9)  // → проверка в 9:00 AM
```

### Список файлов для обновления

```
// server.gs: case 'getUpdatedFiles'
const clientFiles = [
  'Main.gs',
  'CollectConfig.gs',
  'TemplateService.gs',
  // ... добавить новые файлы сюда
];
```

---

## 🚨 Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| NO_SCRIPT_ID | scriptId не в Bindings | Проверь лист Bindings в Google Sheet |
| NOT_FOUND | Email или token неправильный | Проверь getLicenseEmail() и getLicenseToken() |
| NO_DEFAULT_KEY | Gemini ключ не установлен | Выполни setDefaultGeminiKey_('sk-proj-...') |
| API_UPDATE_FAILED | Apps Script API отключена | Включи в Google Cloud Console |
| NETWORK_ERROR | Нет интернета | Проверь соединение |

---

## 📞 Поддержка

- 🐛 Ошибка в OTA? → Создай Issue на GitHub
- 💬 Предложение? → Discussions
- 👨‍💻 Вопрос? → vk.com/daoqub

---

**Последнее обновление:** 30.11.2025 | OTA v3.2
