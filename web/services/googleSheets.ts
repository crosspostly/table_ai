
import { ButtonInfo, DriveFile, Sheet, ScriptProject } from '../types';

const SCRIPTS_BASE_URL = 'https://script.googleapis.com/v1/scripts';
const PROJECTS_BASE_URL = 'https://script.googleapis.com/v1/projects';
const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3/files';

export const getUserSpreadsheets = async (token: string): Promise<DriveFile[]> => {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    orderBy: 'modifiedTime desc',
    pageSize: '50',
    fields: 'files(id, name, modifiedTime, mimeType)'
  });

  const response = await fetch(`${DRIVE_BASE_URL}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch spreadsheets');
  }

  const data = await response.json();
  return data.files || [];
};

export const getSpreadsheetMetadata = async (spreadsheetId: string, token: string): Promise<Sheet[]> => {
  const response = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch spreadsheet metadata');
  }

  const data = await response.json();
  return data.sheets || [];
};

export const getLinkedScriptId = async (spreadsheetId: string, token: string): Promise<string | null> => {
  // NOTE: The Google Apps Script API 'projects.list' endpoint does not support CORS 
  // when called directly from a browser. We cannot auto-detect the script ID client-side.
  // We return null to prompt the user to enter it manually.
  return null;
};

export const executeAppsScriptFunction = async (
  scriptId: string, 
  functionName: string, 
  parameters: any[] = [], 
  token: string
): Promise<{done: boolean, response: any}> => {
  
  const response = await fetch(`${SCRIPTS_BASE_URL}/${scriptId}:run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      function: functionName,
      parameters: parameters,
      devMode: true 
    })
  });

  if (!response.ok) {
     const text = await response.text();
     let errorMsg = text;
     try {
       const json = JSON.parse(text);
       errorMsg = json.error?.message || text;
     } catch(e) {}
     throw new Error(`Network API Error: ${errorMsg}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Script API Error: ${data.error.message}`);
  }
  
  if (data.response?.error) {
     throw new Error(`Script Execution Error: ${data.response.error.message}\n${data.response.error.details?.[0]?.errorMessage || ''}`);
  }

  return data;
};

export const executeGoogleScript = executeAppsScriptFunction;

export const readSheetValues = async (
  spreadsheetId: string,
  sheetName: string,
  range: string,
  token: string
): Promise<string[][]> => {
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!${range}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to fetch sheet values');
  }

  const data = await response.json();
  return data.values || [];
};

export const writeCell = async (
  spreadsheetId: string,
  sheetName: string,
  cellAddress: string,
  value: string,
  token: string
): Promise<void> => {
  const range = `${encodeURIComponent(sheetName)}!${cellAddress}`;
  const url = `${SHEETS_BASE_URL}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: [[value]]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to update cell');
  }
};

export const fetchSpreadsheetButtons = async (
  spreadsheetId: string,
  token: string
): Promise<ButtonInfo[]> => {
  try {
    // Try to read the _buttons sheet. If it fails (e.g. sheet doesn't exist), 
    // catch the error and return empty array instead of crashing.
    const values = await readSheetValues(spreadsheetId, '_buttons', 'A2:D20', token);
    return values.map(row => ({
      label: row[0] || 'Unnamed',
      functionName: row[1] || '',
      description: row[2] || '',
      color: row[3] || 'blue',
    })).filter(b => b.functionName);
  } catch (e) {
    // It's normal for this to fail if the user hasn't created the sheet yet.
    return [];
  }
};
