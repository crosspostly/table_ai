# 🔐 Приватный GitHub репозиторий - Полное руководство

## ВАЖНО: Разделение ролей

```
👨‍💻 АДМИНИСТРАТОР (СЕРВЕР):
- Создаёт приватный репо на GitHub
- Получает Personal Access Token (PAT)
- Устанавливает PAT на сервер (один раз)

👤 ПОЛЬЗОВАТЕЛЬ (КЛИЕНТ):
- Просто копирует таблицу и открывает
- Система автоматически обновляется ночью
- НИЧЕГО не нужно делать!
```

## Шаг 1: Администратор - Получить PAT

```
1. Откройте GitHub → https://github.com/settings/tokens
2. Нажмите "Generate new token (classic)"
3. Scope: выберите "repo" (full control of private repositories)
4. Сгенерируйте токен
5. Скопируйте токен: ghp_...
   (⚠️ Будет виден только один раз!)
```

## Шаг 2: Администратор - Установить PAT на сервер

### Вариант A: Через Google Apps Script консоль

```
1. Откройте Extensions → Apps Script (server.gs)
2. Нажмите "Console" (внизу экрана)
3. Введите команду:
   setGithubPAT('ghp_YOUR_TOKEN_HERE')
4. Нажмите Enter
5. В консоли должно показать: ✅ GitHub PAT set: ghp_...
```

### Вариант B: Проверить что PAT работает

```
1. В консоли введите:
   testGithubAccess()
2. Результат:
   {ok: true, working: true}
```

## Шаг 3: Администратор - Включить приватный репо

```
// В файле: deploy/server.gs
// Строка ~20

const REPO_IS_PUBLIC = false;  // ← ИЗМЕНИ на false!
```

После этого сохраните и выполните новый Deploy.

## Шаг 4: Администратор - Deploy

```
1. Extensions → Apps Script
2. Deploy → Manage deployments
3. Создайте новый deployment (или обновите существующий)
4. Убедитесь что scope 'https://www.googleapis.com/auth/script.projects' добавлен
```

## Шаг 5: Пользователи - НИЧЕГО не делают!

```
✅ Копируют таблицу
✅ Открывают её
✅ Система сама обновляется каждую ночь в 3:00 (по часовому поясу)
```

---

## 🔑 Хранение PAT

**PAT хранится в:**
```
Google Apps Script Properties (Server)
Ключ: GITHUB_PAT
Только сервер может получить доступ!
```

**PAT НЕ передаётся клиенту!**
```
КЛИЕНТ никогда не получит PAT
КЛИЕНТ не может скачивать приватные файлы
ТОЛЬКО сервер знает про PAT
```

---

## 🧪 Тестирование

### Проверить что всё работает

```javascript
// Extensions → server.gs → Console

// 1. Проверить что PAT установлен
testGithubAccess()

// 2. Скачать один файл для теста
downloadFileFromGithub_('server.gs', false)

// 3. Если результаты > 1000 символов - это успех!
```

### Проверить на клиенте

```javascript
// Extensions (in user's spreadsheet) → Main.gs → Console

// 1. Ручная проверка обновлений
checkForUpdatesManual_()

// 2. Если система показывает версию - всё работает!
```

---

## 🛠️ Устранение проблем

### ❌ Ошибка: "GitHub auth failed"

**Причина:** PAT неправильный или истёк срок действия

**Решение:**
```
1. Создать новый PAT на GitHub
2. setGithubPAT('ghp_NEW_TOKEN')
3. testGithubAccess()
```

### ❌ Ошибка: "No GitHub PAT configured"

**Причина:** PAT не установлен

**Решение:**
```
1. setGithubPAT('ghp_YOUR_TOKEN')
2. testGithubAccess()
```

### ❌ Ошибка: "Failed to fetch: Main.gs"

**Причина:** 
- Файл не найден в репо
- Неправильный REPO_IS_PUBLIC
- Проблема с правами доступа

**Решение:**
```
1. Проверить что файл есть в репо
2. testGithubAccess() для диагностики
3. Проверить что REPO_IS_PUBLIC = false
```

---

## 📚 Архитектура обновлений v3.5

### КЛИЕНТ (Main.gs в таблице пользователя)

```javascript
checkForUpdatesBackground_()
  ├─ Проверяет версию на сервере
  └─ Если нужно → просит сервер обновить

checkForUpdatesManual_()
  ├─ Вызывается из меню "Обновить вручную"
  └─ Показывает диалог и запускает фоновое обновление
```

**КЛИЕНТ НЕ:**
- ❌ Не скачивает файлы с GitHub
- ❌ Не знает про PAT
- ❌ Не обновляет себя сам
- ❌ Не знает про приватный репо

### СЕРВЕР (server.gs + ota_updates.gs)

```javascript
server.gs
  ├─ case 'ota'
  │   ├─ checkUpdates → проверяет версию (ОК!)
  │   └─ applyUpdates → запускает обновление
  └─ setGithubPAT() → установка PAT для админа

ota_updates.gs (новый модуль)
  ├─ downloadFileFromGithub_() → скачивает файл
  ├─ downloadFromPublicRepo_() → для публичного репо
  ├─ downloadFromPrivateRepo_() → для приватного репо (использует PAT!)
  ├─ downloadAllClientFiles_() → скачивает все 12 файлов
  ├─ updateClientScript_() → обновляет клиента через API
  └─ applyUpdatesToClient_() → ГЛАВНАЯ функция для обновления
```

**СЕРВЕР:**
- ✅ Знает про PAT
- ✅ Скачивает файлы с GitHub
- ✅ Обновляет клиента через Apps Script API
- ✅ Логирует результаты

---

## 🎯 Flow обновления

```
1. Каждый день в 3:00
   └─ onOpen() установил триггер
   └─ checkForUpdatesBackground_() запускается

2. КЛИЕНТ спрашивает версию
   └─ POST /ota → checkUpdates
   └─ СЕРВЕР проверяет версию
   └─ Результат: updateAvailable: true/false

3. Если нужно обновление
   └─ КЛИЕНТ просит сервер
   └─ POST /ota → applyUpdates

4. СЕРВЕР полностью обновляет КЛИЕНТА
   └─ Проверить лицензию
   └─ Скачать файлы с GitHub (если приватный → с PAT)
   └─ Обновить скрипт клиента через API
   └─ Логировать результат

5. КЛИЕНТ узнает результат
   └─ Готово!
```

---

## 📋 Чеклист для администратора

```bash
✅ 1. Создал приватный репо на GitHub
✅ 2. Получил Personal Access Token (PAT)
✅ 3. setGithubPAT('ghp_...')
✅ 4. testGithubAccess() → {ok: true}
✅ 5. Установил const REPO_IS_PUBLIC = false
✅ 6. Выполнил новый Deploy
✅ 7. setupServerTriggers() - если нужно
✅ 8. Отправил пользователям обновленную таблицу
✅ 9. Пользователи открыли таблицу
✅ 10. checkForUpdatesManual_() - проверить что работает
```

---

## 📞 Поддержка

Если что-то не работает:

1. Проверьте логи: Extensions → Apps Script → Logs
2. Запустите testGithubAccess() на сервере
3. Запустите checkForUpdatesManual_() на клиенте
4. Все ошибки будут в логах

---

**Помните:** PAT хранится ТОЛЬКО на сервере, клиент ничего не знает! 🔐
