// ========================================
// УНИВЕРСАЛЬНЫЙ WEB APP ДЛЯ TABLE AI
// Деплоится 1 раз, работает для всех!
// ========================================

function doGet(e) {
  return ContentService.createTextOutput(
    JSON.stringify({ok: true, message: 'Table AI Universal API'})
  ).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const spreadsheetId = data.spreadsheetId;
    
    // Проверка что spreadsheetId передан
    if (!spreadsheetId) {
      return errorResponse('SPREADSHEET_ID_REQUIRED');
    }
    
    switch (action) {
      case 'getButtons':
        return getButtonsFromSpreadsheet(spreadsheetId);
      
      case 'callFunction':
        return callSpreadsheetFunction(
          spreadsheetId, 
          data.functionName, 
          data.parameters
        );
      
      case 'getData':
        return getSpreadsheetData(
          spreadsheetId, 
          data.sheetName, 
          data.range
        );
      
      default:
        return errorResponse('UNKNOWN_ACTION');
    }
  } catch (error) {
    return errorResponse(error.message);
  }
}

/**
 * Получить кнопки из таблицы пользователя
 */
function getButtonsFromSpreadsheet(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const buttons = [];
    
    // Перебираем все листы
    ss.getSheets().forEach(function(sheet) {
      const sheetName = sheet.getName();
      
      try {
        // Получаем все изображения
        const images = sheet.getImages();
        
        images.forEach(function(image, imageIndex) {
          try {
            // Читаем alt-text
            const altText = image.getAltTextDescription();
            
            // Если это JSON метаданные
            if (altText && altText.trim().startsWith('{')) {
              const metadata = JSON.parse(altText);
              
              if (metadata.function) {
                const anchor = image.getAnchorCell();
                const row = anchor.getRow();
                const col = anchor.getColumn();
                
                buttons.push({
                  sheet: sheetName,
                  cell: columnToLetter(col) + row,
                  function: metadata.function,
                  icon: metadata.icon || '▶️',
                  label: metadata.label || metadata.function,
                  description: metadata.description || '',
                  category: metadata.category || 'general',
                  order: metadata.order || 99,
                  imageUrl: tryGetImageUrl(image)
                });
              }
            }
          } catch (imageError) {
            Logger.log('Error processing image: ' + imageError);
          }
        });
      } catch (sheetError) {
        Logger.log('Error processing sheet: ' + sheetError);
      }
    });
    
    return successResponse(JSON.stringify(buttons));
  } catch (error) {
    return errorResponse('FAILED_TO_READ_SPREADSHEET: ' + error.message);
  }
}

/**
 * Вызвать функцию в таблице пользователя
 * ВНИМАНИЕ: Работает только если функция существует!
 */
function callSpreadsheetFunction(spreadsheetId, functionName, parameters) {
  try {
    // Открываем таблицу
    const ss = SpreadsheetApp.openById(spreadsheetId);
    
    // ПРОБЛЕМА: Мы не можем вызвать функции из ЧУЖОГО Apps Script!
    // Apps Script не даёт вызывать функции из другого container-bound скрипта
    
    // РЕШЕНИЕ: Вернуть ошибку с инструкцией
    return errorResponse(
      'FUNCTION_CALL_NOT_SUPPORTED. ' +
      'Пожалуйста, установите Table AI Add-on в свою таблицу для поддержки кнопок.'
    );
  } catch (error) {
    return errorResponse('FAILED_TO_CALL_FUNCTION: ' + error.message);
  }
}

/**
 * Получить данные из таблицы
 */
function getSpreadsheetData(spreadsheetId, sheetName, range) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return errorResponse('SHEET_NOT_FOUND: ' + sheetName);
    }
    
    const dataRange = sheet.getRange(range);
    const values = dataRange.getValues();
    
    return successResponse(JSON.stringify(values));
  } catch (error) {
    return errorResponse('FAILED_TO_READ_DATA: ' + error.message);
  }
}

// ========================================
// HELPER ФУНКЦИИ
// ========================================

function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function tryGetImageUrl(image) {
  try {
    return image.getUrl();
  } catch (e) {
    return '';
  }
}

function successResponse(data) {
  return ContentService.createTextOutput(
    JSON.stringify({ok: true, data: data})
  ).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(error) {
  return ContentService.createTextOutput(
    JSON.stringify({ok: false, error: error})
  ).setMimeType(ContentService.MimeType.JSON);
}
