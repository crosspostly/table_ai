/**
 * ТЕСТ ДЛЯ STANDALONE APPS SCRIPT ПРОЕКТА
 * Эта функция работает БЕЗ UI разрешений
 */
function testStandaloneProject() {
  try {
    // Проверим базовые API
    var result = "✅ ТЕСТЫ:\n\n";
    
    // 1. Utilities API
    result += "1. Utilities.getUuid(): " + Utilities.getUuid().substring(0, 8) + "...\n";
    
    // 2. Properties Service  
    PropertiesService.getScriptProperties().setProperty('test', 'ok');
    var prop = PropertiesService.getScriptProperties().getProperty('test');
    result += "2. PropertiesService: " + prop + "\n";
    
    // 3. Cache Service
    CacheService.getScriptCache().put('test', 'cached', 60);
    var cached = CacheService.getScriptCache().get('test');
    result += "3. CacheService: " + cached + "\n";
    
    // 4. Lock Service
    var lock = LockService.getScriptLock();
    result += "4. LockService: готов\n";
    
    // 5. HTML Service (БЕЗ UI)
    var html = HtmlService.createHtmlOutput('<h1>HTML сервис работает</h1>');
    result += "5. HtmlService: готов\n";
    
    result += "\n🎯 ПРОЕКТ РАБОТАЕТ В STANDALONE РЕЖИМЕ!\n";
    result += "❌ НО UI НЕДОСТУПЕН в standalone проектах\n";
    result += "✅ НУЖНО СОЗДАТЬ ПРОЕКТ ЧЕРЕЗ GOOGLE SHEETS";
    
    console.log(result);
    return result;
    
  } catch (error) {
    var errorMsg = "❌ ОШИБКА: " + error.message;
    console.log(errorMsg);
    return errorMsg;
  }
}

/**
 * СОЗДАНИЕ ПРОСТОГО ИНТЕРФЕЙСА БЕЗ UI РАЗРЕШЕНИЙ
 * Использует только UrlFetch и внешний HTML
 */
function createExternalInterface() {
  try {
    // Создаем HTML страницу
    var html = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Конструктор</title>
    <style>
        body { font-family: Arial; padding: 20px; }
        .section { margin: 15px 0; }
        input, textarea { width: 100%; padding: 8px; margin: 5px 0; }
        button { background: #4285f4; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <h2>🎯 AI Конструктор</h2>
    
    <div class="section">
        <label>System Prompt (лист!ячейка):</label>
        <input type="text" id="systemPrompt" placeholder="Prompts!A1" />
    </div>
    
    <div class="section">
        <label>Data Source (лист!диапазон):</label>
        <input type="text" id="dataSource" placeholder="Data!A:A" />
    </div>
    
    <div class="section">
        <label>Результат в ячейку (лист!ячейка):</label>
        <input type="text" id="targetCell" placeholder="Results!B3" />
    </div>
    
    <button onclick="executeConfig()">🚀 Запустить</button>
    
    <div id="result" style="margin-top: 20px;"></div>
    
    <script>
        function executeConfig() {
            const config = {
                systemPrompt: document.getElementById('systemPrompt').value,
                dataSource: document.getElementById('dataSource').value,
                targetCell: document.getElementById('targetCell').value
            };
            
            document.getElementById('result').innerHTML = 
                '<div style="color: green;">✅ Конфигурация: ' + JSON.stringify(config, null, 2) + '</div>';
        }
    </script>
</body>
</html>`;

    // Сохраняем HTML в Properties для доступа
    PropertiesService.getScriptProperties().setProperty('EXTERNAL_UI_HTML', html);
    
    // Создаем ссылку для доступа
    var result = "✅ ВНЕШНИЙ ИНТЕРФЕЙС СОЗДАН!\n\n";
    result += "📋 HTML код сохранен в Properties\n";
    result += "🔗 Скопируйте HTML из Properties и откройте в браузере\n";
    result += "⚡ Или используйте HtmlService.createHtmlOutput() в связанном с Sheets проекте";
    
    return result;
    
  } catch (error) {
    return "❌ Ошибка создания интерфейса: " + error.message;
  }
}

/**
 * Получить HTML код для внешнего интерфейса
 */
function getExternalHTML() {
  return PropertiesService.getScriptProperties().getProperty('EXTERNAL_UI_HTML');
}