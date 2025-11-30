# 🔧 Устранение неполадок OTA системы

## ❌ Ошибка: "checkForUpdates_ is not defined"

### 📝 Описание проблемы

При нажатии кнопки **"🔄 Автообновление"** появляется ошибка:
```
ReferenceError: checkForUpdates_ is not defined
```

### 🔍 Причина

Ваша таблица использует **старую версию** (v3.4.x или ниже), которая несовместима с новой OTA системой (v3.5.0+).

**Техническая причина:**
- В старой версии функция называлась `checkForUpdates_()`
- В новой версии функция переименована в `checkForUpdatesBackground_()`
- Старые триггеры пытаются вызвать несуществующую функцию

### ✅ Решение 1: Автоматическое обновление (рекомендуется)

**Хорошие новости:** Начиная с версии **v3.5.2** добавлен алиас-функция для обратной совместимости!

**Что нужно сделать:**

1. **Обновить серверную часть** (администратор делает один раз):
   - GitHub: Убедитесь что в main ветке версия `SERVER_VERSION = '3.5.2'` или выше
   - Deploy сервера: `clasp push --force` (в папке сервера)

2. **Обновить клиентскую часть** (каждый пользователь):
   
   **Вариант A: Через OTA (если работает):**
   - Откройте таблицу
   - Меню: **🤖 Table AI → 🔄 Автообновление**
   - Если появилась та же ошибка → используйте Вариант B
   
   **Вариант B: Вручную (если OTA не работает):**
   1. Откройте таблицу
   2. **Extensions → Apps Script**
   3. Скопируйте ВСЕ файлы из GitHub:
      - `deploy/Main.gs` → `Main.gs`
      - `deploy/CollectConfig.gs` → `CollectConfig.gs`
      - `deploy/TemplateService.gs` → `TemplateService.gs`
      - И так далее (см. список в `ota_updates.gs`)
   4. Сохраните (Ctrl+S)
   5. Обновите страницу таблицы (F5)
   6. ✅ Готово! Теперь OTA работает

### ✅ Решение 2: Пересоздать триггер

Если после обновления ошибка повторяется:

1. **Откройте Apps Script:**
   - Extensions → Apps Script

2. **Посмотрите триггеры:**
   - Слева в меню: ⏰ (значок часов) "Triggers"
   - Найдите триггер с функцией `checkForUpdates_`
   - Удалите его (3 точки → Delete trigger)

3. **Создайте новый триггер:**
   - Вернитесь в таблицу
   - Меню: **🤖 Table AI → 🔄 Автообновление**
   - Система создаст правильный триггер автоматически

4. **Проверьте:**
   - Extensions → Apps Script → Triggers
   - Должен быть триггер: `checkForUpdatesBackground_` (с Background!)

### ✅ Решение 3: Ручное добавление алиас-функции

Если не можете обновить через OTA, добавьте временную функцию:

1. **Extensions → Apps Script**
2. Откройте файл `Main.gs`
3. Найдите строку (около 2020):
   ```javascript
   // ===== GEMINI API KEY MANAGEMENT =====
   ```
4. **Перед этой строкой** добавьте:
   ```javascript
   // TEMPORARY FIX для v3.4.x → v3.5.2
   function checkForUpdates_() {
     return checkForUpdatesBackground_();
   }
   ```
5. Сохраните (Ctrl+S)
6. Вернитесь в таблицу
7. Попробуйте снова: **🤖 Table AI → 🔄 Автообновление**
8. ✅ Должно работать!

---

## ❌ Ошибка: "updateAvailable is not defined"

### 📝 Описание

Обновление начинается, но падает с ошибкой:
```
ReferenceError: updateAvailable is not defined
```

### ✅ Решение

Это ошибка в старой версии серверного кода. Обновите сервер:

1. GitHub: Убедитесь что `deploy/server.gs` содержит правильный код
2. Проверьте `deploy/ota_updates.gs` - файл должен существовать
3. Deploy сервера: `clasp push --force`

---

## ❌ Ошибка: "License check failed"

### 📝 Описание

При попытке обновления:
```
License check failed: NOT_FOUND
```

### ✅ Решение

1. Проверьте что email и token установлены:
   - Меню: **🤖 Table AI → ⚙️ Настройки**
   - Email должен совпадать с Bindings таблицей на сервере

2. Проверьте Bindings таблицу (администратор):
   - Откройте серверную таблицу с лицензиями
   - Лист "Bindings"
   - Найдите строку с вашим email
   - Проверьте что `script_ids` содержит ваш Script ID
   - Script ID можно узнать: Extensions → Apps Script → URL

3. Если нет записи → добавьте:
   | Email | sheet_ids | script_ids |
   |-------|-----------|------------|
   | ваш@email.com | ID таблицы | Script ID |

---

## ❌ Ошибка: "Failed to download files from GitHub"

### 📝 Описание

Сервер не может скачать файлы:
```
Failed to download files from GitHub
```

### ✅ Решение

**Для публичного репозитория:**
1. Проверьте что репозиторий действительно публичный
2. Проверьте что в `server.gs`:
   ```javascript
   const REPO_IS_PUBLIC = true;
   ```

**Для приватного репозитория:**
1. Проверьте что PAT установлен (администратор):
   ```javascript
   // В консоли server.gs
   setGithubPAT_('ghp_YOUR_TOKEN_HERE')
   ```
2. Проверьте что в `server.gs`:
   ```javascript
   const REPO_IS_PUBLIC = false;
   ```
3. Проверьте что PAT имеет права:
   - GitHub → Settings → Developer settings → Personal access tokens
   - Права: `repo` (full control)

**GitHub rate limit:**
- Если превышен лимит запросов (60/час для публичных, 5000/час для приватных)
- Подождите час и попробуйте снова
- Или используйте PAT (даже для публичного репозитория)

---

## 🧪 Отладка OTA системы

### Проверка версий

**Узнать текущую версию клиента:**
```javascript
// Extensions → Apps Script → Console
Logger.log('CLIENT_VERSION: ' + CLIENT_VERSION);
```

**Узнать версию сервера:**
```javascript
// В таблице: Меню → 🤖 Table AI → ⚙️ Настройки
// Внизу показана информация о сервере
```

### Проверка триггеров

**Посмотреть активные триггеры:**
1. Extensions → Apps Script
2. Слева: ⏰ "Triggers"
3. Должен быть:
   - Function: `checkForUpdatesBackground_`
   - Event: Time-driven
   - Type: Day timer
   - Time: 3:00 AM

**Если триггер неправильный:**
- Удалите старый
- Создайте новый через меню: 🤖 Table AI → 🔄 Автообновление

### Включить отладочные логи

**В Main.gs:**
```javascript
// Найти строку (около 48):
const DEV_MODE = false;

// Изменить на:
const DEV_MODE = true;
```

**Посмотреть логи:**
- Меню: 🧰 DEV → 📝 Показать логи
- Или: Extensions → Apps Script → Executions

---

## 📞 Поддержка

Если ни одно решение не помогло:

1. **GitHub Issues:**
   - https://github.com/crosspostly/table_ai/issues
   - Создайте issue с описанием проблемы
   - Приложите скриншот ошибки

2. **Включите отладку:**
   - `DEV_MODE = true`
   - Экспортируйте логи: 🧰 DEV → ⬇️ Экспорт логов
   - Приложите логи к issue

3. **Контакты:**
   - 👨‍💻 VK: [@daoqub](https://vk.com/daoqub)
   - 💬 Discussions: https://github.com/crosspostly/table_ai/discussions

---

**Последнее обновление:** 2025-01-XX | v3.5.2
