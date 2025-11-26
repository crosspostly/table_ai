
export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface TableAiFunction {
  id: string;
  name: string; // The actual function name in GAS
  label: string; // Display name
  description: string;
  icon: string;
  category: 'ai' | 'data' | 'settings';
  returnsHtml?: boolean; // If true, we expect HTML output to render
}

export interface ExecutionResult {
  success: boolean;
  result?:any;
  error?: string;
  logs?: string[];
}

export interface AppState {
  token: string | null;
  email: string | null;
  scriptId: string | null;
}

export enum PageState {
  HOME = 'HOME',
  VIEWER = 'VIEWER'
}

export interface DriveFile {
  id: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
}

export interface Sheet {
  properties: {
    sheetId: number;
    title: string;
    gridProperties: {
      rowCount: number;
      columnCount: number;
    }
  }
}

export enum Tab {
  DATA = 'DATA',
  ACTIONS = 'ACTIONS',
  SETTINGS = 'SETTINGS'
}

export interface ButtonInfo {
  label: string;
  functionName: string;
  description?: string;
  color?: string;
  icon?: string;
  category?: string;
  order?: number;
}

export interface ScriptProject {
  scriptId: string;
  title: string;
  parentId: string;
}

export interface ScriptFunction {
  name: string;
  label: string;
  description: string;
  category: 'ai' | 'data' | 'settings' | 'dev';
  menuPath: string;
  order: number;
  returnsHtml?: boolean;
}

export interface SearchScriptLog {
  timestamp: string;
  action: string;
  details: string;
  success?: boolean;
  error?: string;
}

export interface ScriptStatus {
  scriptId: string | null;
  available: boolean;
  lastChecked: string;
  searchLogs: SearchScriptLog[];
  functions: ScriptFunction[];
  error?: string;
}
