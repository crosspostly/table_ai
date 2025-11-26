import { Sheet } from '../types';

const BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export const extractSpreadsheetId = (url: string): string | null => {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
};

export const fetchSpreadsheetMetadata = async (spreadsheetId: string, token: string): Promise<Sheet[]> => {
  const response = await fetch(
    `${BASE_URL}/${spreadsheetId}?fields=sheets(properties(sheetId,title,gridProperties))`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch spreadsheet metadata');
  }

  const data = await response.json();
  return data.sheets || [];
};

export const readCell = async (spreadsheetId: string, sheetName: string, cellAddress: string, token: string): Promise<string> => {
  // Ensure strict encoding of sheet name to handle spaces or special chars
  const encodedSheetName = encodeURIComponent(sheetName);
  // Remove ! if user added it, though usually they just type "A1"
  const cleanAddress = cellAddress.replace('!', '');
  
  const range = `'${encodedSheetName}'!${cleanAddress}`;
  
  // Note: For the URL path, we need to encode the whole range or parts of it correctly. 
  // However, the Sheets API is a bit particular. Let's strictly encode the range component in the URL.
  const encodedRange = encodeURIComponent(`'${sheetName}'!${cleanAddress}`);
  
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodedRange}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read cell ${cleanAddress}`);
  }

  const data = await response.json();
  return data.values?.[0]?.[0] || '';
};

export const readSheetValues = async (spreadsheetId: string, sheetName: string, token: string): Promise<string[][]> => {
  const encodedRange = encodeURIComponent(`'${sheetName}'`);
  const url = `${BASE_URL}/${spreadsheetId}/values/${encodedRange}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read sheet ${sheetName}`);
  }

  const data = await response.json();
  return data.values || [];
};

export const writeCell = async (spreadsheetId: string, sheetName: string, cellAddress: string, value: string, token: string): Promise<boolean> => {
   const cleanAddress = cellAddress.replace('!', '');
   const encodedRange = encodeURIComponent(`'${sheetName}'!${cleanAddress}`);
   
   const response = await fetch(
      `${BASE_URL}/${spreadsheetId}/values/${encodedRange}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values: [[value]] })
      }
    );
    
    return response.ok;
};