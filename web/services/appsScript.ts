import { ButtonInfo } from '../types';

/**
 * Extract spreadsheet ID from Google Sheets URL
 */
export const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

/**
 * Extract deployment ID from Apps Script Web App URL
 */
export const extractDeploymentId = (url: string): string | null => {
  const match = url.match(/\/macros\/s\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

/**
 * Get the Web App URL for a spreadsheet's Apps Script
 * This should be deployed from the container-bound script
 */
export const getAppsScriptWebAppUrl = (spreadsheetId: string): string => {
  // Try to get from localStorage first (user might have configured it)
  const savedUrl = localStorage.getItem(`webAppUrl_${spreadsheetId}`);
  if (savedUrl) {
    return savedUrl;
  }
  
  // For development/testing, you can configure this manually
  // In production, this should be obtained from the spreadsheet or user input
  const developmentUrl = localStorage.getItem('developmentWebAppUrl');
  if (developmentUrl) {
    return developmentUrl;
  }
  
  // Default placeholder - in production this should be replaced with actual deployment URL
  // The user needs to deploy the Apps Script as Web App and configure this URL
  return 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID_HERE/exec';
};

/**
 * Set the Web App URL for a spreadsheet
 */
export const setAppsScriptWebAppUrl = (spreadsheetId: string, webAppUrl: string): void => {
  localStorage.setItem(`webAppUrl_${spreadsheetId}`, webAppUrl);
  localStorage.setItem('webAppUrl', webAppUrl); // For backwards compatibility
};

/**
 * Fetch dynamic buttons from the spreadsheet's Apps Script Web App
 */
export const fetchSheetButtons = async (webAppUrl: string): Promise<ButtonInfo[]> => {
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'exportButtonsJSON'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || 'Failed to fetch buttons');
    }

    // Parse the JSON string from data field
    const buttons = JSON.parse(result.data || '[]');
    return buttons;
    
  } catch (error) {
    console.error('Error fetching sheet buttons:', error);
    throw error;
  }
};

/**
 * Call a function through the Apps Script Web App
 */
export const callAppsScriptFunction = async (
  webAppUrl: string, 
  functionName: string, 
  args?: any[]
): Promise<any> => {
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'callFunction',
        functionName,
        args
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || `Failed to call function ${functionName}`);
    }

    return result.result;
    
  } catch (error) {
    console.error(`Error calling function ${functionName}:`, error);
    throw error;
  }
};

/**
 * Get sheet data through the Apps Script Web App
 */
export const getSheetData = async (
  webAppUrl: string, 
  sheetName: string, 
  range: string = 'A1:Z100'
): Promise<string[][]> => {
  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getSheetData',
        sheetName,
        range
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || `Failed to get sheet data for ${sheetName}`);
    }

    return result.data || [];
    
  } catch (error) {
    console.error(`Error getting sheet data for ${sheetName}:`, error);
    throw error;
  }
};