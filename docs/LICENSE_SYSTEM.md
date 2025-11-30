# 📦 Система лицензирования Table AI

## 📌 Обзор

**Система лицензирования** контролирует доступ к Table AI через:
- ✅ Email-based аутентификацию
- ✅ Токен-based валидацию  
- ✅ Ограничение количества копий
- ✅ Привязку к конкретным таблицам

---

## 🏗️ Компоненты системы

### 1. License Sheet (Таблица лицензий)

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ email           │ token        │ expires      │ copies_count │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ user@gmail.com  │ abc123...    │ 2025-12-31   │ 100          │
│ admin@company.com│ xyz789...    │ 2026-01-31   │ 1000         │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

**Поля:**
- `email` - Email пользователя (уникальный ключ)
- `token` - Случайный токен для аутентификации
- `expires` - Дата истечения лицензии
- `copies_count` - Доступное количество копий таблиц

### 2. Bindings Sheet (Привязки таблиц)

```
┌─────────────────┬──────────────┬──────────────┬──────────────┐
│ email           │ sheet_id     │ script_id    │ created_at   │
├─────────────────┼──────────────┼──────────────┼──────────────┤
│ user@gmail.com  │ sheet-123... │ script-456...│ 2025-11-30   │
│ user@gmail.com  │ sheet-789... │ script-abc...│ 2025-11-29   │
└─────────────────┴──────────────┴──────────────┴──────────────┘
```

**Поля:**
- `email` - Email пользователя
- `sheet_id` - ID таблицы (Spreadsheet ID)
- `script_id` - ID Apps Script проекта
- `created_at` - Дата создания привязки

---

## 🔄 Процесс лицензирования

### 1. Первая установка

```
Пользователь копирует таблицу
    ↓
Открывает копию
    ↓
onOpen() → installUpdateTrigger_()
    ↓
checkLicense() → проверка лицензии
    ↓
❌ НЕ НАЙДЕНО → показать ошибку
```

### 2. Активация лицензии

```
1. Пользователь получает license token
2. Вводит token в настройках: ⚙️ Настройки → 📦 Лицензионный токен
3. Система проверяет token:
   ├─ Token существует в License Sheet?
   ├─ Token не истёк?
   ├─ copies_count > 0?
   └─ ✅ Всё ОК → активировать
4. Создаётся запись в Bindings Sheet
5. copies_count уменьшается на 1
6. ✅ Таблица активирована!
```

### 3. Повторные проверки

```
Каждый запуск onOpen():
1. Получить email пользователя
2. Получить script_id текущей таблицы
3. Искать в Bindings Sheet:
   ├─ email + script_id найден?
   └─ ✅ Да → лицензия валидна
4. Если не найден:
   ├─ Проверить License Sheet
   ├─ Есть ли доступные копии?
   └─ ✅ Да → создать новую привязку
```

---

## 🔧 Управление лицензиями

### Для администратора

#### Добавить нового пользователя

```
// В License Sheet добавить строку:
email: newuser@company.com
token: generateRandomToken()  // 32 символа
expires: =TODAY()+365         // +1 год
copies_count: 10             // 10 копий
```

#### Генерация токена

```javascript
function generateLicenseToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
```

#### Продление лицензии

```
1. Найти пользователя в License Sheet
2. Обновить поле expires:
   =TODAY()+365  // +1 год
3. Обновить copies_count при необходимости
4. ✅ Готово!
```

#### Отзыв лицензии

```
1. License Sheet: установить copies_count = 0
2. Bindings Sheet: удалить все записи пользователя
3. ✅ Пользователь больше не может создавать новые копии
```

### Для пользователя

#### Проверить статус лицензии

```
1. ⚙️ Настройки
2. 📦 Статус лицензии
3. Показывает:
   - Email: user@gmail.com
   - Токен: abc...xyz (активен)
   - Истекает: 31.12.2025
   - Доступно копий: 7 из 10
```

#### Перенос на другой email

```
1. Связаться с администратором
2. Запросить смену email
3. Администратор обновляет License Sheet
4. ✅ Новые копии будут на новый email
```

---

## 🛡️ Безопасность

### Токен безопасность

```
✅ Токены генерируются случайно (32 символа)
✅ Хранятся только в Google Sheet (ограниченный доступ)
✅ Уникальный токен на пользователя
✅ Нет передачи токенов в открытом виде
```

### Привязка безопасности

```
✅ Каждая копия таблицы привязана к script_id
✅ Нельзя скопировать лицензию на другую таблицу
✅ Проверка email + script_id = уникальная пара
✅ Автоматическое обнаружение дубликатов
```

### Ограничения

```
✅ copies_count контролирует количество копий
✅ expires контролирует срок действия
✅ Автоматическая блокировка при превышении лимитов
✅ Логирование всех попыток активации
```

---

## 📊 Мониторинг

### Статистика лицензий

```
В License Sheet можно использовать сводные таблицы:

1. Количество активных пользователей:
   =COUNTA(A2:A) - 1  // минус заголовок

2. Общее количество копий:
   =SUM(D2:D)  // сумма copies_count

3. Истекающие в ближайшие 30 дней:
   =COUNTIF(C2:C, "<=" & TODAY()+30)

4. Самые активные пользователи:
   Сводная по email с количеством bindings
```

### Логи активации

```
В таблице "Логи" фильтр:
action = "LICENSE_CHECK" или "LICENSE_BIND"

Видим:
- timestamp: когда была проверка
- email: кто проверял
- script_id: какая таблица
- result: SUCCESS/FAILED
- details: причина ошибки
```

---

## 🚨 Частые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| TOKEN_NOT_FOUND | Токен не существует в License Sheet | Проверь правильность ввода токена |
| TOKEN_EXPIRED | Дата истечения прошла | Обнови expires в License Sheet |
| NO_COPIES_LEFT | copies_count = 0 | Увеличь лимит или пополните баланс |
| ALREADY_BOUND | Таблица уже привязана к другому email | Нужна помощь администратора |
| INVALID_EMAIL | Email не совпадает с лицензией | Используй правильный email |

---

## 🔧 API для разработчиков

### Проверка лицензии

```javascript
// server.gs
function checkLicense(email, scriptId) {
  // 1. Проверить bindings
  const binding = findBinding(email, scriptId);
  if (binding) {
    return {valid: true, source: 'binding'};
  }
  
  // 2. Проверить license
  const license = findLicense(email);
  if (!license) {
    return {valid: false, error: 'TOKEN_NOT_FOUND'};
  }
  
  if (license.expires < new Date()) {
    return {valid: false, error: 'TOKEN_EXPIRED'};
  }
  
  if (license.copies_count <= 0) {
    return {valid: false, error: 'NO_COPIES_LEFT'};
  }
  
  return {valid: true, source: 'license', license: license};
}
```

### Создание привязки

```javascript
// server.gs
function createBinding(email, scriptId) {
  const license = findLicense(email);
  if (!license || license.copies_count <= 0) {
    throw new Error('NO_COPIES_LEFT');
  }
  
  // Добавить в Bindings Sheet
  addBinding(email, scriptId);
  
  // Уменьшить количество копий
  license.copies_count--;
  updateLicense(license);
  
  return {success: true};
}
```

---

## 📞 Поддержка

- 🆘 Проблема с лицензией? → Свяжись с администратором
- 💬 Вопросы по использованию? → vk.com/daoqub
- 🐛 Ошибка в системе? → Создай Issue на GitHub

---

**Последнее обновление:** 30.11.2025 | License System v3.2
