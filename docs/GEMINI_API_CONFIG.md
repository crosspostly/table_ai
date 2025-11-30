# 🤖 Gemini API - Управление ключами

## 📌 Краткая информация

**Gemini API** - это сервис Google для работы с AI моделями (text, images, etc).

- ✅ Table AI использует Gemini 2.0 Flash для обработки данных
- ✅ Каждый запрос требует API ключ
- ✅ Есть два уровня ключей: личный (клиента) и серверный (по умолчанию)

---

## 🔑 Два типа ключей

### 📌 Серверный ключ (по умолчанию)

```
Где: Google Cloud Console → Google AI Studio
Кто: Администратор
Использование: Все клиенты (если личного нет)
Хранится: Server properties (server.gs)
```

**Установить:**
```
// Extensions → server.gs → Console
setDefaultGeminiKey_('sk-proj-YOUR_KEY_HERE')
```

### 🔑 Личный ключ (приоритетный)

```
Где: Личный Google AI Studio (пользователя)
Кто: Конечный пользователь
Использование: Только этот пользователь
Хранится: User properties (ClientTable)
```

**Установить:**
```
1. ⚙️ Настройки
2. 🤖 Gemini API Ключ
3. Вставляешь свой ключ
4. ✅ Сохраняешь
```

---

## 🎯 Приоритет ключей

```
Когда клиент вызывает Gemini API:

1️⃣ Проверить личный ключ
   ├─ Найден → Использовать его! ✅
   └─ Не найден → Перейти к шагу 2

2️⃣ Запросить у сервера
   ├─ Получен → Использовать серверный ✅
   └─ Ошибка → Показать ошибку ❌
```

---

## 🚀 Как получить ключи

### 1. Получить Gemini API ключ

```
1. Открыть: https://aistudio.google.com/app/apikey
2. Нажать: "Create API Key"
3. Выбрать проект (или создать новый)
4. Скопировать ключ (выглядит: "AIzaSy...")
5. Сохранить где-то безопасно!
```

### 2. Получить Google Cloud ключ (для продакшена)

```
1. Google Cloud Console: https://console.cloud.google.com
2. Create Project
3. Включить: Generative Language API
4. Service Account → Create Key → JSON
5. Использовать для продакшена
```

---

## 🔒 Безопасность ключей

### ✅ ДЕЛАЙ:
- ✅ Храни ключи в свойствах скриптов (не в коде!)
- ✅ Используй разные ключи для разработки и продакшена
- ✅ Регулярно ротируй ключи
- ✅ Устанавливай квоты и лимиты в Google Cloud

### ❌ НЕ ДЕЛАЙ:
- ❌ Не публикуй ключи в GitHub
- ❌ Не вставляй в видео или скриншоты
- ❌ Не используй один ключ везде
- ❌ Не забывай отключать старые ключи

---

## 📊 Управление квотами

### В Google Cloud Console:

```
1. Перейти в Google Cloud
2. Generative Language API
3. Quotas and limits
4. Установить лимиты по:
   - RPM (запросов в минуту)
   - Tokens per minute
   - Daily limit
```

### Типовые лимиты:

```
FREE TIER:
- 60 requests per minute
- 1 million tokens per month

PAID:
- 10,000 requests per minute
- 2 million tokens per month
```

---

## 🧪 Тестирование ключей

### 1. Отладка в DEV меню

```
// Extensions → Apps Script Console
debugGeminiKeys()

// Выведет:
// Client key configured: true/false
// Current key preview: AIzaSy...
// Source: CLIENT (personal) или SERVER (default)
// API Key obtained: YES/NO
```

### 2. Тестовый запрос

```
// Extensions → Apps Script Console
const key = getGeminiApiKey();
Logger.log('Key: ' + key.substring(0, 10) + '...');
// Проверить работает ли ключ
```

### 3. Проверка квот

```
Google Cloud Console → Quotas
Посмотреть:
- Usage today
- Limit
- Status (GREEN = ОК, RED = Превышено)
```

---

## ❌ Типовые ошибки

| Ошибка | Причина | Решение |
|--------|---------|---------|
| INVALID_API_KEY | Ключ неправильный | Проверь скопировал правильно |
| PERMISSION_DENIED | Ключ не активирован | Включи API в Google Cloud |
| QUOTA_EXCEEDED | Превышена квота | Увеличь лимиты или жди сброса |
| NOT_FOUND | Ключ удалён | Создай новый ключ |

---

## 🔄 Смена ключа

### Сменить серверный ключ

```
// Extensions → server.gs → Console
setDefaultGeminiKey_('sk-proj-NEW_KEY_HERE')
```

### Сменить личный ключ

```
1. ⚙️ Настройки
2. 🤖 Gemini API Ключ
3. Удалить текущий
4. Вставить новый
5. ✅ Сохранить
```

### Вернуться на серверный

```
1. ⚙️ Настройки
2. 🤖 Gemini API Ключ
3. Нажать: 🗑️ Удалить ключ
4. Система вернется на серверный автоматически
```

---

## 📞 Поддержка

- ❌ Ошибка API? → Проверь доступность в Google Cloud
- 💬 Нужен ключ? → https://aistudio.google.com/app/apikey
- 👨‍💻 Вопрос? → vk.com/daoqub

---

**Последнее обновление:** 30.11.2025 | Gemini Config v1.0
