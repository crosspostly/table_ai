/**
 * Client-Server API Communications
 * Функции для связи между клиентским и серверным Apps Script
 * 
 * Version: 1.0.0
 * Created: 2024-10-18
 */

// URL серверного Apps Script проекта
const SERVER_URL = 'https://script.google.com/macros/s/1ncX8FGqT7QP-LxqrRJu0_z_FmUTGsbqmbWDCRePLfHgW8x85bX_Yu9uP/exec';

/**
 * Базовая функция для вызовов серверного API
 */
function callServerAPI(action, params = {}) {
  try {
    const payload = {
      action: action,
      params: params,
      clientId: getClientId(),
      timestamp: new Date().toISOString()
    };
    
    const response = UrlFetchApp.fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    if (response.getResponseCode() !== 200) {
      throw new Error('Server responded with code: ' + response.getResponseCode());
    }
    
    const result = JSON.parse(response.getContentText());
    
    if (result.success === false) {
      throw new Error(result.error || 'Server returned error');
    }
    
    return result;
    
  } catch (error) {
    Logger.log('ServerAPI Error: ' + error.message);
    throw new Error('Server API call failed: ' + error.message);
  }
}

/**
 * Получить уникальный ID клиента (на основе таблицы)
 */
function getClientId() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    return spreadsheet.getId();
  } catch (error) {
    return 'unknown_client';
  }
}

/**
 * Получить контекст активной ячейки
 */
function getActiveCellContext() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getActiveSheet();
    const range = sheet.getActiveRange();
    
    return {
      spreadsheetId: spreadsheet.getId(),
      sheetName: sheet.getName(),
      a1Notation: range.getA1Notation(),
      sheetId: sheet.getSheetId()
    };
  } catch (error) {
    Logger.log('getActiveCellContext error: ' + error.message);
    return null;
  }
}

/**
 * Получить список всех листов в таблице
 */
function getAllSheetNames() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = spreadsheet.getSheets();
    return sheets.map(sheet => sheet.getName());
  } catch (error) {
    Logger.log('getAllSheetNames error: ' + error.message);
    return [];
  }
}