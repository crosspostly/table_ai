# 🧪 OTA Testing Checklist

Полный список тестов для проверки системы автоматических обновлений.

---

## 1. ✅ Установка окружения

### 1.1 Проверка Apps Script API

```bash
# ✓ Apps Script API включена в Google Cloud Console
# ✓ Scope 'script.projects' добавлен в appsscript.json
# ✓ Server развернут как Web App
```

**Действие:**
1. Откройте таблицу
2. Extensions → Apps Script → Project Settings
3. Скопируйте GCP Project Number
4. Откройте Google Cloud Console с этим проектом
5. APIs & Services → Library
6. Найдите "Apps Script API" → ENABLE
7. ✅ Готово!

---

## 2. ✅ Проверка триггера

### 2.1 Триггер создается при onOpen()

**Test:**
```gherkin
GIVEN: Таблица не открывалась с этого сеанса
WHEN: Пользователь открывает таблицу
THEN: Создается триггер checkForUpdatesBackground_
```

**Проверка:**
1. Закройте таблицу полностью (выйдите из аккаунта)
2. Откройте таблицу заново
3. Extensions → Apps Script → Triggers
4. Найдите `checkForUpdatesBackground_` с расписанием "Every day at 3:00 AM"
5. ✅ PASS если триггер есть

### 2.2 Триггер не дублируется

**Test:**
```gherkin
GIVEN: Триггер уже установлен
WHEN: Пользователь открывает таблицу снова
THEN: Новый триггер не создается (остается только один)
```

**Проверка:**
1. Откройте таблицу 5 раз подряд
2. Extensions → Apps Script → Triggers
3. Найдите все триггеры `checkForUpdatesBackground_`
4. ✅ PASS если только **один** триггер

### 2.3 Логирование установки

**Test:**
```gherkin
WHEN: Триггер устанавливается
THEN: Добавляется лог "✅ Триггер обновлений установлен"
```

**Проверка:**
1. 🧰 DEV → 📝 Показать логи
2. Поиск: "✅ Триггер обновлений"
3. ✅ PASS если лог найден

---

## 3. ✅ Проверка версий

### 3.1 Сравнение версий на сервере

**Test:**
```gherkin
GIVEN: SERVER_VERSION = '3.1.0'
GIVEN: CLIENT_VERSION = '3.1.0'
WHEN: Запрос checkUpdates на сервер
THEN: updateAvailable = false
```

**Проверка:**
1. 🧰 DEV → 🔄 Обновить вручную
2. Диалог: "✅ Версия актуальна"
3. "Текущая: 3.1.0 | Серверная: 3.1.0"
4. ✅ PASS

### 3.2 Определение доступного обновления

**Test:**
```gherkin
GIVEN: SERVER_VERSION = '3.2.0'
GIVEN: CLIENT_VERSION = '3.1.0' (локально, не в deploy)
WHEN: Запрос checkUpdates на сервер
THEN: updateAvailable = true
```

**Проверка:**
1. Отредактируй server.gs: `const SERVER_VERSION = '3.2.0'`
2. Deploy server.gs как Web App
3. 🧰 DEV → 🔄 Обновить вручную
4. Диалог: "Доступна версия 3.2.0!"
5. Кнопка YES/NO показана
6. ✅ PASS

---

## 4. ✅ Ручное обновление

### 4.1 Ручная проверка с YES

**Test:**
```gherkin
GIVEN: updateAvailable = true
WHEN: Пользователь кликает YES на диалог обновления
THEN: Запускается checkForUpdatesBackground_()
```

**Проверка:**
1. SERVER_VERSION = '3.2.0' (как в тесте 3.2)
2. 🧰 DEV → 🔄 Обновить вручную
3. Диалог: "Доступна версия 3.2.0!" → YES
4. Диалог: "⏳ Обновление запущено..."
5. Проверить логи: 🧰 DEV → 📝 Показать логи
6. Найти: "🌙 Фоновая проверка обновлений запущена"
7. ✅ PASS если логи есть

### 4.2 Ручная проверка с NO

**Test:**
```gherkin
GIVEN: updateAvailable = true
WHEN: Пользователь кликает NO
THEN: Обновление не запускается
```

**Проверка:**
1. SERVER_VERSION = '3.2.0'
2. 🧰 DEV → 🔄 Обновить вручную
3. Диалог: "Доступна версия 3.2.0!" → NO
4. Проверить логи: 🧰 DEV → 📝 Показать логи
5. ✅ PASS если нет лога о запуске обновления

### 4.3 Отмена диалога

**Test:**
```gherkin
GIVEN: updateAvailable = true
WHEN: Пользователь закрывает диалог (кликает X или ESC)
THEN: Обновление не запускается
```

**Проверка:**
1. SERVER_VERSION = '3.2.0'
2. 🧰 DEV → 🔄 Обновить вручную
3. Закройте диалог (X или ESC, не NO)
4. ✅ PASS

---

## 5. ✅ Загрузка файлов

### 5.1 Скачивание всех файлов

**Test:**
```gherkin
WHEN: Запрос getUpdatedFiles на сервер
THEN: Возвращаются все 12 файлов с типами
```

**Проверка:**
1. Создайте новый скрипт для тестирования
2. Запрос:
```javascript
const payload = {
  action: 'ota',
  subaction: 'getUpdatedFiles',
  email: 'ваш_email@gmail.com',
  token: 'ваш_токен'
};
const resp = UrlFetchApp.fetch(SERVER_URL, {
  method: 'post',
  payload: JSON.stringify(payload)
});
Logger.log(resp.getContentText());
```
3. Проверить ответ:
   - `ok: true`
   - `count: 12` (или больше)
   - Каждый файл имеет `name`, `type`, `source`
4. ✅ PASS

### 5.2 Типы файлов

**Test:**
```gherkin
GIVEN: clientFiles список из 12 файлов
WHEN: Подготовка файлов для API
THEN: .gs файлы имеют type='SERVER_JS'
AND:  .html файлы имеют type='HTML'
AND:  appsscript.json имеет type='JSON'
```

**Проверка:**
1. Запрос getUpdatedFiles (см выше)
2. Проверьте типы:
   - Main.gs → type: 'SERVER_JS' ✅
   - CollectConfig.gs → type: 'SERVER_JS' ✅
   - CollectConfigUi.html → type: 'HTML' ✅
   - appsscript.json → type: 'JSON' ✅
3. ✅ PASS если все типы правильные

### 5.3 GitHub fetch ошибка

**Test:**
```gherkin
GIVEN: Файл не существует в GitHub или репозиторий недоступен
WHEN: Запрос getUpdatedFiles
THEN: Возвращается error "Failed to fetch: ..."
```

**Проверка:**
1. Временно отключите интернет (или заблокируйте GitHub)
2. 🧰 DEV → 🔄 Обновить вручную
3. Диалог: "❌ Ошибка: Failed to fetch"
4. ✅ PASS

---

## 6. ✅ Обновление через API

### 6.1 Успешное обновление

**Test:**
```gherkin
GIVEN: CLIENT_VERSION = '3.1.0', SERVER_VERSION = '3.2.0'
GIVEN: Все файлы загружены с GitHub
GIVEN: Script ID получен из лицензии
WHEN: Запрос PUT к Apps Script API с файлами
THEN: HTTP 200 OK
AND:  CLIENT_VERSION обновлена на '3.2.0'
```

**Проверка:**
1. Убедитесь что SERVER_VERSION = '3.2.0'
2. 🧰 DEV → 🔄 Обновить вручную → YES
3. Подождите 10-20 секунд
4. Проверьте логи: 🧰 DEV → 📝 Показать логи
5. Найдите логи:
   - "🚀 Обновление до версии 3.2.0"
   - "📥 Получено X файлов"
   - "✅ Script ID: ..."
   - "✅ Файлы обновлены через API"
6. Перезагрузите таблицу (F5)
7. Extensions → Apps Script → Main.gs
8. Проверьте: `const CLIENT_VERSION = '3.2.0'`
9. ✅ PASS если версия обновилась

### 6.2 Отсутствие Script ID

**Test:**
```gherkin
GIVEN: Script ID отсутствует в лицензионной таблице
WHEN: Запрос checkForUpdatesBackground_()
THEN: Ошибка "Script ID not found in license"
AND:  Email об ошибке отправлен
```

**Проверка:**
1. Откройте лицензионную таблицу
2. Удалите Script ID (сделайте ячейку пустой)
3. 🧰 DEV → 🔄 Обновить вручную
4. Ошибка: "Script ID not found in license"
5. Проверьте email на ошибку
6. ✅ PASS

### 6.3 API HTTP ошибка

**Test:**
```gherkin
GIVEN: Apps Script API отключена
WHEN: Запрос PUT к https://script.googleapis.com/v1/projects/.../content
THEN: HTTP 403 Permission Denied
AND:  Лог ошибки в логи
```

**Проверка:**
1. Откройте Google Cloud Console
2. Отключите Apps Script API (временно)
3. 🧰 DEV → 🔄 Обновить вручную → YES
4. Ошибка: "HTTP 403" или "Permission denied"
5. Включите API обратно
6. ✅ PASS

---

## 7. ✅ Email уведомления

### 7.1 Email при успехе

**Test:**
```gherkin
WHEN: Обновление завершено успешно
THEN: Email отправлен на адрес из лицензии
AND:  Subject: "✅ Table AI обновлён до версии X.Y.Z"
AND:  Body содержит версии и ссылку на таблицу
```

**Проверка:**
1. 🧰 DEV → 🔄 Обновить вручную → YES
2. Подождите 20 секунд
3. Откройте Gmail (адрес из лицензии)
4. Найдите письмо: "✅ Table AI обновлён"
5. Проверьте:
   - Новая версия указана правильно
   - Ссылка на таблицу работает
6. ✅ PASS

### 7.2 Email при ошибке

**Test:**
```gherkin
WHEN: Обновление завершено с ошибкой
THEN: Email отправлен на адрес из лицензии
AND:  Subject: "❌ Ошибка обновления Table AI"
AND:  Body содержит описание ошибки
```

**Проверка:**
1. Удалите Script ID из лицензии
2. 🧰 DEV → 🔄 Обновить вручную → YES
3. Подождите 20 секунд
4. Откройте Gmail
5. Найдите письмо: "❌ Ошибка обновления"
6. Проверьте что описание ошибки есть
7. ✅ PASS

### 7.3 Email не отправляется без email в лицензии

**Test:**
```gherkin
GIVEN: Email отсутствует в лицензионной таблице
WHEN: Запрос sendUpdateEmail_()
THEN: Email не отправляется (нет адреса для отправки)
```

**Проверка:**
1. Откройте лицензионную таблицу
2. Удалите email (сделайте ячейку пустой)
3. 🧰 DEV → 🔄 Обновить вручную → YES
4. Проверьте Gmail - письма не должно быть
5. ✅ PASS

---

## 8. ✅ Логирование

### 8.1 Логи установки триггера

**Test:**
```gherkin
WHEN: installUpdateTrigger_() выполняется
THEN: Добавляется лог "✅ Триггер обновлений установлен (каждый день в 3:00)"
OR:   Лог "ℹ️ Триггер обновлений уже установлен"
```

**Проверка:**
1. 🧰 DEV → 📝 Показать логи
2. Поиск: "Триггер обновлений"
3. ✅ PASS если лог найден

### 8.2 Логи фоновой проверки

**Test:**
```gherkin
WHEN: checkForUpdatesBackground_() запускается
THEN: Логи содержат:
- "🌙 Фоновая проверка обновлений запущена"
- "✅ Версия актуальна" ИЛИ "🚀 Обновление до версии"
```

**Проверка:**
1. 🧰 DEV → 📝 Показать логи
2. Поиск: "Фоновая проверка"
3. ✅ PASS если лог найден

### 8.3 Логи загрузки файлов

**Test:**
```gherkin
WHEN: Файлы загружаются
THEN: Логи содержат "📥 Получено X файлов"
```

**Проверка:**
1. 🧰 DEV → 🔄 Обновить вручную → YES
2. 🧰 DEV → 📝 Показать логи
3. Поиск: "Получено"
4. ✅ PASS если "📥 Получено 12 файлов"

### 8.4 Экспорт логов в лист

**Test:**
```gherkin
WHEN: DEV → ⬇️ Экспорт логов
THEN: Создается новый лист "Логи"
AND:  Содержит все записи из кэша
```

**Проверка:**
1. 🧰 DEV → ⬇️ Экспорт логов
2. Проверьте новый лист "Логи"
3. Найдите записи OTA обновлений
4. ✅ PASS

---

## 9. ✅ Лицензирование

### 9.1 Проверка лицензии перед обновлением

**Test:**
```gherkin
GIVEN: Недействительный token
WHEN: Запрос OTA на сервер
THEN: HTTP 403 Forbidden
AND:  Ошибка "UNAUTHORIZED"
```

**Проверка:**
1. Создайте тестовый запрос с неправильным token
```javascript
const payload = {
  action: 'ota',
  subaction: 'checkUpdates',
  clientVersion: '3.1.0',
  email: 'test@example.com',
  token: 'invalid_token_123'
};
```
2. Отправьте на сервер
3. Ответ: `{ok: false, error: 'UNAUTHORIZED'}` с HTTP 403
4. ✅ PASS

### 9.2 Проверка email из лицензии

**Test:**
```gherkin
GIVEN: Email в payload отличается от лицензионного
WHEN: Запрос OTA на сервер
THEN: Ошибка "UNAUTHORIZED" или "LICENSE_MISMATCH"
```

**Проверка:**
1. Запрос:
```javascript
const payload = {
  action: 'ota',
  subaction: 'checkUpdates',
  clientVersion: '3.1.0',
  email: 'wrong_email@example.com',
  token: 'valid_token'
};
```
2. Отправьте на сервер
3. Ожидаемый ответ: ошибка
4. ✅ PASS

---

## 10. ✅ Интеграция с GitHub

### 10.1 Скачивание из main ветки

**Test:**
```gherkin
GIVEN: Файл находится в deploy/ папке main ветки
WHEN: fetchFileContent_('Main.gs')
THEN: Успешно скачивается полный код файла
```

**Проверка:**
1. Откройте: https://raw.githubusercontent.com/crosspostly/table_ai/main/deploy/Main.gs
2. Проверьте что файл доступен и содержит код
3. 🧰 DEV → 🔄 Обновить вручную → YES
4. Проверьте логи: "Fetched Main.gs: XXX bytes"
5. ✅ PASS

### 10.2 Обработка 404 ошибки

**Test:**
```gherkin
GIVEN: Файл не существует в GitHub
WHEN: fetchFileContent_('NonExistent.gs')
THEN: Возвращается null
AND:  Лог "GitHub fetch failed: HTTP 404"
```

**Проверка:**
1. Временно измените имя файла в clientFiles
2. 🧰 DEV → 🔄 Обновить вручную → YES
3. Ошибка: "Failed to fetch: NonExistent.gs"
4. ✅ PASS

---

## 11. ✅ Безопасность

### 11.1 Только авторизованные пользователи

**Test:**
```gherkin
GIVEN: Пользователь не авторизован (нет token)
WHEN: Запрос OTA
THEN: Возвращается error 403 UNAUTHORIZED
```

**Проверка:**
1. Запрос без token
2. Ответ: `{ok: false, error: 'UNAUTHORIZED'}` HTTP 403
3. ✅ PASS

### 11.2 Только main ветка

**Test:**
```gherkin
GIVEN: Файл находится в другой ветке (dev, staging)
WHEN: fetchFileContent_() использует BRANCH='main'
THEN: Загружается только из main ветки
```

**Проверка:**
1. Откройте server.gs строку 641
2. Проверьте: `const BRANCH = 'main';`
3. ✅ PASS если только main

### 11.3 Только GitHub репозиторий

**Test:**
```gherkin
GIVEN: URL скачивания файлов
WHEN: fetchFileContent_() генерирует URL
THEN: URL содержит только 'raw.githubusercontent.com'
AND:  Нет других источников
```

**Проверка:**
1. Откройте server.gs функцию fetchFileContent_
2. Проверьте: `const url = 'https://raw.githubusercontent.com/crosspostly/table_ai/main/deploy/' + fileName`
3. ✅ PASS если только GitHub

---

## ✅ ФИНАЛЬНЫЙ CHECKLIST

Все тесты должны быть пройдены:

- [ ] 2.1 Триггер создается при onOpen
- [ ] 2.2 Триггер не дублируется
- [ ] 2.3 Логирование установки
- [ ] 3.1 Сравнение версий
- [ ] 3.2 Определение обновления
- [ ] 4.1 Ручное обновление YES
- [ ] 4.2 Ручное обновление NO
- [ ] 4.3 Отмена диалога
- [ ] 5.1 Загрузка всех файлов
- [ ] 5.2 Типы файлов
- [ ] 5.3 GitHub fetch ошибка
- [ ] 6.1 Успешное обновление через API
- [ ] 6.2 Отсутствие Script ID
- [ ] 6.3 API HTTP ошибка
- [ ] 7.1 Email при успехе
- [ ] 7.2 Email при ошибке
- [ ] 7.3 Email без адреса
- [ ] 8.1 Логи триггера
- [ ] 8.2 Логи фоновой проверки
- [ ] 8.3 Логи загрузки
- [ ] 8.4 Экспорт логов
- [ ] 9.1 Проверка лицензии
- [ ] 9.2 Email из лицензии
- [ ] 10.1 Загрузка из main
- [ ] 10.2 404 ошибка
- [ ] 11.1 Только авторизованные
- [ ] 11.2 Только main ветка
- [ ] 11.3 Только GitHub

**🎉 Все тесты пройдены - OTA готов к production!**
