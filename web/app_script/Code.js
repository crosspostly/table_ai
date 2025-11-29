/**
 * Google Apps Script Server-Side Code
 *
 * Instructions:
 * 1. Create a new Google Apps Script project.
 * 2. Copy the content of Index.html into a file named 'Index.html'.
 * 3. Copy the content of this file into 'Code.gs'.
 * 4. Deploy as Web App -> Execute as: 'Me' -> Who has access: 'Anyone'.
 */

/**
 * Serves the HTML page.
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Table AI Mobile')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Gets metadata for a spreadsheet (sheet names, IDs, dimensions).
 * @param {string} spreadsheetId
 */
function getSpreadsheetMetadata(spreadsheetId) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheets = ss.getSheets();

    // Map to a structure compatible with our frontend types
    return sheets.map((sheet) => ({
      properties: {
        sheetId: sheet.getSheetId(),
        title: sheet.getName(),
        gridProperties: {
          rowCount: sheet.getMaxRows(),
          columnCount: sheet.getMaxColumns(),
        },
      },
    }));
  } catch (err) {
    throw new Error('Не удалось открыть таблицу: ' + err.message);
  }
}

/**
 * Gets all values from a specific sheet as a 2D array of strings.
 * Uses getDisplayValues to preserve formatting (dates, currency).
 * @param {string} spreadsheetId
 * @param {string} sheetName
 */
function getSheetValues(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Лист "${sheetName}" не найден.`);
    }

    // getDataRange() gets only the area with data to save performance
    const range = sheet.getDataRange();

    // Check if sheet is completely empty
    if (!range) return [];

    return range.getDisplayValues();
  } catch (err) {
    throw new Error('Ошибка чтения данных: ' + err.message);
  }
}

/**
 * Updates a single cell value.
 * @param {string} spreadsheetId
 * @param {string} sheetName
 * @param {string} cellAddress (e.g., "A1", "B10")
 * @param {string} value
 */
function updateCell(spreadsheetId, sheetName, cellAddress, value) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Лист не найден');
    }

    const range = sheet.getRange(cellAddress);
    range.setValue(value);

    return true;
  } catch (err) {
    throw new Error('Ошибка записи: ' + err.message);
  }
}

/**
 * Helper to extract ID from a full URL if the user pastes that.
 * @param {string} url
 */
function extractIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}
