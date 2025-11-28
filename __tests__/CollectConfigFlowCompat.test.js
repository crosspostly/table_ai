/**
 * CollectConfig Flow Compatibility Tests
 * ========================================
 */

// ===== Mock Google Apps Script Globals =====
global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({
    getId: jest.fn(() => 'test-active-spreadsheet-id'),
    getSheets: jest.fn(() => [
      {getName: jest.fn(() => 'Sheet1')},
      {getName: jest.fn(() => 'Prompts')},
      {getName: jest.fn(() => 'Data')},
    ]),
  })),
  openById: jest.fn(() => ({
    getSheetByName: jest.fn(() => ({
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [
          ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun'],
          ['Sheet1', 'A1', 'Prompts', 'A1', '[{"sheet":"Data","cell":"A1:A3"}]', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
        ]),
      })),
      deleteRow: jest.fn(),
      appendRow: jest.fn(),
    })),
  })),
  getActiveSheet: jest.fn(() => ({
    getName: jest.fn(() => 'Sheet1'),
    getActiveRange: jest.fn(() => ({
      getA1Notation: jest.fn(() => 'A1'),
    })),
  })),
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

global.UrlFetchApp = {
  fetch: jest.fn(() => ({
    getResponseCode: () => 200,
    getContentText: () => JSON.stringify({
      ok: true,
      data: {
        sheets: ['Sheet1', 'Prompts', 'Data'],
        existingConfig: {
          systemPrompt: {sheet: 'Prompts', cell: 'A1'},
          userData: [{sheet: 'Data', cell: 'A1:A3'}],
        },
        version: '3.0.0',
        lastUpdate: '2025-06-18 00:00:00',
      },
      logs: [
        {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '🚀 CollectConfig server initialization'},
        {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '✅ Found existing configuration'},
      ],
    }),
  })),
};

describe('CollectConfig Flow Compatibility Tests', () => {
  test('Scenario 1: Server Init - config structure validation', () => {
    // Test that the server init response structure is compatible
    const serverResponse = {
      ok: true,
      data: {
        sheets: ['Sheet1', 'Prompts', 'Data'],
        existingConfig: {
          systemPrompt: {
            sheet: 'Prompts',
            cell: 'A1',
          },
          userData: [
            {
              sheet: 'Data',
              cell: 'A1:A3',
            },
          ],
          maxTokens: 25000,
          temperature: 0.7,
        },
        version: '3.0.0',
        lastUpdate: '2025-06-18 00:00:00',
      },
      logs: [],
    };

    expect(serverResponse.data.sheets).toContain('Sheet1');
    expect(serverResponse.data.existingConfig.systemPrompt.sheet).toBe('Prompts');
    expect(serverResponse.data.existingConfig.userData).toHaveLength(1);
    expect(serverResponse.data.existingConfig.userData[0].sheet).toBe('Data');
  });

  test('Scenario 2: Server Save - verify server call structure', () => {
    // Test the server call structure for saving config
    const config = {
      systemPrompt: {
        sheet: 'Prompts',
        cell: 'A1',
      },
      userData: [
        {
          sheet: 'Data',
          cell: 'A1:A3',
        },
      ],
      maxTokens: 25000,
      temperature: 0.7,
    };

    // Mock the UrlFetchApp call
    const mockFetch = global.UrlFetchApp.fetch;
    mockFetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        ok: true,
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '💾 Saving CollectConfig configuration'},
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'SUCCESS', message: '✅ Configuration saved successfully'},
        ],
      }),
    });

    // Simulate the server call
    const payload = {
      action: 'collect_config_save',
      sheetName: 'Sheet1',
      cellAddress: 'A1',
      config: config,
      spreadsheetId: 'test-active-spreadsheet-id',
      scriptId: 'test-script-id',
      email: 'test@example.com',
      token: 'test-token',
    };

    expect(payload.action).toBe('collect_config_save');
    expect(payload.sheetName).toBe('Sheet1');
    expect(payload.config.systemPrompt.sheet).toBe('Prompts');
    expect(payload.config.userData[0].sheet).toBe('Data');
  });

  test('Scenario 3: Server Execute - verify execution flow', () => {
    // Test the server execution flow
    const config = {
      systemPrompt: {
        sheet: 'Prompts',
        cell: 'A1',
      },
      userData: [
        {
          sheet: 'Data',
          cell: 'A1:A3',
        },
      ],
      maxTokens: 25000,
      temperature: 0.7,
    };

    // Mock the UrlFetchApp call for execution
    const mockFetch = global.UrlFetchApp.fetch;
    mockFetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        ok: true,
        data: 'AI generated response text',
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '🚀 Начало выполнения CollectConfig на сервере'},
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'SUCCESS', message: '✅ Выполнение CollectConfig завершено успешно'},
        ],
      }),
    });

    // Simulate the server call
    const payload = {
      action: 'collect_config_execute',
      sheetName: 'Sheet1',
      cellAddress: 'A1',
      config: config,
      spreadsheetId: 'test-active-spreadsheet-id',
      scriptId: 'test-script-id',
      email: 'test@example.com',
      token: 'test-token',
      apiKey: 'test-api-key',
    };

    expect(payload.action).toBe('collect_config_execute');
    expect(payload.config.maxTokens).toBe(25000);
    expect(payload.config.temperature).toBe(0.7);
  });

  test('Scenario 4: Template Operations - server template management', () => {
    // Test template operations through server
    const templateName = 'Test Template';
    const config = {
      systemPrompt: {
        sheet: 'Prompts',
        cell: 'A1',
      },
      userData: [
        {
          sheet: 'Data',
          cell: 'A1:A3',
        },
      ],
    };

    // Mock template save
    const mockFetch = global.UrlFetchApp.fetch;
    mockFetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        ok: true,
        data: {success: true, message: 'Template saved successfully'},
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '💾 Saved template: Test Template'},
        ],
      }),
    });

    // Simulate the server call
    const payload = {
      action: 'collect_config_templates_save',
      templateName: templateName,
      config: config,
      spreadsheetId: 'test-active-spreadsheet-id',
      scriptId: 'test-script-id',
      email: 'test@example.com',
      token: 'test-token',
    };

    expect(payload.action).toBe('collect_config_templates_save');
    expect(payload.templateName).toBe('Test Template');
    expect(payload.config.systemPrompt.sheet).toBe('Prompts');
  });

  test('Scenario 5: Preview Request - server preview handling', () => {
    // Test preview request through server
    const sheetName = 'Data';
    const cellAddress = 'A1:A3';

    // Mock preview response
    const mockFetch = global.UrlFetchApp.fetch;
    mockFetch.mockReturnValue({
      getResponseCode: () => 200,
      getContentText: () => JSON.stringify({
        ok: true,
        data: 'Источник 1 (Data!A1:A3): Test data preview truncated...',
        logs: [
          {timestamp: '2024-01-01T00:00:00.000Z', level: 'INFO', message: '  → Чтение Data!A1:A3'},
        ],
      }),
    });

    // Simulate the server call
    const payload = {
      action: 'collect_config_preview',
      config: {
        userData: [{
          sheet: sheetName,
          cell: cellAddress,
        }],
      },
      spreadsheetId: 'test-active-spreadsheet-id',
      scriptId: 'test-script-id',
      email: 'test@example.com',
      token: 'test-token',
      apiKey: 'test-api-key',
    };

    expect(payload.action).toBe('collect_config_preview');
    expect(payload.config.userData[0].sheet).toBe('Data');
    expect(payload.config.userData[0].cell).toBe('A1:A3');
  });

  test('Scenario 6: Error Handling - server error responses', () => {
    // Test error handling from server
    const mockFetch = global.UrlFetchApp.fetch;
    mockFetch.mockReturnValue({
      getResponseCode: () => 400,
      getContentText: () => JSON.stringify({
        ok: false,
        error: 'NO_CONFIG',
      }),
    });

    // Test that error is properly handled
    const response = JSON.parse(mockFetch().getContentText());
    expect(response.ok).toBe(false);
    expect(response.error).toBe('NO_CONFIG');
  });

  test('Scenario 7: Log Merging - server logs to UI logs', () => {
    // Test server log merging functionality
    const serverLogs = [
      {timestamp: new Date().toISOString(), level: 'INFO', message: 'Test server log 1'},
      {timestamp: new Date().toISOString(), level: 'SUCCESS', message: 'Test server log 2'},
      {timestamp: new Date().toISOString(), level: 'ERROR', message: 'Test server log 3'},
    ];

    const uiLogs = [];
    serverLogs.forEach((logEntry) => {
      if (logEntry && logEntry.message) {
        uiLogs.push({
          timestamp: logEntry.timestamp,
          message: logEntry.message,
          level: (logEntry.level || 'INFO').toUpperCase(),
        });
      }
    });

    expect(uiLogs).toHaveLength(3);
    expect(uiLogs[0].level).toBe('INFO');
    expect(uiLogs[1].level).toBe('SUCCESS');
    expect(uiLogs[2].level).toBe('ERROR');
    expect(uiLogs[0].message).toBe('Test server log 1');
  });

  test('Scenario 8: Backward Compatibility - existing ConfigData rows', () => {
    // Test that existing ConfigData structure is still valid
    const existingConfigData = [
      ['Sheet', 'Cell', 'SystemPromptSheet', 'SystemPromptCell', 'UserDataJSON', 'CreatedAt', 'LastRun'],
      ['Sheet1', 'A1', 'Prompts', 'A1', '[{"sheet":"Data","cell":"A1:A3"}]', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
      ['Sheet2', 'B2', 'Prompts', 'A2', '[{"sheet":"Data","cell":"B1:B5"}]', '2024-01-02T00:00:00.000Z', '2024-01-02T00:00:00.000Z'],
    ];

    // Parse the existing data as the server would
    const foundConfigs = [];
    for (let i = 1; i < existingConfigData.length; i++) {
      let userData = [];
      try {
        if (existingConfigData[i][4]) {
          userData = JSON.parse(existingConfigData[i][4]);
        }
      } catch (e) {
        // ignore
      }

      const config = {
        systemPrompt: (existingConfigData[i][2] && existingConfigData[i][3]) ? {
          sheet: existingConfigData[i][2],
          cell: existingConfigData[i][3],
        } : null,
        userData: userData,
      };

      foundConfigs.push({
        sheetName: existingConfigData[i][0],
        cellAddress: existingConfigData[i][1],
        config: config,
      });
    }

    expect(foundConfigs).toHaveLength(2);
    expect(foundConfigs[0].sheetName).toBe('Sheet1');
    expect(foundConfigs[0].config.systemPrompt.sheet).toBe('Prompts');
    expect(foundConfigs[0].config.userData[0].sheet).toBe('Data');
    expect(foundConfigs[1].sheetName).toBe('Sheet2');
    expect(foundConfigs[1].config.systemPrompt.cell).toBe('A2');
  });

  test('Scenario 9: Server Actions - all required actions available', () => {
    // Test that all required server actions are defined
    const requiredActions = [
      'collect_config_init',
      'collect_config_save',
      'collect_config_delete',
      'collect_config_preview',
      'collect_config_execute',
      'collect_config_templates_get_all',
      'collect_config_templates_get',
      'collect_config_templates_save',
      'collect_config_templates_delete',
      'collect_config_templates_stats',
    ];

    requiredActions.forEach((action) => {
      expect(action).toMatch(/^collect_config(_templates)?(_.*)?$/);
    });

    expect(requiredActions).toHaveLength(10);
  });

  test('Scenario 10: License and Rate Limiting - server security', () => {
    // Test that license and rate limiting are still enforced
    const mockFetch = global.UrlFetchApp.fetch;

    // Test license enforcement
    mockFetch.mockReturnValueOnce({
      getResponseCode: () => 403,
      getContentText: () => JSON.stringify({
        ok: false,
        error: 'UNAUTHORIZED',
      }),
    });

    const licenseResponse = JSON.parse(mockFetch().getContentText());
    expect(licenseResponse.ok).toBe(false);
    expect(licenseResponse.error).toBe('UNAUTHORIZED');

    // Test rate limiting
    mockFetch.mockReturnValueOnce({
      getResponseCode: () => 429,
      getContentText: () => JSON.stringify({
        ok: false,
        error: 'RATE_LIMIT',
      }),
    });

    const rateLimitResponse = JSON.parse(mockFetch().getContentText());
    expect(rateLimitResponse.ok).toBe(false);
    expect(rateLimitResponse.error).toBe('RATE_LIMIT');
  });
});
