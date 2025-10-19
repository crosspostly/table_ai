# 📋 ЭТАП 2: CLIENT ОЧИСТКА - АНАЛИЗ И ПЛАН

**Файл:** deploy/Main.gs (1064 строк)

---

## 📊 Классификация функций

### ✅ UI ФУНКЦИИ (ОСТАВИТЬ НА CLIENT)
```
onOpen() - главное меню
onEdit(e) - триггеры при редактировании
openSettingsUI() - открытие окна настроек
getSettingsData() - чтение настроек
saveSettingsData() - сохранение настроек
showLogsDialog() - показ логов
exportLogsToSheet() - экспорт логов
clearLogs() - очистка логов
showActiveTriggersDialog() - показ триггеров
showGeminiKeyHelp() - справка по ключу
checkLicenseStatusUI() - показ статуса лицензии
refreshSelectedGMTriggers() - обновление триггера
applyUniformFormatting() - форматирование
```

### ❌ БИЗНЕС-ЛОГИКА (ПЕРЕМЕСТИТЬ НА SERVER)
```
GM() - вызов Gemini
serverGM_() - прокси к Gemini (уже на SERVER!)
gmCacheKey_() - кэширование
gmCacheGet_() - чтение кэша
gmCachePut_() - сохранение кэша
initGeminiKey() - инициализация ключа
getLicenseEmail() - чтение email лицензии
getLicenseToken() - чтение токена лицензии
setLicenseCredentialsUI() - установка лицензии (UI + логика)
serverStatus_() - проверка статуса (уже вызывает SERVER!)
importVkPosts() - импорт VK постов
createStopWordsFormulas() - создание формул фильтрации
prepareChainSmart() - подготовка цепи (бизнес-логика)
prepareChainFromPromptBox() - подготовка цепи
prepareChainForA3() - подготовка цепи
clearChainForA3() - очистка цепи
```

### 🔧 УТИЛИТЫ (МОЖНО ОСТАВИТЬ ИЛИ ПЕРЕМЕСТИТЬ)
```
addLog() - логирование в кэш
getVkParserUrl_() - получение URL
getLogs() - чтение логов
convertMarkdownToReadableText() - обработка текста
isMarkdownText() - проверка markdown
processGeminiResponse() - обработка ответа Gemini
getCompletionPhrase() - получение фразы готовности
isCompletionReady() - проверка готовности
GM_IF() - условный вызов Gemini (ВАЖНАЯ ФУНКЦИЯ!)
columnToLetter() - конвертация букв
letterToColumn() - конвертация букв
parseTargetA1() - парсинг A1 ссылок
getGeminiApiKey() - получение API ключа
cleanupOldTriggers() - очистка триггеров
showActiveTriggersDialog() - показ триггеров
refreshCurrentGMCell() - обновление ячейки
runDevSelfTest() - DEV тесты
```

### 🔴 ДУБЛИРОВАНИЕ/ОШИБКИ
```
❌ Две функции GM():
  1. Локальный вызов Gemini (строка ~553)
  2. Прокси вызов SERVER (строка ~985)
  
  Нужна консолидация!

❌ setLicenseCredentialsUI() + serverStatus_():
  - UI показ + логика перемешаны
  - Нужно разделить
```

---

## 🎯 ПЛАН ДЕЙСТВИЙ ЭТАПА 2

### Шаг 1: Изучить GM() функцию
- Версия 1 (~553): локальный вызов Gemini + кэширование
- Версия 2 (~985): прокси к SERVER (с fallback на локальный в DEV)
- **Действие:** выбрать одну, лучшую версию

### Шаг 2: Разделить функции
```
CLIENT остаёт (UI):
  ✅ onOpen()
  ✅ onEdit()
  ✅ openSettingsUI()
  ✅ getSettingsData() / saveSettingsData()
  ✅ checkLicenseStatusUI()
  ✅ showLogsDialog()
  ✅ showGeminiKeyHelp()
  ✅ applyUniformFormatting()
  
  ⚠️ refreshCurrentGMCell() - нужно сделать более лёгким
  ⚠️ prepareChainSmart() - нужно оставить (Sheet-зависимое)

CLIENT удалить (переместить или не нужна):
  ❌ addLog() - заменить на shared/LoggingService
  ❌ GM() - вызывать через SERVER
  ❌ gmCacheKey_, gmCacheGet_, gmCachePut_() - на SERVER
  ❌ initGeminiKey() - переместить в Settings UI
  ❌ importVkPosts() - оставить, но упростить (вызывает VK_PARSER напрямую)
  ❌ createStopWordsFormulas() - оставить (Sheet-зависимое)
  ❌ prepareChainFromPromptBox() - оставить (Sheet-зависимое)
  ❌ prepareChainForA3() - оставить (Sheet-зависимое)
  ❌ clearChainForA3() - оставить (Sheet-зависимое)
```

### Шаг 3: Создать новый структурированный Main.gs
```
Структура:
  1. Constants & Initialization (что нужно)
  2. UI Functions (menus, dialogs)
  3. Settings Management (credentials, status)
  4. Sheet Operations (formulas, formatting)
  5. Helper Functions (markdown, parsing)
```

### Шаг 4: Обновить server.gs
```
Добавить:
  ✅ GM() улучшенная версия на SERVER
  ✅ Кэширование на SERVER
  ✅ Logging на SERVER
  ✅ Rate limiting на SERVER
```

---

## 📈 ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ

### ДО (deploy/Main.gs):
```
1064 строк
- 200+ строк бизнес-логики
- 300+ строк утилит
- Дублирование (2x GM())
- Смешанная ответственность
```

### ПОСЛЕ (deploy/Main.gs):
```
700-800 строк
- Только UI и Sheet операции
- Чистая структура
- Нет дублирования
- Ясная ответственность
```

### server.gs:
```
Увеличится на:
- 100-150 строк (улучшенный GM)
- 50-100 строк (кэширование)
- 50 строк (логирование)
```

---

## ✅ CHECKLIST ЭТАПА 2

- [ ] Выбрать лучшую версию GM()
- [ ] Посмотреть весь код GM() и serverGM_()
- [ ] Создать план для каждой функции (оставить/удалить/переместить)
- [ ] Начать рефакторить Main.gs
- [ ] Обновить server.gs
- [ ] Протестировать GM() через SERVER
- [ ] Протестировать settings
- [ ] Протестировать VK import
- [ ] Коммитить промежуточные результаты
- [ ] Создать PR

---

**Начинаем с изучения GM()! 👇**
