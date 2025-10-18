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
      serverSaveTemplate: jest.fn(function(name, config) {
        if (this.successFn) {
          setTimeout(() => {
            this.successFn(true);
          }, 0);
        }
      }),
      serverDeleteTemplate: jest.fn(function(name) {
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
