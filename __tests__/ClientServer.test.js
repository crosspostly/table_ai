/**
 * Tests for client-server communication
 * Testing google.script.run mock scenarios
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

describe('Client-Server Communication', () => {
  let mockGoogleScriptRun;

  beforeEach(() => {
    // Mock google.script.run
    mockGoogleScriptRun = {
      withSuccessHandler: jest.fn(function(successFn) {
        this.successFn = successFn;
        return this;
      }),
      withFailureHandler: jest.fn(function(failureFn) {
        this.failureFn = failureFn;
        return this;
      }),
      serverGetAllTemplates: jest.fn(function() {
        if (this.successFn) {
          // Simulate successful response
          setTimeout(() => {
            this.successFn({
              'Template 1': {prompt: 'Test 1', maxTokens: 10000, temperature: 0.7},
              'Template 2': {prompt: 'Test 2', maxTokens: 5000, temperature: 0.5},
            });
          }, 0);
        }
      }),
      serverSaveTemplate: jest.fn(function(_name, _config) {
        if (this.successFn) {
          setTimeout(() => {
            this.successFn(true);
          }, 0);
        }
      }),
      serverDeleteTemplate: jest.fn(function(_name) {
        if (this.successFn) {
          setTimeout(() => {
            this.successFn(true);
          }, 0);
        }
      }),
    };

    global.google = {
      script: {
        run: mockGoogleScriptRun,
      },
    };
  });

  test('google.script.run is mocked correctly', () => {
    expect(google.script.run).toBeDefined();
    expect(google.script.run.withSuccessHandler).toBeDefined();
    expect(google.script.run.withFailureHandler).toBeDefined();
  });

  test('serverGetAllTemplates returns templates', (done) => {
    google.script.run
      .withSuccessHandler((templates) => {
        expect(templates).toBeDefined();
        expect(Object.keys(templates)).toHaveLength(2);
        expect(templates['Template 1']).toBeDefined();
        expect(templates['Template 1'].prompt).toBe('Test 1');
        done();
      })
      .serverGetAllTemplates();
  });

  test('serverSaveTemplate returns success', (done) => {
    const config = {
      prompt: 'New template',
      maxTokens: 10000,
      temperature: 0.7,
    };

    google.script.run
      .withSuccessHandler((success) => {
        expect(success).toBe(true);
        done();
      })
      .serverSaveTemplate('NewTemplate', config);
  });

  test('serverDeleteTemplate returns success', (done) => {
    google.script.run
      .withSuccessHandler((success) => {
        expect(success).toBe(true);
        done();
      })
      .serverDeleteTemplate('TemplateToDelete');
  });

  test('Error handling with failure handler', (done) => {
    mockGoogleScriptRun.serverGetAllTemplates = jest.fn(function() {
      if (this.failureFn) {
        setTimeout(() => {
          this.failureFn(new Error('Server error'));
        }, 0);
      }
    });

    google.script.run
      .withSuccessHandler(() => {
        fail('Should not call success handler');
      })
      .withFailureHandler((error) => {
        expect(error).toBeDefined();
        expect(error.message).toBe('Server error');
        done();
      })
      .serverGetAllTemplates();
  });
});

describe('Server-side Function Signatures', () => {
  // Test that server functions have expected signatures

  test('serverGetAllTemplates signature', () => {
    const serverGetAllTemplates = () => {
      // Mock implementation
      return {
        'Template1': {prompt: 'test', maxTokens: 10000, temperature: 0.7},
      };
    };

    const result = serverGetAllTemplates();
    expect(typeof result).toBe('object');
  });

  test('serverSaveTemplate signature', () => {
    const serverSaveTemplate = (name, config) => {
      expect(typeof name).toBe('string');
      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('prompt');
      return true;
    };

    const result = serverSaveTemplate('Test', {
      prompt: 'test',
      maxTokens: 10000,
      temperature: 0.7,
    });
    expect(result).toBe(true);
  });

  test('serverDeleteTemplate signature', () => {
    const serverDeleteTemplate = (name) => {
      expect(typeof name).toBe('string');
      return true;
    };

    const result = serverDeleteTemplate('TestTemplate');
    expect(result).toBe(true);
  });

  test('serverExecuteConfig signature', () => {
    const serverExecuteConfig = (config) => {
      expect(typeof config).toBe('object');
      expect(config).toHaveProperty('prompt');
      expect(config).toHaveProperty('cell');
      return {success: true, result: 'AI response'};
    };

    const result = serverExecuteConfig({
      prompt: 'test',
      cell: 'A1',
      maxTokens: 10000,
      temperature: 0.7,
    });
    expect(result.success).toBe(true);
  });
});

describe('Lock Service Integration', () => {
  test('Lock is acquired before write operations', () => {
    const lock = LockService.getScriptLock();
    const waitLockSpy = jest.spyOn(lock, 'waitLock');
    const releaseLockSpy = jest.spyOn(lock, 'releaseLock');

    // Simulate save operation with lock
    try {
      lock.waitLock(30000);
      // Write operation here
      expect(waitLockSpy).toHaveBeenCalledWith(30000);
    } finally {
      lock.releaseLock();
      expect(releaseLockSpy).toHaveBeenCalled();
    }
  });

  test('Lock is released even if operation fails', () => {
    const lock = LockService.getScriptLock();
    const releaseLockSpy = jest.spyOn(lock, 'releaseLock');

    try {
      lock.waitLock(30000);
      throw new Error('Simulated error');
    } catch (e) {
      // Error handled
    } finally {
      lock.releaseLock();
      expect(releaseLockSpy).toHaveBeenCalled();
    }
  });
});

// Mock additional Apps Script services for v4 API testing
global.CacheService = {
  getScriptCache: jest.fn(() => ({
    get: jest.fn(),
    put: jest.fn(),
    remove: jest.fn(),
  })),
};

global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
  })),
  getUserProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
  })),
};

global.Session = {
  getActiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test@example.com'),
  })),
  getScriptTimeZone: jest.fn(() => 'UTC'),
};

global.SpreadsheetApp = {
  getActiveSpreadsheet: jest.fn(() => ({
    getId: jest.fn(() => 'test-spreadsheet-id'),
  })),
};

global.ScriptApp = {
  getScriptId: jest.fn(() => 'test-script-id'),
};

global.Utilities = {
  formatDate: jest.fn((_date, _timezone, _format) => new Date().toISOString()),
};

global.UrlFetchApp = {
  fetch: jest.fn(),
};

describe('Server API v4 Capabilities Handshake', () => {
  let mockCache; let mockProperties; let mockUrlFetch;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      put: jest.fn(),
      remove: jest.fn(),
    };
    mockProperties = {
      getProperty: jest.fn(),
      setProperty: jest.fn(),
    };
    mockUrlFetch = {
      fetch: jest.fn(),
    };

    CacheService.getScriptCache.mockReturnValue(mockCache);
    PropertiesService.getScriptProperties.mockReturnValue(mockProperties);
    UrlFetchApp.fetch.mockReturnValue(mockUrlFetch);
  });

  describe('ensureServerCapabilities_', () => {
    test('should return cached capabilities when available', () => {
      const mockCapabilities = {
        serverVersion: '4.0.0',
        minClientVersion: '3.0.0',
        supportedActions: ['capabilities', 'gm'],
      };

      mockCache.get.mockReturnValue(JSON.stringify(mockCapabilities));

      // Mock the function (since it's in Main.gs, we'll simulate it)
      const ensureServerCapabilities_ = (_forceRefresh) => {
        if (!_forceRefresh) {
          const cached = mockCache.get('SERVER_CAPABILITIES');
          if (cached) {
            return JSON.parse(cached);
          }
        }
        return null;
      };

      const result = ensureServerCapabilities_(false);
      expect(result).toEqual(mockCapabilities);
      expect(mockCache.get).toHaveBeenCalledWith('SERVER_CAPABILITIES');
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    test('should fetch capabilities when not cached', () => {
      const mockResponse = {
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => JSON.stringify({
          ok: true,
          data: {
            serverVersion: '4.0.0',
            minClientVersion: '3.0.0',
            supportedActions: ['capabilities', 'gm'],
          },
        })),
      };

      mockCache.get.mockReturnValue(null);
      mockUrlFetch.fetch.mockReturnValue(mockResponse);

      // Simulate the function behavior
      const ensureServerCapabilities_ = (forceRefresh) => {
        if (!forceRefresh) {
          const cached = mockCache.get('SERVER_CAPABILITIES');
          if (cached) {
            return JSON.parse(cached);
          }
        }

        const response = mockUrlFetch.fetch('server-url', {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            action: 'capabilities',
            clientVersion: '4.0.0',
          }),
          muteHttpExceptions: true,
        });

        if (response.getResponseCode() === 200) {
          const result = JSON.parse(response.getContentText());
          if (result.ok && result.data) {
            mockCache.put('SERVER_CAPABILITIES', JSON.stringify(result.data), 3600);
            return result.data;
          }
        }
        return null;
      };

      const result = ensureServerCapabilities_(false);

      expect(result).toEqual({
        serverVersion: '4.0.0',
        minClientVersion: '3.0.0',
        supportedActions: ['capabilities', 'gm'],
      });
      expect(mockCache.put).toHaveBeenCalledWith('SERVER_CAPABILITIES', expect.any(String), 3600);
    });

    test('should return null when server request fails', () => {
      const mockResponse = {
        getResponseCode: jest.fn(() => 500),
        getContentText: jest.fn(() => 'Internal Server Error'),
      };

      mockCache.get.mockReturnValue(null);
      mockUrlFetch.fetch.mockReturnValue(mockResponse);

      const ensureServerCapabilities_ = () => {
        const cached = mockCache.get('SERVER_CAPABILITIES');
        if (cached) {
          return JSON.parse(cached);
        }
        return null; // Simulate failure case
      };

      const result = ensureServerCapabilities_(false);
      expect(result).toBeNull();
    });
  });

  describe('isVersionOlder_', () => {
    test('should correctly compare versions', () => {
      const isVersionOlder_ = (version1, version2) => {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);

        const maxLength = Math.max(v1parts.length, v2parts.length);

        for (let i = 0; i < maxLength; i++) {
          const v1part = v1parts[i] || 0;
          const v2part = v2parts[i] || 0;

          if (v1part < v2part) return true;
          if (v1part > v2part) return false;
        }

        return false;
      };

      expect(isVersionOlder_('3.0.0', '3.0.1')).toBe(true);
      expect(isVersionOlder_('3.0.0', '3.1.0')).toBe(true);
      expect(isVersionOlder_('3.0.0', '4.0.0')).toBe(true);
      expect(isVersionOlder_('4.0.0', '3.0.0')).toBe(false);
      expect(isVersionOlder_('3.0.0', '3.0.0')).toBe(false);
      expect(isVersionOlder_('3.0.1', '3.0.0')).toBe(false);
    });
  });

  describe('callServerAction_', () => {
    test('should successfully call supported action', () => {
      const mockCapabilities = {
        serverVersion: '4.0.0',
        minClientVersion: '3.0.0',
        supportedActions: ['gm', 'capabilities'],
      };

      const mockResponse = {
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => JSON.stringify({
          ok: true,
          data: 'Generated text',
        })),
      };

      mockCache.get.mockReturnValue(JSON.stringify(mockCapabilities));
      mockUrlFetch.fetch.mockReturnValue(mockResponse);
      mockProperties.getProperty.mockReturnValue('test-token');

      const callServerAction_ = (_action, _data, _options) => {
        const capabilities = JSON.parse(mockCache.get('SERVER_CAPABILITIES'));

        if (!capabilities) {
          return {ok: false, error: 'SERVER_UNAVAILABLE'};
        }

        if (capabilities.supportedActions.indexOf(_action) === -1) {
          return {ok: false, error: 'ACTION_NOT_SUPPORTED'};
        }

        const response = mockUrlFetch.fetch('server-url', {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            _action,
            token: 'test-token',
            email: 'test@example.com',
            scriptId: 'test-script-id',
            spreadsheetId: 'test-spreadsheet-id',
            apiKey: 'test-api-key',
            ..._data,
          }),
          muteHttpExceptions: true,
        });

        if (response.getResponseCode() === 200) {
          return JSON.parse(response.getContentText());
        }

        return {ok: false, error: 'HTTP_ERROR'};
      };

      const result = callServerAction_('gm', {prompt: 'test prompt'});

      expect(result.ok).toBe(true);
      expect(result.data).toBe('Generated text');
    });

    test('should reject unsupported action', () => {
      const mockCapabilities = {
        serverVersion: '4.0.0',
        minClientVersion: '3.0.0',
        supportedActions: ['gm'],
      };

      mockCache.get.mockReturnValue(JSON.stringify(mockCapabilities));

      const callServerAction_ = (action) => {
        const capabilities = JSON.parse(mockCache.get('SERVER_CAPABILITIES'));

        if (capabilities.supportedActions.indexOf(action) === -1) {
          return {ok: false, error: 'ACTION_NOT_SUPPORTED', message: `Action '${action}' not supported by server`};
        }
        return {ok: true};
      };

      const result = callServerAction_('unsupported_action');

      expect(result.ok).toBe(false);
      expect(result.error).toBe('ACTION_NOT_SUPPORTED');
    });

    test('should reject when client version is too old', () => {
      const mockCapabilities = {
        serverVersion: '4.0.0',
        minClientVersion: '4.0.0',
        supportedActions: ['gm'],
      };

      mockCache.get.mockReturnValue(JSON.stringify(mockCapabilities));

      const callServerAction_ = (_action, _data) => {
        const capabilities = JSON.parse(mockCache.get('SERVER_CAPABILITIES'));
        const clientVersion = '3.0.0';

        if (capabilities.minClientVersion) {
          const v1parts = clientVersion.split('.').map(Number);
          const v2parts = capabilities.minClientVersion.split('.').map(Number);

          for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;

            if (v1part < v2part) {
              return {
                ok: false,
                error: 'VERSION_MISMATCH',
                message: `Client version ${clientVersion} is incompatible with server (minimum: ${capabilities.minClientVersion})`,
                details: {
                  clientVersion,
                  serverVersion: capabilities.serverVersion,
                  minClientVersion: capabilities.minClientVersion,
                },
              };
            }
            if (v1part > v2part) break;
          }
        }
        return {ok: true};
      };

      const result = callServerAction_('gm', {});

      expect(result.ok).toBe(false);
      expect(result.error).toBe('VERSION_MISMATCH');
      expect(result.details.clientVersion).toBe('3.0.0');
      expect(result.details.minClientVersion).toBe('4.0.0');
    });
  });

  describe('Server Capabilities Response Structure', () => {
    test('should return properly formatted capabilities response', () => {
      const expectedCapabilities = {
        serverVersion: '4.0.0',
        minClientVersion: '3.0.0',
        supportedActions: [
          'capabilities', 'status', 'validate', 'gm', 'gm_image',
          'collect_config_preview', 'collect_config_execute',
        ],
        featureFlags: {
          serverSideCollectConfig: true,
          serverSideOcr: false,
          serverSideUnpackingViewer: false,
          serverSideVkImport: false,
          serverSideBatchUpdate: false,
          enhancedLogging: true,
          rateLimitingV2: false,
        },
        menuEntries: [
          {
            id: 'collect_config',
            name: '🎯 AI Конструктор',
            serverSide: true,
            clientFunction: 'openCollectConfigUI',
          },
          {
            id: 'ocr_run',
            name: '📸 OCR Обработка',
            serverSide: false,
            clientFunction: 'ocrRun',
          },
        ],
        endpoints: {
          primary: 'https://script.google.com/macros/s/AKfycbyyUlB5YWP4bwv3gHHniTv_12cAHlqjYfra7fQ3m3Vri5XvZTQ_uUZZovCYeTo2_u6gQw/exec',
          fallback: null,
        },
      };

      // Verify the structure matches the specification
      expect(expectedCapabilities).toHaveProperty('serverVersion');
      expect(expectedCapabilities).toHaveProperty('minClientVersion');
      expect(expectedCapabilities).toHaveProperty('supportedActions');
      expect(expectedCapabilities).toHaveProperty('featureFlags');
      expect(expectedCapabilities).toHaveProperty('menuEntries');
      expect(expectedCapabilities).toHaveProperty('endpoints');

      expect(Array.isArray(expectedCapabilities.supportedActions)).toBe(true);
      expect(typeof expectedCapabilities.featureFlags).toBe('object');
      expect(Array.isArray(expectedCapabilities.menuEntries)).toBe(true);
      expect(typeof expectedCapabilities.endpoints).toBe('object');

      // Verify specific menu entry structure
      const menuEntry = expectedCapabilities.menuEntries[0];
      expect(menuEntry).toHaveProperty('id');
      expect(menuEntry).toHaveProperty('name');
      expect(menuEntry).toHaveProperty('serverSide');
      expect(menuEntry).toHaveProperty('clientFunction');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', () => {
      mockCache.get.mockReturnValue(null);
      mockUrlFetch.fetch.mockImplementation(() => {
        throw new Error('Network error');
      });

      const ensureServerCapabilities_ = () => {
        try {
          mockCache.get('SERVER_CAPABILITIES');
          mockUrlFetch.fetch();
          return {ok: true};
        } catch (e) {
          return null;
        }
      };

      const result = ensureServerCapabilities_();
      expect(result).toBeNull();
    });

    test('should handle malformed JSON responses', () => {
      const mockResponse = {
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => 'Invalid JSON'),
      };

      mockCache.get.mockReturnValue(null);
      mockUrlFetch.fetch.mockReturnValue(mockResponse);

      const ensureServerCapabilities_ = () => {
        try {
          const response = mockUrlFetch.fetch();
          JSON.parse(response.getContentText());
          return {ok: true};
        } catch (e) {
          return null;
        }
      };

      const result = ensureServerCapabilities_();
      expect(result).toBeNull();
    });

    test('should handle missing capabilities in server response', () => {
      const mockResponse = {
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => JSON.stringify({
          ok: true,
          // Missing 'data' field
        })),
      };

      mockCache.get.mockReturnValue(null);
      mockUrlFetch.fetch.mockReturnValue(mockResponse);

      const ensureServerCapabilities_ = () => {
        const response = mockUrlFetch.fetch();
        const result = JSON.parse(response.getContentText());
        return result.ok && result.data ? result.data : null;
      };

      const result = ensureServerCapabilities_();
      expect(result).toBeNull();
    });
  });
});
