# 🚀 Deployment Guide - Развертывание Table AI

## 📌 Обзор

**Table AI deployment** включает:
- ✅ Настройку сервера (Web App)
- ✅ Развертывание клиентов (копии таблиц)
- ✅ Настройку OTA обновлений
- ✅ Управление лицензиями

---

## 🏗️ Архитектура развертывания

```
DEVELOPMENT (GitHub)
    ↓
SERVER (Web App)
    ├── OTA Updates
    ├── License Management  
    ├── Gemini API Proxy
    └── Code Distribution
    ↓
CLIENTS (Google Sheets)
    ├── Individual copies
    ├── Auto-updates
    └── User data
```

---

## 🚀 Шаг 1: Подготовка сервера

### 1.1 Создать Apps Script проект

```
1. https://script.google.com → New Project
2. Название: "Table AI Server"
3. Копировать файлы из deploy/:
   - server.gs
   - license.gs
   - appsscript.json
```

### 1.2 Настроить Google Cloud

```
1. Включить Apps Script API
2. Создать Service Account
3. Настроить OAuth2 consent screen
4. Выдать права: Apps Script Developer
```

### 1.3 Deploy Web App

```
Apps Script Editor:
1. Deploy → New deployment
2. Type: Web app
3. Execute as: Me
4. Access: Anyone
5. Deploy → Скопировать URL
```

---

## 📦 Шаг 2: Настройка лицензий

### 2.1 Создать таблицу лицензий

```
Новая Google Sheet: "Table AI Licenses"

Лист "Licenses":
A: email
B: token
C: expires (=TODAY()+365)
D: copies_count

Лист "Bindings":  
A: email
B: sheet_id
C: script_id
D: created_at (=NOW())
```

### 2.2 Добавить пользователей

```
Пример строки в Licenses:
A: user@company.com
B: USER_TOKEN_32_CHARACTERS_LONG_STRING
C: =TODAY()+365
D: 50
```

### 2.3 Настроить доступ

```
1. Share таблицу с Service Account
2. Права: Editor
3. Скопировать Sheet ID
4. В server.gs: setLicenseSheetId('SHEET_ID')
```

---

## 🔑 Шаг 3: Настройка API ключей

### 3.1 Gemini API

```
1. https://aistudio.google.com/app/apikey
2. Create API Key
3. Скопировать ключ
4. В server.gs Console:
   setDefaultGeminiKey_('AIzaSy...KEY')
```

### 3.2 Проверить ключи

```javascript
// server.gs Console
function testApiKeys() {
  Logger.log('Gemini: ' + (getGeminiApiKey() ? 'OK' : 'MISSING'));
  Logger.log('License Sheet: ' + (getLicenseSheetId() ? 'OK' : 'MISSING'));
}
```

---

## 📋 Шаг 4: Создание мастер-таблицы

### 4.1 Подготовить клиентские файлы

```
Из deploy/ скопировать в Apps Script:
✅ Main.gs
✅ CollectConfig.gs  
✅ TemplateService.gs
✅ VK.gs
✅ UnpackingViewer.gs
✅ ocrRunV2_client.gs
✅ reniewcell.gs
✅ license.gs
✅ HTML файлы:
  - CollectConfigUi.html
  - SettingsUI.html
  - UnpackingViewerUI.html
  - logging_system.html
✅ appsscript.json
```

### 4.2 Настроить мастер-таблицу

```
1. Создать новую Google Sheet: "Table AI Master"
2. Extensions → Apps Script
3. Добавить все файлы из deploy/
4. В Main.gs установить:
   const SERVER_URL = 'https://script.google.com/macros/s/.../exec';
5. Сохранить и авторизовать
```

### 4.3 Тестировать мастер

```
1. Обновить браузер
2. Появится меню: 🤖 Table AI
3. ⚙️ Настройки → 📦 Ввести лицензионный токен
4. ✅ Мастер готов для копирования!
```

---

## 🔄 Шаг 5: Настройка OTA

### 5.1 Версионирование

```javascript
// server.gs
const SERVER_VERSION = '3.2.0';

// Main.gs  
const CLIENT_VERSION = '3.2.0';
```

### 5.2 Настроить GitHub

```
1. Убедиться что все файлы в /deploy/ актуальны
2. Закоммитить изменения:
   git add deploy/
   git commit -m "Release v3.2.0"
   git push origin main
3. Проверить что файлы доступны:
   https://raw.githubusercontent.com/user/repo/main/deploy/Main.gs
```

### 5.3 Тестировать OTA

```javascript
// В клиентской таблице
function testOTA() {
  // 1. Проверить сервер
  const status = serverStatus();
  Logger.log('Server: ' + JSON.stringify(status));
  
  // 2. Проверить обновления
  const updates = checkForUpdatesManual_();
  Logger.log('Updates: ' + JSON.stringify(updates));
}
```

---

## 👥 Шаг 6: Раздача клиентам

### 6.1 Подготовить инструкции

```
Для каждого пользователя:
1. Скопировать мастер-таблицу
2. Открыть копию
3. Extensions → Apps Script → Обновить
4. 🤖 Table AI → ⚙️ Настройки
5. 📦 Ввести лицензионный токен
6. ✅ Готово к работе!
```

### 6.2 Пакетное создание копий

```
Если нужно много копий:
1. Использовать Google Apps Script API
2. Создать копии мастер-таблицы
3. Автоматически проставлять лицензии
4. Раздавать пользователям
```

### 6.3 Мониторинг активаций

```
В License Sheet следить:
- Количество активированных копий
- Остаток available copies
- Даты истечения лицензий
```

---

## 🔄 Шаг 7: Обновление системы

### 7.1 Выпуск обновления

```
1. Разработать изменения в /deploy/
2. Протестировать локально
3. Увеличить версии:
   - SERVER_VERSION в server.gs
   - CLIENT_VERSION в Main.gs
4. Закоммитить в main
5. Deploy сервера
6. ✅ Клиенты обновятся автоматически ночью
```

### 7.2 Принудительное обновление

```
Если нужно срочно обновить всех:
1. В server.gs увеличить SERVER_VERSION
2. Deploy сервера
3. Пользователи: 🔄 Автообновление → Проверить сейчас
4. ✅ Все обновятся принудительно
```

### 7.3 Откат версии

```
Если обновление сломало что-то:
1. Откатить коммит на GitHub
2. Уменьшить SERVER_VERSION
3. Deploy сервера
4. ✅ Клиенты откатятся при следующей проверке
```

---

## 📊 Шаг 8: Мониторинг

### 8.1 Логи сервера

```
Apps Script Console → Executions
Смотреть:
- OTA запросы
- License проверки  
- Gemini API вызовы
- Ошибки и таймауты
```

### 8.2 Статистика пользователей

```
В License Sheet создать сводные таблицы:
- Количество активных пользователей
- Самые активные (по bindings)
- Истекающие лицензии (30 дней)
- Использование копий
```

### 8.3 Алерты

```
Настроить уведомления на:
- ❌ Ошибки сервера
- ⚠️ Истекающие лицензии
- 📊 Превышение квот Gemini
- 🔔 Новые активации пользователей
```

---

## 🚨 Шаг 9: Безопасность

### 9.1 Ограничить доступ

```
Web App настройки:
- Execute as: Me (только владелец)
- Access: Anyone (но с проверкой лицензий)
- Добавить verification token если нужно
```

### 9.2 Защитить API ключи

```
✅ Gemini ключ только в Script Properties
✅ Никогда не в коде
✅ Регулярная ротация ключей
✅ Мониторинг использования
```

### 9.3 Backup данных

```
Еженедельно:
1. Экспорт License Sheet
2. Экспорт Bindings Sheet  
3. Backup серверного кода
4. Сохранять в безопасном месте
```

---

## 🧪 Шаг 10: Тестирование развертывания

### 10.1 Pre-deployment checklist

```
✅ Все файлы в /deploy/ актуальны
✅ Версии синхронизированы
✅ Тесты проходят локально
✅ API ключи настроены
✅ Лицензии готовы
✅ Документация обновлена
```

### 10.2 Post-deployment verification

```
✅ Сервер отвечает на запросы
✅ Мастер-таблица работает
✅ Пользователи могут активироваться
✅ OTA обновления работают
✅ Мониторинг показывает данные
```

### 10.3 User acceptance testing

```
Найти 3-5 тестовых пользователей:
1. Дать им доступ к системе
2. Попросить пройти базовые сценарии
3. Собрать обратную связь
4. Исправить проблемы
5. ✅ Готово к продакшену!
```

---

## 📞 Поддержка развертывания

### Частые проблемы

| Проблема | Решение |
|----------|---------|
| Web App не работает | Проверить OAuth2 настройки |
| Лицензии не активируются | Проверить access к License Sheet |
| OTA не обновляет | Проверить GitHub доступ и версии |
| Gemini API ошибки | Проверить API ключ и квоты |

### Контакты для помощи

- 🆘 Срочные проблемы: vk.com/daoqub
- 💬 Общие вопросы: GitHub Discussions  
- 🐛 Баги: Создать Issue
- 📧 Email: support@table-ai.com

---

## 📋 Deployment Timeline

### Первый раз (2-3 дня)
```
День 1: Настройка Google Cloud, Apps Script API
День 2: Создание сервера, настройка лицензий  
День 3: Мастер-таблица, тестирование, первые пользователи
```

### Регулярные обновления (1 день)
```
Утро: Разработка изменений
День: Тестирование, коммит
Вечер: Deploy сервера
Ночь: Автообновление клиентов
```

---

**Последнее обновление:** 30.11.2025 | Deployment Guide v3.2
