# 🚀 РАЗВЕРТЫВАНИЕ КЛИЕНТ-СЕРВЕР АРХИТЕКТУРЫ

## 🏗️ АРХИТЕКТУРА ПРОЕКТА

Проект теперь использует современную клиент-серверную архитектуру:

### **📁 СТРУКТУРА ПАПОК:**
```
table/
├── client/     ← UI интерфейс (Apps Script для Google Sheets)
├── server/     ← серверная логика и AI обработка
└── shared/     ← общие функции
```

### **🔗 ДВА APPS SCRIPT ПРОЕКТА:**
- **Клиент:** `1DdlYfvo0EfEA1O1nb5DRI0o-WJoIivtfIPNSE1C1bt3IvvWC91sGE6Xs`
- **Сервер:** `1ncX8FGqT7QP-LxqrRJu0_z_FmUTGsbqmbWDCRePLfHgW8x85bX_Yu9uP`

## 📦 ФАЙЛЫ ПРОЕКТА

### **CLIENT (table/client/):**
```
✅ Main.gs                     ← меню в Google Sheets
✅ CollectConfigUI.gs          ← UI логика (без серверных функций)
✅ CollectConfigUI.html        ← интерфейс с dropdown селектами
✅ CollectConfigUI_ClientServer.gs ← API вызовы к серверу
✅ StandaloneTest.gs          ← тесты UI
✅ appsscript.json            ← разрешения для UI
```

### **SERVER (table/server/):**
```
✅ ServerAPI.gs               ← HTTP API обработчик (doPost)
✅ TemplateService.gs         ← управление шаблонами
✅ server.gs                  ← основная серверная логика
✅ MIGRATION.gs               ← миграции данных
✅ ocrRunV2_client.gs         ← OCR функции
✅ review_client.gs           ← функции обзора
✅ appsscript.json            ← серверные разрешения
```

### **SHARED (table/shared/):**
```
✅ ServerAPI.gs               ← клиентская часть API для связи
```

## 🔧 ИНСТРУКЦИИ ПО РАЗВЕРТЫВАНИЮ

### **ВАРИАНТ 1: РУЧНОЕ КОПИРОВАНИЕ**

#### **1. РАЗВЕРНУТЬ КЛИЕНТ:**
1. Откройте: https://script.google.com/d/1DdlYfvo0EfEA1O1nb5DRI0o-WJoIivtfIPNSE1C1bt3IvvWC91sGE6Xs/edit
2. Скопируйте ВСЕ файлы из `table/client/` и `table/shared/`
3. **ВАЖНО:** Переименуйте `CollectConfigUI_ClientServer.gs` → удалите старые server* функции из `CollectConfigUI.gs`

#### **2. РАЗВЕРНУТЬ СЕРВЕР:**
1. Откройте: https://script.google.com/d/1ncX8FGqT7QP-LxqrRJu0_z_FmUTGsbqmbWDCRePLfHgW8x85bX_Yu9uP/edit
2. Скопируйте ВСЕ файлы из `table/server/` и `table/shared/`
3. **ВАЖНО:** Опубликуйте как Web App с доступом "Anyone"

### **ВАРИАНТ 2: CLASP РАЗВЕРТЫВАНИЕ**

#### **УСТАНОВКА CLASP:**
```bash
npm install -g @google/clasp
clasp login
```

#### **РАЗВЕРТЫВАНИЕ КЛИЕНТА:**
```bash
# Установить конфигурацию клиента
cp system_integrations/.clasp-client.json .clasp.json
cp system_integrations/.claspignore-client .claspignore

# Развернуть
clasp push
```

#### **РАЗВЕРТЫВАНИЕ СЕРВЕРА:**
```bash
# Переключиться на серверную конфигурацию
cp system_integrations/.clasp-server.json .clasp.json
cp system_integrations/.claspignore-server .claspignore

# Развернуть
clasp push

# Опубликовать как Web App
clasp deploy
```

## 🔐 НАСТРОЙКА БЕЗОПАСНОСТИ

### **КЛИЕНТСКИЙ ПРОЕКТ:**
- Разрешения: UI, Spreadsheets, UrlFetch
- Привязан к Google Sheets (container-bound)

### **СЕРВЕРНЫЙ ПРОЕКТ:**
- Разрешения: Spreadsheets, Drive, External Requests
- Опубликован как Web App с доступом "Anyone"
- URL: https://script.google.com/macros/s/{SERVER_SCRIPT_ID}/exec

## 🔄 КАК ЭТО РАБОТАЕТ

1. **Пользователь** открывает интерфейс в Google Sheets
2. **Клиент** показывает UI с dropdown списками листов
3. **При запуске:** клиент отправляет HTTPS POST на сервер
4. **Сервер** получает данные из указанных ячеек
5. **Сервер** обрабатывает через AI
6. **Сервер** записывает результат обратно в клиентскую таблицу

## 📊 ПРЕИМУЩЕСТВА НОВОЙ АРХИТЕКТУРЫ

✅ **Масштабируемость:** сервер может обслуживать множество клиентов  
✅ **Безопасность:** данные передаются через HTTPS  
✅ **Централизованность:** шаблоны и настройки на сервере  
✅ **Производительность:** AI обработка не блокирует клиентский UI  
✅ **Разделение ролей:** UI отдельно от бизнес-логики  

## 🧪 ТЕСТИРОВАНИЕ

После развертывания:
1. Откройте любую Google Таблицу
2. Меню → Extensions → Apps Script → выберите клиентский проект  
3. Функция `openCollectConfigUI()` → Run
4. Должен открыться интерфейс с dropdown списками
5. Настройте и запустите - сервер обработает и запишет результат

## 🛠️ TROUBLESHOOTING

**Ошибка "Server API call failed":**
- Проверьте что серверный проект опубликован как Web App
- Проверьте URL в `table/shared/ServerAPI.gs`

**UI не открывается:**
- Проверьте разрешения в `appsscript.json` клиента
- Убедитесь что проект container-bound к Google Sheets

**Нет dropdown списков:**
- Проверьте что `getAllSheetNames()` функция есть в клиенте
- Проверьте JavaScript в HTML файле

## 📝 ДАЛЬНЕЙШИЕ УЛУЧШЕНИЯ

- [ ] Добавить кэширование API вызовов
- [ ] Реализовать batch обработку нескольких ячеек  
- [ ] Добавить мониторинг и логирование
- [ ] Создать админ-панель для управления сервером
- [ ] Интегрировать с external AI APIs

---

**🎉 Клиент-серверная архитектура готова к production!**