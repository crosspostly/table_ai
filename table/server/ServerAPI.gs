/**
 * Server-Side API Handler
 * Обработчик HTTP запросов от клиентских Apps Script проектов
 * 
 * Version: 1.0.0
 * Created: 2024-10-18
 */

/**
 * Главный обработчик POST запросов (для Web App)
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { action, params, clientId, timestamp } = data;
    
    Logger.log(`API Request: ${action} from client ${clientId} at ${timestamp}`);
    
    let result;
    
    switch (action) {
      case 'getAllTemplates':
        result = handleGetAllTemplates(params, clientId);
        break;
        
      case 'getTemplate':
        result = handleGetTemplate(params, clientId);
        break;
        
      case 'saveTemplate':
        result = handleSaveTemplate(params, clientId);
        break;
        
      case 'deleteTemplate':
        result = handleDeleteTemplate(params, clientId);
        break;
        
      case 'executeConfig':
        result = handleExecuteConfig(params, clientId);
        break;
        
      case 'getTemplatesStats':
        result = handleGetTemplatesStats(params, clientId);
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    Logger.log(`API Error: ${error.message}`);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Обработчик получения всех шаблонов
 */
function handleGetAllTemplates(params, clientId) {
  const user = getUserFromClientId(clientId);
  return getAllTemplates(user);
}

/**
 * Обработчик получения конкретного шаблона
 */
function handleGetTemplate(params, clientId) {
  const user = getUserFromClientId(clientId);
  const { templateName } = params;
  return getTemplate(user, templateName);
}

/**
 * Обработчик сохранения шаблона
 */
function handleSaveTemplate(params, clientId) {
  const user = getUserFromClientId(clientId);
  const { templateName, config } = params;
  return saveTemplate(user, templateName, config);
}

/**
 * Обработчик удаления шаблона
 */
function handleDeleteTemplate(params, clientId) {
  const user = getUserFromClientId(clientId);
  const { templateName } = params;
  return deleteTemplate(user, templateName);
}

/**
 * Обработчик выполнения конфигурации
 */
function handleExecuteConfig(params, clientId) {
  const user = getUserFromClientId(clientId);
  const { config, cellInfo } = params;
  
  // Адаптируем для серверной обработки
  // TODO: Здесь нужно реализовать логику выполнения AI запроса
  // и записи результата в указанную таблицу
  
  return executeConfigOnServer(config, cellInfo, user);
}

/**
 * Обработчик статистики шаблонов
 */
function handleGetTemplatesStats(params, clientId) {
  const user = getUserFromClientId(clientId);
  return getTemplatesStats(user);
}

/**
 * Получить пользователя по Client ID (Spreadsheet ID)
 */
function getUserFromClientId(clientId) {
  // Для простоты используем Client ID как часть user ID
  // В реальном приложении здесь может быть более сложная логика
  return `client_${clientId.slice(-8)}`;
}

/**
 * Выполнить конфигурацию на сервере и записать результат в клиентскую таблицу
 */
function executeConfigOnServer(config, cellInfo, user) {
  try {
    // 1. Получить данные из клиентской таблицы
    const clientData = getDataFromClientSpreadsheet(cellInfo.spreadsheetId, config);
    
    // 2. Выполнить AI обработку
    const aiResult = processWithAI(config, clientData);
    
    // 3. Записать результат обратно в клиентскую таблицу
    writeResultToClientSpreadsheet(
      cellInfo.spreadsheetId, 
      cellInfo.sheetName, 
      cellInfo.a1Notation, 
      aiResult
    );
    
    return { 
      success: true, 
      message: `Результат записан в ячейку ${cellInfo.a1Notation}`,
      result: aiResult 
    };
    
  } catch (error) {
    Logger.log('executeConfigOnServer error: ' + error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Получить данные из клиентской таблицы
 */
function getDataFromClientSpreadsheet(spreadsheetId, config) {
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const data = {};
    
    // System Prompt
    if (config.systemPrompt && config.systemPrompt.sheet && config.systemPrompt.cell) {
      const sheet = spreadsheet.getSheetByName(config.systemPrompt.sheet);
      if (sheet) {
        data.systemPrompt = sheet.getRange(config.systemPrompt.cell).getValue();
      }
    }
    
    // User Data
    data.userData = [];
    if (config.userData && config.userData.length > 0) {
      config.userData.forEach(ud => {
        if (ud.sheet && ud.cell) {
          const sheet = spreadsheet.getSheetByName(ud.sheet);
          if (sheet) {
            const value = sheet.getRange(ud.cell).getDisplayValue();
            data.userData.push(value);
          }
        }
      });
    }
    
    return data;
    
  } catch (error) {
    throw new Error(`Failed to read from client spreadsheet: ${error.message}`);
  }
}

/**
 * Записать результат в клиентскую таблицу
 */
function writeResultToClientSpreadsheet(spreadsheetId, sheetName, a1Notation, result) {
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found`);
    }
    
    sheet.getRange(a1Notation).setValue(result);
    
  } catch (error) {
    throw new Error(`Failed to write to client spreadsheet: ${error.message}`);
  }
}

/**
 * Обработка с помощью AI (заглушка - нужно адаптировать существующий код)
 */
function processWithAI(config, data) {
  // TODO: Реализовать AI обработку
  // Это должно использовать существующую логику из server.gs
  
  const prompt = data.systemPrompt || 'Обработай данные';
  const userData = data.userData.join(', ') || 'Нет данных';
  
  return `AI Result: ${prompt} -> ${userData}`;
}