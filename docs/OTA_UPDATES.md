# OTA (Over-The-Air) Обновления - Полное руководство v3.5.2

## 📌 Что это?

**OTA система** автоматически обновляет код на клиентских таблицах через Apps Script API.

- ✅ Нет необходимости вручную обновлять каждую копию
- ✅ Обновления распространяются ночью в 3:00
- ✅ Пользователи ничего не делают - всё автоматически
- ✅ Откатки версий поддерживаются
- ✅ Поддержка приватных GitHub репозиториев (v3.5.0+)
- ✅ Обратная совместимость со старыми версиями (v3.5.2+)

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

## 🔐 v3.5 - Поддержка приватных GitHub репозиториев

### Что изменилось?

**v3.5 внедрил четкое разделение между CLIENT и SERVER:**

```
КЛИЕНТ (Main.gs):
- ✅ Проверяет версию
- ✅ Просит сервер обновить
- ❌ НЕ скачивает файлы
- ❌ НЕ знает про GitHub
- ❌ НЕ знает про PAT

СЕРВЕР (server.gs + ota_updates.gs):
- ✅ Скачивает файлы с GitHub
- ✅ Знает GitHub PAT для приватного репо
- ✅ Обновляет клиента через Apps Script API
- ✅ Логирует результаты
```

### Новые возможности

#### 1. Приватный GitHub репозиторий

```bash
# Администратор один раз:
setGithubPAT('ghp_YOUR_TOKEN_HERE')

# В server.gs:
const REPO_IS_PUBLIC = false;  # ← вместо true

# Deploy и готово!
# Все пользователи получат обновления из приватного репо
```

#### 2. Модульная архитектура

```javascript
// Новый файл: ota_updates.gs (ТОЛЬКО НА СЕРВЕРЕ)
├─ downloadFileFromGithub_() - выбирает публичный или приватный
├─ downloadFromPublicRepo_() - скачивает из публичного репо
├─ downloadFromPrivateRepo_() - скачивает с PAT из приватного
├─ downloadAllClientFiles_() - 12 файлов для клиента
├─ updateClientScript_() - обновляет скрипт через API
└─ applyUpdatesToClient_() - главная функция для обновления
```

#### 3. Упрощенный клиент

```javascript
// Клиент сейчас только 2 функции:
checkForUpdatesBackground_() - проверяет версию, просит сервер
checkForUpdatesManual_() - ручная проверка из меню
```

### Миграция с v3.3 на v3.5

```bash
✅ 1. Создать новый файл ota_updates.gs
✅ 2. Обновить server.gs (добавить REPO_IS_PUBLIC)
✅ 3. Упростить Main.gs функции
✅ 4. Если приватный репо → setGithubPAT()
✅ 5. Deploy
✅ 6. Готово!
```

### Документация по приватному репо

Если используешь приватный GitHub репозиторий:
- 📖 [Полное руководство: GITHUB_PRIVATE_REPO.md](GITHUB_PRIVATE_REPO.md)
- 🔑 Как получить PAT
- 🔧 Как установить на сервер
- 🧪 Как тестировать
- 🚨 Как решать проблемы

---

## 🔙 v3.5.2 - Обратная совместимость

### Проблема со старыми версиями

**До v3.5.2:**
- Старые клиенты (v3.4.x) имели функцию `checkForUpdates_()` без суффикса `Background_`
- Триггеры создавались с именем `checkForUpdates_`
- При попытке обновления через новую систему возникала ошибка:
  ```
  ReferenceError: checkForUpdates_ is not defined
  ```

**Причина:**
- В v3.5.0 функция была переименована в `checkForUpdatesBackground_()`
- Старые триггеры продолжали вызывать `checkForUpdates_()`
- Функция отсутствовала на клиенте → ошибка

### Решение в v3.5.2

**Добавлен алиас-функция:**
```javascript
// Main.gs, строка 2034
function checkForUpdates_() {
  addLog('⚠️ DEPRECATED: используется алиас для совместимости', 'WARN');
  return checkForUpdatesBackground_();
}
```

**Что это даёт:**
- ✅ Старые триггеры с именем `checkForUpdates_` работают
- ✅ Старые вызовы автоматически перенаправляются
- ✅ Клиенты обновляются без ошибок
- ✅ Логирование помогает отследить использование deprecated функции

### Процесс обновления старых клиентов

```
СТАРЫЙ КЛИЕНТ (v3.4.5):
1. Пользователь нажимает "🔄 Автообновление"
   ↓
2. Вызывается старая функция checkForUpdates_()
   ↓
3. В новой версии есть алиас → перенаправление
   ↓
4. checkForUpdatesBackground_() выполняется
   ↓
5. Сервер скачивает новую версию (v3.5.2)
   ↓
6. Клиент обновляется
   ↓
7. ✅ Email: "Обновлено до v3.5.2"
   ↓
8. Следующая проверка уже с новым кодом
```

### Когда удалить алиас?

**Рекомендация:** Через 3-6 месяцев после релиза v3.5.2

**Условия для удаления:**
1. Проверить логи сервера - нет ли вызовов deprecated функции
2. Убедиться что все клиенты обновились до v3.5.2+
3. Удалить функцию `checkForUpdates_()` из `Main.gs`
4. Удалить из `/* exported */` списка

**Проверка перед удалением:**
```javascript
// Поиск в логах сервера
// Если найдено "DEPRECATED: checkForUpdates_" → ещё есть старые клиенты
```

---

**Последнее обновление:** 2025-01-XX | OTA v3.5.2
