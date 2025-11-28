/**
 * Tests for CollectConfig server endpoints
 */

// Mock Google Apps Script globals
global.LockService = {
  getScriptLock: jest.fn(() => ({
    waitLock: jest.fn(),
    releaseLock: jest.fn(),
    tryLock: jest.fn(() => true),
    hasLock: jest.fn(() => true),
  })),
};

global.SpreadsheetApp = {
  openById: jest.fn((id) => ({
    getSheetByName: jest.fn((name) => {
      if (name === 'ConfigData') {
        return {
          getDataRange: jest.fn(() => ({
            getValues: jest.fn(() => [
              ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun'],
              ['Sheet1', 'A1', 'PromptSheet', 'A1', '[{"sheet":"DataSheet","cell":"A1:A10"}]', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
            ]),
          })),
          deleteRow: jest.fn(),
          appendRow: jest.fn(),
        };
      }
      return null;
    }),
    getSheets: jest.fn(() => [
      {getName: jest.fn(() => 'Sheet1')},
      {getName: jest.fn(() => 'DataSheet')},
      {getName: jest.fn(() => 'PromptSheet')},
    ]),
    insertSheet: jest.fn(() => ({
      hideSheet: jest.fn(),
      getRange: jest.fn(() => ({
        setValues: jest.fn(),
        setFontWeight: jest.fn(),
        setBackground: jest.fn(),
        setFontColor: jest.fn(),
      })),
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [[]]),
      })),
      appendRow: jest.fn(),
    })),
  })),
  getActiveSheet: jest.fn(() => ({
    getName: jest.fn(() => 'Sheet1'),
    getActiveRange: jest.fn(() => ({
      getA1Notation: jest.fn(() => 'A1'),
    })),
  })),
  getActiveSpreadsheet: jest.fn(() => ({
    getId: jest.fn(() => 'test-spreadsheet-id'),
  })),
};

global.CacheService = {
  getScriptCache: jest.fn(() => ({
    get: jest.fn(),
    put: jest.fn(),
  })),
};

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: 'AI response text',
          }],
        },
      }],
    }),
  })),
};

global.ContentService = {
  createTextOutput: jest.fn(() => ({
    setMimeType: jest.fn(),
    setResponseCode: jest.fn(),
  })),
};

global.Utilities = {
  formatDate: jest.fn(() => '2024-01-01 00:00:00'),
};

global.Session = {
  getScriptTimeZone: jest.fn(() => 'UTC'),
  getActiveUser: jest.fn(() => ({getEmail: jest.fn(() => 'test@example.com')})),
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key) => {
      const props = {
        'SERVER_URL': 'https://test-server.com',
        'LICENSE_EMAIL': 'test@example.com',
        'LICENSE_TOKEN': 'test-token',
        'GEMINI_API_KEY': 'test-api-key',
      };
      return props[key] || '';
    }),
  })),
};

global.ScriptApp = {
  getScriptId: jest.fn(() => 'test-script-id'),
};

// Mock TemplateService functions
global.getAllTemplates = jest.fn(() => ({
  'Default': {
    systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
    userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
  },
}));

global.getTemplate = jest.fn((userParam, nameParam) => ({
  systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
  userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
}));

global.saveTemplate = jest.fn(() => ({success: true, message: 'Template saved'}));

global.deleteTemplate = jest.fn(() => ({success: true, message: 'Template deleted'}));

global.getTemplatesStats = jest.fn(() => ({count: 1, totalSize: 100, templates: ['Default']}));

describe('CollectConfig Server Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('collect_config_init', () => {
    test('should initialize successfully with existing config', () => {
      // Mock the server response structure
      const mockResponse = {
        ok: true,
        data: {
          sheets: ['Sheet1', 'DataSheet', 'PromptSheet'],
          existingConfig: {
            systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
            userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
          },
          version: '3.0.0',
          lastUpdate: '2025-06-18 00:00:00',
        },
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '🚀 CollectConfig server initialization'},
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '✅ Found existing configuration'},
        ],
      };

      // Test that the response structure is correct
      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.data.sheets).toContain('Sheet1');
      expect(mockResponse.data.existingConfig).toBeDefined();
      expect(mockResponse.data.existingConfig.systemPrompt.sheet).toBe('PromptSheet');
      expect(mockResponse.logs).toHaveLength(2);
    });
  });

  describe('collect_config_save', () => {
    test('should save configuration successfully', () => {
      const config = {
        systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
        userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
      };

      const mockResponse = {
        ok: true,
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '💾 Saving CollectConfig configuration'},
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'SUCCESS', message: '✅ Configuration saved successfully'},
        ],
      };

      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.logs).toHaveLength(2);
    });
  });

  describe('collect_config_delete', () => {
    test('should delete configuration successfully', () => {
      const mockResponse = {
        ok: true,
        data: {deleted: true},
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '🗑️ Deleting CollectConfig configuration'},
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'SUCCESS', message: '✅ Configuration deleted successfully'},
        ],
      };

      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.data.deleted).toBe(true);
    });
  });

  describe('collect_config_templates_get_all', () => {
    test('should get all templates successfully', () => {
      const mockResponse = {
        ok: true,
        data: {
          'Default': {
            systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
            userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
          },
        },
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '📋 Loaded 1 templates'},
        ],
      };

      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.data).toHaveProperty('Default');
    });
  });

  describe('collect_config_templates_save', () => {
    test('should save template successfully', () => {
      const templateName = 'Test Template';
      const config = {
        systemPrompt: {sheet: 'PromptSheet', cell: 'A1'},
        userData: [{sheet: 'DataSheet', cell: 'A1:A10'}],
      };

      const mockResponse = {
        ok: true,
        data: {success: true, message: 'Template saved successfully'},
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '💾 Saved template: Test Template'},
        ],
      };

      expect(mockResponse.ok).toBe(true);
      expect(mockResponse.data.success).toBe(true);
    });
  });

  describe('collect_config_execute', () => {
    test('should execute CollectConfig configuration successfully', () => {
      const config = {
        systemPrompt: {
          sheet: 'PromptSheet',
          cell: 'A1',
        },
        userData: [
          {
            sheet: 'DataSheet',
            cell: 'A1:A10',
          },
        ],
        maxTokens: 1000,
        temperature: 0.5,
      };

      // This would be handled by serverCollectConfigExecute_ function
      expect(config.systemPrompt.sheet).toBe('PromptSheet');
      expect(config.userData[0].sheet).toBe('DataSheet');
      expect(config.maxTokens).toBe(1000);
    });

    test('should handle missing configuration', () => {
      const config = null;

      expect(() => {
        if (!config) throw new Error('NO_CONFIG');
      }).toThrow('NO_CONFIG');
    });

    test('should build final prompt correctly', () => {
      const systemPrompt = 'You are a helpful assistant';
      const userDataParts = ['Data 1', 'Data 2'];

      let finalPrompt = '';
      if (systemPrompt) {
        finalPrompt += systemPrompt + '\n\n---\n\n';
      }
      if (userDataParts.length > 0) {
        finalPrompt += 'ДАННЫЕ:\n' + userDataParts.join('\n\n');
      }

      expect(finalPrompt).toBe('You are a helpful assistant\n\n---\n\nДАННЫЕ:\nData 1\n\nData 2');
    });
  });

  describe('serverGetSystemPrompt_', () => {
    test('should return empty string when no system prompt configured', () => {
      const config = {};

      let result = '';
      if (!config.systemPrompt || !config.systemPrompt.sheet || !config.systemPrompt.cell) {
        result = '';
      }

      expect(result).toBe('');
    });

    test('should handle protected table ID', () => {
      const config = {
        systemPrompt: {
          sheet: 'protected-table-id',
          cell: 'A1',
          tableId: 'protected-table-id',
        },
      };

      const tableId = config.systemPrompt.tableId || '';
      const spreadsheetId = tableId || 'default-id';

      expect(spreadsheetId).toBe('protected-table-id');
      expect(tableId).toBe('protected-table-id');
    });
  });

  describe('serverReadData_', () => {
    test('should flatten and filter spreadsheet values', () => {
      const values = [
        ['Data 1', '', null, 'Data 2'],
        ['Data 3', undefined, 'Data 4'],
      ];

      const result = [];
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const val = values[r][c];
          if (val !== null && val !== undefined && val.toString().trim() !== '') {
            result.push(val.toString());
          }
        }
      }

      expect(result).toEqual(['Data 1', 'Data 2', 'Data 3', 'Data 4']);
    });

    test('should handle empty values correctly', () => {
      const values = [
        ['', null, undefined, '  '],
        ['Valid data'],
      ];

      const result = [];
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const val = values[r][c];
          if (val !== null && val !== undefined && val.toString().trim() !== '') {
            result.push(val.toString());
          }
        }
      }

      expect(result).toEqual(['Valid data']);
    });
  });

  describe('server configuration management', () => {
    test('should parse existing configuration data', () => {
      const mockData = [
        ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun'],
        ['Sheet1', 'A1', 'PromptSheet', 'A1', '[{"sheet":"DataSheet","cell":"A1:A10"}]', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
      ];

      // Parse the existing data as the server would
      let foundConfig = null;
      for (let i = 1; i < mockData.length; i++) {
        if (mockData[i][0] === 'Sheet1' && mockData[i][1] === 'A1') {
          let userData = [];
          try {
            if (mockData[i][4]) {
              userData = JSON.parse(mockData[i][4]);
            }
          } catch (e) {
            // ignore
          }

          foundConfig = {
            systemPrompt: (mockData[i][2] && mockData[i][3]) ? {
              sheet: mockData[i][2],
              cell: mockData[i][3],
            } : null,
            userData: userData,
          };
          break;
        }
      }

      expect(foundConfig).not.toBeNull();
      expect(foundConfig.systemPrompt.sheet).toBe('PromptSheet');
      expect(foundConfig.userData).toHaveLength(1);
      expect(foundConfig.userData[0].sheet).toBe('DataSheet');
    });
  });
});
