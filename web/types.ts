export enum PageState {
  SETUP = 'setup',
  LOGIN = 'login',
  ENTER_URL = 'enter-url',
  MENU = 'menu',
  DYNAMIC_MENU = 'dynamic-menu',
  COLLECT_CONFIG = 'collect-config',
  REFRESH_CELL = 'refresh-cell',
  BATCH = 'batch',
  LOGS = 'logs',
  SETTINGS = 'settings',
  VIEW_DATA = 'view-data'
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface SheetProperties {
  sheetId: number;
  title: string;
  gridProperties?: {
    rowCount: number;
    columnCount: number;
  };
}

export interface Sheet {
  properties: SheetProperties;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  sheetName?: string;
  cellAddress?: string;
  oldValue?: string;
  newValue?: string;
}

export interface AppState {
  token: string | null;
  email: string | null;
  spreadsheetId: string | null;
  sheets: Sheet[];
  currentSheetName: string | null;
  webAppUrl?: string; // Apps Script Web App URL for button actions
}

export interface ButtonInfo {
  sheet: string;
  cell: string;
  function: string;
  icon: string;
  label: string;
  description: string;
  imageUrl: string;
  category: string;
  order: number;
}